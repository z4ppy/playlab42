/**
 * AudioEngine - Wrapper Tone.js pour la synthèse audio
 *
 * Gère la synthèse audio pour jouer des notes, accords et séquences.
 * Utilise Tone.js qui est chargé à la demande.
 *
 * @module audio/AudioEngine
 */

// ============================================================================
// Constantes
// ============================================================================

/** Volume par défaut (-20 dB) */
const DEFAULT_VOLUME = -10;

/** Durée par défaut pour une note (en secondes) */
const DEFAULT_NOTE_DURATION = 0.5;

/** Tempo par défaut (BPM) */
const DEFAULT_TEMPO = 120;

// ============================================================================
// Classe AudioEngine
// ============================================================================

/**
 * Moteur audio pour la synthèse musicale
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

    /** @type {Object|null} Synthétiseur piano */
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

    /** @type {Function[]} Callbacks pour les événements */
    this._callbacks = {
      ready: [],
      started: [],
      noteStart: [],
      noteEnd: [],
    };
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
    if (this.ready) {return;}

    try {
      // Charger Tone.js dynamiquement
      this.Tone = await import('tone');

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

    if (this.started) {return;}

    try {
      // Démarrer le contexte audio
      await this.Tone.start();

      // Créer le synthétiseur
      this._createSynth();

      this.started = true;
      this._emit('started');
    } catch (error) {
      console.error('Erreur lors du démarrage audio:', error);
      throw error;
    }
  }

  /**
   * Crée le synthétiseur
   * @private
   */
  _createSynth() {
    // PolySynth pour jouer plusieurs notes simultanément
    this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 0.8,
      },
    }).toDestination();

    // Appliquer le volume
    this.synth.volume.value = this.volume;
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
    if (!this.started || this.muted) {return;}

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
    if (!this.started || this.muted) {return;}

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
    if (!this.started || this.muted) {return;}

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
      duration: 0.5, // Croche à 120 BPM
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

    this.ready = false;
    this.started = false;
    this.Tone = null;
    this._callbacks = { ready: [], started: [], noteStart: [], noteEnd: [] };
  }
}

export default AudioEngine;
