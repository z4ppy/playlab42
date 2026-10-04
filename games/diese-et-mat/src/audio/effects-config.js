/**
 * Configuration des effets d'AudioEngine
 *
 * @module audio/effects-config
 */

/** Ordre de fusion et d'application aux nœuds Tone.js */
const EFFECT_NAMES = ['reverb', 'delay', 'filter'];

/** Écriture de la configuration d'un effet sur son nœud Tone.js */
const NODE_WRITERS = {
  reverb: (node, config) => {
    node.wet.value = config.enabled ? config.amount : 0;
  },
  delay: (node, config) => {
    node.wet.value = config.enabled ? 0.5 : 0;
    node.delayTime.value = config.time;
    node.feedback.value = config.feedback;
  },
  filter: (node, config) => {
    node.frequency.value = config.frequency;
  },
};

/**
 * Remplace par des copies les réglages d'effets présents dans une sauvegarde
 *
 * @param {Object} effectsConfig - Configuration du moteur, modifiée
 * @param {Object} [saved] - Effets sauvegardés (reverb, delay, filter)
 */
export function copyEffectsConfig(effectsConfig, saved) {
  for (const name of EFFECT_NAMES) {
    if (saved?.[name]) {
      effectsConfig[name] = { ...saved[name] };
    }
  }
}

/**
 * Applique la configuration aux effets Tone.js déjà créés
 *
 * @param {Object} nodes - Effets Tone.js (reverb, delay, filter), éventuellement null
 * @param {Object} effectsConfig - Configuration à appliquer
 */
export function applyEffectsConfigToNodes(nodes, effectsConfig) {
  for (const name of EFFECT_NAMES) {
    if (nodes[name]) {
      NODE_WRITERS[name](nodes[name], effectsConfig[name]);
    }
  }
}
