/**
 * SynthManager - Gestionnaire centralisé du synthétiseur
 *
 * Centralise la logique de gestion du synthétiseur (presets, effets, ADSR).
 * Émet des événements pour permettre la synchronisation des UI.
 *
 * @module audio/SynthManager
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { AudioEngine } from './AudioEngine.js';

// ============================================================================
// Constantes
// ============================================================================

/** Clé de stockage localStorage */
const STORAGE_KEY = 'diese-synth-config';

/** Configuration par défaut */
const DEFAULT_CONFIG = {
  preset: 'piano',
  oscillator: 'triangle',
  envelope: {
    attack: 0.02,
    decay: 0.1,
    sustain: 0.3,
    release: 0.8,
  },
  effects: {
    reverb: { enabled: false, amount: 0.3 },
    delay: { enabled: false, time: 0.2, feedback: 0.3 },
    filter: { enabled: false, frequency: 2000 },
  },
  fm: { harmonicity: 3, modulationIndex: 10 },
  pluck: { attackNoise: 1, resonance: 0.96, dampening: 4000 },
  membrane: { pitchDecay: 0.02, octaves: 4 },
  metal: { frequency: 200, harmonicity: 5 },
};

// ============================================================================
// Classe SynthManager
// ============================================================================

/**
 * Gestionnaire centralisé du synthétiseur.
 *
 * Émet les événements suivants :
 * - 'preset-changed' : { preset }
 * - 'oscillator-changed' : { oscillator }
 * - 'envelope-changed' : { envelope }
 * - 'effect-changed' : { effectName, config }
 * - 'synth-param-changed' : { synthType, param, value }
 * - 'config-changed' : { config }
 * - 'audio-ready' : {}
 */
export class SynthManager extends EventEmitter {
  /**
   * Crée un nouveau gestionnaire de synthétiseur.
   *
   * @param {Object} options - Options
   * @param {AudioEngine} options.audioEngine - Instance AudioEngine existante (optionnel)
   */
  constructor(options = {}) {
    super();

    /** @type {AudioEngine|null} Instance du moteur audio */
    this._audioEngine = options.audioEngine || null;

    /** @type {Object} Configuration actuelle */
    this._config = this._loadConfig();

    /** @type {boolean} Audio initialisé */
    this._audioReady = false;

    /** @type {Promise|null} Promesse d'initialisation en cours */
    this._initPromise = null;

    /** @type {Set<string>} Notes actuellement jouées */
    this._activeNotes = new Set();
  }

  // --------------------------------------------------------------------------
  // Accesseurs
  // --------------------------------------------------------------------------

  /**
   * Retourne le moteur audio.
   *
   * @returns {AudioEngine|null}
   */
  get audioEngine() {
    return this._audioEngine;
  }

  /**
   * Retourne la configuration actuelle.
   *
   * @returns {Object}
   */
  get config() {
    return structuredClone(this._config);
  }

  /**
   * Retourne le preset actuel.
   *
   * @returns {string}
   */
  get preset() {
    return this._config.preset;
  }

  /**
   * Retourne le type d'oscillateur actuel.
   *
   * @returns {string}
   */
  get oscillator() {
    return this._config.oscillator;
  }

  /**
   * Retourne l'enveloppe ADSR actuelle.
   *
   * @returns {Object}
   */
  get envelope() {
    return { ...this._config.envelope };
  }

  /**
   * Retourne la configuration des effets.
   *
   * @returns {Object}
   */
  get effects() {
    return structuredClone(this._config.effects);
  }

  /**
   * Retourne vrai si l'audio est prêt.
   *
   * @returns {boolean}
   */
  get isAudioReady() {
    return this._audioReady;
  }

  /**
   * Retourne les notes actuellement jouées.
   *
   * @returns {Set<string>}
   */
  get activeNotes() {
    return new Set(this._activeNotes);
  }

  // --------------------------------------------------------------------------
  // Initialisation Audio
  // --------------------------------------------------------------------------

  /**
   * S'assure que l'audio est initialisé.
   * Peut être appelé plusieurs fois, l'initialisation ne se fait qu'une fois.
   *
   * @returns {Promise<AudioEngine>}
   */
  ensureAudioReady() {
    if (this._audioReady && this._audioEngine) {
      return this._audioEngine;
    }

    // Éviter les initialisations multiples
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._initAudio();
    return this._initPromise;
  }

