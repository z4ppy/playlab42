/**
 * Diese & Mat - Orchestrateur principal de l'application
 *
 * Gère la navigation entre les vues, l'état global et le cycle de vie.
 * Les gabarits HTML, les boutons de réponse et les règles de déblocage vivent
 * dans les modules privés `app-*` ; App conserve l'état et l'ordre des effets.
 *
 * @module App
 */

import { ExerciseEngine } from './engine/ExerciseEngine.js';
import { StaffRenderer } from './renderer/StaffRenderer.js';
import { QuestionRenderer } from './renderer/QuestionRenderer.js';
import { SynthManager } from './audio/index.js';
import { DataManager } from './services/DataManager.js';
import { TunerController } from './controllers/TunerController.js';
import { MetronomeController } from './controllers/MetronomeController.js';
import { SynthController } from './controllers/SynthController.js';
import { PianoController } from './controllers/PianoController.js';
import { MenuController } from './controllers/MenuController.js';
import { RhythmController } from './controllers/RhythmController.js';
import { handleAppKeydown } from './AppKeyboard.js';
import { renderAnswerButtons, answerModeFor } from './app-answer-buttons.js';
import {
  exerciseShellHtml,
  correctFeedbackHtml,
  incorrectFeedbackHtml,
  hintHtml,
  resultsHtml,
} from './app-exercise-markup.js';
import { progressHtml, settingsHtml, skillBarHtml } from './app-progress-markup.js';
import { isDevHostname, isUnlockedByProgress } from './app-unlock.js';

/** Délai entre une réponse et la question suivante (ms). */
const NEXT_QUESTION_DELAY_MS = 1500;

/** Identifiants des éléments DOM mis en cache, par clé de `App.elements`. */
const ELEMENT_IDS = {
  loading: 'loading',
  audioBanner: 'audio-banner',
  levelBadge: 'level-badge',
  btnProgress: 'btn-progress',
  btnSettings: 'btn-settings',
  btnMemo: 'btn-memo',
  memoOverlay: 'memo-overlay',
  memoClose: 'memo-close',
  btnPiano: 'btn-piano',
  pianoOverlay: 'piano-overlay',
  pianoClose: 'piano-close',
  pianoKeyboard: 'piano-keyboard',
  pianoNoteDisplay: 'piano-note-display',
  btnSynth: 'btn-synth',
  synthOverlay: 'synth-overlay',
  synthClose: 'synth-close',
  synthPresets: 'synth-presets',
  synthOscillators: 'synth-oscillators',
  synthTestBtn: 'synth-test-btn',
  btnMetronome: 'btn-metronome',
  metronomeOverlay: 'metronome-overlay',
  metronomeClose: 'metronome-close',
  metronomeBpmValue: 'metronome-bpm-value',
  metronomeBeats: 'metronome-beats',
  metronomeTempoSlider: 'metronome-tempo-slider',
  metronomeTimeSignature: 'metronome-time-signature',
  metronomePlayBtn: 'metronome-play',
  btnTuner: 'btn-tuner',
  tunerOverlay: 'tuner-overlay',
  tunerClose: 'tuner-close',
  tunerNote: 'tuner-note',
  tunerOctave: 'tuner-octave',
  tunerIndicator: 'tuner-indicator',
  tunerFrequency: 'tuner-frequency',
  tunerCents: 'tuner-cents',
  tunerStatus: 'tuner-status',
  tunerToggle: 'tuner-toggle',
  tunerGraph: 'tuner-graph',
  tunerGraphRange: 'tuner-graph-range',
  tunerHistory: 'tuner-history',
  tunerLiveDot: 'tuner-live-dot',
  menuView: 'menu-view',
  exerciseView: 'exercise-view',
  progressView: 'progress-view',
  settingsView: 'settings-view',
};

/** Membres libérés par `dispose`, dans l'ordre : contrôleurs, synthé, renderers. */
const DISPOSABLE_MEMBERS = [
  'tunerController',
  'metronomeController',
  'synthController',
  'pianoController',
  'menuController',
  'rhythmController',
  'synthManager',
  'questionRenderer',
  'staffRenderer',
];

/**
 * Relie l'ouverture, la fermeture et le clic sur le fond d'une surcouche.
 * @param {{open?: HTMLElement, close?: HTMLElement, overlay?: HTMLElement}} elements
 * @param {{show: Function, hide: Function}} actions
 */
function bindOverlayPanel({ open, close, overlay }, { show, hide }) {
  open?.addEventListener('click', show);
  close?.addEventListener('click', hide);
  overlay?.addEventListener('click', (e) => {
    // Fermer si on clique sur l'overlay (pas sur la popup)
    if (e.target === overlay) {
      hide();
    }
  });
}

/**
 * Relie un clic sur un élément du conteneur, s'il est présent.
 * @param {HTMLElement} container
 * @param {string} selector
 * @param {Function} handler
 */
function bindClick(container, selector, handler) {
  container.querySelector(selector)?.addEventListener('click', handler);
}

// ============================================================================
// Classe App
// ============================================================================

