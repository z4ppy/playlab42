/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { ExerciseView, MenuView, NoteButtons } from './index.js';
import { Pitch } from '../src/core/Pitch.js';

/**
 * Caractérise les vues historiques exportées par ui/index.js. L'application
 * actuelle ne les importe pas : elles restent des contrats publics, donc
 * leurs comportements observables sont figés ici sans les supprimer.
 */
const EXERCISES = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));
const exercise = EXERCISES.exercises[0];

const click = (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));

describe('ui legacy - NoteButtons', () => {
  let container;
  let onSelect;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    onSelect = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  test('affiche sept notes numérotées avec couleurs optionnelles et ligne d’altérations', () => {
    const buttons = new NoteButtons(container, { onSelect, useColors: true, includeAccidentals: true });
    expect(buttons.buttons.map((b) => b.querySelector('.note-name').textContent))
      .toEqual(['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si']);
    expect(buttons.buttons[6].querySelector('.note-key').textContent).toBe('7');
    expect(buttons.buttons[0].style.getPropertyValue('--note-color')).toBe('#e53935');
    expect(container.querySelector('.accidentals')).not.toBeNull();
    expect(container.className).toBe('note-buttons');
  });

  test('un clic notifie l’index et applique l’animation 150 ms', () => {
    const buttons = new NoteButtons(container, { onSelect });
    click(buttons.buttons[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(buttons.buttons[2].classList.contains('clicked')).toBe(true);
    jest.advanceTimersByTime(150);
    expect(buttons.buttons[2].classList.contains('clicked')).toBe(false);
    expect(container.querySelector('.accidentals')).toBeNull();
    expect(buttons.buttons[0].style.getPropertyValue('--note-color')).toBe('');
  });

  test('disable bloque les clics, enable les rétablit et retire les marques', () => {
    const buttons = new NoteButtons(container, { onSelect });
    buttons.highlightCorrect(1);
    buttons.highlightIncorrect(2);
    buttons.disable();
    expect(buttons.buttons.every((b) => b.disabled)).toBe(true);
    buttons.buttons[0].disabled = false;
    click(buttons.buttons[0]);
    expect(onSelect).not.toHaveBeenCalled();
    buttons.enable();
    expect(buttons.buttons.some((b) => b.disabled || b.classList.contains('correct') || b.classList.contains('incorrect'))).toBe(false);
  });

  test('highlight ignore les index hors bornes et reset retire toutes les marques', () => {
    const buttons = new NoteButtons(container);
    buttons.highlightCorrect(-1);
    buttons.highlightIncorrect(7);
    expect(container.querySelector('.correct, .incorrect')).toBeNull();
    buttons.highlightCorrect(0);
    buttons.highlightIncorrect(1);
    buttons.buttons[2].classList.add('clicked');
    buttons.reset();
    expect(container.querySelector('.correct, .incorrect, .clicked')).toBeNull();
  });

  test('dispose vide le conteneur', () => {
    const buttons = new NoteButtons(container);
    buttons.dispose();
    expect(container.innerHTML).toBe('');
    expect(buttons.buttons).toEqual([]);
  });

  test('un clic sans callback est toléré', () => {
    const buttons = new NoteButtons(container);
    expect(() => click(buttons.buttons[0])).not.toThrow();
  });
});

describe('ui legacy - MenuView', () => {
  let container;
  let onExerciseSelect;
  let view;

  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    container.scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    onExerciseSelect = jest.fn();
    view = new MenuView(container, { onExerciseSelect });
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(EXERCISES) });
  });

  afterEach(() => jest.restoreAllMocks());

  test('render charge les données puis affiche une carte par catégorie avec son total', async () => {
    await view.render();
    expect(global.fetch).toHaveBeenCalledWith('./data/exercises.json');
    expect(container.className).toBe('menu-view active');
    const cards = container.querySelectorAll('.category-card');
    expect(cards).toHaveLength(EXERCISES.categories.length);
    const first = EXERCISES.categories[0];
    const count = EXERCISES.exercises.filter((e) => e.category === first.id).length;
    expect(cards[0].querySelector('.exercise-count').textContent).toBe(`${count} exercice${count > 1 ? 's' : ''}`);
    await view.render();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('une erreur de chargement présente un menu vide', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('hors ligne'));
    await view.render();
    expect(view.data).toEqual({ exercises: [], categories: [] });
    expect(container.querySelectorAll('.category-card')).toHaveLength(0);
  });

  test('choisir une catégorie liste ses exercices avec étoiles et meilleur score', async () => {
    view.setProgress({ [EXERCISES.exercises[0].id]: { bestScore: 85, plays: 2 } });
    await view.render();
    const categoryId = EXERCISES.exercises[0].category;
    click(container.querySelector(`[data-category-id="${categoryId}"]`));
    expect(view.selectedCategory).toBe(categoryId);
    const list = document.getElementById('exercises-list');
    expect(list.style.display).toBe('block');
    const cards = list.querySelectorAll('.exercise-card');
    expect(cards).toHaveLength(EXERCISES.exercises.filter((e) => e.category === categoryId).length);
    expect(cards[0].querySelector('.best-score').textContent).toBe('Meilleur: 85%');
    expect(cards[0].querySelector('.difficulty').textContent).toHaveLength(3);
    if (cards[1]) {expect(cards[1].querySelector('.best-score')).toBeNull();}
  });

  test('Commencer notifie l’exercice et Retour referme la liste', async () => {
    await view.render();
    const categoryId = EXERCISES.exercises[0].category;
    click(container.querySelector(`[data-category-id="${categoryId}"]`));
    click(container.querySelector('.start-button'));
    expect(onExerciseSelect).toHaveBeenCalledWith(EXERCISES.exercises[0]);
    click(container.querySelector('.back-button'));
    expect(document.getElementById('exercises-list').style.display).toBe('none');
    expect(view.selectedCategory).toBeNull();
  });

  test('setProgress accepte une valeur vide, hide/show/dispose pilotent le conteneur', async () => {
    view.setProgress(null);
    expect(view.progress).toEqual({});
    await view.render();
    view.hide();
    expect(container.classList.contains('active')).toBe(false);
    view.show();
    expect(container.classList.contains('active')).toBe(true);
    view.dispose();
    expect(container.innerHTML).toBe('');
    expect(view.data).toBeNull();
  });
});

