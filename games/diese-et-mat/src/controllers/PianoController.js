/**
 * PianoController - Contrôleur du clavier piano virtuel
 *
 * Gère l'interface du piano et utilise SynthManager pour l'audio.
 *
 * @module controllers/PianoController
 */

import EventEmitter from '../utils/EventEmitter.js';
import { hidePanel, isPanelVisible, showPanel } from './panel-visibility.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { listenWithCleanup } from './emitter-listeners.js';
import { populatePresetSelect } from './preset-select.js';

// ============================================================================
// Constantes
// ============================================================================

/** Notes du clavier sur 2 octaves avec mapping AZERTY */
const KEYBOARD_LAYOUT = [
  { noteOffset: 0, isBlack: false, label: 'Q' },   // C
  { noteOffset: 1, isBlack: true, label: '2' },    // C#
  { noteOffset: 2, isBlack: false, label: 'S' },   // D
  { noteOffset: 3, isBlack: true, label: '3' },    // D#
  { noteOffset: 4, isBlack: false, label: 'D' },   // E
  { noteOffset: 5, isBlack: false, label: 'F' },   // F
  { noteOffset: 6, isBlack: true, label: '5' },    // F#
  { noteOffset: 7, isBlack: false, label: 'G' },   // G
  { noteOffset: 8, isBlack: true, label: '6' },    // G#
  { noteOffset: 9, isBlack: false, label: 'H' },   // A
  { noteOffset: 10, isBlack: true, label: '7' },   // A#
  { noteOffset: 11, isBlack: false, label: 'J' },  // B
  { noteOffset: 12, isBlack: false, label: 'K' },  // C+1
  { noteOffset: 13, isBlack: true, label: '9' },   // C#+1
  { noteOffset: 14, isBlack: false, label: 'L' },  // D+1
  { noteOffset: 15, isBlack: true, label: '0' },   // D#+1
  { noteOffset: 16, isBlack: false, label: 'M' },  // E+1
  { noteOffset: 17, isBlack: false, label: 'W' },  // F+1
  { noteOffset: 18, isBlack: true, label: '' },    // F#+1
  { noteOffset: 19, isBlack: false, label: 'X' },  // G+1
  { noteOffset: 20, isBlack: true, label: '' },    // G#+1
  { noteOffset: 21, isBlack: false, label: 'C' },  // A+1
  { noteOffset: 22, isBlack: true, label: '' },    // A#+1
  { noteOffset: 23, isBlack: false, label: 'V' },  // B+1
];

/** Noms des notes en anglais */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Map anglais -> français */
const NOTE_FRENCH = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** Icônes pour chaque preset */
const PRESET_ICONS = {
  piano: '🎹',
  electricPiano: '⚡',
  organ: '🎵',
  guitarClassic: '🎸',
  guitarFolk: '🪕',
  guitarElectric: '🎸',
  synthLead: '🎛️',
  retro8bit: '👾',
  bell: '🔔',
  percKick: '🥁',
  percSnare: '🥁',
  percTom: '🪘',
  percWood: '🪵',
  percHihat: '🔔',
  percCymbal: '🥏',
};

// ============================================================================
// Classe PianoController
// ============================================================================

/**
 * Contrôleur du clavier piano virtuel.
 */
