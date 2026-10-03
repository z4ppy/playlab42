/** Prévalidation pure de l'enveloppe et migration des entrées de sauvegarde. */
import {
  BACKUP_FORMAT, LOCAL_DATA_VERSION, LocalDataError, invalid, isObject, isManagedKey, isExcludedId,
} from './contracts.js';
import { isOversized, parse } from './json.js';
import { decode, encode } from './formats.js';

function entryField(backup) {
  if (!isObject(backup) || backup.format !== BACKUP_FORMAT || !Number.isInteger(backup.version)
    || backup.version < 0) { invalid('Format de sauvegarde non reconnu.'); }
  if (backup.version > LOCAL_DATA_VERSION) {
    throw new LocalDataError('future-version', 'Version de sauvegarde plus récente, non prise en charge.');
  }
  const field = backup.version === 0 ? 'data' : 'entries';
  if (Object.keys(backup).length !== 3 || !isObject(backup[field])) {
    invalid('Enveloppe de sauvegarde invalide.');
  }
  return field;
}

function validateRawEntry(key, raw) {
  if (raw === null && key === 'playlab42.theme') { return null; }
  if (typeof raw !== 'string') { invalid(`Chaîne brute attendue pour « ${key} ».`); }
  const value = decode(key, raw);
  if (key === 'recent_games' && value.some(item => isExcludedId(item.id))) {
    invalid('La sauvegarde contient un outil exclu dans les récents.');
  }
  return key === 'playlab42.theme' && raw === 'system' ? null : raw;
}

function validateEntry(key, saved, version) {
  if (!isManagedKey(key)) { invalid(`Clé non gérée dans la sauvegarde : « ${key} ».`); }
  if (saved === null && key === 'playlab42.theme') { return null; }
  const raw = version === 0 ? encode(key, saved) : saved;
  return validateRawEntry(key, raw);
}

/**
 * Prévalide et migre sans stockage. Version 0 : {format, version:0, data:{clé:valeurTypée}}.
 * @param {string} json - JSON saisi explicitement.
 * @returns {Record<string, string|null>} Entrées historiques validées.
 */
export function validateBackup(json) {
  if (typeof json !== 'string' || isOversized(json)) {
    invalid('Sauvegarde absente ou trop volumineuse (maximum 5 Mio).');
  }
  const backup = parse(json, 'sauvegarde');
  const field = entryField(backup);
  const entries = Object.create(null);
  for (const [key, saved] of Object.entries(backup[field])) {
    entries[key] = validateEntry(key, saved, backup.version);
  }
  return entries;
}
