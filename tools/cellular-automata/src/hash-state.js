/**
 * Sérialisation de l'état partageable dans le fragment d'URL (permalien).
 *
 * Format lisible « clé=valeur » séparé par « & », par exemple :
 *   #m=2d&e=30&w=129&r=B3/S23&n=128&v=7&t=1&c=bo$2bo$3o!
 * Chaque champ est validé au décodage : une valeur invalide est remplacée par
 * la valeur par défaut et signalée dans `warnings`, sans jamais lever d'erreur.
 * Module pur, sans DOM.
 */

import { isValidElementaryRule, parseLifeRule, formatLifeRule } from './rules.js';
import { parseRle } from './patterns.js';

/** Tailles de grille 2D proposées (grille carrée). */
export const GRID_SIZES = Object.freeze([48, 64, 96, 128, 192, 256]);

/** Largeurs proposées en 1D (impaires pour centrer la cellule de départ). */
export const ROW_WIDTHS = Object.freeze([65, 129, 193, 257, 401]);

/** Vitesses en générations par seconde, choisies par un curseur à crans. */
export const SPEEDS = Object.freeze([1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 120, 240]);

/** Au-delà, la grille n'est pas mise dans l'URL (lien trop long à partager). */
export const MAX_CELLS_LENGTH = 6000;

/**
 * État partageable de l'outil.
 * @typedef {object} ShareState
 * @property {'1d'|'2d'} mode
 * @property {number} rule - Règle élémentaire (0-255)
 * @property {string} life - Règle 2D en notation canonique B/S
 * @property {number} size - Côté de la grille 2D
 * @property {number} width - Largeur de la ligne 1D
 * @property {number} speed - Indice dans SPEEDS
 * @property {boolean} trace - Couleurs d'âge et traînée actives
 * @property {string|null} cells - Grille 2D en RLE (null = non partagée)
 * @property {string|null} row - Ligne de départ 1D en RLE (null = cellule centrale)
 */

/** @type {Readonly<ShareState>} */
export const DEFAULT_STATE = Object.freeze({
  mode: '2d',
  rule: 30,
  life: 'B3/S23',
  size: 128,
  width: 129,
  speed: 7,
  trace: true,
  cells: null,
  row: null,
});

/**
 * Encode une valeur en gardant lisibles les caractères RLE et B/S.
 * @param {string} value
 * @returns {string}
 */
function encodeValue(value) {
  return encodeURIComponent(value).replace(/%2F/gi, '/').replace(/%24/g, '$');
}

/**
 * Sérialise l'état (sans le « # » initial).
 * Les cellules trop nombreuses sont omises : voir `MAX_CELLS_LENGTH`.
 * @param {ShareState} state
 * @returns {string}
 */
export function encodeState(state) {
  // Les réglages des deux modes sont toujours inclus : changer de mode après
  // l'ouverture d'un permalien retrouve les réglages partagés.
  const pairs = [
    ['m', state.mode],
    ['e', String(state.rule)],
    ['w', String(state.width)],
    ['r', state.life],
    ['n', String(state.size)],
    ['v', String(state.speed)],
    ['t', state.trace ? '1' : '0'],
  ];
  if (state.row) {
    pairs.push(['i', state.row]);
  }
  if (state.cells && state.cells.length <= MAX_CELLS_LENGTH) {
    pairs.push(['c', state.cells]);
  }
  return pairs.map(([key, value]) => `${key}=${encodeValue(value)}`).join('&');
}

/**
 * Valeur sentinelle d'un champ dont l'encodage « % » est invalide : aucun
 * validateur ne l'accepte, le champ est donc signalé comme invalide.
 */
const UNDECODABLE = '\u0000';

/**
 * Découpe le fragment en paires clé/valeur décodées.
 * @param {string} hash - Avec ou sans « # »
 * @returns {Map<string, string>}
 */
