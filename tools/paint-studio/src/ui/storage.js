/**
 * Persistance locale en IndexedDB : sauvegarde automatique du projet et
 * préférences (réglages des outils, couleurs).
 *
 * IndexedDB peut être absent ou refusé (navigation privée, quota, iframe
 * isolée) : chaque opération échoue silencieusement en renvoyant null/false,
 * et l'outil reste pleinement utilisable sans sauvegarde automatique.
 */

const DB_NAME = 'playlab42-paint-studio';
const STORE = 'kv';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase|null>|null} */
let opening = null;

/** Promesse d'une requête IndexedDB. */
function settle(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Ouvre (une seule fois) la base ; null si IndexedDB est indisponible. */
function openDb() {
  if (!opening) {
    opening = (async () => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        return await settle(request);
      } catch (error) {
        console.warn('Paint Studio : IndexedDB indisponible, pas de sauvegarde automatique.', error);
        return null;
      }
    })();
  }
  return opening;
}

/**
 * Lit une valeur.
 * @param {string} key
 * @returns {Promise<unknown>} null si absente ou en cas d'erreur
 */
export async function loadValue(key) {
  try {
    const db = await openDb();
    if (!db) {
      return null;
    }
    const value = await settle(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
    return value ?? null;
  } catch (error) {
    console.warn(`Paint Studio : lecture de « ${key} » impossible.`, error);
    return null;
  }
}

/**
 * Écrit une valeur (clonable structurellement).
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<boolean>} Vrai si l'écriture a réussi
 */
export async function saveValue(key, value) {
  try {
    const db = await openDb();
    if (!db) {
      return false;
    }
    await settle(db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key));
    return true;
  } catch (error) {
    console.warn(`Paint Studio : écriture de « ${key} » impossible (quota ?).`, error);
    return false;
  }
}
