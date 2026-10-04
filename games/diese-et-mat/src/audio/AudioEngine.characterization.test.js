/**
 * Caractérisation d'AudioEngine à la frontière Tone.js.
 *
 * Le double de Tone enregistre, dans l'ordre, chaque construction, connexion,
 * réglage et libération demandés par le moteur. Il valide les appels et leurs
 * options, jamais le rendu sonore : aucune écoute humaine ni carte son ici.
 * Le corpus JSON (__tests__/fixtures) a été généré depuis le code d'avant extraction ;
 * UPDATE_AUDIO_CORPUS=1 ne doit servir qu'à un changement de contrat voulu.
 */
import { jest } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { AudioEngine } from './AudioEngine.js';

const CORPUS_PATH = new URL('./__tests__/fixtures/tone-corpus.json', import.meta.url);

/** Construit un Tone factice dont le journal est la seule sortie observable. */
function createToneDouble() {
  const log = [];
  const counters = {};
  const nodes = [];

  const show = (value) => JSON.stringify(value, (key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) { return String(item); }
    if (typeof item === 'function') { return `ctor:${item.toneName}`; }
    if (item && item.toneId) { return item.toneId; }
    return item;
  });
  const record = (...parts) => log.push(parts.join(' '));

  const addParam = (node, property, initial = 0) => {
    let current = initial;
    node[property] = {
      get value() { return current; },
      set value(next) { current = next; record(`${node.toneId}.${property}.value =`, show(next)); },
    };
  };
  const addProperty = (node, property) => {
    let current;
    Object.defineProperty(node, property, {
      get() { return current; },
      set(next) { current = next; record(`${node.toneId}.${property} =`, show(next)); },
    });
  };

  const define = (name, { params = [], properties = [], methods = [] } = {}) => {
    const Node = class {
      constructor(...args) {
        counters[name] = (counters[name] ?? 0) + 1;
        this.toneId = `${name}#${counters[name]}`;
        this.disposed = false;
        nodes.push(this);
        record(...[`new ${this.toneId}`, ...args.map(show)]);
        for (const param of params) { addParam(this, param); }
        for (const property of properties) { addProperty(this, property); }
        if (name === 'Reverb') { this.ready = Promise.resolve(); }
      }
      connect(target) { record(`${this.toneId}.connect`, show(target)); return this; }
      disconnect() { record(`${this.toneId}.disconnect`); return this; }
      toDestination() { record(`${this.toneId}.toDestination`); return this; }
      dispose() { this.disposed = true; record(`${this.toneId}.dispose`); return this; }
      set(options) { record(`${this.toneId}.set`, show(options)); return this; }
    };
    Node.toneName = name;
    for (const method of methods) {
      Node.prototype[method] = function trace(...args) {
        record(`${this.toneId}.${method}`, ...args.map((arg) => show(arg) ?? 'undefined'));
      };
    }
    return Node;
  };

  const voice = (name) => { const Voice = class {}; Voice.toneName = name; return Voice; };
  const triggers = ['triggerAttack', 'triggerRelease', 'triggerAttackRelease'];
  const Tone = {
    version: 'double',
    start: jest.fn(() => { record('Tone.start'); return Promise.resolve(); }),
    Synth: voice('Synth'),
    FMSynth: voice('FMSynth'),
    Filter: define('Filter', { params: ['frequency'] }),
    FeedbackDelay: define('FeedbackDelay', { params: ['wet', 'delayTime', 'feedback'] }),
    Reverb: define('Reverb', { params: ['wet'] }),
    Distortion: define('Distortion'),
    PolySynth: define('PolySynth', { params: ['volume'], methods: [...triggers, 'releaseAll'] }),
    PluckSynth: define('PluckSynth', {
      params: ['volume'], properties: ['dampening', 'resonance', 'attackNoise'], methods: triggers,
    }),
    MembraneSynth: define('MembraneSynth', {
      params: ['volume'], properties: ['pitchDecay', 'octaves'], methods: triggers,
    }),
    // Tone 15 : frequency est un Param (.value) ; harmonicity est un nombre simple.
    MetalSynth: define('MetalSynth', { params: ['volume', 'frequency'], properties: ['harmonicity'], methods: triggers }),
    NoiseSynth: define('NoiseSynth', { params: ['volume'], methods: triggers }),
  };
  // Les paramètres d'un nœud sont des objets { value } : on les nomme pour le journal.
  return { Tone, log, nodes, clear: () => { log.length = 0; } };
}

