/**
 * GameKit - SDK pour les jeux Playlab42
 * Fournit la communication avec le portail, la gestion des scores et la persistence
 *
 * @see openspec/specs/gamekit/spec.md
 */

import { AssetLoader } from './assets.js';
import { readLocalData, writeLocalData, removeLocalData } from './local-data.js';

/** @typedef {import('./types/gamekit.js').PortalToGameMessage} PortalToGameMessage */
/** @typedef {import('./types/gamekit.js').GameToPortalMessage} GameToPortalMessage */

/**
 * Nombre maximum de high scores à conserver par jeu.
 * Limité à 10 pour éviter de surcharger le localStorage.
 * @const {number}
 */
const MAX_HIGH_SCORES = 10;


/**
 * Appelle un hook global du jeu s'il est défini.
 * @param {string} name - Nom du hook sur window.
 * @param {...unknown} args - Arguments transmis.
 */
function callHook(name, ...args) {
  if (typeof window[name] === 'function') { window[name](...args); }
}

/**
 * SDK principal pour les jeux Playlab42
 */
export const GameKit = {
  /** Nom du jeu (défini lors de l'init) */
  gameName: null,

  /** Instance de l'AssetLoader */
  assets: null,

  /** État interne */
  _soundEnabled: true,
  _paused: false,
  _initialized: false,
  _cleanupListeners: null,

  /**
   * Initialise GameKit pour ce jeu.
   * DOIT être appelé avant d'utiliser les autres méthodes.
   * @param {string} name - Identifiant du jeu (correspond au slug du manifest)
   */
  init(name) {
    if (this._initialized) {
      console.warn('GameKit already initialized');
      return;
    }

    this.gameName = name;
    this._soundEnabled = true;
    this._paused = false;
    this.assets = new AssetLoader(name);
    this._setupListeners();
    this._initialized = true;

    // Signaler au portail que le jeu est prêt
    this._postMessage({ type: 'ready', game: name });
  },

  /**
   * Applique un message reconnu du portail.
   * @private
   * @param {PortalToGameMessage} data
   */
  _handlePortalMessage(data) {
    switch (data.type) {
      case 'unload':
        this.dispose();
        break;
      case 'preference':
        this._applyPreference(data);
        break;
      case 'pause':
        this._setPaused(true);
        break;
      case 'resume':
        this._setPaused(false);
        break;
    }
  },

  /**
   * @private
   * @param {{key?: string, value?: unknown}} data
   */
  _applyPreference(data) {
    if (data.key === 'sound' && typeof data.value === 'boolean') {
      this._soundEnabled = data.value;
      callHook('onSoundChange', this._soundEnabled);
    }
  },

  /**
   * Met à jour l'état de pause et notifie le jeu.
   * @private
   * @param {boolean} paused
   */
  _setPaused(paused) {
    this._paused = paused;
    callHook(paused ? 'onGamePause' : 'onGameResume');
  },

  /**
   * Configure les écouteurs d'événements.
   * @private
   */
  _setupListeners() {
    const ownerWindow = window;
    const ownerDocument = document;
    let active = true;
    // Messages du portail
    /** @param {MessageEvent<PortalToGameMessage>} event */
    const onMessage = (event) => {
      // Ignorer les messages non reconnus
      if (!active || !event.data || !event.data.type) {return;}
      this._handlePortalMessage(event.data);
    };

    // Auto-pause quand l'onglet est masqué
    const onVisibilityChange = () => {
      if (!active) {return;}
      this._setPaused(Boolean(ownerDocument.hidden));
    };
    ownerWindow.addEventListener('message', onMessage);
    ownerDocument.addEventListener('visibilitychange', onVisibilityChange);
    this._cleanupListeners = () => {
      active = false;
      ownerWindow.removeEventListener('message', onMessage);
      ownerDocument.removeEventListener('visibilitychange', onVisibilityChange);
    };
  },

  /**
   * Envoie un message au portail parent.
   * @private
   * @param {GameToPortalMessage} message
   */
  _postMessage(message) {
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  },

  /**
   * Libère toutes les ressources.
   * Appelé automatiquement quand le portail envoie 'unload'.
   */
  dispose() {
    if (!this._initialized) {return;}
    this._initialized = false;
    this._cleanupListeners?.();
    this._cleanupListeners = null;
    this._soundEnabled = true;
    this._paused = false;

    if (this.assets) {
      this.assets.dispose();
      this.assets = null;
    }

    if (typeof window.onGameDispose === 'function') {
      window.onGameDispose();
    }
  },

  /**
   * Vérifie si le jeu est en pause.
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  },

  /**
   * Vérifie si le son est activé.
   * @returns {boolean}
   */
  isSoundEnabled() {
    return this._soundEnabled;
  },

  /**
   * Récupère les informations du joueur.
   * @returns {{name: string}}
   */
  getPlayer() {
    try {
      return readLocalData('player', { name: 'Anonyme' });
    } catch (error) {
      console.warn('Cannot load player:', error);
      return { name: 'Anonyme' };
    }
  },

  /**
   * Sauvegarde un nouveau score.
   * Inclut automatiquement le timestamp et le nom du joueur.
   * Garde uniquement les 10 meilleurs scores.
   * @param {number} score - Valeur numérique du score
   * @returns {boolean} true si sauvegardé avec succès
   */
  saveScore(score) {
    if (!this.gameName) {
      console.warn('GameKit not initialized');
      return false;
    }

    try {
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new TypeError('Score must be a finite number');
      }
      const key = `scores_${this.gameName}`;
      const scores = readLocalData(key, []);

      scores.push({
        score,
        date: Date.now(),
        player: this.getPlayer().name,
      });

      // Trier par score décroissant et garder les meilleurs
      scores.sort((a, b) => b.score - a.score);
      writeLocalData(key, scores.slice(0, MAX_HIGH_SCORES));

      // Notifier le portail
      this._postMessage({
        type: 'score',
        game: this.gameName,
        score,
      });

      return true;
    } catch (e) {
      console.warn('Cannot save score:', e);
      return false;
    }
  },

  /**
   * Récupère les meilleurs scores pour ce jeu.
   * @returns {Array<{score: number, date: number, player: string}>}
   */
  getHighScores() {
    if (!this.gameName) {return [];}

    try {
      return readLocalData(`scores_${this.gameName}`, []).sort((a, b) => b.score - a.score);
    } catch (error) {
      console.warn('Cannot load scores:', error);
      return [];
    }
  },

  /**
   * Sauvegarde la progression du jeu.
   * @param {unknown} data - Données sérialisables en JSON
   * @returns {boolean} true si sauvegardé avec succès
   */
  saveProgress(data) {
    if (!this.gameName) {
      console.warn('GameKit not initialized');
      return false;
    }

    try {
      writeLocalData(`progress_${this.gameName}`, data);
      return true;
    } catch (e) {
      console.warn('Cannot save progress:', e);
      return false;
    }
  },

  /**
   * Charge la progression sauvegardée.
   * @template T
   * @returns {T|null}
   */
  loadProgress() {
    if (!this.gameName) {return null;}

    try {
      return readLocalData(`progress_${this.gameName}`, null);
    } catch (error) {
      console.warn('Cannot load progress:', error);
      return null;
    }
  },

  /**
   * Efface la progression sauvegardée.
   */
  clearProgress() {
    if (this.gameName) {
      removeLocalData(`progress_${this.gameName}`);
    }
  },

  /**
   * Demande le retour au catalogue du portail.
   */
  quit() {
    this._postMessage({ type: 'quit', game: this.gameName });
  },
};

// Export par défaut
export default GameKit;