function readPairs(hash) {
  /** @type {Map<string, string>} */
  const pairs = new Map();
  for (const part of String(hash ?? '').replace(/^#/, '').split('&')) {
    const separator = part.indexOf('=');
    if (separator > 0) {
      try {
        pairs.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)));
      } catch {
        // Séquence « % » invalide : le champ garde une valeur refusée par
        // tous les validateurs, pour être signalé dans `warnings`.
        pairs.set(part.slice(0, separator), UNDECODABLE);
      }
    }
  }
  return pairs;
}

/**
 * Lit un entier appartenant à une liste ou un intervalle.
 * @param {string|undefined} raw
 * @param {(value: number) => boolean} isValid
 * @returns {number|null} null si absent ou invalide
 */
function readInteger(raw, isValid) {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return isValid(value) ? value : null;
}

/**
 * Lit un motif RLE en vérifiant qu'il tient dans le cadre donné.
 * @param {string|undefined} raw
 * @param {number} width
 * @param {number} height
 * @returns {string|null}
 */
function readRle(raw, width, height) {
  if (raw === undefined) {
    return null;
  }
  try {
    // Bornes passées au parseur : un compteur démesuré est refusé sans allocation.
    const pattern = parseRle(raw, { maxWidth: width, maxHeight: height });
    return pattern.width <= width && pattern.height <= height ? raw : null;
  } catch {
    return null;
  }
}

/** Champs numériques : clé d'URL, propriété et validateur. */
const NUMERIC_FIELDS = Object.freeze([
  { key: 'e', field: 'rule', label: 'règle 1D', isValid: isValidElementaryRule },
  { key: 'n', field: 'size', label: 'taille', isValid: (/** @type {number} */ v) => GRID_SIZES.includes(v) },
  { key: 'w', field: 'width', label: 'largeur', isValid: (/** @type {number} */ v) => ROW_WIDTHS.includes(v) },
  { key: 'v', field: 'speed', label: 'vitesse', isValid: (/** @type {number} */ v) => v < SPEEDS.length },
]);

/**
 * Décode un fragment d'URL en état complet.
 * @param {string} hash
 * @returns {{ state: ShareState, warnings: string[] }}
 */
export function decodeState(hash) {
  const pairs = readPairs(hash);
  /** @type {ShareState} */
  const state = { ...DEFAULT_STATE };
  const warnings = [];
  const mode = pairs.get('m');
  if (mode === '1d' || mode === '2d') {
    state.mode = mode;
  } else if (pairs.has('m')) {
    warnings.push('mode invalide');
  }
  for (const { key, field, label, isValid } of NUMERIC_FIELDS) {
    const value = readInteger(pairs.get(key), isValid);
    if (value !== null) {
      Object.assign(state, { [field]: value });
    } else if (pairs.has(key)) {
      warnings.push(`${label} invalide`);
    }
  }
  const trace = pairs.get('t');
  state.trace = trace !== '0';
  if (trace === UNDECODABLE) {
    warnings.push('traînée invalide');
  }
  decodeLife(pairs, state, warnings);
  decodeCells(pairs, state, warnings);
  return { state, warnings };
}

/**
 * Décode la règle 2D.
 * @param {Map<string, string>} pairs
 * @param {ShareState} state - Modifié en place
 * @param {string[]} warnings
 */
function decodeLife(pairs, state, warnings) {
  if (!pairs.has('r')) {
    return;
  }
  const parsed = parseLifeRule(/** @type {string} */ (pairs.get('r')));
  if (parsed.rule) {
    state.life = formatLifeRule(parsed.rule);
  } else {
    warnings.push('règle 2D invalide');
  }
}

/**
 * Décode la grille 2D et la ligne 1D, bornées par la taille choisie.
 * @param {Map<string, string>} pairs
 * @param {ShareState} state - Modifié en place
 * @param {string[]} warnings
 */
function decodeCells(pairs, state, warnings) {
  state.cells = readRle(pairs.get('c'), state.size, state.size);
  if (pairs.has('c') && state.cells === null) {
    warnings.push('grille invalide');
  }
  state.row = readRle(pairs.get('i'), state.width, 1);
  if (pairs.has('i') && state.row === null) {
    warnings.push('ligne de départ invalide');
  }
}
