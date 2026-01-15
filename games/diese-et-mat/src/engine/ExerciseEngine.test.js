/**
 * Tests pour ExerciseEngine
 *
 * @module engine/ExerciseEngine.test
 */

import { jest } from '@jest/globals';
import { ExerciseEngine } from './ExerciseEngine.js';

// ============================================================================
// Mocks
// ============================================================================

// Mock Pitch
const createMockPitch = (pitchClass = 0, octave = 4) => ({
  pitchClass,
  octave,
  toFrench: () => `Do${octave}`,
  toEnglish: () => `C${octave}`,
});

// Mock Interval
const createMockInterval = (semitones = 4) => ({
  toSemitones: () => semitones,
  toFrench: () => 'Tierce majeure',
  toAbbrev: () => 'M3',
});

// Mock Chord
const createMockChord = (type = 'major') => ({
  root: createMockPitch(),
  type,
  toSymbol: () => 'CM',
  toFrench: () => 'Do majeur',
});

// ============================================================================
// Tests
// ============================================================================

describe('ExerciseEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ExerciseEngine();
  });

  describe('État initial', () => {
    test('doit être en état IDLE au démarrage', () => {
      expect(engine.getState()).toBe('idle');
      expect(engine.isRunning()).toBe(false);
    });

    test('doit avoir une question courante nulle', () => {
      expect(engine.currentQuestion).toBeNull();
      expect(engine.currentIndex).toBe(0);
    });
  });

  describe('startSession()', () => {
    const exerciseConfig = {
      id: 'test-exercise',
      mode: 'visual-to-name',
      config: {
        questionsCount: 5,
        clef: 'treble',
        difficulty: 1,
      },
    };

    test('doit démarrer une session avec la bonne configuration', () => {
      const question = engine.startSession(exerciseConfig);

      expect(engine.getState()).toBe('running');
      expect(engine.isRunning()).toBe(true);
      expect(engine.totalQuestions).toBe(5);
      expect(engine.currentIndex).toBe(1);
      expect(question).not.toBeNull();
    });

    test('doit émettre l\'événement session-start', () => {
      const callback = jest.fn();
      engine.on('session-start', callback);

      engine.startSession(exerciseConfig);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          exercise: exerciseConfig,
          totalQuestions: 5,
        }),
      );
    });

    test('doit créer le générateur et le calculateur', () => {
      engine.startSession(exerciseConfig);

      expect(engine.generator).not.toBeNull();
      expect(engine.calculator).not.toBeNull();
    });

    test('doit utiliser 20 questions par défaut si non spécifié', () => {
      const config = { id: 'test', mode: 'visual-to-name', config: {} };
      engine.startSession(config);

      expect(engine.totalQuestions).toBe(20);
    });
  });

  describe('nextQuestion()', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 3 },
      });
    });

    test('doit passer à la question suivante', () => {
      const initialIndex = engine.currentIndex;
      engine.nextQuestion();

      expect(engine.currentIndex).toBe(initialIndex + 1);
    });

    test('doit émettre l\'événement question-start', () => {
      const callback = jest.fn();
      engine.on('question-start', callback);

      engine.nextQuestion();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          index: expect.any(Number),
          total: 3,
        }),
      );
    });

    test('doit réinitialiser le compteur d\'indices', () => {
      engine.hintsUsed = 2;
      engine.nextQuestion();

      expect(engine.hintsUsed).toBe(0);
    });

    test('doit terminer la session quand toutes les questions sont passées', () => {
      // Passer toutes les questions (déjà à 1 après startSession)
      engine.nextQuestion(); // 2
      engine.nextQuestion(); // 3
      const result = engine.nextQuestion(); // devrait terminer

      expect(engine.getState()).toBe('finished');
      expect(result).toHaveProperty('totalScore');
    });

    test('doit retourner null si la session n\'est pas en cours', () => {
      engine.cancel();
      const result = engine.nextQuestion();

      expect(result).toBeNull();
    });
  });

  describe('submitAnswer()', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 5 },
      });
    });

    test('doit valider une réponse correcte par pitchClass', () => {
      // Simuler une question de note
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0), // Do
      };

      const result = engine.submitAnswer(0);

      expect(result.valid).toBe(true);
      expect(result.correct).toBe(true);
    });

    test('doit valider une réponse incorrecte par pitchClass', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0), // Do
      };

      const result = engine.submitAnswer(3); // Fa au lieu de Do

      expect(result.valid).toBe(true);
      expect(result.correct).toBe(false);
    });

    test('doit émettre l\'événement question-answered', () => {
      const callback = jest.fn();
      engine.on('question-answered', callback);

      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0),
      };

      engine.submitAnswer(0);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          correct: true,
        }),
      );
    });

    test('doit retourner une erreur si la session n\'est pas active', () => {
      engine.cancel();
      const result = engine.submitAnswer(0);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session non active');
    });

    test('doit inclure le temps passé dans le résultat', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0),
      };

      const result = engine.submitAnswer(0);

      expect(result).toHaveProperty('timeSpent');
      expect(typeof result.timeSpent).toBe('number');
    });

    test('doit indiquer si c\'est la dernière question', () => {
      // Aller à la dernière question
      for (let i = 1; i < 5; i++) {
        engine.nextQuestion();
      }

      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0),
      };

      const result = engine.submitAnswer(0);

      expect(result.isLastQuestion).toBe(true);
    });
  });

  describe('Validation par type de question', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 5 },
      });
    });

    test('doit valider une réponse de note par nom français', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0, 4),
      };

      const result = engine.submitAnswer('Do');

      expect(result.correct).toBe(true);
    });

    test('doit valider une réponse d\'intervalle par demi-tons', () => {
      engine.currentQuestion = {
        type: 'interval',
        interval: createMockInterval(4),
      };

      const result = engine.submitAnswer(4);

      expect(result.correct).toBe(true);
    });

    test('doit valider une réponse d\'intervalle par abréviation', () => {
      engine.currentQuestion = {
        type: 'interval',
        interval: createMockInterval(4),
      };

      const result = engine.submitAnswer('m3');

      expect(result.correct).toBe(true);
    });

    test('doit valider une réponse d\'accord par type', () => {
      engine.currentQuestion = {
        type: 'chord',
        expectedType: 'major',
        chord: createMockChord('major'),
      };

      const result = engine.submitAnswer('major');

      expect(result.correct).toBe(true);
    });

    test('doit valider une réponse de rythme', () => {
      engine.currentQuestion = {
        type: 'rhythm',
        pattern: ['quarter', 'quarter', 'half'],
      };

      const result = engine.submitAnswer('correct');

      expect(result.correct).toBe(true);
    });
  });

  describe('requestHint()', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 5 },
      });
    });

    test('doit retourner un indice pour une note', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0, 4),
      };

      const hint = engine.requestHint();

      expect(hint).toHaveProperty('level');
      expect(hint).toHaveProperty('text');
      expect(hint.level).toBe(1);
    });

    test('doit incrémenter le compteur d\'indices', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0, 4),
      };

      expect(engine.hintsUsed).toBe(0);
      engine.requestHint();
      expect(engine.hintsUsed).toBe(1);
      engine.requestHint();
      expect(engine.hintsUsed).toBe(2);
    });

    test('doit retourner des indices de plus en plus révélateurs', () => {
      engine.currentQuestion = {
        type: 'note',
        pitch: createMockPitch(0, 4),
      };

      const hint1 = engine.requestHint();
      const hint2 = engine.requestHint();
      const hint3 = engine.requestHint();

      expect(hint1.level).toBe(1);
      expect(hint2.level).toBe(2);
      expect(hint3.level).toBe(3);
    });

    test('doit retourner null si pas de question courante', () => {
      engine.currentQuestion = null;
      const hint = engine.requestHint();

      expect(hint).toBeNull();
    });
  });

  describe('endSession()', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test-exercise',
        mode: 'visual-to-name',
        config: { questionsCount: 3 },
      });
    });

    test('doit terminer la session et retourner un résumé', () => {
      const summary = engine.endSession();

      expect(engine.getState()).toBe('finished');
      expect(summary).toHaveProperty('exerciseId', 'test-exercise');
      expect(summary).toHaveProperty('totalScore');
      expect(summary).toHaveProperty('duration');
    });

    test('doit émettre l\'événement session-end', () => {
      const callback = jest.fn();
      engine.on('session-end', callback);

      engine.endSession();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          exerciseId: 'test-exercise',
        }),
      );
    });

    test('doit retourner le même résumé si appelé plusieurs fois', () => {
      const summary1 = engine.endSession();
      const summary2 = engine.endSession();

      expect(summary2).toEqual(summary1);
    });
  });

  describe('pause() / resume() / cancel()', () => {
    beforeEach(() => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 5 },
      });
    });

    test('doit mettre en pause une session en cours', () => {
      engine.pause();

      expect(engine.getState()).toBe('paused');
      expect(engine.isRunning()).toBe(false);
    });

    test('doit reprendre une session en pause', () => {
      engine.pause();
      engine.resume();

      expect(engine.getState()).toBe('running');
      expect(engine.isRunning()).toBe(true);
    });

    test('doit annuler une session', () => {
      engine.cancel();

      expect(engine.getState()).toBe('idle');
      expect(engine.currentQuestion).toBeNull();
      expect(engine.currentIndex).toBe(0);
    });

    test('pause() ne doit rien faire si pas en cours', () => {
      engine.pause();
      engine.pause(); // Deuxième appel

      expect(engine.getState()).toBe('paused');
    });

    test('resume() ne doit rien faire si pas en pause', () => {
      engine.resume(); // Pas en pause

      expect(engine.getState()).toBe('running');
    });
  });

  describe('getProgress()', () => {
    test('doit retourner la progression courante', () => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 10 },
      });

      const progress = engine.getProgress();

      expect(progress.current).toBe(1);
      expect(progress.total).toBe(10);
      expect(progress.percentage).toBe(10);
      expect(progress).toHaveProperty('stats');
    });

    test('doit calculer le pourcentage correctement', () => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 4 },
      });

      engine.nextQuestion(); // 2/4 = 50%
      const progress = engine.getProgress();

      expect(progress.percentage).toBe(50);
    });
  });

  describe('Modes d\'exercice', () => {
    test('doit supporter le mode visual-to-name', () => {
      engine.startSession({
        id: 'test',
        mode: 'visual-to-name',
        config: { questionsCount: 1 },
      });

      expect(engine.currentQuestion).not.toBeNull();
      expect(engine.currentQuestion.type).toBe('note');
    });

    test('doit supporter le mode interval', () => {
      engine.startSession({
        id: 'test',
        mode: 'interval',
        config: { questionsCount: 1 },
      });

      expect(engine.currentQuestion).not.toBeNull();
      expect(engine.currentQuestion.type).toBe('interval');
    });

    test('doit supporter le mode chord', () => {
      engine.startSession({
        id: 'test',
        mode: 'chord',
        config: { questionsCount: 1, chordTypes: ['major', 'minor'] },
      });

      expect(engine.currentQuestion).not.toBeNull();
      expect(engine.currentQuestion.type).toBe('chord');
    });

    test('doit supporter le mode rhythm', () => {
      engine.startSession({
        id: 'test',
        mode: 'rhythm',
        config: {
          questionsCount: 1,
          durations: ['quarter', 'half'],
          beatsPerMeasure: 4,
          tempo: 90,
        },
      });

      expect(engine.currentQuestion).not.toBeNull();
      expect(engine.currentQuestion.type).toBe('rhythm');
    });

    test('doit lever une erreur pour un mode non supporté', () => {
      expect(() => {
        engine.startSession({
          id: 'test',
          mode: 'unknown-mode',
          config: { questionsCount: 1 },
        });
      }).toThrow('Mode d\'exercice non supporté: unknown-mode');
    });
  });
});
