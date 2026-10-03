/**
 * Données locales validées, compatibles avec les lecteurs historiques.
 * Aucun accès réseau ; les erreurs sont toujours remontées à l'appelant.
 * @module local-data
 */
import {
  LOCAL_DATA_VERSION, BACKUP_FORMAT, invalid, isObject, isManagedKey, isExcludedId, storageError,
} from './local-data/contracts.js';
import { canonical, isOversized } from './local-data/json.js';
import { decode, encode } from './local-data/formats.js';
import { validateBackup } from './local-data/backup.js';
import { checkSchema, writeEntries } from './local-data/persistence.js';

export {
  LOCAL_DATA_VERSION, LOCAL_DATA_SCHEMA_KEY, BACKUP_FORMAT, MAX_BACKUP_LENGTH, LocalDataError, isManagedKey,
} from './local-data/contracts.js';
export { validateLocalValue } from './local-data/formats.js';
export { validateBackup } from './local-data/backup.js';

/**
 * Lit et valide une clé ; fallback est utilisé uniquement si la clé est absente.
 * @template T
 * @param {string} key - Clé historique gérée.
 * @param {T} fallback - Valeur si absente.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {T|unknown} Valeur typée, sans écriture lors de la lecture.
 * @throws {LocalDataError} Corruption, schéma futur ou stockage indisponible.
 */
export function readLocalData(key, fallback, storage) {
  try {
    storage ??= globalThis.localStorage;
    if (!isManagedKey(key)) { invalid(`Clé non gérée : « ${key} ».`); }
    checkSchema(storage);
    const raw = storage.getItem(key);
    return raw === null ? fallback : decode(key, raw);
  } catch (cause) {
    throw storageError(cause);
  }
}

/**
 * Écrit plusieurs valeurs validées, avec retour arrière en cas d'échec.
 * @param {Record<string, unknown>} values - Clés et valeurs typées.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {void}
 */
export function writeLocalValues(values, storage) {
  if (!isObject(values)) { invalid('Table de valeurs attendue.'); }
  const entries = Object.create(null);
  for (const [key, value] of Object.entries(values)) { entries[key] = encode(key, value); }
  try {
    storage ??= globalThis.localStorage;
    checkSchema(storage);
    for (const key of Object.keys(entries)) {
      const previous = storage.getItem(key);
      if (previous !== null) { decode(key, previous); }
    }
  } catch (cause) {
    throw storageError(cause);
  }
  writeEntries(entries, storage);
}

/**
 * Écrit une valeur sans envelopper son format historique.
 * @param {string} key - Clé gérée.
 * @param {unknown} value - Valeur JSON, ou chaîne pour thème/onglet.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {void}
 */
export function writeLocalData(key, value, storage) {
  writeLocalValues({ [key]: value }, storage);
}

/**
 * Suppression explicite d'une seule clé gérée, jamais d'un stockage entier.
 * @param {string} key - Clé gérée.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {void}
 */
export function removeLocalData(key, storage) {
  if (!isManagedKey(key)) { invalid(`Clé non gérée : « ${key} ».`); }
  writeEntries({ [key]: null }, storage);
}

function collectManagedValues(storage) {
  checkSchema(storage);
  const values = Object.create(null);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!isManagedKey(key)) { continue; }
    const raw = storage.getItem(key);
    if (raw !== null) { values[key] = { raw, value: decode(key, raw) }; }
  }
  return values;
}

/**
 * Réinitialise explicitement les données gérées après validation intégrale.
 * Conserve clés étrangères, états exclus et leurs éventuelles références récentes.
 * Supprime aussi la métadonnée du schéma connu, avec le même retour arrière.
 * Aucun événement applicatif : le navigateur émet les événements storage natifs.
 * @param {Storage} [storage] - Stockage injectable (length/key/getItem/setItem/removeItem).
 * @returns {{count: number}} Clés supprimées ou réécrites, hors métadonnée.
 * @throws {LocalDataError} Corruption, schéma futur ou échec du stockage.
 */
export function clearLocalData(storage) {
  try {
    storage ??= globalThis.localStorage;
    const values = collectManagedValues(storage);
    const entries = Object.create(null);
    for (const [key, { value }] of Object.entries(values)) {
      if (key === 'recent_games') {
        const excluded = value.filter(item => isExcludedId(item.id));
        if (excluded.length === value.length && excluded.length > 0) { continue; }
        entries[key] = excluded.length ? canonical(excluded) : null;
      } else {
        entries[key] = null;
      }
    }
    writeEntries(entries, storage, null);
    return { count: Object.keys(entries).length };
  } catch (cause) {
    throw storageError(cause);
  }
}

/**
 * Exporte une sauvegarde canonique sans métadonnées volatiles ni clés étrangères.
 * Les données corrompues empêchent l'export au lieu d'être ignorées.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {string} JSON de sauvegarde version 1.
 */
export function exportLocalData(storage) {
  try {
    storage ??= globalThis.localStorage;
    const entries = Object.create(null);
    for (const [key, { raw, value }] of Object.entries(collectManagedValues(storage))) {
      entries[key] = key === 'recent_games'
        ? canonical(value.filter(item => !isExcludedId(item.id)))
        : key === 'playlab42.theme' && value === 'system' ? null : raw;
    }
    if (!Object.hasOwn(entries, 'playlab42.theme')) { entries['playlab42.theme'] = null; }
    const json = canonical({ format: BACKUP_FORMAT, version: LOCAL_DATA_VERSION, entries });
    if (isOversized(json)) { invalid('Sauvegarde trop volumineuse (maximum 5 Mio).'); }
    return json;
  } catch (cause) {
    throw storageError(cause);
  }
}

/**
 * Restaure uniquement les clés présentes après validation intégrale.
 * Les clés absentes et toutes les données étrangères restent inchangées.
 * @param {string} json - Sauvegarde choisie par l'utilisateur.
 * @param {Storage} [storage] - Stockage injectable.
 * @returns {{count: number}} Nombre de clés restaurées (hors métadonnée).
 * @throws {LocalDataError} Échec explicite, avec rollbackFailed si nécessaire.
 */
export function importLocalData(json, storage) {
  const entries = validateBackup(json);
  writeEntries(entries, storage);
  return { count: Object.keys(entries).length };
}