async function startEngine(options) {
  const double = createToneDouble();
  const engine = new AudioEngine(options);
  engine.ready = true;
  engine.Tone = double.Tone;
  await engine.start();
  return { engine, ...double };
}

const flattenParams = (settings) => JSON.parse(JSON.stringify(settings));

describe('AudioEngine : construction par défaut', () => {
  test('valeurs initiales et options de volume', () => {
    const engine = new AudioEngine({ volume: -20 });
    expect(engine.getSettings()).toEqual({
      preset: 'piano',
      synthType: 'poly',
      oscillator: 'triangle',
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
      fm: { harmonicity: 3, modulationIndex: 10 },
      pluck: { attackNoise: 1.5, dampening: 3500, resonance: 0.98, release: 2 },
      membrane: { pitchDecay: 0.05, octaves: 8 },
      metal: { frequency: 200, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
      effects: {
        reverb: { enabled: false, amount: 0.3 },
        delay: { enabled: false, time: 0.2, feedback: 0.3 },
        filter: { enabled: false, frequency: 2000 },
      },
      volume: -20,
    });
    expect(new AudioEngine().volume).toBe(-10);
    expect(AudioEngine.getOscillatorTypes()).toEqual(['sine', 'triangle', 'square', 'sawtooth']);
  });
});

describe('AudioEngine : chaîne Tone exacte (corpus généré avant extraction)', () => {
  const corpus = {};

  /** Rejoue un scénario sur un moteur démarré dont le journal de démarrage est vidé. */
  async function scenario(name, run, { keepStart = false } = {}) {
    const started = await startEngine();
    if (!keepStart) { started.clear(); }
    run(started.engine);
    corpus[name] = { log: [...started.log], settings: flattenParams(started.engine.getSettings()) };
  }

  const presetNames = Object.keys(AudioEngine.getPresets());

  test('couvre démarrage, presets, types, oscillateurs et effets', async () => {
    await scenario('start', () => {}, { keepStart: true });
    for (const name of presetNames) {
      await scenario(`preset:${name}`, (engine) => engine.setPreset(name));
    }
    for (const type of ['poly', 'fm', 'pluck', 'membrane', 'metal', 'noise']) {
      await scenario(`synthType:${type}`, (engine) => engine.setSynthType(type));
    }
    for (const type of ['sine', 'triangle', 'square', 'sawtooth']) {
      await scenario(`oscillator:${type}`, (engine) => { engine.setOscillator(type); engine.setSynthType('poly'); });
    }
    await scenario('filter-actif-puis-preset', (engine) => {
      engine.setFilter(true, 1200);
      engine.setPreset('guitarElectric');
    });
    await scenario('delay-reverb-puis-percussion', (engine) => {
      engine.setReverb(true, 0.7);
      engine.setDelay(true, 0.4, 0.5);
      engine.setPreset('percSnare');
    });
    await scenario('applySettings-preset', (engine) => engine.applySettings({
      preset: 'bell', volume: -25,
      effects: { reverb: { enabled: true, amount: 0.6 }, delay: { enabled: true, time: 0.3, feedback: 0.2 }, filter: { enabled: true, frequency: 900 } },
    }));
    await scenario('applySettings-custom-noise', (engine) => engine.applySettings({
      preset: 'custom', synthType: 'noise', oscillator: 'square',
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 0.5 },
    }));
    await scenario('applySettings-type-inconnu', (engine) => engine.applySettings({ synthType: 'inconnu' }));
    await scenario('applySettings-parametres', (engine) => engine.applySettings({
      preset: 'custom', synthType: 'metal',
      fm: { harmonicity: 2 }, pluck: { dampening: 100 }, membrane: { octaves: 2 }, metal: { frequency: 400 },
    }));

    if (process.env.UPDATE_AUDIO_CORPUS === '1') {
      writeFileSync(CORPUS_PATH, `${JSON.stringify(corpus, null, 2)}\n`);
    }
    expect(corpus).toEqual(JSON.parse(readFileSync(CORPUS_PATH, 'utf8')));
  });

  test('le corpus contient bien les constructeurs de chaque type de synthé', () => {
    const all = Object.values(JSON.parse(readFileSync(CORPUS_PATH, 'utf8'))).flatMap((entry) => entry.log).join('\n');
    for (const constructor of ['PolySynth', 'PluckSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Distortion', 'Filter']) {
      expect(all).toContain(`new ${constructor}#`);
    }
    expect(all).toContain('ctor:FMSynth');
  });
});

