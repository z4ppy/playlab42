/**
 * Construction des synthétiseurs Tone.js d'AudioEngine
 *
 * Chaque constructeur écrit ses nœuds sur la cible (le moteur) au fur et à
 * mesure : si un constructeur Tone.js échoue en cours de route, les nœuds déjà
 * créés restent atteignables pour la libération du moteur.
 *
 * @module audio/synth-factory
 */

/** Modulation par défaut d'un synthé FM sans fmModEnv (attaque Rhodes) */
const DEFAULT_FM_MODULATION_ENVELOPE = { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 };

/** Ajoute la distortion demandée par le preset, sinon rien */
function addDistortion(Tone, preset, target) {
  if (preset.effects?.distortion) {
    target.distortion = new Tone.Distortion(preset.effects.distortion);
  }
}

function buildPluck(Tone, settings, preset, target) {
  const { attackNoise, dampening, resonance, release } = settings.pluckParams;
  target.synth = new Tone.PluckSynth({ attackNoise, dampening, resonance, release });
  addDistortion(Tone, preset, target);
}

function buildFm(Tone, settings, preset, target) {
  target.synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: settings.fmParams.harmonicity,
    modulationIndex: settings.fmParams.modulationIndex,
    oscillator: { type: 'sine' },
    envelope: settings.envelope,
    modulation: { type: 'sine' },
    modulationEnvelope: preset.fmModEnv || DEFAULT_FM_MODULATION_ENVELOPE,
  });
}

function buildMembrane(Tone, settings, preset, target) {
  target.synth = new Tone.MembraneSynth({
    pitchDecay: settings.membraneParams.pitchDecay,
    octaves: settings.membraneParams.octaves,
    oscillator: { type: 'sine' },
    envelope: settings.envelope,
  });
}

function buildMetal(Tone, settings, preset, target) {
  const { frequency, harmonicity, modulationIndex, resonance, octaves } = settings.metalParams;
  target.synth = new Tone.MetalSynth({
    frequency, harmonicity, modulationIndex, resonance, octaves, envelope: settings.envelope,
  });
}

function buildNoise(Tone, settings, preset, target) {
  target.synth = new Tone.NoiseSynth({
    noise: { type: preset.noise?.type || 'white' },
    envelope: settings.envelope,
  });
  if (preset.noise?.filterFreq) {
    target.noiseFilter = new Tone.Filter({ frequency: preset.noise.filterFreq, type: 'highpass' });
  }
}

function buildPoly(Tone, settings, preset, target) {
  target.synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: settings.oscillatorType },
    envelope: { ...settings.envelope },
  });
  addDistortion(Tone, preset, target);
}

/** Constructeur par type de synthèse ; tout autre type retombe sur buildPoly */
const SYNTH_BUILDERS = {
  pluck: buildPluck,
  fm: buildFm,
  membrane: buildMembrane,
  metal: buildMetal,
  noise: buildNoise,
  poly: buildPoly,
};

/**
 * Crée le synthé du type courant et ses nœuds annexes
 *
 * @param {Object} Tone - Module Tone.js
 * @param {Object} settings - Réglages (synthType, oscillatorType, envelope, *Params)
 * @param {Object} preset - Preset actif (effects, noise, fmModEnv)
 * @param {Object} target - Reçoit synth, distortion et noiseFilter
 */
export function buildSynthNodes(Tone, settings, preset, target) {
  const build = Object.hasOwn(SYNTH_BUILDERS, settings.synthType) ? SYNTH_BUILDERS[settings.synthType] : buildPoly;
  build(Tone, settings, preset, target);
}
