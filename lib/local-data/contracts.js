/** Registre et erreurs partagés uniquement par les modules de données locales. */
export const LOCAL_DATA_VERSION = 1;
export const LOCAL_DATA_SCHEMA_KEY = 'playlab42.local-data.schema';
export const BACKUP_FORMAT = 'playlab42-local-data';
export const MAX_BACKUP_LENGTH = 5 * 1024 * 1024;

const FIXED_KEYS = new Set([
  'player', 'preferences', 'recent_games', 'playlab42.activeTab',
  'playlab42.theme', 'parcours-progress',
]);

/** Erreur explicite, éventuellement accompagnée d'un échec du retour arrière. */
export class LocalDataError extends Error {
  /**
   * @param {string} code - Catégorie d'erreur.
   * @param {string} message - Message affichable.
   * @param {unknown} [cause] - Erreur initiale.
   */
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'LocalDataError';
    this.code = code;
    this.rollbackFailed = false;
  }
}

export function invalid(message) {
  throw new LocalDataError('invalid-data', message);
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function isExcludedId(id) {
  return /neural[-_]?style|relativity/i.test(id);
}

/**
 * Reconnaît les clés historiques, sans les états des outils exclus.
 * @param {string} key - Clé de stockage.
 * @returns {boolean}
 */
export function isManagedKey(key) {
  if (FIXED_KEYS.has(key)) { return true; }
  if (typeof key !== 'string') { return false; }
  const match = /^(?:scores|progress)_([a-z][a-z0-9_-]{0,63})$/.exec(key);
  return Boolean(match && !isExcludedId(match[1]));
}

export function storageError(cause) {
  return cause instanceof LocalDataError ? cause
    : new LocalDataError('storage', 'Stockage inaccessible ou quota dépassé.', cause);
}
