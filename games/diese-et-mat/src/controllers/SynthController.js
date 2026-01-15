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

/* Note: Les types d'oscillateurs et de synthèse sont définis dans les select HTML */

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

    // Initialiser l'UI (avec les nouveaux select dropdowns)
    this._setupPresetSelect();
    this._setupTypeSelect();
    this._setupOscillatorSelect();
    this._setupCompactEffects();
    this._setupTestButton();
    this._setupADSRSliders();
    this._setupSynthTypeSliders();

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
      ['preset-changed', ({ preset }) => this._updatePresetSelect(preset)],
      ['oscillator-changed', ({ oscillator }) => this._updateOscillatorSelect(oscillator)],
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
  // Presets (select dropdown)
  // --------------------------------------------------------------------------

  /**
   * Configure le select des presets avec optgroups par catégorie.
   * @private
   */
  _setupPresetSelect() {
    const select = document.getElementById('synth-preset-select');
    if (!select) {return;}

    const presets = AudioEngine.getPresets();
    const currentPreset = this.synthManager.preset;

    // Catégories de presets
    const categories = {
      'Claviers': ['piano', 'electricPiano', 'organ'],
      'Guitares': ['guitarClassic', 'guitarFolk', 'guitarElectric'],
      'Synthés': ['synthLead', 'retro8bit', 'bell'],
      'Percussions': ['percKick', 'percSnare', 'percTom', 'percWood', 'percHihat', 'percCymbal'],
    };

    select.innerHTML = '';

    for (const [categoryName, presetKeys] of Object.entries(categories)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = categoryName;

      for (const key of presetKeys) {
        if (presets[key]) {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = presets[key].name;
          if (key === currentPreset) {
            option.selected = true;
          }
          optgroup.appendChild(option);
        }
      }

      select.appendChild(optgroup);
    }

    // Listener
    select.addEventListener('change', () => {
      this._selectPreset(select.value);
    });
  }

  /**
   * Sélectionne un preset.
   * @private
   *
   * @param {string} presetName - Nom du preset
   */
  async _selectPreset(presetName) {
    await this.synthManager.setPreset(presetName);
    this._updateTypedControls();
    this.emit('preset-selected', { preset: presetName });
  }

  /**
   * Met à jour le select des presets.
   * @private
   *
   * @param {string} activePreset - Preset actif
   */
  _updatePresetSelect(activePreset) {
    const select = document.getElementById('synth-preset-select');
    if (select) {
      select.value = activePreset;
    }
  }

  // --------------------------------------------------------------------------
  // Type de synthèse (select dropdown)
  // --------------------------------------------------------------------------

  /**
   * Configure le select du type de synthèse.
   * @private
   */
  _setupTypeSelect() {
    const select = document.getElementById('synth-type-select');
    if (!select) {return;}

    const currentType = this.synthManager.getCurrentSynthType();
    select.value = currentType;

    select.addEventListener('change', () => {
      this._selectSynthType(select.value);
    });

    // Mise à jour initiale des contrôles typés
    this._updateTypedControls();
  }

  /**
   * Sélectionne un type de synthèse.
   * @private
   *
   * @param {string} synthType - Type de synthèse
   */
  _selectSynthType(synthType) {
    // Changer le type dans SynthManager
    if (this.synthManager.isAudioReady) {
      this.synthManager.audioEngine.setSynthType(synthType);
    }

    // Mettre à jour les contrôles visibles
    this._updateTypedControls();
  }

  /**
   * Met à jour la visibilité des contrôles selon le type de synthèse.
   * @private
   */
  _updateTypedControls() {
    const currentType = this.synthManager.getCurrentSynthType();

    // Mettre à jour le select type
    const typeSelect = document.getElementById('synth-type-select');
    if (typeSelect) {
      typeSelect.value = currentType;
    }

    // Afficher/masquer les contrôles selon le type
    document.querySelectorAll('.synth-typed-control').forEach((control) => {
      const types = control.dataset.types?.split(',') || [];
      control.classList.toggle('visible', types.includes(currentType));
    });
  }

  // --------------------------------------------------------------------------
  // Oscillateur (select dropdown - poly uniquement)
  // --------------------------------------------------------------------------

  /**
   * Configure le select de l'oscillateur.
   * @private
   */
  _setupOscillatorSelect() {
    const select = document.getElementById('synth-osc-select');
    if (!select) {return;}

    const currentOsc = this.synthManager.oscillator;
    select.value = currentOsc;

    select.addEventListener('change', () => {
      this._selectOscillator(select.value);
    });
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
   * Met à jour le select d'oscillateur.
   * @private
   *
   * @param {string} activeOsc - Oscillateur actif
   */
  _updateOscillatorSelect(activeOsc) {
    const select = document.getElementById('synth-osc-select');
    if (select) {
      select.value = activeOsc;
    }
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
  // Effets compacts (toolbar)
  // --------------------------------------------------------------------------

  /**
   * Configure les contrôles d'effets compacts de la toolbar.
   * @private
   */
  _setupCompactEffects() {
    const effects = this.synthManager.effects;

    // Reverb
    this._setupCompactEffect('reverb', {
      enabled: effects.reverb?.enabled || false,
      slider: {
        id: 'synth-fx-reverb-amount',
        min: 0,
        max: 100,
        value: (effects.reverb?.amount || 0.3) * 100,
        onChange: (v) => this.synthManager.setEffect('reverb', { amount: v / 100 }),
      },
    });

    // Delay
    this._setupCompactEffect('delay', {
      enabled: effects.delay?.enabled || false,
      slider: {
        id: 'synth-fx-delay-time',
        min: 10,
        max: 1000,
        value: (effects.delay?.time || 0.2) * 1000,
        onChange: (v) => this.synthManager.setEffect('delay', { time: v / 1000 }),
      },
    });

    // Filter
    this._setupCompactEffect('filter', {
      enabled: effects.filter?.enabled || false,
      slider: {
        id: 'synth-fx-filter-freq',
        min: 100,
        max: 10000,
        value: effects.filter?.frequency || 2000,
        onChange: (v) => this.synthManager.setEffect('filter', { frequency: v }),
      },
    });
  }

  /**
   * Configure un effet compact.
   * @private
   *
   * @param {string} effectName - Nom de l'effet
   * @param {Object} config - Configuration
   */
  _setupCompactEffect(effectName, config) {
    // Checkbox
    const checkbox = document.getElementById(`synth-fx-${effectName}`);
    const slider = document.getElementById(config.slider.id);

    if (checkbox) {
      checkbox.checked = config.enabled;

      // Activer/désactiver le slider selon la checkbox
      if (slider) {
        slider.disabled = !config.enabled;
      }

      checkbox.addEventListener('change', () => {
        this.synthManager.toggleEffect(effectName, checkbox.checked);
        if (slider) {
          slider.disabled = !checkbox.checked;
        }
      });
    }

    // Slider
    if (slider) {
      slider.min = config.slider.min;
      slider.max = config.slider.max;
      slider.value = config.slider.value;

      slider.addEventListener('input', () => {
        config.slider.onChange(parseFloat(slider.value));
      });
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
    const checkbox = document.getElementById(`synth-fx-${effectName}`);
    if (checkbox) {
      checkbox.checked = config.enabled;
    }

    // Slider selon l'effet
    switch (effectName) {
      case 'reverb': {
        const slider = document.getElementById('synth-fx-reverb-amount');
        if (slider) {
          slider.value = (config.amount || 0.3) * 100;
          slider.disabled = !config.enabled;
        }
        break;
      }
      case 'delay': {
        const slider = document.getElementById('synth-fx-delay-time');
        if (slider) {
          slider.value = (config.time || 0.2) * 1000;
          slider.disabled = !config.enabled;
        }
        break;
      }
      case 'filter': {
        const slider = document.getElementById('synth-fx-filter-freq');
        if (slider) {
          slider.value = config.frequency || 2000;
          slider.disabled = !config.enabled;
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Bouton test
  // --------------------------------------------------------------------------

  /**
   * Configure le bouton de test du son.
   * @private
   */
  _setupTestButton() {
    const btn = document.getElementById('synth-test-btn');
    if (!btn) {return;}

    btn.addEventListener('click', () => {
      this._testSynthSound();
    });
  }

  /**
   * Joue un son de test.
   * @private
   */
  _testSynthSound() {
    if (this.synthManager.isAudioReady) {
      // Jouer un Do4 pendant 0.5s
      this.synthManager.audioEngine.playNote('C4', '8n');
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

    this._updatePresetSelect(config.preset);
    this._updateOscillatorSelect(config.oscillator);
    this._updateADSRSliders(config.envelope);
    this._updateTypedControls();
    this._updateSynthTypeSliders();

    // Effets
    for (const effectName of ['reverb', 'delay', 'filter']) {
      if (config.effects && config.effects[effectName]) {
        this._updateEffectUI(effectName, config.effects[effectName]);
      }
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
