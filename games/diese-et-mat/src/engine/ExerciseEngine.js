/**
 * ExerciseEngine - Moteur d'exercices
 *
 * Orchestre les sessions d'exercices : génération de questions,
 * validation des réponses, calcul des scores et suivi de progression.
 *
 * @module engine/ExerciseEngine
 */

import { QuestionGenerator } from './QuestionGenerator.js';
import { ScoreCalculator } from './ScoreCalculator.js';

// ============================================================================
// Constantes
// ============================================================================

/** États de la session */
const SESSION_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

// ============================================================================
// Classe ExerciseEngine
// ============================================================================

/**
 * Moteur d'exercices
 */
export class ExerciseEngine {
  /**
   * Crée un nouveau moteur d'exercices
   */
  constructor() {
    /** @type {Object|null} Configuration de l'exercice courant */
    this.exercise = null;

    /** @type {QuestionGenerator|null} Générateur de questions */
    this.generator = null;

    /** @type {ScoreCalculator|null} Calculateur de score */
    this.calculator = null;

    /** @type {string} État de la session */
    this.state = SESSION_STATES.IDLE;

    /** @type {Object|null} Question courante */
    this.currentQuestion = null;

    /** @type {number} Index de la question courante */
    this.currentIndex = 0;

    /** @type {number} Nombre total de questions */
    this.totalQuestions = 0;

    /** @type {number} Indices utilisés pour la question courante */
    this.hintsUsed = 0;

    /** @type {number} Timestamp de début de session */
    this.sessionStartTime = 0;

    /** @type {number} Timestamp de début de question */
    this.questionStartTime = 0;

    /** @type {Object} Callbacks d'événements */
    this._callbacks = {
      'session-start': [],
      'session-end': [],
      'question-start': [],
      'question-answered': [],
      'achievement-unlocked': [],
    };
  }

  // --------------------------------------------------------------------------
  // Gestion de session
  // --------------------------------------------------------------------------

  /**
   * Démarre une nouvelle session d'exercice
   *
   * @param {Object} exercise - Configuration de l'exercice
   * @param {string} exercise.id - ID de l'exercice
   * @param {string} exercise.mode - Mode (visual-to-name, name-to-visual, etc.)
   * @param {Object} exercise.config - Configuration
   * @returns {Object} Première question
   */
  startSession(exercise) {
    this.exercise = exercise;
    this.totalQuestions = exercise.config?.questionsCount || 20;
    this.currentIndex = 0;
    this.hintsUsed = 0;
    this.sessionStartTime = Date.now();

    // Créer le générateur
    this.generator = new QuestionGenerator({
      clef: exercise.config?.clef || 'treble',
      range: exercise.config?.range,
      accidentals: exercise.config?.accidentals || false,
      difficulty: exercise.config?.difficulty || 1,
    });

    // Créer le calculateur
    this.calculator = new ScoreCalculator({
      timeBonus: exercise.config?.timing === 'timed',
    });

    this.state = SESSION_STATES.RUNNING;

    this._emit('session-start', {
      exercise: this.exercise,
      totalQuestions: this.totalQuestions,
    });

    // Générer la première question
    return this.nextQuestion();
  }

  /**
   * Passe à la question suivante
   *
   * @returns {Object|null} Prochaine question ou null si terminé
   */
  nextQuestion() {
    if (this.state !== SESSION_STATES.RUNNING) {return null;}

    if (this.currentIndex >= this.totalQuestions) {
      return this.endSession();
    }

    this.currentIndex++;
    this.hintsUsed = 0;
    this.questionStartTime = Date.now();

    // Générer la question selon le mode
    this.currentQuestion = this._generateQuestion();

    this._emit('question-start', {
      question: this.currentQuestion,
      index: this.currentIndex,
      total: this.totalQuestions,
    });

    return this.currentQuestion;
  }

  /**
   * Génère une question selon le mode
   * @private
   */
  _generateQuestion() {
    const mode = this.exercise?.mode || 'visual-to-name';

    switch (mode) {
      case 'visual-to-name':
      case 'audio-to-name':
        return this.generator.generateNote();

      case 'interval':
        return this.generator.generateInterval({
          types: this.exercise.config?.intervalTypes,
        });

      case 'chord':
        return this.generator.generateChord({
          types: this.exercise.config?.chordTypes,
        });

      default:
        return this.generator.generateNote();
    }
  }

