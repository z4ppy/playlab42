import { describe, expect, it, jest } from '@jest/globals';
import { createProgressStore, isProgressData } from '../progress-store.js';
import { createPuzzleFactory } from '../generation.js';
import { SudokuEngine } from '../../engine.js';
import { CLASSIC } from '../../engine/__tests__/fixtures.js';

const engine = new SudokuEngine();
const config = { seed: 1, playerIds: ['joueur'], puzzle: CLASSIC };
const savedGame = () => ({ state: engine.init(config), elapsedMs: 1200, hints: 1, assisted: false });

function fakeKit(initial) {
  let stored = initial;
  return {
    loadProgress: jest.fn(() => stored),
    saveProgress: jest.fn((data) => { stored = JSON.parse(JSON.stringify(data)); return true; }),
    stored: () => stored,
  };
}

describe('Sauvegarde locale', () => {
  it('valide le format versionné', () => {
    const best = { easy: 1000, medium: null, hard: null, expert: null };
    expect(isProgressData({ version: 1, current: null, best })).toBe(true);
    expect(isProgressData({ version: 1, current: savedGame(), best })).toBe(true);
    expect(isProgressData({ version: 2, current: null, best })).toBe(false);
    expect(isProgressData({ version: 1, current: { ...savedGame(), elapsedMs: -1 }, best })).toBe(false);
    expect(isProgressData({ version: 1, current: { state: {} }, best })).toBe(false);
    expect(isProgressData({ version: 1, current: null, best: { ...best, easy: 'vite' } })).toBe(false);
    expect(isProgressData({ version: 1, current: null })).toBe(false);
    expect(isProgressData(null)).toBe(false);
  });

  it('démarre vide, enregistre la partie en cours et les meilleurs temps', () => {
    const kit = fakeKit(null);
    const notify = jest.fn();
    const store = createProgressStore(kit, notify);
    expect(store.current()).toBeNull();
    store.saveCurrent(savedGame());
    expect(kit.stored().current.elapsedMs).toBe(1200);
    expect(store.recordTime('easy', 5000)).toBe(true);
    expect(store.recordTime('easy', 7000)).toBe(false);
    expect(store.recordTime('easy', 4000)).toBe(true);
    expect(store.best('easy')).toBe(4000);
    expect(store.current()).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    // Rechargement : la donnée relue est la même.
    expect(createProgressStore(kit, notify).best('easy')).toBe(4000);
  });

  it('ne réécrit jamais une sauvegarde illisible ou future, et le signale', () => {
    const future = { version: 9, inconnu: true };
    const kit = fakeKit(future);
    const notify = jest.fn();
    const store = createProgressStore(kit, notify);
    store.saveCurrent(savedGame());
    store.recordTime('easy', 1);
    expect(kit.saveProgress).not.toHaveBeenCalled();
    expect(kit.stored()).toBe(future);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('conservée telle quelle'));
  });

  it('signale un stockage indisponible', () => {
    const kit = { loadProgress: () => null, saveProgress: () => false };
    const notify = jest.fn();
    createProgressStore(kit, notify).saveCurrent(null);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('indisponible'));
  });
});

describe('Génération hors du fil principal', () => {
  /** Worker factice : répond de façon asynchrone avec le vrai moteur, ou échoue sur demande. */
  function fakeWorker({ fail = false, error = null } = {}) {
    const listeners = {};
    return {
      terminate: jest.fn(),
      addEventListener: (type, listener) => { listeners[type] = listener; },
      postMessage({ id, config: request }) {
        queueMicrotask(() => {
          if (fail) {
            listeners.error(new Event('error'));
          } else if (error) {
            listeners.message({ data: { id, error } });
          } else {
            listeners.message({ data: { id: id + 1000 } });
            listeners.message({ data: { id, state: engine.init(request) } });
          }
        });
      },
    };
  }

  it('délègue au Worker et retrouve la même grille que le moteur', async () => {
    const worker = fakeWorker();
    const factory = createPuzzleFactory({ engine, createWorker: () => worker });
    await expect(factory.generate(config)).resolves.toEqual(engine.init(config));
    factory.dispose();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('se replie sur le fil principal sans Worker, si sa création ou son exécution échoue', async () => {
    const expected = engine.init(config);
    await expect(createPuzzleFactory({ engine, createWorker: null }).generate(config)).resolves.toEqual(expected);
    const throwing = createPuzzleFactory({ engine, createWorker: () => { throw new Error('module workers'); } });
    await expect(throwing.generate(config)).resolves.toEqual(expected);
    const broken = fakeWorker({ fail: true });
    await expect(createPuzzleFactory({ engine, createWorker: () => broken }).generate(config)).resolves.toEqual(expected);
    expect(broken.terminate).toHaveBeenCalled();
  });

  it('transmet une erreur de configuration renvoyée par le Worker', async () => {
    const factory = createPuzzleFactory({ engine, createWorker: () => fakeWorker({ error: 'Niveau inconnu' }) });
    await expect(factory.generate(config)).rejects.toThrow('Niveau inconnu');
    const fallback = createPuzzleFactory({ engine, createWorker: () => fakeWorker({ fail: true }) });
    await expect(fallback.generate({ ...config, seed: -1 })).rejects.toThrow('seed');
  });
});
