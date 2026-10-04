/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { isDevHostname, isUnlockedByProgress } from './app-unlock.js';
import { renderAnswerButtons, answerModeFor } from './app-answer-buttons.js';
import { resultsHtml, hintHtml, correctFeedbackHtml, incorrectFeedbackHtml } from './app-exercise-markup.js';
import { skillBarHtml, progressHtml, settingsHtml } from './app-progress-markup.js';

describe('app-unlock', () => {
  test.each(['localhost', '127.0.0.1', 'pc.local', 'pc.lan'])('%s est un hôte de développement', (h) => {
    expect(isDevHostname(h)).toBe(true);
  });
  test('un domaine public ne l’est pas', () => {
    expect(isDevHostname('example.org')).toBe(false);
  });
  test('règles de progression', () => {
    const base = { level: 1, skills: {} };
    expect(isUnlockedByProgress('note-treble-natural', base)).toBe(true);
    expect(isUnlockedByProgress('inconnu', base)).toBe(false);
    expect(isUnlockedByProgress('interval-basic', base)).toBe(false);
    expect(isUnlockedByProgress('interval-basic', { ...base, level: 2 })).toBe(true);
    expect(isUnlockedByProgress('note-bass-natural', { level: 1, skills: { 'treble-clef': { accuracy: 0.5 } } })).toBe(true);
    expect(isUnlockedByProgress('note-treble-sharps', { level: 1, skills: { 'treble-clef': { accuracy: 0.69 } } })).toBe(false);
    expect(isUnlockedByProgress('interval-all', { level: 1, skills: { intervals: { accuracy: 0.6 } } })).toBe(true);
  });
});

describe('app-answer-buttons', () => {
  test('answerModeFor retombe sur note', () => {
    expect(answerModeFor('chord')).toBe('chord');
    expect(answerModeFor('rhythm')).toBe('rhythm');
    expect(answerModeFor('autre')).toBe('note');
  });
  test('le mode rythme masque le conteneur', () => {
    const c = document.createElement('div');
    renderAnswerButtons(c, 'rhythm', () => {});
    expect(c.style.display).toBe('none');
  });
  test.each(['note', 'interval', 'chord', 'inconnu'])('le mode %s produit des boutons qui répondent', (mode) => {
    const c = document.createElement('div');
    const onAnswer = jest.fn();
    renderAnswerButtons(c, mode, onAnswer);
    const buttons = c.querySelectorAll('.note-btn');
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('gabarits', () => {
  test('médaille selon le taux de réussite', () => {
    const summary = { totalScore: 42, maxStreak: 3 };
    const medals = [100, 80, 60, 10].map((a) => resultsHtml(summary, a));
    expect(new Set(medals.map((h) => h.match(/aria-hidden="true">\s*(\S+)/)[1])).size).toBeGreaterThan(1);
    expect(medals[0]).toContain('42');
  });
  test('feedback et indice', () => {
    expect(hintHtml({ text: 'Indice X' })).toContain('Indice X');
    expect(incorrectFeedbackHtml({ french: 'Do' })).toContain('Do');
    expect(correctFeedbackHtml({ points: 10, streak: 2 })).toEqual(expect.any(String));
  });
  test('progression, paramètres et barre', () => {
    expect(skillBarHtml('Clé de Sol', 0.456)).toContain('46');
    expect(skillBarHtml('Clé de Sol', 0.5)).toContain('skill-clé-de-sol');
    expect(settingsHtml(true)).not.toEqual(settingsHtml(false));
    expect(progressHtml({ level: 1, xp: 0, totalXp: 0, xpToNext: 100, skills: {}, history: [], stats: {} })).toEqual(expect.any(String));
  });
});