describe('ui legacy - ExerciseView', () => {
  let container;
  let callbacks;
  let view;

  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    callbacks = { onAnswer: jest.fn(), onQuit: jest.fn(), onHint: jest.fn() };
    view = new ExerciseView(container, callbacks);
    view.init(exercise);
  });

  afterEach(() => {
    view.dispose();
    jest.restoreAllMocks();
  });

  test('init construit en-tête, barre, portée, feedback, boutons et actions', () => {
    expect(container.className).toBe('exercise-view active');
    expect(container.querySelector('.exercise-title').textContent).toBe(exercise.title);
    expect(container.querySelector('.progress-text').textContent).toContain(`/${exercise.config.questionsCount}`);
    expect(document.querySelectorAll('#buttons-container .note-button')).toHaveLength(7);
    expect(view.noteRenderer).not.toBeNull();
  });

  test('un clic sur une note transmet une seule réponse jusqu’à la prochaine question', () => {
    click(view.noteButtons.buttons[3]);
    expect(callbacks.onAnswer).toHaveBeenCalledWith(3);
    expect(view.answerPending).toBe(true);
    press('5');
    expect(callbacks.onAnswer).toHaveBeenCalledTimes(1);
    view.showQuestion({ type: 'note', pitch: Pitch.fromString('C4') }, 2, 10);
    expect(view.answerPending).toBe(false);
    press('5');
    expect(callbacks.onAnswer).toHaveBeenLastCalledWith(4);
  });

  test('showQuestion met à jour numéro, progression, feedback et boutons', () => {
    document.getElementById('feedback-container').textContent = 'ancien';
    view.noteButtons.disable();
    view.showQuestion({ type: 'note', pitch: Pitch.fromString('E4') }, 3, 10);
    expect(document.getElementById('current-q').textContent).toBe('3');
    expect(document.getElementById('progress-fill').style.width).toBe('20%');
    expect(document.getElementById('feedback-container').innerHTML).toBe('');
    expect(view.noteButtons.buttons[0].disabled).toBe(false);
    expect(() => view.showQuestion({ type: 'interval' }, 1, 10)).not.toThrow();
  });

  test('passer répond -1 et les raccourcis Échap et H appellent quitter et indice', () => {
    click(document.getElementById('skip-btn'));
    expect(callbacks.onAnswer).toHaveBeenCalledWith(-1);
    press('Escape'); // ignoré tant que la réponse est en attente
    expect(callbacks.onQuit).not.toHaveBeenCalled();
    view.answerPending = false;
    press('Escape');
    press('h');
    press('x');
    expect(callbacks.onQuit).toHaveBeenCalledTimes(1);
    expect(callbacks.onHint).toHaveBeenCalledTimes(1);
    click(container.querySelector('.quit-btn'));
    click(document.getElementById('hint-btn'));
    expect(callbacks.onQuit).toHaveBeenCalledTimes(2);
    expect(callbacks.onHint).toHaveBeenCalledTimes(2);
  });

  test('un feedback correct ajoute les points et affiche la série', () => {
    view.showFeedback({ correct: true, points: 10, streak: 3 });
    expect(document.getElementById('feedback-container').textContent).toContain('+10 pts');
    expect(document.getElementById('feedback-container').textContent).toContain('Série de 3');
    expect(document.getElementById('current-score').textContent).toBe('10');
    view.showFeedback({ correct: true, points: 5, streak: 1 });
    expect(document.getElementById('current-score').textContent).toBe('15');
    expect(document.querySelector('.streak')).toBeNull();
  });

  test('un feedback incorrect donne la réponse attendue et marque le bon bouton', () => {
    view.showFeedback({ correct: false, expectedAnswer: { french: 'Sol', pitchClass: 4 } });
    expect(document.getElementById('feedback-container').textContent).toContain('Sol');
    expect(view.noteButtons.buttons[4].classList.contains('correct')).toBe(true);
    expect(document.getElementById('current-score').textContent).toBe('0');
    view.showFeedback({ correct: false, expectedAnswer: { french: 'Tierce' } });
    expect(document.querySelectorAll('.note-button.correct')).toHaveLength(1);
  });

  test('showHint délègue au renderer et updateProgress met à jour barre et score', () => {
    const hint = jest.spyOn(view.noteRenderer, 'showHint').mockImplementation(() => {});
    view.showHint({ text: 'Indice' });
    expect(hint).toHaveBeenCalledWith('Indice');
    view.updateProgress({ current: 5, total: 10, stats: { totalScore: 42 } });
    expect(document.getElementById('current-q').textContent).toBe('5');
    expect(document.getElementById('progress-fill').style.width).toBe('50%');
    expect(document.getElementById('current-score').textContent).toBe('42');
    view.updateProgress({});
    expect(document.getElementById('current-q').textContent).toBe('5');
  });

  test('hide retire les raccourcis, show les rétablit, dispose vide la vue', () => {
    view.hide();
    expect(container.classList.contains('active')).toBe(false);
    press('Escape');
    expect(callbacks.onQuit).not.toHaveBeenCalled();
    view.show();
    expect(container.classList.contains('active')).toBe(true);
    press('Escape');
    expect(callbacks.onQuit).toHaveBeenCalledTimes(1);
    view.dispose();
    press('Escape');
    expect(callbacks.onQuit).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('');
    expect(() => view.dispose()).not.toThrow();
    view.init(exercise); // la vue est réutilisable ; l'afterEach la libère à nouveau
  });

  test('les callbacks par défaut sont inoffensifs et le mode altérations est transmis', () => {
    const plain = new ExerciseView(document.createElement('div'));
    expect(() => { plain.onAnswer(); plain.onQuit(); plain.onHint(); }).not.toThrow();
    view.dispose();
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    view = new ExerciseView(container, callbacks);
    view.init({ ...exercise, config: { ...exercise.config, accidentals: true, clef: 'bass' } });
    expect(container.querySelector('.accidentals')).not.toBeNull();
  });
});
