/** Validation de l'arbre JSON, distincte des formats métier. */
import { invalid, isObject, LocalDataError, MAX_BACKUP_LENGTH } from './contracts.js';

function isJsonPrimitive(value) {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function assertArray(value) {
  if (Object.keys(value).length !== value.length) {
    invalid('Tableau JSON incomplet ou propriétés supplémentaires.');
  }
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) { invalid('Tableau JSON incomplet.'); }
  }
}

function assertContainer(value, seen) {
  if (!Array.isArray(value) && !isObject(value)) { invalid('Valeur non sérialisable en JSON.'); }
  if (seen.has(value)) { invalid('Référence circulaire dans les données.'); }
  if (Object.getOwnPropertySymbols(value).length) { invalid('Propriété Symbol non sérialisable en JSON.'); }
  if (Array.isArray(value)) { assertArray(value); }
}

export function assertJson(value, depth = 0, seen = new Set()) {
  if (depth > 100) { invalid('Données trop profondément imbriquées.'); }
  if (isJsonPrimitive(value)) { return; }
  assertContainer(value, seen);
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (key === '__proto__') { invalid('Propriété JSON interdite.'); }
    assertJson(value[key], depth + 1, seen);
  }
  seen.delete(value);
}

export function canonical(value) {
  if (Array.isArray(value)) { return `[${value.map(canonical).join(',')}]`; }
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function isOversized(text) {
  if (text.length > MAX_BACKUP_LENGTH) { return true; }
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0);
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > MAX_BACKUP_LENGTH) { return true; }
  }
  return false;
}

export function parse(raw, key) {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LocalDataError('invalid-data', `JSON invalide pour « ${key} » ; original conservé.`, cause);
  }
}
