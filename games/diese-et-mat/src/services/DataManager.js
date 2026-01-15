/**
 * DataManager - Gestionnaire de données persistantes
 *
 * Centralise la gestion de la progression et des paramètres utilisateur.
 * Utilise GameKit pour la progression et localStorage pour les paramètres.
 *
 * @module services/DataManager
 */

import GameKit from '../../../../lib/gamekit.js';
import { EventEmitter } from '../utils/EventEmitter.js';

// ============================================================================
// Constantes
// ============================================================================

/** Clé localStorage pour les paramètres */
const SETTINGS_STORAGE_KEY = 'diese-settings';

/** Paramètres par défaut */
const DEFAULT_SETTINGS = {
  notation: 'french',
  volume: 80,
};

/** Progression par défaut */
const DEFAULT_PROGRESS = {
  level: 1,
  xp: 0,
  skills: {
    'treble-clef': { level: 0, accuracy: 0, attempts: 0 },
    'bass-clef': { level: 0, accuracy: 0, attempts: 0 },
    'accidentals': { level: 0, accuracy: 0, attempts: 0 },
    'intervals': { level: 0, accuracy: 0, attempts: 0 },
  },
  history: [],
  achievements: [],
};

/** Map de conversion notes anglais -> français */
const FRENCH_NOTE_MAP = {
  'C': 'Do',
  'D': 'Ré',
  'E': 'Mi',
  'F': 'Fa',
  'G': 'Sol',
  'A': 'La',
  'B': 'Si',
};

// ============================================================================
// Classe DataManager
// ============================================================================

/**
 * Gestionnaire de données persistantes.
 *
 * Émet les événements suivants :
 * - 'progress-changed' : { progress }
 * - 'settings-changed' : { settings }
 * - 'progress-reset' : {}
 */
export class DataManager extends EventEmitter {
  /**
   * Crée un nouveau gestionnaire de données.
   */
  constructor() {
    super();

    /** @type {Object} Progression utilisateur */
    this._progress = null;

    /** @type {Object} Paramètres utilisateur */
    this._settings = { ...DEFAULT_SETTINGS };
  }

  // --------------------------------------------------------------------------
  // Accesseurs
  // --------------------------------------------------------------------------

  /**
   * Retourne la progression actuelle.
   * @returns {Object}
   */
  get progress() {
    return this._progress || this.getDefaultProgress();
  }

  /**
   * Retourne les paramètres actuels.
   * @returns {Object}
   */
  get settings() {
    return { ...this._settings };
  }

  /**
   * Retourne la notation choisie ('french' ou 'english').
   * @returns {string}
   */
  get notation() {
    return this._settings.notation || 'french';
  }

  /**
   * Retourne le volume (0-100).
   * @returns {number}
   */
  get volume() {
    return this._settings.volume ?? 80;
  }

  /**
   * Retourne le niveau actuel.
   * @returns {number}
   */
  get level() {
    return this._progress?.level || 1;
  }

  /**
   * Retourne l'XP actuelle.
   * @returns {number}
   */
  get xp() {
    return this._progress?.xp || 0;
  }

  // --------------------------------------------------------------------------
  // Progression
  // --------------------------------------------------------------------------

  /**
   * Charge la progression depuis GameKit.
   */
  loadProgress() {
    this._progress = GameKit.loadProgress() || this.getDefaultProgress();
    this.emit('progress-changed', { progress: this._progress });
  }

  /**
   * Sauvegarde la progression via GameKit.
   */
  saveProgress() {
    if (this._progress) {
      GameKit.saveProgress(this._progress);
    }
  }

  /**
   * Met à jour la progression.
   *
   * @param {Object} updates - Mises à jour partielles
   */
  updateProgress(updates) {
    this._progress = {
      ...this._progress,
      ...updates,
    };
    this.saveProgress();
    this.emit('progress-changed', { progress: this._progress });
  }

  /**
   * Ajoute de l'XP et met à jour le niveau si nécessaire.
   *
   * @param {number} amount - Quantité d'XP à ajouter
   */
  addXP(amount) {
    if (!this._progress) {
      this._progress = this.getDefaultProgress();
    }

    this._progress.xp = (this._progress.xp || 0) + amount;

    // Calcul du niveau (100 XP par niveau)
    const newLevel = Math.floor(this._progress.xp / 100) + 1;
    if (newLevel > this._progress.level) {
      this._progress.level = newLevel;
    }

    this.saveProgress();
    this.emit('progress-changed', { progress: this._progress });
  }

  /**
   * Met à jour une compétence.
   *
   * @param {string} skillId - ID de la compétence
   * @param {Object} updates - Mises à jour
   */
  updateSkill(skillId, updates) {
    if (!this._progress) {
      this._progress = this.getDefaultProgress();
    }

    if (!this._progress.skills) {
      this._progress.skills = {};
    }

    this._progress.skills[skillId] = {
      ...this._progress.skills[skillId],
      ...updates,
    };

    this.saveProgress();
    this.emit('progress-changed', { progress: this._progress });
  }

