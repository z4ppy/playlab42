/**
 * Brouillon sauvegardé localement (localStorage).
 *
 * Toutes les opérations sont protégées : un stockage indisponible (navigation
 * privée, bac à sable, cookies bloqués) ou plein n'interrompt jamais
 * l'édition ; l'appelant reçoit un résultat explicite à afficher.
 *
 * @module storage
 */

/** Clé de stockage du brouillon. */
export const DRAFT_KEY = 'playlab42.markdown-editor.draft';
const FORMAT_VERSION = 1;

/**
 * @typedef {object} Draft
 * @property {string} text
 * @property {number} savedAt - Horodatage (ms depuis l'époque Unix).
 */

/** @typedef {{ ok: true } | { ok: false, reason: 'quota'|'unavailable' }} SaveResult */

/**
 * Reconnaît une erreur de quota selon les navigateurs.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isQuotaError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { name, code } = /** @type {{ name?: string, code?: number }} */ (error);
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/**
 * Valide un brouillon relu.
 * @param {unknown} value
 * @returns {Draft|null}
 */
function validDraft(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { v, text, savedAt } = /** @type {Record<string, unknown>} */ (value);
  if (v !== FORMAT_VERSION || typeof text !== 'string' || !Number.isFinite(savedAt)) {
    return null;
  }
  return { text, savedAt: /** @type {number} */ (savedAt) };
}

/**
 * Crée l'accès au brouillon.
 * @param {() => Storage|undefined} [getStorage] - Accès au stockage (injectable pour les tests).
 * @param {string} [key]
 */
export function createDraftStore(getStorage = () => globalThis.localStorage, key = DRAFT_KEY) {
  return {
    /**
     * @returns {Draft|null} Brouillon valide, ou null (absent, illisible, stockage inaccessible).
     */
    load() {
      try {
        const raw = getStorage()?.getItem(key);
        return raw ? validDraft(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },

    /**
     * @param {string} text
     * @param {number} [now]
     * @returns {SaveResult}
     */
    save(text, now = Date.now()) {
      try {
        const storage = getStorage();
        if (!storage) {
          return { ok: false, reason: 'unavailable' };
        }
        storage.setItem(key, JSON.stringify({ v: FORMAT_VERSION, text, savedAt: now }));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' };
      }
    },

    /** @returns {boolean} true si le brouillon a pu être effacé. */
    clear() {
      try {
        getStorage()?.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Clé de la vue préférée (éditeur, aperçu, côte à côte). */
export const VIEW_KEY = 'playlab42.markdown-editor.view';

/**
 * Préférence locale à valeurs énumérées (lecture et écriture protégées).
 * @template {string} T
 * @param {string} key
 * @param {readonly T[]} allowed
 * @param {() => Storage|undefined} [getStorage]
 */
export function createPreference(key, allowed, getStorage = () => globalThis.localStorage) {
  return {
    /** @returns {T|null} */
    get() {
      try {
        const value = getStorage()?.getItem(key);
        return allowed.includes(/** @type {T} */ (value)) ? /** @type {T} */ (value) : null;
      } catch {
        return null;
      }
    },
    /**
     * @param {T} value
     * @returns {boolean}
     */
    set(value) {
      try {
        getStorage()?.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
