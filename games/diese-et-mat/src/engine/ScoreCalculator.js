/**
 * ScoreCalculator - Calcul des scores et XP
 *
 * Gère le calcul des points en fonction des réponses, du temps,
 * des séries (streaks) et des indices utilisés.
 *
 * @module engine/ScoreCalculator
 */

// ============================================================================
// Constantes
// ============================================================================

/** Points de base par bonne réponse */
const BASE_POINTS = 10;

/** Multiplicateur de streak */
const STREAK_MULTIPLIER = 0.5;

/** Streak maximum pour le bonus */
const MAX_STREAK_BONUS = 10;

/** Malus par indice utilisé */
const HINT_PENALTY = 5;

/** Bonus temps (points par seconde restante) */
const TIME_BONUS_RATE = 0.5;

/** XP par bonne réponse */
const XP_PER_CORRECT = 5;

/** XP par streak de 5 */
const XP_PER_STREAK_5 = 10;

// ============================================================================
// Classe ScoreCalculator
// ============================================================================

/**
 * Calculateur de scores pour les exercices
 */
export class ScoreCalculator {
  /**
   * Crée un nouveau calculateur
   *
   * @param {Object} options - Options
   * @param {boolean} options.timeBonus - Activer le bonus temps
   * @param {number} options.basePoints - Points de base
   */
  constructor(options = {}) {
    /** @type {boolean} Bonus temps activé */
    this.timeBonus = options.timeBonus || false;

    /** @type {number} Points de base */
    this.basePoints = options.basePoints || BASE_POINTS;

    /** @type {number} Score total */
    this.totalScore = 0;

    /** @type {number} XP total */
    this.totalXP = 0;

    /** @type {number} Streak actuel */
    this.currentStreak = 0;

    /** @type {number} Meilleur streak */
    this.bestStreak = 0;

    /** @type {number} Nombre de bonnes réponses */
    this.correctCount = 0;

    /** @type {number} Nombre total de questions */
    this.totalCount = 0;

    /** @type {number} Indices utilisés */
    this.hintsUsed = 0;
  }

  // --------------------------------------------------------------------------
  // Calcul des scores
  // --------------------------------------------------------------------------

  /**
   * Calcule le score pour une réponse
   *
   * @param {boolean} correct - Réponse correcte
   * @param {Object} options - Options
   * @param {number} options.hintsUsed - Nombre d'indices utilisés
   * @param {number} options.timeRemaining - Temps restant (si limité)
   * @param {number} options.timeLimit - Limite de temps
   * @returns {{ points: number, xp: number, streak: number, breakdown: Object }}
   */
  calculateScore(correct, options = {}) {
    this.totalCount++;

    if (!correct) {
      // Réponse incorrecte : reset streak
      this.currentStreak = 0;
      return {
        points: 0,
        xp: 0,
        streak: 0,
        breakdown: { base: 0, streakBonus: 0, timeBonus: 0, hintPenalty: 0 },
      };
    }

    // Bonne réponse
    this.correctCount++;
    this.currentStreak++;
    this.bestStreak = Math.max(this.bestStreak, this.currentStreak);

    // Points de base
    let points = this.basePoints;

    // Bonus de streak
    const streakBonus = Math.min(this.currentStreak - 1, MAX_STREAK_BONUS) *
      STREAK_MULTIPLIER * this.basePoints;
    points += streakBonus;

    // Malus pour les indices
    const hintPenalty = (options.hintsUsed || 0) * HINT_PENALTY;
    points = Math.max(0, points - hintPenalty);
    this.hintsUsed += options.hintsUsed || 0;

    // Bonus temps
    let timeBonusPoints = 0;
    if (this.timeBonus && options.timeLimit && options.timeRemaining) {
      const ratio = options.timeRemaining / options.timeLimit;
      timeBonusPoints = Math.floor(ratio * this.basePoints * TIME_BONUS_RATE);
      points += timeBonusPoints;
    }

    // Arrondir
    points = Math.round(points);

    // XP
    let xp = XP_PER_CORRECT;
    if (this.currentStreak > 0 && this.currentStreak % 5 === 0) {
      xp += XP_PER_STREAK_5;
    }

    // Mettre à jour les totaux
    this.totalScore += points;
    this.totalXP += xp;

    return {
      points,
      xp,
      streak: this.currentStreak,
      breakdown: {
        base: this.basePoints,
        streakBonus: Math.round(streakBonus),
        timeBonus: timeBonusPoints,
        hintPenalty: -hintPenalty,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Statistiques
  // --------------------------------------------------------------------------

  /**
   * Retourne les statistiques actuelles
   *
   * @returns {Object}
   */
  getStats() {
    return {
      totalScore: this.totalScore,
      totalXP: this.totalXP,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      correctCount: this.correctCount,
      totalCount: this.totalCount,
      accuracy: this.totalCount > 0
        ? Math.round((this.correctCount / this.totalCount) * 100)
        : 0,
      hintsUsed: this.hintsUsed,
    };
  }

  /**
   * Retourne le pourcentage de précision
   *
   * @returns {number}
   */
  getAccuracy() {
    return this.totalCount > 0
      ? (this.correctCount / this.totalCount) * 100
      : 0;
  }

  // --------------------------------------------------------------------------
  // Calcul de niveau
  // --------------------------------------------------------------------------

  /**
   * Calcule le niveau depuis l'XP total
   *
   * @param {number} xp - XP total
   * @returns {{ level: number, currentXP: number, requiredXP: number, progress: number }}
   */
  static calculateLevel(xp) {
    // Formule : XP requis pour niveau N = 100 * N^1.5
    let level = 1;
    let usedXP = 0;

    while (true) {
      const requiredForNext = Math.floor(100 * Math.pow(level, 1.5));
      if (usedXP + requiredForNext > xp) {
        const currentXP = xp - usedXP;
        return {
          level,
          currentXP,
          requiredXP: requiredForNext,
          progress: Math.round((currentXP / requiredForNext) * 100),
        };
      }
      usedXP += requiredForNext;
      level++;
    }
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  /**
   * Réinitialise le calculateur pour une nouvelle session
   */
  reset() {
    this.totalScore = 0;
    this.totalXP = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.correctCount = 0;
    this.totalCount = 0;
    this.hintsUsed = 0;
  }
}

export default ScoreCalculator;
