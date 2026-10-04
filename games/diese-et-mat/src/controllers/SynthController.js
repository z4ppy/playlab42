/**
 * SynthController - Contrôleur du panneau synthétiseur
 *
 * Gère l'interface utilisateur du panneau synthétiseur complet.
 * Utilise SynthManager pour la logique métier.
 *
 * @module controllers/SynthController
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { hidePanel, isPanelVisible, showPanel } from './panel-visibility.js';
import { SYNTH_EFFECT_SLIDERS, SYNTH_PARAM_SLIDERS } from './synth-slider-specs.js';

const toHz = (v) => `${Math.round(v)} Hz`;
const toPercent = (v) => `${Math.round(v)}%`;
const toTenths = (v) => v.toFixed(1);

/** Valeur de configuration ; une valeur absente ou nulle retombe sur le défaut. */
function configValue(config, param, fallback) {
  return config?.[param] || fallback;
}

const METAL_SLIDERS = [
  { id: 'metal-frequency', param: 'frequency', min: 50, max: 2000, fallback: 400, toDisplay: toHz },
  { id: 'metal-harmonicity', param: 'harmonicity', min: 0.5, max: 20, step: 0.1, fallback: 5.1, toDisplay: toTenths },
  { id: 'metal-modulation-index', param: 'modulationIndex', min: 1, max: 100, fallback: 32, toDisplay: (v) => Math.round(v).toString() },
  { id: 'metal-resonance', param: 'resonance', min: 100, max: 10000, fallback: 4000, toDisplay: toHz },
  { id: 'metal-octaves', param: 'octaves', min: 0.5, max: 4, step: 0.1, fallback: 1.5, toDisplay: toTenths },
];

