import { readFileSync } from 'node:fs';
import { ExerciseEngine } from './ExerciseEngine.js';

const EXERCISES = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'));
const exerciseFor = (id) => EXERCISES.exercises.find((e) => e.id === id);

const INVALID = [-1, null, undefined, {}, [], true];

describe('ExerciseEngine - réponses invalides (skip inclus)', () => {
  test.each([
    ['accord', 'chord-major-minor'],
    ['note', 'note-treble-natural'],
    ['intervalle', 'interval-basic'],
    ['rythme', 'rhythm-basic'],
  ])('une réponse invalide en mode %s est comptée comme une erreur sans exception', (_label, id) => {
    INVALID.forEach((answer) => {
      const engine = new ExerciseEngine();
      engine.startSession(exerciseFor(id));
      let result;
      expect(() => { result = engine.submitAnswer(answer); }).not.toThrow();
      expect(result).toMatchObject({ valid: true, correct: false, points: 0 });
      expect(result.userAnswer).toBe(answer);
    });
  });

  test('une réponse d’accord valide reste acceptée, casse et espaces ignorés', () => {
    const engine = new ExerciseEngine();
    const question = engine.startSession(exerciseFor('chord-major-minor'));
    expect(engine.submitAnswer(`  ${question.expectedType.toUpperCase()} `).correct).toBe(true);
  });
});
