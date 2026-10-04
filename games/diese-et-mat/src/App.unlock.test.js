/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://playlab.example.org/diese-et-mat/"}
 */
import { jest } from '@jest/globals';
import GameKit from '../../../lib/gamekit.js';
import { App } from './App.js';

/** Déblocage des exercices hors développement local, avec la vraie progression. */
describe('App - déblocage des exercices en production', () => {
  let app;

  const withProgress = (level, skills = {}) => {
    const defaults = app.dataManager.getDefaultProgress();
    app.dataManager._progress = { ...defaults, level, skills: { ...defaults.skills, ...skills } };
  };

  beforeEach(() => {
    jest.spyOn(GameKit, 'loadProgress').mockReturnValue(null);
    jest.spyOn(GameKit, 'saveProgress').mockReturnValue(true);
    app = new App();
  });

  afterEach(() => jest.restoreAllMocks());

  test('l’hôte public n’est pas un mode développement', () => {
    expect(app.isDevMode()).toBe(false);
  });

  test('seul le premier exercice est débloqué sans progression', () => {
    expect(app.isExerciseUnlocked('note-treble-natural')).toBe(true);
    ['note-treble-sharps', 'note-bass-natural', 'interval-basic', 'interval-all', 'rhythm-basic', 'inconnu']
      .forEach((id) => expect(app.isExerciseUnlocked(id)).toBe(false));
  });

  test.each([
    ['note-treble-sharps', 'treble-clef', 0.7, 0.69],
    ['note-bass-natural', 'treble-clef', 0.5, 0.49],
    ['interval-all', 'intervals', 0.6, 0.59],
  ])('%s se débloque à partir du seuil de %s', (exerciseId, skill, threshold, below) => {
    withProgress(1, { [skill]: { accuracy: below, attempts: 1 } });
    expect(app.isExerciseUnlocked(exerciseId)).toBe(false);
    withProgress(1, { [skill]: { accuracy: threshold, attempts: 1 } });
    expect(app.isExerciseUnlocked(exerciseId)).toBe(true);
  });

  test('interval-basic se débloque au niveau 2', () => {
    withProgress(1);
    expect(app.isExerciseUnlocked('interval-basic')).toBe(false);
    withProgress(2);
    expect(app.isExerciseUnlocked('interval-basic')).toBe(true);
  });

  test('une compétence absente compte pour une précision nulle', () => {
    withProgress(1);
    delete app.dataManager._progress.skills['treble-clef'];
    expect(app.isExerciseUnlocked('note-treble-sharps')).toBe(false);
  });
});
