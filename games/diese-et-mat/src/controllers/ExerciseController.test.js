import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { ExerciseController } from './ExerciseController.js';

/**
 * Caractérise le vrai ExerciseController avec le vrai ExerciseEngine.
 * Seuls le chargeur de données et le moteur audio sont des doublons.
 */
const EXERCISES = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'));

const correctAnswerFor = (question) => {
  if (question.type === 'note') {return question.pitch.pitchClass;}
  if (question.type === 'interval') {return question.interval.toSemitones();}
  return question.expectedType;
};

describe('ExerciseController', () => {
  let controller;
  let loadExerciseData;
  let audioEngine;
  let events;
  let errorSpy;

  const record = (name) => controller.on(name, (payload) => events.push([name, payload]));
  const names = () => events.map(([name]) => name);

  beforeEach(() => {
    events = [];
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadExerciseData = jest.fn().mockResolvedValue(EXERCISES);
    audioEngine = {
      playNote: jest.fn().mockResolvedValue(undefined),
      playChord: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ExerciseController({ audioEngine, loadExerciseData });
    ['exercise-started', 'question-changed', 'answer-submitted', 'hint-requested', 'exercise-ended', 'error'].forEach(record);
  });

  afterEach(() => {
    jest.useRealTimers();
    controller.dispose();
    jest.restoreAllMocks();
  });

  describe('démarrage', () => {
    test('état initial sans exercice', () => {
      const bare = new ExerciseController();
      expect(bare.audioEngine).toBeNull();
      expect(bare.loadExerciseData).toBeNull();
      expect(bare.isRunning).toBe(false);
      expect(bare.getProgress()).toEqual({ current: 0, total: 0, percentage: 0, stats: null });
      expect(bare.getScore()).toBe(0);
      expect(bare.getStats()).toBeNull();
    });

    test('start charge les données une fois puis émet exercise-started avant question-changed', async () => {
      const exercise = await controller.start('note-treble-natural');
      expect(exercise.id).toBe('note-treble-natural');
      expect(controller.isRunning).toBe(true);
      expect(names()).toEqual(['exercise-started', 'question-changed']);
      expect(events[0][1]).toEqual({ exercise, totalQuestions: 20 });
      expect(events[1][1]).toEqual(expect.objectContaining({ index: 1, total: 20, percentage: 5 }));
      await controller.start('interval-basic');
      expect(loadExerciseData).toHaveBeenCalledTimes(1);
      expect(controller.currentExercise.id).toBe('interval-basic');
    });

    test('totalQuestions vaut 20 par défaut quand la configuration est absente', async () => {
      loadExerciseData.mockResolvedValue({ exercises: [{ id: 'sans-config', mode: 'visual-to-name' }] });
      await controller.start('sans-config');
      expect(events[0][1].totalQuestions).toBe(20);
    });

    test('un échec de chargement émet error et retourne null', async () => {
      const failure = new Error('réseau');
      loadExerciseData.mockRejectedValue(failure);
      await expect(controller.start('note-treble-natural')).resolves.toBeNull();
      expect(events).toEqual([['error', { message: 'Impossible de charger les exercices', error: failure }]]);
      expect(controller.isRunning).toBe(false);
    });

    test('un exercice inconnu émet error', async () => {
      await expect(controller.start('absent')).resolves.toBeNull();
      expect(events).toEqual([['error', { message: 'Exercice non trouvé: absent' }]]);
      expect(errorSpy).toHaveBeenCalled();
    });

    test('sans chargeur ni données, aucun exercice n’est trouvé', async () => {
      const bare = new ExerciseController();
      const errors = [];
      bare.on('error', (payload) => errors.push(payload));
      await expect(bare.start('x')).resolves.toBeNull();
      expect(errors[0].message).toBe('Exercice non trouvé: x');
    });
  });

  describe('réponses et progression', () => {
    beforeEach(async () => {
      await controller.start('note-treble-natural');
      events.length = 0;
    });

    test('submitAnswer retourne le résultat et émet answer-submitted', () => {
      const answer = correctAnswerFor(controller.currentQuestion);
      const result = controller.submitAnswer(answer);
      expect(result.correct).toBe(true);
      expect(events).toEqual([['answer-submitted', expect.objectContaining({ answer, correct: true, valid: true })]]);
      expect(controller.getScore()).toBeGreaterThan(0);
      expect(controller.getStats().correctCount).toBe(1);
    });

    test('skip soumet -1 comme une erreur', () => {
      const result = controller.skip();
      expect(result.correct).toBe(false);
      expect(events[0][1].answer).toBe(-1);
    });

    test.each(['chord-major-minor', 'interval-basic'])('skip en mode %s est une erreur sans exception', async (id) => {
      await controller.start(id);
      events.length = 0;
      let result;
      expect(() => { result = controller.skip(); }).not.toThrow();
      expect(result).toMatchObject({ valid: true, correct: false, points: 0 });
      expect(events[0][1].answer).toBe(-1);
    });

    test('nextQuestion fait avancer l’index et émet question-changed', () => {
      controller.submitAnswer(0);
      events.length = 0;
      const question = controller.nextQuestion();
      expect(controller.currentQuestion).toBe(question);
      expect(events[0][1]).toEqual(expect.objectContaining({ index: 2, total: 20, question }));
      expect(controller.getProgress().current).toBe(2);
    });

    test('la fin de la dernière question termine l’exercice une seule fois', () => {
      controller.engine.totalQuestions = 1;
      controller.submitAnswer(0);
      events.length = 0;
      expect(controller.nextQuestion()).toBeNull();
      expect(names()).toEqual(['exercise-ended']);
      expect(events[0][1].exercise.id).toBe('note-treble-natural');
      expect(controller.isRunning).toBe(false);
      expect(controller.nextQuestion()).toBeNull();
      expect(names()).toEqual(['exercise-ended']);
    });

    test('end retourne le résumé puis devient sans effet', () => {
      const summary = controller.end();
      expect(summary.exerciseId).toBe('note-treble-natural');
      expect(names()).toEqual(['exercise-ended']);
      expect(controller.end()).toBeNull();
      expect(names()).toEqual(['exercise-ended']);
    });

    test('requestHint retourne l’indice et émet hint-requested', () => {
      const hint = controller.requestHint();
      expect(hint).toEqual(expect.objectContaining({ text: expect.any(String) }));
      expect(events).toEqual([['hint-requested', { hint, hintsUsed: 1 }]]);
    });
  });

  describe('sans exercice en cours', () => {
    test('les commandes sont refusées sans exception ni événement', () => {
      expect(controller.submitAnswer(1)).toEqual({ valid: false, error: 'Aucun exercice en cours' });
      expect(controller.skip().valid).toBe(false);
      expect(controller.nextQuestion()).toBeNull();
      expect(controller.requestHint()).toBeNull();
      expect(controller.end()).toBeNull();
      expect(events).toEqual([]);
    });

    test('après la fin, les réponses sont refusées', async () => {
      await controller.start('note-treble-natural');
      controller.end();
      expect(controller.submitAnswer(1).valid).toBe(false);
      expect(controller.requestHint()).toBeNull();
    });

    test('end sans résumé du moteur émet un résumé vide', async () => {
      await controller.start('note-treble-natural');
      controller.engine = null;
      expect(controller.end()).toEqual({});
    });
  });

  describe('audio', () => {
    const tone = (name) => ({ toTone: () => name });

    test('est silencieux sans moteur audio ni question', async () => {
      await controller.playQuestionSound();
      expect(audioEngine.playNote).not.toHaveBeenCalled();
      const mute = new ExerciseController();
      mute.currentQuestion = { type: 'note', pitch: tone('C4') };
      await expect(mute.playQuestionSound()).resolves.toBeUndefined();
    });

    test('joue une note de 0,5 s', async () => {
      controller.currentQuestion = { type: 'note', pitch: tone('C4') };
      await controller.playQuestionSound();
      expect(audioEngine.playNote).toHaveBeenCalledWith('C4', 0.5);
    });

    test('joue deux notes séparées par 500 ms', async () => {
      jest.useFakeTimers();
      controller.currentQuestion = { type: 'interval', pitch1: tone('C4'), pitch2: tone('E4') };
      const playing = controller.playQuestionSound();
      await Promise.resolve();
      await Promise.resolve();
      expect(audioEngine.playNote).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(499);
      await Promise.resolve();
      expect(audioEngine.playNote).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      await playing;
      expect(audioEngine.playNote.mock.calls).toEqual([['C4', 0.4], ['E4', 0.4]]);
    });

    test('joue un accord de 0,6 s', async () => {
      controller.currentQuestion = { type: 'chord', chord: { getPitches: () => [tone('C4'), tone('E4')] } };
      await controller.playQuestionSound();
      expect(audioEngine.playChord).toHaveBeenCalledWith(['C4', 'E4'], 0.6);
    });

    test.each([
      [{ type: 'note' }],
      [{ type: 'interval', pitch1: { toTone: () => 'C4' } }],
      [{ type: 'chord' }],
      [{ type: 'rhythm' }],
    ])('ignore la question incomplète ou non audio %j', async (question) => {
      controller.currentQuestion = question;
      await controller.playQuestionSound();
      expect(audioEngine.playNote).not.toHaveBeenCalled();
      expect(audioEngine.playChord).not.toHaveBeenCalled();
    });

    test('journalise une erreur audio sans la propager', async () => {
      audioEngine.playNote.mockRejectedValue(new Error('audio'));
      controller.currentQuestion = { type: 'note', pitch: tone('C4') };
      await expect(controller.playQuestionSound()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('Erreur lecture audio:', expect.any(Error));
    });
  });

  describe('dispose', () => {
    test('termine l’exercice en cours, vide l’état et retire les abonnés', async () => {
      await controller.start('note-treble-natural');
      events.length = 0;
      controller.dispose();
      expect(names()).toEqual(['exercise-ended']);
      expect(controller.engine).toBeNull();
      expect(controller.currentExercise).toBeNull();
      expect(controller.currentQuestion).toBeNull();
      await controller.start('note-treble-natural');
      expect(names()).toEqual(['exercise-ended']);
      expect(loadExerciseData).toHaveBeenCalledTimes(2);
    });

    test('est sans événement quand aucun exercice ne tourne', () => {
      controller.dispose();
      expect(events).toEqual([]);
    });
  });
});
