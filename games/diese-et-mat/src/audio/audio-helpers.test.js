import { jest } from '@jest/globals';
import { applyEffectsConfigToNodes, copyEffectsConfig } from './effects-config.js';
import { buildSynthNodes } from './synth-factory.js';
import { SYNTH_PARAMETER_PROPERTIES, applyLiveSynthParam, mergeSynthParameters } from './synth-parameters.js';

describe('synth-parameters : fusion des paramètres par type', () => {
  test('fusionne seulement les groupes présents, sans muter la source', () => {
    const engine = { fmParams: { harmonicity: 3, modulationIndex: 10 }, pluckParams: { dampening: 1 } };
    const source = { fm: { modulationIndex: 4 }, metal: undefined };
    mergeSynthParameters(engine, source);
    expect(engine).toEqual({ fmParams: { harmonicity: 3, modulationIndex: 4 }, pluckParams: { dampening: 1 } });
    expect(source).toEqual({ fm: { modulationIndex: 4 }, metal: undefined });
  });

  test('chaque type connu a sa propriété dédiée', () => {
    expect(SYNTH_PARAMETER_PROPERTIES).toEqual({
      fm: 'fmParams', pluck: 'pluckParams', membrane: 'membraneParams', metal: 'metalParams',
    });
  });
});

describe('synth-parameters : réglage temps réel', () => {
  test('FM passe par set, pluck et membrane par propriétés, metal par signaux', () => {
    // Forme réelle de MetalSynth dans Tone 15 : frequency est un Param, harmonicity un nombre simple.
    const synth = { set: jest.fn(), frequency: { value: 0 }, harmonicity: 5.1 };
    applyLiveSynthParam(synth, 'fm', 'modulationIndex', 6);
    expect(synth.set).toHaveBeenCalledWith({ modulationIndex: 6 });
    applyLiveSynthParam(synth, 'pluck', 'dampening', 2000);
    applyLiveSynthParam(synth, 'membrane', 'octaves', 3);
    expect(synth).toMatchObject({ dampening: 2000, octaves: 3 });
    applyLiveSynthParam(synth, 'metal', 'frequency', 250);
    applyLiveSynthParam(synth, 'metal', 'harmonicity', 7);
    expect([synth.frequency.value, synth.harmonicity]).toEqual([250, 7]);
  });

  test('un paramètre ou un type sans réglage direct, même hérité de Object, est ignoré', () => {
    const synth = { set: jest.fn() };
    applyLiveSynthParam(synth, 'pluck', 'release', 1);
    applyLiveSynthParam(synth, 'fm', 'toString', 1);
    applyLiveSynthParam(synth, 'constructor', 'name', 1);
    applyLiveSynthParam(synth, 'noise', 'x', 1);
    expect(synth.set).not.toHaveBeenCalled();
    expect(Object.keys(synth)).toEqual(['set']);
  });
});

describe('effects-config', () => {
  test('copyEffectsConfig copie les effets reçus et garde les autres', () => {
    const config = { reverb: { enabled: false, amount: 0.3 }, delay: { enabled: false }, filter: { enabled: false } };
    const saved = { reverb: { enabled: true, amount: 0.8 } };
    copyEffectsConfig(config, saved);
    saved.reverb.amount = 0;
    expect(config.reverb).toEqual({ enabled: true, amount: 0.8 });
    expect(config.delay).toEqual({ enabled: false });
    expect(() => copyEffectsConfig(config, undefined)).not.toThrow();
  });

  test('applyEffectsConfigToNodes écrit les nœuds présents et ignore les absents', () => {
    const nodes = {
      reverb: { wet: { value: 0 } },
      delay: { wet: { value: 0 }, delayTime: { value: 0 }, feedback: { value: 0 } },
      filter: null,
    };
    const config = {
      reverb: { enabled: true, amount: 0.4 },
      delay: { enabled: true, time: 0.25, feedback: 0.6 },
      filter: { enabled: true, frequency: 900 },
    };
    applyEffectsConfigToNodes(nodes, config);
    expect(nodes.reverb.wet.value).toBe(0.4);
    expect(nodes.delay).toEqual({ wet: { value: 0.5 }, delayTime: { value: 0.25 }, feedback: { value: 0.6 } });
    config.reverb.enabled = false;
    config.delay.enabled = false;
    applyEffectsConfigToNodes(nodes, config);
    expect([nodes.reverb.wet.value, nodes.delay.wet.value]).toEqual([0, 0]);
  });
});

