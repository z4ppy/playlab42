/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { SynthManager } from './SynthManager.js';

const STORAGE_KEY = 'diese-synth-config';

// jsdom n'expose pas structuredClone, présent dans les navigateurs ciblés
global.structuredClone ??= value => JSON.parse(JSON.stringify(value));

/** Double d'AudioEngine : garde un état de réglages, journalise les appels. */
function createEngine() {
  const settings = {
    preset: 'piano',
    oscillator: 'triangle',
    envelope: { attack: 0.5, decay: 0.1, sustain: 0.3, release: 0.8 },
    effects: {
      reverb: { enabled: true, amount: 0.9 },
      delay: { enabled: false, time: 0.2, feedback: 0.3 },
      filter: { enabled: false, frequency: 2000 },
    },
    fm: { harmonicity: 7 },
  };
  const calls = [];
  const record = name => (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    settings,
    start: jest.fn().mockResolvedValue(),
    dispose: jest.fn(),
    applySettings: jest.fn(),
    getSettings: jest.fn(() => structuredClone(settings)),
    setPreset: record('setPreset'),
    setOscillator: record('setOscillator'),
    setEnvelope: record('setEnvelope'),
    setReverb: record('setReverb'),
    setDelay: record('setDelay'),
    setFilter: record('setFilter'),
    setSynthParam: record('setSynthParam'),
    noteOn: jest.fn(),
    noteOff: jest.fn(),
    playNote: jest.fn(),
    playChord: jest.fn(),
    setVolume: jest.fn(),
    setMuted: jest.fn(),
  };
}

function collect(manager, names) {
  const events = [];
  names.forEach(name => manager.on(name, payload => events.push([name, payload])));
  return events;
}