  // --------------------------------------------------------------------------
  // Validation des réponses
  // --------------------------------------------------------------------------

  /**
   * Soumet une réponse
   *
   * @param {*} answer - Réponse de l'utilisateur
   * @returns {Object} Résultat de la validation
   */
  submitAnswer(answer) {
    if (this.state !== SESSION_STATES.RUNNING || !this.currentQuestion) {
      return { valid: false, error: 'Session non active' };
    }

    const timeSpent = Date.now() - this.questionStartTime;
    const correct = this._validateAnswer(answer);

    // Calculer le score
    const scoreResult = this.calculator.calculateScore(correct, {
      hintsUsed: this.hintsUsed,
      timeRemaining: this.exercise.config?.timeLimit
        ? this.exercise.config.timeLimit * 1000 - timeSpent
        : null,
      timeLimit: this.exercise.config?.timeLimit
        ? this.exercise.config.timeLimit * 1000
        : null,
    });

    const result = {
      valid: true,
      correct,
      expectedAnswer: this._getExpectedAnswer(),
      userAnswer: answer,
      ...scoreResult,
      timeSpent,
      isLastQuestion: this.currentIndex >= this.totalQuestions,
    };

    this._emit('question-answered', result);

    return result;
  }

  /**
   * Valide une réponse
   * @private
   */
  _validateAnswer(answer) {
    if (!this.currentQuestion) {return false;}

    switch (this.currentQuestion.type) {
      case 'note':
        return this._validateNoteAnswer(answer);

      case 'interval':
        return this._validateIntervalAnswer(answer);

      case 'chord':
        return this._validateChordAnswer(answer);

      default:
        return false;
    }
  }

  /**
   * Valide une réponse de note
   * @private
   */
  _validateNoteAnswer(answer) {
    const pitch = this.currentQuestion.pitch;

    // Accepter le pitchClass (0-6) ou le nom (Do, C, etc.)
    if (typeof answer === 'number') {
      return answer === pitch.pitchClass;
    }

    // Normaliser la réponse
    const normalized = answer.toLowerCase().trim();
    const frenchName = pitch.toFrench().slice(0, -1).toLowerCase();
    const englishName = pitch.toEnglish().slice(0, -1).toLowerCase();

    return normalized === frenchName || normalized === englishName;
  }

  /**
   * Valide une réponse d'intervalle
   * @private
   */
  _validateIntervalAnswer(answer) {
    const interval = this.currentQuestion.interval;

    // Accepter le nombre de demi-tons, l'abréviation ou le nom
    if (typeof answer === 'number') {
      return answer === interval.toSemitones();
    }

    const normalized = answer.toLowerCase().trim();
    const abbrev = interval.toAbbrev().toLowerCase();
    const french = interval.toFrench().toLowerCase();

    return normalized === abbrev || normalized === french;
  }

  /**
   * Valide une réponse d'accord
   * @private
   */
  _validateChordAnswer(answer) {
    const expectedType = this.currentQuestion.expectedType;

    const normalized = answer.toLowerCase().trim();
    return normalized === expectedType;
  }

  /**
   * Retourne la réponse attendue
   * @private
   */
  _getExpectedAnswer() {
    if (!this.currentQuestion) {return null;}

    switch (this.currentQuestion.type) {
      case 'note':
        return {
          pitchClass: this.currentQuestion.pitch.pitchClass,
          french: this.currentQuestion.pitch.toFrench(),
          english: this.currentQuestion.pitch.toEnglish(),
        };

      case 'interval':
        return {
          semitones: this.currentQuestion.interval.toSemitones(),
          french: this.currentQuestion.interval.toFrench(),
          abbrev: this.currentQuestion.interval.toAbbrev(),
        };

      case 'chord':
        return {
          type: this.currentQuestion.expectedType,
          symbol: this.currentQuestion.chord.toSymbol(),
          french: this.currentQuestion.chord.toFrench(),
        };

      default:
        return null;
    }
  }

  // --------------------------------------------------------------------------
  // Indices
  // --------------------------------------------------------------------------

  /**
   * Demande un indice
   *
   * @returns {Object|null} Indice ou null
   */
  requestHint() {
    if (!this.currentQuestion) {return null;}

    this.hintsUsed++;

    switch (this.currentQuestion.type) {
      case 'note':
        return this._getNoteHint();

      case 'interval':
        return this._getIntervalHint();

      case 'chord':
        return this._getChordHint();

      default:
        return null;
    }
  }