export class PianoController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur de piano.
   *
   * @param {Object} elements - Références aux éléments DOM
   * @param {HTMLElement} elements.overlay - Overlay du piano
   * @param {HTMLElement} elements.keyboard - Container du clavier
   * @param {HTMLElement} elements.noteDisplay - Affichage de la note
   * @param {HTMLElement} elements.presetsContainer - Container des presets
   * @param {Object} options - Options
   * @param {SynthManager} options.synthManager - Instance du SynthManager
   */
  constructor(elements, options = {}) {
    super();

    /** @type {Object} Références aux éléments DOM */
    this.elements = elements;

    /** @type {SynthManager} Gestionnaire de synthétiseur */
    this.synthManager = options.synthManager;

    /** @type {boolean} Panel initialisé */
    this._initialized = false;

    /** @type {boolean} Clavier initialisé */
    this._keyboardInitialized = false;

    /** @type {boolean} Contrôles initialisés */
    this._controlsInitialized = false;

    /** @type {number} Octave de base */
    this._baseOctave = 4;

    /** @type {Object} Mapping touche clavier -> note */
    this._keyMap = {};

    /** @type {Function[]} Cleanup handlers pour les event listeners */
    this._cleanupHandlers = [];
    this._noteRequests = new Map();
  }

  // --------------------------------------------------------------------------
  // Accesseurs
  // --------------------------------------------------------------------------

  /**
   * Retourne le mapping clavier -> note.
   * @returns {Object}
   */
  get keyMap() {
    return this._keyMap;
  }

  /**
   * Retourne l'octave de base.
   * @returns {number}
   */
  get baseOctave() {
    return this._baseOctave;
  }

  // --------------------------------------------------------------------------
  // Cycle de vie
  // --------------------------------------------------------------------------

  /**
   * Affiche le panel piano.
   */
  show() {
    showPanel(this);
  }

  /**
   * Cache le panel piano.
   */
  hide() {
    hidePanel(this);
    // Arrêter toutes les notes actives
    this.stopAllNotes();
  }

  /**
   * Retourne vrai si le panel est visible.
   *
   * @returns {boolean}
   */
  isVisible() {
    return isPanelVisible(this);
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le panel (une seule fois).
   * @private
   */
  _init() {
    if (this._initialized || !this.synthManager) {
      return;
    }

    // Écouter les événements du SynthManager
    this._setupSynthManagerListeners();

    // Initialiser l'UI
    this._initKeyboard();
    this._initControls();

    this._initialized = true;
  }

  /**
   * Configure les listeners sur le SynthManager.
   * @private
   */
  _setupSynthManagerListeners() {
    const handlers = [
      ['preset-changed', ({ preset }) => this._updatePresetUI(preset)],
      ['effect-changed', () => this._syncEffectsUI()],
    ];

    listenWithCleanup(this.synthManager, handlers, this._cleanupHandlers);
  }

  /**
   * Initialise le clavier piano.
   * @private
   */
  _initKeyboard() {
    if (this._keyboardInitialized || !this.elements.keyboard) {
      return;
    }

    this._buildKeyboard();
    this._keyboardInitialized = true;
  }

  /**
   * Construit le clavier HTML.
   * @private
   */
  _buildKeyboard() {
    const container = this.elements.keyboard;
    container.innerHTML = '';
    this._keyMap = {};

    const notes = this._generateNotes();

    notes.forEach((n, index) => {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `piano-key piano-key-${n.isBlack ? 'black' : 'white'}`;
      key.dataset.note = n.note;
      key.setAttribute('aria-label', `Jouer ${this._noteToFrench(n.note)}${n.label ? `, raccourci ${n.label}` : ''}`);
      key.setAttribute('aria-pressed', 'false');

      // Position des touches noires
      if (n.isBlack) {
        const blackKeyOffsets = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];
        const blackIndex = notes.slice(0, index + 1).filter((x) => x.isBlack).length - 1;
        if (blackIndex < blackKeyOffsets.length) {
          key.style.left = `${8 + blackKeyOffsets[blackIndex] * 40 + 6}px`;
        }
      }

      // Label
      if (n.label) {
        const label = document.createElement('span');
        label.className = 'piano-key-label';
        label.textContent = n.label;
        key.appendChild(label);

        // Mapping clavier
        this._keyMap[n.label.toLowerCase()] = n.note;
      }

      // Events - Sustain prolongé
      key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.playNote(n.note, key);
      });

      key.addEventListener('mouseup', () => {
        this.stopNote(n.note, key);
      });

      key.addEventListener('mouseleave', () => {
        this.stopNote(n.note, key);
      });

      key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.playNote(n.note, key);
      });

      key.addEventListener('touchend', () => {
        this.stopNote(n.note, key);
      });
      key.addEventListener('touchcancel', () => this.stopNote(n.note, key));

      key.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {return;}
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) {this.playNote(n.note, key);}
      });
      key.addEventListener('keyup', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {return;}
        event.preventDefault();
        event.stopPropagation();
        this.stopNote(n.note, key);
      });
      key.addEventListener('blur', () => this.stopNote(n.note, key));
      key.addEventListener('click', (event) => {
        if (event.detail === 0) {
          this.playNote(n.note, key).then(() => this.stopNote(n.note, key));
        }
      });

      container.appendChild(key);
    });
  }

  /**
   * Génère les notes pour l'octave courante.
   * @private
   * @returns {Array}
   */
  _generateNotes() {
    return KEYBOARD_LAYOUT.map((key) => {
      const octave = this._baseOctave + Math.floor(key.noteOffset / 12);
      const noteIndex = key.noteOffset % 12;
      const noteName = NOTE_NAMES[noteIndex];
      return {
        note: `${noteName}${octave}`,
        isBlack: key.isBlack,
        label: key.label,
      };
    });
  }

  /**
   * Initialise les contrôles (presets, octave).
   * @private
   */
  _initControls() {
    if (this._controlsInitialized) {
      return;
    }

    this._renderPresets();
    this._initOctaveControls();
    this._initEffects();

    this._controlsInitialized = true;
  }

  /**
   * Génère le select dropdown des presets.
   * @private
   */
  _renderPresets() {
    const select = document.getElementById('piano-instrument-select');
    if (!select) {
      return;
    }

    const presets = AudioEngine.getPresets();
    const currentPreset = this.synthManager?.preset || 'piano';

    populatePresetSelect(select, presets, currentPreset,
      (preset, key) => `${PRESET_ICONS[key] || '🎵'} ${preset.name}`);

    // Event handler pour le changement de preset
    select.addEventListener('change', () => {
      this.synthManager?.setPreset(select.value);
    });
  }

  /**
   * Initialise les contrôles d'octave.
   * @private
   */
  _initOctaveControls() {
    const octaveDown = document.getElementById('piano-octave-down');
    const octaveUp = document.getElementById('piano-octave-up');
    const octaveValue = document.getElementById('piano-octave-value');

    if (!octaveDown || !octaveUp || !octaveValue) {
      return;
    }

    octaveDown.addEventListener('click', () => {
      if (this._baseOctave > 1) {
        this._baseOctave--;
        octaveValue.textContent = this._baseOctave;
        this._rebuildKeyboard();
      }
    });

    octaveUp.addEventListener('click', () => {
      if (this._baseOctave < 6) {
        this._baseOctave++;
        octaveValue.textContent = this._baseOctave;
        this._rebuildKeyboard();
      }
    });
  }

  /**
   * Initialise les contrôles d'effets.
   * @private
   */
  _initEffects() {
    const effects = this.synthManager?.effects || {
      reverb: { enabled: false, amount: 0.3 },
      delay: { enabled: false, time: 0.2, feedback: 0.3 },
      filter: { enabled: false, frequency: 2000 },
    };

    // Reverb
    this._setupEffectControl('reverb', {
      checkbox: document.getElementById('piano-fx-reverb'),
      slider: document.getElementById('piano-fx-reverb-amount'),
      config: effects.reverb,
      sliderValue: effects.reverb.amount * 100,
      sliderParam: 'amount',
      sliderScale: 100,
    });

    // Delay
    this._setupEffectControl('delay', {
      checkbox: document.getElementById('piano-fx-delay'),
      slider: document.getElementById('piano-fx-delay-time'),
      config: effects.delay,
      sliderValue: effects.delay.time * 1000,
      sliderParam: 'time',
      sliderScale: 1000,
    });

    // Filter
    this._setupEffectControl('filter', {
      checkbox: document.getElementById('piano-fx-filter'),
      slider: document.getElementById('piano-fx-filter-freq'),
      config: effects.filter,
      sliderValue: effects.filter.frequency,
      sliderParam: 'frequency',
      sliderScale: 1,
    });
  }

  /**
   * Configure un contrôle d'effet.
   * @private
   *
   * @param {string} effectName - Nom de l'effet
   * @param {Object} config - Configuration du contrôle
   */
  _setupEffectControl(effectName, { checkbox, slider, config, sliderValue, sliderParam, sliderScale }) {
    if (checkbox) {
      checkbox.checked = config.enabled;

      checkbox.addEventListener('change', () => {
        if (slider) {
          slider.disabled = !checkbox.checked;
        }
        this.synthManager?.setEffect(effectName, { enabled: checkbox.checked });
      });
    }

    if (slider) {
      slider.value = sliderValue;
      slider.disabled = !config.enabled;

      slider.addEventListener('input', () => {
        const value = parseFloat(slider.value) / sliderScale;
        this.synthManager?.setEffect(effectName, { [sliderParam]: value });
      });
    }
  }

  /**
   * Reconstruit le clavier avec la nouvelle octave.
   * @private
   */
  _rebuildKeyboard() {
    this._keyboardInitialized = false;
    this._buildKeyboard();
    this._keyboardInitialized = true;
  }

  // --------------------------------------------------------------------------
  // Contrôle des notes
  // --------------------------------------------------------------------------

  /**
   * Joue une note.
   *
   * @param {string} note - Note au format Tone.js (ex: "C4")
   * @param {HTMLElement} [keyElement] - Élément de la touche
   */
  async playNote(note, keyElement) {
    if (this._noteRequests.has(note)) {return;}
    const request = {};
    this._noteRequests.set(note, request);
    // Feedback visuel
    if (keyElement) {
      keyElement.classList.add('active');
      keyElement.setAttribute('aria-pressed', 'true');
    }

    // Afficher la note
    if (this.elements.noteDisplay) {
      this.elements.noteDisplay.textContent = this._noteToFrench(note);
    }

    // Jouer via SynthManager
    try {
      await this.synthManager?.noteOn(note);
      if (this._noteRequests.get(note) !== request) {return;}
    } catch (error) {
      if (this._noteRequests.get(note) !== request) {return;}
      console.error('Erreur lecture audio du piano:', error);
      if (this.elements.noteDisplay) {
        const message = error instanceof Error ? error.message : String(error);
        this.elements.noteDisplay.textContent = `Audio indisponible : ${message}`;
      }
      return;
    }
    this.emit('note-on', { note });
  }

  /**
   * Arrête une note.
   *
   * @param {string} note - Note au format Tone.js
   * @param {HTMLElement} [keyElement] - Élément de la touche
   */
  stopNote(note, keyElement) {
    this._noteRequests.delete(note);
    // Feedback visuel
    if (keyElement) {
      keyElement.classList.remove('active');
      keyElement.setAttribute('aria-pressed', 'false');
    }

    // Arrêter via SynthManager
    this.synthManager?.noteOff(note);
    this.emit('note-off', { note });
  }

  /**
   * Arrête toutes les notes actives.
   */
  stopAllNotes() {
    this._noteRequests.clear();
    this.synthManager?.stopAllNotes();

    // Reset visuellement
    this.elements.keyboard?.querySelectorAll('.piano-key.active').forEach((key) => {
      key.classList.remove('active');
      key.setAttribute('aria-pressed', 'false');
    });
  }

  /**
   * Joue une note via la touche clavier.
   *
   * @param {string} key - Touche clavier (minuscule)
   */
  handleKeyDown(key) {
    const note = this._keyMap[key];
    if (note) {
      const keyElement = this.elements.keyboard?.querySelector(`[data-note="${note}"]`);
      this.playNote(note, keyElement);
    }
  }

  /**
   * Arrête une note via la touche clavier.
   *
   * @param {string} key - Touche clavier (minuscule)
   */
  handleKeyUp(key) {
    const note = this._keyMap[key];
    if (note) {
      const keyElement = this.elements.keyboard?.querySelector(`[data-note="${note}"]`);
      this.stopNote(note, keyElement);
    }
  }

  // --------------------------------------------------------------------------
  // Synchronisation UI
  // --------------------------------------------------------------------------

  /**
   * Synchronise l'UI des effets avec la config actuelle.
   * @private
   */
  _syncEffectsUI() {
    const effects = this.synthManager?.effects;
    if (!effects) {
      return;
    }

    // Reverb
    this._updateEffectUI('reverb', {
      checkbox: document.getElementById('piano-fx-reverb'),
      slider: document.getElementById('piano-fx-reverb-amount'),
      config: effects.reverb,
      sliderValue: effects.reverb.amount * 100,
    });

    // Delay
    this._updateEffectUI('delay', {
      checkbox: document.getElementById('piano-fx-delay'),
      slider: document.getElementById('piano-fx-delay-time'),
      config: effects.delay,
      sliderValue: effects.delay.time * 1000,
    });

    // Filter
    this._updateEffectUI('filter', {
      checkbox: document.getElementById('piano-fx-filter'),
      slider: document.getElementById('piano-fx-filter-freq'),
      config: effects.filter,
      sliderValue: effects.filter.frequency,
    });
  }

  /**
   * Met à jour l'UI d'un effet.
   * @private
   *
   * @param {string} effectName - Nom de l'effet
   * @param {Object} config - Configuration
   */
  _updateEffectUI(effectName, { checkbox, slider, config, sliderValue }) {
    if (checkbox) {
      checkbox.checked = config.enabled;
    }
    if (slider) {
      slider.value = sliderValue;
      slider.disabled = !config.enabled;
    }
  }

  /**
   * Met à jour le preset actif dans l'UI.
   * @private
   *
   * @param {string} preset - Nom du preset
   */
  _updatePresetUI(preset) {
    const select = document.getElementById('piano-instrument-select');
    if (select && select.value !== preset) {
      select.value = preset;
    }
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------

  /**
   * Convertit une note en français.
   * @private
   *
   * @param {string} note - Note au format "C4", "C#4"
   * @returns {string}
   */
  _noteToFrench(note) {
    const match = note.match(/^([A-G])(#?)(\d)$/);
    if (!match) {
      return note;
    }

    const [, letter, sharp, octave] = match;
    const frenchNote = NOTE_FRENCH[letter] || letter;
    const sharpSymbol = sharp ? '♯' : '';
    return `${frenchNote}${sharpSymbol}${octave}`;
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie et libère les ressources.
   */
  dispose() {
    // Arrêter toutes les notes
    this.stopAllNotes();

    // Exécuter les handlers de cleanup
    for (const cleanup of this._cleanupHandlers) {
      cleanup();
    }
    this._cleanupHandlers = [];

    this._initialized = false;
    this._keyboardInitialized = false;
    this._controlsInitialized = false;

    super.dispose();
  }
}

export default PianoController;
