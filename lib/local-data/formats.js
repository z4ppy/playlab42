/** Formats historiques par namespace ; aucune normalisation des objets fournis. */
import { invalid, isManagedKey, isObject } from './contracts.js';
import { assertJson, canonical, parse } from './json.js';

const RAW_KEYS = new Set(['playlab42.activeTab', 'playlab42.theme']);

function isRecent(item) {
  return isObject(item) && typeof item.id === 'string' && ['game', 'tool'].includes(item.type)
    && Number.isFinite(item.timestamp) && item.timestamp >= 0;
}

function isParcoursProgress(item) {
  return isObject(item) && Array.isArray(item.visited)
    && item.visited.every(id => typeof id === 'string')
    && (!Object.hasOwn(item, 'current') || item.current === null || typeof item.current === 'string');
}

function isScore(item) {
  return isObject(item) && Number.isFinite(item.score) && Number.isFinite(item.date)
    && item.date >= 0 && typeof item.player === 'string';
}

const VALIDATORS = new Map([
  ['player', value => isObject(value) && typeof value.name === 'string'],
  ['preferences', value => isObject(value) && (value.sound === undefined || typeof value.sound === 'boolean')],
  ['recent_games', value => Array.isArray(value) && value.every(isRecent)],
  ['playlab42.activeTab', value => ['tools', 'games', 'parcours', 'bookmarks'].includes(value)],
  ['playlab42.theme', value => ['light', 'dark', 'system'].includes(value)],
  ['parcours-progress', value => isObject(value) && Object.values(value).every(isParcoursProgress)],
]);

function matchesFormat(key, value) {
  const validator = VALIDATORS.get(key);
  if (validator) { return validator(value); }
  if (key.startsWith('scores_')) { return Array.isArray(value) && value.every(isScore); }
  // La progression conserve son format JSON propre au jeu.
  return key.startsWith('progress_');
}

/**
 * Valide une valeur typée sans mutation ; progress_* reste du JSON opaque.
 * @param {string} key - Clé gérée.
 * @param {unknown} value - Valeur typée.
 * @returns {void}
 */
export function validateLocalValue(key, value) {
  if (!isManagedKey(key)) { invalid(`Clé non gérée : « ${key} ».`); }
  assertJson(value);
  if (!matchesFormat(key, value)) {
    invalid(`Type de données invalide pour « ${key} » ; original conservé.`);
  }
}

export function decode(key, raw) {
  const value = RAW_KEYS.has(key) ? raw : parse(raw, key);
  validateLocalValue(key, value);
  return value;
}

export function encode(key, value) {
  validateLocalValue(key, value);
  if (key === 'playlab42.theme' && value === 'system') { return null; }
  return RAW_KEYS.has(key) ? value : canonical(value);
}