describe('AudioEngine : lecture précise des constructions', () => {
  test('démarrage : effets créés dans l’ordre puis chaînés, synthé poly relié au delay', async () => {
    const { log } = await startEngine();
    expect(log).toEqual([
      'Tone.start',
      'new Filter#1 {"frequency":2000,"type":"lowpass","rolloff":-12}',
      'new FeedbackDelay#1 {"delayTime":0.2,"feedback":0.3,"wet":0}',
      'new Reverb#1 {"decay":2.5,"preDelay":0.01,"wet":0}',
      'Filter#1.connect "FeedbackDelay#1"',
      'FeedbackDelay#1.connect "Reverb#1"',
      'Reverb#1.toDestination',
      'new PolySynth#1 "ctor:Synth" {"oscillator":{"type":"triangle"},"envelope":{"attack":0.02,"decay":0.1,"sustain":0.3,"release":0.8}}',
      'PolySynth#1.volume.value = -10',
      'PolySynth#1.disconnect',
      'PolySynth#1.connect "FeedbackDelay#1"',
    ]);
  });

  test('les effets créés déjà actifs reprennent la configuration', async () => {
    const double = createToneDouble();
    const engine = new AudioEngine();
    engine.ready = true;
    engine.Tone = double.Tone;
    engine.setReverb(true, 0.9);
    engine.setDelay(true, 0.5, 0.6);
    engine.setFilter(true, 500);
    await engine.start();
    expect(double.log).toEqual(expect.arrayContaining([
      'new Filter#1 {"frequency":500,"type":"lowpass","rolloff":-12}',
      'new FeedbackDelay#1 {"delayTime":0.5,"feedback":0.6,"wet":0.5}',
      'new Reverb#1 {"decay":2.5,"preDelay":0.01,"wet":0.9}',
      'PolySynth#1.connect "Filter#1"',
    ]));
  });

  test('piano électrique : FM avec son enveloppe de modulation, bruit sans filtre inutile', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    engine.setPreset('electricPiano');
    expect(log[2]).toBe('new PolySynth#2 "ctor:FMSynth" {"harmonicity":3.01,"modulationIndex":4,"oscillator":{"type":"sine"},"envelope":{"attack":0.001,"decay":0.8,"sustain":0.15,"release":1.5},"modulation":{"type":"sine"},"modulationEnvelope":{"attack":0.002,"decay":0.3,"sustain":0,"release":0.3}}');
    clear();
    engine.setPreset('bell');
    expect(log.find((line) => line.startsWith('new PolySynth'))).toContain('"modulationEnvelope":{"attack":0.002,"decay":0.3,"sustain":0,"release":0.3}');
  });

  test('caisse claire : filtre passe-haut inséré entre le synthé et les effets, distortion de la guitare électrique', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    engine.setPreset('percSnare');
    expect(log.slice(-6)).toEqual([
      'new Filter#2 {"frequency":3000,"type":"highpass"}',
      'NoiseSynth#1.volume.value = -10',
      'NoiseSynth#1.disconnect',
      'Filter#2.disconnect',
      'NoiseSynth#1.connect "Filter#2"',
      'Filter#2.connect "FeedbackDelay#1"',
    ]);
    clear();
    engine.setPreset('guitarElectric');
    expect(log).toEqual(expect.arrayContaining(['new Distortion#1 0.4']));
    expect(log.slice(-2)).toEqual(['PluckSynth#1.connect "Distortion#1"', 'Distortion#1.connect "FeedbackDelay#1"']);
  });

  test('sans chaîne d’effets, le synthé sort directement sur la destination', () => {
    const double = createToneDouble();
    const engine = new AudioEngine();
    engine.Tone = double.Tone;
    engine.started = true;
    engine._createSynth();
    expect(double.log.slice(-2)).toEqual(['PolySynth#1.disconnect', 'PolySynth#1.toDestination']);
  });
});

