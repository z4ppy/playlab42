import { jest } from '@jest/globals';

const imports = jest.fn();

jest.unstable_mockModule('tone', () => {
  imports();
  return { marker: 'tone' };
});

const { AudioEngine } = await import('./AudioEngine.js');

describe('AudioEngine : initialisation unique de Tone.js', () => {
  let logged;

  beforeEach(() => {
    imports.mockClear();
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  test('init charge Tone, devient prêt et émet ready une seule fois', async () => {
    const engine = new AudioEngine();
    const ready = jest.fn();
    engine.on('ready', ready);
    expect(engine.ready).toBe(false);
    await expect(engine.init()).resolves.toBeUndefined();
    expect(engine.ready).toBe(true);
    expect(engine.Tone.marker).toBe('tone');
    expect(ready).toHaveBeenCalledTimes(1);
    expect(engine.started).toBe(false);
    expect(engine._initPromise).toBeNull();
    engine.dispose();
  });

  test('deux init simultanés partagent la même promesse', async () => {
    const engine = new AudioEngine();
    const ready = jest.fn();
    engine.on('ready', ready);
    const first = engine.init();
    expect(engine.init()).toBe(first);
    await first;
    expect(ready).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  test('un moteur prêt répond sans réémettre ready', async () => {
    const engine = new AudioEngine();
    await engine.init();
    const ready = jest.fn();
    engine.on('ready', ready);
    await expect(engine.init()).resolves.toBeUndefined();
    expect(ready).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    engine.dispose();
  });

  test('un moteur détruit rejette immédiatement sans journal', async () => {
    const engine = new AudioEngine();
    engine.dispose();
    await expect(engine.init()).rejects.toThrow('Moteur audio détruit');
    expect(imports).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    expect(engine.ready).toBe(false);
  });

  test('détruit pendant le chargement : échec enveloppé, aucun état prêt', async () => {
    const engine = new AudioEngine();
    const pending = engine.init();
    engine.dispose();
    const failure = await pending.catch((error) => error);
    expect(failure.message).toBe('Impossible de charger Tone.js');
    expect(failure.cause.message).toBe('Moteur audio détruit');
    expect(logged).toHaveBeenCalledWith('Erreur lors du chargement de Tone.js:', failure.cause);
    expect(engine.ready).toBe(false);
    expect(engine.Tone).toBeNull();
    await expect(engine.init()).rejects.toThrow('Moteur audio détruit');
  });
});
