/**
 * AudioEngine - Wrapper Tone.js pour la synthèse audio
 *
 * Gère la synthèse audio pour jouer des notes, accords et séquences.
 * Inclut des presets d'instruments, contrôle d'oscillateur, enveloppe ADSR
 * et effets (reverb, delay, filter).
 *
 * @module audio/AudioEngine
 */

import { EventEmitter } from '../utils/EventEmitter.js';

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
 * synthType: 'poly', 'pluck', 'membrane', 'metal', 'noise'
 * hasOscillator: true si l'oscillateur est configurable (pour l'UI)
 */
const SYNTH_PRESETS = {
  // === Claviers ===
  piano: {
    name: 'Piano',
    synthType: 'poly',
    hasOscillator: true,
    // Triangle avec harmoniques pour un son plus riche
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.005, decay: 1.5, sustain: 0.3, release: 2 },
  },
  electricPiano: {
    name: 'Piano Élec.',
    synthType: 'fm',
    hasOscillator: false,
    // Rhodes classique : harmonicity ~3, modulationIndex modéré
    fm: { harmonicity: 3.01, modulationIndex: 4 },
    envelope: { attack: 0.001, decay: 0.8, sustain: 0.15, release: 1.5 },
    // modulationEnvelope avec decay court pour l'attaque caractéristique
    fmModEnv: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
  },
  organ: {
    name: 'Orgue',
    synthType: 'poly',
    hasOscillator: true,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.01, sustain: 0.9, release: 0.3 },
  },

  // === Guitares ===
  guitarClassic: {
    name: 'Guitare Class.',
    synthType: 'pluck',
    hasOscillator: false,
    // Paramètres optimaux : dampening moyen, haute résonance pour sustain
    pluck: { attackNoise: 1.5, dampening: 3500, resonance: 0.98, release: 2 },
  },
  guitarFolk: {
    name: 'Guitare Folk',
    synthType: 'pluck',
    hasOscillator: false,
    // Plus brillant et percussif
    pluck: { attackNoise: 2.5, dampening: 4500, resonance: 0.97, release: 1.5 },
  },
  guitarElectric: {
    name: 'Guitare Élec.',
    synthType: 'pluck',
    hasOscillator: false,
    // Très brillant avec long sustain + distortion
    pluck: { attackNoise: 3, dampening: 6000, resonance: 0.995, release: 3 },
    effects: { distortion: 0.4 },
  },

  // === Synthés ===
  synthLead: {
    name: 'Synth Lead',
    synthType: 'poly',
    hasOscillator: true,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
  },
  retro8bit: {
    name: '8-bit',
    synthType: 'poly',
    hasOscillator: true,
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.4, release: 0.2 },
  },
  bell: {
    name: 'Cloche',
    synthType: 'fm',
    hasOscillator: false,
    // FM pour les harmoniques de cloche
    fm: { harmonicity: 5.5, modulationIndex: 8 },
    envelope: { attack: 0.001, decay: 1.5, sustain: 0.1, release: 2 },
  },

  // === Percussions ===
  percKick: {
    name: 'Grosse caisse',
    synthType: 'membrane',
    hasOscillator: false,
    // 808 style : pitchDecay modéré, octaves élevé pour le punch
    membrane: { pitchDecay: 0.05, octaves: 8, oscillator: { type: 'sine' } },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
  },
  percSnare: {
    name: 'Caisse claire',
    synthType: 'noise',
    hasOscillator: false,
    // Snare = bruit blanc filtré + corps membrane
    noise: { type: 'white', filterFreq: 3000 },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.03 },
  },
  percTom: {
    name: 'Tom',
    synthType: 'membrane',
    hasOscillator: false,
    membrane: { pitchDecay: 0.03, octaves: 4, oscillator: { type: 'sine' } },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
  },
  percWood: {
    name: 'Wood Block',
    synthType: 'membrane',
    hasOscillator: false,
    membrane: { pitchDecay: 0.008, octaves: 2, oscillator: { type: 'sine' } },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  },
  percHihat: {
    name: 'Hi-Hat',
    synthType: 'metal',
    hasOscillator: false,
    // Court decay = fermé
    metal: { frequency: 400, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
  },
  percCymbal: {
    name: 'Cymbale',
    synthType: 'metal',
    hasOscillator: false,
    // Plus d'harmoniques et long decay
    metal: { frequency: 300, harmonicity: 12, modulationIndex: 20, resonance: 800, octaves: 1.5 },
    envelope: { attack: 0.001, decay: 1.5, release: 0.3 },
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
 *
 * @fires AudioEngine#ready - Quand Tone.js est chargé
 * @fires AudioEngine#started - Quand le contexte audio est démarré
 * @fires AudioEngine#noteStart - Quand une note commence
 * @fires AudioEngine#noteEnd - Quand une note se termine
 * @fires AudioEngine#settingsChange - Quand les paramètres changent
 */
export class AudioEngine extends EventEmitter {
  /**
   * Crée une nouvelle instance du moteur audio
   *
   * @param {Object} options - Options
   * @param {number} options.volume - Volume initial (-60 à 0 dB)
   */
  constructor(options = {}) {
    super();
    /** @type {Object|null} Module Tone.js */
    this.Tone = null;

    /** @type {Object|null} Synthétiseur polyphonique partagé (piano + synthé) */
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

    /** @type {string} Type de synthèse actuel */
    this.synthType = 'poly';

    /** @type {Object} Paramètres FM */
    this.fmParams = { harmonicity: 3, modulationIndex: 10 };

    /** @type {Object} Paramètres Pluck */
    this.pluckParams = { attackNoise: 1.5, dampening: 3500, resonance: 0.98, release: 2 };

    /** @type {Object} Paramètres Membrane */
    this.membraneParams = { pitchDecay: 0.05, octaves: 8 };

    /** @type {Object} Paramètres Metal */
    this.metalParams = { frequency: 200, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 };

    /** @type {Object} Configuration des effets */
    this.effectsConfig = structuredClone(DEFAULT_EFFECTS);

    /** @type {Object} Instances des effets Tone.js */
    this.effects = {
      reverb: null,
      delay: null,
      filter: null,
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
      this.emit('ready');
    } catch (error) {
      console.error('Erreur lors du chargement de Tone.js:', error);
      throw new Error('Impossible de charger Tone.js', { cause: error });
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
      this.emit('started');
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
   * Supporte : poly, fm, pluck, membrane, metal
   * @private
   */
  _createSynth() {
    const Tone = this.Tone;
    const preset = SYNTH_PRESETS[this.currentPreset] || SYNTH_PRESETS.piano;

    // Relâcher et disposer l'ancien synth si existant
    if (this.synth) {
      if (this.synth.releaseAll) {
        this.synth.releaseAll();
      }
      this.synth.dispose();
    }

    // Disposer la distortion si existante
    if (this.distortion) {
      this.distortion.dispose();
      this.distortion = null;
    }

    // Disposer le noiseFilter si existant
    if (this.noiseFilter) {
      this.noiseFilter.dispose();
      this.noiseFilter = null;
    }

    // Créer le synthétiseur selon le type (utilise les paramètres de l'instance)
    switch (this.synthType) {
      case 'pluck':
        // PluckSynth pour les guitares (Karplus-Strong)
        this.synth = new Tone.PluckSynth({
          attackNoise: this.pluckParams.attackNoise,
          dampening: this.pluckParams.dampening,
          resonance: this.pluckParams.resonance,
          release: this.pluckParams.release,
        });
        // Ajouter distortion pour guitare électrique
        if (preset.effects?.distortion) {
          this.distortion = new Tone.Distortion(preset.effects.distortion);
        }
        break;

      case 'fm':
        // FMSynth pour piano électrique et cloches
        this.synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: this.fmParams.harmonicity,
          modulationIndex: this.fmParams.modulationIndex,
          oscillator: { type: 'sine' },
          envelope: this.envelope,
          modulation: { type: 'sine' },
          // modulationEnvelope avec decay court pour l'attaque caractéristique Rhodes
          modulationEnvelope: preset.fmModEnv || { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
        });
        break;

      case 'membrane':
        // MembraneSynth pour percussions à peau (kick, tom, wood block)
        this.synth = new Tone.MembraneSynth({
          pitchDecay: this.membraneParams.pitchDecay,
          octaves: this.membraneParams.octaves,
          oscillator: { type: 'sine' },
          envelope: this.envelope,
        });
        break;

      case 'metal':
        // MetalSynth pour percussions métalliques (hi-hat, cymbale)
        this.synth = new Tone.MetalSynth({
          frequency: this.metalParams.frequency,
          harmonicity: this.metalParams.harmonicity,
          modulationIndex: this.metalParams.modulationIndex,
          resonance: this.metalParams.resonance,
          octaves: this.metalParams.octaves,
          envelope: this.envelope,
        });
        break;

      case 'noise':
        // NoiseSynth pour snare/caisse claire
        this.synth = new Tone.NoiseSynth({
          noise: { type: preset.noise?.type || 'white' },
          envelope: this.envelope,
        });
        // Filtre passe-haut pour le snare
        if (preset.noise?.filterFreq) {
          this.noiseFilter = new Tone.Filter({
            frequency: preset.noise.filterFreq,
            type: 'highpass',
          });
        }
        break;

      case 'poly':
      default:
        // PolySynth standard
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: this.oscillatorType },
          envelope: { ...this.envelope },
        });

        // Ajouter distortion si spécifié
        if (preset.effects?.distortion) {
          this.distortion = new Tone.Distortion(preset.effects.distortion);
        }
        break;
    }

    // Appliquer le volume
    this.synth.volume.value = this.volume;

    // Connecter à la chaîne d'effets
    this._connectSynthToEffects();
  }

  /**
   * Connecte le synthétiseur à la chaîne d'effets
   * @private
   */
  _connectSynthToEffects() {
    if (!this.synth) {return;}

    // Déconnecter d'abord
    this.synth.disconnect();
    if (this.distortion) {
      this.distortion.disconnect();
    }
    if (this.noiseFilter) {
      this.noiseFilter.disconnect();
    }

    // Déterminer le premier noeud de la chaîne d'effets
    let firstNode;
    if (this.effects.filter && this.effectsConfig.filter.enabled) {
      firstNode = this.effects.filter;
    } else if (this.effects.delay) {
      firstNode = this.effects.delay;
    }

    // Construire la chaîne : synth -> [noiseFilter] -> [distortion] -> effets -> destination
    let currentNode = this.synth;

    // Filtre pour le noise (snare)
    if (this.noiseFilter) {
      currentNode.connect(this.noiseFilter);
      currentNode = this.noiseFilter;
    }

    // Distortion
    if (this.distortion) {
      currentNode.connect(this.distortion);
      currentNode = this.distortion;
    }

    // Connexion finale
    if (firstNode) {
      currentNode.connect(firstNode);
    } else {
      currentNode.toDestination();
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
    this.synthType = preset.synthType || 'poly';

    // Mettre à jour oscillateur et enveloppe seulement pour les presets poly
    if (preset.synthType === 'poly' || !preset.synthType) {
      this.oscillatorType = preset.oscillator?.type || 'triangle';
    }

    // Copier l'enveloppe si présente
    if (preset.envelope) {
      this.envelope = { ...preset.envelope };
    }

    // Copier les paramètres spécifiques selon le type
    if (preset.fm) {
      this.fmParams = { ...this.fmParams, ...preset.fm };
    }
    if (preset.pluck) {
      this.pluckParams = { ...this.pluckParams, ...preset.pluck };
    }
    if (preset.membrane) {
      this.membraneParams = { ...this.membraneParams, ...preset.membrane };
    }
    if (preset.metal) {
      this.metalParams = { ...this.metalParams, ...preset.metal };
    }

    // Recréer le synthétiseur si déjà démarré
    if (this.started) {
      this._createSynth();
    }

    this.emit('settingsChange', this.getSettings());
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

    this.emit('settingsChange', this.getSettings());
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

    this.emit('settingsChange', this.getSettings());
  }

  /**
   * Change le type de synthèse
   *
   * @param {string} type - Type de synthèse (poly, fm, pluck, membrane, metal)
   */
  setSynthType(type) {
    const validTypes = ['poly', 'fm', 'pluck', 'membrane', 'metal', 'noise'];
    if (!validTypes.includes(type)) {
      console.warn('Type de synthèse inconnu:', type);
      return;
    }

    this.synthType = type;
    this.currentPreset = 'custom';

    // Recréer le synthétiseur si déjà démarré
    if (this.started) {
      this._createSynth();
    }

    this.emit('settingsChange', this.getSettings());
  }

  /**
   * Modifie un paramètre spécifique d'un type de synthèse
   *
   * @param {string} synthType - Type de synthèse (fm, pluck, membrane, metal)
   * @param {string} param - Nom du paramètre
   * @param {number} value - Valeur du paramètre
   */
  setSynthParam(synthType, param, value) {
    // Mettre à jour les paramètres stockés
    switch (synthType) {
      case 'fm':
        if (param in this.fmParams) {
          this.fmParams[param] = value;
        }
        break;
      case 'pluck':
        if (param in this.pluckParams) {
          this.pluckParams[param] = value;
        }
        break;
      case 'membrane':
        if (param in this.membraneParams) {
          this.membraneParams[param] = value;
        }
        break;
      case 'metal':
        if (param in this.metalParams) {
          this.metalParams[param] = value;
        }
        break;
      default:
        console.warn('Type de synthèse inconnu:', synthType);
        return;
    }

    this.currentPreset = 'custom';

    // Appliquer les changements en temps réel si le synth existe et correspond au type
    if (this.synth && this.synthType === synthType) {
      this._applySynthParam(param, value);
    }

    this.emit('settingsChange', this.getSettings());
  }

  /**
   * Applique un paramètre au synthétiseur en temps réel
   * @private
   */
  _applySynthParam(param, value) {
    if (!this.synth) {return;}

    try {
      switch (this.synthType) {
        case 'fm':
          if (param === 'harmonicity') {
            this.synth.set({ harmonicity: value });
          } else if (param === 'modulationIndex') {
            this.synth.set({ modulationIndex: value });
          }
          break;
        case 'pluck':
          if (param === 'dampening') {
            this.synth.dampening = value;
          } else if (param === 'resonance') {
            this.synth.resonance = value;
          } else if (param === 'attackNoise') {
            this.synth.attackNoise = value;
          }
          break;
        case 'membrane':
          if (param === 'pitchDecay') {
            this.synth.pitchDecay = value;
          } else if (param === 'octaves') {
            this.synth.octaves = value;
          }
          break;
        case 'metal':
          if (param === 'frequency') {
            this.synth.frequency.value = value;
          } else if (param === 'harmonicity') {
            this.synth.harmonicity.value = value;
          }
          break;
      }
    } catch (e) {
      // Certains paramètres peuvent ne pas être modifiables en temps réel
      console.debug('Paramètre non modifiable en temps réel:', param, e);
    }
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

    this.emit('settingsChange', this.getSettings());
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

    this.emit('settingsChange', this.getSettings());
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

    this.emit('settingsChange', this.getSettings());
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
      synthType: this.synthType,
      oscillator: this.oscillatorType,
      envelope: { ...this.envelope },
      fm: { ...this.fmParams },
      pluck: { ...this.pluckParams },
      membrane: { ...this.membraneParams },
      metal: { ...this.metalParams },
      effects: structuredClone(this.effectsConfig),
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
      if (settings.synthType) {
        this.synthType = settings.synthType;
      }
      if (settings.oscillator) {
        this.oscillatorType = settings.oscillator;
      }
      if (settings.envelope) {
        this.envelope = { ...settings.envelope };
      }
      this.currentPreset = 'custom';
    }

    // Appliquer les paramètres spécifiques par type
    if (settings.fm) {
      this.fmParams = { ...this.fmParams, ...settings.fm };
    }
    if (settings.pluck) {
      this.pluckParams = { ...this.pluckParams, ...settings.pluck };
    }
    if (settings.membrane) {
      this.membraneParams = { ...this.membraneParams, ...settings.membrane };
    }
    if (settings.metal) {
      this.metalParams = { ...this.metalParams, ...settings.metal };
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

    const dur = typeof duration === 'number' ? duration : duration;

    // NoiseSynth n'utilise pas de pitch
    if (this.synthType === 'noise') {
      this.emit('noteStart', { note: 'noise', duration: dur });
      this.synth.triggerAttackRelease(dur, time);
      const durMs = typeof duration === 'number' ? duration * 1000 : 500;
      setTimeout(() => {
        this.emit('noteEnd', { note: 'noise' });
      }, durMs);
      return;
    }

    const note = typeof pitch === 'string' ? pitch : pitch.toTone();

    this.emit('noteStart', { note, duration: dur });

    this.synth.triggerAttackRelease(note, dur, time);

    // Émettre la fin de note après la durée
    const durMs = typeof duration === 'number' ? duration * 1000 : 500;
    setTimeout(() => {
      this.emit('noteEnd', { note });
    }, durMs);
  }

  /**
   * Démarre une note (sustain prolongé jusqu'à noteOff)
   *
   * @param {import('../core/Pitch.js').Pitch|string} pitch - Note à jouer
   * @param {number} time - Temps de départ (optionnel)
   */
  noteOn(pitch, time) {
    if (!this.started || this.muted || !this.synth) {
      return;
    }

    const note = typeof pitch === 'string' ? pitch : pitch.toTone();

    // NoiseSynth n'utilise pas de pitch
    if (this.synthType === 'noise') {
      this.synth.triggerAttackRelease('16n', time);
      this.emit('noteStart', { note: 'noise' });
      return;
    }

    // Les synths monophoniques (pluck, membrane, metal) n'ont pas de sustain
    // On utilise triggerAttackRelease avec une durée courte
    if (this.synthType === 'pluck' || this.synthType === 'membrane' || this.synthType === 'metal') {
      const dur = this.synthType === 'metal' ? 0.1 : 0.5;
      this.synth.triggerAttackRelease(note, dur, time);
    } else {
      // PolySynth et FMSynth supportent triggerAttack
      this.synth.triggerAttack(note, time);
    }

    this.emit('noteStart', { note });
  }

  /**
   * Arrête une note (release)
   *
   * @param {import('../core/Pitch.js').Pitch|string} pitch - Note à arrêter
   * @param {number} time - Temps de release (optionnel)
   */
  noteOff(pitch, time) {
    if (!this.started || !this.synth) {
      return;
    }

    const note = typeof pitch === 'string' ? pitch : pitch.toTone();

    // Seulement pour les synths qui supportent triggerRelease
    if (this.synthType === 'poly' || this.synthType === 'fm') {
      this.synth.triggerRelease(note, time);
    }

    this.emit('noteEnd', { note });
  }

  /**
   * Joue une note depuis le clavier piano (utilise le synthé partagé)
   *
   * @param {import('../core/Pitch.js').Pitch|string} pitch - Note à jouer
   * @param {number|string} duration - Durée (en secondes ou notation "4n", "8n", etc.)
   * @param {number} time - Temps de départ (optionnel)
   */
  playPianoNote(pitch, duration = DEFAULT_NOTE_DURATION, time) {
    // Utilise le synthé partagé
    this.playNote(pitch, duration, time);
  }

  /**
   * Joue un accord depuis le clavier piano (utilise le synthé partagé)
   *
   * @param {Array<import('../core/Pitch.js').Pitch|string>} pitches - Notes de l'accord
   * @param {number|string} duration - Durée
   * @param {number} time - Temps de départ
   */
  playPianoChord(pitches, duration = DEFAULT_NOTE_DURATION, time) {
    // Utilise le synthé partagé
    this.playChord(pitches, duration, time);
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

    this.emit('noteStart', { notes, duration });

    this.synth.triggerAttackRelease(notes, duration, time);

    const durMs = typeof duration === 'number' ? duration * 1000 : 500;
    setTimeout(() => {
      this.emit('noteEnd', { notes });
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

    this.emit('settingsChange', this.getSettings());
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
    if (this.synth && this.synth.releaseAll) {
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

    // Nettoyer les listeners EventEmitter
    super.dispose();
  }
}

export default AudioEngine;