/**
 * Orchestrateur principal de l'application Diese & Mat.
 */
export class App {
  /**
   * Crée une nouvelle instance de l'application.
   */
  constructor() {
    /** @type {string} Vue active ('menu' | 'exercise' | 'progress' | 'settings') */
    this.currentView = 'menu';

    /** @type {DataManager} Gestionnaire de données */
    this.dataManager = new DataManager();

    /** @type {boolean} Audio initialisé */
    this.audioReady = false;

    /** @type {Object} Références aux éléments DOM */
    this.elements = {};

    /** @type {ExerciseEngine|null} Moteur d'exercice */
    this.engine = null;

    /** @type {StaffRenderer|null} Renderer de portée */
    this.staffRenderer = null;

    /** @type {QuestionRenderer|null} Renderer de questions */
    this.questionRenderer = null;

    /** @type {Object|null} Données des exercices */
    this.exercisesData = null;

    /** @type {TunerController|null} Contrôleur de l'accordeur */
    this.tunerController = null;

    /** @type {MetronomeController|null} Contrôleur du métronome */
    this.metronomeController = null;

    /** @type {SynthManager|null} Gestionnaire centralisé du synthétiseur */
    this.synthManager = null;

    /** @type {SynthController|null} Contrôleur du panneau synthétiseur */
    this.synthController = null;

    /** @type {PianoController|null} Contrôleur du piano virtuel */
    this.pianoController = null;

    /** @type {MenuController|null} Contrôleur du menu d'exercices */
    this.menuController = null;

    /** @type {RhythmController|null} Contrôleur du mode rythme */
    this.rhythmController = null;

    /** @type {Function|null} Handler pour keydown global */
    this._keydownHandler = null;

    /** @type {Function|null} Handler pour keyup global */
    this._keyupHandler = null;

    /** @type {Function|null} Handler du premier geste utilisateur (init audio) */
    this._firstGestureHandler = null;

    /** @type {boolean} Flag pour éviter les appels concurrents à startExercise */
    this._startingExercise = false;

    /** @type {Set<number>} Minuteries en attente (question suivante, seconde note) */
    this._pendingTimers = new Set();

    /** @type {Array} Liste des exercices disponibles */
    this.exercisesList = [
      { id: 'note-treble-natural', title: 'Clé de sol - Notes naturelles', description: 'Do à Si sur la portée', difficulty: 1, category: 'notes', icon: '🎼', categoryName: 'Lecture de notes' },
      { id: 'note-treble-extended', title: 'Clé de sol - Étendue', description: 'Do3 à Sol5', difficulty: 2, category: 'notes', icon: '🎼', categoryName: 'Lecture de notes' },
      { id: 'note-treble-sharps', title: 'Clé de sol - Avec dièses', description: 'Inclut les altérations', difficulty: 2, category: 'notes', icon: '🎼', categoryName: 'Lecture de notes' },
      { id: 'note-bass-natural', title: 'Clé de fa - Notes naturelles', description: 'Lecture en clé de fa', difficulty: 2, category: 'notes', icon: '🎼', categoryName: 'Lecture de notes' },
      { id: 'interval-basic', title: 'Petits intervalles', description: 'Secondes et tierces', difficulty: 2, category: 'intervals', icon: '↕️', categoryName: 'Intervalles' },
      { id: 'interval-all', title: 'Tous intervalles', description: 'De l\'unisson à l\'octave', difficulty: 3, category: 'intervals', icon: '↕️', categoryName: 'Intervalles' },
      { id: 'chord-major-minor', title: 'Majeur / Mineur', description: 'Reconnaître les accords de base', difficulty: 2, category: 'chords', icon: '🎹', categoryName: 'Accords' },
      { id: 'chord-all-triads', title: 'Toutes les triades', description: 'Majeur, mineur, diminué, augmenté', difficulty: 3, category: 'chords', icon: '🎹', categoryName: 'Accords' },
      { id: 'rhythm-basic', title: 'Rythme - Basique', description: 'Rondes, blanches et noires', difficulty: 1, category: 'rhythm', icon: '🥁', categoryName: 'Rythme' },
      { id: 'rhythm-intermediate', title: 'Rythme - Intermédiaire', description: 'Avec croches', difficulty: 2, category: 'rhythm', icon: '🥁', categoryName: 'Rythme' },
    ];
  }

  /**
   * Initialise l'application.
   */
  init() {
    // Cacher le loading et récupérer les références DOM
    this.cacheElements();

    // Initialiser les controllers
    this._initControllers();

    // Charger la progression et les paramètres sauvegardés
    this.dataManager.loadProgress();
    this.dataManager.loadSettings();

    // Configurer les événements
    this.setupEventListeners();

    // Configurer les hooks GameKit
    this.setupGameKitHooks();

    // Afficher le menu principal
    this.hideLoading();
    this.showView('menu');

    // Mettre à jour l'affichage du niveau
    this.updateLevelBadge();
  }

