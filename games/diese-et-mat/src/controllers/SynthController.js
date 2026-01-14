/**
 * SynthController - Contrôleur du panneau synthétiseur
 *
 * Gère l'interface utilisateur du panneau synthétiseur avancé.
 * Utilise SynthManager pour la logique métier.
 *
 * @module controllers/SynthController
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { AudioEngine } from '../audio/AudioEngine.js';

// ============================================================================
// Constantes
// ============================================================================

/** Types d'oscillateurs disponibles */
const OSCILLATOR_TYPES = ['sine', 'triangle', 'square', 'sawtooth'];

/** Descriptions des types de synthèse */
const SYNTH_TYPE_DESCRIPTIONS = {
  poly: 'Synthèse soustractive classique avec oscillateur et filtre.',
  fm: 'Synthèse FM (modulation de fréquence) pour des sons brillants et métalliques.',
  pluck: 'Modélisation physique de cordes pincées (Karplus-Strong).',
  membrane: 'Modélisation physique de membranes (percussions à peau).',
  metal: 'Modélisation physique de métaux (cymbales, cloches).',
  noise: 'Synthèse de bruit pour percussions (caisse claire).',
};

// ============================================================================
// Classe SynthController
// ============================================================================

/**
 * Contrôleur du panneau synthétiseur.
 */