  /**
   * Ajoute une entrée à l'historique.
   *
   * @param {Object} entry - Entrée d'historique
   */
  addHistoryEntry(entry) {
    if (!this._progress) {
      this._progress = this.getDefaultProgress();
    }

    if (!this._progress.history) {
      this._progress.history = [];
    }

    // Chercher si l'exercice existe déjà
    const existingIndex = this._progress.history.findIndex(
      (h) => h.exerciseId === entry.exerciseId,
    );

    if (existingIndex >= 0) {
      // Mettre à jour si meilleur score
      const existing = this._progress.history[existingIndex];
      if (entry.score > existing.score) {
        this._progress.history[existingIndex] = {
          ...existing,
          ...entry,
          date: new Date().toISOString(),
        };
      }
    } else {
      // Ajouter nouvelle entrée
      this._progress.history.push({
        ...entry,
        date: new Date().toISOString(),
      });
    }

    this.saveProgress();
    this.emit('progress-changed', { progress: this._progress });
  }

  /**
   * Retourne le taux de réussite d'un exercice.
   *
   * @param {string} exerciseId - ID de l'exercice
   * @returns {number} Taux (0-1)
   */
  getExerciseProgress(exerciseId) {
    const progress = this._progress || this.getDefaultProgress();
    const record = progress.history?.find((h) => h.exerciseId === exerciseId);
    if (!record || !record.maxScore) {
      return 0;
    }
    return record.score / record.maxScore;
  }

  /**
   * Réinitialise la progression.
   *
   * @returns {boolean} true si réinitialisé
   */
  resetProgress() {
    this._progress = this.getDefaultProgress();
    GameKit.clearProgress();
    this.emit('progress-reset', {});
    this.emit('progress-changed', { progress: this._progress });
    return true;
  }

  /**
   * Retourne la progression par défaut.
   *
   * @returns {Object}
   */
  getDefaultProgress() {
    return JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
  }

  // --------------------------------------------------------------------------
  // Paramètres
  // --------------------------------------------------------------------------

  /**
   * Charge les paramètres depuis localStorage.
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          // Valider notation
          if (parsed.notation && ['french', 'english'].includes(parsed.notation)) {
            this._settings.notation = parsed.notation;
          }
          // Valider volume
          if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 100) {
            this._settings.volume = parsed.volume;
          }
        }
      }
    } catch {
      console.warn('Erreur chargement paramètres, utilisation des valeurs par défaut');
    }

    this.emit('settings-changed', { settings: this._settings });
  }

  /**
   * Sauvegarde les paramètres dans localStorage.
   */
  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this._settings));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('Stockage local plein, impossible de sauvegarder les paramètres');
      } else {
        console.warn('Erreur sauvegarde paramètres:', error.message);
      }
    }
  }

  /**
   * Met à jour un paramètre.
   *
   * @param {string} key - Clé du paramètre
   * @param {*} value - Valeur
   */
  setSetting(key, value) {
    this._settings[key] = value;
    this.saveSettings();
    this.emit('settings-changed', { settings: this._settings });
  }

  /**
   * Met à jour la notation.
   *
   * @param {string} notation - 'french' ou 'english'
   */
  setNotation(notation) {
    if (['french', 'english'].includes(notation)) {
      this.setSetting('notation', notation);
    }
  }

  /**
   * Met à jour le volume.
   *
   * @param {number} volume - Volume (0-100)
   */
  setVolume(volume) {
    if (typeof volume === 'number' && volume >= 0 && volume <= 100) {
      this.setSetting('volume', volume);
    }
  }

  // --------------------------------------------------------------------------
  // Formatage
  // --------------------------------------------------------------------------

  /**
   * Convertit une note selon la notation choisie.
   *
   * @param {string} noteLetter - Lettre de la note (C, D, E, etc.)
   * @param {boolean} includeOctave - Inclure l'octave
   * @param {number} octave - Numéro d'octave
   * @returns {string}
   */
  formatNote(noteLetter, includeOctave = false, octave = 4) {
    let note;

    if (this.notation === 'french') {
      // Gérer les dièses
      const baseLetter = noteLetter.replace('#', '');
      note = FRENCH_NOTE_MAP[baseLetter] || baseLetter;
      if (noteLetter.includes('#')) {
        note += '♯';
      }
    } else {
      note = noteLetter;
    }

    if (includeOctave) {
      note += octave;
    }

    return note;
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Sauvegarde et nettoie.
   */
  dispose() {
    this.saveProgress();
    this.saveSettings();
    super.dispose();
  }
}

export default DataManager;
