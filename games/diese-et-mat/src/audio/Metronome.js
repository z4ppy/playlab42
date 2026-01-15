/**
 * Metronome - Métronome musical
 *
 * Fournit un métronome avec tempo réglable et callback sur chaque beat.
 *
 * @module audio/Metronome
 */

// ============================================================================
// Constantes
// ============================================================================

/** Tempo par défaut (BPM) */
const DEFAULT_TEMPO = 120;

/** Signature rythmique par défaut */
const DEFAULT_TIME_SIGNATURE = { beats: 4, beatValue: 4 };

// ============================================================================
// Classe Metronome
// ============================================================================

/**
 * Métronome musical avec tempo et signature réglables
 */
export class Metronome {
  /**
   * Crée un nouveau métronome
   *
   * @param {import('./AudioEngine.js').AudioEngine} audioEngine - Moteur audio
   * @param {Object} options - Options
   * @param {number} options.tempo - Tempo en BPM
   * @param {Object} options.timeSignature - Signature rythmique
   * @param {boolean} options.accent - Accentuer le premier temps
   */
  constructor(audioEngine, options = {}) {
    /** @type {import('./AudioEngine.js').AudioEngine} */
    this.audioEngine = audioEngine;

    /** @type {number} Tempo en BPM */
    this.tempo = options.tempo || DEFAULT_TEMPO;

    /** @type {Object} Signature rythmique */
    this.timeSignature =
      options.timeSignature || { ...DEFAULT_TIME_SIGNATURE };

    /** @type {boolean} Accentuer le premier temps */
    this.accent = options.accent !== false;

    /** @type {boolean} En cours de lecture */
    this.playing = false;

    /** @type {number} Beat courant (1-indexed) */
    this.currentBeat = 0;

    /** @type {number|null} ID de l'intervalle */
    this._intervalId = null;

    /** @type {Object|null} Synthétiseur de click */
    this._clickSynth = null;

    /** @type {Function[]} Callbacks sur chaque beat */
    this._beatCallbacks = [];

    /** @type {Function[]} Callbacks sur le premier temps */
    this._downbeatCallbacks = [];

    /** @type {number} Dernier temps joué (pour éviter les conflits Tone.js) */
    this._lastPlayTime = 0;
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le synthétiseur de click
   * @private
   */
  async _initClickSynth() {
    if (this._clickSynth) {return;}

    if (!this.audioEngine.started) {
      await this.audioEngine.start();
    }

    const Tone = this.audioEngine.Tone;

    // Créer un synthétiseur simple pour les clicks
    // Utiliser Synth au lieu de MembraneSynth pour éviter les conflits de timing
    this._clickSynth = new Tone.Synth({
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
      },
    }).toDestination();

    this._clickSynth.volume.value = -5;
  }

  // --------------------------------------------------------------------------
  // Contrôle
  // --------------------------------------------------------------------------

  /**
   * Démarre le métronome
   */
  async start() {
    if (this.playing) {return;}

    await this._initClickSynth();

    this.playing = true;
    this.currentBeat = 0;

    const beatDuration = (60 / this.tempo) * 1000; // en ms

    // Premier beat immédiat
    this._tick();

    // Beats suivants
    this._intervalId = setInterval(() => this._tick(), beatDuration);
  }

  /**
   * Arrête le métronome
   */
  stop() {
    if (!this.playing) {return;}

    this.playing = false;
    this.currentBeat = 0;

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Toggle start/stop
   *
   * @returns {Promise<boolean>} Nouvel état (true = playing)
   */
  async toggle() {
    if (this.playing) {
      this.stop();
    } else {
      await this.start();
    }
    return this.playing;
  }

  /**
   * Tick du métronome (un beat)
   * @private
   */
  _tick() {
    this.currentBeat++;

    // Reset au début de la mesure
    if (this.currentBeat > this.timeSignature.beats) {
      this.currentBeat = 1;
    }

    const isDownbeat = this.currentBeat === 1;

    // Jouer le son
    this._playClick(isDownbeat);

    // Appeler les callbacks
    this._emitBeat(this.currentBeat, isDownbeat);
  }

  /**
   * Joue le son du click
   * @private
   */
  _playClick(isDownbeat) {
    if (!this._clickSynth || this.audioEngine.muted) {return;}

    // Note plus haute pour le premier temps
    const pitch = this.accent && isDownbeat ? 'G5' : 'C5';
    const duration = '32n';

    // Garantir que le temps est strictement croissant
    const Tone = this.audioEngine.Tone;
    const now = Tone.now();
    const minTime = this._lastPlayTime + 0.05; // Au moins 50ms après le dernier
    const time = Math.max(now + 0.01, minTime);
    this._lastPlayTime = time;

    this._clickSynth.triggerAttackRelease(pitch, duration, time);
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Définit le tempo
   *
   * @param {number} bpm - Tempo en BPM (30-300)
   */
  setTempo(bpm) {
    this.tempo = Math.max(30, Math.min(300, bpm));

    // Si en lecture, redémarrer avec le nouveau tempo
    if (this.playing) {
      this.stop();
      this.start();
    }
  }

  /**
   * Définit la signature rythmique
   *
   * @param {number} beats - Nombre de temps par mesure
   * @param {number} beatValue - Valeur du temps (4 = noire, 8 = croche)
   */
  setTimeSignature(beats, beatValue) {
    this.timeSignature = { beats, beatValue };
    this.currentBeat = 0;
  }

  /**
   * Active/désactive l'accent sur le premier temps
   *
   * @param {boolean} accent
   */
  setAccent(accent) {
    this.accent = accent;
  }

  // --------------------------------------------------------------------------
  // Événements
  // --------------------------------------------------------------------------

  /**
   * Ajoute un callback sur chaque beat
   *
   * @param {Function} callback - (beat: number, isDownbeat: boolean) => void
   */
  onBeat(callback) {
    this._beatCallbacks.push(callback);
  }

  /**
   * Ajoute un callback sur le premier temps uniquement
   *
   * @param {Function} callback - () => void
   */
  onDownbeat(callback) {
    this._downbeatCallbacks.push(callback);
  }

  /**
   * Retire un callback
   *
   * @param {Function} callback
   */
  offBeat(callback) {
    const index = this._beatCallbacks.indexOf(callback);
    if (index !== -1) {
      this._beatCallbacks.splice(index, 1);
    }
  }

  /**
   * Émet l'événement de beat
   * @private
   */
  _emitBeat(beat, isDownbeat) {
    this._beatCallbacks.forEach((cb) => cb(beat, isDownbeat));

    if (isDownbeat) {
      this._downbeatCallbacks.forEach((cb) => cb());
    }
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------

  /**
   * Retourne la durée d'un beat en millisecondes
   *
   * @returns {number}
   */
  getBeatDuration() {
    return (60 / this.tempo) * 1000;
  }

  /**
   * Retourne la durée d'une mesure en millisecondes
   *
   * @returns {number}
   */
  getMeasureDuration() {
    return this.getBeatDuration() * this.timeSignature.beats;
  }

  /**
   * Nettoie et libère les ressources
   */
  dispose() {
    this.stop();

    if (this._clickSynth) {
      this._clickSynth.dispose();
      this._clickSynth = null;
    }

    this._beatCallbacks = [];
    this._downbeatCallbacks = [];
  }
}

export default Metronome;
