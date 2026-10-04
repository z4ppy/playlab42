/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from 'node:v8';
import { App } from './App.js';
import GameKit from '../../../lib/gamekit.js';

/** Régressions des défauts corrigés lors de la simplification de App. */
const EXERCISES = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));
// jsdom ne fournit pas encore structuredClone, contrairement aux navigateurs cibles.
globalThis.structuredClone = value => deserialize(serialize(value));
const IDS = ['menu-view', 'exercise-view', 'progress-view', 'settings-view'];

describe('App - régressions', () => {
  let app;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = ['<div id="loading"></div><div id="audio-banner"></div>',
      ...IDS.map((id) => `<div id="${id}"></div>`)].join('');
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(EXERCISES) }));
    jest.spyOn(GameKit, 'saveProgress').mockReturnValue(true);
    jest.spyOn(GameKit, 'loadProgress').mockReturnValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    app = new App();
    app.init();
    app.synthManager.ensureAudioReady = jest.fn().mockResolvedValue(undefined);
    app.synthManager.playNote = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(app.synthManager, 'audioEngine', 'get')
      .mockReturnValue({ playPianoNote: jest.fn(), playPianoChord: jest.fn() });
  });

  afterEach(() => {
    jest.useRealTimers();
    app.dispose();
    jest.restoreAllMocks();
  });

  const answerWrong = () => {
    jest.useFakeTimers();
    const next = jest.spyOn(app.engine, 'nextQuestion');
    app.submitAnswer('Z');
    return next;
  };

  test('quitter avant l’enchaînement automatique n’appelle pas le moteur détruit', async () => {
    await app.startExercise('note-treble-natural');
    const next = answerWrong();
    app.endExercise();
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(app.engine).toBeNull();
  });

  test('dispose avant l’enchaînement automatique ne lève pas d’erreur', async () => {
    await app.startExercise('note-treble-natural');
    answerWrong();
    app.dispose();
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
  });

  test('l’enchaînement automatique continue normalement sans interruption', async () => {
    await app.startExercise('note-treble-natural');
    const next = answerWrong();
    jest.advanceTimersByTime(1500);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('dispose retire les écouteurs du premier geste utilisateur', () => {
    const init = jest.spyOn(app, 'initAudio').mockResolvedValue();
    app.dispose();
    document.dispatchEvent(new MouseEvent('click'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(init).not.toHaveBeenCalled();
  });

  test('un échec de rendu libère le verrou de démarrage', async () => {
    jest.spyOn(app, 'renderExerciseUI').mockImplementation(() => { throw new Error('rendu'); });
    await expect(app.startExercise('note-treble-natural')).rejects.toThrow('rendu');
    expect(app._startingExercise).toBe(false);
  });

  test('la seconde note d’un intervalle est annulée par endExercise', async () => {
    jest.useFakeTimers();
    const interval = EXERCISES.exercises.find((e) => e.mode === 'interval');
    app.exercisesData = EXERCISES;
    await app.startExercise(interval.id);
    app.synthManager.playNote.mockClear();
    app.playCurrentQuestionSound();
    app.endExercise();
    await jest.advanceTimersByTimeAsync(2000);
    expect(app.synthManager.playNote.mock.calls.length).toBeLessThanOrEqual(1);
  });

  test('passer une question d’accord est comptée comme une erreur', async () => {
    await app.startExercise('chord-major-minor');
    expect(() => app.submitAnswer(-1)).not.toThrow();
    expect(app.engine.getProgress().stats.totalCount).toBe(1);
    expect(app.engine.getProgress().stats.correctCount).toBe(0);
  });
});
