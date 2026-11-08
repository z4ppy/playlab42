/**
 * État de l'outil ⇄ fragment d'URL (#…), pour partager un L-système par lien.
 *
 * Format : paramètres URLSearchParams lisibles, ex.
 *   #v=1&p=dragon&ax=FX&rp=X&rs=X%2BYF%2B&rw=1&rp=Y&rs=-FX-Y&rw=1&a=90&n=12
 * Les règles sont des triplets répétés rp / rs / rw (prédécesseur, successeur,
 * poids) : l'ordre est conservé et aucun séparateur maison n'est à échapper.
 * Toute valeur lue est bornée : un lien forgé ne peut ni planter l'outil ni
 * demander un calcul démesuré (la limite de symboles s'applique ensuite).
 */

import { DEFAULT_PRESET_ID, findPreset } from './presets.js';
import { MAX_ITERATIONS } from './lsystem.js';

/** Version du format, pour pouvoir le faire évoluer. */
export const HASH_VERSION = '1';

/** Bornes des champs texte. */
export const MAX_TEXT_LENGTH = 400;
export const MAX_RULES = 16;

/** Modes de coloration reconnus. */
export const COLOR_MODES = ['auto', 'depth', 'gradient', 'solid'];

/**
 * @typedef {object} ToolState
 * @property {string} preset - Identifiant de préréglage ou « custom »
 * @property {string} axiom - Axiome
 * @property {{ predecessor: string, successor: string, probability: string }[]} rules - Règles
 * @property {number} angle - Angle δ (degrés)
 * @property {number} iterations - Itérations
 * @property {number} step - Longueur du pas
 * @property {number} heading - Orientation initiale (degrés)
 * @property {number} seed - Graine du hasard
 * @property {'auto'|'depth'|'gradient'|'solid'} colorMode - Coloration
 * @property {number} lineWidth - Épaisseur de base (px)
 * @property {number} widthDecay - Amincissement par niveau de pile
 */

/**
 * Bornes numériques : [min, max, défaut].
 * @type {Record<string, [number, number, number]>}
 */
export const NUMBER_FIELDS = {
  angle: [-360, 360, 90],
  iterations: [0, MAX_ITERATIONS, 4],
  step: [0.01, 1000, 10],
  heading: [-360, 360, 0],
  seed: [0, 999999, 1],
  lineWidth: [0.25, 24, 1.5],
  widthDecay: [0.3, 1, 0.8],
};

/** Clés courtes utilisées dans l'URL. */
const KEYS = {
  angle: 'a',
  iterations: 'n',
  step: 's',
  heading: 'h',
  seed: 'g',
  lineWidth: 'lw',
  widthDecay: 'wd',
};

/**
 * Borne un nombre ; renvoie le défaut s'il n'est pas fini.
 * @param {unknown} value - Valeur
 * @param {string} field - Champ de NUMBER_FIELDS
 * @param {number} [fallback] - Valeur si la saisie n'est pas un nombre
 * @returns {number}
 */
export function clampField(value, field, fallback = NUMBER_FIELDS[field][2]) {
  const [min, max] = NUMBER_FIELDS[field];
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) {
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, number));
  return field === 'iterations' || field === 'seed' ? Math.round(clamped) : clamped;
}

/**
 * Construit l'état complet d'un préréglage.
 * @param {string} id - Identifiant
 * @returns {ToolState}
 */
export function stateFromPreset(id) {
  const preset = findPreset(id) ?? findPreset(DEFAULT_PRESET_ID);
  return {
    preset: preset.id,
    axiom: preset.axiom,
    rules: preset.rules.map((rule) => ({
      predecessor: rule.predecessor,
      successor: rule.successor,
      probability: rule.probability === undefined ? '' : String(rule.probability),
    })),
    angle: preset.angle,
    iterations: preset.iterations,
    step: preset.step ?? NUMBER_FIELDS.step[2],
    heading: preset.heading,
    seed: NUMBER_FIELDS.seed[2],
    colorMode: preset.colorMode ?? 'auto',
    lineWidth: preset.lineWidth ?? NUMBER_FIELDS.lineWidth[2],
    widthDecay: preset.widthDecay ?? NUMBER_FIELDS.widthDecay[2],
  };
}

/**
 * Tronque une chaîne lue dans l'URL.
 * @param {string|null} text - Texte
 * @returns {string}
 */
function cleanText(text) {
  return String(text ?? '').slice(0, MAX_TEXT_LENGTH);
}

/**
 * Sérialise l'état dans un fragment (sans « # »).
 * @param {ToolState} state - État
 * @returns {string}
 */
export function stateToHash(state) {
  const params = new URLSearchParams();
  params.set('v', HASH_VERSION);
  params.set('p', state.preset);
  params.set('ax', state.axiom);
  for (const rule of state.rules) {
    params.append('rp', rule.predecessor);
    params.append('rs', rule.successor);
    params.append('rw', String(rule.probability ?? ''));
  }
  for (const [field, key] of Object.entries(KEYS)) {
    params.set(key, String(state[field]));
  }
  params.set('c', state.colorMode);
  return params.toString();
}

/**
 * Lit les règles d'un fragment.
 * @param {URLSearchParams} params - Paramètres
 * @returns {ToolState['rules']}
 */
function readRules(params) {
  const predecessors = params.getAll('rp');
  const successors = params.getAll('rs');
  const weights = params.getAll('rw');
  return predecessors.slice(0, MAX_RULES).map((predecessor, i) => ({
    predecessor: cleanText(predecessor),
    successor: cleanText(successors[i]),
    probability: cleanText(weights[i]),
  }));
}

/**
 * Lit les champs numériques, bornés ; absents ou invalides ⇒ valeur de base.
 * @param {URLSearchParams} params - Paramètres
 * @param {ToolState} base - État de référence
 * @returns {Partial<ToolState>}
 */
function readNumbers(params, base) {
  const numbers = {};
  for (const [field, key] of Object.entries(KEYS)) {
    numbers[field] = params.has(key) ? clampField(params.get(key), field, base[field]) : base[field];
  }
  return numbers;
}

/**
 * Désérialise un fragment d'URL. Les champs absents reprennent la valeur du
 * préréglage nommé (ou du préréglage par défaut).
 * @param {string} hash - Fragment, avec ou sans « # »
 * @returns {ToolState|null} État, ou null si le fragment n'en contient pas
 */
export function hashToState(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  if (!params.has('ax') && !params.has('p')) {
    return null;
  }
  const known = findPreset(params.get('p') ?? '');
  const base = stateFromPreset(known ? known.id : DEFAULT_PRESET_ID);
  const colorMode = params.get('c');
  return {
    ...base,
    ...readNumbers(params, base),
    preset: known ? known.id : 'custom',
    axiom: params.has('ax') ? cleanText(params.get('ax')) : base.axiom,
    rules: params.has('rp') ? readRules(params) : base.rules,
    colorMode: COLOR_MODES.includes(colorMode) ? colorMode : base.colorMode,
  };
}
