/**
 * GameKit - SDK pour les jeux Playlab42
 * Fournit la communication avec le portail, la gestion des scores et la persistence
 *
 * @see openspec/specs/gamekit/spec.md
 */

import { AssetLoader } from './assets.js';

/**
 * Nombre maximum de high scores à conserver par jeu.
 * Limité à 10 pour éviter de surcharger le localStorage.
 * @const {number}
 */
const MAX_HIGH_SCORES = 10;

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
    this.assets = new AssetLoader(name);
    this._setupListeners();
    this._initialized = true;

    // Signaler au portail que le jeu est prêt
    this._postMessage({ type: 'ready', game: name });
  },

  /**
   * Configure les écouteurs d'événements.
   * @private
   */
  _setupListeners() {
    // Messages du portail
    window.addEventListener('message', (event) => {
      // Ignorer les messages non reconnus
      if (!event.data || !event.data.type) {return;}

      switch (event.data.type) {
        case 'unload':
          this.dispose();
          break;

        case 'preference':
          if (event.data.key === 'sound') {
            this._soundEnabled = event.data.value;
            if (typeof window.onSoundChange === 'function') {
              window.onSoundChange(this._soundEnabled);
            }
          }
          break;

        case 'pause':
          this._paused = true;
          if (typeof window.onGamePause === 'function') {
            window.onGamePause();
          }
          break;

        case 'resume':
          this._paused = false;
          if (typeof window.onGameResume === 'function') {
            window.onGameResume();
          }
          break;
      }
    });

    // Auto-pause quand l'onglet est masqué
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
        if (typeof window.onGamePause === 'function') {
          window.onGamePause();
        }
      } else {
        this._paused = false;
        if (typeof window.onGameResume === 'function') {
          window.onGameResume();
        }
      }
    });
  },

  /**
   * Envoie un message au portail parent.
   * @private
   * @param {object} message
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
    if (this.assets) {
      this.assets.dispose();
      this.assets = null;
    }

    if (typeof window.onGameDispose === 'function') {
      window.onGameDispose();
    }

    this._initialized = false;
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
      const stored = localStorage.getItem('player');
      return stored ? JSON.parse(stored) : { name: 'Anonyme' };
    } catch {
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
      const key = `scores_${this.gameName}`;
      const stored = localStorage.getItem(key);
      const scores = stored ? JSON.parse(stored) : [];

      scores.push({
        score,
        date: Date.now(),
        player: this.getPlayer().name,
      });

      // Trier par score décroissant et garder les meilleurs
      scores.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(scores.slice(0, MAX_HIGH_SCORES)));

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
      const stored = localStorage.getItem(`scores_${this.gameName}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
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
      localStorage.setItem(`progress_${this.gameName}`, JSON.stringify(data));
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
      const stored = localStorage.getItem(`progress_${this.gameName}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      // Données corrompues, les supprimer
      localStorage.removeItem(`progress_${this.gameName}`);
      return null;
    }
  },

  /**
   * Efface la progression sauvegardée.
   */
  clearProgress() {
    if (this.gameName) {
      localStorage.removeItem(`progress_${this.gameName}`);
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
