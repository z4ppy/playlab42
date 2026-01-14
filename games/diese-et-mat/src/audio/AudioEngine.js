/**
 * AudioEngine - Wrapper Tone.js pour la synthèse audio
 *
 * Gère la synthèse audio pour jouer des notes, accords et séquences.
 * Inclut des presets d'instruments, contrôle d'oscillateur, enveloppe ADSR
 * et effets (reverb, delay, filter).
 *
 * @module audio/AudioEngine
 */

// ============================================================================
// Constantes
// ============================================================================

/** Volume par défaut (-10 dB) */
const DEFAULT_VOLUME = -10;

/** Durée par défaut pour une note (en secondes) */
const DEFAULT_NOTE_DURATION = 0.5;

/** Tempo par défaut (BPM) */
const DEFAULT_TEMPO = 120;

/**
 * Presets d'instruments disponibles
 * Chaque preset définit un type d'oscillateur et une enveloppe ADSR
 */
const SYNTH_PRESETS = {
  piano: {
    name: 'Piano',
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
  },
  organ: {
    name: 'Orgue',
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.01, sustain: 0.9, release: 0.3 },
  },
  synthLead: {
    name: 'Synth Lead',
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
  },
  electricPiano: {
    name: 'Piano Élec.',
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.4, release: 0.6 },
  },
  bell: {
    name: 'Cloche',
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.2 },
  },
  retro8bit: {
    name: '8-bit',
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.4, release: 0.2 },
  },
};

/** Types d'oscillateurs disponibles */
const OSCILLATOR_TYPES = ['sine', 'triangle', 'square', 'sawtooth'];

/** Configuration par défaut des effets */
const DEFAULT_EFFECTS = {
  reverb: { enabled: false, amount: 0.3 },
  delay: { enabled: false, time: 0.2, feedback: 0.3 },
  filter: { enabled: false, frequency: 2000 },
};

// ============================================================================
// Classe AudioEngine
// ============================================================================

/**
 * Moteur audio pour la synthèse musicale avec contrôles avancés
 */
export class AudioEngine {
  /**
   * Crée une nouvelle instance du moteur audio
   *
   * @param {Object} options - Options
   * @param {number} options.volume - Volume initial (-60 à 0 dB)
   */
  constructor(options = {}) {
    /** @type {Object|null} Module Tone.js */
    this.Tone = null;

    /** @type {Object|null} Synthétiseur polyphonique */
    this.synth = null;

    /** @type {boolean} État d'initialisation */
    this.ready = false;

    /** @type {boolean} Audio activé (user gesture) */
    this.started = false;

    /** @type {boolean} Son coupé */
    this.muted = false;

    /** @type {number} Volume en dB */
    this.volume = options.volume ?? DEFAULT_VOLUME;

    /** @type {number} Tempo en BPM */
    this.tempo = DEFAULT_TEMPO;

    /** @type {string} Preset actif */
    this.currentPreset = 'piano';

    /** @type {string} Type d'oscillateur actif */
    this.oscillatorType = 'triangle';

    /** @type {Object} Enveloppe ADSR actuelle */
    this.envelope = { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 };

    /** @type {Object} Configuration des effets */
    this.effectsConfig = JSON.parse(JSON.stringify(DEFAULT_EFFECTS));

    /** @type {Object} Instances des effets Tone.js */
    this.effects = {
      reverb: null,
      delay: null,
      filter: null,
    };

    /** @type {Function[]} Callbacks pour les événements */
    this._callbacks = {
      ready: [],
      started: [],
      noteStart: [],
      noteEnd: [],
      settingsChange: [],
    };
  }

  // --------------------------------------------------------------------------
  // Getters statiques
  // --------------------------------------------------------------------------

  /**
   * Retourne la liste des presets disponibles
   * @returns {Object}
   */
  static getPresets() {
    return SYNTH_PRESETS;
  }