/** Contrôles d'effets : `scale` convertit la valeur du modèle en valeur de slider. */
const EFFECT_CONTROLS = [
  ['reverb', [
    { id: 'reverb-amount', param: 'amount', min: 0, max: 100, fallback: 0.3, scale: 100, toDisplay: toPercent },
  ]],
  ['delay', [
    { id: 'delay-time', param: 'time', min: 10, max: 1000, fallback: 0.2, scale: 1000, toDisplay: (v) => `${Math.round(v)}ms` },
    { id: 'delay-feedback', param: 'feedback', min: 0, max: 90, fallback: 0.3, scale: 100, toDisplay: toPercent },
  ]],
  ['filter', [
    { id: 'filter-frequency', param: 'frequency', min: 100, max: 10000, fallback: 2000, scale: 1, toDisplay: toHz },
  ]],
];

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
    showPanel(this);
  }

  /**
   * Cache le panneau synthétiseur.
   */
  hide() {
    hidePanel(this);
  }

  /**
   * Retourne vrai si le panneau est visible.
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
    this._setupPresetSelect();
    this._setupTypeSelect();
    this._setupOscillatorButtons();
    this._setupADSRSliders();
    this._setupFMSliders();
    this._setupPluckSliders();
    this._setupMembraneSliders();
    this._setupMetalSliders();
    this._setupNoiseControls();
    this._setupEffectsControls();
    this._setupVolumeSlider();
    this._setupTestButton();

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
      ['oscillator-changed', ({ oscillator }) => this._updateOscillatorButtons(oscillator)],
      ['envelope-changed', ({ envelope }) => this._updateADSRSliders(envelope)],
      ['effect-changed', ({ effectName, config }) => this._updateEffectUI(effectName, config)],
      ['config-changed', () => this._updateAllSliders()],
    ];

    for (const [event, handler] of handlers) {
      this.synthManager.on(event, handler);
      this._cleanupHandlers.push(() => this.synthManager.off(event, handler));
    }
  }

  // --------------------------------------------------------------------------
  // Preset Select
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

    select.addEventListener('change', () => {
      this.synthManager.setPreset(select.value);
      this._updateTypedControls();
      this._updateAllSliders();
      this.emit('preset-selected', { preset: select.value });
    });
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
  // Type Select
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
      if (this.synthManager.isAudioReady) {
        this.synthManager.audioEngine.setSynthType(select.value);
      }
      this._updateTypedControls();
    });

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
  // Oscillator Buttons
  // --------------------------------------------------------------------------

  /**
   * Configure les boutons d'oscillateur.
   * @private
   */
  _setupOscillatorButtons() {
    const container = document.getElementById('synth-oscillators');
    if (!container) {return;}

    const buttons = container.querySelectorAll('.synth-osc-btn');
    const currentOsc = this.synthManager.oscillator;

    buttons.forEach((btn) => {
      const oscType = btn.dataset.osc;
      btn.classList.toggle('active', oscType === currentOsc);
      btn.setAttribute('aria-pressed', String(oscType === currentOsc));

      btn.addEventListener('click', () => {
        this.synthManager.setOscillator(oscType);
        this._updateOscillatorButtons(oscType);
        this.emit('oscillator-selected', { oscillator: oscType });
      });
    });
  }

  /**
   * Met à jour les boutons d'oscillateur.
   * @private
   *
   * @param {string} activeOsc - Oscillateur actif
   */
  _updateOscillatorButtons(activeOsc) {
    const container = document.getElementById('synth-oscillators');
    if (!container) {return;}

    container.querySelectorAll('.synth-osc-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.osc === activeOsc);
      btn.setAttribute('aria-pressed', String(btn.dataset.osc === activeOsc));
    });
  }

  // --------------------------------------------------------------------------
  // ADSR Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders ADSR.
   * @private
   */
  _setupADSRSliders() {
    const envelope = this.synthManager.envelope;

    this._setupSlider('attack', {
      min: 1,
      max: 2000,
      value: envelope.attack * 1000,
      toDisplay: (v) => `${Math.round(v)}ms`,
      onChange: (v) => this.synthManager.setEnvelope({ attack: v / 1000 }),
    });

    this._setupSlider('decay', {
      min: 10,
      max: 2000,
      value: envelope.decay * 1000,
      toDisplay: (v) => `${Math.round(v)}ms`,
      onChange: (v) => this.synthManager.setEnvelope({ decay: v / 1000 }),
    });

    this._setupSlider('sustain', {
      min: 0,
      max: 100,
      value: envelope.sustain * 100,
      toDisplay: (v) => `${Math.round(v)}%`,
      onChange: (v) => this.synthManager.setEnvelope({ sustain: v / 100 }),
    });

    this._setupSlider('release', {
      min: 10,
      max: 5000,
      value: envelope.release * 1000,
      toDisplay: (v) => `${(v / 1000).toFixed(2)}s`,
      onChange: (v) => this.synthManager.setEnvelope({ release: v / 1000 }),
    });
  }

  /**
   * Met à jour les sliders ADSR.
   * @private
   *
   * @param {Object} envelope - Valeurs ADSR
   */
  _updateADSRSliders(envelope) {
    if (!envelope) {return;}

    this._updateSliderValue('attack', envelope.attack * 1000, (v) => `${Math.round(v)}ms`);
    this._updateSliderValue('decay', envelope.decay * 1000, (v) => `${Math.round(v)}ms`);
    this._updateSliderValue('sustain', envelope.sustain * 100, (v) => `${Math.round(v)}%`);
    this._updateSliderValue('release', envelope.release * 1000, (v) => `${(v / 1000).toFixed(2)}s`);
  }

  // --------------------------------------------------------------------------
  // FM Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders FM.
   * @private
   */
  _setupFMSliders() {
    const config = this.synthManager.config;

    this._setupSlider('fm-harmonicity', {
      min: 0.5,
      max: 15,
      step: 0.1,
      value: config.fm?.harmonicity || 3,
      toDisplay: (v) => v.toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('fm', 'harmonicity', v),
    });

    this._setupSlider('fm-modulation-index', {
      min: 1,
      max: 50,
      value: config.fm?.modulationIndex || 10,
      toDisplay: (v) => Math.round(v).toString(),
      onChange: (v) => this.synthManager.setSynthParam('fm', 'modulationIndex', v),
    });
  }

  // --------------------------------------------------------------------------
  // Pluck Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders Pluck.
   * @private
   */
  _setupPluckSliders() {
    const config = this.synthManager.config;

    this._setupSlider('pluck-attack-noise', {
      min: 1,
      max: 50,
      value: (config.pluck?.attackNoise || 1.5) * 10,
      toDisplay: (v) => (v / 10).toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'attackNoise', v / 10),
    });

    this._setupSlider('pluck-dampening', {
      min: 500,
      max: 10000,
      value: config.pluck?.dampening || 3500,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'dampening', v),
    });

    this._setupSlider('pluck-resonance', {
      min: 90,
      max: 100,
      step: 0.1,
      value: (config.pluck?.resonance || 0.98) * 100,
      toDisplay: (v) => (v / 100).toFixed(2),
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'resonance', v / 100),
    });

    this._setupSlider('pluck-release', {
      min: 100,
      max: 5000,
      value: (config.pluck?.release || 2) * 1000,
      toDisplay: (v) => `${(v / 1000).toFixed(1)}s`,
      onChange: (v) => this.synthManager.setSynthParam('pluck', 'release', v / 1000),
    });
  }

  // --------------------------------------------------------------------------
  // Membrane Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders Membrane.
   * @private
   */
  _setupMembraneSliders() {
    const config = this.synthManager.config;

    this._setupSlider('membrane-pitch-decay', {
      min: 1,
      max: 200,
      value: (config.membrane?.pitchDecay || 0.05) * 1000,
      toDisplay: (v) => `${(v / 1000).toFixed(3)}s`,
      onChange: (v) => this.synthManager.setSynthParam('membrane', 'pitchDecay', v / 1000),
    });

    this._setupSlider('membrane-octaves', {
      min: 1,
      max: 12,
      value: config.membrane?.octaves || 8,
      toDisplay: (v) => Math.round(v).toString(),
      onChange: (v) => this.synthManager.setSynthParam('membrane', 'octaves', v),
    });
  }

  // --------------------------------------------------------------------------
  // Metal Sliders
  // --------------------------------------------------------------------------

  /**
   * Configure les sliders Metal.
   * @private
   */
  _setupMetalSliders() {
    const config = this.synthManager.config.metal;

    for (const spec of METAL_SLIDERS) {
      this._setupSlider(spec.id, {
        min: spec.min,
        max: spec.max,
        step: spec.step,
        value: configValue(config, spec.param, spec.fallback),
        toDisplay: spec.toDisplay,
        onChange: (v) => this.synthManager.setSynthParam('metal', spec.param, v),
      });
    }
  }

  // --------------------------------------------------------------------------
  // Noise Controls
  // --------------------------------------------------------------------------

  /**
   * Configure les contrôles Noise.
   * @private
   */
  _setupNoiseControls() {
    // Type de bruit
    const noiseType = document.getElementById('synth-noise-type');
    if (noiseType) {
      noiseType.addEventListener('change', () => {
        // Note: Le type de bruit est défini par le preset, pas modifiable directement
        // On pourrait ajouter cette fonctionnalité à l'AudioEngine si nécessaire
      });
    }

    // Filtre HP
    this._setupSlider('noise-filter-freq', {
      min: 100,
      max: 8000,
      value: 3000,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: () => {
        // Note: Le filtre noise est défini par le preset
      },
    });
  }

  // --------------------------------------------------------------------------
  // Effects Controls
  // --------------------------------------------------------------------------

  /**
   * Configure les contrôles d'effets.
   * @private
   */
  _setupEffectsControls() {
    const effects = this.synthManager.effects;

    for (const [effectName, paramSpecs] of EFFECT_CONTROLS) {
      const config = effects[effectName];
      this._setupEffectControl(effectName, {
        enabled: Boolean(config?.enabled),
        params: paramSpecs.map((spec) => ({
          id: spec.id,
          min: spec.min,
          max: spec.max,
          value: configValue(config, spec.param, spec.fallback) * spec.scale,
          toDisplay: spec.toDisplay,
          onChange: (v) => this.synthManager.setEffect(effectName, { [spec.param]: v / spec.scale }),
        })),
      });
    }
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
    const checkbox = document.getElementById(`synth-${effectName}-enabled`);
    if (checkbox) {
      checkbox.checked = config.enabled;
    }

    this._updateSliderSpecs(config, SYNTH_EFFECT_SLIDERS.get(effectName));
  }

  // --------------------------------------------------------------------------
  // Volume Slider
  // --------------------------------------------------------------------------

  /**
   * Configure le slider de volume.
   * @private
   */
  _setupVolumeSlider() {
    this._setupSlider('volume', {
      min: -60,
      max: 0,
      value: -10,
      toDisplay: (v) => `${Math.round(v)} dB`,
      onChange: (v) => this.synthManager.setVolume(v),
    });
  }

  // --------------------------------------------------------------------------
  // Test Button
  // --------------------------------------------------------------------------

  /**
   * Configure le bouton de test du son.
   * @private
   */
  _setupTestButton() {
    const btn = document.getElementById('synth-test-btn');
    if (!btn) {return;}

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await this.synthManager.playNote('C4', '8n');
      } catch (error) {
        console.error('Audio du synthétiseur indisponible:', error);
        btn.title = 'Audio indisponible : réessayez';
      } finally {
        btn.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Slider Utilities
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
  // Update All
  // --------------------------------------------------------------------------

  /**
   * Met à jour tous les sliders avec les valeurs actuelles.
   * @private
   */
  _updateAllSliders() {
    const config = this.synthManager.config;

    if (config.envelope) {
      this._updateADSRSliders(config.envelope);
    }

    for (const [section, specs] of SYNTH_PARAM_SLIDERS) {
      if (config[section]) {
        this._updateSliderSpecs(config[section], specs);
      }
    }

    if (config.effects) {
      this._updateEffects(config.effects);
    }
  }

  /**
   * Met à jour les effets présents dans la configuration.
   * @private
   *
   * @param {Object} effects - Configuration des effets
   */
  _updateEffects(effects) {
    for (const effectName of SYNTH_EFFECT_SLIDERS.keys()) {
      if (effects[effectName]) {
        this._updateEffectUI(effectName, effects[effectName]);
      }
    }
  }

  /**
   * Met à jour des curseurs depuis une section de configuration.
   * @private
   *
   * @param {Object} values - Section de configuration
   * @param {Array} [specs] - Curseurs décrits dans synth-slider-specs
   */
  _updateSliderSpecs(values, specs = []) {
    for (const { id, key, fallback, scale, toDisplay } of specs) {
      this._updateSliderValue(id, (values[key] || fallback) * scale, toDisplay);
    }
  }

  /**
   * Met à jour toute l'UI.
   * @private
   */
  _updateUI() {
    const config = this.synthManager.config;

    this._updatePresetSelect(config.preset);
    this._updateOscillatorButtons(config.oscillator);
    this._updateTypedControls();
    this._updateAllSliders();
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie et libère les ressources.
   */
  dispose() {
    for (const cleanup of this._cleanupHandlers) {
      cleanup();
    }
    this._cleanupHandlers = [];

    this._initialized = false;

    super.dispose();
  }
}

export default SynthController;
