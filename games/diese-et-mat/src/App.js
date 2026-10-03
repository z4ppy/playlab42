/**
 * Diese & Mat - Orchestrateur principal de l'application
 *
 * Gère la navigation entre les vues, l'état global et le cycle de vie.
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

    /** @type {boolean} Flag pour éviter les appels concurrents à startExercise */
    this._startingExercise = false;

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
    this.elements = {
      loading: document.getElementById('loading'),
      audioBanner: document.getElementById('audio-banner'),
      levelBadge: document.getElementById('level-badge'),
      btnProgress: document.getElementById('btn-progress'),
      btnSettings: document.getElementById('btn-settings'),
      btnMemo: document.getElementById('btn-memo'),
      memoOverlay: document.getElementById('memo-overlay'),
      memoClose: document.getElementById('memo-close'),
      btnPiano: document.getElementById('btn-piano'),
      pianoOverlay: document.getElementById('piano-overlay'),
      pianoClose: document.getElementById('piano-close'),
      pianoKeyboard: document.getElementById('piano-keyboard'),
      pianoNoteDisplay: document.getElementById('piano-note-display'),
      btnSynth: document.getElementById('btn-synth'),
      synthOverlay: document.getElementById('synth-overlay'),
      synthClose: document.getElementById('synth-close'),
      synthPresets: document.getElementById('synth-presets'),
      synthOscillators: document.getElementById('synth-oscillators'),
      synthTestBtn: document.getElementById('synth-test-btn'),
      btnMetronome: document.getElementById('btn-metronome'),
      metronomeOverlay: document.getElementById('metronome-overlay'),
      metronomeClose: document.getElementById('metronome-close'),
      metronomeBpmValue: document.getElementById('metronome-bpm-value'),
      metronomeBeats: document.getElementById('metronome-beats'),
      metronomeTempoSlider: document.getElementById('metronome-tempo-slider'),
      metronomeTimeSignature: document.getElementById('metronome-time-signature'),
      metronomePlayBtn: document.getElementById('metronome-play'),
      btnTuner: document.getElementById('btn-tuner'),
      tunerOverlay: document.getElementById('tuner-overlay'),
      tunerClose: document.getElementById('tuner-close'),
      tunerNote: document.getElementById('tuner-note'),
      tunerOctave: document.getElementById('tuner-octave'),
      tunerIndicator: document.getElementById('tuner-indicator'),
      tunerFrequency: document.getElementById('tuner-frequency'),
      tunerCents: document.getElementById('tuner-cents'),
      tunerStatus: document.getElementById('tuner-status'),
      tunerToggle: document.getElementById('tuner-toggle'),
      tunerGraph: document.getElementById('tuner-graph'),
      tunerGraphRange: document.getElementById('tuner-graph-range'),
      tunerHistory: document.getElementById('tuner-history'),
      tunerLiveDot: document.getElementById('tuner-live-dot'),
      menuView: document.getElementById('menu-view'),
      exerciseView: document.getElementById('exercise-view'),
      progressView: document.getElementById('progress-view'),
      settingsView: document.getElementById('settings-view'),
    };
  }

  /**
   * Initialise les controllers.
   * @private
   */
  _initControllers() {
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
    this.rhythmController.on('rhythm-ended', ({ hits, total, accuracy, isCorrect }) => {
      // Soumettre au moteur
      if (this.engine) {
        this.engine.submitAnswer(isCorrect ? 'correct' : 'incorrect');
      }

      // Afficher le feedback
      this.rhythmController.showEndFeedback(isCorrect, accuracy, hits, total);

      // Passer à la suite après un délai
      setTimeout(() => {
        const progress = this.engine?.getProgress();
        if (progress && progress.current >= progress.total) {
          this.showResults();
        } else {
          const nextQuestion = this.engine?.nextQuestion();
          if (nextQuestion) {
            this.showQuestion(nextQuestion);
          }
        }
      }, 1500);
    });
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
    // Boutons header
    this.elements.btnProgress?.addEventListener('click', () => {
      this.showView('progress');
    });

    this.elements.btnSettings?.addEventListener('click', () => {
      this.showView('settings');
    });

    // Bouton mémo
    this.elements.btnMemo?.addEventListener('click', () => {
      this.showMemo();
    });

    this.elements.memoClose?.addEventListener('click', () => {
      this.hideMemo();
    });

    this.elements.memoOverlay?.addEventListener('click', (e) => {
      // Fermer si on clique sur l'overlay (pas sur la popup)
      if (e.target === this.elements.memoOverlay) {
        this.hideMemo();
      }
    });

    // Bouton piano
    this.elements.btnPiano?.addEventListener('click', () => {
      this.showPiano();
    });

    this.elements.pianoClose?.addEventListener('click', () => {
      this.hidePiano();
    });

    this.elements.pianoOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.pianoOverlay) {
        this.hidePiano();
      }
    });

    // Bouton synthé
    this.elements.btnSynth?.addEventListener('click', () => {
      this.showSynth();
    });

    this.elements.synthClose?.addEventListener('click', () => {
      this.hideSynth();
    });

    this.elements.synthOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.synthOverlay) {
        this.hideSynth();
      }
    });

    // Bouton test du synthé
    this.elements.synthTestBtn?.addEventListener('click', () => {
      this._testSynthSound();
    });

    // Bouton métronome (délégué au MetronomeController)
    this.elements.btnMetronome?.addEventListener('click', () => {
      this.metronomeController?.show();
    });

    this.elements.metronomeClose?.addEventListener('click', () => {
      this.metronomeController?.hide();
    });

    this.elements.metronomeOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.metronomeOverlay) {
        this.metronomeController?.hide();
      }
    });

    // Bouton accordeur (délégué au TunerController)
    this.elements.btnTuner?.addEventListener('click', () => {
      this.tunerController?.show();
    });

    this.elements.tunerClose?.addEventListener('click', () => {
      this.tunerController?.hide();
    });

    this.elements.tunerOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.tunerOverlay) {
        this.tunerController?.hide();
      }
    });

    // Bannière audio (fallback si l'init auto échoue)
    this.elements.audioBanner?.addEventListener('click', () => {
      this.initAudio();
    });

    // Initialiser l'audio au premier clic utilisateur (user gesture requis)
    const initAudioOnFirstClick = async () => {
      document.removeEventListener('click', initAudioOnFirstClick);
      document.removeEventListener('keydown', initAudioOnFirstClick);
      try {
        await this.initAudio();
      } catch {
        // Afficher la bannière en cas d'erreur
        console.warn('Init audio automatique échouée, affichage bannière');
        if (this.elements.audioBanner) {
          this.elements.audioBanner.classList.remove('hidden');
        }
      }
    };
    document.addEventListener('click', initAudioOnFirstClick, { once: true });
    document.addEventListener('keydown', initAudioOnFirstClick, { once: true });

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
      // Charger les données d'exercices si pas encore fait
      if (!this.exercisesData) {
        const response = await fetch('./data/exercises.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        this.exercisesData = await response.json();
      }
    } catch (error) {
      console.error('Erreur chargement exercises.json:', error);
      this._startingExercise = false;
      this._showErrorMessage('Impossible de charger les exercices. Vérifiez votre connexion.');
      return;
    }

    // Trouver l'exercice
    const exercise = this.exercisesData.exercises.find(e => e.id === exerciseId);
    if (!exercise) {
      console.error('Exercice non trouvé:', exerciseId);
      this._startingExercise = false;
      return;
    }

    // Afficher la vue exercice
    this.showView('exercise');
    this.renderExerciseUI(exercise);

    // Créer le moteur d'exercice
    this.engine = new ExerciseEngine();

    // Démarrer la session
    const firstQuestion = this.engine.startSession(exercise);
    this.showQuestion(firstQuestion);

    // Réinitialiser le flag après le démarrage réussi
    this._startingExercise = false;
  }

  /**
   * Affiche l'interface d'exercice.
   * @param {Object} exercise - Configuration de l'exercice
   */
  renderExerciseUI(exercise) {
    const container = this.elements.exerciseView;
    if (!container) {return;}

    container.innerHTML = `
      <div class="exercise-container" style="
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: var(--space-md);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
        ">
          <button id="btn-quit" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--color-text-muted);
          ">✕</button>
          <div style="text-align: center;">
            <div style="font-weight: bold;">${exercise.title}</div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Question <span id="question-num">1</span>/${exercise.config.questionsCount}
            </div>
          </div>
          <div id="score-display" style="
            font-size: var(--font-size-lg);
            font-weight: bold;
            color: var(--color-accent);
          ">0 pts</div>
        </div>

        <!-- Barre de progression -->
        <div style="
          height: 4px;
          background: var(--color-border);
          border-radius: 2px;
          margin-bottom: var(--space-lg);
          overflow: hidden;
        ">
          <div id="progress-bar" style="
            height: 100%;
            width: 0%;
            background: var(--color-accent);
            transition: width 0.3s ease;
          "></div>
        </div>

        <!-- Zone de portée -->
        <div id="staff-container" style="
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 150px;
        "></div>

        <!-- Feedback -->
        <div id="feedback-container" role="status" aria-live="polite" style="
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-md);
        "></div>

        <!-- Boutons de réponse -->
        <div id="note-buttons" style="
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: var(--space-sm);
          margin-bottom: var(--space-md);
        "></div>

        <!-- Actions -->
        <div style="
          display: flex;
          justify-content: center;
          gap: var(--space-md);
        ">
          <button id="btn-play-sound" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-accent);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
          ">🔊 Écouter</button>
          <button id="btn-hint" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
          ">💡 Indice</button>
          <button id="btn-skip" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
          ">Passer →</button>
        </div>
      </div>
    `;

    // Initialiser le renderer de portée
    const staffContainer = document.getElementById('staff-container');
    this.staffRenderer = new StaffRenderer(staffContainer, {
      width: 250,
      height: 120,
      clef: exercise.config.clef || 'treble',
    });

    // Initialiser le renderer de questions
    this.questionRenderer = new QuestionRenderer({
      staffRenderer: this.staffRenderer,
      playNoteAudio: (pitch) => this.playNoteAudio(pitch),
    });
    this.questionRenderer.setStaffContainer(staffContainer);

    // Créer les boutons selon le mode
    this.currentExercise = exercise;
    let buttonMode = 'note';
    if (exercise.mode === 'interval') {buttonMode = 'interval';}
    else if (exercise.mode === 'chord') {buttonMode = 'chord';}
    else if (exercise.mode === 'rhythm') {buttonMode = 'rhythm';}
    this.renderAnswerButtons(buttonMode);

    // Attacher les événements
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
      setTimeout(() => this.playNoteAudio(question.pitch2), 500);
    } else if (question.type === 'chord' && question.chord) {
      const pitches = question.chord.getPitches();
      await this.playChordAudio(pitches);
    }
  }

  /**
   * Crée les boutons de réponse selon le mode.
   * @param {string} mode - 'note', 'interval' ou 'chord'
   */
  renderAnswerButtons(mode = 'note') {
    const container = document.getElementById('note-buttons');
    if (!container) {return;}

    if (mode === 'interval') {
      // Boutons d'intervalles
      const intervals = [
        { label: '2de m', value: 1, name: 'Seconde mineure' },
        { label: '2de M', value: 2, name: 'Seconde majeure' },
        { label: '3ce m', value: 3, name: 'Tierce mineure' },
        { label: '3ce M', value: 4, name: 'Tierce majeure' },
        { label: '4te', value: 5, name: 'Quarte juste' },
        { label: 'Triton', value: 6, name: 'Triton' },
        { label: '5te', value: 7, name: 'Quinte juste' },
      ];

      container.style.gridTemplateColumns = 'repeat(7, 1fr)';
      container.innerHTML = intervals.map(int => `
        <button class="note-btn" data-semitones="${int.value}" title="${int.name}" aria-label="${int.name}" style="
          padding: var(--space-sm) var(--space-xs);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${int.label}</button>
      `).join('');

      // Attacher les événements pour intervalles
      container.querySelectorAll('.note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const semitones = parseInt(btn.dataset.semitones);
          this.submitAnswer(semitones);
        });
      });
    } else if (mode === 'chord') {
      // Boutons d'accords
      const chords = [
        { label: 'Majeur', value: 'major' },
        { label: 'Mineur', value: 'minor' },
        { label: 'Diminué', value: 'diminished' },
        { label: 'Augmenté', value: 'augmented' },
      ];

      container.style.gridTemplateColumns = 'repeat(4, 1fr)';
      container.innerHTML = chords.map(chord => `
        <button class="note-btn" data-chord="${chord.value}" style="
          padding: var(--space-md);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-md);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${chord.label}</button>
      `).join('');

      // Attacher les événements pour accords
      container.querySelectorAll('.note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const chordType = btn.dataset.chord;
          this.submitAnswer(chordType);
        });
      });
    } else if (mode === 'rhythm') {
      // En mode rythme, les contrôles sont dans la zone staff
      // On cache la zone des boutons classiques
      container.style.display = 'none';
    } else {
      // Boutons de notes Do-Si
      const notes = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

      container.style.gridTemplateColumns = 'repeat(7, 1fr)';
      container.innerHTML = notes.map((note, index) => `
        <button class="note-btn" data-note="${index}" style="
          padding: var(--space-md);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-md);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${note}</button>
      `).join('');

      // Attacher les événements pour notes
      container.querySelectorAll('.note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const noteIndex = parseInt(btn.dataset.note);
          this.submitAnswer(noteIndex);
        });
      });
    }
  }

  /**
   * Affiche une question.
   * @param {Object} question - Question à afficher
   */
  showQuestion(question) {
    if (!question) {return;}

    // Mettre à jour le numéro de question
    const progress = this.engine.getProgress();
    document.getElementById('question-num').textContent = progress.current;
    document.getElementById('progress-bar').style.width =
      `${(progress.current - 1) / progress.total * 100}%`;

    // Effacer le feedback
    document.getElementById('feedback-container').innerHTML = '';

    // Réactiver les boutons
    this.setButtonsEnabled(true);

    // Vérifier si c'est le mode ear training (audio-to-name)
    const isEarTraining = this.currentExercise?.mode === 'audio-to-name';

    // Afficher selon le type de question
    if (question.type === 'note' && question.pitch) {
      if (isEarTraining) {
        // Mode ear training : cacher la portée, afficher un indicateur
        this.questionRenderer?.renderEarTrainingQuestion(question);
      } else {
        // Question de lecture de note
        this.questionRenderer?.renderNoteQuestion(question);
      }
    } else if (question.type === 'interval') {
      // Question d'intervalle - afficher les 2 notes
      this.questionRenderer?.renderIntervalQuestion(question);
    } else if (question.type === 'chord') {
      // Question d'accord - afficher les notes de l'accord
      this.questionRenderer?.renderChordQuestion(question);
    } else if (question.type === 'rhythm') {
      // Question de rythme - afficher le pattern
      this.showRhythmQuestion(question);
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
    setTimeout(() => {
      if (result.isLastQuestion) {
        this.showResults();
      } else {
        const nextQuestion = this.engine.nextQuestion();
        this.showQuestion(nextQuestion);
      }
    }, 1500);
  }

  /**
   * Affiche le feedback de réponse.
   * @param {Object} result - Résultat de la validation
   */
  showFeedback(result) {
    const feedbackContainer = document.getElementById('feedback-container');
    const scoreDisplay = document.getElementById('score-display');

    if (result.correct) {
      // Feedback correct
      this.staffRenderer.highlightCorrect();
      feedbackContainer.innerHTML = `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(76, 175, 80, 0.1);
          color: var(--color-success);
          border-radius: var(--radius-md);
          font-weight: bold;
        ">
          ✓ Correct ! +${result.points} pts
          ${result.streak > 1 ? `<span style="margin-left: var(--space-sm);">🔥 Série de ${result.streak}</span>` : ''}
        </div>
      `;
    } else {
      // Feedback incorrect
      this.staffRenderer.highlightError();
      const expected = result.expectedAnswer;
      feedbackContainer.innerHTML = `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(244, 67, 54, 0.1);
          color: var(--color-error);
          border-radius: var(--radius-md);
          font-weight: bold;
        ">
          ✗ La réponse était <strong>${expected.french}</strong>
        </div>
      `;

      // Highlight le bon bouton
      if (expected.pitchClass !== undefined) {
        const correctBtn = document.querySelector(`.note-btn[data-note="${expected.pitchClass}"]`);
        if (correctBtn) {
          correctBtn.style.background = 'var(--color-success)';
          correctBtn.style.color = 'white';
        }
      }
    }

    // Mettre à jour le score
    const stats = this.engine.getProgress().stats;
    scoreDisplay.textContent = `${stats.totalScore} pts`;
  }

  /**
   * Affiche un indice.
   */
  showHint() {
    if (!this.engine) {return;}

    const hint = this.engine.requestHint();
    if (hint) {
      const feedbackContainer = document.getElementById('feedback-container');
      feedbackContainer.innerHTML = `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(255, 193, 7, 0.1);
          color: var(--color-warning);
          border-radius: var(--radius-md);
        ">
          💡 ${hint.text}
        </div>
      `;
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

    // Utiliser textContent pour les valeurs dynamiques (sécurité XSS)
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--space-lg);
        text-align: center;
      " role="region" aria-label="Résultats de l'exercice">
        <div style="font-size: 4rem; margin-bottom: var(--space-lg);" aria-hidden="true">
          ${accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪'}
        </div>
        <h2>Exercice terminé !</h2>

        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-lg);
          margin: var(--space-lg) 0;
          width: 100%;
          max-width: 400px;
        " role="group" aria-label="Statistiques">
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-accent);" aria-label="Score">
              ${summary.totalScore}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Points
            </div>
          </div>
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);" aria-label="Taux de réussite">
              ${accuracy}%
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Réussite
            </div>
          </div>
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-warning);" aria-label="Meilleure série">
              ${summary.maxStreak}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Meilleure série
            </div>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-md);" role="group" aria-label="Actions">
          <button id="btn-replay" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-accent);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          " aria-label="Rejouer cet exercice">
            Rejouer
          </button>
          <button id="btn-back-menu" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          " aria-label="Retour au menu principal">
            Menu
          </button>
        </div>
      </div>
    `;

    // Attacher les événements de manière sécurisée (pas de onclick inline)
    const btnReplay = container.querySelector('#btn-replay');
    const btnBackMenu = container.querySelector('#btn-back-menu');

    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        this.startExercise(summary.exerciseId);
      });
    }

    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => {
        this.showView('menu');
      });
    }

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

    // Mettre à jour les skills
    if (summary.skill) {
      const progress = this.dataManager.progress;
      const skill = progress.skills?.[summary.skill];
      if (skill) {
        const newAccuracy = summary.totalCount > 0
          ? summary.correctCount / summary.totalCount
          : 0;
        // Moyenne pondérée
        const updatedAccuracy = skill.attempts > 0
          ? (skill.accuracy * skill.attempts + newAccuracy) / (skill.attempts + 1)
          : newAccuracy;
        this.dataManager.updateSkill(summary.skill, {
          accuracy: updatedAccuracy,
          attempts: skill.attempts + 1,
        });
      }
    }

    // Ajouter XP (calcule automatiquement le level up)
    this.dataManager.addXP(summary.totalScore);

    this.updateLevelBadge();
  }

  /**
   * Termine l'exercice en cours.
   */
  endExercise() {
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

    const progress = this.dataManager.progress;

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;" role="region" aria-label="Ma progression">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Ma progression</h2>
          <button id="btn-back-progress" class="btn-back" aria-label="Retour au menu">
            <span class="btn-back-icon" aria-hidden="true">←</span>
            <span>Retour</span>
          </button>
        </div>

        <!-- Niveau global -->
        <div style="
          padding: var(--space-lg);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          text-align: center;
          margin-bottom: var(--space-lg);
        " role="group" aria-label="Niveau actuel">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            NIVEAU
          </div>
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);" aria-label="Niveau ${progress.level}">
            ${progress.level}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);" aria-label="${progress.xp} points d'expérience">
            ${progress.xp} XP
          </div>
        </div>

        <!-- Compétences -->
        <h3 style="margin-bottom: var(--space-md);">Compétences</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm);" role="list" aria-label="Liste des compétences">
          ${this.renderSkillBar('Clé de sol', progress.skills['treble-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Clé de fa', progress.skills['bass-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Altérations', progress.skills['accidentals']?.accuracy || 0)}
          ${this.renderSkillBar('Intervalles', progress.skills['intervals']?.accuracy || 0)}
        </div>
      </div>
    `;

    // Attacher l'événement de manière sécurisée
    const btnBack = container.querySelector('#btn-back-progress');
    if (btnBack) {
      btnBack.addEventListener('click', () => this.showView('menu'));
    }
  }

  /**
   * Génère une barre de compétence.
   * @param {string} name - Nom de la compétence
   * @param {number} accuracy - Taux de réussite (0-1)
   * @returns {string} HTML
   */
  renderSkillBar(name, accuracy) {
    const percent = Math.round(accuracy * 100);
    return `
      <div style="
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-md);
      " role="listitem">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span id="skill-${name.replace(/\s+/g, '-').toLowerCase()}">${name}</span>
          <span style="color: var(--color-text-muted);">${percent}%</span>
        </div>
        <div style="
          height: 8px;
          background: var(--color-bg);
          border-radius: 4px;
          overflow: hidden;
        " role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-labelledby="skill-${name.replace(/\s+/g, '-').toLowerCase()}">
          <div style="
            width: ${percent}%;
            height: 100%;
            background: var(--color-success);
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
  }

  /**
   * Affiche la vue paramètres.
   */
  renderSettings() {
    const container = this.elements.settingsView;
    if (!container) {return;}

    const isFrench = this.settings.notation === 'french';

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;" role="region" aria-label="Paramètres">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Paramètres</h2>
          <button id="btn-back-settings" class="btn-back" aria-label="Retour au menu">
            <span class="btn-back-icon" aria-hidden="true">←</span>
            <span>Retour</span>
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Notation -->
          <fieldset style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
            border: none;
          ">
            <legend style="font-weight: bold; margin-bottom: var(--space-sm);">
              Notation musicale
            </legend>
            <div class="notation-buttons" style="display: flex; gap: var(--space-sm);" role="radiogroup" aria-label="Choix de la notation musicale">
              <button class="notation-btn ${isFrench ? 'active' : ''}" data-notation="french" role="radio" aria-checked="${isFrench}" style="
                flex: 1;
                padding: var(--space-sm);
                background: ${isFrench ? 'var(--color-accent)' : 'var(--color-bg)'};
                color: ${isFrench ? 'white' : 'var(--color-text)'};
                border: 1px solid ${isFrench ? 'var(--color-accent)' : 'var(--color-border)'};
                border-radius: var(--radius-sm);
                text-align: center;
                cursor: pointer;
              ">
                Do Ré Mi
              </button>
              <button class="notation-btn ${!isFrench ? 'active' : ''}" data-notation="english" role="radio" aria-checked="${!isFrench}" style="
                flex: 1;
                padding: var(--space-sm);
                background: ${!isFrench ? 'var(--color-accent)' : 'var(--color-bg)'};
                color: ${!isFrench ? 'white' : 'var(--color-text)'};
                border: 1px solid ${!isFrench ? 'var(--color-accent)' : 'var(--color-border)'};
                border-radius: var(--radius-sm);
                text-align: center;
                cursor: pointer;
              ">
                C D E
              </button>
            </div>
          </fieldset>

          <!-- Volume -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <label for="volume-slider" style="font-weight: bold; margin-bottom: var(--space-sm); display: block;">
              Volume
            </label>
            <input type="range" id="volume-slider" min="0" max="100" value="80" style="width: 100%;" aria-label="Volume sonore">
          </div>

          <!-- Reset -->
          <button id="btn-reset-progress" style="
            padding: var(--space-md);
            background: var(--color-error);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            margin-top: var(--space-lg);
          " aria-label="Réinitialiser toute la progression (action irréversible)">
            Réinitialiser la progression
          </button>
        </div>
      </div>
    `;

    // Attacher les événements de manière sécurisée
    const btnBack = container.querySelector('#btn-back-settings');
    if (btnBack) {
      btnBack.addEventListener('click', () => this.showView('menu'));
    }

    const btnReset = container.querySelector('#btn-reset-progress');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetProgress());
    }

    // Event listeners pour les boutons de notation
    container.querySelectorAll('.notation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const notation = btn.dataset.notation;
        this.dataManager.setNotation(notation);
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

      this.audioReady = true;

      // Cacher la bannière
      if (this.elements.audioBanner) {
        this.elements.audioBanner.classList.add('hidden');
      }
    } catch (error) {
      console.error('Erreur initialisation audio:', error);
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
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.endsWith('.local') ||
           hostname.endsWith('.lan');
  }

  /**
   * Vérifie si un exercice est débloqué.
   * @param {string} exerciseId - ID de l'exercice
   * @returns {boolean}
   */
  isExerciseUnlocked(exerciseId) {
    // En mode dev, tout est débloqué
    if (this.isDevMode()) {
      return true;
    }

    // Pour l'instant, seul le premier exercice est débloqué par défaut
    const unlockedByDefault = ['note-treble-natural'];
    if (unlockedByDefault.includes(exerciseId)) {
      return true;
    }

    // Les autres sont débloqués selon la progression
    const progress = this.dataManager.progress;

    // Déblocage basé sur les compétences
    switch (exerciseId) {
      case 'note-treble-sharps':
        return (progress.skills['treble-clef']?.accuracy || 0) >= 0.7;
      case 'note-bass-natural':
        return (progress.skills['treble-clef']?.accuracy || 0) >= 0.5;
      case 'interval-basic':
        return progress.level >= 2;
      case 'interval-all':
        return (progress.skills['intervals']?.accuracy || 0) >= 0.6;
      default:
        return false;
    }
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

    // Nettoyer les event listeners globaux
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    if (this._keyupHandler) {
      document.removeEventListener('keyup', this._keyupHandler);
      this._keyupHandler = null;
    }

    // Nettoyer le tuner
    if (this.tunerController) {
      this.tunerController.dispose();
      this.tunerController = null;
    }

    // Nettoyer le métronome
    if (this.metronomeController) {
      this.metronomeController.dispose();
      this.metronomeController = null;
    }

    // Nettoyer le synthétiseur et piano
    if (this.synthController) {
      this.synthController.dispose();
      this.synthController = null;
    }

    if (this.pianoController) {
      this.pianoController.dispose();
      this.pianoController = null;
    }

    if (this.menuController) {
      this.menuController.dispose();
      this.menuController = null;
    }

    if (this.rhythmController) {
      this.rhythmController.dispose();
      this.rhythmController = null;
    }

    if (this.synthManager) {
      this.synthManager.dispose();
      this.synthManager = null;
    }

    // Nettoyer les renderers
    if (this.questionRenderer) {
      this.questionRenderer.dispose();
      this.questionRenderer = null;
    }

    if (this.staffRenderer) {
      this.staffRenderer.dispose();
      this.staffRenderer = null;
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
   * @param {string} text - Texte à échapper
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
    try {
      await this.synthManager?.ensureAudioReady();
      this.audioReady = true;
      if (this.elements.audioBanner) {
        this.elements.audioBanner.classList.add('hidden');
      }
    } catch (error) {
      console.error('Erreur démarrage audio:', error);
      return;
    }

    // Jouer via le synthé partagé
    this.audioEngine?.playPianoNote(pitch, 0.8);
  }

  /**
   * Joue un accord avec l'audio.
   * @param {import('./core/Pitch.js').Pitch[]} pitches - Notes de l'accord
   */
  async playChordAudio(pitches) {
    try {
      await this.synthManager?.ensureAudioReady();
      this.audioReady = true;
      if (this.elements.audioBanner) {
        this.elements.audioBanner.classList.add('hidden');
      }
    } catch (error) {
      console.error('Erreur démarrage audio:', error);
      return;
    }

    // Jouer via le synthé partagé
    this.audioEngine?.playPianoChord(pitches, 1);
  }
}