describe('AudioEngine : remplacement et destruction', () => {
  test('un nouveau synthé relâche et libère l’ancien, distortion et filtre de bruit compris, avant de construire', async () => {
    const { engine, log, clear } = await startEngine();
    engine.setPreset('guitarElectric');
    clear();
    engine.setPreset('percSnare');
    expect(log.slice(0, 4)).toEqual([
      'PluckSynth#1.dispose',
      'Distortion#1.dispose',
      'new NoiseSynth#1 {"noise":{"type":"white"},"envelope":{"attack":0.001,"decay":0.15,"sustain":0,"release":0.03}}',
      'new Filter#2 {"frequency":3000,"type":"highpass"}',
    ]);
    expect(engine.distortion).toBeNull();
    clear();
    engine.setPreset('piano');
    expect(log[0]).toBe('NoiseSynth#1.dispose');
    expect(log[1]).toBe('Filter#2.dispose');
    expect(engine.noiseFilter).toBeNull();
  });

  test('un synthé polyphonique est relâché avant libération', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    engine.setPreset('organ');
    expect(log.slice(0, 2)).toEqual(['PolySynth#1.releaseAll', 'PolySynth#1.dispose']);
  });

  test('un moteur inactif se détruit sans appel Tone et reste inutilisable', async () => {
    const engine = new AudioEngine();
    expect(() => engine.dispose()).not.toThrow();
    expect(engine.Tone).toBeNull();
    await expect(engine.init()).rejects.toThrow('Moteur audio détruit');
    await expect(engine.start()).rejects.toThrow('Moteur audio détruit');
  });

  test('un moteur actif libère synthé, effets et écouteurs', async () => {
    const { engine, nodes } = await startEngine();
    engine.setPreset('guitarElectric');
    const listener = jest.fn();
    engine.on('settingsChange', listener);
    engine.dispose();
    expect(nodes.every((node) => node.disposed)).toBe(true);
    expect(engine.synth).toBeNull();
    expect(engine.effects).toEqual({ reverb: null, delay: null, filter: null });
    expect([engine.started, engine.ready, engine.Tone]).toEqual([false, false, null]);
    engine.emit('settingsChange');
    expect(listener).not.toHaveBeenCalled();
  });

  test('le démarrage détruit pendant la création des effets libère la chaîne partielle', async () => {
    const double = createToneDouble();
    const engine = new AudioEngine();
    engine.ready = true;
    engine.Tone = double.Tone;
    const originalReverb = double.Tone.Reverb;
    double.Tone.Reverb = class extends originalReverb {
      constructor(...args) {
        super(...args);
        this.ready = Promise.resolve().then(() => engine.dispose());
      }
    };
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(engine.start()).rejects.toThrow('Moteur audio détruit');
      expect(double.nodes.every((node) => node.disposed)).toBe(true);
    } finally {
      logged.mockRestore();
    }
  });
});

