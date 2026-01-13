/**
 * ExerciseView - Vue d'exercice
 *
 * Affiche l'interface de l'exercice en cours.
 *
 * @module ui/ExerciseView
 */

import { NoteRenderer } from '../src/renderer/NoteRenderer.js';
import { NoteButtons } from './NoteButtons.js';

// ============================================================================
// Classe ExerciseView
// ============================================================================

/**
 * Vue de l'exercice en cours
 */
export class ExerciseView {
  /**
   * Crée une nouvelle vue d'exercice
   *
   * @param {HTMLElement} container - Conteneur DOM
   * @param {Object} options - Options
   * @param {Function} options.onAnswer - Callback de réponse
   * @param {Function} options.onQuit - Callback de sortie
   * @param {Function} options.onHint - Callback d'indice
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onAnswer = options.onAnswer || (() => {});
    this.onQuit = options.onQuit || (() => {});
    this.onHint = options.onHint || (() => {});

    /** @type {NoteRenderer|null} Renderer de notes */
    this.noteRenderer = null;

    /** @type {NoteButtons|null} Boutons de réponse */
    this.noteButtons = null;

    /** @type {Object|null} Exercice courant */
    this.exercise = null;

    /** @type {Object|null} Question courante */
    this.currentQuestion = null;

    /** @type {boolean} Réponse en attente de traitement */
    this.answerPending = false;
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise la vue
   *
   * @param {Object} exercise - Configuration de l'exercice
   */
  init(exercise) {
    this.exercise = exercise;
    this._render();
  }

  /**
   * Rendu de la vue
   * @private
   */
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'exercise-view active';

    // Header avec progression
    const header = document.createElement('div');
    header.className = 'exercise-header';
    header.innerHTML = `
      <button class="quit-btn" title="Quitter">✕</button>
      <div class="exercise-info">
        <span class="exercise-title">${this.exercise.title}</span>
        <span class="progress-text">Question <span id="current-q">1</span>/${this.exercise.config.questionsCount}</span>
      </div>
      <div class="score-display">
        <span id="current-score">0</span> pts
      </div>
    `;
    this.container.appendChild(header);

    // Barre de progression
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = '<div class="progress-fill" id="progress-fill"></div>';
    this.container.appendChild(progressBar);

    // Zone de portée
    const staffContainer = document.createElement('div');
    staffContainer.className = 'staff-container';
    staffContainer.id = 'staff-container';
    this.container.appendChild(staffContainer);

    // Zone de feedback
    const feedbackContainer = document.createElement('div');
    feedbackContainer.className = 'feedback-container';
    feedbackContainer.id = 'feedback-container';
    this.container.appendChild(feedbackContainer);

    // Zone de boutons de réponse
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';
    buttonsContainer.id = 'buttons-container';
    this.container.appendChild(buttonsContainer);

    // Zone d'actions secondaires
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'actions-container';
    actionsContainer.innerHTML = `
      <button class="hint-btn" id="hint-btn">💡 Indice</button>
      <button class="skip-btn" id="skip-btn">Passer →</button>
    `;
    this.container.appendChild(actionsContainer);