describe('synth-factory : type de synthèse et nœuds annexes', () => {
  const makeTone = () => {
    const created = [];
    const klass = (name) => class { constructor(...args) { created.push([name, ...args]); this.kind = name; } };
    const Tone = Object.fromEntries(
      ['Synth', 'FMSynth', 'PolySynth', 'PluckSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Distortion', 'Filter']
        .map((name) => [name, klass(name)]),
    );
    return { Tone, created };
  };
  const settings = {
    synthType: 'poly',
    oscillatorType: 'square',
    envelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.4 },
    fmParams: { harmonicity: 1, modulationIndex: 2 },
    pluckParams: { attackNoise: 1, dampening: 2, resonance: 3, release: 4 },
    membraneParams: { pitchDecay: 0.1, octaves: 2 },
    metalParams: { frequency: 1, harmonicity: 2, modulationIndex: 3, resonance: 4, octaves: 5 },
  };

  test.each([
    ['poly', 'PolySynth'], ['fm', 'PolySynth'], ['pluck', 'PluckSynth'],
    ['membrane', 'MembraneSynth'], ['metal', 'MetalSynth'], ['noise', 'NoiseSynth'],
    ['inconnu', 'PolySynth'], [undefined, 'PolySynth'], ['constructor', 'PolySynth'],
  ])('%s construit un %s', (synthType, kind) => {
    const { Tone } = makeTone();
    const target = {};
    buildSynthNodes(Tone, { ...settings, synthType }, {}, target);
    expect(target.synth.kind).toBe(kind);
    expect(target.distortion).toBeUndefined();
    expect(target.noiseFilter).toBeUndefined();
  });

  test('poly copie l’enveloppe, les autres types la partagent', () => {
    const { Tone, created } = makeTone();
    const target = {};
    buildSynthNodes(Tone, settings, {}, target);
    expect(created[0][2].envelope).toEqual(settings.envelope);
    expect(created[0][2].envelope).not.toBe(settings.envelope);
    buildSynthNodes(Tone, { ...settings, synthType: 'membrane' }, {}, target);
    expect(created[1][1].envelope).toBe(settings.envelope);
  });

  test('distortion pour poly et pluck, filtre passe-haut pour le bruit, FM de repli', () => {
    const { Tone, created } = makeTone();
    const target = {};
    buildSynthNodes(Tone, settings, { effects: { distortion: 0.4 } }, target);
    buildSynthNodes(Tone, { ...settings, synthType: 'pluck' }, { effects: { distortion: 0.2 } }, target);
    expect(created.filter(([name]) => name === 'Distortion').map(([, amount]) => amount)).toEqual([0.4, 0.2]);
    buildSynthNodes(Tone, { ...settings, synthType: 'noise' }, { noise: { type: 'pink', filterFreq: 500 } }, target);
    expect(created.at(-2)).toEqual(['NoiseSynth', expect.objectContaining({ noise: { type: 'pink' } })]);
    expect(created.at(-1)).toEqual(['Filter', { frequency: 500, type: 'highpass' }]);
    buildSynthNodes(Tone, { ...settings, synthType: 'fm' }, {}, {});
    expect(created.at(-1)[2].modulationEnvelope).toEqual({ attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 });
  });

  test('un constructeur Tone qui échoue laisse le synthé déjà créé sur la cible', () => {
    const { Tone } = makeTone();
    Tone.Distortion = class { constructor() { throw new Error('refus Tone'); } };
    const target = {};
    expect(() => buildSynthNodes(Tone, settings, { effects: { distortion: 1 } }, target)).toThrow('refus Tone');
    expect(target.synth.kind).toBe('PolySynth');
  });
});