describe('SynthManager : caractérisation de la configuration', () => {
  beforeEach(() => localStorage.clear());

  test('configuration par défaut isolée en lecture', () => {
    const manager = new SynthManager();
    expect(manager.preset).toBe('piano');
    expect(manager.oscillator).toBe('triangle');
    expect(manager.isAudioReady).toBe(false);
    expect(manager.audioEngine).toBeNull();
    manager.envelope.attack = 99;
    manager.effects.reverb.enabled = true;
    manager.config.fm.harmonicity = 99;
    expect(manager.envelope.attack).toBe(0.02);
    expect(manager.effects.reverb.enabled).toBe(false);
    expect(manager.config.fm.harmonicity).toBe(3);
    manager.dispose();
  });

  test('charge une configuration stockée valide et ignore les invalides', () => {
    const stored = {
      preset: 'organ',
      envelope: { attack: 1 },
      effects: { reverb: { enabled: true } },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const manager = new SynthManager();
    expect(manager.preset).toBe('organ');
    expect(manager.envelope).toEqual({ attack: 1 });
    expect(manager.oscillator).toBe('triangle');
    manager.dispose();

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      localStorage.setItem(STORAGE_KEY, '{pas du json');
      expect(new SynthManager().preset).toBe('piano');
      expect(warn).toHaveBeenCalledTimes(1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: 'organ' }));
      expect(new SynthManager().preset).toBe('piano');
      localStorage.setItem(STORAGE_KEY, 'null');
      expect(new SynthManager().preset).toBe('piano');
    } finally {
      warn.mockRestore();
    }
  });

  test('setPreset valide le nom, persiste et émet dans l’ordre', () => {
    const manager = new SynthManager();
    const events = collect(manager, ['preset-changed', 'config-changed']);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      manager.setPreset('inexistant');
      expect(warn).toHaveBeenCalledWith('Preset inconnu: inexistant');
      expect(events).toEqual([]);
      const [name] = Object.keys(manager.getPresets()).filter(n => n !== 'piano');
      manager.setPreset(name);
      expect(manager.preset).toBe(name);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preset).toBe(name);
      expect(events.map(e => e[0])).toEqual(['preset-changed', 'config-changed']);
      expect(events[0][1]).toEqual({ preset: name });
      expect(typeof manager.getCurrentSynthType()).toBe('string');
    } finally {
      warn.mockRestore();
      manager.dispose();
    }
  });

  test('getCurrentSynthType retombe sur poly pour un preset inconnu', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      preset: 'fantome', envelope: {}, effects: {},
    }));
    const manager = new SynthManager();
    expect(manager.getCurrentSynthType()).toBe('poly');
    manager.dispose();
  });

  test('setOscillator, setEnvelope et setSynthParam avant audio : état local, stockage, événements', () => {
    const manager = new SynthManager();
    const events = collect(manager, [
      'oscillator-changed', 'envelope-changed', 'synth-param-changed', 'config-changed',
    ]);
    manager.setOscillator('square');
    manager.setEnvelope({ attack: 0.4 });
    manager.setSynthParam('fm', 'harmonicity', 6);
    manager.setSynthParam('nouveau', 'x', 1);
    expect(manager.oscillator).toBe('square');
    expect(manager.envelope).toEqual({ attack: 0.4, decay: 0.1, sustain: 0.3, release: 0.8 });
    expect(manager.getSynthParams('fm').harmonicity).toBe(6);
    expect(manager.getSynthParams('nouveau')).toEqual({ x: 1 });
    expect(manager.getSynthParams('absent')).toEqual({});
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.oscillator).toBe('square');
    expect(saved.nouveau).toEqual({ x: 1 });
    expect(events.filter(e => e[0] !== 'config-changed').map(e => e[0])).toEqual([
      'oscillator-changed', 'envelope-changed', 'synth-param-changed', 'synth-param-changed',
    ]);
    expect(events[4][1]).toEqual({ synthType: 'fm', param: 'harmonicity', value: 6 });
    manager.dispose();
  });

  test('setEffect rejette un effet inconnu, fusionne les paramètres sinon', () => {
    const manager = new SynthManager();
    const events = collect(manager, ['effect-changed']);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      manager.setEffect('chorus', { enabled: true });
      expect(warn).toHaveBeenCalledWith('Effet inconnu: chorus');
      expect(events).toEqual([]);
      manager.toggleEffect('delay', true);
      manager.setEffect('delay', { time: 0.5 });
      expect(manager.effects.delay).toEqual({ enabled: true, time: 0.5, feedback: 0.3 });
      expect(events[1][1]).toEqual({
        effectName: 'delay', config: { enabled: true, time: 0.5, feedback: 0.3 },
      });
    } finally {
      warn.mockRestore();
      manager.dispose();
    }
  });

  test('reloadConfig relit le stockage ; resetConfig rétablit les valeurs par défaut', () => {
    const manager = new SynthManager();
    const events = collect(manager, ['config-changed']);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      preset: 'organ', envelope: { attack: 2 }, effects: {},
    }));
    manager.reloadConfig();
    expect(manager.preset).toBe('organ');
    manager.setOscillator('sine');
    manager.resetConfig();
    expect(manager.preset).toBe('piano');
    expect(manager.oscillator).toBe('triangle');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).oscillator).toBe('triangle');
    expect(events).toHaveLength(3);
    manager.dispose();
  });

  test('reloadConfig et resetConfig réappliquent les réglages au moteur prêt', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    await manager.ensureAudioReady();
    engine.applySettings.mockClear();
    manager.reloadConfig();
    manager.resetConfig();
    expect(engine.applySettings).toHaveBeenCalledTimes(2);
    expect(engine.applySettings.mock.calls[1][0].preset).toBe('piano');
    manager.dispose();
  });

  test('un stockage plein est purgé puis réessayé, un autre échec est signalé', () => {
    const manager = new SynthManager();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
    try {
      const quota = Object.assign(new Error('plein'), { name: 'QuotaExceededError' });
      setItem.mockImplementationOnce(() => { throw quota; });
      manager.setOscillator('sine');
      expect(removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(setItem).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith('localStorage plein, suppression des anciennes données');

      setItem.mockImplementation(() => { throw quota; });
      manager.setOscillator('square');
      expect(warn).toHaveBeenCalledWith('Impossible de sauvegarder la config synthé');
      expect(manager.oscillator).toBe('square');

      setItem.mockImplementation(() => { throw new Error('refusé'); });
      manager.setOscillator('sawtooth');
      expect(warn).toHaveBeenLastCalledWith('Erreur lors de la sauvegarde:', expect.any(Error));
    } finally {
      setItem.mockRestore();
      removeItem.mockRestore();
      warn.mockRestore();
      manager.dispose();
    }
  });
});