  /**
   * Met en cache les références aux éléments DOM.
   */
  cacheElements() {
    this.elements = Object.fromEntries(
      Object.entries(ELEMENT_IDS).map(([key, id]) => [key, document.getElementById(id)]),
    );
  }

  /**
   * Initialise les controllers.
   * @private
   */
  _initControllers() {
    this._initPanelControllers();
    this._initExerciseControllers();
  }

  /**
   * Initialise le synthé partagé et les contrôleurs de panneaux.
   * @private
   */
  _initPanelControllers() {
    // Gestionnaire centralisé du synthétiseur (partagé entre piano et panneau synthé)
    this.synthManager = new SynthManager();

    // Controller de l'accordeur
    this.tunerController = new TunerController({
      overlay: this.elements.tunerOverlay,
      toggle: this.elements.tunerToggle,
      note: this.elements.tunerNote,
      octave: this.elements.tunerOctave,
      frequency: this.elements.tunerFrequency,
      cents: this.elements.tunerCents,
      indicator: this.elements.tunerIndicator,
      status: this.elements.tunerStatus,
      graph: this.elements.tunerGraph,
      graphRange: this.elements.tunerGraphRange,
      history: this.elements.tunerHistory,
      liveDot: this.elements.tunerLiveDot,
    }, {
      formatNote: (note, includeOctave, octave) => this.dataManager.formatNote(note, includeOctave, octave),
    });

    // Controller du métronome
    this.metronomeController = new MetronomeController({
      overlay: this.elements.metronomeOverlay,
      bpmValue: this.elements.metronomeBpmValue,
      beats: this.elements.metronomeBeats,
      tempoSlider: this.elements.metronomeTempoSlider,
      timeSignature: this.elements.metronomeTimeSignature,
      playBtn: this.elements.metronomePlayBtn,
    }, {
      getAudioEngine: () => this.synthManager?.audioEngine,
      ensureAudioReady: () => this.synthManager?.ensureAudioReady(),
    });

    // Controller du panneau synthétiseur
    this.synthController = new SynthController({
      overlay: this.elements.synthOverlay,
      presetsContainer: this.elements.synthPresets,
      oscillatorsContainer: this.elements.synthOscillators,
      typeTabs: document.getElementById('synth-type-tabs'),
      typeInfo: document.getElementById('synth-type-info'),
      testBtn: this.elements.synthTestBtn,
    }, {
      synthManager: this.synthManager,
    });

    // Controller du piano virtuel
    this.pianoController = new PianoController({
      overlay: this.elements.pianoOverlay,
      keyboard: this.elements.pianoKeyboard,
      noteDisplay: this.elements.pianoNoteDisplay,
      presetsContainer: document.getElementById('piano-instrument-selector'),
    }, {
      synthManager: this.synthManager,
    });
  }

  /**
   * Initialise les contrôleurs du menu et du mode rythme.
   * @private
   */
  _initExerciseControllers() {
    // Controller du menu d'exercices
    this.menuController = new MenuController({
      container: this.elements.menuView,
      exercises: this.exercisesList,
      isUnlocked: (id) => this.isExerciseUnlocked(id),
      getProgress: (id) => this.dataManager.getExerciseProgress(id),
    });

    // Écouter la sélection d'exercice
    this.menuController.on('exercise-selected', ({ exerciseId }) => {
      this.startExercise(exerciseId);
    });

    // Controller du mode rythme
    this.rhythmController = new RhythmController({
      getMetronome: () => this.metronome,
      ensureAudioReady: () => this.synthManager?.ensureAudioReady(),
    });

    // Écouter la fin du rythme
    this.rhythmController.on('rhythm-ended', (result) => this._onRhythmEnded(result));
  }

  /**
   * Traite la fin d'une question de rythme : réponse, feedback puis suite.
   * @param {{hits: number, total: number, accuracy: number, isCorrect: boolean}} result
   * @private
   */
  _onRhythmEnded({ hits, total, accuracy, isCorrect }) {
    // Soumettre au moteur
    if (this.engine) {
      this.engine.submitAnswer(isCorrect ? 'correct' : 'incorrect');
    }

    // Afficher le feedback
    this.rhythmController.showEndFeedback(isCorrect, accuracy, hits, total);

    // Passer à la suite après un délai
    this._schedule(() => this._showNextRhythmQuestion(), NEXT_QUESTION_DELAY_MS);
  }

  /**
   * Affiche la question de rythme suivante ou les résultats en fin de série.
   * @private
   */
  _showNextRhythmQuestion() {
    const progress = this.engine?.getProgress();
    if (progress && progress.current >= progress.total) {
      this.showResults();
      return;
    }
    const nextQuestion = this.engine?.nextQuestion();
    if (nextQuestion) {
      this.showQuestion(nextQuestion);
    }
  }

  /**
   * Programme une action différée annulable par `endExercise` et `dispose`.
   * @param {Function} action
   * @param {number} delayMs
   * @private
   */
  _schedule(action, delayMs) {
    const timer = setTimeout(() => {
      this._pendingTimers.delete(timer);
      action();
    }, delayMs);
    this._pendingTimers.add(timer);
  }