export class SynthController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur de synthétiseur.
   *
   * @param {Object} elements - Références aux éléments DOM
   * @param {HTMLElement} elements.overlay - Overlay du panneau
   * @param {HTMLElement} elements.presetsContainer - Container des presets
   * @param {HTMLElement} elements.oscillatorsContainer - Container des oscillateurs
   * @param {HTMLElement} elements.typeTabs - Container des onglets de type
   * @param {HTMLElement} elements.typeInfo - Info du type sélectionné
   * @param {Object} options - Options
   * @param {SynthManager} options.synthManager - Instance du SynthManager
   */
  constructor(elements, options = {}) {
    super();

    /** @type {Object} Références aux éléments DOM */
    this.elements = elements;

    /** @type {SynthManager} Gestionnaire de synthétiseur */
    this.synthManager = options.synthManager;

    /** @type {boolean} Contrôles initialisés */
    this._initialized = false;

    /** @type {Function[]} Cleanup handlers pour les event listeners */
    this._cleanupHandlers = [];
  }

  // --------------------------------------------------------------------------
  // Cycle de vie
  // --------------------------------------------------------------------------

  /**
   * Affiche le panneau synthétiseur.
   */
  show() {
    if (this.elements.overlay) {
      this.elements.overlay.classList.add('visible');
      this._init();
    }
  }

  /**
   * Cache le panneau synthétiseur.
   */
  hide() {
    if (this.elements.overlay) {
      this.elements.overlay.classList.remove('visible');
    }
  }

  /**
   * Retourne vrai si le panneau est visible.
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
   * Initialise le contrôleur (une seule fois).
   * @private
   */
  _init() {
    if (this._initialized || !this.synthManager) {
      return;
    }

    // Écouter les événements du SynthManager
    this._setupSynthManagerListeners();

    // Initialiser l'UI
    this._renderPresets();
    this._renderOscillators();
    this._setupTypeTabs();
    this._setupADSRSliders();
    this._setupSynthTypeSliders();
    this._setupEffectsControls();

    // Mettre à jour l'UI avec la config actuelle
    this._updateUI();

    this._initialized = true;
  }

  /**
   * Configure les listeners sur le SynthManager.
   * @private
   */
  _setupSynthManagerListeners() {
    const handlers = [
      ['preset-changed', ({ preset }) => this._updatePresetButtons(preset)],
      ['oscillator-changed', ({ oscillator }) => this._updateOscillatorButtons(oscillator)],
      ['envelope-changed', ({ envelope }) => this._updateADSRSliders(envelope)],
      ['effect-changed', ({ effectName, config }) => this._updateEffectUI(effectName, config)],
      ['config-changed', () => this._updateSynthTypeSliders()],
    ];

    for (const [event, handler] of handlers) {
      this.synthManager.on(event, handler);
      this._cleanupHandlers.push(() => this.synthManager.off(event, handler));
    }
  }

  // --------------------------------------------------------------------------
  // Presets
  // --------------------------------------------------------------------------

  /**
   * Génère les boutons de presets.
   * @private
   */
  _renderPresets() {
    const container = this.elements.presetsContainer;
    if (!container) {return;}

    const presets = AudioEngine.getPresets();
    const currentPreset = this.synthManager.preset;

    container.innerHTML = '';

    for (const [key, preset] of Object.entries(presets)) {
      const btn = document.createElement('button');
      btn.className = 'synth-preset-btn';
      btn.dataset.preset = key;
      btn.textContent = preset.name;

      if (currentPreset === key) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => this._selectPreset(key));
      container.appendChild(btn);
    }
  }

  /**
   * Sélectionne un preset.
   * @private
   *
   * @param {string} presetName - Nom du preset
   */
  async _selectPreset(presetName) {
    await this.synthManager.setPreset(presetName);
    this._updateSynthSections();
    this.emit('preset-selected', { preset: presetName });
  }

  /**
   * Met à jour les boutons de presets.
   * @private
   *
   * @param {string} activePreset - Preset actif
   */
  _updatePresetButtons(activePreset) {
    const buttons = this.elements.presetsContainer?.querySelectorAll('.synth-preset-btn');
    if (!buttons) {return;}

    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === activePreset);
    });
  }

  // --------------------------------------------------------------------------
  // Oscillateurs
  // --------------------------------------------------------------------------

  /**
   * Génère les boutons d'oscillateurs.
   * @private
   */
  _renderOscillators() {
    const container = this.elements.oscillatorsContainer;
    if (!container) {return;}

    const currentOsc = this.synthManager.oscillator;

    container.innerHTML = '';

    for (const type of OSCILLATOR_TYPES) {
      const btn = document.createElement('button');
      btn.className = 'synth-osc-btn';
      btn.dataset.oscillator = type;

      // Icône de la forme d'onde
      const icon = document.createElement('span');
      icon.className = 'osc-icon';
      icon.innerHTML = this._getOscillatorIcon(type);

      const label = document.createElement('span');
      label.className = 'osc-label';
      label.textContent = this._getOscillatorLabel(type);

      btn.appendChild(icon);
      btn.appendChild(label);

      if (currentOsc === type) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => this._selectOscillator(type));
      container.appendChild(btn);
    }
  }

  /**
   * Retourne l'icône SVG d'un oscillateur.
   * @private
   *
   * @param {string} type - Type d'oscillateur
   * @returns {string} SVG
   */
  _getOscillatorIcon(type) {
    const icons = {
      sine: '<svg viewBox="0 0 24 12"><path d="M0,6 Q3,0 6,6 T12,6 T18,6 T24,6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      triangle: '<svg viewBox="0 0 24 12"><path d="M0,6 L3,0 L9,12 L15,0 L21,12 L24,6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      square: '<svg viewBox="0 0 24 12"><path d="M0,10 L0,2 L6,2 L6,10 L12,10 L12,2 L18,2 L18,10 L24,10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      sawtooth: '<svg viewBox="0 0 24 12"><path d="M0,10 L6,2 L6,10 L12,2 L12,10 L18,2 L18,10 L24,2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    };
    return icons[type] || icons.sine;
  }

  /**
   * Retourne le label d'un oscillateur.
   * @private
   *
   * @param {string} type - Type
   * @returns {string}
   */
  _getOscillatorLabel(type) {
    const labels = {
      sine: 'Sinusoïde',
      triangle: 'Triangle',
      square: 'Carré',
      sawtooth: 'Dent de scie',
    };
    return labels[type] || type;
  }

  /**
   * Sélectionne un oscillateur.
   * @private
   *
   * @param {string} type - Type d'oscillateur
   */
  async _selectOscillator(type) {
    await this.synthManager.setOscillator(type);
    this.emit('oscillator-selected', { oscillator: type });
  }

  /**
   * Met à jour les boutons d'oscillateurs.
   * @private
   *
   * @param {string} activeOsc - Oscillateur actif
   */
  _updateOscillatorButtons(activeOsc) {
    const buttons = this.elements.oscillatorsContainer?.querySelectorAll('.synth-osc-btn');
    if (!buttons) {return;}

    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.oscillator === activeOsc);
    });
  }

  // --------------------------------------------------------------------------
  // Types de synthèse
  // --------------------------------------------------------------------------

  /**
   * Configure les onglets de type de synthèse.
   * @private
   */
  _setupTypeTabs() {
    const container = this.elements.typeTabs;
    if (!container) {return;}

    container.querySelectorAll('.synth-type-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        this._selectSynthType(type);
      });
    });

    this._updateSynthSections();
  }

  /**
   * Sélectionne un type de synthèse.
   * @private
   *
   * @param {string} synthType - Type de synthèse
   */
  _selectSynthType(synthType) {
    // Mettre à jour l'onglet actif
    this.elements.typeTabs?.querySelectorAll('.synth-type-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.type === synthType);
    });

    // Mettre à jour la description
    if (this.elements.typeInfo) {
      this.elements.typeInfo.textContent = SYNTH_TYPE_DESCRIPTIONS[synthType] || '';
    }

    // Changer le type dans SynthManager
    if (this.synthManager.isAudioReady) {
      this.synthManager.audioEngine.setSynthType(synthType);
    }

    // Mettre à jour les sections visibles
    this._updateSynthSections();
  }

  /**
   * Met à jour la visibilité des sections selon le type de synthèse.
   * @private
   */
  _updateSynthSections() {
    const currentType = this.synthManager.getCurrentSynthType();

    // Mettre à jour les onglets
    this.elements.typeTabs?.querySelectorAll('.synth-type-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.type === currentType);
    });

    // Mettre à jour l'info
    if (this.elements.typeInfo) {
      this.elements.typeInfo.textContent = SYNTH_TYPE_DESCRIPTIONS[currentType] || '';
    }

    // Afficher/masquer les sections selon le type
    document.querySelectorAll('.synth-section-typed').forEach((section) => {
      const types = section.dataset.types?.split(',') || [];
      section.classList.toggle('hidden', !types.includes(currentType));
    });
  }

  // --------------------------------------------------------------------------
  // Enveloppe ADSR
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders ADSR.
   * @private
   */
  _setupADSRSliders() {
    const envelope = this.synthManager.envelope;

    // Attack (0.001 - 2s)
    this._setupSlider('attack', {
      min: 0.001,
      max: 2,
      value: envelope.attack,
      toDisplay: (v) => `${(v * 1000).toFixed(0)}ms`,
      onChange: (v) => this.synthManager.setEnvelope({ attack: v }),
    });

    // Decay (0.01 - 2s)
    this._setupSlider('decay', {
      min: 0.01,
      max: 2,
      value: envelope.decay,
      toDisplay: (v) => `${(v * 1000).toFixed(0)}ms`,
      onChange: (v) => this.synthManager.setEnvelope({ decay: v }),
    });

    // Sustain (0 - 1)
    this._setupSlider('sustain', {
      min: 0,
      max: 1,
      value: envelope.sustain,
      toDisplay: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => this.synthManager.setEnvelope({ sustain: v }),
    });

    // Release (0.01 - 5s)
    this._setupSlider('release', {
      min: 0.01,
      max: 5,
      value: envelope.release,
      toDisplay: (v) => `${v.toFixed(2)}s`,
      onChange: (v) => this.synthManager.setEnvelope({ release: v }),
    });
  }

  /**
   * Met à jour l'affichage des sliders ADSR.
   * @private
   *
   * @param {Object} envelope - Valeurs ADSR
   */
  _updateADSRSliders(envelope) {
    if (!envelope) {return;}

    this._updateSliderValue('attack', envelope.attack, (v) => `${(v * 1000).toFixed(0)}ms`);
    this._updateSliderValue('decay', envelope.decay, (v) => `${(v * 1000).toFixed(0)}ms`);
    this._updateSliderValue('sustain', envelope.sustain, (v) => `${Math.round(v * 100)}%`);
    this._updateSliderValue('release', envelope.release, (v) => `${v.toFixed(2)}s`);
  }

  // --------------------------------------------------------------------------
  // Paramètres des types de synthèse
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders des types de synthèse.
   * @private
   */
  _setupSynthTypeSliders() {
    const config = this.synthManager.config;

    // FM
    this._setupSlider('fm-harmonicity', {
      min: 1,
      max: 10,
      step: 0.1,
      value: config.fm?.harmonicity || 3,
      toDisplay: (v) => v.toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('fm', 'harmonicity', v),
    });

    this._setupSlider('fm-modulation-index', {
      min: 1,
      max: 30,
      value: config.fm?.modulationIndex || 10,
      toDisplay: (v) => Math.round(v).toString(),
      onChange: (v) => this.synthManager.setSynthParam('fm', 'modulationIndex', v),
    });

    // Pluck
    this._setupSlider('pluck-attack-noise', {
      min: 1,
      max: 50,
      value: (config.pluck?.attackNoise || 1) * 10,
      toDisplay: (v) => (v / 10).toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'attackNoise', v / 10),
    });

    this._setupSlider('pluck-resonance', {
      min: 80,
      max: 99,
      value: (config.pluck?.resonance || 0.96) * 100,
      toDisplay: (v) => (v / 100).toFixed(2),
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'resonance', v / 100),
    });

    this._setupSlider('pluck-dampening', {
      min: 1000,
      max: 8000,
      value: config.pluck?.dampening || 4000,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'dampening', v),
    });

    // Membrane
    this._setupSlider('membrane-pitch-decay', {
      min: 1,
      max: 100,
      value: (config.membrane?.pitchDecay || 0.02) * 1000,
      toDisplay: (v) => `${(v / 1000).toFixed(2)}s`,
      onChange: (v) => this.synthManager.setSynthParam('membrane', 'pitchDecay', v / 1000),
    });

    this._setupSlider('membrane-octaves', {
      min: 1,
      max: 8,
      value: config.membrane?.octaves || 4,
      toDisplay: (v) => Math.round(v).toString(),
      onChange: (v) => this.synthManager.setSynthParam('membrane', 'octaves', v),
    });

    // Metal
    this._setupSlider('metal-frequency', {
      min: 100,
      max: 1000,
      value: config.metal?.frequency || 200,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: (v) => this.synthManager.setSynthParam('metal', 'frequency', v),
    });

    this._setupSlider('metal-harmonicity', {
      min: 1,
      max: 10,
      step: 0.1,
      value: config.metal?.harmonicity || 5,
      toDisplay: (v) => v.toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('metal', 'harmonicity', v),
    });
  }

  /**
   * Met à jour les sliders des types de synthèse.
   * @private
   */
  _updateSynthTypeSliders() {
    const config = this.synthManager.config;

    // FM
    this._updateSliderValue('fm-harmonicity', config.fm?.harmonicity || 3, (v) => v.toFixed(1));
    this._updateSliderValue('fm-modulation-index', config.fm?.modulationIndex || 10, (v) => Math.round(v).toString());

    // Pluck
    this._updateSliderValue('pluck-attack-noise', (config.pluck?.attackNoise || 1) * 10, (v) => (v / 10).toFixed(1));
    this._updateSliderValue('pluck-resonance', (config.pluck?.resonance || 0.96) * 100, (v) => (v / 100).toFixed(2));
    this._updateSliderValue('pluck-dampening', config.pluck?.dampening || 4000, (v) => `${Math.round(v)} Hz`);

    // Membrane
    this._updateSliderValue('membrane-pitch-decay', (config.membrane?.pitchDecay || 0.02) * 1000, (v) => `${(v / 1000).toFixed(2)}s`);
    this._updateSliderValue('membrane-octaves', config.membrane?.octaves || 4, (v) => Math.round(v).toString());

    // Metal
    this._updateSliderValue('metal-frequency', config.metal?.frequency || 200, (v) => `${Math.round(v)} Hz`);
    this._updateSliderValue('metal-harmonicity', config.metal?.harmonicity || 5, (v) => v.toFixed(1));
  }

  // --------------------------------------------------------------------------
  // Effets
  // --------------------------------------------------------------------------

  /**
   * Configure les contrôles d'effets.
   * @private
   */
  _setupEffectsControls() {
    const effects = this.synthManager.effects;

    // Reverb
    this._setupEffectControl('reverb', {
      enabled: effects.reverb.enabled,
      params: [
        {
          id: 'reverb-amount',
          min: 0,
          max: 1,
          value: effects.reverb.amount,
          toDisplay: (v) => `${Math.round(v * 100)}%`,
          onChange: (v) => this.synthManager.setEffect('reverb', { amount: v }),
        },
      ],
    });

    // Delay
    this._setupEffectControl('delay', {
      enabled: effects.delay.enabled,
      params: [
        {
          id: 'delay-time',
          min: 0.05,
          max: 1,
          value: effects.delay.time,
          toDisplay: (v) => `${(v * 1000).toFixed(0)}ms`,
          onChange: (v) => this.synthManager.setEffect('delay', { time: v }),
        },
        {
          id: 'delay-feedback',
          min: 0,
          max: 0.9,
          value: effects.delay.feedback,
          toDisplay: (v) => `${Math.round(v * 100)}%`,
          onChange: (v) => this.synthManager.setEffect('delay', { feedback: v }),
        },
      ],
    });

    // Filter
    this._setupEffectControl('filter', {
      enabled: effects.filter.enabled,
      params: [
        {
          id: 'filter-frequency',
          min: 100,
          max: 10000,
          value: effects.filter.frequency,
          toDisplay: (v) => `${Math.round(v)} Hz`,
          onChange: (v) => this.synthManager.setEffect('filter', { frequency: v }),
        },
      ],
    });
  }

  /**
   * Configure un contrôle d'effet.
   * @private
   *
   * @param {string} effectName - Nom de l'effet
   * @param {Object} config - Configuration
   */
  _setupEffectControl(effectName, config) {
    // Checkbox enable/disable
    const checkbox = document.getElementById(`synth-${effectName}-enabled`);
    if (checkbox) {
      checkbox.checked = config.enabled;
      checkbox.addEventListener('change', () => {
        this.synthManager.toggleEffect(effectName, checkbox.checked);
      });
    }

    // Sliders des paramètres
    for (const param of config.params) {
      this._setupSlider(param.id, param);
    }
  }

  /**
   * Met à jour l'UI d'un effet.
   * @private
   *
   * @param {string} effectName - Nom de l'effet
   * @param {Object} config - Configuration
   */
  _updateEffectUI(effectName, config) {
    // Checkbox
    const checkbox = document.getElementById(`synth-${effectName}-enabled`);
    if (checkbox) {
      checkbox.checked = config.enabled;
    }

    // Paramètres selon l'effet
    switch (effectName) {
      case 'reverb':
        this._updateSliderValue('reverb-amount', config.amount, (v) => `${Math.round(v * 100)}%`);
        break;
      case 'delay':
        this._updateSliderValue('delay-time', config.time, (v) => `${(v * 1000).toFixed(0)}ms`);
        this._updateSliderValue('delay-feedback', config.feedback, (v) => `${Math.round(v * 100)}%`);
        break;
      case 'filter':
        this._updateSliderValue('filter-frequency', config.frequency, (v) => `${Math.round(v)} Hz`);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Utilitaires Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure un slider.
   * @private
   *
   * @param {string} id - ID du slider (sans préfixe synth-)
   * @param {Object} config - Configuration
   */
  _setupSlider(id, config) {
    const slider = document.getElementById(`synth-${id}`);
    const valueEl = document.getElementById(`synth-${id}-value`);

    if (!slider) {return;}

    slider.min = config.min;
    slider.max = config.max;
    if (config.step) {slider.step = config.step;}
    slider.value = config.value;

    if (valueEl && config.toDisplay) {
      valueEl.textContent = config.toDisplay(parseFloat(slider.value));
    }

    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      if (valueEl && config.toDisplay) {
        valueEl.textContent = config.toDisplay(value);
      }
      config.onChange?.(value);
    });
  }

  /**
   * Met à jour la valeur d'un slider.
   * @private
   *
   * @param {string} id - ID du slider
   * @param {number} value - Valeur
   * @param {Function} toDisplay - Fonction de formatage
   */
  _updateSliderValue(id, value, toDisplay) {
    const slider = document.getElementById(`synth-${id}`);
    const valueEl = document.getElementById(`synth-${id}-value`);

    if (slider) {
      slider.value = value;
    }
    if (valueEl && toDisplay) {
      valueEl.textContent = toDisplay(value);
    }
  }

  // --------------------------------------------------------------------------
  // Mise à jour globale
  // --------------------------------------------------------------------------

  /**
   * Met à jour toute l'UI.
   * @private
   */
  _updateUI() {
    const config = this.synthManager.config;

    this._updatePresetButtons(config.preset);
    this._updateOscillatorButtons(config.oscillator);
    this._updateADSRSliders(config.envelope);
    this._updateSynthSections();
    this._updateSynthTypeSliders();

    // Effets
    for (const effectName of ['reverb', 'delay', 'filter']) {
      this._updateEffectUI(effectName, config.effects[effectName]);
    }
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie et libère les ressources.
   */
  dispose() {
    // Exécuter les handlers de cleanup
    for (const cleanup of this._cleanupHandlers) {
      cleanup();
    }
    this._cleanupHandlers = [];

    this._initialized = false;

    super.dispose();
  }
}

export default SynthController;
