import { jest } from '@jest/globals';
import { TetrisRecords, isRecordData } from './records.js';

const EMPTY = { version: 1, marathon: null, sprint: null, ultra: null };

function setup(stored = null, { saveProgress = true, saveScore = true } = {}) {
  const kit = {
    loadProgress: jest.fn(() => stored),
    saveProgress: jest.fn(() => saveProgress),
    saveScore: jest.fn(() => saveScore),
  };
  const notify = jest.fn();
  return { kit, notify, records: new TetrisRecords(kit, notify) };
}
const game = (mode, score, lines = 0, elapsed = 0) => ({ mode, score, lines, elapsed });

describe('TetrisRecords : chargement', () => {
  it('démarre vide sans notification quand rien n\'est stocké', () => {
    const { records, notify } = setup();
    expect(['marathon', 'sprint', 'ultra'].map(mode => records.get(mode))).toEqual([null, null, null]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('copie des records valides sans partager l\'objet stocké', () => {
    const stored = { ...EMPTY, marathon: 1200, sprint: 45000.5, ultra: 0 };
    const { records, notify } = setup(stored);
    expect([records.get('marathon'), records.get('sprint'), records.get('ultra')]).toEqual([1200, 45000.5, 0]);
    records.data.marathon = 5;
    expect(stored.marathon).toBe(1200);
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([
    ['une version inconnue', { ...EMPTY, version: 2 }],
    ['un texte', 'records'],
    ['un nombre négatif', { ...EMPTY, ultra: -1 }],
    ['un nombre infini', { ...EMPTY, sprint: Infinity }],
    ['une chaîne numérique', { ...EMPTY, marathon: '10' }],
    ['un mode absent', { version: 1, marathon: null, sprint: null }],
  ])('refuse %s, prévient et repart de zéro', (_, stored) => {
    const { records, notify } = setup(stored);
    expect(records.data).toEqual(EMPTY);
    expect(notify).toHaveBeenCalledWith('Les anciens records sont illisibles. Les nouveaux records les remplaceront.');
  });

  it('isRecordData reconnaît exactement le schéma v1', () => {
    expect(isRecordData(null)).toBe(false);
    expect(isRecordData(undefined)).toBe(false);
    expect(isRecordData(0)).toBe(false);
    expect(isRecordData(EMPTY)).toBe(true);
    expect(isRecordData({ ...EMPTY, sprint: 0 })).toBe(true);
    expect(isRecordData({ ...EMPTY, ultra: NaN })).toBe(false);
  });
});

describe('TetrisRecords.finish : meilleurs scores et temps', () => {
  it.each(['marathon', 'ultra'])('%s : premier score, amélioration, égalité et score inférieur', (mode) => {
    const { records, kit } = setup();
    expect(records.finish(game(mode, 500))).toBe(true);
    expect(records.get(mode)).toBe(500);
    expect(records.finish(game(mode, 500))).toBe(false);
    expect(records.finish(game(mode, 400))).toBe(false);
    expect(records.finish(game(mode, 501))).toBe(true);
    expect(records.get(mode)).toBe(501);
    expect(kit.saveProgress).toHaveBeenCalledTimes(2);
    expect(kit.saveProgress).toHaveBeenLastCalledWith({ ...EMPTY, [mode]: 501 });
    expect(kit.saveScore.mock.calls).toEqual([[500], [500], [400], [501]]);
  });

  it('un score de zéro est un premier record valide', () => {
    const { records } = setup();
    expect(records.finish(game('marathon', 0))).toBe(true);
    expect(records.get('marathon')).toBe(0);
  });

  it('Sprint : seul un temps de 40 lignes compte, plus rapide est meilleur, sans score générique', () => {
    const { records, kit } = setup();
    expect(records.finish(game('sprint', 9999, 39, 1000))).toBe(false);
    expect(records.get('sprint')).toBeNull();
    expect(records.finish(game('sprint', 0, 40, 60000))).toBe(true);
    expect(records.finish(game('sprint', 0, 40, 60000))).toBe(false);
    expect(records.finish(game('sprint', 0, 41, 70000))).toBe(false);
    expect(records.finish(game('sprint', 0, 40, 59999))).toBe(true);
    expect(records.get('sprint')).toBe(59999);
    expect(records.finish(game('sprint', 0, 12, 100))).toBe(false);
    expect(kit.saveScore).not.toHaveBeenCalled();
    expect(kit.saveProgress).toHaveBeenCalledTimes(2);
  });

  it('les records sont indépendants entre les modes', () => {
    const { records } = setup({ ...EMPTY, marathon: 10000, ultra: 10000 });
    expect(records.finish(game('sprint', 0, 40, 90000))).toBe(true);
    expect(records.finish(game('marathon', 9999))).toBe(false);
    expect([records.get('marathon'), records.get('sprint'), records.get('ultra')]).toEqual([10000, 90000, 10000]);
  });

  it('prévient quand le record ne peut pas être sauvegardé tout en le gardant en mémoire', () => {
    const { records, notify } = setup(null, { saveProgress: false });
    expect(records.finish(game('sprint', 0, 40, 5000))).toBe(true);
    expect(records.get('sprint')).toBe(5000);
    expect(notify).toHaveBeenCalledWith('Le stockage est indisponible : ce record restera uniquement en mémoire.');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('prévient quand le score ne peut pas être sauvegardé, record ou non', () => {
    const { records, notify } = setup({ ...EMPTY, marathon: 5000 }, { saveScore: false });
    expect(records.finish(game('marathon', 10))).toBe(false);
    expect(notify).toHaveBeenCalledWith('Le stockage est indisponible : le score ne peut pas être sauvegardé.');
    expect(records.finish(game('marathon', 9000))).toBe(true);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('cumule les deux avertissements quand tout le stockage échoue', () => {
    const { records, notify } = setup(null, { saveProgress: false, saveScore: false });
    records.finish(game('ultra', 7));
    expect(notify.mock.calls.map(([message]) => message)).toEqual([
      'Le stockage est indisponible : ce record restera uniquement en mémoire.',
      'Le stockage est indisponible : le score ne peut pas être sauvegardé.',
    ]);
  });
});