describe('SynthManager : caractérisation du moteur audio', () => {
  beforeEach(() => localStorage.clear());

  test('ensureAudioReady crée un AudioEngine par défaut, partage l’initialisation et émet audio-ready', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    const events = collect(manager, ['audio-ready']);
    const first = manager.ensureAudioReady();
    expect(manager.ensureAudioReady()).toBe(first);
    expect(await first).toBe(engine);
    expect(engine.start).toHaveBeenCalledTimes(1);
    expect(engine.applySettings).toHaveBeenCalledWith(expect.objectContaining({ preset: 'piano' }));
    expect(manager.isAudioReady).toBe(true);
    expect(manager.ensureAudioReady()).toBe(engine);
    expect(events).toEqual([['audio-ready', {}]]);
    manager.dispose();
  });

  test('ensureAudioReady refuse un gestionnaire détruit', () => {
    const manager = new SynthManager({ audioEngine: createEngine() });
    manager.dispose();
    expect(() => manager.ensureAudioReady()).toThrow('Gestionnaire audio détruit');
  });

  test('sans moteur fourni, un AudioEngine réel est construit et son échec est propagé', async () => {
    const manager = new SynthManager();
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(manager.ensureAudioReady()).rejects.toThrow();
      expect(manager.audioEngine).not.toBeNull();
      expect(manager.isAudioReady).toBe(false);
    } finally {
      logged.mockRestore();
      manager.dispose();
    }
  });

  test('les réglages sont relayés au moteur prêt puis relus depuis celui-ci', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    await manager.ensureAudioReady();
    const [other] = Object.keys(manager.getPresets()).filter(n => n !== 'piano');
    manager.setPreset(other);
    manager.setOscillator('sine');
    manager.setEnvelope({ release: 2 });
    manager.setSynthParam('fm', 'harmonicity', 4);
    manager.setEffect('reverb', { amount: 0.5 });
    manager.setEffect('delay', { enabled: true });
    manager.setEffect('filter', { frequency: 500 });
    expect(engine.calls).toEqual([
      ['setPreset', other],
      ['setOscillator', 'sine'],
      ['setEnvelope', { release: 2 }],
      ['setSynthParam', 'fm', 'harmonicity', 4],
      ['setReverb', true, 0.5],
      ['setDelay', true, 0.2, 0.3],
      ['setFilter', false, 500],
    ]);
    // La configuration locale reflète les réglages normalisés du moteur
    expect(manager.envelope.attack).toBe(0.5);
    expect(manager.effects.reverb.enabled).toBe(true);
    manager.dispose();
  });

  test('noteOn, noteOff et stopAllNotes pilotent le moteur et les événements', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    const events = collect(manager, ['note-on', 'note-off', 'all-notes-off']);
    await manager.noteOn('C4');
    await manager.noteOn('C4');
    await manager.noteOn('E4');
    expect(engine.noteOn).toHaveBeenCalledTimes(2);
    expect([...manager.activeNotes]).toEqual(['C4', 'E4']);
    manager.noteOff('C4');
    manager.noteOff('C4');
    manager.noteOff('G4');
    expect(engine.noteOff).toHaveBeenCalledTimes(1);
    manager.stopAllNotes();
    expect(engine.noteOff).toHaveBeenLastCalledWith('E4');
    expect(manager.activeNotes.size).toBe(0);
    expect(events.map(e => e[0])).toEqual([
      'note-on', 'note-on', 'note-off', 'all-notes-off',
    ]);
    manager.dispose();
  });

  test('noteOn libère la demande en attente quand le démarrage échoue', async () => {
    const engine = createEngine();
    engine.start.mockRejectedValueOnce(new Error('contexte refusé'));
    const manager = new SynthManager({ audioEngine: engine });
    await expect(manager.noteOn('C4')).rejects.toThrow('contexte refusé');
    expect(manager._pendingNotes.size).toBe(0);
    await manager.noteOn('C4');
    expect(engine.noteOn).toHaveBeenCalledWith('C4');
    manager.dispose();
  });

  test('noteOff et stopAllNotes sans moteur restent silencieux', () => {
    const manager = new SynthManager();
    manager._activeNotes.add('C4');
    const events = collect(manager, ['note-off', 'all-notes-off']);
    manager.noteOff('C4');
    manager._activeNotes.add('D4');
    manager.stopAllNotes();
    expect(events.map(e => e[0])).toEqual(['note-off', 'all-notes-off']);
    manager.dispose();
  });

  test('playNote et playChord attendent le moteur, ont une durée par défaut et respectent dispose', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    const events = collect(manager, ['note-played', 'chord-played']);
    await manager.playNote('C4');
    await manager.playChord(['C4', 'E4'], 1);
    expect(engine.playNote).toHaveBeenCalledWith('C4', 0.5);
    expect(engine.playChord).toHaveBeenCalledWith(['C4', 'E4'], 1);
    expect(events).toEqual([
      ['note-played', { pitch: 'C4', duration: 0.5 }],
      ['chord-played', { pitches: ['C4', 'E4'], duration: 1 }],
    ]);

    for (const play of [m => m.playNote('A4'), m => m.playChord(['A4'])]) {
      let release;
      const slow = createEngine();
      slow.start = jest.fn(() => new Promise((resolve) => { release = resolve; }));
      const second = new SynthManager({ audioEngine: slow });
      const pending = expect(play(second)).rejects.toThrow('Gestionnaire audio détruit');
      second.dispose();
      release();
      await pending;
      expect(slow.playNote).not.toHaveBeenCalled();
      expect(slow.playChord).not.toHaveBeenCalled();
    }
    manager.dispose();
  });

  test('volume et mute sont relayés seulement quand un moteur existe', () => {
    const engine = createEngine();
    const manager = new SynthManager();
    manager.setVolume(-3);
    manager.setMuted(true);
    manager._audioEngine = engine;
    manager.setVolume(-3);
    manager.setMuted(true);
    expect(engine.setVolume).toHaveBeenCalledWith(-3);
    expect(engine.setMuted).toHaveBeenCalledWith(true);
    manager.dispose();
  });

  test('dispose libère le moteur, arrête les notes et coupe les écouteurs', async () => {
    const engine = createEngine();
    const manager = new SynthManager({ audioEngine: engine });
    await manager.noteOn('C4');
    const listener = jest.fn();
    manager.on('note-off', listener);
    manager.dispose();
    expect(engine.noteOff).toHaveBeenCalledWith('C4');
    expect(engine.dispose).toHaveBeenCalledTimes(1);
    expect(manager.audioEngine).toBeNull();
    expect(manager.isAudioReady).toBe(false);
    await manager.noteOn('D4');
    expect(engine.noteOn).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
