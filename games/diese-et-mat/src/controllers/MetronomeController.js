/**
 * MetronomeController - Contrôleur du panel métronome
 *
 * Gère l'interface utilisateur du métronome standalone.
 *
 * @module controllers/MetronomeController
 */

import EventEmitter from '../utils/EventEmitter.js';
import { Metronome } from '../audio/Metronome.js';

// ============================================================================
// Classe MetronomeController
// ============================================================================

/**
 * Contrôleur du panel métronome.
 * Gère l'UI et expose l'instance Metronome pour usage externe (mode rythme).
 */
export class MetronomeController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur de métronome.
   *
   * @param {Object} elements - Références aux éléments DOM
   * @param {HTMLElement} elements.overlay - Overlay du métronome
   * @param {HTMLElement} elements.bpmValue - Affichage du BPM
   * @param {HTMLElement} elements.beats - Container des indicateurs de beats
   * @param {HTMLElement} elements.tempoSlider - Slider de tempo
   * @param {HTMLElement} elements.timeSignature - Sélecteur de signature rythmique
   * @param {HTMLElement} elements.playBtn - Bouton play/stop
   * @param {Object} options - Options
   * @param {Function} options.getAudioEngine - Fonction retournant l'AudioEngine
   * @param {Function} options.ensureAudioReady - Fonction pour s'assurer que l'audio est prêt
   */
  constructor(elements, options = {}) {
    super();

    /** @type {Object} Références aux éléments DOM */
    this.elements = elements;

    /** @type {Function} Getter pour l'AudioEngine */
    this._getAudioEngine = options.getAudioEngine || (() => null);

    /** @type {Function} S'assurer que l'audio est prêt */
    this._ensureAudioReady = options.ensureAudioReady || (async () => {});

    /** @type {boolean} Panel initialisé */
    this._initialized = false;

    /** @type {Metronome|null} Instance du métronome */
    this._metronome = null;
  }

  // --------------------------------------------------------------------------
  // Accesseur
  // --------------------------------------------------------------------------

  /**
   * Retourne l'instance du métronome.
   * Crée une instance si nécessaire.
   *
   * @returns {Metronome|null}
   */
  get metronome() {
    return this._metronome;
  }

  /**
   * Retourne vrai si le métronome est en cours de lecture.
   *
   * @returns {boolean}
   */
  get playing() {
    return this._metronome?.playing || false;
  }

  // --------------------------------------------------------------------------
  // Cycle de vie
  // --------------------------------------------------------------------------

  /**
   * Affiche le panel métronome.
   */
  show() {
    if (this.elements.overlay) {
      this.elements.overlay.classList.add('visible');
      this._init();
    }
  }

  /**
   * Cache le panel métronome.
   */
  hide() {
    if (this.elements.overlay) {
      this.elements.overlay.classList.remove('visible');
    }
    // Arrêter le métronome si actif
    this._stop();
  }

  /**
   * Retourne vrai si le panel est visible.
   *
   * @returns {boolean}
   */
  isVisible() {
    return this.elements.overlay?.classList.contains('visible') || false;
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le panel (une seule fois).
   * @private
   */
  _init() {
    if (this._initialized) {
      return;
    }

    // Créer le métronome si nécessaire
    this._createMetronome();

    // Configurer le callback sur les beats
    if (this._metronome) {
      this._metronome.onBeat((beat, isDownbeat) => {
        this._updateBeatIndicator(beat, isDownbeat);
      });
    }

    // Slider tempo
    this.elements.tempoSlider?.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value, 10);
      this.setTempo(bpm);
    });

    // Boutons -10, -1, +1, +10
    document.getElementById('metronome-minus-10')?.addEventListener('click', () => {
      this._adjustTempo(-10);
    });
    document.getElementById('metronome-minus-1')?.addEventListener('click', () => {
      this._adjustTempo(-1);
    });
    document.getElementById('metronome-plus-1')?.addEventListener('click', () => {
      this._adjustTempo(1);
    });
    document.getElementById('metronome-plus-10')?.addEventListener('click', () => {
      this._adjustTempo(10);
    });

    // Signature rythmique
    this.elements.timeSignature?.addEventListener('change', (e) => {
      const [beats] = e.target.value.split('/').map(Number);
      this.setTimeSignature(beats);
    });

    // Bouton play/stop
    this.elements.playBtn?.addEventListener('click', () => {
      this.toggle();
    });

    this._initialized = true;
  }

  /**
   * Crée l'instance du métronome si elle n'existe pas.
   * @private
   */
  _createMetronome() {
    if (this._metronome) {
      return;
    }

    const audioEngine = this._getAudioEngine();
    if (audioEngine) {
      this._metronome = new Metronome(audioEngine);
    }
  }

  /**
   * Assure que le métronome est prêt (crée si nécessaire).
   *
   * @returns {Promise<Metronome|null>}
   */
  async ensureReady() {
    if (this._metronome) {
      return this._metronome;
    }

    await this._ensureAudioReady();
    this._createMetronome();

    if (this._metronome) {
      this._metronome.onBeat((beat, isDownbeat) => {
        this._updateBeatIndicator(beat, isDownbeat);
      });
    }

    return this._metronome;
  }

  // --------------------------------------------------------------------------
  // Contrôle
  // --------------------------------------------------------------------------

  /**
   * Démarre le métronome.
   */
  async start() {
    if (!this._metronome) {
      await this.ensureReady();
    }

    if (this._metronome) {
      await this._metronome.start();
      this._updateUI(true);
      this.emit('start');
    }
  }

  /**
   * Arrête le métronome.
   */
  stop() {
    this._stop();
    this.emit('stop');
  }

  /**
   * Arrête le métronome et met à jour l'UI.
   * @private
   */
  _stop() {
    if (this._metronome && this._metronome.playing) {
      this._metronome.stop();
      this._updateUI(false);
    }
  }

  /**
   * Toggle start/stop.
   *
   * @returns {Promise<boolean>} Nouvel état (true = playing)
   */
  async toggle() {
    if (!this._metronome) {
      await this.ensureReady();
    }

    if (this._metronome) {
      const isPlaying = await this._metronome.toggle();
      this._updateUI(isPlaying);
      this.emit(isPlaying ? 'start' : 'stop');
      return isPlaying;
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Définit le tempo.
   *
   * @param {number} bpm - Tempo en BPM (30-300)
   */
  setTempo(bpm) {
    bpm = Math.max(30, Math.min(300, bpm));

    // Mettre à jour l'affichage
    if (this.elements.bpmValue) {
      this.elements.bpmValue.textContent = bpm;
    }
    if (this.elements.tempoSlider) {
      this.elements.tempoSlider.value = bpm;
    }

    // Mettre à jour le métronome
    if (this._metronome) {
      this._metronome.setTempo(bpm);
    }

    this.emit('tempoChange', bpm);
  }

  /**
   * Ajuste le tempo relativement.
   * @private
   *
   * @param {number} delta - Variation en BPM
   */
  _adjustTempo(delta) {
    const currentBpm = this._metronome?.tempo || 120;
    this.setTempo(currentBpm + delta);
  }

  /**
   * Définit la signature rythmique.
   *
   * @param {number} beats - Nombre de temps par mesure
   */
  setTimeSignature(beats) {
    if (this._metronome) {
      this._metronome.setTimeSignature(beats, 4);
    }

    // Mettre à jour les indicateurs visuels
    const container = this.elements.beats;
    if (container) {
      container.innerHTML = '';
      for (let i = 1; i <= beats; i++) {
        const beat = document.createElement('div');
        beat.className = 'metronome-beat';
        beat.dataset.beat = i;
        container.appendChild(beat);
      }
    }

    this.emit('timeSignatureChange', beats);
  }

  // --------------------------------------------------------------------------
  // Mise à jour de l'UI
  // --------------------------------------------------------------------------

  /**
   * Met à jour l'UI selon l'état de lecture.
   * @private
   *
   * @param {boolean} isPlaying - État de lecture
   */
  _updateUI(isPlaying) {
    const btn = this.elements.playBtn;
    if (btn) {
      btn.classList.toggle('playing', isPlaying);
      const icon = btn.querySelector('.metronome-play-icon');
      const text = btn.querySelector('.metronome-play-text');
      if (icon) {
        icon.textContent = isPlaying ? '⏹' : '▶';
      }
      if (text) {
        text.textContent = isPlaying ? 'Arrêter' : 'Démarrer';
      }
    }

    // Reset les indicateurs visuels si on arrête
    if (!isPlaying) {
      this.elements.beats?.querySelectorAll('.metronome-beat').forEach((b) => {
        b.classList.remove('active', 'downbeat');
      });
    }
  }

  /**
   * Met à jour l'indicateur visuel des beats.
   * @private
   *
   * @param {number} beat - Beat courant
   * @param {boolean} isDownbeat - Premier temps
   */
  _updateBeatIndicator(beat, isDownbeat) {
    const beats = this.elements.beats?.querySelectorAll('.metronome-beat');
    if (!beats) {
      return;
    }

    beats.forEach((b, i) => {
      const isCurrent = i + 1 === beat;
      b.classList.toggle('active', isCurrent);
      b.classList.toggle('downbeat', isCurrent && isDownbeat);
    });
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie et libère les ressources.
   */
  dispose() {
    this._stop();

    if (this._metronome) {
      this._metronome.dispose();
      this._metronome = null;
    }

    super.dispose();
  }
}

export default MetronomeController;
