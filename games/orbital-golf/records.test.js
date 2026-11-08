import { jest } from '@jest/globals';
import { GolfRecords, emptyRecords, isRecordData } from './records.js';

const finished = (patch = {}) => ({ mode: 'course', date: null, strokes: [2, 2, 3, 3, 3, 3, 3, 3, 4], restarts: 0, ...patch });

function setup(stored = null, saved = true) {
  const kit = { loadProgress: jest.fn(() => stored), saveProgress: jest.fn(() => saved) };
  const notify = jest.fn();
  return { kit, notify, records: new GolfRecords(kit, notify) };
}

describe('Schéma des records v1', () => {
  test('les records vides sont valides', () => {
    expect(isRecordData(emptyRecords())).toBe(true);
  });

  test.each([
    ['absent', null],
    ['version future', { ...emptyRecords(), version: 2 }],
    ['total négatif', { ...emptyRecords(), course: { best: -1, holes: Array(9).fill(null) } }],
    ['huit trous', { ...emptyRecords(), course: { best: null, holes: Array(8).fill(null) } }],
    ['trou décimal', { ...emptyRecords(), course: { best: null, holes: [1.5, ...Array(8).fill(null)] } }],
    ['jour sans objet', { ...emptyRecords(), daily: null }],
    ['date numérique', { ...emptyRecords(), daily: { date: 20260101, strokes: 2 } }],
    ['libre absent', { ...emptyRecords(), free: undefined }],
    ['libre texte', { ...emptyRecords(), free: { best: '12' } }],
  ])('refuse des données invalides : %s', (_label, data) => {
    expect(isRecordData(data)).toBe(false);
  });
});

describe('Records d’une partie terminée', () => {
  test('le parcours d’initiation garde le plus petit total et chaque meilleur trou', () => {
    const { kit, records } = setup();
    expect(records.finish(finished())).toEqual({ record: true, eligible: true, best: 26 });
    expect(kit.saveProgress).toHaveBeenCalledTimes(1);
    const worse = finished({ strokes: [1, 3, 4, 4, 4, 4, 4, 4, 4] });
    expect(records.finish(worse)).toEqual({ record: false, eligible: true, best: 26 });
    expect(records.bestHole(0)).toBe(1);
    expect(records.bestHole(1)).toBe(2);
    expect(kit.saveProgress).toHaveBeenCalledTimes(2);
    expect(records.finish(worse)).toEqual({ record: false, eligible: true, best: 26 });
    expect(kit.saveProgress).toHaveBeenCalledTimes(2);
  });

  test('une partie recommencée ou aidée n’établit aucun record', () => {
    const { kit, records } = setup();
    expect(records.finish(finished({ restarts: 1 }))).toEqual({ record: false, eligible: false, best: null });
    expect(records.finish(finished(), { assisted: true })).toEqual({ record: false, eligible: false, best: null });
    expect(kit.saveProgress).not.toHaveBeenCalled();
  });

  test('le trou du jour repart à zéro chaque jour et garde le meilleur du jour', () => {
    const { records } = setup();
    const daily = (date, strokes) => finished({ mode: 'daily', date, strokes: [strokes] });
    expect(records.finish(daily('2026-01-01', 4)).record).toBe(true);
    expect(records.finish(daily('2026-01-01', 5)).record).toBe(false);
    expect(records.finish(daily('2026-01-01', 3))).toEqual({ record: true, eligible: true, best: 3 });
    expect(records.finish(daily('2026-01-02', 6))).toEqual({ record: true, eligible: true, best: 6 });
    expect(records.best('daily', '2026-01-01')).toBeNull();
    expect(records.best('daily')).toBe(6);
  });

  test('le parcours libre garde son meilleur total', () => {
    const { records } = setup();
    expect(records.finish(finished({ mode: 'free' })).best).toBe(26);
    expect(records.best('free')).toBe(26);
    expect(records.best('course')).toBeNull();
  });

  test('reprend des records valides sans partager l’objet stocké', () => {
    const stored = { ...emptyRecords(), free: { best: 20 } };
    const { records } = setup(stored);
    records.finish(finished({ mode: 'free', strokes: [1, 1, 1, 1, 1, 1, 1, 1, 1] }));
    expect(stored.free.best).toBe(20);
    expect(records.best('free')).toBe(9);
  });
});

describe('Stockage défaillant', () => {
  test('des données illisibles ou futures sont conservées : rien n’est écrit par-dessus', () => {
    const future = { version: 2, anything: true };
    const { kit, notify, records } = setup(future);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('conservés tels quels'));
    expect(records.finish(finished()).record).toBe(true);
    expect(kit.saveProgress).not.toHaveBeenCalled();
    expect(future).toEqual({ version: 2, anything: true });
  });

  test('un échec d’écriture est signalé, le record reste en mémoire', () => {
    const { notify, records } = setup(null, false);
    expect(records.finish(finished()).record).toBe(true);
    expect(notify).toHaveBeenCalledWith('Le stockage est indisponible : ce record restera uniquement en mémoire.');
    expect(records.best('course')).toBe(26);
  });
});
