import { Pitch } from '../core/Pitch.js';
import { Interval } from '../core/Interval.js';
import { Chord } from '../core/Chord.js';
import { ExerciseEngine } from './ExerciseEngine.js';

describe('ExerciseEngine : paliers d\'indices par type de question', () => {
  let engine;

  beforeEach(() => {
    engine = new ExerciseEngine();
  });

  test('sans question courante, aucun indice et aucun compteur', () => {
    expect(engine.requestHint()).toBeNull();
    expect(engine.hintsUsed).toBe(0);
  });

  test('une note donne l\'octave, la première lettre puis le nom, et plafonne au niveau 3', () => {
    const pitch = new Pitch(5, 3);
    engine.currentQuestion = { type: 'note', pitch };
    expect(engine.requestHint()).toEqual({ level: 1, text: 'La note est dans l\'octave 3' });
    expect(engine.requestHint()).toEqual({ level: 2, text: `La première lettre est "${pitch.toFrench()[0]}"` });
    expect(engine.requestHint()).toEqual({ level: 3, text: `C'est la note ${pitch.toFrench()}` });
    expect(engine.requestHint()).toEqual({ level: 3, text: `C'est la note ${pitch.toFrench()}` });
    expect(engine.hintsUsed).toBe(4);
  });

  test('un intervalle donne les demi-tons puis le nom, et plafonne au niveau 2', () => {
    const interval = Interval.majorThird();
    engine.currentQuestion = { type: 'interval', interval };
    expect(engine.requestHint()).toEqual({ level: 1, text: 'L\'intervalle fait 4 demi-tons' });
    expect(engine.requestHint()).toEqual({ level: 2, text: `C'est une ${interval.toFrench()}` });
    expect(engine.requestHint()).toEqual({ level: 2, text: `C'est une ${interval.toFrench()}` });
    expect(engine.hintsUsed).toBe(3);
  });

  test('un accord donne la fondamentale sans octave puis le nom, et plafonne au niveau 2', () => {
    const chord = Chord.minor(new Pitch(2, 4));
    engine.currentQuestion = { type: 'chord', chord };
    expect(engine.requestHint()).toEqual({
      level: 1, text: `La fondamentale est ${chord.root.toFrench().slice(0, -1)}`,
    });
    expect(engine.requestHint()).toEqual({ level: 2, text: `C'est un accord ${chord.toFrench()}` });
    expect(engine.requestHint()).toEqual({ level: 2, text: `C'est un accord ${chord.toFrench()}` });
    expect(engine.hintsUsed).toBe(3);
  });

  test('un type sans indice compte la demande mais ne renvoie rien', () => {
    engine.currentQuestion = { type: 'rhythm' };
    expect(engine.requestHint()).toBeNull();
    expect(engine.hintsUsed).toBe(1);
  });
});