  /**
   * Retourne la liste des types d'oscillateurs
   * @returns {string[]}
   */
  static getOscillatorTypes() {
    return OSCILLATOR_TYPES;
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le moteur audio (charge Tone.js)
   *
   * @returns {Promise<void>}
   */
  async init() {
    if (this.ready) {
      return;
    }

    try {
      // Charger Tone.js dynamiquement
      const module = await import('tone');
      // Tone.js peut exporter différemment selon la version
      this.Tone = module.default || module;

      // Le contexte audio est créé mais pas encore démarré
      this.ready = true;
      this._emit('ready');
    } catch (error) {
      console.error('Erreur lors du chargement de Tone.js:', error);
      throw new Error('Impossible de charger Tone.js');
    }
  }

  /**
   * Démarre le contexte audio (nécessite un user gesture)
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.ready) {
      await this.init();
    }

    if (this.started) {
      return;
    }

    try {
      // Démarrer le contexte audio
      const startFn = this.Tone.start || this.Tone.default?.start;
      if (startFn) {
        await startFn();
      } else {
        // Alternative : démarrer le contexte directement
        const ctx = this.Tone.getContext?.() || this.Tone.context;
        if (ctx && ctx.state !== 'running') {
          await ctx.resume();
        }
      }

      // Créer la chaîne d'effets puis le synthétiseur
      await this._createEffectsChain();
      this._createSynth();

      this.started = true;
      this._emit('started');
    } catch (error) {
      console.error('Erreur lors du démarrage audio:', error);
      throw error;
    }
  }

  /**
   * Crée la chaîne d'effets : Filter → Delay → Reverb → Destination
   * Les effets sont créés une seule fois et réutilisés.
   * @private
   */
  async _createEffectsChain() {
    // Ne créer qu'une seule fois
    if (this.effects.filter) {
      return;
    }

    const Tone = this.Tone;

    // Créer le filtre lowpass
    this.effects.filter = new Tone.Filter({
      frequency: this.effectsConfig.filter.frequency,
      type: 'lowpass',
      rolloff: -12,
    });

    // Créer le delay
    this.effects.delay = new Tone.FeedbackDelay({
      delayTime: this.effectsConfig.delay.time,
      feedback: this.effectsConfig.delay.feedback,
      wet: this.effectsConfig.delay.enabled ? 0.5 : 0,
    });

    // Créer la reverb
    this.effects.reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.01,
      wet: this.effectsConfig.reverb.enabled ? this.effectsConfig.reverb.amount : 0,
    });

    // Attendre que la reverb génère son impulse response
    await this.effects.reverb.ready;

