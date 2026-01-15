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
    const config = this.synthManager.config;

    this._setupSlider('metal-frequency', {
      min: 50,
      max: 2000,
      value: config.metal?.frequency || 400,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: (v) => this.synthManager.setSynthParam('metal', 'frequency', v),
    });

    this._setupSlider('metal-harmonicity', {
      min: 0.5,
      max: 20,
      step: 0.1,
      value: config.metal?.harmonicity || 5.1,
      toDisplay: (v) => v.toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('metal', 'harmonicity', v),
    });

    this._setupSlider('metal-modulation-index', {
      min: 1,
      max: 100,
      value: config.metal?.modulationIndex || 32,
      toDisplay: (v) => Math.round(v).toString(),
      onChange: (v) => this.synthManager.setSynthParam('metal', 'modulationIndex', v),
    });

    this._setupSlider('metal-resonance', {
      min: 100,
      max: 10000,
      value: config.metal?.resonance || 4000,
      toDisplay: (v) => `${Math.round(v)} Hz`,
      onChange: (v) => this.synthManager.setSynthParam('metal', 'resonance', v),
    });

    this._setupSlider('metal-octaves', {
      min: 0.5,
      max: 4,
      step: 0.1,
      value: config.metal?.octaves || 1.5,
      toDisplay: (v) => v.toFixed(1),
      onChange: (v) => this.synthManager.setSynthParam('metal', 'octaves', v),
    });
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

    // Reverb
    this._setupEffectControl('reverb', {
      enabled: effects.reverb?.enabled || false,
      params: [
        {
          id: 'reverb-amount',
          min: 0,
          max: 100,
          value: (effects.reverb?.amount || 0.3) * 100,
          toDisplay: (v) => `${Math.round(v)}%`,
          onChange: (v) => this.synthManager.setEffect('reverb', { amount: v / 100 }),
        },
      ],
    });

    // Delay
    this._setupEffectControl('delay', {
      enabled: effects.delay?.enabled || false,
      params: [
        {
          id: 'delay-time',
          min: 10,
          max: 1000,
          value: (effects.delay?.time || 0.2) * 1000,
          toDisplay: (v) => `${Math.round(v)}ms`,
          onChange: (v) => this.synthManager.setEffect('delay', { time: v / 1000 }),
        },
        {
          id: 'delay-feedback',
          min: 0,
          max: 90,
          value: (effects.delay?.feedback || 0.3) * 100,
          toDisplay: (v) => `${Math.round(v)}%`,
          onChange: (v) => this.synthManager.setEffect('delay', { feedback: v / 100 }),
        },
      ],
    });

    // Filter
    this._setupEffectControl('filter', {
      enabled: effects.filter?.enabled || false,
      params: [
        {
          id: 'filter-frequency',
          min: 100,
          max: 10000,
          value: effects.filter?.frequency || 2000,
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
    const checkbox = document.getElementById(`synth-${effectName}-enabled`);
    if (checkbox) {
      checkbox.checked = config.enabled;
    }

    switch (effectName) {
      case 'reverb':
        this._updateSliderValue('reverb-amount', (config.amount || 0.3) * 100, (v) => `${Math.round(v)}%`);
        break;
      case 'delay':
        this._updateSliderValue('delay-time', (config.time || 0.2) * 1000, (v) => `${Math.round(v)}ms`);
        this._updateSliderValue('delay-feedback', (config.feedback || 0.3) * 100, (v) => `${Math.round(v)}%`);
        break;
      case 'filter':
        this._updateSliderValue('filter-frequency', config.frequency || 2000, (v) => `${Math.round(v)} Hz`);
        break;
    }
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
      await this.synthManager.ensureAudioReady();
      if (this.synthManager.isAudioReady) {
        this.synthManager.audioEngine.playNote('C4', '8n');
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

    // ADSR
    if (config.envelope) {
      this._updateADSRSliders(config.envelope);
    }

    // FM
    if (config.fm) {
      this._updateSliderValue('fm-harmonicity', config.fm.harmonicity || 3, (v) => v.toFixed(1));
      this._updateSliderValue('fm-modulation-index', config.fm.modulationIndex || 10, (v) => Math.round(v).toString());
    }

    // Pluck
    if (config.pluck) {
      this._updateSliderValue('pluck-attack-noise', (config.pluck.attackNoise || 1.5) * 10, (v) => (v / 10).toFixed(1));
      this._updateSliderValue('pluck-dampening', config.pluck.dampening || 3500, (v) => `${Math.round(v)} Hz`);
      this._updateSliderValue('pluck-resonance', (config.pluck.resonance || 0.98) * 100, (v) => (v / 100).toFixed(2));
      this._updateSliderValue('pluck-release', (config.pluck.release || 2) * 1000, (v) => `${(v / 1000).toFixed(1)}s`);
    }

    // Membrane
    if (config.membrane) {
      this._updateSliderValue('membrane-pitch-decay', (config.membrane.pitchDecay || 0.05) * 1000, (v) => `${(v / 1000).toFixed(3)}s`);
      this._updateSliderValue('membrane-octaves', config.membrane.octaves || 8, (v) => Math.round(v).toString());
    }

    // Metal
    if (config.metal) {
      this._updateSliderValue('metal-frequency', config.metal.frequency || 400, (v) => `${Math.round(v)} Hz`);
      this._updateSliderValue('metal-harmonicity', config.metal.harmonicity || 5.1, (v) => v.toFixed(1));
      this._updateSliderValue('metal-modulation-index', config.metal.modulationIndex || 32, (v) => Math.round(v).toString());
      this._updateSliderValue('metal-resonance', config.metal.resonance || 4000, (v) => `${Math.round(v)} Hz`);
      this._updateSliderValue('metal-octaves', config.metal.octaves || 1.5, (v) => v.toFixed(1));
    }

    // Effects
    if (config.effects) {
      for (const effectName of ['reverb', 'delay', 'filter']) {
        if (config.effects[effectName]) {
          this._updateEffectUI(effectName, config.effects[effectName]);
        }
      }
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
