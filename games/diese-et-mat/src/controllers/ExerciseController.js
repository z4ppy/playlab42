/**
 * ExerciseController - Gestion de la logique d'un exercice
 *
 * Orchestre le cycle de vie d'un exercice : démarrage, questions,
 * validation des réponses, scoring et fin de session.
 * Émet des événements pour permettre à la vue de réagir.
 *
 * @module controllers/ExerciseController
 *
 * @fires ExerciseController#exercise-started
 * @fires ExerciseController#question-changed
 * @fires ExerciseController#answer-submitted
 * @fires ExerciseController#hint-requested
 * @fires ExerciseController#exercise-ended
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { ExerciseEngine } from '../engine/ExerciseEngine.js';

// ============================================================================
// Classe ExerciseController
// ============================================================================

/**
 * Contrôleur d'exercice
 */
export class ExerciseController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur d'exercice
   *
   * @param {Object} options - Options de configuration
   * @param {Object} options.audioEngine - Moteur audio pour jouer les sons
   * @param {Function} options.loadExerciseData - Fonction async pour charger les données
   */
  constructor(options = {}) {
    super();

    /** @type {Object|null} Moteur audio */
    this.audioEngine = options.audioEngine || null;

    /** @type {Function|null} Fonction pour charger les données d'exercices */
    this.loadExerciseData = options.loadExerciseData || null;

    /** @type {ExerciseEngine|null} Moteur d'exercice */
    this.engine = null;

    /** @type {Object|null} Exercice courant */
    this.currentExercise = null;

    /** @type {Object|null} Question courante */
    this.currentQuestion = null;

    /** @type {boolean} Exercice en cours */
    this.isRunning = false;

    /** @type {Object|null} Données des exercices (cache) */
    this._exercisesData = null;
  }

  // --------------------------------------------------------------------------
  // Cycle de vie
  // --------------------------------------------------------------------------

  /**
   * Démarre un exercice
   *
   * @param {string} exerciseId - ID de l'exercice à démarrer
   * @returns {Promise<Object|null>} L'exercice démarré ou null si erreur
   *
   * @fires ExerciseController#exercise-started
   * @fires ExerciseController#question-changed
   */
  async start(exerciseId) {
    // Charger les données si nécessaire
    if (!this._exercisesData && this.loadExerciseData) {
      try {
        this._exercisesData = await this.loadExerciseData();
      } catch (error) {
        console.error('Erreur chargement données exercices:', error);
        this.emit('error', { message: 'Impossible de charger les exercices', error });
        return null;
      }
    }

    // Trouver l'exercice
    const exercise = this._exercisesData?.exercises?.find(e => e.id === exerciseId);
    if (!exercise) {
      console.error('Exercice non trouvé:', exerciseId);
      this.emit('error', { message: `Exercice non trouvé: ${exerciseId}` });
      return null;
    }

    // Initialiser
    this.currentExercise = exercise;
    this.engine = new ExerciseEngine();
    this.isRunning = true;

    /**
     * Événement émis quand un exercice démarre
     * @event ExerciseController#exercise-started
     * @type {Object}
     * @property {Object} exercise - Configuration de l'exercice
     * @property {number} totalQuestions - Nombre total de questions
     */
    this.emit('exercise-started', {
      exercise,
      totalQuestions: exercise.config?.questionsCount || 20,
    });

    // Démarrer la session et obtenir la première question
    const firstQuestion = this.engine.startSession(exercise);
    this._setCurrentQuestion(firstQuestion);

    return exercise;
  }

  /**
   * Met à jour la question courante et émet l'événement
   * @private
   */
  _setCurrentQuestion(question) {
    this.currentQuestion = question;

    const progress = this.engine.getProgress();

    /**
     * Événement émis quand la question change
     * @event ExerciseController#question-changed
     * @type {Object}
     * @property {Object} question - La nouvelle question
     * @property {number} index - Index de la question (1-based)
     * @property {number} total - Nombre total de questions
     * @property {number} percentage - Pourcentage de progression
     */
    this.emit('question-changed', {
      question,
      index: progress.current,
      total: progress.total,
      percentage: progress.percentage,
      stats: progress.stats,
    });
  }

  /**
   * Termine l'exercice
   *
   * @returns {Object} Résumé de la session
   *
   * @fires ExerciseController#exercise-ended
   */
  end() {
    if (!this.isRunning) {
      return null;
    }

    const summary = this.engine?.endSession() || {};
    this.isRunning = false;

    /**
     * Événement émis quand l'exercice se termine
     * @event ExerciseController#exercise-ended
     * @type {Object}
     * @property {Object} summary - Résumé de la session (score, stats, etc.)
     * @property {Object} exercise - L'exercice qui vient de se terminer
     */
    this.emit('exercise-ended', {
      summary,
      exercise: this.currentExercise,
    });

    return summary;
  }

  // --------------------------------------------------------------------------
  // Réponses
  // --------------------------------------------------------------------------

  /**
   * Soumet une réponse à la question courante
   *
   * @param {*} answer - La réponse de l'utilisateur
   * @returns {Object} Résultat de la validation
   *
   * @fires ExerciseController#answer-submitted
   */
  submitAnswer(answer) {
    if (!this.isRunning || !this.engine) {
      return { valid: false, error: 'Aucun exercice en cours' };
    }

    const result = this.engine.submitAnswer(answer);

    /**
     * Événement émis quand une réponse est soumise
     * @event ExerciseController#answer-submitted
     * @type {Object}
     * @property {*} answer - La réponse soumise
     * @property {boolean} correct - Si la réponse est correcte
     * @property {Object} expectedAnswer - La réponse attendue
     * @property {number} score - Score gagné
     * @property {boolean} isLastQuestion - Si c'était la dernière question
     */
    this.emit('answer-submitted', {
      answer,
      ...result,
    });

    return result;
  }

  /**
   * Passe à la question suivante
   *
   * @returns {Object|null} La prochaine question ou null si terminé
   *
   * @fires ExerciseController#question-changed
   * @fires ExerciseController#exercise-ended
   */
  nextQuestion() {
    if (!this.isRunning || !this.engine) {
      return null;
    }

    const question = this.engine.nextQuestion();

    if (question === null || this.engine.getState() === 'finished') {
      // L'exercice est terminé
      this.end();
      return null;
    }

    this._setCurrentQuestion(question);
    return question;
  }

  /**
   * Passe la question (compte comme erreur)
   *
   * @returns {Object} Résultat du skip
   */
  skip() {
    return this.submitAnswer(-1);
  }

  // --------------------------------------------------------------------------
  // Indices
  // --------------------------------------------------------------------------

  /**
   * Demande un indice
   *
   * @returns {Object|null} L'indice ou null
   *
   * @fires ExerciseController#hint-requested
   */
  requestHint() {
    if (!this.isRunning || !this.engine) {
      return null;
    }

    const hint = this.engine.requestHint();

    /**
     * Événement émis quand un indice est demandé
     * @event ExerciseController#hint-requested
     * @type {Object}
     * @property {Object} hint - L'indice (level, text)
     * @property {number} hintsUsed - Nombre d'indices utilisés
     */
    this.emit('hint-requested', {
      hint,
      hintsUsed: this.engine.hintsUsed,
    });

    return hint;
  }

  // --------------------------------------------------------------------------
  // Audio
  // --------------------------------------------------------------------------

  /**
   * Joue le son de la question courante
   *
   * @returns {Promise<void>}
   */
  async playQuestionSound() {
    if (!this.audioEngine || !this.currentQuestion) {
      return;
    }

    const question = this.currentQuestion;

    try {
      switch (question.type) {
        case 'note':
          if (question.pitch) {
            await this.audioEngine.playNote(question.pitch.toTone(), 0.5);
          }
          break;

        case 'interval':
          if (question.pitch1 && question.pitch2) {
            await this.audioEngine.playNote(question.pitch1.toTone(), 0.4);
            await this._delay(500);
            await this.audioEngine.playNote(question.pitch2.toTone(), 0.4);
          }
          break;

        case 'chord':
          if (question.chord) {
            const pitches = question.chord.getPitches();
            await this.audioEngine.playChord(pitches.map(p => p.toTone()), 0.6);
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Erreur lecture audio:', error);
    }
  }

  /**
   * Délai utilitaire
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  /**
   * Retourne la progression actuelle
   *
   * @returns {Object} { current, total, percentage, stats }
   */
  getProgress() {
    return this.engine?.getProgress() || { current: 0, total: 0, percentage: 0, stats: null };
  }

  /**
   * Retourne le score actuel
   *
   * @returns {number}
   */
  getScore() {
    return this.engine?.calculator?.getStats()?.totalScore || 0;
  }

  /**
   * Retourne les stats de la session
   *
   * @returns {Object|null}
   */
  getStats() {
    return this.engine?.calculator?.getStats() || null;
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie les ressources
   */
  dispose() {
    if (this.isRunning) {
      this.end();
    }

    this.engine = null;
    this.currentExercise = null;
    this.currentQuestion = null;
    this._exercisesData = null;

    super.dispose();
  }
}

export default ExerciseController;