    // Chaîner : filter → delay → reverb → destination
    this.effects.filter.connect(this.effects.delay);
    this.effects.delay.connect(this.effects.reverb);
    this.effects.reverb.toDestination();
  }

  /**
   * Crée le synthétiseur avec les paramètres actuels
   * @private
   */
  _createSynth() {
    const PolySynth = this.Tone.PolySynth;
    const Synth = this.Tone.Synth;

    if (!PolySynth || !Synth) {
      console.error('Classes Tone.js non trouvées:', {
        PolySynth: !!PolySynth,
        Synth: !!Synth,
      });
      throw new Error('Classes Tone.js manquantes');
    }

    // Relâcher et disposer l'ancien synth si existant
    if (this.synth) {
      this.synth.releaseAll();
      this.synth.dispose();
    }

    // Créer le PolySynth avec les paramètres actuels
    this.synth = new PolySynth(Synth, {
      oscillator: {
        type: this.oscillatorType,
      },
      envelope: { ...this.envelope },
    });

    // Appliquer le volume
    this.synth.volume.value = this.volume;

    // Connecter à la chaîne d'effets si elle existe, sinon à la destination
    if (this.effects.filter) {
      // Si le filtre est activé, passer par lui, sinon le bypasser
      if (this.effectsConfig.filter.enabled) {
        this.synth.connect(this.effects.filter);
      } else {
        // Bypasser le filtre, connecter directement au delay
        this.synth.connect(this.effects.delay);
      }
    } else {
      this.synth.toDestination();
    }
  }

  // --------------------------------------------------------------------------
  // Presets et configuration
  // --------------------------------------------------------------------------

  /**
   * Applique un preset d'instrument
   *
   * @param {string} presetName - Nom du preset (piano, organ, synthLead, etc.)
   */
  setPreset(presetName) {
    const preset = SYNTH_PRESETS[presetName];
    if (!preset) {
      console.warn('Preset inconnu:', presetName);
      return;
    }

    this.currentPreset = presetName;
    this.oscillatorType = preset.oscillator.type;
    this.envelope = { ...preset.envelope };

    // Recréer le synthétiseur si déjà démarré
    if (this.started) {
      this._createSynth();
    }

    this._emit('settingsChange', this.getSettings());
  }

  /**
   * Change le type d'oscillateur
   *
   * @param {string} type - Type d'oscillateur (sine, triangle, square, sawtooth)
   */
  setOscillator(type) {
    if (!OSCILLATOR_TYPES.includes(type)) {
      console.warn('Type d\'oscillateur inconnu:', type);
      return;
    }

    this.oscillatorType = type;
    this.currentPreset = 'custom'; // On sort du preset

    if (this.synth) {
      // Mise à jour dynamique de l'oscillateur
      this.synth.set({
        oscillator: { type },
      });
    }

    this._emit('settingsChange', this.getSettings());
  }

  /**
   * Modifie l'enveloppe ADSR
   *
   * @param {Object} params - Paramètres de l'enveloppe
   * @param {number} params.attack - Temps d'attaque (0.001 à 2s)
   * @param {number} params.decay - Temps de decay (0.01 à 2s)
   * @param {number} params.sustain - Niveau de sustain (0 à 1)
   * @param {number} params.release - Temps de release (0.01 à 5s)
   */
  setEnvelope(params) {
    // Fusionner avec les valeurs existantes
    this.envelope = {
      attack: params.attack ?? this.envelope.attack,
      decay: params.decay ?? this.envelope.decay,
      sustain: params.sustain ?? this.envelope.sustain,
      release: params.release ?? this.envelope.release,
    };

    // Valider les bornes
    this.envelope.attack = Math.max(0.001, Math.min(2, this.envelope.attack));
    this.envelope.decay = Math.max(0.01, Math.min(2, this.envelope.decay));
    this.envelope.sustain = Math.max(0, Math.min(1, this.envelope.sustain));
    this.envelope.release = Math.max(0.01, Math.min(5, this.envelope.release));

    this.currentPreset = 'custom';

    if (this.synth) {
      this.synth.set({
        envelope: this.envelope,
      });
    }

    this._emit('settingsChange', this.getSettings());
  }

  // --------------------------------------------------------------------------
  // Effets
  // --------------------------------------------------------------------------

  /**
   * Configure la réverbération
   *
   * @param {boolean} enabled - Activer/désactiver
   * @param {number} amount - Quantité (0 à 1)
   */
  setReverb(enabled, amount = 0.3) {
    this.effectsConfig.reverb.enabled = enabled;
    this.effectsConfig.reverb.amount = Math.max(0, Math.min(1, amount));

    // Appliquer à l'effet Tone.js
    if (this.effects.reverb) {
      this.effects.reverb.wet.value = enabled ? this.effectsConfig.reverb.amount : 0;
    }

    this._emit('settingsChange', this.getSettings());
  }

  /**
   * Configure le delay
   *
   * @param {boolean} enabled - Activer/désactiver
   * @param {number} time - Temps de delay en secondes (0.01 à 1)
   * @param {number} feedback - Feedback (0 à 0.9)
   */
  setDelay(enabled, time = 0.2, feedback = 0.3) {
    this.effectsConfig.delay.enabled = enabled;
    this.effectsConfig.delay.time = Math.max(0.01, Math.min(1, time));
    this.effectsConfig.delay.feedback = Math.max(0, Math.min(0.9, feedback));

    // Appliquer à l'effet Tone.js
    if (this.effects.delay) {
      this.effects.delay.wet.value = enabled ? 0.5 : 0;
      this.effects.delay.delayTime.value = this.effectsConfig.delay.time;
      this.effects.delay.feedback.value = this.effectsConfig.delay.feedback;
    }

    this._emit('settingsChange', this.getSettings());
  }

  /**
   * Configure le filtre lowpass
   *
   * @param {boolean} enabled - Activer/désactiver
   * @param {number} frequency - Fréquence de coupure en Hz (100 à 10000)
   */
  setFilter(enabled, frequency = 2000) {
    const wasEnabled = this.effectsConfig.filter.enabled;
    this.effectsConfig.filter.enabled = enabled;
    this.effectsConfig.filter.frequency = Math.max(100, Math.min(10000, frequency));

    // Appliquer à l'effet Tone.js
    if (this.effects.filter) {
      this.effects.filter.frequency.value = this.effectsConfig.filter.frequency;

      // Si l'état du filtre a changé, reconnecter le synth
      if (wasEnabled !== enabled && this.synth) {
        this.synth.disconnect();
        if (enabled) {
          this.synth.connect(this.effects.filter);
        } else {
          this.synth.connect(this.effects.delay);
        }
      }
    }

    this._emit('settingsChange', this.getSettings());
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /**
   * Retourne la configuration complète du synthétiseur
   *
   * @returns {Object} Configuration actuelle
   */
  getSettings() {
    return {
      preset: this.currentPreset,
      oscillator: this.oscillatorType,
      envelope: { ...this.envelope },
      effects: JSON.parse(JSON.stringify(this.effectsConfig)),
      volume: this.volume,
    };
  }

  /**
   * Applique une configuration sauvegardée
   *
   * @param {Object} settings - Configuration à appliquer
   */
  applySettings(settings) {
    if (!settings) {
      return;
    }

    // Appliquer le preset ou les paramètres individuels
    if (settings.preset && settings.preset !== 'custom' && SYNTH_PRESETS[settings.preset]) {
      this.setPreset(settings.preset);
    } else {
      // Configuration personnalisée
      if (settings.oscillator) {
        this.oscillatorType = settings.oscillator;
      }
      if (settings.envelope) {
        this.envelope = { ...settings.envelope };
      }
      this.currentPreset = 'custom';
    }

    // Appliquer les effets (config)
    if (settings.effects) {
      if (settings.effects.reverb) {
        this.effectsConfig.reverb = { ...settings.effects.reverb };
      }
      if (settings.effects.delay) {
        this.effectsConfig.delay = { ...settings.effects.delay };
      }
      if (settings.effects.filter) {
        this.effectsConfig.filter = { ...settings.effects.filter };
      }
    }

    // Appliquer le volume
    if (typeof settings.volume === 'number') {
      this.volume = settings.volume;
    }

    // Recréer le synth si déjà démarré
    if (this.started) {
      this._createSynth();

      // Appliquer les effets aux objets Tone.js
      if (this.effects.reverb) {
        const r = this.effectsConfig.reverb;
        this.effects.reverb.wet.value = r.enabled ? r.amount : 0;
      }
      if (this.effects.delay) {
        const d = this.effectsConfig.delay;
        this.effects.delay.wet.value = d.enabled ? 0.5 : 0;
        this.effects.delay.delayTime.value = d.time;
        this.effects.delay.feedback.value = d.feedback;
      }
      if (this.effects.filter) {
        this.effects.filter.frequency.value = this.effectsConfig.filter.frequency;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Lecture audio
  // --------------------------------------------------------------------------

  /**
   * Joue une note
   *
   * @param {import('../core/Pitch.js').Pitch|string} pitch - Note à jouer
   * @param {number|string} duration - Durée (en secondes ou notation "4n", "8n", etc.)
   * @param {number} time - Temps de départ (optionnel)
   */
  playNote(pitch, duration = DEFAULT_NOTE_DURATION, time) {
    if (!this.started || this.muted) {
      return;
    }

    const note = typeof pitch === 'string' ? pitch : pitch.toTone();
    const dur = typeof duration === 'number' ? duration : duration;

    this._emit('noteStart', { note, duration: dur });

    this.synth.triggerAttackRelease(note, dur, time);

    // Émettre la fin de note après la durée
    const durMs = typeof duration === 'number' ? duration * 1000 : 500;
    setTimeout(() => {
      this._emit('noteEnd', { note });
    }, durMs);
  }

  /**
   * Joue un accord
   *
   * @param {Array<import('../core/Pitch.js').Pitch|string>} pitches - Notes de l'accord
   * @param {number|string} duration - Durée
   * @param {number} time - Temps de départ
   */
  playChord(pitches, duration = DEFAULT_NOTE_DURATION, time) {
    if (!this.started || this.muted) {
      return;
    }

    const notes = pitches.map((p) => (typeof p === 'string' ? p : p.toTone()));

    this._emit('noteStart', { notes, duration });

    this.synth.triggerAttackRelease(notes, duration, time);

    const durMs = typeof duration === 'number' ? duration * 1000 : 500;
    setTimeout(() => {
      this._emit('noteEnd', { notes });
    }, durMs);
  }

  /**
   * Joue une séquence de notes
   *
   * @param {Array<{pitch: Pitch|string, duration: number}>} notes - Séquence
   * @param {number} tempo - Tempo en BPM (optionnel)
   * @returns {Promise<void>} Résolu quand la séquence est terminée
   */
  async playSequence(notes, tempo = this.tempo) {
    if (!this.started || this.muted) {
      return;
    }

    const beatDuration = 60 / tempo;

    for (const { pitch, duration } of notes) {
      const note = typeof pitch === 'string' ? pitch : pitch.toTone();
      const dur = (duration || 1) * beatDuration;

      this.playNote(note, dur);

      // Attendre la durée avant la note suivante
      await this._sleep(dur * 1000);
    }
  }

  /**
   * Joue une gamme
   *
   * @param {import('../core/Scale.js').Scale} scale - Gamme à jouer
   * @param {number} tempo - Tempo en BPM
   * @param {boolean} descending - Jouer en descendant
   */
  async playScale(scale, tempo = 120, descending = false) {
    const pitches = scale.getPitches();
    if (descending) {
      pitches.reverse();
    }

    const notes = pitches.map((pitch) => ({
      pitch,
      duration: 0.5,
    }));

    await this.playSequence(notes, tempo);
  }

  // --------------------------------------------------------------------------
  // Contrôle du volume
  // --------------------------------------------------------------------------

  /**
   * Définit le volume
   *
   * @param {number} db - Volume en dB (-60 à 0)
   */
  setVolume(db) {
    this.volume = Math.max(-60, Math.min(0, db));

    if (this.synth) {
      this.synth.volume.value = this.volume;
    }

    this._emit('settingsChange', this.getSettings());
  }

  /**
   * Coupe/active le son
   *
   * @param {boolean} muted - État muet
   */
  setMuted(muted) {
    this.muted = muted;

    if (this.synth) {
      this.synth.volume.value = muted ? -Infinity : this.volume;
    }
  }

  /**
   * Toggle mute
   *
   * @returns {boolean} Nouvel état muet
   */
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // --------------------------------------------------------------------------
  // Événements
  // --------------------------------------------------------------------------

  /**
   * Ajoute un listener d'événement
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction callback
   */
  on(event, callback) {
    if (this._callbacks[event]) {
      this._callbacks[event].push(callback);
    }
  }

  /**
   * Retire un listener
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction callback
   */
  off(event, callback) {
    if (this._callbacks[event]) {
      const index = this._callbacks[event].indexOf(callback);
      if (index !== -1) {
        this._callbacks[event].splice(index, 1);
      }
    }
  }

  /**
   * Émet un événement
   * @private
   */
  _emit(event, data) {
    if (this._callbacks[event]) {
      this._callbacks[event].forEach((cb) => cb(data));
    }
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------

  /**
   * Pause asynchrone
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Arrête tous les sons en cours
   */
  stopAll() {
    if (this.synth) {
      this.synth.releaseAll();
    }
  }

  /**
   * Nettoie et libère les ressources
   */
  dispose() {
    this.stopAll();

    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }

    // Disposer les effets
    const effectKeys = ['reverb', 'delay', 'filter'];
    for (const key of effectKeys) {
      if (this.effects[key]) {
        this.effects[key].dispose();
        this.effects[key] = null;
      }
    }

    this.ready = false;
    this.started = false;
    this.Tone = null;
    this._callbacks = {
      ready: [],
      started: [],
      noteStart: [],
      noteEnd: [],
      settingsChange: [],
    };
  }
}

export default AudioEngine;