  /**
   * Initialise le moteur audio.
   * @private
   *
   * @returns {Promise<AudioEngine>}
   */
  async _initAudio() {
    try {
      // Créer l'AudioEngine si nécessaire
      if (!this._audioEngine) {
        this._audioEngine = new AudioEngine();
      }

      // Démarrer l'AudioEngine
      await this._audioEngine.start();

      // Appliquer la configuration sauvegardée
      this._audioEngine.applySettings(this._config);

      this._audioReady = true;
      this._initPromise = null;

      this.emit('audio-ready', {});

      return this._audioEngine;
    } catch (error) {
      this._initPromise = null;
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Gestion des Presets
  // --------------------------------------------------------------------------

  /**
   * Retourne les presets disponibles.
   *
   * @returns {Object}
   */
  getPresets() {
    return AudioEngine.getPresets();
  }

  /**
   * Définit le preset actif.
   *
   * @param {string} presetName - Nom du preset
   */
  setPreset(presetName) {
    const presets = this.getPresets();
    if (!presets[presetName]) {
      console.warn(`Preset inconnu: ${presetName}`);
      return;
    }

    this._config.preset = presetName;

    if (this._audioReady && this._audioEngine) {
      this._audioEngine.setPreset(presetName);
      this._config = this._audioEngine.getSettings();
    }

    this._saveConfig();
    this.emit('preset-changed', { preset: presetName });
    this.emit('config-changed', { config: this.config });
  }

  /**
   * Retourne le type de synthé pour le preset actuel.
   *
   * @returns {string}
   */
  getCurrentSynthType() {
    const presets = this.getPresets();
    const preset = presets[this._config.preset];
    return preset?.synthType || 'poly';
  }

  // --------------------------------------------------------------------------
  // Gestion de l'Oscillateur
  // --------------------------------------------------------------------------

  /**
   * Définit le type d'oscillateur.
   *
   * @param {string} type - Type d'oscillateur (sine, triangle, square, sawtooth)
   */
  setOscillator(type) {
    this._config.oscillator = type;

    if (this._audioReady && this._audioEngine) {
      this._audioEngine.setOscillator(type);
      this._config = this._audioEngine.getSettings();
    }

    this._saveConfig();
    this.emit('oscillator-changed', { oscillator: type });
    this.emit('config-changed', { config: this.config });
  }

  // --------------------------------------------------------------------------
  // Gestion de l'Enveloppe ADSR
  // --------------------------------------------------------------------------

  /**
   * Met à jour l'enveloppe ADSR.
   *
   * @param {Object} params - Paramètres ADSR
   * @param {number} params.attack - Temps d'attaque
   * @param {number} params.decay - Temps de decay
   * @param {number} params.sustain - Niveau sustain
   * @param {number} params.release - Temps de release
   */
  setEnvelope(params) {
    this._config.envelope = { ...this._config.envelope, ...params };

    if (this._audioReady && this._audioEngine) {
      this._audioEngine.setEnvelope(params);
      this._config = this._audioEngine.getSettings();
    }

    this._saveConfig();
    this.emit('envelope-changed', { envelope: this._config.envelope });
    this.emit('config-changed', { config: this.config });
  }

  // --------------------------------------------------------------------------
  // Gestion des Effets
  // --------------------------------------------------------------------------

  /**
   * Met à jour un effet.
   *
   * @param {string} effectName - Nom de l'effet (reverb, delay, filter)
   * @param {Object} params - Paramètres de l'effet
   */
  setEffect(effectName, params) {
    if (!this._config.effects[effectName]) {
      console.warn(`Effet inconnu: ${effectName}`);
      return;
    }

    this._config.effects[effectName] = {
      ...this._config.effects[effectName],
      ...params,
    };

    if (this._audioReady && this._audioEngine) {
      const config = this._config.effects[effectName];

      switch (effectName) {
        case 'reverb':
          this._audioEngine.setReverb(config.enabled, config.amount);
          break;
        case 'delay':
          this._audioEngine.setDelay(config.enabled, config.time, config.feedback);
          break;
        case 'filter':
          this._audioEngine.setFilter(config.enabled, config.frequency);
          break;
      }

      this._config = this._audioEngine.getSettings();
    }

    this._saveConfig();
    this.emit('effect-changed', {
      effectName,
      config: this._config.effects[effectName],
    });
    this.emit('config-changed', { config: this.config });
  }

  /**
   * Active ou désactive un effet.
   *
   * @param {string} effectName - Nom de l'effet
   * @param {boolean} enabled - État activé/désactivé
   */
  toggleEffect(effectName, enabled) {
    return this.setEffect(effectName, { enabled });
  }

  // --------------------------------------------------------------------------
  // Gestion des Paramètres de Synthèse Avancés
  // --------------------------------------------------------------------------

  /**
   * Met à jour un paramètre de synthèse spécifique.
   *
   * @param {string} synthType - Type de synthèse (fm, pluck, membrane, metal)
   * @param {string} param - Nom du paramètre
   * @param {number} value - Valeur
   */
  setSynthParam(synthType, param, value) {
    if (!this._config[synthType]) {
      this._config[synthType] = {};
    }

    this._config[synthType][param] = value;

    if (this._audioReady && this._audioEngine) {
      this._audioEngine.setSynthParam(synthType, param, value);
      this._config = this._audioEngine.getSettings();
    }

    this._saveConfig();
    this.emit('synth-param-changed', { synthType, param, value });
    this.emit('config-changed', { config: this.config });
  }

  /**
   * Retourne les paramètres d'un type de synthèse.
   *
   * @param {string} synthType - Type de synthèse
   * @returns {Object}
   */
  getSynthParams(synthType) {
    return this._config[synthType] ? { ...this._config[synthType] } : {};
  }

  // --------------------------------------------------------------------------
  // Jeu de Notes
  // --------------------------------------------------------------------------

  /**
   * Joue une note.
   *
   * @param {string} pitch - Note à jouer (ex: 'C4', 'A#3')
   * @returns {Promise<void>}
   */
  async noteOn(pitch) {
    if (this._activeNotes.has(pitch)) {
      return; // Déjà en cours de lecture
    }

    await this.ensureAudioReady();

    this._activeNotes.add(pitch);
    this._audioEngine.noteOn(pitch);

    this.emit('note-on', { pitch });
  }

  /**
   * Arrête une note.
   *
   * @param {string} pitch - Note à arrêter
   */
  noteOff(pitch) {
    if (!this._activeNotes.has(pitch)) {
      return;
    }

    this._activeNotes.delete(pitch);

    if (this._audioEngine) {
      this._audioEngine.noteOff(pitch);
    }

    this.emit('note-off', { pitch });
  }

  /**
   * Arrête toutes les notes actives.
   */
  stopAllNotes() {
    for (const pitch of this._activeNotes) {
      if (this._audioEngine) {
        this._audioEngine.noteOff(pitch);
      }
    }
    this._activeNotes.clear();
    this.emit('all-notes-off', {});
  }

  /**
   * Joue une note avec une durée définie.
   *
   * @param {string} pitch - Note
   * @param {number} duration - Durée en secondes
   * @returns {Promise<void>}
   */
  async playNote(pitch, duration = 0.5) {
    await this.ensureAudioReady();
    this._audioEngine.playNote(pitch, duration);
    this.emit('note-played', { pitch, duration });
  }

  /**
   * Joue un accord.
   *
   * @param {string[]} pitches - Notes de l'accord
   * @param {number} duration - Durée en secondes
   * @returns {Promise<void>}
   */
  async playChord(pitches, duration = 0.5) {
    await this.ensureAudioReady();
    this._audioEngine.playChord(pitches, duration);
    this.emit('chord-played', { pitches, duration });
  }

  // --------------------------------------------------------------------------
  // Volume et Mute
  // --------------------------------------------------------------------------

  /**
   * Définit le volume.
   *
   * @param {number} db - Volume en dB
   */
  setVolume(db) {
    if (this._audioEngine) {
      this._audioEngine.setVolume(db);
    }
  }

  /**
   * Active ou désactive le mute.
   *
   * @param {boolean} muted - État muet
   */
  setMuted(muted) {
    if (this._audioEngine) {
      this._audioEngine.setMuted(muted);
    }
  }

  // --------------------------------------------------------------------------
  // Persistance
  // --------------------------------------------------------------------------

  /**
   * Charge la configuration depuis localStorage.
   * @private
   *
   * @returns {Object}
   */
  _loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Valider la structure
        if (typeof parsed === 'object' && parsed !== null && parsed.envelope && parsed.effects) {
          return { ...DEFAULT_CONFIG, ...parsed };
        }
      }
    } catch (error) {
      console.warn('Erreur lors du chargement de la config synthé:', error);
    }

