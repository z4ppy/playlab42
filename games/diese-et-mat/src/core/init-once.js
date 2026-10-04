/**
 * Initialisation asynchrone unique d'un objet à cycle de vie.
 *
 * Partagé par les objets qui exposent `ready`, `_disposed` et `_initPromise`
 * (moteur audio, renderer de partition) : mêmes règles de rejet, de partage
 * de la promesse en cours et de libération après succès comme après échec.
 *
 * @module core/init-once
 */

/**
 * @param {{ready: boolean, _disposed: boolean, _initPromise: Promise<void>|null}} owner
 * @param {string} disposedMessage - Message du rejet si l'objet est détruit
 * @param {() => Promise<void>} initialize - Initialisation réelle
 * @returns {Promise<void>}
 */
export function initOnce(owner, disposedMessage, initialize) {
  if (owner._disposed) {
    return Promise.reject(new Error(disposedMessage));
  }
  if (owner.ready) {
    return Promise.resolve();
  }
  if (!owner._initPromise) {
    owner._initPromise = initialize().finally(() => {
      owner._initPromise = null;
    });
  }
  return owner._initPromise;
}
