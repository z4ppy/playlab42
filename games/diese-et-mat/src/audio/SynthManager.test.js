/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { SynthManager } from './SynthManager.js';

// jsdom n'expose pas structuredClone, présent dans les navigateurs ciblés
global.structuredClone ??= value => JSON.parse(JSON.stringify(value));

function setup() {
  let ready;
  const engine = {
    start: jest.fn(() => new Promise((resolve) => { ready = resolve; })),
    applySettings: jest.fn(),
    noteOn: jest.fn(),
    noteOff: jest.fn(),
    dispose: jest.fn(),
  };
  const manager = new SynthManager({ audioEngine: engine });
  return { manager, engine, ready: () => ready() };
}

describe('SynthManager : annulation pendant le démarrage audio', () => {
  beforeEach(() => localStorage.clear());

  test('un relâchement rapide annule une note pas encore commencée', async () => {
    const { manager, engine, ready } = setup();
    const pending = manager.noteOn('C4');
    manager.noteOff('C4');
    ready();
    await pending;
    expect(engine.noteOn).not.toHaveBeenCalled();
    expect(manager.activeNotes.size).toBe(0);
    manager.dispose();
  });

  test('une nouvelle pression ne ressuscite pas la demande précédente', async () => {
    const { manager, engine, ready } = setup();
    const first = manager.noteOn('C4');
    manager.noteOff('C4');
    const second = manager.noteOn('C4');
    const duplicate = manager.noteOn('C4');
    ready();
    await Promise.all([first, second, duplicate]);
    expect(engine.start).toHaveBeenCalledTimes(1);
    expect(engine.noteOn).toHaveBeenCalledTimes(1);
    manager.noteOff('C4');
    expect(engine.noteOff).toHaveBeenCalledWith('C4');
    manager.dispose();
  });

  test('stopAllNotes invalide toutes les notes en attente', async () => {
    const { manager, engine, ready } = setup();
    const pending = [manager.noteOn('C4'), manager.noteOn('E4')];
    manager.stopAllNotes();
    ready();
    await Promise.all(pending);
    expect(engine.noteOn).not.toHaveBeenCalled();
    manager.dispose();
  });

  test('une destruction pendant le démarrage ne recrée pas le moteur', async () => {
    const { manager, engine, ready } = setup();
    const pending = manager.noteOn('C4');
    manager.dispose();
    ready();
    await expect(pending).rejects.toThrow('Gestionnaire audio détruit');
    expect(engine.applySettings).not.toHaveBeenCalled();
    expect(engine.noteOn).not.toHaveBeenCalled();
    expect(manager.audioEngine).toBeNull();
  });

  test('une erreur de démarrage autorise une nouvelle tentative', async () => {
    const { manager, engine } = setup();
    engine.start.mockRejectedValueOnce(new Error('permission audio'));
    await expect(manager.noteOn('C4')).rejects.toThrow('permission audio');
    engine.start.mockResolvedValueOnce();
    await manager.noteOn('C4');
    expect(engine.noteOn).toHaveBeenCalledTimes(1);
    manager.dispose();
  });
});
