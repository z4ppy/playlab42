/** Schéma et orchestration des écritures, sans promesse de transaction inter-onglets. */
import {
  LOCAL_DATA_SCHEMA_KEY, LOCAL_DATA_VERSION, LocalDataError, invalid, isObject, storageError,
} from './contracts.js';
import { parse } from './json.js';

export function checkSchema(storage) {
  const raw = storage.getItem(LOCAL_DATA_SCHEMA_KEY);
  if (raw === null) { return; }
  const schema = parse(raw, LOCAL_DATA_SCHEMA_KEY);
  if (!isObject(schema) || Object.keys(schema).length !== 1
    || !Number.isInteger(schema.version) || schema.version < 0) {
    invalid('Métadonnées de schéma invalides ; original conservé.');
  }
  if (schema.version > LOCAL_DATA_VERSION) {
    throw new LocalDataError('future-version', 'Schéma local plus récent, non pris en charge.');
  }
}

function persist(storage, key, raw) {
  if (raw === null) { storage.removeItem(key); }
  else { storage.setItem(key, raw); }
}

function applyWrites(storage, writes, before, written) {
  for (const [key, raw] of writes) {
    if (before.get(key) === raw) { continue; }
    persist(storage, key, raw);
    // Seules les opérations retournées sans erreur appartiennent au retour arrière.
    written.push([key, raw]);
  }
}

function restoreEntry(storage, key, raw, previous) {
  // Ne pas écraser une modification concurrente d'un autre onglet.
  if (storage.getItem(key) !== raw) { return false; }
  persist(storage, key, previous);
  return true;
}

function rollback(storage, before, written, error) {
  for (const [key, raw] of written.reverse()) {
    try {
      if (!restoreEntry(storage, key, raw, before.get(key))) { error.rollbackFailed = true; }
    } catch {
      // L'échec reste visible, et les autres écritures sont encore restaurées.
      error.rollbackFailed = true;
    }
  }
  if (error.rollbackFailed) { error.message += ' Retour arrière incomplet : vérifiez vos données.'; }
}

/**
 * Capture toutes les valeurs avant écriture ; restaure les seuls changements réussis.
 * Une opération qui modifie le stockage puis lève ne peut pas être suivie ici.
 */
export function writeEntries(entries, storage, schemaRaw = '{"version":1}') {
  const before = new Map();
  const written = [];
  try {
    storage ??= globalThis.localStorage;
    checkSchema(storage);
    const writes = [...Object.entries(entries), [LOCAL_DATA_SCHEMA_KEY, schemaRaw]];
    for (const [key] of writes) { before.set(key, storage.getItem(key)); }
    applyWrites(storage, writes, before, written);
  } catch (cause) {
    const error = storageError(cause);
    rollback(storage, before, written, error);
    throw error;
  }
}