describe('AudioEngine : réglages et presets', () => {
  let engine;
  let log;
  let clear;
  beforeEach(async () => {
    ({ engine, log, clear } = await startEngine());
  });

  test('un preset inconnu avertit sans modifier ni émettre', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const changed = jest.fn();
    engine.on('settingsChange', changed);
    const before = engine.getSettings();
    engine.setPreset('absent');
    expect(warn).toHaveBeenCalledWith('Preset inconnu:', 'absent');
    expect(engine.getSettings()).toEqual(before);
    expect(changed).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('un preset fusionne ses paramètres et laisse oscillateur et enveloppe hors poly', () => {
    engine.setPreset('guitarFolk');
    const settings = engine.getSettings();
    expect(settings.preset).toBe('guitarFolk');
    expect(settings.synthType).toBe('pluck');
    expect(settings.oscillator).toBe('triangle');
    expect(settings.envelope).toEqual({ attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 });
    expect(settings.fm).toEqual({ harmonicity: 3, modulationIndex: 10 });
    engine.setPreset('retro8bit');
    expect(engine.oscillatorType).toBe(AudioEngine.getPresets().retro8bit.oscillator.type);
    expect(engine.envelope).not.toBe(AudioEngine.getPresets().retro8bit.envelope);
  });

  test('setPreset ne recrée le synthé que si le moteur est démarré', () => {
    const idle = new AudioEngine();
    idle.Tone = { PolySynth: jest.fn() };
    idle.setPreset('organ');
    expect(idle.Tone.PolySynth).not.toHaveBeenCalled();
    expect(idle.synthType).toBe('poly');
  });

  test('applySettings sans configuration ne fait rien', () => {
    clear();
    engine.applySettings(null);
    engine.applySettings(undefined);
    expect(log).toEqual([]);
  });

  test('applySettings avec preset crée deux fois le synthé puis règle les effets dans cet ordre', () => {
    clear();
    const changed = jest.fn();
    engine.on('settingsChange', changed);
    engine.applySettings({
      preset: 'organ', volume: -30,
      effects: { reverb: { enabled: true, amount: 0.5 }, delay: { enabled: true, time: 0.25, feedback: 0.4 }, filter: { enabled: false, frequency: 800 } },
    });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(log.filter((line) => line.startsWith('new PolySynth'))).toHaveLength(2);
    expect(log.slice(-5)).toEqual([
      'Reverb#1.wet.value = 0.5',
      'FeedbackDelay#1.wet.value = 0.5',
      'FeedbackDelay#1.delayTime.value = 0.25',
      'FeedbackDelay#1.feedback.value = 0.4',
      'Filter#1.frequency.value = 800',
    ]);
    expect(engine.volume).toBe(-30);
    expect(engine.effectsConfig.filter).toEqual({ enabled: false, frequency: 800 });
  });

  test('applySettings recopie les effets au lieu de partager les objets reçus', () => {
    const effects = { reverb: { enabled: true, amount: 0.4 } };
    engine.applySettings({ effects });
    effects.reverb.amount = 1;
    expect(engine.effectsConfig.reverb.amount).toBe(0.4);
  });

  test('applySettings personnalisé et preset inconnu passent en custom sans valider le type', () => {
    engine.applySettings({ preset: 'inexistant', synthType: 'inconnu', oscillator: 'square', envelope: { attack: 5 } });
    expect(engine.getSettings()).toMatchObject({ preset: 'custom', synthType: 'inconnu', oscillator: 'square', envelope: { attack: 5 } });
    expect(engine.synth.toneId).toMatch(/^PolySynth#/);
  });

  test('applySettings ignore un volume non numérique', () => {
    engine.applySettings({ volume: '-5' });
    expect(engine.volume).toBe(-10);
  });

  test('applySettings hors démarrage mémorise sans toucher Tone', () => {
    const idle = new AudioEngine();
    idle.applySettings({ preset: 'bell', fm: { modulationIndex: 7 }, volume: -3 });
    expect(idle.getSettings()).toMatchObject({ preset: 'bell', synthType: 'fm', fm: { harmonicity: 5.5, modulationIndex: 7 }, volume: -3 });
  });

  test('setSynthParam : clés connues appliquées en direct, inconnues ignorées mais passage en custom', () => {
    engine.setPreset('electricPiano');
    clear();
    const changed = jest.fn();
    engine.on('settingsChange', changed);
    engine.setSynthParam('fm', 'harmonicity', 5);
    engine.setSynthParam('fm', 'inconnu', 1);
    expect(log).toEqual(['PolySynth#2.set {"harmonicity":5}']);
    expect(engine.fmParams).toEqual({ harmonicity: 5, modulationIndex: 4 });
    expect(engine.currentPreset).toBe('custom');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  test('setSynthParam : sans effet temps réel si le type actif diffère, avertit sur type inconnu', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    clear();
    engine.setSynthParam('pluck', 'dampening', 100);
    expect(log).toEqual([]);
    expect(engine.pluckParams.dampening).toBe(100);
    engine.setPreset('piano');
    engine.setSynthParam('bogus', 'x', 1);
    expect(warn).toHaveBeenCalledWith('Type de synthèse inconnu:', 'bogus');
    warn.mockRestore();
  });

  test.each([
    ['pluck', 'guitarClassic', 'dampening', 111, ['PluckSynth#1.dampening = 111']],
    ['pluck', 'guitarClassic', 'resonance', 0.5, ['PluckSynth#1.resonance = 0.5']],
    ['pluck', 'guitarClassic', 'attackNoise', 2, ['PluckSynth#1.attackNoise = 2']],
    ['pluck', 'guitarClassic', 'release', 3, []],
    ['membrane', 'percKick', 'pitchDecay', 0.2, ['MembraneSynth#1.pitchDecay = 0.2']],
    ['membrane', 'percKick', 'octaves', 4, ['MembraneSynth#1.octaves = 4']],
    ['metal', 'percHihat', 'frequency', 321, ['MetalSynth#1.frequency.value = 321']],
    ['metal', 'percHihat', 'harmonicity', 9, ['MetalSynth#1.harmonicity = 9']],
    ['metal', 'percHihat', 'resonance', 100, []],
    ['fm', 'bell', 'modulationIndex', 8, ['PolySynth#2.set {"modulationIndex":8}']],
  ])('paramètre %s/%s en direct : %s=%s', (type, preset, param, value, expected) => {
    engine.setPreset(preset);
    clear();
    engine.setSynthParam(type, param, value);
    expect(log).toEqual(expected);
  });

  test('un paramètre non modifiable en temps réel est consigné sans lever', () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    engine.setPreset('electricPiano');
    engine.synth.set = () => { throw new Error('immuable'); };
    expect(() => engine.setSynthParam('fm', 'harmonicity', 2)).not.toThrow();
    expect(debug).toHaveBeenCalledWith('Paramètre non modifiable en temps réel:', 'harmonicity', expect.any(Error));
    debug.mockRestore();
  });

  test('enveloppe et oscillateur : bornes, sortie du preset et mise à jour dynamique', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    clear();
    engine.setEnvelope({ attack: 0, decay: 9, sustain: 4, release: -1 });
    expect(engine.envelope).toEqual({ attack: 0.001, decay: 2, sustain: 1, release: 0.01 });
    expect(log).toEqual(['PolySynth#1.set {"envelope":{"attack":0.001,"decay":2,"sustain":1,"release":0.01}}']);
    engine.setEnvelope({ release: 99 });
    expect(engine.envelope).toEqual({ attack: 0.001, decay: 2, sustain: 1, release: 5 });
    engine.setOscillator('square');
    expect(log.at(-1)).toBe('PolySynth#1.set {"oscillator":{"type":"square"}}');
    expect(engine.currentPreset).toBe('custom');
    engine.setOscillator('triangle8');
    expect(warn).toHaveBeenCalledWith('Type d\'oscillateur inconnu:', 'triangle8');
    expect(engine.oscillatorType).toBe('square');
    engine.setSynthType('inconnu');
    expect(warn).toHaveBeenCalledWith('Type de synthèse inconnu:', 'inconnu');
    warn.mockRestore();
  });

  test('effets : bornes, ordre des écritures et reconnexion du filtre', () => {
    clear();
    engine.setReverb(true, 3);
    engine.setDelay(true, 5, 2);
    engine.setFilter(true, 5);
    expect(engine.effectsConfig).toEqual({
      reverb: { enabled: true, amount: 1 },
      delay: { enabled: true, time: 1, feedback: 0.9 },
      filter: { enabled: true, frequency: 100 },
    });
    expect(log).toEqual([
      'Reverb#1.wet.value = 1',
      'FeedbackDelay#1.wet.value = 0.5',
      'FeedbackDelay#1.delayTime.value = 1',
      'FeedbackDelay#1.feedback.value = 0.9',
      'Filter#1.frequency.value = 100',
      'PolySynth#1.disconnect',
      'PolySynth#1.connect "Filter#1"',
    ]);
    clear();
    engine.setFilter(false);
    expect(log.slice(-2)).toEqual(['PolySynth#1.disconnect', 'PolySynth#1.connect "FeedbackDelay#1"']);
  });
});

describe('AudioEngine : lecture, relâchement, accords, volume et muet', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('note libre, pitch objet, durée en notation et fin de note différée', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    const events = [];
    engine.on('noteStart', (e) => events.push(['start', e]));
    engine.on('noteEnd', (e) => events.push(['end', e]));
    engine.playNote({ toTone: () => 'D4' }, 0.25, 3);
    engine.playNote('E4', '8n');
    expect(log).toEqual(['PolySynth#1.triggerAttackRelease "D4" 0.25 3', 'PolySynth#1.triggerAttackRelease "E4" "8n" undefined']);
    jest.advanceTimersByTime(500);
    expect(events).toEqual([
      ['start', { note: 'D4', duration: 0.25 }],
      ['start', { note: 'E4', duration: '8n' }],
      ['end', { note: 'D4' }],
      ['end', { note: 'E4' }],
    ]);
  });

  test('un synthé de bruit ignore la hauteur', async () => {
    const { engine, log, clear } = await startEngine();
    engine.setPreset('percSnare');
    clear();
    const ends = jest.fn();
    engine.on('noteEnd', ends);
    engine.playNote('C4', 0.1, 2);
    expect(log).toEqual(['NoiseSynth#1.triggerAttackRelease 0.1 2']);
    jest.advanceTimersByTime(100);
    expect(ends).toHaveBeenCalledWith({ note: 'noise' });
  });

  test.each([
    ['piano', 'triggerAttack "C4" 5'],
    ['electricPiano', 'triggerAttack "C4" 5'],
    ['guitarClassic', 'triggerAttackRelease "C4" 0.5 5'],
    ['percKick', 'triggerAttackRelease "C4" 0.5 5'],
    ['percHihat', 'triggerAttackRelease "C4" 0.1 5'],
    ['percSnare', 'triggerAttackRelease "16n" 5'],
  ])('noteOn sur %s', async (preset, call) => {
    const { engine, log, clear } = await startEngine();
    engine.setPreset(preset);
    clear();
    engine.noteOn('C4', 5);
    expect(log).toHaveLength(1);
    expect(log[0].endsWith(`.${call}`)).toBe(true);
  });

  test('noteOff ne relâche que poly et fm, mais émet toujours la fin', async () => {
    const { engine, log, clear } = await startEngine();
    const ended = jest.fn();
    engine.on('noteEnd', ended);
    clear();
    engine.noteOff('C4', 1);
    expect(log).toEqual(['PolySynth#1.triggerRelease "C4" 1']);
    engine.setPreset('guitarClassic');
    clear();
    engine.noteOff('C4');
    expect(log).toEqual([]);
    expect(ended).toHaveBeenCalledTimes(2);
  });

  test('accord : toutes les notes ensemble, durée numérique ou 500 ms par défaut', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    const ended = jest.fn();
    engine.on('noteEnd', ended);
    engine.playChord(['C4', { toTone: () => 'E4' }], '4n', 1);
    expect(log).toEqual(['PolySynth#1.triggerAttackRelease ["C4","E4"] "4n" 1']);
    jest.advanceTimersByTime(499);
    expect(ended).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(ended).toHaveBeenCalledWith({ notes: ['C4', 'E4'] });
    engine.playPianoChord(['G4']);
    engine.playPianoNote('A4');
    expect(log.slice(-2)).toEqual(['PolySynth#1.triggerAttackRelease ["G4"] 0.5 undefined', 'PolySynth#1.triggerAttackRelease "A4" 0.5 undefined']);
  });

  test('moteur non démarré ou muet : aucune note', async () => {
    const idle = new AudioEngine();
    expect(() => { idle.playNote('C4'); idle.noteOn('C4'); idle.noteOff('C4'); idle.playChord(['C4']); }).not.toThrow();
    const { engine, log, clear } = await startEngine();
    engine.setMuted(true);
    clear();
    engine.playNote('C4');
    engine.noteOn('C4');
    engine.playChord(['C4']);
    await engine.playSequence([{ pitch: 'C4', duration: 1 }]);
    expect(log).toEqual([]);
  });

  test('séquence : durée en temps du tempo, une pause par note', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    const done = engine.playSequence([{ pitch: 'C4', duration: 2 }, { pitch: 'D4' }], 60);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(1000);
    await done;
    expect(log).toEqual(['PolySynth#1.triggerAttackRelease "C4" 2 undefined', 'PolySynth#1.triggerAttackRelease "D4" 1 undefined']);
  });

  test('gamme descendante : hauteurs inversées au tempo demandé', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    const done = engine.playScale({ getPitches: () => ['C4', 'D4'] }, 120, true);
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(500);
    await done;
    expect(log).toEqual(['PolySynth#1.triggerAttackRelease "D4" 0.25 undefined', 'PolySynth#1.triggerAttackRelease "C4" 0.25 undefined']);
  });

  test('volume borné, muet par -Infinity et restauration', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    engine.setVolume(10);
    engine.setVolume(-100);
    expect(log).toEqual(['PolySynth#1.volume.value = 0', 'PolySynth#1.volume.value = -60']);
    expect(engine.toggleMute()).toBe(true);
    expect(log.at(-1)).toBe('PolySynth#1.volume.value = "-Infinity"');
    expect(engine.toggleMute()).toBe(false);
    expect(log.at(-1)).toBe('PolySynth#1.volume.value = -60');
  });

  test('arrêt général : releaseAll si disponible, sinon triggerRelease', async () => {
    const { engine, log, clear } = await startEngine();
    clear();
    engine.stopAll();
    expect(log).toEqual(['PolySynth#1.releaseAll']);
    engine.setPreset('percKick');
    clear();
    engine.stopAll();
    expect(log).toEqual(['MembraneSynth#1.triggerRelease']);
    expect(() => new AudioEngine().stopAll()).not.toThrow();
  });
});

describe('AudioEngine : limites héritées documentées', () => {
  test('un nouveau synthé repart au volume réglé même si le moteur est muet', async () => {
    const { engine, log, clear } = await startEngine();
    engine.setMuted(true);
    clear();
    engine.setPreset('organ');
    expect(log).toContain('PolySynth#2.volume.value = -10');
  });

  test('désactiver le filtre reconnecte le synthé au delay en contournant distortion et filtre de bruit', async () => {
    const { engine, log, clear } = await startEngine();
    engine.setFilter(true, 1000);
    engine.setPreset('guitarElectric');
    clear();
    engine.setFilter(false, 1000);
    expect(log.slice(-2)).toEqual(['PluckSynth#1.disconnect', 'PluckSynth#1.connect "FeedbackDelay#1"']);
  });

  test('un état JSON inattendu est conservé tel quel pour les types de synthèse', async () => {
    const { engine } = await startEngine();
    engine.applySettings({ envelope: { attack: 'x' } });
    expect(engine.envelope).toEqual({ attack: 'x' });
  });
});
