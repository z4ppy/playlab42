import { jest } from '@jest/globals';
import GameKit from '../../../../lib/gamekit.js';
import { Pitch } from '../core/Pitch.js';
import { Interval } from '../core/Interval.js';
import { Chord } from '../core/Chord.js';
import { ExerciseEngine } from './ExerciseEngine.js';
import { ProgressTracker } from './ProgressTracker.js';
import { QuestionGenerator } from './QuestionGenerator.js';
import { ScoreCalculator } from './ScoreCalculator.js';

describe('Contrats du moteur pédagogique réel', () => {
  let engine;
  let now;

  beforeEach(() => {
    now = 10000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Math, 'random').mockReturnValue(0.25);
    engine = new ExerciseEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('enchaîne questions, indices, scores, résumé et progression sans doubles métier', async () => {
    jest.spyOn(GameKit, 'loadProgress').mockResolvedValue({
      globalXP: 0, skills: {}, sessions: [], achievements: [],
    });
    const tracker = new ProgressTracker();
    await tracker.load();
    const events = [];
    let unlocked;
    engine.on('session-start', ({ exercise, totalQuestions }) => {
      events.push(['session', exercise.id, totalQuestions]);
    });
    engine.on('question-start', ({ question, index, total }) => {
      expect(question.pitch).toBeInstanceOf(Pitch);
      events.push(['question', index, total]);
    });
    engine.on('question-answered', (result) => {
      events.push(['answer', result.streak, result.isLastQuestion]);
    });
    engine.on('session-end', (summary) => {
      tracker.recordSession({
        exerciseId: summary.exerciseId,
        skill: summary.skill,
        score: summary.totalScore,
        xp: summary.totalXP,
        totalQuestions: summary.totalCount,
        correctAnswers: summary.correctCount,
        accuracy: summary.accuracy,
        duration: summary.duration,
      });
      unlocked = tracker.checkAchievements({
        ...summary, totalQuestions: summary.totalCount,
      });
      events.push(['end']);
    });

    engine.startSession({
      id: 'lecture', mode: 'visual-to-name',
      config: { questionsCount: 10, timing: 'timed', timeLimit: 10, skill: 'treble-clef' },
    });
    expect(engine.generator).toBeInstanceOf(QuestionGenerator);
    expect(engine.calculator).toBeInstanceOf(ScoreCalculator);
    for (let index = 1; index <= 10; index++) {
      if (index === 1) {
        expect(engine.requestHint()).toEqual({
          level: 1, text: `La note est dans l'octave ${engine.currentQuestion.pitch.octave}`,
        });
      } else {
        expect(engine.hintsUsed).toBe(0);
      }
      now += 2000;
      const result = engine.submitAnswer(engine.currentQuestion.pitch.pitchClass);
      expect(result).toMatchObject({
        valid: true, correct: true, streak: index, timeSpent: 2000,
        points: 10 + (index - 1) * 5 + 4 - (index === 1 ? 5 : 0),
        xp: index % 5 === 0 ? 15 : 5,
        isLastQuestion: index === 10,
      });
      expect(engine.getProgress()).toMatchObject({ current: index, percentage: index * 10 });
      engine.nextQuestion();
    }
    const summary = engine.endSession();
    expect(summary).toMatchObject({
      exerciseId: 'lecture', skill: 'treble-clef', duration: 20000,
      averageTime: 2000, totalScore: 360, totalXP: 70, totalCount: 10,
      correctCount: 10, accuracy: 100, hintsUsed: 1, bestStreak: 10,
    });
    now += 9000;
    expect(engine.endSession()).toEqual(summary);
    expect(engine.nextQuestion()).toBeNull();
    expect(tracker.getRecentSessions()).toHaveLength(1);
    expect(tracker.getSkill('treble-clef')).toMatchObject({
      xp: 70, level: 2, totalQuestions: 10, correctAnswers: 10, accuracy: 100,
    });
    expect(tracker.getGlobalXP()).toBe(70);
    expect(unlocked.map(({ id }) => id)).toEqual(['first-perfect', 'streak10']);
    expect(tracker.checkAchievements({ ...summary, totalQuestions: 10 })).toEqual([]);
    expect(events).toEqual([
      ['session', 'lecture', 10],
      ...Array.from({ length: 10 }, (_, index) => [
        ['question', index + 1, 10], ['answer', index + 1, index === 9],
      ]).flat(),
      ['end'],
    ]);
  });

  test('la pause refuse les réponses et conserve le temps mural, y compris après expiration', () => {
    engine.startSession({
      id: 'temps', config: { questionsCount: 2, timing: 'timed', timeLimit: 10 },
    });
    const question = engine.currentQuestion;
    now += 2000;
    engine.pause();
    engine.pause();
    expect(engine.submitAnswer(question.pitch.pitchClass)).toEqual({
      valid: false, error: 'Session non active',
    });
    expect(engine.nextQuestion()).toBeNull();
    expect(engine.getProgress().stats.totalCount).toBe(0);
    now += 13000;
    engine.resume();
    engine.resume();
    expect(engine.currentQuestion).toBe(question);
    expect(engine.submitAnswer(question.pitch.pitchClass)).toMatchObject({
      timeSpent: 15000, points: 7, breakdown: { timeBonus: -3 },
    });
    engine.nextQuestion();
    now += 1000;
    expect(engine.submitAnswer(-1)).toMatchObject({ correct: false, points: 0, streak: 0 });
    expect(engine.endSession()).toMatchObject({
      duration: 16000, averageTime: 8000, accuracy: 50, totalScore: 7, totalXP: 5,
    });
    engine.cancel();
    expect(engine.currentQuestion).toBeNull();
    expect(engine.submitAnswer(0).valid).toBe(false);
    engine.startSession({ id: 'suivante', skills: ['bass-clef'] });
    now += 1000;
    expect(engine.endSession()).toMatchObject({
      duration: 1000, skill: 'bass-clef', totalScore: 0, totalCount: 0, averageTime: 0,
    });
  });

  test.each([
    ['visual-to-name', 'note'], ['audio-to-name', 'note'],
    ['interval', 'interval'], ['chord', 'chord'], ['rhythm', 'rhythm'],
  ])('applique les contraintes et valide le mode %s avec le modèle réel', (mode, type) => {
    const question = engine.startSession({
      id: mode, mode,
      config: {
        clef: 'bass', range: { low: 'C3', high: 'G4' }, difficulty: 3,
        accidentals: true, intervalTypes: ['major-3'], chordTypes: ['minor'],
        durations: ['quarter'], beatsPerMeasure: 3, tempo: 90,
      },
    });
    expect(question.type).toBe(type);
    expect(engine.generator).toMatchObject({ clef: 'bass', difficulty: 3, accidentals: true });
    let answer;
    if (type === 'note') {
      expect(question.pitch).toBeInstanceOf(Pitch);
      answer = ` ${question.pitch.toEnglish().slice(0, -1).toUpperCase()} `;
    } else if (type === 'interval') {
      expect(question.interval).toBeInstanceOf(Interval);
      expect(question.interval.toSemitones()).toBe(4);
      expect(engine.requestHint().level).toBe(1);
      expect(engine.requestHint().level).toBe(2);
      expect(engine.requestHint().level).toBe(2);
      answer = question.interval.toFrench();
    } else if (type === 'chord') {
      expect(question.chord).toBeInstanceOf(Chord);
      expect(question.expectedType).toBe('minor');
      expect(engine.requestHint().level).toBe(1);
      expect(engine.requestHint().level).toBe(2);
      expect(engine.requestHint().level).toBe(2);
      answer = ' MINOR ';
    } else {
      expect(question).toMatchObject({ beatsPerMeasure: 3, tempo: 90 });
      expect(engine.requestHint()).toBeNull();
      expect(engine.hintsUsed).toBe(1);
      answer = 'correct';
    }
    expect(engine.submitAnswer(answer)).toMatchObject({
      correct: true, expectedAnswer: expect.any(Object),
    });
  });

  test('conserve les valeurs par défaut falsy de la configuration', () => {
    engine.startSession({
      id: 'défauts', mode: '', config: {
        questionsCount: 0, clef: '', difficulty: 0, accidentals: false, timing: 'free',
      },
    });
    expect(engine.totalQuestions).toBe(20);
    expect(engine.generator).toMatchObject({ clef: 'treble', difficulty: 1, accidentals: false });
    expect(engine.calculator.timeBonus).toBe(false);
    expect(engine.currentQuestion.type).toBe('note');
  });

  test('rend visibles les erreurs de mode et de listeners sans perdre les autres notifications', () => {
    const started = jest.fn();
    const questionStarted = jest.fn();
    const listenerError = new Error('affichage indisponible');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    engine.on('session-start', () => { throw listenerError; });
    engine.on('session-start', started);
    engine.on('question-start', questionStarted);
    expect(() => engine.startSession({ id: 'inconnu', mode: 'inconnu' }))
      .toThrow("Mode d'exercice non supporté: inconnu");
    expect(error).toHaveBeenCalledWith('Erreur dans le listener de "session-start":', listenerError);
    expect(started).toHaveBeenCalledTimes(1);
    expect(questionStarted).not.toHaveBeenCalled();
    engine.startSession({ id: 'valide' });
    expect(questionStarted).toHaveBeenCalledTimes(1);
    expect(engine.currentQuestion.pitch).toBeInstanceOf(Pitch);
  });
});