    // Initialiser les composants
    this._initComponents();
    this._bindEvents();
    this._addStyles();
  }

  /**
   * Initialise les composants
   * @private
   */
  _initComponents() {
    // Renderer de notes
    this.noteRenderer = new NoteRenderer(
      document.getElementById('staff-container'),
      {
        clef: this.exercise.config.clef || 'treble',
        width: 250,
        height: 120,
      },
    );

    // Boutons de réponse
    this.noteButtons = new NoteButtons(
      document.getElementById('buttons-container'),
      {
        onSelect: (noteIndex) => this._handleAnswer(noteIndex),
        includeAccidentals: this.exercise.config.accidentals,
      },
    );
  }

  /**
   * Attache les événements
   * @private
   */
  _bindEvents() {
    // Bouton quitter
    const quitBtn = this.container.querySelector('.quit-btn');
    quitBtn.addEventListener('click', () => this.onQuit());

    // Bouton indice
    const hintBtn = document.getElementById('hint-btn');
    hintBtn.addEventListener('click', () => this.onHint());

    // Bouton passer
    const skipBtn = document.getElementById('skip-btn');
    skipBtn.addEventListener('click', () => this._handleAnswer(-1));

    // Raccourcis clavier
    this._keyHandler = (e) => this._handleKeyPress(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  /**
   * Gère les raccourcis clavier
   * @private
   */
  _handleKeyPress(e) {
    if (this.answerPending) {return;}

    // 1-7 pour les notes
    if (e.key >= '1' && e.key <= '7') {
      const noteIndex = parseInt(e.key) - 1;
      this._handleAnswer(noteIndex);
      return;
    }

    // Espace pour passer
    if (e.key === ' ') {
      e.preventDefault();
      this._handleAnswer(-1);
      return;
    }

    // Échap pour quitter
    if (e.key === 'Escape') {
      this.onQuit();
      return;
    }

    // H pour indice
    if (e.key.toLowerCase() === 'h') {
      this.onHint();
      return;
    }
  }

  // --------------------------------------------------------------------------
  // Affichage des questions
  // --------------------------------------------------------------------------

  /**
   * Affiche une question
   *
   * @param {Object} question - Question à afficher
   * @param {number} index - Index de la question
   * @param {number} total - Total de questions
   */
  showQuestion(question, index, total) {
    this.currentQuestion = question;
    this.answerPending = false;

    // Mettre à jour la progression
    document.getElementById('current-q').textContent = index;
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = `${((index - 1) / total) * 100}%`;

    // Afficher la note
    if (question.type === 'note') {
      this.noteRenderer.showNote(question.pitch, { animate: true });
    }

    // Effacer le feedback
    document.getElementById('feedback-container').innerHTML = '';

    // Réactiver les boutons
    this.noteButtons.enable();
  }

  // --------------------------------------------------------------------------
  // Gestion des réponses
  // --------------------------------------------------------------------------

  /**
   * Gère une réponse
   * @private
   */
  _handleAnswer(noteIndex) {
    if (this.answerPending) {return;}

    this.answerPending = true;
    this.noteButtons.disable();

    // Appeler le callback avec la réponse
    this.onAnswer(noteIndex);
  }

  /**
   * Affiche le feedback de réponse
   *
   * @param {Object} result - Résultat de la validation
   */
  showFeedback(result) {
    const feedbackContainer = document.getElementById('feedback-container');

    if (result.correct) {
      this.noteRenderer.showCorrect();
      feedbackContainer.innerHTML = `
        <div class="feedback correct">
          ✓ Correct ! +${result.points} pts
          ${result.streak > 1 ? `<span class="streak">🔥 Série de ${result.streak}</span>` : ''}
        </div>
      `;
    } else {
      this.noteRenderer.showIncorrect();
      const expected = result.expectedAnswer;
      feedbackContainer.innerHTML = `
        <div class="feedback incorrect">
          ✗ La réponse était <strong>${expected.french}</strong>
        </div>
      `;

      // Highlight le bon bouton
      if (expected.pitchClass !== undefined) {
        this.noteButtons.highlightCorrect(expected.pitchClass);
      }
    }

    // Mettre à jour le score
    const currentScore = document.getElementById('current-score');
    const newScore = parseInt(currentScore.textContent) + (result.points || 0);
    currentScore.textContent = newScore;
  }

  /**
   * Affiche un indice
   *
   * @param {Object} hint - Indice à afficher
   */
  showHint(hint) {
    this.noteRenderer.showHint(hint.text);
  }

  // --------------------------------------------------------------------------
  // Mise à jour de l'affichage
  // --------------------------------------------------------------------------

  /**
   * Met à jour la progression
   *
   * @param {Object} progress - Données de progression
   */
  updateProgress(progress) {
    if (progress.current !== undefined && progress.total !== undefined) {
      document.getElementById('current-q').textContent = progress.current;
      const progressFill = document.getElementById('progress-fill');
      progressFill.style.width = `${(progress.current / progress.total) * 100}%`;
    }

    if (progress.stats?.totalScore !== undefined) {
      document.getElementById('current-score').textContent =
        progress.stats.totalScore;
    }
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  /**
   * Ajoute les styles CSS
   * @private
   */
  _addStyles() {
    if (document.getElementById('exercise-view-styles')) {return;}

    const style = document.createElement('style');
    style.id = 'exercise-view-styles';
    style.textContent = `
      .exercise-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: var(--space-md);
      }

      .exercise-header {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        margin-bottom: var(--space-sm);
      }

      .quit-btn {
        background: none;
        border: none;
        font-size: var(--font-size-lg);
        cursor: pointer;
        color: var(--color-text-muted);
        padding: var(--space-xs);
      }

      .quit-btn:hover {
        color: var(--color-error);
      }

      .exercise-info {
        flex: 1;
      }

      .exercise-title {
        display: block;
        font-weight: bold;
      }

      .progress-text {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .score-display {
        font-size: var(--font-size-lg);
        font-weight: bold;
        color: var(--color-accent);
      }

      .progress-bar {
        height: 4px;
        background: var(--color-border);
        border-radius: 2px;
        margin-bottom: var(--space-lg);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-accent);
        transition: width 0.3s ease;
      }

      .staff-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 150px;
      }

      .feedback-container {
        min-height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-md);
      }

      .feedback {
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        font-weight: bold;
        text-align: center;
      }

      .feedback.correct {
        background: rgba(76, 175, 80, 0.1);
        color: var(--color-success);
      }

      .feedback.incorrect {
        background: rgba(244, 67, 54, 0.1);
        color: var(--color-error);
      }

      .streak {
        display: block;
        font-size: var(--font-size-sm);
        margin-top: var(--space-xs);
      }

      .buttons-container {
        margin-bottom: var(--space-md);
      }

      .actions-container {
        display: flex;
        justify-content: center;
        gap: var(--space-md);
      }

      .hint-btn, .skip-btn {
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .hint-btn:hover, .skip-btn:hover {
        background: var(--color-bg-hover);
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Cache la vue
   */
  hide() {
    this.container.classList.remove('active');
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  /**
   * Affiche la vue
   */
  show() {
    this.container.classList.add('active');
    if (this._keyHandler) {
      document.addEventListener('keydown', this._keyHandler);
    }
  }

  /**
   * Nettoie la vue
   */
  dispose() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
    if (this.noteRenderer) {
      this.noteRenderer.dispose();
    }
    if (this.noteButtons) {
      this.noteButtons.dispose();
    }
    this.container.innerHTML = '';
  }
}

export default ExerciseView;