  /**
   * Retourne un indice pour une note
   * @private
   */
  _getNoteHint() {
    const pitch = this.currentQuestion.pitch;
    const hints = [
      `La note est dans l'octave ${pitch.octave}`,
      `La première lettre est "${pitch.toFrench()[0]}"`,
      `C'est la note ${pitch.toFrench()}`,
    ];

    return {
      level: Math.min(this.hintsUsed, hints.length),
      text: hints[Math.min(this.hintsUsed - 1, hints.length - 1)],
    };
  }

  /**
   * Retourne un indice pour un intervalle
   * @private
   */
  _getIntervalHint() {
    const interval = this.currentQuestion.interval;
    const hints = [
      `L'intervalle fait ${interval.toSemitones()} demi-tons`,
      `C'est une ${interval.toFrench()}`,
    ];

    return {
      level: Math.min(this.hintsUsed, hints.length),
      text: hints[Math.min(this.hintsUsed - 1, hints.length - 1)],
    };
  }

  /**
   * Retourne un indice pour un accord
   * @private
   */
  _getChordHint() {
    const chord = this.currentQuestion.chord;
    const hints = [
      `La fondamentale est ${chord.root.toFrench().slice(0, -1)}`,
      `C'est un accord ${chord.toFrench()}`,
    ];

    return {
      level: Math.min(this.hintsUsed, hints.length),
      text: hints[Math.min(this.hintsUsed - 1, hints.length - 1)],
    };
  }

  // --------------------------------------------------------------------------
  // Fin de session
  // --------------------------------------------------------------------------

  /**
   * Termine la session
   *
   * @returns {Object} Résumé de la session
   */
  endSession() {
    if (this.state === SESSION_STATES.FINISHED) {
      return this._getSessionSummary();
    }

    this.state = SESSION_STATES.FINISHED;

    const summary = this._getSessionSummary();

    this._emit('session-end', summary);

    return summary;
  }

  /**
   * Retourne le résumé de la session
   * @private
   */
  _getSessionSummary() {
    const stats = this.calculator.getStats();
    const duration = Date.now() - this.sessionStartTime;

    return {
      exerciseId: this.exercise?.id,
      skill: this.exercise?.config?.skill || this.exercise?.skills?.[0],
      ...stats,
      duration,
      averageTime: stats.totalCount > 0
        ? Math.round(duration / stats.totalCount)
        : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Contrôle
  // --------------------------------------------------------------------------

  /**
   * Met en pause la session
   */
  pause() {
    if (this.state === SESSION_STATES.RUNNING) {
      this.state = SESSION_STATES.PAUSED;
    }
  }

  /**
   * Reprend la session
   */
  resume() {
    if (this.state === SESSION_STATES.PAUSED) {
      this.state = SESSION_STATES.RUNNING;
    }
  }

  /**
   * Annule la session
   */
  cancel() {
    this.state = SESSION_STATES.IDLE;
    this.currentQuestion = null;
    this.currentIndex = 0;
  }

  // --------------------------------------------------------------------------
  // Événements
  // --------------------------------------------------------------------------

  /**
   * Ajoute un listener
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Callback
   */
  on(event, callback) {
    if (this._callbacks[event]) {
      this._callbacks[event].push(callback);
    }
  }

  /**
   * Retire un listener
   *
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Callback
   */
  off(event, callback) {
    if (this._callbacks[event]) {
      const index = this._callbacks[event].indexOf(callback);
      if (index !== -1) {
        this._callbacks[event].splice(index, 1);
      }
    }
  }

  /**
   * Émet un événement
   * @private
   */
  _emit(event, data) {
    if (this._callbacks[event]) {
      this._callbacks[event].forEach((cb) => cb(data));
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  /**
   * Retourne l'état courant
   *
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Retourne la progression de la session
   *
   * @returns {Object}
   */
  getProgress() {
    return {
      current: this.currentIndex,
      total: this.totalQuestions,
      percentage: Math.round((this.currentIndex / this.totalQuestions) * 100),
      stats: this.calculator?.getStats() || null,
    };
  }

  /**
   * Vérifie si une session est en cours
   *
   * @returns {boolean}
   */
  isRunning() {
    return this.state === SESSION_STATES.RUNNING;
  }
}

export default ExerciseEngine;