  /**
   * Annule les actions différées en attente.
   * @private
   */
  _cancelPendingTimers() {
    this._pendingTimers.forEach((timer) => clearTimeout(timer));
    this._pendingTimers.clear();
  }

  /**
   * Accès au métronome (via le controller).
   * @returns {import('./audio/Metronome.js').Metronome|null}
   */
  get metronome() {
    return this.metronomeController?.metronome || null;
  }

  /**
   * Accès à la progression (via DataManager).
   * @returns {Object}
   */
  get progress() {
    return this.dataManager.progress;
  }

  /**
   * Accès aux paramètres (via DataManager).
   * @returns {Object}
   */
  get settings() {
    return this.dataManager.settings;
  }

  /**
   * Configure les écouteurs d'événements.
   */
  setupEventListeners() {
    this._bindHeaderButtons();
    this._bindOverlayPanels();
    this._bindAudioActivation();
    this._bindGlobalKeyboard();
  }

  /**
   * Boutons progression et paramètres du header.
   * @private
   */
  _bindHeaderButtons() {
    this.elements.btnProgress?.addEventListener('click', () => {
      this.showView('progress');
    });

    this.elements.btnSettings?.addEventListener('click', () => {
      this.showView('settings');
    });
  }

  /**
   * Mémo, piano, synthé, métronome et accordeur : ouverture et fermeture.
   * @private
   */
  _bindOverlayPanels() {
    const el = this.elements;

    bindOverlayPanel(
      { open: el.btnMemo, close: el.memoClose, overlay: el.memoOverlay },
      { show: () => this.showMemo(), hide: () => this.hideMemo() },
    );
    bindOverlayPanel(
      { open: el.btnPiano, close: el.pianoClose, overlay: el.pianoOverlay },
      { show: () => this.showPiano(), hide: () => this.hidePiano() },
    );
    bindOverlayPanel(
      { open: el.btnSynth, close: el.synthClose, overlay: el.synthOverlay },
      { show: () => this.showSynth(), hide: () => this.hideSynth() },
    );

    // Bouton test du synthé
    el.synthTestBtn?.addEventListener('click', () => {
      this._testSynthSound();
    });

    // Métronome et accordeur (délégués à leurs controllers)
    bindOverlayPanel(
      { open: el.btnMetronome, close: el.metronomeClose, overlay: el.metronomeOverlay },
      { show: () => this.metronomeController?.show(), hide: () => this.metronomeController?.hide() },
    );
    bindOverlayPanel(
      { open: el.btnTuner, close: el.tunerClose, overlay: el.tunerOverlay },
      { show: () => this.tunerController?.show(), hide: () => this.tunerController?.hide() },
    );
  }

  /**
   * Bannière audio et initialisation au premier geste utilisateur.
   * @private
   */
  _bindAudioActivation() {
    // Bannière audio (fallback si l'init auto échoue)
    this.elements.audioBanner?.addEventListener('click', () => {
      this.initAudio();
    });

    // Initialiser l'audio au premier clic utilisateur (user gesture requis)
    this._firstGestureHandler = async () => {
      this._removeFirstGestureHandler();
      try {
        await this.initAudio();
      } catch {
        // Afficher la bannière en cas d'erreur
        console.warn('Init audio automatique échouée, affichage bannière');
        this.elements.audioBanner?.classList.remove('hidden');
      }
    };
    document.addEventListener('click', this._firstGestureHandler, { once: true });
    document.addEventListener('keydown', this._firstGestureHandler, { once: true });
  }

  /**
   * Retire les écouteurs du premier geste utilisateur.
   * @private
   */
  _removeFirstGestureHandler() {
    if (!this._firstGestureHandler) {return;}
    document.removeEventListener('click', this._firstGestureHandler);
    document.removeEventListener('keydown', this._firstGestureHandler);
    this._firstGestureHandler = null;
  }

  /**
   * Raccourcis clavier globaux et relâchement des touches.
   * @private
   */
  _bindGlobalKeyboard() {
    // Raccourcis clavier globaux
    this._keydownHandler = (e) => this.handleKeydown(e);
    document.addEventListener('keydown', this._keydownHandler);

    // Relâchement des touches (pour sustain prolongé)
    this._keyupHandler = (e) => this.handleKeyup(e);
    document.addEventListener('keyup', this._keyupHandler);
  }

  /**
   * Configure les hooks du cycle de vie GameKit.
   */
  setupGameKitHooks() {
    // Pause quand l'onglet est masqué
    window.onGamePause = () => {
      // TODO: Mettre en pause l'exercice en cours
    };

    // Reprise
    window.onGameResume = () => {
      // Reprise du jeu
    };

    // Nettoyage
    window.onGameDispose = () => {
      this.dispose();
    };

    // Changement préférence son
    window.onSoundChange = () => {
      // TODO: Mettre à jour l'état audio
    };
  }

