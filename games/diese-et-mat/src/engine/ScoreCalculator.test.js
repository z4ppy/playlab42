/**
 * Tests pour ScoreCalculator
 *
 * @module engine/ScoreCalculator.test
 */

import { ScoreCalculator } from './ScoreCalculator.js';

// ============================================================================
// Tests
// ============================================================================

describe('ScoreCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new ScoreCalculator();
  });

  describe('Configuration', () => {
    test('doit utiliser les valeurs par défaut', () => {
      expect(calculator.basePoints).toBe(10);
      expect(calculator.timeBonus).toBe(false);
      expect(calculator.totalScore).toBe(0);
      expect(calculator.currentStreak).toBe(0);
    });

    test('doit accepter une configuration personnalisée', () => {
      const custom = new ScoreCalculator({
        basePoints: 20,
        timeBonus: true,
      });

      expect(custom.basePoints).toBe(20);
      expect(custom.timeBonus).toBe(true);
    });
  });

  describe('calculateScore() - Réponse correcte', () => {
    test('doit attribuer les points de base pour une bonne réponse', () => {
      const result = calculator.calculateScore(true);

      expect(result.points).toBe(10);
      expect(result.breakdown.base).toBe(10);
    });

    test('doit incrémenter le streak', () => {
      calculator.calculateScore(true);
      expect(calculator.currentStreak).toBe(1);

      calculator.calculateScore(true);
      expect(calculator.currentStreak).toBe(2);
    });

    test('doit attribuer XP pour une bonne réponse', () => {
      const result = calculator.calculateScore(true);

      expect(result.xp).toBe(5); // XP_PER_CORRECT = 5
    });

    test('doit incrémenter le compteur de bonnes réponses', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true);

      expect(calculator.correctCount).toBe(2);
      expect(calculator.totalCount).toBe(2);
    });
  });

  describe('calculateScore() - Réponse incorrecte', () => {
    test('doit retourner 0 points pour une mauvaise réponse', () => {
      const result = calculator.calculateScore(false);

      expect(result.points).toBe(0);
      expect(result.xp).toBe(0);
      expect(result.streak).toBe(0);
    });

    test('doit réinitialiser le streak', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true);
      expect(calculator.currentStreak).toBe(2);

      calculator.calculateScore(false);
      expect(calculator.currentStreak).toBe(0);
    });

    test('doit incrémenter le compteur total sans le compteur correct', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(false);

      expect(calculator.correctCount).toBe(1);
      expect(calculator.totalCount).toBe(2);
    });
  });

  describe('Bonus de streak', () => {
    test('doit ajouter un bonus pour les réponses consécutives', () => {
      // Première réponse : pas de bonus streak
      const r1 = calculator.calculateScore(true);
      expect(r1.breakdown.streakBonus).toBe(0);

      // Deuxième réponse : streak = 2, bonus = (2-1) * 0.5 * 10 = 5
      const r2 = calculator.calculateScore(true);
      expect(r2.breakdown.streakBonus).toBe(5);

      // Troisième réponse : streak = 3, bonus = (3-1) * 0.5 * 10 = 10
      const r3 = calculator.calculateScore(true);
      expect(r3.breakdown.streakBonus).toBe(10);
    });

    test('doit plafonner le bonus de streak à 10', () => {
      // Atteindre un streak de 15
      for (let i = 0; i < 15; i++) {
        calculator.calculateScore(true);
      }

      // Le bonus devrait être plafonné à 10 * 0.5 * 10 = 50
      const result = calculator.calculateScore(true);
      expect(result.breakdown.streakBonus).toBe(50); // MAX_STREAK_BONUS = 10
    });

    test('doit mémoriser le meilleur streak', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true);
      calculator.calculateScore(true); // streak = 3

      calculator.calculateScore(false); // reset à 0

      calculator.calculateScore(true); // streak = 1

      expect(calculator.bestStreak).toBe(3);
    });
  });

  describe('Malus pour les indices', () => {
    test('doit appliquer un malus pour les indices utilisés', () => {
      const result = calculator.calculateScore(true, { hintsUsed: 1 });

      // 10 (base) - 5 (1 indice) = 5
      expect(result.points).toBe(5);
      expect(result.breakdown.hintPenalty).toBe(-5);
    });

    test('doit gérer plusieurs indices', () => {
      const result = calculator.calculateScore(true, { hintsUsed: 2 });

      // 10 (base) - 10 (2 indices) = 0
      expect(result.points).toBe(0);
    });

    test('ne doit pas descendre en dessous de 0 points', () => {
      const result = calculator.calculateScore(true, { hintsUsed: 5 });

      // 10 - 25 = -15, mais plancher à 0
      expect(result.points).toBe(0);
    });

    test('doit comptabiliser le total des indices utilisés', () => {
      calculator.calculateScore(true, { hintsUsed: 1 });
      calculator.calculateScore(true, { hintsUsed: 2 });

      expect(calculator.hintsUsed).toBe(3);
    });
  });

  describe('Bonus de temps', () => {
    test('ne doit pas appliquer le bonus si désactivé', () => {
      const result = calculator.calculateScore(true, {
        timeLimit: 10,
        timeRemaining: 5,
      });

      expect(result.breakdown.timeBonus).toBe(0);
    });

    test('doit appliquer le bonus temps si activé', () => {
      const calcWithTime = new ScoreCalculator({ timeBonus: true });

      const result = calcWithTime.calculateScore(true, {
        timeLimit: 10,
        timeRemaining: 10, // 100% du temps restant
      });

      // timeBonus = floor(1.0 * 10 * 0.5) = 5
      expect(result.breakdown.timeBonus).toBe(5);
    });

    test('doit calculer le bonus proportionnellement au temps restant', () => {
      const calcWithTime = new ScoreCalculator({ timeBonus: true });

      const result = calcWithTime.calculateScore(true, {
        timeLimit: 10,
        timeRemaining: 5, // 50% du temps restant
      });

      // timeBonus = floor(0.5 * 10 * 0.5) = 2
      expect(result.breakdown.timeBonus).toBe(2);
    });
  });

  describe('XP et streaks multiples de 5', () => {
    test('doit donner un bonus XP aux streaks de 5', () => {
      // Atteindre un streak de 5
      for (let i = 0; i < 4; i++) {
        calculator.calculateScore(true);
      }

      const result = calculator.calculateScore(true); // 5ème bonne réponse

      // XP = 5 (base) + 10 (streak 5 bonus) = 15
      expect(result.xp).toBe(15);
    });

    test('doit donner un bonus XP aux streaks de 10', () => {
      // Atteindre un streak de 10
      for (let i = 0; i < 9; i++) {
        calculator.calculateScore(true);
      }

      const result = calculator.calculateScore(true); // 10ème

      expect(result.xp).toBe(15);
    });
  });

  describe('Totaux', () => {
    test('doit cumuler le score total', () => {
      calculator.calculateScore(true); // 10
      calculator.calculateScore(true); // 10 + 5 (streak) = 15

      expect(calculator.totalScore).toBe(25);
    });

    test('doit cumuler l\'XP total', () => {
      calculator.calculateScore(true); // 5 XP
      calculator.calculateScore(true); // 5 XP

      expect(calculator.totalXP).toBe(10);
    });
  });

  describe('getStats()', () => {
    test('doit retourner toutes les statistiques', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(false);
      calculator.calculateScore(true);

      const stats = calculator.getStats();

      expect(stats.correctCount).toBe(2);
      expect(stats.totalCount).toBe(3);
      expect(stats.accuracy).toBe(67); // 2/3 * 100 arrondi
      expect(stats.currentStreak).toBe(1);
      expect(stats.bestStreak).toBe(1);
    });

    test('doit gérer le cas sans question', () => {
      const stats = calculator.getStats();

      expect(stats.accuracy).toBe(0);
      expect(stats.totalCount).toBe(0);
    });
  });

  describe('getAccuracy()', () => {
    test('doit calculer le pourcentage de précision', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true);
      calculator.calculateScore(false);
      calculator.calculateScore(true);

      expect(calculator.getAccuracy()).toBe(75);
    });

    test('doit retourner 0 sans question', () => {
      expect(calculator.getAccuracy()).toBe(0);
    });
  });

  describe('calculateLevel() - Statique', () => {
    test('doit être niveau 1 avec 0 XP', () => {
      const level = ScoreCalculator.calculateLevel(0);

      expect(level.level).toBe(1);
      expect(level.currentXP).toBe(0);
      expect(level.progress).toBe(0);
    });

    test('doit calculer le niveau requis pour le niveau 1', () => {
      // XP requis pour niveau 1 = 100 * 1^1.5 = 100
      const level = ScoreCalculator.calculateLevel(50);

      expect(level.level).toBe(1);
      expect(level.currentXP).toBe(50);
      expect(level.requiredXP).toBe(100);
      expect(level.progress).toBe(50);
    });

    test('doit passer au niveau 2 avec assez d\'XP', () => {
      // 100 XP pour niveau 1, niveau 2 requiert 100 * 2^1.5 = 282
      const level = ScoreCalculator.calculateLevel(100);

      expect(level.level).toBe(2);
      expect(level.currentXP).toBe(0);
    });

    test('doit calculer correctement les niveaux supérieurs', () => {
      // Niveau 1: 100, Niveau 2: 282, Niveau 3: 519...
      // Total pour niveau 3: 100 + 282 = 382
      const level = ScoreCalculator.calculateLevel(400);

      expect(level.level).toBe(3);
      expect(level.currentXP).toBe(18); // 400 - 382 = 18
    });
  });

  describe('reset()', () => {
    test('doit réinitialiser toutes les valeurs', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true, { hintsUsed: 1 });
      calculator.calculateScore(true);

      calculator.reset();

      expect(calculator.totalScore).toBe(0);
      expect(calculator.totalXP).toBe(0);
      expect(calculator.currentStreak).toBe(0);
      expect(calculator.bestStreak).toBe(0);
      expect(calculator.correctCount).toBe(0);
      expect(calculator.totalCount).toBe(0);
      expect(calculator.hintsUsed).toBe(0);
    });

    test('doit permettre de recommencer à compter après reset', () => {
      calculator.calculateScore(true);
      calculator.calculateScore(true);

      calculator.reset();

      const result = calculator.calculateScore(true);

      expect(result.streak).toBe(1);
      expect(calculator.totalScore).toBe(10);
    });
  });

  describe('Points personnalisés', () => {
    test('doit utiliser les points de base personnalisés', () => {
      const custom = new ScoreCalculator({ basePoints: 20 });

      const result = custom.calculateScore(true);

      expect(result.points).toBe(20);
      expect(result.breakdown.base).toBe(20);
    });

    test('doit calculer le streak avec les points personnalisés', () => {
      const custom = new ScoreCalculator({ basePoints: 20 });

      custom.calculateScore(true); // streak = 1
      const result = custom.calculateScore(true); // streak = 2

      // streakBonus = (2-1) * 0.5 * 20 = 10
      expect(result.breakdown.streakBonus).toBe(10);
    });
  });
});
