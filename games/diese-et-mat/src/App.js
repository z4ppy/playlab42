/**
 * Diese & Mat - Orchestrateur principal de l'application
 *
 * Gère la navigation entre les vues, l'état global et le cycle de vie.
 *
 * @module App
 */

import GameKit from '../../../lib/gamekit.js';
import { ExerciseEngine } from './engine/ExerciseEngine.js';
import { StaffRenderer } from './renderer/StaffRenderer.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { Metronome } from './audio/Metronome.js';

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

    /** @type {Object|null} Données de progression */
    this.progress = null;

    /** @type {boolean} Audio initialisé */
    this.audioReady = false;

    /** @type {Object} Références aux éléments DOM */
    this.elements = {};

    /** @type {ExerciseEngine|null} Moteur d'exercice */
    this.engine = null;

    /** @type {StaffRenderer|null} Renderer de portée */
    this.staffRenderer = null;

    /** @type {Object|null} Données des exercices */
    this.exercisesData = null;

    /** @type {AudioEngine|null} Moteur audio */
    this.audioEngine = null;

    /** @type {Metronome|null} Métronome */
    this.metronome = null;

    /** @type {Object|null} État du mode rythme */
    this.rhythmState = null;

    /** @type {Object} Paramètres utilisateur */
    this.settings = {
      notation: 'french', // 'french' | 'english'
      volume: 80,
    };

    /** @type {Object} Filtres du menu d'exercices */
    this.menuFilters = {
      category: 'all',    // 'all' | 'notes' | 'intervals' | 'chords' | 'rhythm'
      difficulty: 'all',  // 'all' | 1 | 2 | 3
      showLocked: true,   // Afficher les exercices verrouillés
    };

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

    // Charger la progression et les paramètres sauvegardés
    this.loadProgress();
    this.loadSettings();

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

    // Bouton métronome
    this.elements.btnMetronome?.addEventListener('click', () => {
      this.showMetronome();
    });

    this.elements.metronomeClose?.addEventListener('click', () => {
      this.hideMetronome();
    });

    this.elements.metronomeOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.metronomeOverlay) {
        this.hideMetronome();
      }
    });

    // Bouton accordeur
    this.elements.btnTuner?.addEventListener('click', () => {
      this.showTuner();
    });

    this.elements.tunerClose?.addEventListener('click', () => {
      this.hideTuner();
    });

    this.elements.tunerOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.tunerOverlay) {
        this.hideTuner();
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
    document.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
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
    const container = this.elements.menuView;
    if (!container) {return;}

    // Filtrer les exercices
    const filteredExercises = this._getFilteredExercises();

    container.innerHTML = `
      <div class="menu-container">
        <h2 class="menu-title">Choisissez un exercice</h2>

        <!-- Barre de filtres -->
        <div class="filters-bar">
          <div class="filter-group">
            <label class="filter-label">Catégorie</label>
            <div class="filter-buttons" id="filter-category">
              <button class="filter-btn ${this.menuFilters.category === 'all' ? 'active' : ''}" data-value="all">Tous</button>
              <button class="filter-btn ${this.menuFilters.category === 'notes' ? 'active' : ''}" data-value="notes">🎼 Notes</button>
              <button class="filter-btn ${this.menuFilters.category === 'intervals' ? 'active' : ''}" data-value="intervals">↕️ Intervalles</button>
              <button class="filter-btn ${this.menuFilters.category === 'chords' ? 'active' : ''}" data-value="chords">🎹 Accords</button>
              <button class="filter-btn ${this.menuFilters.category === 'rhythm' ? 'active' : ''}" data-value="rhythm">🥁 Rythme</button>
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">Difficulté</label>
            <div class="filter-buttons" id="filter-difficulty">
              <button class="filter-btn ${this.menuFilters.difficulty === 'all' ? 'active' : ''}" data-value="all">Tous</button>
              <button class="filter-btn ${this.menuFilters.difficulty === 1 ? 'active' : ''}" data-value="1">★☆☆</button>
              <button class="filter-btn ${this.menuFilters.difficulty === 2 ? 'active' : ''}" data-value="2">★★☆</button>
              <button class="filter-btn ${this.menuFilters.difficulty === 3 ? 'active' : ''}" data-value="3">★★★</button>
            </div>
          </div>

          <div class="filter-group filter-toggle">
            <label class="toggle-label">
              <input type="checkbox" id="filter-locked" ${this.menuFilters.showLocked ? 'checked' : ''}>
              <span>Afficher verrouillés</span>
            </label>
          </div>
        </div>

        <!-- Compteur de résultats -->
        <div class="filter-results">
          ${filteredExercises.length} exercice${filteredExercises.length > 1 ? 's' : ''} trouvé${filteredExercises.length > 1 ? 's' : ''}
        </div>

        <!-- Grille d'exercices -->
        <div class="exercises-grid">
          ${this._renderExerciseCards(filteredExercises)}
        </div>
      </div>
    `;

    // Event listeners pour les filtres
    this._setupFilterListeners(container);

    // Event listeners sur les cartes
    container.querySelectorAll('.exercise-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseId = card.dataset.exerciseId;
        this.startExercise(exerciseId);
      });
    });
  }

  /**
   * Génère le HTML des cartes d'exercices.
   * @param {Array} exercises - Liste des exercices à afficher
   * @returns {string} HTML des cartes
   * @private
   */
  _renderExerciseCards(exercises) {
    if (exercises.length === 0) {
      return '<div class="no-results">Aucun exercice ne correspond aux filtres sélectionnés.</div>';
    }

    return exercises.map(ex => this.renderExerciseCard(
      ex.id,
      ex.title,
      ex.description,
      ex.difficulty,
      !this.isExerciseUnlocked(ex.id),
      ex.icon,
      ex.categoryName,
    )).join('');
  }

  /**
   * Retourne les exercices filtrés selon les critères actuels.
   * @returns {Array} Exercices filtrés
   * @private
   */
  _getFilteredExercises() {
    return this.exercisesList.filter(ex => {
      // Filtre par catégorie
      if (this.menuFilters.category !== 'all' && ex.category !== this.menuFilters.category) {
        return false;
      }

      // Filtre par difficulté
      if (this.menuFilters.difficulty !== 'all' && ex.difficulty !== this.menuFilters.difficulty) {
        return false;
      }

      // Filtre par état verrouillé
      if (!this.menuFilters.showLocked && !this.isExerciseUnlocked(ex.id)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Configure les event listeners des filtres.
   * @param {HTMLElement} container - Conteneur du menu
   * @private
   */
  _setupFilterListeners(container) {
    // Filtres catégorie
    container.querySelector('#filter-category')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (btn) {
        this.menuFilters.category = btn.dataset.value;
        this.renderMenu();
      }
    });

    // Filtres difficulté
    container.querySelector('#filter-difficulty')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (btn) {
        const value = btn.dataset.value;
        this.menuFilters.difficulty = value === 'all' ? 'all' : parseInt(value, 10);
        this.renderMenu();
      }
    });

    // Toggle verrouillés
    container.querySelector('#filter-locked')?.addEventListener('change', (e) => {
      this.menuFilters.showLocked = e.target.checked;
      this.renderMenu();
    });
  }

  /**
   * Génère le HTML d'une carte d'exercice.
   * @param {string} id - ID de l'exercice
   * @param {string} title - Titre
   * @param {string} description - Description
   * @param {number} difficulty - Difficulté (1-5)
   * @param {boolean} locked - Verrouillé
   * @returns {string} HTML
   */
  renderExerciseCard(id, title, description, difficulty, locked = false, categoryIcon = '', categoryName = '') {
    const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
    const progress = this.getExerciseProgress(id);

    return `
      <div class="exercise-card ${locked ? 'locked' : ''}" data-exercise-id="${id}">
        <div class="exercise-card-category">
          <span class="category-icon">${categoryIcon}</span>
          <span class="category-name">${categoryName}</span>
        </div>
        <div class="exercise-card-content">
          <div class="exercise-card-info">
            <div class="exercise-card-title">
              ${locked ? '🔒 ' : ''}${title}
            </div>
            <div class="exercise-card-description">${description}</div>
          </div>
          <div class="exercise-card-meta">
            <div class="exercise-card-stars">${stars}</div>
            ${progress > 0 ? `<div class="exercise-card-progress">${Math.round(progress * 100)}%</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Démarre un exercice.
   * @param {string} exerciseId - ID de l'exercice
   */
  async startExercise(exerciseId) {
    // Charger les données d'exercices si pas encore fait
    if (!this.exercisesData) {
      try {
        const response = await fetch('./data/exercises.json');
        this.exercisesData = await response.json();
      } catch (error) {
        console.error('Erreur chargement exercises.json:', error);
        return;
      }
    }

    // Trouver l'exercice
    const exercise = this.exercisesData.exercises.find(e => e.id === exerciseId);
    if (!exercise) {
      console.error('Exercice non trouvé:', exerciseId);
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
        <div id="feedback-container" style="
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
            color: white;
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
        <button class="note-btn" data-semitones="${int.value}" title="${int.name}" style="
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
        this.showEarTrainingQuestion(question);
      } else {
        // Question de lecture de note
        this.staffRenderer.renderNote(question.pitch);
      }
    } else if (question.type === 'interval') {
      // Question d'intervalle - afficher les 2 notes
      this.showIntervalQuestion(question);
    } else if (question.type === 'chord') {
      // Question d'accord - afficher les notes de l'accord
      this.showChordQuestion(question);
    } else if (question.type === 'rhythm') {
      // Question de rythme - afficher le pattern
      this.showRhythmQuestion(question);
    }
  }

  /**
   * Affiche une question d'ear training (audio uniquement).
   * @param {Object} question - Question de note
   */
  showEarTrainingQuestion(question) {
    const staffContainer = document.getElementById('staff-container');
    if (!staffContainer) {return;}

    // Afficher un indicateur visuel au lieu de la note
    staffContainer.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: var(--space-md);
      ">
        <div style="
          font-size: 4rem;
          color: var(--color-accent);
        ">🎧</div>
        <div style="
          font-size: var(--font-size-lg);
          color: var(--color-text);
          text-align: center;
        ">
          Écoutez la note et identifiez-la
        </div>
        <div style="
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        ">
          Cliquez sur "Écouter" pour rejouer
        </div>
      </div>
    `;

    // Jouer automatiquement la note après un court délai
    setTimeout(() => {
      this.playNoteAudio(question.pitch);
    }, 300);
  }

  /**
   * Affiche une question d'intervalle (2 notes).
   * @param {Object} question - Question d'intervalle
   */
  showIntervalQuestion(question) {
    const staffContainer = document.getElementById('staff-container');

    // Afficher les 2 notes visuellement
    // Pour l'instant, afficher un texte + la première note sur la portée
    const note1 = question.pitch1.toFrench();
    const note2 = question.pitch2.toFrench();

    // Clear et afficher la première note
    this.staffRenderer.clear();
    this.staffRenderer.renderNote(question.pitch1);

    // Ajouter un indicateur visuel pour la 2ème note
    const infoDiv = document.createElement('div');
    infoDiv.id = 'interval-info';
    infoDiv.style.cssText = `
      text-align: center;
      margin-top: var(--space-sm);
      font-size: var(--font-size-lg);
      color: var(--color-text);
    `;
    infoDiv.innerHTML = `
      <span style="color: var(--color-accent);">${note1}</span>
      <span style="margin: 0 var(--space-sm);">→</span>
      <span style="color: var(--color-success);">${note2}</span>
      <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
        Quel intervalle ?
      </div>
    `;

    // Supprimer l'ancien indicateur s'il existe
    const oldInfo = document.getElementById('interval-info');
    if (oldInfo) {oldInfo.remove();}

    staffContainer.appendChild(infoDiv);
  }

  /**
   * Affiche une question d'accord.
   * @param {Object} question - Question d'accord
   */
  showChordQuestion(question) {
    const staffContainer = document.getElementById('staff-container');

    // Récupérer les notes de l'accord
    const chord = question.chord;
    const pitches = chord.getPitches();
    const notesStr = pitches.map(p => p.toFrench()).join(' - ');

    // Clear et afficher la fondamentale
    this.staffRenderer.clear();
    this.staffRenderer.renderNote(chord.root);

    // Ajouter un indicateur visuel pour l'accord
    const infoDiv = document.createElement('div');
    infoDiv.id = 'chord-info';
    infoDiv.style.cssText = `
      text-align: center;
      margin-top: var(--space-sm);
      font-size: var(--font-size-lg);
      color: var(--color-text);
    `;
    infoDiv.innerHTML = `
      <div style="font-size: var(--font-size-md); color: var(--color-accent);">
        ${notesStr}
      </div>
      <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
        Quel type d'accord ?
      </div>
    `;

    // Supprimer l'ancien indicateur s'il existe
    const oldInfo = document.getElementById('chord-info');
    if (oldInfo) {oldInfo.remove();}
    const oldIntervalInfo = document.getElementById('interval-info');
    if (oldIntervalInfo) {oldIntervalInfo.remove();}

    staffContainer.appendChild(infoDiv);
  }

  /**
   * Affiche une question de rythme avec curseur défilant.
   * @param {Object} question - Question de rythme
   */
  showRhythmQuestion(question) {
    const staffContainer = document.getElementById('staff-container');
    staffContainer.innerHTML = '';

    // Symboles et noms des durées
    const durationSymbols = {
      whole: '𝅝', half: '𝅗𝅥', quarter: '♩', eighth: '♪',
    };
    const durationNames = {
      whole: 'Ronde', half: 'Blanche', quarter: 'Noire', eighth: 'Croche',
    };

    // Construire la piste de rythme
    const container = document.createElement('div');
    container.className = 'rhythm-container';

    // Créer les cellules de beats
    const track = document.createElement('div');
    track.className = 'rhythm-track';
    track.id = 'rhythm-track';

    // Générer les cellules pour chaque beat de la mesure
    const beatDuration = 60000 / question.tempo;
    const cells = [];

    for (let beat = 0; beat < question.beatsPerMeasure; beat++) {
      const cell = document.createElement('div');
      cell.className = 'rhythm-beat';
      cell.dataset.beat = beat;

      // Trouver si une note commence sur ce beat
      const note = question.pattern.find(n => Math.floor(n.startBeat) === beat);

      if (note) {
        cell.dataset.hasNote = 'true';
        cell.dataset.noteIndex = question.pattern.indexOf(note);
        cell.innerHTML = `
          <div class="rhythm-beat-symbol">${durationSymbols[note.duration]}</div>
          <div class="rhythm-beat-label">${durationNames[note.duration]}</div>
        `;
      } else {
        cell.innerHTML = `
          <div class="rhythm-beat-symbol" style="opacity: 0.3;">·</div>
          <div class="rhythm-beat-label">-</div>
        `;
      }

      cells.push(cell);
      track.appendChild(cell);
    }

    // Curseur
    const cursor = document.createElement('div');
    cursor.className = 'rhythm-cursor';
    cursor.id = 'rhythm-cursor';
    track.appendChild(cursor);

    // Zone de tap
    const tapZone = document.createElement('div');
    tapZone.className = 'rhythm-tap-zone';
    tapZone.id = 'rhythm-tap-zone';
    tapZone.textContent = 'TAP';

    // Score en temps réel
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'rhythm-score';
    scoreDisplay.id = 'rhythm-score';
    scoreDisplay.innerHTML = `
      <div class="rhythm-score-item">
        <div class="rhythm-score-value" id="rhythm-hits">0</div>
        <div class="rhythm-score-label">Réussis</div>
      </div>
      <div class="rhythm-score-item">
        <div class="rhythm-score-value" id="rhythm-misses">0</div>
        <div class="rhythm-score-label">Manqués</div>
      </div>
    `;

    // Info tempo
    const tempoInfo = document.createElement('div');
    tempoInfo.style.cssText = 'font-size: var(--font-size-sm); color: var(--color-text-muted);';
    tempoInfo.textContent = `Tempo: ${question.tempo} BPM`;

    // Bouton démarrer
    const startBtn = document.createElement('button');
    startBtn.id = 'btn-start-rhythm';
    startBtn.style.cssText = `
      padding: var(--space-sm) var(--space-lg);
      background: var(--color-success);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--font-size-md);
      color: white;
    `;
    startBtn.textContent = '▶ Démarrer';
    startBtn.addEventListener('click', () => this.startRhythmExercise());

    container.appendChild(track);
    container.appendChild(tapZone);
    container.appendChild(scoreDisplay);
    container.appendChild(tempoInfo);
    container.appendChild(startBtn);
    staffContainer.appendChild(container);

    // Events tap
    tapZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handleRhythmTap();
    });
    tapZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleRhythmTap();
    });

    // Initialiser l'état du rythme
    this.rhythmState = {
      pattern: question.pattern,
      beatsPerMeasure: question.beatsPerMeasure,
      tempo: question.tempo,
      beatDuration,
      cells,
      currentBeat: -1,
      hits: 0,
      misses: 0,
      noteResults: new Array(question.pattern.length).fill(null),
      started: false,
      startTime: null,
      animationId: null,
    };
  }

  /**
   * Démarre l'exercice de rythme avec compte à rebours.
   */
  async startRhythmExercise() {
    if (!this.rhythmState) {return;}

    // Cacher le bouton démarrer
    const startBtn = document.getElementById('btn-start-rhythm');
    if (startBtn) {startBtn.style.display = 'none';}

    // Initialiser l'audio
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }

    try {
      await this.audioEngine.start();

      // Créer/configurer le métronome
      if (!this.metronome) {
        this.metronome = new Metronome(this.audioEngine, {
          tempo: this.rhythmState.tempo,
          timeSignature: { beats: this.rhythmState.beatsPerMeasure, beatValue: 4 },
        });
      } else {
        this.metronome.setTempo(this.rhythmState.tempo);
        this.metronome.setTimeSignature(this.rhythmState.beatsPerMeasure, 4);
      }
    } catch {
      console.warn('Audio non disponible, mode silencieux');
    }

    // Compte à rebours
    this._rhythmCountdown(3);
  }

  /**
   * Compte à rebours avant le rythme.
   * @param {number} count - Nombre de temps
   */
  _rhythmCountdown(count) {
    const feedbackContainer = document.getElementById('feedback-container');
    const beatDuration = this.rhythmState.beatDuration;

    if (count > 0) {
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);">
            ${count}
          </div>
        `;
      }
      // Jouer un tick
      if (this.metronome?._clickSynth) {
        this.metronome._playClick(count === 1);
      }
      setTimeout(() => this._rhythmCountdown(count - 1), beatDuration);
    } else {
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `
          <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);">
            GO!
          </div>
        `;
      }
      setTimeout(() => {
        if (feedbackContainer) {feedbackContainer.innerHTML = '';}
        this._startRhythmPlayback();
      }, 300);
    }
  }

  /**
   * Démarre la lecture du rythme avec curseur.
   */
  _startRhythmPlayback() {
    this.rhythmState.started = true;
    this.rhythmState.startTime = Date.now();
    this.rhythmState.currentBeat = -1;

    // Démarrer le métronome
    if (this.metronome) {
      this.metronome.start();
    }

    // Animation du curseur
    this._animateRhythmCursor();
  }

  /**
   * Anime le curseur et gère le timing.
   */
  _animateRhythmCursor() {
    if (!this.rhythmState?.started) {return;}

    const { beatDuration, beatsPerMeasure, cells } = this.rhythmState;
    const elapsed = Date.now() - this.rhythmState.startTime;
    const totalDuration = beatDuration * beatsPerMeasure;

    // Position du curseur (0 à 100%)
    const progress = Math.min(elapsed / totalDuration, 1);
    const cursor = document.getElementById('rhythm-cursor');
    const track = document.getElementById('rhythm-track');

    if (cursor && track) {
      const trackWidth = track.offsetWidth - 4; // -4 pour la largeur du curseur
      cursor.style.left = `${progress * trackWidth}px`;
    }

    // Déterminer le beat actuel
    const currentBeat = Math.floor((elapsed / beatDuration));

    // Nouveau beat ?
    if (currentBeat !== this.rhythmState.currentBeat && currentBeat < beatsPerMeasure) {
      this.rhythmState.currentBeat = currentBeat;

      // Mettre à jour les cellules
      cells.forEach((cell, i) => {
        cell.classList.remove('active');
        if (i === currentBeat) {
          cell.classList.add('active');
        }
      });

      // Vérifier les notes manquées du beat précédent
      if (currentBeat > 0) {
        this._checkMissedNotes(currentBeat - 1);
      }
    }

    // Continuer ou terminer
    if (progress < 1) {
      this.rhythmState.animationId = requestAnimationFrame(() => this._animateRhythmCursor());
    } else {
      // Vérifier le dernier beat
      this._checkMissedNotes(beatsPerMeasure - 1);
      this._endRhythmExercise();
    }
  }

  /**
   * Vérifie les notes manquées sur un beat.
   * @param {number} beat - Numéro du beat
   */
  _checkMissedNotes(beat) {
    const { pattern, noteResults, cells } = this.rhythmState;

    pattern.forEach((note, i) => {
      if (Math.floor(note.startBeat) === beat && noteResults[i] === null) {
        // Note manquée
        noteResults[i] = false;
        this.rhythmState.misses++;
        this._updateRhythmScore();

        // Feedback visuel
        const cell = cells[beat];
        if (cell) {
          cell.classList.add('miss');
        }
      }
    });
  }

  /**
   * Gère un tap de l'utilisateur.
   */
  handleRhythmTap() {
    // Feedback visuel du tap
    const tapZone = document.getElementById('rhythm-tap-zone');
    if (tapZone) {
      tapZone.classList.add('pressed');
      setTimeout(() => tapZone.classList.remove('pressed'), 100);
    }

    if (!this.rhythmState?.started) {
      // Si pas démarré, démarrer l'exercice
      const startBtn = document.getElementById('btn-start-rhythm');
      if (startBtn && startBtn.style.display !== 'none') {
        this.startRhythmExercise();
      }
      return;
    }

    const { beatDuration, pattern, noteResults, cells, startTime } = this.rhythmState;
    const tapTime = Date.now() - startTime;
    const tolerance = beatDuration / 3; // Tolérance généreuse

    // Chercher la note la plus proche non encore tapée
    let bestMatch = null;
    let bestDiff = Infinity;

    pattern.forEach((note, i) => {
      if (noteResults[i] !== null) {return;} // Déjà traité

      const noteTime = note.startBeat * beatDuration;
      const diff = Math.abs(tapTime - noteTime);

      if (diff < bestDiff && diff <= tolerance) {
        bestDiff = diff;
        bestMatch = i;
      }
    });

    if (bestMatch !== null) {
      // Hit !
      noteResults[bestMatch] = true;
      this.rhythmState.hits++;

      // Feedback visuel
      const note = pattern[bestMatch];
      const cell = cells[Math.floor(note.startBeat)];
      if (cell) {
        cell.classList.add('hit');
      }
    }
    // Note: on ne compte pas les taps en trop pour être plus indulgent

    this._updateRhythmScore();
  }

  /**
   * Met à jour l'affichage du score.
   */
  _updateRhythmScore() {
    const hitsEl = document.getElementById('rhythm-hits');
    const missesEl = document.getElementById('rhythm-misses');

    if (hitsEl) {hitsEl.textContent = this.rhythmState.hits;}
    if (missesEl) {missesEl.textContent = this.rhythmState.misses;}
  }

  /**
   * Termine l'exercice de rythme.
   */
  _endRhythmExercise() {
    if (!this.rhythmState) {return;}

    // Arrêter
    this.rhythmState.started = false;
    if (this.rhythmState.animationId) {
      cancelAnimationFrame(this.rhythmState.animationId);
    }
    if (this.metronome) {
      this.metronome.stop();
    }

    // Calculer le résultat
    const { hits, pattern } = this.rhythmState;
    const total = pattern.length;
    const accuracy = total > 0 ? hits / total : 0;
    const isCorrect = accuracy >= 0.7;

    // Soumettre au moteur
    if (this.engine) {
      this.engine.submitAnswer(isCorrect ? 'correct' : 'incorrect');
    }

    // Afficher le feedback final
    const feedbackContainer = document.getElementById('feedback-container');
    if (feedbackContainer) {
      const percent = Math.round(accuracy * 100);
      feedbackContainer.innerHTML = `
        <div style="
          padding: var(--space-md);
          background: rgba(${isCorrect ? '76, 175, 80' : '244, 67, 54'}, 0.1);
          border-radius: var(--radius-md);
          text-align: center;
        ">
          <div style="font-size: 2rem;">${isCorrect ? '✓' : '✗'}</div>
          <div style="color: var(--color-${isCorrect ? 'success' : 'error'}); font-weight: bold;">
            ${percent}% - ${hits}/${total} notes
          </div>
        </div>
      `;
    }

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

    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--space-lg);
        text-align: center;
      ">
        <div style="font-size: 4rem; margin-bottom: var(--space-lg);">
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
        ">
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-accent);">
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
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);">
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
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-warning);">
              ${summary.maxStreak}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Meilleure série
            </div>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-md);">
          <button onclick="app.startExercise('${summary.exerciseId}')" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-accent);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          ">
            Rejouer
          </button>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          ">
            Menu
          </button>
        </div>
      </div>
    `;

    // Sauvegarder la progression
    this.updateProgressFromSession(summary);
  }

  /**
   * Met à jour la progression après une session.
   * @param {Object} summary - Résumé de la session
   */
  updateProgressFromSession(summary) {
    if (!this.progress) {return;}

    // Ajouter à l'historique
    this.progress.history.push({
      exerciseId: summary.exerciseId,
      score: summary.totalScore,
      maxScore: summary.totalCount * 10,
      accuracy: summary.totalCount > 0 ? summary.correctCount / summary.totalCount : 0,
      date: new Date().toISOString(),
    });

    // Mettre à jour les skills
    if (summary.skill && this.progress.skills[summary.skill]) {
      const skill = this.progress.skills[summary.skill];
      const newAccuracy = summary.totalCount > 0
        ? summary.correctCount / summary.totalCount
        : 0;
      // Moyenne pondérée
      skill.accuracy = skill.attempts > 0
        ? (skill.accuracy * skill.attempts + newAccuracy) / (skill.attempts + 1)
        : newAccuracy;
      skill.attempts++;
    }

    // Ajouter XP
    this.progress.xp += summary.totalScore;

    // Level up tous les 500 XP
    const newLevel = Math.floor(this.progress.xp / 500) + 1;
    if (newLevel > this.progress.level) {
      this.progress.level = newLevel;
    }

    this.saveProgress();
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

    const progress = this.progress || this.getDefaultProgress();

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Ma progression</h2>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-xs) var(--space-sm);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            cursor: pointer;
          ">← Retour</button>
        </div>

        <!-- Niveau global -->
        <div style="
          padding: var(--space-lg);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          text-align: center;
          margin-bottom: var(--space-lg);
        ">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            NIVEAU
          </div>
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);">
            ${progress.level}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            ${progress.xp} XP
          </div>
        </div>

        <!-- Compétences -->
        <h3 style="margin-bottom: var(--space-md);">Compétences</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
          ${this.renderSkillBar('Clé de sol', progress.skills['treble-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Clé de fa', progress.skills['bass-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Altérations', progress.skills['accidentals']?.accuracy || 0)}
          ${this.renderSkillBar('Intervalles', progress.skills['intervals']?.accuracy || 0)}
        </div>
      </div>
    `;
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
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span>${name}</span>
          <span style="color: var(--color-text-muted);">${percent}%</span>
        </div>
        <div style="
          height: 8px;
          background: var(--color-bg);
          border-radius: 4px;
          overflow: hidden;
        ">
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
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Paramètres</h2>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-xs) var(--space-sm);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            cursor: pointer;
          ">← Retour</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Notation -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-weight: bold; margin-bottom: var(--space-sm);">
              Notation musicale
            </div>
            <div class="notation-buttons" style="display: flex; gap: var(--space-sm);">
              <label class="notation-btn ${isFrench ? 'active' : ''}" data-notation="french" style="
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
              </label>
              <label class="notation-btn ${!isFrench ? 'active' : ''}" data-notation="english" style="
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
              </label>
            </div>
          </div>

          <!-- Volume -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-weight: bold; margin-bottom: var(--space-sm);">
              Volume
            </div>
            <input type="range" min="0" max="100" value="80" style="width: 100%;">
          </div>

          <!-- Reset -->
          <button onclick="app.resetProgress()" style="
            padding: var(--space-md);
            background: var(--color-error);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            margin-top: var(--space-lg);
          ">
            Réinitialiser la progression
          </button>
        </div>
      </div>
    `;

    // Event listeners pour les boutons de notation
    container.querySelectorAll('.notation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const notation = btn.dataset.notation;
        this.settings.notation = notation;
        this.saveSettings();
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
    if (this.elements.pianoOverlay) {
      this.elements.pianoOverlay.classList.add('visible');
      this._initPianoKeyboard();
    }
  }

  /**
   * Cache le clavier piano.
   */
  hidePiano() {
    if (this.elements.pianoOverlay) {
      this.elements.pianoOverlay.classList.remove('visible');
    }
  }

  /**
   * Affiche le panel synthétiseur.
   */
  showSynth() {
    if (this.elements.synthOverlay) {
      this.elements.synthOverlay.classList.add('visible');
      this._initSynthPanel();
    }
  }

  /**
   * Cache le panel synthétiseur.
   */
  hideSynth() {
    if (this.elements.synthOverlay) {
      this.elements.synthOverlay.classList.remove('visible');
    }
  }

  /**
   * Initialise le panel synthétiseur.
   */
  _initSynthPanel() {
    if (this._synthPanelInitialized) {
      return;
    }

    // Charger les réglages sauvegardés
    this._loadSynthSettings();

    // Générer les boutons de presets
    this._renderSynthPresets();

    // Générer les boutons d'oscillateurs
    this._renderSynthOscillators();

    // Configurer les sliders ADSR
    this._setupADSRSliders();

    // Configurer les contrôles d'effets
    this._setupEffectsControls();

    this._synthPanelInitialized = true;
  }

  /**
   * Charge les réglages du synthé depuis le stockage.
   */
  _loadSynthSettings() {
    try {
      const saved = localStorage.getItem('diese-synth-config');
      if (saved) {
        this._synthConfig = JSON.parse(saved);
      }
    } catch {
      console.warn('Erreur chargement config synthé');
    }

    // Config par défaut si pas de sauvegarde
    if (!this._synthConfig) {
      this._synthConfig = {
        preset: 'piano',
        oscillator: 'triangle',
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
        effects: {
          reverb: { enabled: false, amount: 0.3 },
          delay: { enabled: false, time: 0.2, feedback: 0.3 },
          filter: { enabled: false, frequency: 2000 },
        },
      };
    }
  }

  /**
   * Sauvegarde les réglages du synthé.
   */
  _saveSynthSettings() {
    if (this.audioEngine) {
      this._synthConfig = this.audioEngine.getSettings();
    }
    try {
      localStorage.setItem('diese-synth-config', JSON.stringify(this._synthConfig));
    } catch {
      console.warn('Erreur sauvegarde config synthé');
    }
  }

  /**
   * Génère les boutons de presets.
   */
  _renderSynthPresets() {
    const container = this.elements.synthPresets;
    if (!container) {
      return;
    }

    const presets = AudioEngine.getPresets();
    container.innerHTML = '';

    Object.entries(presets).forEach(([key, preset]) => {
      const btn = document.createElement('button');
      btn.className = 'synth-preset-btn';
      btn.dataset.preset = key;
      btn.textContent = preset.name;

      if (this._synthConfig.preset === key) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        this._selectPreset(key);
      });

      container.appendChild(btn);
    });
  }

  /**
   * Génère les boutons d'oscillateurs.
   */
  _renderSynthOscillators() {
    const container = this.elements.synthOscillators;
    if (!container) {
      return;
    }

    const oscillators = AudioEngine.getOscillatorTypes();
    const icons = {
      sine: '∿',
      triangle: '△',
      square: '⊓',
      sawtooth: '⋀',
    };

    container.innerHTML = '';

    oscillators.forEach((type) => {
      const btn = document.createElement('button');
      btn.className = 'synth-osc-btn';
      btn.dataset.oscillator = type;
      btn.innerHTML = `
        <span class="synth-osc-icon">${icons[type] || '~'}</span>
        <span>${type}</span>
      `;

      if (this._synthConfig.oscillator === type) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        this._selectOscillator(type);
      });

      container.appendChild(btn);
    });
  }

  /**
   * Configure les sliders ADSR.
   */
  _setupADSRSliders() {
    const config = this._synthConfig.envelope;

    // Attack (0.001 - 2s)
    const attackSlider = document.getElementById('adsr-attack');
    const attackValue = document.getElementById('adsr-attack-value');
    if (attackSlider) {
      attackSlider.value = config.attack * 1000;
      attackValue.textContent = `${config.attack.toFixed(2)}s`;
      attackSlider.addEventListener('input', () => {
        const value = attackSlider.value / 1000;
        attackValue.textContent = `${value.toFixed(2)}s`;
        this._updateEnvelope({ attack: value });
      });
    }

    // Decay (0.01 - 2s)
    const decaySlider = document.getElementById('adsr-decay');
    const decayValue = document.getElementById('adsr-decay-value');
    if (decaySlider) {
      decaySlider.value = config.decay * 1000;
      decayValue.textContent = `${config.decay.toFixed(2)}s`;
      decaySlider.addEventListener('input', () => {
        const value = decaySlider.value / 1000;
        decayValue.textContent = `${value.toFixed(2)}s`;
        this._updateEnvelope({ decay: value });
      });
    }

    // Sustain (0 - 1)
    const sustainSlider = document.getElementById('adsr-sustain');
    const sustainValue = document.getElementById('adsr-sustain-value');
    if (sustainSlider) {
      sustainSlider.value = config.sustain * 100;
      sustainValue.textContent = config.sustain.toFixed(2);
      sustainSlider.addEventListener('input', () => {
        const value = sustainSlider.value / 100;
        sustainValue.textContent = value.toFixed(2);
        this._updateEnvelope({ sustain: value });
      });
    }

    // Release (0.01 - 5s)
    const releaseSlider = document.getElementById('adsr-release');
    const releaseValue = document.getElementById('adsr-release-value');
    if (releaseSlider) {
      releaseSlider.value = config.release * 1000;
      releaseValue.textContent = `${config.release.toFixed(2)}s`;
      releaseSlider.addEventListener('input', () => {
        const value = releaseSlider.value / 1000;
        releaseValue.textContent = `${value.toFixed(2)}s`;
        this._updateEnvelope({ release: value });
      });
    }
  }

  /**
   * Configure les contrôles d'effets.
   */
  _setupEffectsControls() {
    const effects = this._synthConfig.effects;

    // Reverb
    this._setupEffectControl('reverb', effects.reverb, {
      amount: {
        element: 'fx-reverb-amount',
        valueElement: 'fx-reverb-amount-value',
        toDisplay: (v) => `${Math.round(v * 100)}%`,
        fromSlider: (v) => v / 100,
        toSlider: (v) => v * 100,
      },
    });

    // Delay
    this._setupEffectControl('delay', effects.delay, {
      time: {
        element: 'fx-delay-time',
        valueElement: 'fx-delay-time-value',
        toDisplay: (v) => `${v.toFixed(2)}s`,
        fromSlider: (v) => v / 1000,
        toSlider: (v) => v * 1000,
      },
      feedback: {
        element: 'fx-delay-feedback',
        valueElement: 'fx-delay-feedback-value',
        toDisplay: (v) => `${Math.round(v * 100)}%`,
        fromSlider: (v) => v / 100,
        toSlider: (v) => v * 100,
      },
    });

    // Filter
    this._setupEffectControl('filter', effects.filter, {
      frequency: {
        element: 'fx-filter-frequency',
        valueElement: 'fx-filter-frequency-value',
        toDisplay: (v) => `${Math.round(v)} Hz`,
        fromSlider: (v) => parseFloat(v),
        toSlider: (v) => v,
      },
    });
  }

  /**
   * Configure un contrôle d'effet.
   */
  _setupEffectControl(effectName, config, params) {
    const enabledCheckbox = document.getElementById(`fx-${effectName}-enabled`);
    const effectContainer = enabledCheckbox?.closest('.synth-effect');

    if (enabledCheckbox) {
      enabledCheckbox.checked = config.enabled;
      if (config.enabled) {
        effectContainer?.classList.add('active');
      }

      enabledCheckbox.addEventListener('change', () => {
        const enabled = enabledCheckbox.checked;
        if (enabled) {
          effectContainer?.classList.add('active');
        } else {
          effectContainer?.classList.remove('active');
        }
        this._updateEffect(effectName, { enabled });
      });
    }

    // Configure chaque paramètre
    Object.entries(params).forEach(([paramName, paramConfig]) => {
      const slider = document.getElementById(paramConfig.element);
      const valueEl = document.getElementById(paramConfig.valueElement);

      if (slider && valueEl) {
        const currentValue = config[paramName];
        slider.value = paramConfig.toSlider(currentValue);
        valueEl.textContent = paramConfig.toDisplay(currentValue);

        slider.addEventListener('input', () => {
          const value = paramConfig.fromSlider(slider.value);
          valueEl.textContent = paramConfig.toDisplay(value);
          this._updateEffect(effectName, { [paramName]: value });
        });
      }
    });
  }

  /**
   * Sélectionne un preset.
   */
  async _selectPreset(presetName) {
    // Mettre à jour l'UI
    document.querySelectorAll('.synth-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });

    // Appliquer au moteur audio
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }
    if (!this.audioEngine.started) {
      await this.audioEngine.start();
    }
    this.audioEngine.setPreset(presetName);

    // Mettre à jour les sliders avec les valeurs du preset
    this._synthConfig = this.audioEngine.getSettings();
    this._updateADSRSliders();
    this._updateOscillatorButtons();
    this._saveSynthSettings();
  }

  /**
   * Sélectionne un type d'oscillateur.
   */
  async _selectOscillator(type) {
    // Mettre à jour l'UI
    document.querySelectorAll('.synth-osc-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.oscillator === type);
    });

    // Appliquer au moteur audio
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }
    if (!this.audioEngine.started) {
      await this.audioEngine.start();
    }
    this.audioEngine.setOscillator(type);

    // Mettre à jour la config et l'UI des presets (on passe en custom)
    this._synthConfig = this.audioEngine.getSettings();
    this._updatePresetButtons();
    this._saveSynthSettings();
  }

  /**
   * Met à jour l'enveloppe ADSR.
   */
  async _updateEnvelope(params) {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }
    if (!this.audioEngine.started) {
      await this.audioEngine.start();
    }
    this.audioEngine.setEnvelope(params);
    this._synthConfig = this.audioEngine.getSettings();
    this._updatePresetButtons();
    this._saveSynthSettings();
  }

  /**
   * Met à jour un effet.
   */
  async _updateEffect(effectName, params) {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }
    if (!this.audioEngine.started) {
      await this.audioEngine.start();
    }

    const config = { ...this._synthConfig.effects[effectName], ...params };

    switch (effectName) {
      case 'reverb':
        this.audioEngine.setReverb(config.enabled, config.amount);
        break;
      case 'delay':
        this.audioEngine.setDelay(config.enabled, config.time, config.feedback);
        break;
      case 'filter':
        this.audioEngine.setFilter(config.enabled, config.frequency);
        break;
    }

    this._synthConfig = this.audioEngine.getSettings();
    this._saveSynthSettings();
  }

  /**
   * Met à jour les boutons de preset dans l'UI.
   */
  _updatePresetButtons() {
    const preset = this._synthConfig.preset;
    document.querySelectorAll('.synth-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    });
  }

  /**
   * Met à jour les boutons d'oscillateur dans l'UI.
   */
  _updateOscillatorButtons() {
    const osc = this._synthConfig.oscillator;
    document.querySelectorAll('.synth-osc-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.oscillator === osc);
    });
  }

  /**
   * Met à jour les sliders ADSR dans l'UI.
   */
  _updateADSRSliders() {
    const env = this._synthConfig.envelope;

    const attackSlider = document.getElementById('adsr-attack');
    const attackValue = document.getElementById('adsr-attack-value');
    if (attackSlider) {
      attackSlider.value = env.attack * 1000;
      attackValue.textContent = `${env.attack.toFixed(2)}s`;
    }

    const decaySlider = document.getElementById('adsr-decay');
    const decayValue = document.getElementById('adsr-decay-value');
    if (decaySlider) {
      decaySlider.value = env.decay * 1000;
      decayValue.textContent = `${env.decay.toFixed(2)}s`;
    }

    const sustainSlider = document.getElementById('adsr-sustain');
    const sustainValue = document.getElementById('adsr-sustain-value');
    if (sustainSlider) {
      sustainSlider.value = env.sustain * 100;
      sustainValue.textContent = env.sustain.toFixed(2);
    }

    const releaseSlider = document.getElementById('adsr-release');
    const releaseValue = document.getElementById('adsr-release-value');
    if (releaseSlider) {
      releaseSlider.value = env.release * 1000;
      releaseValue.textContent = `${env.release.toFixed(2)}s`;
    }
  }

  /**
   * Teste le son du synthétiseur.
   */
  async _testSynthSound() {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }

    if (!this.audioEngine.started) {
      try {
        await this.audioEngine.start();
        this.audioReady = true;
      } catch {
        console.warn('Impossible de démarrer l\'audio');
        return;
      }
    }

    // Appliquer la config actuelle si elle existe
    if (this._synthConfig) {
      this.audioEngine.applySettings(this._synthConfig);
    }

    // Jouer une petite mélodie de test (Do-Mi-Sol)
    this.audioEngine.playNote('C4', 0.3);
    setTimeout(() => this.audioEngine.playNote('E4', 0.3), 150);
    setTimeout(() => this.audioEngine.playNote('G4', 0.5), 300);
  }

  // --------------------------------------------------------------------------
  // Métronome
  // --------------------------------------------------------------------------

  /**
   * Affiche le panel métronome.
   */
  showMetronome() {
    if (this.elements.metronomeOverlay) {
      this.elements.metronomeOverlay.classList.add('visible');
      this._initMetronomePanel();
    }
  }

  /**
   * Cache le panel métronome.
   */
  hideMetronome() {
    if (this.elements.metronomeOverlay) {
      this.elements.metronomeOverlay.classList.remove('visible');
    }
    // Arrêter le métronome si actif
    this._stopMetronome();
  }

  /**
   * Arrête le métronome et réinitialise l'UI.
   */
  _stopMetronome() {
    if (this.metronome && this.metronome.playing) {
      this.metronome.stop();
      this._updateMetronomeUI(false);
    }
  }

  /**
   * Met à jour l'UI du métronome.
   * @param {boolean} isPlaying - État de lecture
   */
  _updateMetronomeUI(isPlaying) {
    const btn = this.elements.metronomePlayBtn;
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
      this.elements.metronomeBeats?.querySelectorAll('.metronome-beat').forEach(b => {
        b.classList.remove('active', 'downbeat');
      });
    }
  }

  /**
   * Initialise le panel métronome.
   */
  _initMetronomePanel() {
    if (this._metronomePanelInitialized) {
      return;
    }

    // Créer le métronome si nécessaire
    if (!this.metronome && this.audioEngine) {
      this.metronome = new Metronome(this.audioEngine);
    }

    // Callback sur les beats pour l'indicateur visuel
    if (this.metronome) {
      this.metronome.onBeat((beat, isDownbeat) => {
        this._updateMetronomeBeatIndicator(beat, isDownbeat);
      });
    }

    // Slider tempo
    this.elements.metronomeTempoSlider?.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value, 10);
      this._setMetronomeTempo(bpm);
    });

    // Boutons -10, -1, +1, +10
    document.getElementById('metronome-minus-10')?.addEventListener('click', () => {
      this._adjustMetronomeTempo(-10);
    });
    document.getElementById('metronome-minus-1')?.addEventListener('click', () => {
      this._adjustMetronomeTempo(-1);
    });
    document.getElementById('metronome-plus-1')?.addEventListener('click', () => {
      this._adjustMetronomeTempo(1);
    });
    document.getElementById('metronome-plus-10')?.addEventListener('click', () => {
      this._adjustMetronomeTempo(10);
    });

    // Signature rythmique
    this.elements.metronomeTimeSignature?.addEventListener('change', (e) => {
      const [beats] = e.target.value.split('/').map(Number);
      this._setMetronomeTimeSignature(beats);
    });

    // Bouton play/stop
    this.elements.metronomePlayBtn?.addEventListener('click', () => {
      this._toggleMetronome();
    });

    this._metronomePanelInitialized = true;
  }

  /**
   * Définit le tempo du métronome.
   * @param {number} bpm - Tempo en BPM
   */
  _setMetronomeTempo(bpm) {
    bpm = Math.max(30, Math.min(300, bpm));

    if (this.elements.metronomeBpmValue) {
      this.elements.metronomeBpmValue.textContent = bpm;
    }
    if (this.elements.metronomeTempoSlider) {
      this.elements.metronomeTempoSlider.value = bpm;
    }
    if (this.metronome) {
      this.metronome.setTempo(bpm);
    }
  }

  /**
   * Ajuste le tempo du métronome.
   * @param {number} delta - Variation en BPM
   */
  _adjustMetronomeTempo(delta) {
    const currentBpm = this.metronome?.tempo || 120;
    this._setMetronomeTempo(currentBpm + delta);
  }

  /**
   * Définit la signature rythmique.
   * @param {number} beats - Nombre de temps par mesure
   */
  _setMetronomeTimeSignature(beats) {
    if (this.metronome) {
      this.metronome.setTimeSignature(beats, 4);
    }

    // Mettre à jour les indicateurs visuels
    const container = this.elements.metronomeBeats;
    if (container) {
      container.innerHTML = '';
      for (let i = 1; i <= beats; i++) {
        const beat = document.createElement('div');
        beat.className = 'metronome-beat';
        beat.dataset.beat = i;
        container.appendChild(beat);
      }
    }
  }

  /**
   * Toggle le métronome.
   */
  async _toggleMetronome() {
    // Créer le métronome à la demande
    if (!this.metronome) {
      if (!this.audioEngine) {
        this.audioEngine = new AudioEngine();
      }
      if (!this.audioEngine.started) {
        await this.audioEngine.start();
      }
      this.metronome = new Metronome(this.audioEngine);
      this.metronome.onBeat((beat, isDownbeat) => {
        this._updateMetronomeBeatIndicator(beat, isDownbeat);
      });
    }

    const isPlaying = await this.metronome.toggle();

    // Mettre à jour l'UI
    this._updateMetronomeUI(isPlaying);
  }

  /**
   * Met à jour l'indicateur visuel des beats.
   * @param {number} beat - Beat courant
   * @param {boolean} isDownbeat - Premier temps
   */
  _updateMetronomeBeatIndicator(beat, isDownbeat) {
    const beats = this.elements.metronomeBeats?.querySelectorAll('.metronome-beat');
    if (!beats) {return;}

    beats.forEach((b, i) => {
      const isCurrent = (i + 1) === beat;
      b.classList.toggle('active', isCurrent);
      b.classList.toggle('downbeat', isCurrent && isDownbeat);
    });
  }

  // --------------------------------------------------------------------------
  // Accordeur chromatique
  // --------------------------------------------------------------------------

  /**
   * Affiche le panel accordeur.
   */
  showTuner() {
    if (this.elements.tunerOverlay) {
      this.elements.tunerOverlay.classList.add('visible');
      this._initTunerPanel();
    }
  }

  /**
   * Cache le panel accordeur.
   */
  hideTuner() {
    if (this.elements.tunerOverlay) {
      this.elements.tunerOverlay.classList.remove('visible');
    }
    // Arrêter le tuner si actif
    this._stopTuner();
  }

  /**
   * Initialise le panel accordeur.
   */
  _initTunerPanel() {
    if (this._tunerPanelInitialized) {
      return;
    }

    // Bouton toggle
    this.elements.tunerToggle?.addEventListener('click', () => {
      this._toggleTuner();
    });

    this._tunerPanelInitialized = true;
  }

  /**
   * Toggle l'accordeur.
   */
  async _toggleTuner() {
    if (this._tunerActive) {
      this._stopTuner();
    } else {
      await this._startTuner();
    }
  }

  /**
   * Démarre l'accordeur.
   */
  async _startTuner() {
    try {
      // Demander l'accès au micro
      this._tunerStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Créer le contexte audio
      this._tunerAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      this._tunerAnalyser = this._tunerAudioContext.createAnalyser();
      this._tunerAnalyser.fftSize = 4096;

      const source = this._tunerAudioContext.createMediaStreamSource(this._tunerStream);
      source.connect(this._tunerAnalyser);

      this._tunerActive = true;
      this._tunerBuffer = new Float32Array(this._tunerAnalyser.fftSize);

      // Historique des fréquences pour le graphe (200 points)
      this._tunerFrequencyHistory = [];
      this._tunerMaxHistoryLength = 200;

      // Historique des notes détectées (max 10)
      this._tunerNoteHistory = [];
      this._tunerMaxNoteHistory = 10;
      this._tunerLastNoteName = null;

      // Initialiser le graphe
      this._initTunerGraph();

      // Mettre à jour l'UI
      this._updateTunerUI(true);

      // Démarrer l'analyse
      this._tunerLoop();

    } catch (error) {
      console.error('Erreur accès micro:', error);
      this._updateTunerStatus('Accès micro refusé', true);
    }
  }

  /**
   * Arrête l'accordeur.
   */
  _stopTuner() {
    this._tunerActive = false;

    // Arrêter le stream
    if (this._tunerStream) {
      this._tunerStream.getTracks().forEach(track => track.stop());
      this._tunerStream = null;
    }

    // Fermer le contexte audio
    if (this._tunerAudioContext) {
      this._tunerAudioContext.close();
      this._tunerAudioContext = null;
    }

    // Réinitialiser les historiques
    this._tunerFrequencyHistory = [];
    this._tunerNoteHistory = [];
    this._tunerLastNoteName = null;

    // Effacer le graphe
    this._clearTunerGraph();

    // Effacer l'historique affiché
    if (this.elements.tunerHistory) {
      this.elements.tunerHistory.innerHTML = '';
    }

    this._updateTunerUI(false);
  }

  /**
   * Efface le graphe de l'accordeur.
   */
  _clearTunerGraph() {
    const canvas = this.elements.tunerGraph;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.elements.tunerGraphRange) {
      this.elements.tunerGraphRange.textContent = '-- Hz';
    }
  }

  /**
   * Boucle d'analyse de l'accordeur.
   */
  _tunerLoop() {
    if (!this._tunerActive) {return;}

    // Récupérer les données audio
    this._tunerAnalyser.getFloatTimeDomainData(this._tunerBuffer);

    // Détecter la fréquence (autocorrélation)
    const frequency = this._detectPitch(this._tunerBuffer, this._tunerAudioContext.sampleRate);

    // Ajouter à l'historique des fréquences
    this._tunerFrequencyHistory.push(frequency > 0 ? frequency : null);
    if (this._tunerFrequencyHistory.length > this._tunerMaxHistoryLength) {
      this._tunerFrequencyHistory.shift();
    }

    // Dessiner le graphe
    this._drawTunerGraph();

    // Mettre à jour l'indicateur live
    this._updateTunerLiveIndicator(frequency > 0);

    if (frequency > 0) {
      // Convertir en note
      const noteData = this._frequencyToNote(frequency);
      this._updateTunerDisplay(noteData, frequency);

      // Ajouter à l'historique des notes si c'est une nouvelle note
      this._addToNoteHistory(noteData);
    } else {
      // Pas de signal clair
      this._updateTunerDisplay(null, 0);
    }

    // Continuer la boucle
    requestAnimationFrame(() => this._tunerLoop());
  }

  /**
   * Initialise le graphe de l'accordeur.
   */
  _initTunerGraph() {
    const canvas = this.elements.tunerGraph;
    if (!canvas) {return;}

    // Adapter la résolution au devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Dessiner le fond
    this._drawTunerGraph();
  }

  /**
   * Dessine le graphe de fréquence.
   */
  _drawTunerGraph() {
    const canvas = this.elements.tunerGraph;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Effacer
    ctx.clearRect(0, 0, width, height);

    // Fond
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg-secondary').trim() || '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const history = this._tunerFrequencyHistory || [];
    if (history.length < 2) {return;}

    // Calculer min/max pour l'échelle
    const validFreqs = history.filter(f => f !== null && f > 0);
    if (validFreqs.length === 0) {return;}

    const minFreq = Math.min(...validFreqs) * 0.9;
    const maxFreq = Math.max(...validFreqs) * 1.1;

    // Mettre à jour l'affichage de la plage
    if (this.elements.tunerGraphRange) {
      this.elements.tunerGraphRange.textContent =
        `${Math.round(minFreq)}-${Math.round(maxFreq)} Hz`;
    }

    // Dessiner les lignes de référence (notes)
    this._drawTunerGraphNoteLines(ctx, width, height, minFreq, maxFreq);

    // Dessiner la courbe
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim() || '#6366f1';
    ctx.lineWidth = 2;

    let started = false;
    for (let i = 0; i < history.length; i++) {
      const freq = history[i];
      const x = (i / (this._tunerMaxHistoryLength - 1)) * width;

      if (freq !== null && freq > 0) {
        const y = height - ((freq - minFreq) / (maxFreq - minFreq)) * height;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }

    ctx.stroke();

    // Point actuel (dernier point)
    const lastFreq = history[history.length - 1];
    if (lastFreq !== null && lastFreq > 0) {
      const x = width;
      const y = height - ((lastFreq - minFreq) / (maxFreq - minFreq)) * height;

      ctx.beginPath();
      ctx.arc(x - 4, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }

  /**
   * Dessine les lignes de référence des notes sur le graphe.
   */
  _drawTunerGraphNoteLines(ctx, width, height, minFreq, maxFreq) {
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-border').trim() || '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text-muted').trim() || '#666';

    // Dessiner des lignes pour chaque note dans la plage
    for (let semitone = -48; semitone <= 48; semitone++) {
      const freq = A4 * Math.pow(2, semitone / 12);
      if (freq < minFreq || freq > maxFreq) {continue;}

      const y = height - ((freq - minFreq) / (maxFreq - minFreq)) * height;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Label de la note (seulement les notes naturelles)
      const noteIndex = ((semitone % 12) + 12 + 9) % 12;
      const noteName = noteNames[noteIndex];
      if (!noteName.includes('#')) {
        const octave = 4 + Math.floor((semitone + 9) / 12);
        const displayNote = this.formatNote(noteName, true, octave);
        ctx.fillText(displayNote, 4, y - 2);
      }
    }

    ctx.setLineDash([]);
  }

  /**
   * Ajoute une note à l'historique.
   * @param {Object} noteData - Données de la note
   */
  _addToNoteHistory(noteData) {
    const noteName = `${noteData.note}${noteData.octave}`;

    // Ne pas ajouter si c'est la même note que la précédente
    if (noteName === this._tunerLastNoteName) {return;}

    this._tunerLastNoteName = noteName;

    // Ajouter à l'historique
    this._tunerNoteHistory.unshift({
      note: noteData.note,
      octave: noteData.octave,
      cents: noteData.cents,
      timestamp: Date.now(),
    });

    // Limiter la taille
    if (this._tunerNoteHistory.length > this._tunerMaxNoteHistory) {
      this._tunerNoteHistory.pop();
    }

    // Mettre à jour l'affichage
    this._updateTunerHistoryDisplay();
  }

  /**
   * Met à jour l'affichage de l'historique des notes.
   */
  _updateTunerHistoryDisplay() {
    const container = this.elements.tunerHistory;
    if (!container) {return;}

    container.innerHTML = this._tunerNoteHistory.map(item => {
      let statusClass = 'in-tune';
      if (Math.abs(item.cents) > 5) {
        statusClass = item.cents < 0 ? 'flat' : 'sharp';
      }

      const sign = item.cents > 0 ? '+' : '';
      const displayNote = this.formatNote(item.note);

      return `
        <div class="tuner-history-note ${statusClass}">
          <span class="note-name">${displayNote}</span>
          <span class="note-octave">${item.octave}</span>
          <span class="note-cents">${sign}${item.cents}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Détecte la fréquence par autocorrélation.
   * @param {Float32Array} buffer - Buffer audio
   * @param {number} sampleRate - Taux d'échantillonnage
   * @returns {number} Fréquence détectée ou -1
   */
  _detectPitch(buffer, sampleRate) {
    const SIZE = buffer.length;

    // Vérifier qu'il y a du signal
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.01) {return -1;} // Trop silencieux

    // Autocorrélation
    const correlations = new Float32Array(SIZE);
    for (let lag = 0; lag < SIZE; lag++) {
      let sum = 0;
      for (let i = 0; i < SIZE - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      correlations[lag] = sum;
    }

    // Trouver le premier pic après le lag 0
    const minLag = Math.floor(sampleRate / 1000); // Min ~1000 Hz
    const maxLag = Math.floor(sampleRate / 50);   // Max ~50 Hz

    let bestLag = -1;
    let bestCorr = 0;
    let foundPeak = false;

    for (let lag = minLag; lag < maxLag && lag < SIZE; lag++) {
      if (correlations[lag] > bestCorr) {
        bestCorr = correlations[lag];
        bestLag = lag;
        foundPeak = true;
      } else if (foundPeak && correlations[lag] < bestCorr * 0.9) {
        // On a dépassé le pic
        break;
      }
    }

    if (bestLag === -1 || bestCorr < correlations[0] * 0.5) {
      return -1;
    }

    return sampleRate / bestLag;
  }

  /**
   * Convertit une fréquence en note.
   * @param {number} frequency - Fréquence en Hz
   * @returns {Object} {note, octave, cents}
   */
  _frequencyToNote(frequency) {
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Calcul du nombre de demi-tons depuis A4
    const semitonesFromA4 = 12 * Math.log2(frequency / A4);
    const roundedSemitones = Math.round(semitonesFromA4);

    // Calcul de la note et de l'octave
    const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12; // +9 car A est à l'index 9
    const octave = 4 + Math.floor((roundedSemitones + 9) / 12);

    // Calcul des cents
    const exactFrequency = A4 * Math.pow(2, roundedSemitones / 12);
    const cents = Math.round(1200 * Math.log2(frequency / exactFrequency));

    return {
      note: noteNames[noteIndex],
      octave: octave,
      cents: cents,
      exactFrequency: exactFrequency,
    };
  }

  /**
   * Met à jour l'affichage de l'accordeur.
   * @param {Object|null} noteData - Données de la note détectée
   * @param {number} frequency - Fréquence brute
   */
  _updateTunerDisplay(noteData, frequency) {
    const noteEl = this.elements.tunerNote;
    const octaveEl = this.elements.tunerOctave;
    const freqEl = this.elements.tunerFrequency;
    const centsEl = this.elements.tunerCents;
    const indicator = this.elements.tunerIndicator;

    if (!noteData) {
      if (noteEl) {
        noteEl.textContent = '-';
        noteEl.className = 'tuner-note';
      }
      if (octaveEl) {octaveEl.textContent = '';}
      if (freqEl) {freqEl.textContent = '-- Hz';}
      if (centsEl) {centsEl.textContent = '-- cents';}
      if (indicator) {indicator.style.left = '50%';}
      return;
    }

    // Note (avec la notation choisie par l'utilisateur)
    if (noteEl) {
      noteEl.textContent = this.formatNote(noteData.note);
      // Couleur selon justesse
      noteEl.className = 'tuner-note';
      if (Math.abs(noteData.cents) <= 5) {
        noteEl.classList.add('in-tune');
      } else if (noteData.cents < 0) {
        noteEl.classList.add('flat');
      } else {
        noteEl.classList.add('sharp');
      }
    }

    // Octave
    if (octaveEl) {
      octaveEl.textContent = noteData.octave;
    }

    // Fréquence
    if (freqEl) {
      freqEl.textContent = `${frequency.toFixed(1)} Hz`;
    }

    // Cents
    if (centsEl) {
      const sign = noteData.cents > 0 ? '+' : '';
      centsEl.textContent = `${sign}${noteData.cents} cents`;
    }

    // Indicateur
    if (indicator) {
      // Clamp entre -50 et +50 cents
      const clampedCents = Math.max(-50, Math.min(50, noteData.cents));
      const percent = 50 + (clampedCents / 50) * 50;
      indicator.style.left = `${percent}%`;
    }
  }

  /**
   * Met à jour l'UI de l'accordeur.
   * @param {boolean} active - Accordeur actif
   */
  _updateTunerUI(active) {
    const btn = this.elements.tunerToggle;
    const status = this.elements.tunerStatus;
    const liveDot = this.elements.tunerLiveDot;

    if (btn) {
      btn.classList.toggle('active', active);
      const icon = btn.querySelector('.tuner-btn-icon');
      const text = btn.querySelector('.tuner-btn-text');
      if (icon) {icon.textContent = active ? '⏹' : '🎤';}
      if (text) {text.textContent = active ? 'Arrêter' : 'Activer le micro';}
    }

    if (status) {
      status.textContent = active ? 'Écoute en cours...' : 'Cliquez pour démarrer';
      status.className = 'tuner-status';
      if (active) {status.classList.add('active');}
    }

    // Live indicator
    if (liveDot) {
      liveDot.classList.toggle('active', active);
      if (!active) {
        liveDot.classList.remove('detecting');
      }
    }
  }

  /**
   * Met à jour l'indicateur live du tuner.
   * @param {boolean} detecting - Son détecté
   */
  _updateTunerLiveIndicator(detecting) {
    const liveDot = this.elements.tunerLiveDot;
    if (liveDot) {
      liveDot.classList.toggle('detecting', detecting);
    }
  }

  /**
   * Met à jour le statut de l'accordeur.
   * @param {string} message - Message
   * @param {boolean} isError - Est une erreur
   */
  _updateTunerStatus(message, isError = false) {
    const status = this.elements.tunerStatus;
    if (status) {
      status.textContent = message;
      status.className = 'tuner-status';
      if (isError) {status.classList.add('error');}
    }
  }

  /**
   * Initialise le clavier piano (2 octaves).
   */
  _initPianoKeyboard() {
    if (!this.elements.pianoKeyboard || this._pianoInitialized) {return;}

    // Définition des notes sur 2 octaves (C4-B5)
    const notes = [
      { note: 'C4', isBlack: false, label: 'Q' },
      { note: 'C#4', isBlack: true, label: '2' },
      { note: 'D4', isBlack: false, label: 'S' },
      { note: 'D#4', isBlack: true, label: '3' },
      { note: 'E4', isBlack: false, label: 'D' },
      { note: 'F4', isBlack: false, label: 'F' },
      { note: 'F#4', isBlack: true, label: '5' },
      { note: 'G4', isBlack: false, label: 'G' },
      { note: 'G#4', isBlack: true, label: '6' },
      { note: 'A4', isBlack: false, label: 'H' },
      { note: 'A#4', isBlack: true, label: '7' },
      { note: 'B4', isBlack: false, label: 'J' },
      { note: 'C5', isBlack: false, label: 'K' },
      { note: 'C#5', isBlack: true, label: '9' },
      { note: 'D5', isBlack: false, label: 'L' },
      { note: 'D#5', isBlack: true, label: '0' },
      { note: 'E5', isBlack: false, label: 'M' },
      { note: 'F5', isBlack: false, label: 'W' },
      { note: 'F#5', isBlack: true, label: '' },
      { note: 'G5', isBlack: false, label: 'X' },
      { note: 'G#5', isBlack: true, label: '' },
      { note: 'A5', isBlack: false, label: 'C' },
      { note: 'A#5', isBlack: true, label: '' },
      { note: 'B5', isBlack: false, label: 'V' },
    ];

    // Mapping clavier AZERTY -> note
    this._pianoKeyMap = {};
    notes.forEach(n => {
      if (n.label) {
        this._pianoKeyMap[n.label.toLowerCase()] = n.note;
      }
    });

    // Construire le HTML
    const container = this.elements.pianoKeyboard;
    container.innerHTML = '';

    notes.forEach((n, index) => {
      const key = document.createElement('div');
      key.className = `piano-key piano-key-${n.isBlack ? 'black' : 'white'}`;
      key.dataset.note = n.note;

      // Position des touches noires
      if (n.isBlack) {
        const blackKeyOffsets = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];
        const blackIndex = notes.slice(0, index + 1).filter(x => x.isBlack).length - 1;
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
      }

      // Events
      key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._playPianoNote(n.note, key);
      });

      key.addEventListener('mouseup', () => {
        key.classList.remove('active');
      });

      key.addEventListener('mouseleave', () => {
        key.classList.remove('active');
      });

      key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._playPianoNote(n.note, key);
      });

      key.addEventListener('touchend', () => {
        key.classList.remove('active');
      });

      container.appendChild(key);
    });

    this._pianoInitialized = true;
  }

  /**
   * Joue une note depuis le piano.
   * @param {string} note - Note au format Tone.js (ex: "C4")
   * @param {HTMLElement} keyElement - Élément de la touche
   */
  async _playPianoNote(note, keyElement) {
    // Feedback visuel
    if (keyElement) {
      keyElement.classList.add('active');
    }

    // Afficher la note
    if (this.elements.pianoNoteDisplay) {
      const noteName = this._noteToFrench(note);
      this.elements.pianoNoteDisplay.textContent = noteName;
    }

    // Jouer le son
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }

    if (!this.audioEngine.started) {
      try {
        await this.audioEngine.start();
        this.audioReady = true;
      } catch {
        console.warn('Impossible de démarrer l\'audio');
        return;
      }
    }

    // Utiliser le synthé piano dédié (son propre, sans effets)
    this.audioEngine.playPianoNote(note, 0.5);
  }

  /**
   * Convertit une note anglaise en français.
   * @param {string} note - Note au format "C4", "C#4", etc.
   * @returns {string} Note en français
   */
  _noteToFrench(note) {
    const noteMap = {
      'C': 'Do', 'D': 'Ré', 'E': 'Mi', 'F': 'Fa',
      'G': 'Sol', 'A': 'La', 'B': 'Si',
    };
    const match = note.match(/^([A-G])(#?)(\d)$/);
    if (!match) {return note;}

    const [, letter, sharp, octave] = match;
    const frenchNote = noteMap[letter] || letter;
    const sharpSymbol = sharp ? '♯' : '';
    return `${frenchNote}${sharpSymbol}${octave}`;
  }

  /**
   * Gère les raccourcis clavier.
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    // Échap pour fermer les overlays ou revenir au menu
    if (event.key === 'Escape') {
      if (this.elements.metronomeOverlay?.classList.contains('visible')) {
        this.hideMetronome();
        return;
      }
      if (this.elements.tunerOverlay?.classList.contains('visible')) {
        this.hideTuner();
        return;
      }
      if (this.elements.synthOverlay?.classList.contains('visible')) {
        this.hideSynth();
        return;
      }
      if (this.elements.pianoOverlay?.classList.contains('visible')) {
        this.hidePiano();
        return;
      }
      if (this.elements.memoOverlay?.classList.contains('visible')) {
        this.hideMemo();
        return;
      }
      if (this.currentView !== 'menu') {
        this.showView('menu');
      }
      return;
    }

    // Piano virtuel - jouer les notes avec le clavier
    if (this.elements.pianoOverlay?.classList.contains('visible') && this._pianoKeyMap) {
      const keyLower = event.key.toLowerCase();
      if (this._pianoKeyMap[keyLower]) {
        event.preventDefault();
        const note = this._pianoKeyMap[keyLower];
        const keyElement = this.elements.pianoKeyboard?.querySelector(`[data-note="${note}"]`);
        this._playPianoNote(note, keyElement);

        // Retirer la classe active après un délai
        if (keyElement) {
          setTimeout(() => keyElement.classList.remove('active'), 200);
        }
        return;
      }
    }

    // Barre d'espace pour le tap en mode rythme
    if (event.key === ' ' && this.rhythmState) {
      event.preventDefault();
      this.handleRhythmTap();
    }

    // Touches 1-7 pour les notes
    if (this.currentView === 'exercise' && this.engine?.isRunning()) {
      const keyNum = parseInt(event.key);
      if (keyNum >= 1 && keyNum <= 7 && this.currentExercise?.mode !== 'rhythm') {
        this.submitAnswer(keyNum - 1);
      }
    }
  }

  /**
   * Initialise l'audio (nécessite une interaction utilisateur).
   */
  async initAudio() {
    if (this.audioReady) {return;}

    try {
      // Créer et démarrer l'AudioEngine
      if (!this.audioEngine) {
        this.audioEngine = new AudioEngine();
      }
      await this.audioEngine.start();

      // Appliquer la config sauvegardée si elle existe
      this._loadSynthSettings();
      if (this._synthConfig) {
        this.audioEngine.applySettings(this._synthConfig);
      }

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
   * Charge la progression depuis GameKit.
   */
  loadProgress() {
    this.progress = GameKit.loadProgress() || this.getDefaultProgress();
  }

  /**
   * Sauvegarde la progression via GameKit.
   */
  saveProgress() {
    if (this.progress) {
      GameKit.saveProgress(this.progress);
    }
  }

  /**
   * Charge les paramètres utilisateur depuis localStorage.
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('diese-settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {
      console.warn('Erreur chargement paramètres');
    }
  }

  /**
   * Sauvegarde les paramètres utilisateur.
   */
  saveSettings() {
    try {
      localStorage.setItem('diese-settings', JSON.stringify(this.settings));
    } catch {
      console.warn('Erreur sauvegarde paramètres');
    }
  }

  /**
   * Retourne la notation choisie par l'utilisateur.
   * @returns {string} 'french' ou 'english'
   */
  getNotation() {
    return this.settings?.notation || 'french';
  }

  /**
   * Convertit une note selon la notation choisie.
   * @param {string} noteLetter - Lettre de la note (C, D, E, etc.)
   * @param {boolean} includeOctave - Inclure l'octave
   * @param {number} octave - Numéro d'octave
   * @returns {string}
   */
  formatNote(noteLetter, includeOctave = false, octave = 4) {
    const frenchMap = {
      'C': 'Do', 'D': 'Ré', 'E': 'Mi', 'F': 'Fa',
      'G': 'Sol', 'A': 'La', 'B': 'Si',
    };

    let note;
    if (this.getNotation() === 'french') {
      // Gérer les dièses
      const baseLetter = noteLetter.replace('#', '');
      note = frenchMap[baseLetter] || baseLetter;
      if (noteLetter.includes('#')) {
        note += '♯';
      }
    } else {
      note = noteLetter;
    }

    if (includeOctave) {
      note += octave;
    }

    return note;
  }

  /**
   * Retourne la progression par défaut.
   * @returns {Object}
   */
  getDefaultProgress() {
    return {
      level: 1,
      xp: 0,
      skills: {
        'treble-clef': { level: 0, accuracy: 0, attempts: 0 },
        'bass-clef': { level: 0, accuracy: 0, attempts: 0 },
        'accidentals': { level: 0, accuracy: 0, attempts: 0 },
        'intervals': { level: 0, accuracy: 0, attempts: 0 },
      },
      history: [],
      achievements: [],
    };
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
    const progress = this.progress || this.getDefaultProgress();

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
   * Retourne le taux de réussite d'un exercice.
   * @param {string} exerciseId - ID de l'exercice
   * @returns {number} Taux (0-1)
   */
  getExerciseProgress(exerciseId) {
    const progress = this.progress || this.getDefaultProgress();
    const record = progress.history?.find(h => h.exerciseId === exerciseId);
    return record ? record.score / record.maxScore : 0;
  }

  /**
   * Met à jour l'affichage du niveau dans le header.
   */
  updateLevelBadge() {
    if (this.elements.levelBadge) {
      const level = this.progress?.level || 1;
      this.elements.levelBadge.textContent = `Niveau ${level}`;
    }
  }

  /**
   * Réinitialise la progression.
   */
  resetProgress() {
    if (confirm('Voulez-vous vraiment réinitialiser votre progression ?')) {
      this.progress = this.getDefaultProgress();
      GameKit.clearProgress();
      this.updateLevelBadge();
      this.showView('menu');
    }
  }

  /**
   * Nettoie les ressources.
   */
  dispose() {
    // Sauvegarder la progression
    this.saveProgress();

    // Nettoyer le métronome
    if (this.metronome) {
      this.metronome.dispose();
      this.metronome = null;
    }

    // Nettoyer l'audio
    if (this.audioEngine) {
      this.audioEngine.dispose();
      this.audioEngine = null;
    }

    // Nettoyer le renderer
    if (this.staffRenderer) {
      this.staffRenderer.dispose();
      this.staffRenderer = null;
    }
  }

  /**
   * Joue une note avec l'audio.
   * @param {import('./core/Pitch.js').Pitch} pitch - Note à jouer
   */
  async playNoteAudio(pitch) {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }

    if (!this.audioEngine.started) {
      try {
        await this.audioEngine.start();
        this.audioReady = true;
        if (this.elements.audioBanner) {
          this.elements.audioBanner.classList.add('hidden');
        }
      } catch (error) {
        console.error('Erreur démarrage audio:', error);
        return;
      }
    }

    this.audioEngine.playNote(pitch, 0.8);
  }

  /**
   * Joue un accord avec l'audio.
   * @param {import('./core/Pitch.js').Pitch[]} pitches - Notes de l'accord
   */
  async playChordAudio(pitches) {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
    }

    if (!this.audioEngine.started) {
      try {
        await this.audioEngine.start();
        this.audioReady = true;
        if (this.elements.audioBanner) {
          this.elements.audioBanner.classList.add('hidden');
        }
      } catch (error) {
        console.error('Erreur démarrage audio:', error);
        return;
      }
    }

    this.audioEngine.playChord(pitches, 1);
  }
}