  /**
   * Cache l'écran de chargement.
   */
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
  }

  /**
   * Affiche une vue.
   * @param {'menu'|'exercise'|'progress'|'settings'} viewName - Nom de la vue
   */
  showView(viewName) {
    // Masquer toutes les vues
    const views = ['menuView', 'exerciseView', 'progressView', 'settingsView'];
    views.forEach(view => {
      if (this.elements[view]) {
        this.elements[view].classList.remove('active');
      }
    });

    // Afficher la vue demandée
    const viewElement = this.elements[`${viewName}View`];
    if (viewElement) {
      viewElement.classList.add('active');
      this.currentView = viewName;

      // Initialiser le contenu de la vue si nécessaire
      this.initView(viewName);
    }
  }

  /**
   * Initialise le contenu d'une vue.
   * @param {string} viewName - Nom de la vue
   */
  initView(viewName) {
    switch (viewName) {
      case 'menu':
        this.renderMenu();
        break;
      case 'progress':
        this.renderProgress();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  /**
   * Affiche le menu principal.
   */
  renderMenu() {
    this.menuController?.render();
  }

  /**
   * Démarre un exercice.
   * @param {string} exerciseId - ID de l'exercice
   */
  async startExercise(exerciseId) {
    // Protection contre les appels concurrents (double-clic rapide)
    if (this._startingExercise) {
      return;
    }
    this._startingExercise = true;

    try {
      const exercise = await this._findExercise(exerciseId);
      if (exercise) {
        this._beginExercise(exercise);
      }
    } finally {
      // Le verrou est libéré même si l'affichage de l'exercice échoue
      this._startingExercise = false;
    }
  }

  /**
   * Charge les exercices si nécessaire et retourne celui demandé.
   * @param {string} exerciseId
   * @returns {Promise<Object|null>} Exercice, ou null (erreur déjà présentée)
   * @private
   */
  async _findExercise(exerciseId) {
    // Charger les données d'exercices si pas encore fait
    if (!this.exercisesData) {
      try {
        const response = await fetch('./data/exercises.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        this.exercisesData = await response.json();
      } catch (error) {
        console.error('Erreur chargement exercises.json:', error);
        this._showErrorMessage('Impossible de charger les exercices. Vérifiez votre connexion.');
        return null;
      }
    }

    const exercise = this.exercisesData.exercises.find(e => e.id === exerciseId);
    if (!exercise) {
      console.error('Exercice non trouvé:', exerciseId);
    }
    return exercise ?? null;
  }

  /**
   * Affiche la vue exercice et démarre la session.
   * @param {Object} exercise - Configuration de l'exercice
   * @private
   */
  _beginExercise(exercise) {
    this._cancelPendingTimers();
    this.showView('exercise');
    this.renderExerciseUI(exercise);

    // Créer le moteur d'exercice puis démarrer la session
    this.engine = new ExerciseEngine();
    this.showQuestion(this.engine.startSession(exercise));
  }

  /**
   * Affiche l'interface d'exercice.
   * @param {Object} exercise - Configuration de l'exercice
   */
  renderExerciseUI(exercise) {
    const container = this.elements.exerciseView;
    if (!container) {return;}

    container.innerHTML = exerciseShellHtml(exercise);

    this._createQuestionRenderers(exercise);

    // Créer les boutons selon le mode
    this.currentExercise = exercise;
    this.renderAnswerButtons(answerModeFor(exercise.mode));

    this._bindExerciseControls();
  }

  /**
   * Crée la portée et le renderer de questions de l'exercice.
   * @param {Object} exercise
   * @private
   */
  _createQuestionRenderers(exercise) {
    const staffContainer = document.getElementById('staff-container');
    this.staffRenderer = new StaffRenderer(staffContainer, {
      width: 250,
      height: 120,
      clef: exercise.config.clef || 'treble',
    });

    this.questionRenderer = new QuestionRenderer({
      staffRenderer: this.staffRenderer,
      playNoteAudio: (pitch) => this.playNoteAudio(pitch),
    });
    this.questionRenderer.setStaffContainer(staffContainer);
  }

  /**
   * Attache quitter, indice, passer et écouter.
   * @private
   */
  _bindExerciseControls() {
    document.getElementById('btn-quit').addEventListener('click', () => {
      this.endExercise();
    });

    document.getElementById('btn-hint').addEventListener('click', () => {
      this.showHint();
    });

    document.getElementById('btn-skip').addEventListener('click', () => {
      this.submitAnswer(-1);
    });

    document.getElementById('btn-play-sound')?.addEventListener('click', () => {
      this.playCurrentQuestionSound();
    });
  }

  /**
   * Joue le son de la question courante.
   */
  async playCurrentQuestionSound() {
    if (!this.engine?.currentQuestion) {return;}

    const question = this.engine.currentQuestion;

    if (question.type === 'note' && question.pitch) {
      await this.playNoteAudio(question.pitch);
    } else if (question.type === 'interval') {
      // Jouer les deux notes en séquence
      await this.playNoteAudio(question.pitch1);
      this._schedule(() => this.playNoteAudio(question.pitch2), 500);
    } else if (question.type === 'chord' && question.chord) {
      const pitches = question.chord.getPitches();
      await this.playChordAudio(pitches);
    }
  }

  /**
   * Crée les boutons de réponse selon le mode.
   * @param {string} mode - 'note', 'interval', 'chord' ou 'rhythm'
   */
  renderAnswerButtons(mode = 'note') {
    const container = document.getElementById('note-buttons');
    if (!container) {return;}

    renderAnswerButtons(container, mode, (answer) => this.submitAnswer(answer));
  }

  /**
   * Affiche une question.
   * @param {Object} question - Question à afficher
   */
  showQuestion(question) {
    if (!question) {return;}

    // Mettre à jour le numéro de question et la barre de progression
    const progress = this.engine.getProgress();
    document.getElementById('question-num').textContent = progress.current;
    document.getElementById('progress-bar').style.width =
      `${(progress.current - 1) / progress.total * 100}%`;

    // Effacer le feedback
    document.getElementById('feedback-container').innerHTML = '';

    // Réactiver les boutons
    this.setButtonsEnabled(true);

    this._renderQuestion(question);
  }

  /**
   * Affiche la question selon son type.
   * @param {Object} question
   * @private
   */
  _renderQuestion(question) {
    switch (question.type) {
      case 'note':
        this._renderNoteQuestion(question);
        break;
      case 'interval':
        // Question d'intervalle - afficher les 2 notes
        this.questionRenderer?.renderIntervalQuestion(question);
        break;
      case 'chord':
        // Question d'accord - afficher les notes de l'accord
        this.questionRenderer?.renderChordQuestion(question);
        break;
      case 'rhythm':
        // Question de rythme - afficher le pattern
        this.showRhythmQuestion(question);
        break;
    }
  }

  /**
   * Affiche une question de note : lecture sur portée ou ear training.
   * @param {Object} question
   * @private
   */
  _renderNoteQuestion(question) {
    if (!question.pitch) {return;}

    if (this.currentExercise?.mode === 'audio-to-name') {
      // Mode ear training : cacher la portée, afficher un indicateur
      this.questionRenderer?.renderEarTrainingQuestion(question);
    } else {
      this.questionRenderer?.renderNoteQuestion(question);
    }
  }

  /**
   * Affiche une question de rythme avec curseur défilant.
   * @param {Object} question - Question de rythme
   */
  showRhythmQuestion(question) {
    const staffContainer = document.getElementById('staff-container');
    this.rhythmController?.show(question, staffContainer);
  }

  /**
   * Soumet une réponse.
   * @param {number|string} answer - Réponse (index, semitones, ou type d'accord)
   */
  submitAnswer(answer) {
    if (!this.engine || !this.engine.isRunning()) {return;}

    // Désactiver les boutons pendant le traitement
    this.setButtonsEnabled(false);

    // Soumettre la réponse
    const result = this.engine.submitAnswer(answer);

    // Afficher le feedback
    this.showFeedback(result);

    // Attendre puis passer à la question suivante
    this._schedule(() => this._advanceAfterAnswer(result.isLastQuestion), NEXT_QUESTION_DELAY_MS);
  }

  /**
   * Passe aux résultats ou à la question suivante après une réponse.
   * @param {boolean} isLastQuestion
   * @private
   */
  _advanceAfterAnswer(isLastQuestion) {
    if (!this.engine) {return;}

    if (isLastQuestion) {
      this.showResults();
    } else {
      this.showQuestion(this.engine.nextQuestion());
    }
  }

  /**
   * Affiche le feedback de réponse.
   * @param {Object} result - Résultat de la validation
   */
  showFeedback(result) {
    if (result.correct) {
      this._showCorrectFeedback(result);
    } else {
      this._showIncorrectFeedback(result.expectedAnswer);
    }

    // Mettre à jour le score
    const stats = this.engine.getProgress().stats;
    document.getElementById('score-display').textContent = `${stats.totalScore} pts`;
  }

  /**
   * @param {Object} result
   * @private
   */
  _showCorrectFeedback(result) {
    this.staffRenderer.highlightCorrect();
    document.getElementById('feedback-container').innerHTML = correctFeedbackHtml(result);
  }

  /**
   * @param {Object} expected - Réponse attendue
   * @private
   */
  _showIncorrectFeedback(expected) {
    this.staffRenderer.highlightError();
    document.getElementById('feedback-container').innerHTML = incorrectFeedbackHtml(expected);

    // Highlight le bon bouton
    if (expected.pitchClass !== undefined) {
      const correctBtn = document.querySelector(`.note-btn[data-note="${expected.pitchClass}"]`);
      if (correctBtn) {
        correctBtn.style.background = 'var(--color-success)';
        correctBtn.style.color = 'white';
      }
    }
  }

  /**
   * Affiche un indice.
   */
  showHint() {
    if (!this.engine) {return;}

    const hint = this.engine.requestHint();
    if (hint) {
      document.getElementById('feedback-container').innerHTML = hintHtml(hint);
    }
  }

  /**
   * Active/désactive les boutons de réponse.
   * @param {boolean} enabled
   */
  setButtonsEnabled(enabled) {
    document.querySelectorAll('.note-btn').forEach(btn => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.5';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
      // Reset les styles
      if (enabled) {
        btn.style.background = 'var(--color-bg-secondary)';
        btn.style.color = 'inherit';
      }
    });
  }

  /**
   * Affiche les résultats de fin d'exercice.
   */
  showResults() {
    const summary = this.engine.endSession();
    const container = this.elements.exerciseView;

    const accuracy = summary.totalCount > 0
      ? Math.round((summary.correctCount / summary.totalCount) * 100)
      : 0;

    container.innerHTML = resultsHtml(summary, accuracy);

    // Attacher les événements de manière sécurisée (pas de onclick inline)
    bindClick(container, '#btn-replay', () => this.startExercise(summary.exerciseId));
    bindClick(container, '#btn-back-menu', () => this.showView('menu'));

    // Sauvegarder la progression
    this.updateProgressFromSession(summary);
  }

  /**
   * Met à jour la progression après une session.
   * @param {Object} summary - Résumé de la session
   */
  updateProgressFromSession(summary) {
    // Ajouter à l'historique via DataManager
    this.dataManager.addHistoryEntry({
      exerciseId: summary.exerciseId,
      score: summary.totalScore,
      maxScore: summary.totalCount * 10,
      accuracy: summary.totalCount > 0 ? summary.correctCount / summary.totalCount : 0,
    });

    this._updateSkillFromSession(summary);

    // Ajouter XP (calcule automatiquement le level up)
    this.dataManager.addXP(summary.totalScore);

    this.updateLevelBadge();
  }

  /**
   * Met à jour la précision de la compétence travaillée (moyenne pondérée).
   * @param {Object} summary - Résumé de la session
   * @private
   */
  _updateSkillFromSession(summary) {
    const skill = this.dataManager.progress.skills?.[summary.skill];
    if (!summary.skill || !skill) {return;}

    const newAccuracy = summary.totalCount > 0
      ? summary.correctCount / summary.totalCount
      : 0;
    const updatedAccuracy = skill.attempts > 0
      ? (skill.accuracy * skill.attempts + newAccuracy) / (skill.attempts + 1)
      : newAccuracy;
    this.dataManager.updateSkill(summary.skill, {
      accuracy: updatedAccuracy,
      attempts: skill.attempts + 1,
    });
  }

  /**
   * Termine l'exercice en cours.
   */
  endExercise() {
    this._cancelPendingTimers();
    if (this.engine) {
      this.engine.cancel();
      this.engine = null;
    }
    if (this.staffRenderer) {
      this.staffRenderer.dispose();
      this.staffRenderer = null;
    }
    this.showView('menu');
  }

  /**
   * Affiche la vue progression.
   */
  renderProgress() {
    const container = this.elements.progressView;
    if (!container) {return;}

    container.innerHTML = progressHtml(this.dataManager.progress);

    // Attacher l'événement de manière sécurisée
    bindClick(container, '#btn-back-progress', () => this.showView('menu'));
  }

  /**
   * Génère une barre de compétence.
   * @param {string} name - Nom de la compétence
   * @param {number} accuracy - Taux de réussite (0-1)
   * @returns {string} HTML
   */
  renderSkillBar(name, accuracy) {
    return skillBarHtml(name, accuracy);
  }

  /**
   * Affiche la vue paramètres.
   */
  renderSettings() {
    const container = this.elements.settingsView;
    if (!container) {return;}

    container.innerHTML = settingsHtml(this.settings.notation === 'french');

    // Attacher les événements de manière sécurisée
    bindClick(container, '#btn-back-settings', () => this.showView('menu'));
    bindClick(container, '#btn-reset-progress', () => this.resetProgress());

    // Event listeners pour les boutons de notation
    container.querySelectorAll('.notation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dataManager.setNotation(btn.dataset.notation);
        this.renderSettings(); // Re-render pour mettre à jour le style
      });
    });
  }

  /**
   * Affiche le mémo musical.
   */
  showMemo() {
    if (this.elements.memoOverlay) {
      this.elements.memoOverlay.classList.add('visible');
    }
  }

  /**
   * Cache le mémo musical.
   */
  hideMemo() {
    if (this.elements.memoOverlay) {
      this.elements.memoOverlay.classList.remove('visible');
    }
  }

  /**
   * Affiche le clavier piano.
   */
  showPiano() {
    this.pianoController?.show();
  }

  /**
   * Cache le clavier piano.
   */
  hidePiano() {
    this.pianoController?.hide();
  }

  /**
   * Affiche le panel synthétiseur.
   */
  showSynth() {
    this.synthController?.show();
  }

  /**
   * Cache le panel synthétiseur.
   */
  hideSynth() {
    this.synthController?.hide();
  }

  /**
   * Gère les raccourcis clavier.
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    handleAppKeydown(this, event);
  }

  /**
   * Gère le relâchement des touches clavier (sustain prolongé).
   * @param {KeyboardEvent} event
   */
  handleKeyup(event) {
    // Piano virtuel - arrêter les notes quand on relâche la touche
    if (this.pianoController?.isVisible()) {
      const keyLower = event.key.toLowerCase();
      const keyMap = this.pianoController.keyMap;
      if (keyMap[keyLower]) {
        this.pianoController.handleKeyUp(keyLower);
      }
    }
  }

  /**
   * Initialise l'audio (nécessite une interaction utilisateur).
   */
  async initAudio() {
    if (this.audioReady) {return;}

    try {
      // Utiliser le SynthManager pour initialiser l'audio
      await this.synthManager?.ensureAudioReady();
      this._markAudioReady();
    } catch (error) {
      console.error('Erreur initialisation audio:', error);
    }
  }

  /**
   * Marque l'audio prêt et cache la bannière.
   * @private
   */
  _markAudioReady() {
    this.audioReady = true;
    this.elements.audioBanner?.classList.add('hidden');
  }

  /**
   * Prépare l'audio avant une lecture.
   * @returns {Promise<boolean>} false si l'audio n'a pas pu démarrer
   * @private
   */
  async _prepareAudioForPlayback() {
    try {
      await this.synthManager?.ensureAudioReady();
      this._markAudioReady();
      return true;
    } catch (error) {
      console.error('Erreur démarrage audio:', error);
      return false;
    }
  }

  /**
   * Retourne le moteur audio (via SynthManager).
   * @returns {AudioEngine|null}
   */
  get audioEngine() {
    return this.synthManager?.audioEngine || null;
  }

  /**
   * Détecte si on est en mode développement (localhost).
   * @returns {boolean}
   */
  isDevMode() {
    return isDevHostname(window.location.hostname);
  }

  /**
   * Vérifie si un exercice est débloqué.
   * @param {string} exerciseId - ID de l'exercice
   * @returns {boolean}
   */
  isExerciseUnlocked(exerciseId) {
    // En mode dev, tout est débloqué
    return this.isDevMode() ||
      isUnlockedByProgress(exerciseId, this.dataManager.progress);
  }

  /**
   * Met à jour l'affichage du niveau dans le header.
   */
  updateLevelBadge() {
    if (this.elements.levelBadge) {
      const level = this.dataManager.level;
      this.elements.levelBadge.textContent = `Niveau ${level}`;
    }
  }

  /**
   * Réinitialise la progression (avec confirmation utilisateur).
   */
  resetProgress() {
    if (confirm('Voulez-vous vraiment réinitialiser votre progression ?')) {
      this.dataManager.resetProgress();
      this.updateLevelBadge();
      this.showView('menu');
    }
  }

  /**
   * Nettoie les ressources.
   */
  dispose() {
    // Sauvegarder la progression
    this.dataManager.saveProgress();

    this._cancelPendingTimers();
    this._removeFirstGestureHandler();

    // Nettoyer les event listeners globaux
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    if (this._keyupHandler) {
      document.removeEventListener('keyup', this._keyupHandler);
      this._keyupHandler = null;
    }

    // Contrôleurs, synthétiseur puis renderers
    for (const member of DISPOSABLE_MEMBERS) {
      this[member]?.dispose();
      this[member] = null;
    }
  }

  /**
   * Joue un son de test via le synthé configuré.
   * @private
   */
  async _testSynthSound() {
    // Jouer un Do4 via le synthé avec les paramètres courants
    await this.synthManager?.playNote('C4', 0.5);
  }

  /**
   * Affiche un message d'erreur à l'utilisateur.
   * @param {string} message - Message à afficher
   * @private
   */
  _showErrorMessage(message) {
    const container = this.elements.menuView || document.getElementById('menu-view');
    if (!container) {return;}

    // Créer l'élément de message d'erreur
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    errorDiv.style.cssText = `
      padding: var(--space-md);
      background: rgba(244, 67, 54, 0.1);
      color: var(--color-error);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-md);
      margin: var(--space-md);
      text-align: center;
    `;
    errorDiv.textContent = message;

    // Insérer en haut du container
    container.insertBefore(errorDiv, container.firstChild);

    // Auto-suppression après 5 secondes
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  /**
   * Échappe les caractères HTML pour éviter les injections XSS.
   * @param {string} str - Texte à échapper
   * @returns {string} Texte échappé
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Joue une note avec l'audio (son neutre pour exercices).
   * @param {import('./core/Pitch.js').Pitch} pitch - Note à jouer
   */
  async playNoteAudio(pitch) {
    if (!await this._prepareAudioForPlayback()) {return;}

    // Jouer via le synthé partagé
    this.audioEngine?.playPianoNote(pitch, 0.8);
  }

  /**
   * Joue un accord avec l'audio.
   * @param {import('./core/Pitch.js').Pitch[]} pitches - Notes de l'accord
   */
  async playChordAudio(pitches) {
    if (!await this._prepareAudioForPlayback()) {return;}

    // Jouer via le synthé partagé
    this.audioEngine?.playPianoChord(pitches, 1);
  }
}
