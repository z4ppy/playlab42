/**
 * EventEmitter - Gestionnaire d'événements standard
 *
 * Pattern pub/sub léger pour découpler les composants de l'application.
 * Supporte les listeners classiques (on/off) et les listeners à usage unique (once).
 *
 * @module utils/EventEmitter
 *
 * @example
 * const emitter = new EventEmitter();
 *
 * // Écouter un événement
 * emitter.on('score-update', (data) => console.log(data));
 *
 * // Écouter une seule fois
 * emitter.once('game-end', (result) => saveResult(result));
 *
 * // Émettre un événement
 * emitter.emit('score-update', { score: 100 });
 *
 * // Retirer un listener
 * emitter.off('score-update', myCallback);
 */

/**
 * Gestionnaire d'événements
 */
export class EventEmitter {
  /**
   * Crée un nouveau gestionnaire d'événements
   */
  constructor() {
    /**
     * Map des listeners par événement
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._listeners = new Map();

    /**
     * Set des listeners à usage unique
     * @type {Set<Function>}
     * @private
     */
    this._onceListeners = new Set();
  }

  /**
   * Ajoute un listener pour un événement
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction à appeler
   * @returns {EventEmitter} this (pour chaînage)
   *
   * @example
   * emitter.on('note-played', ({ pitch }) => highlightKey(pitch));
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Le callback doit être une fonction');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(callback);
    return this;
  }

  /**
   * Ajoute un listener qui sera appelé une seule fois
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction à appeler
   * @returns {EventEmitter} this (pour chaînage)
   *
   * @example
   * emitter.once('audio-ready', () => enablePlayButton());
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Le callback doit être une fonction');
    }

    this._onceListeners.add(callback);
    return this.on(event, callback);
  }

  /**
   * Retire un listener
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction à retirer
   * @returns {EventEmitter} this (pour chaînage)
   *
   * @example
   * emitter.off('note-played', myHandler);
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      this._onceListeners.delete(callback);

      // Nettoyer si plus de listeners
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
    return this;
  }

  /**
   * Émet un événement
   *
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à passer aux listeners
   * @returns {boolean} true si au moins un listener a été appelé
   *
   * @example
   * emitter.emit('question-answered', { correct: true, score: 10 });
   */
  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }

    // Copier pour éviter les problèmes si un listener se retire
    const listenersArray = [...listeners];

    for (const callback of listenersArray) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erreur dans le listener de "${event}":`, error);
      }

      // Retirer les listeners "once" après exécution
      if (this._onceListeners.has(callback)) {
        this.off(event, callback);
      }
    }

    return true;
  }

  /**
   * Retire tous les listeners d'un événement ou de tous les événements
   *
   * @param {string} [event] - Nom de l'événement (optionnel)
   * @returns {EventEmitter} this (pour chaînage)
   *
   * @example
   * emitter.removeAllListeners('score-update'); // Un événement
   * emitter.removeAllListeners(); // Tous les événements
   */
  removeAllListeners(event) {
    if (event) {
      const listeners = this._listeners.get(event);
      if (listeners) {
        for (const callback of listeners) {
          this._onceListeners.delete(callback);
        }
        this._listeners.delete(event);
      }
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
    }
    return this;
  }

  /**
   * Retourne le nombre de listeners pour un événement
   *
   * @param {string} event - Nom de l'événement
   * @returns {number} Nombre de listeners
   */
  listenerCount(event) {
    const listeners = this._listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * Retourne les noms des événements avec des listeners
   *
   * @returns {string[]} Noms des événements
   */
  eventNames() {
    return [...this._listeners.keys()];
  }

  /**
   * Nettoie toutes les ressources
   */
  dispose() {
    this.removeAllListeners();
  }
}

export default EventEmitter;
