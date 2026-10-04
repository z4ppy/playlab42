/**
 * Paramètres propres à chaque type de synthèse d'AudioEngine
 *
 * Associe un type (fm, pluck, membrane, metal) à la propriété du moteur qui
 * porte ses réglages, et aux écritures temps réel acceptées par Tone.js.
 *
 * @module audio/synth-parameters
 */

/** Type de synthèse → propriété du moteur qui conserve ses paramètres */
export const SYNTH_PARAMETER_PROPERTIES = {
  fm: 'fmParams',
  pluck: 'pluckParams',
  membrane: 'membraneParams',
  metal: 'metalParams',
};

/** Écritures en direct sur un synthé Tone.js déjà créé, par type puis par paramètre */
const LIVE_PARAMETER_SETTERS = {
  fm: {
    harmonicity: (synth, value) => synth.set({ harmonicity: value }),
    modulationIndex: (synth, value) => synth.set({ modulationIndex: value }),
  },
  pluck: {
    dampening: (synth, value) => { synth.dampening = value; },
    resonance: (synth, value) => { synth.resonance = value; },
    attackNoise: (synth, value) => { synth.attackNoise = value; },
  },
  membrane: {
    pitchDecay: (synth, value) => { synth.pitchDecay = value; },
    octaves: (synth, value) => { synth.octaves = value; },
  },
  metal: {
    frequency: (synth, value) => { synth.frequency.value = value; },
    // Tone 15 : harmonicity est un nombre simple (accesseur), pas un Param.
    harmonicity: (synth, value) => { synth.harmonicity = value; },
  },
};

/**
 * Fusionne les paramètres par type d'un preset ou d'une sauvegarde dans le moteur
 *
 * @param {Object} engine - Moteur qui porte fmParams, pluckParams, etc.
 * @param {Object} source - Preset ou configuration (clés fm, pluck, membrane, metal)
 */
export function mergeSynthParameters(engine, source) {
  for (const [type, property] of Object.entries(SYNTH_PARAMETER_PROPERTIES)) {
    if (source[type]) {
      engine[property] = { ...engine[property], ...source[type] };
    }
  }
}

/**
 * Applique un paramètre à un synthé actif ; sans effet si Tone.js n'expose
 * pas de réglage temps réel pour ce couple type/paramètre.
 *
 * @param {Object} synth - Synthé Tone.js
 * @param {string} synthType - Type de synthèse du synthé
 * @param {string} param - Nom du paramètre
 * @param {number} value - Valeur
 */
export function applyLiveSynthParam(synth, synthType, param, value) {
  const setters = Object.hasOwn(LIVE_PARAMETER_SETTERS, synthType) ? LIVE_PARAMETER_SETTERS[synthType] : null;
  if (setters && Object.hasOwn(setters, param)) {
    setters[param](synth, value);
  }
}