    return { ...DEFAULT_CONFIG };
  }

  /**
   * Sauvegarde la configuration dans localStorage.
   * @private
   */
  _saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage plein, suppression des anciennes données');
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
        } catch {
          console.warn('Impossible de sauvegarder la config synthé');
        }
      } else {
        console.warn('Erreur lors de la sauvegarde:', error);
      }
    }
  }

  /**
   * Recharge la configuration depuis localStorage.
   */
  reloadConfig() {
    this._config = this._loadConfig();
    if (this._audioReady && this._audioEngine) {
      this._audioEngine.applySettings(this._config);
    }
    this.emit('config-changed', { config: this.config });
  }

  /**
   * Réinitialise la configuration aux valeurs par défaut.
   */
  resetConfig() {
    this._config = { ...DEFAULT_CONFIG };
    if (this._audioReady && this._audioEngine) {
      this._audioEngine.applySettings(this._config);
    }
    this._saveConfig();
    this.emit('config-changed', { config: this.config });
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie et libère les ressources.
   */
  dispose() {
    this.stopAllNotes();

    if (this._audioEngine) {
      this._audioEngine.dispose();
      this._audioEngine = null;
    }

    this._audioReady = false;
    this._initPromise = null;

    super.dispose();
  }
}

export default SynthManager;
