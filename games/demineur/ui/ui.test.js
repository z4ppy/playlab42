/** @jest-environment jsdom */
/**
 * Tests des modules d'interface : disposition, rendu, gestes, chronomètre et records.
 */
import { jest } from '@jest/globals';
import { boardLayout, createBoard, describeCell, renderBoard } from './board-view.js';
import { bindCellInput, resolveIntent, LONG_PRESS_MS } from './cell-input.js';
import { Clock, formatTime } from './clock.js';
import { MinesweeperRecords, emptyRecords, isRecordData } from './records.js';

describe('disposition de la grille', () => {
  it('garde l\'ordre de lecture sans pivot', () => {
    const layout = boardLayout(3, 2, false);
    expect([layout.columns, layout.rows]).toEqual([3, 2]);
    expect([0, 1, 2, 3, 4, 5].map(layout.indexAt)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(layout.label(4)).toBe('(2, 2)');
  });

  it('pivote d\'un quart de tour : lignes et colonnes échangées, coordonnées affichées', () => {
    // Moteur 3 × 2 :  0 1 2 / 3 4 5  →  écran 2 × 3 :  0 3 / 1 4 / 2 5
    const layout = boardLayout(3, 2, true);
    expect([layout.columns, layout.rows]).toEqual([2, 3]);
    expect([0, 1, 2, 3, 4, 5].map(layout.indexAt)).toEqual([0, 3, 1, 4, 2, 5]);
    expect(layout.screenOf(5)).toEqual({ column: 1, row: 2 });
    expect(layout.label(5)).toBe('(2, 3)');
  });

  it('décrit chaque contenu de case pour les lecteurs d\'écran', () => {
    expect([0, 1, 3, 'hidden', 'flag', 'mine', 'exploded', 'wrong-flag'].map(describeCell)).toEqual([
      'vide', '1 mine voisine', '3 mines voisines', 'fermée', 'drapeau', 'mine', 'mine explosée', 'drapeau erroné',
    ]);
  });
});

describe('rendu de la grille', () => {
  const layout = boardLayout(3, 1, false);
  const extras = { risks: null, hint: null, sources: [], origin: null };

  it('crée un bouton par case avec un damier et un seul arrêt de tabulation', () => {
    const { element, buttons } = createBoard(document, boardLayout(2, 2, false));
    expect(element.style.getPropertyValue('--columns')).toBe('2');
    expect(buttons.map(button => button.dataset.shade)).toEqual(['0', '1', '1', '0']);
    expect(buttons.map(button => button.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('anime en cascade les cases nouvellement ouvertes, depuis la case jouée', () => {
    const { buttons } = createBoard(document, layout);
    renderBoard(buttons, layout, { cells: ['hidden', 'hidden', 'hidden'] }, extras);
    expect(buttons[0].classList.contains('reveal')).toBe(false);
    renderBoard(buttons, layout, { cells: [0, 1, 'hidden'] }, { ...extras, origin: 0 });
    expect(buttons[1].className).toBe('cell open n1 reveal');
    expect(buttons[1].textContent).toBe('1');
    expect(buttons[0].textContent).toBe('');
    expect(buttons[1].style.getPropertyValue('--delay')).toBe('18ms');
    // Une case inchangée n'est pas repeinte (la classe d'animation reste telle quelle).
    buttons[1].className = 'marqueur';
    renderBoard(buttons, layout, { cells: [0, 1, 'hidden'] }, { ...extras, origin: 2 });
    expect(buttons[1].className).toBe('marqueur');
  });

  it('superpose risque, conseil et chiffres sources', () => {
    const { buttons } = createBoard(document, layout);
    renderBoard(buttons, layout, { cells: [1, 'hidden', 'flag'] }, {
      risks: [null, 0.004, 1], hint: 1, sources: [0], origin: null,
    });
    expect(buttons[1].className).toBe('cell hidden risk hint');
    expect(buttons[1].dataset.risk).toBe('< 1');
    expect(buttons[1].getAttribute('aria-label')).toBe('(2, 1) : fermée, risque < 1 %, conseillée');
    expect(buttons[0].className).toBe('cell open n1 source');
    expect(buttons[2].style.getPropertyValue('--risk')).toBe('1');
  });
});

describe('intentions', () => {
  const playing = { flagMode: false, ready: false };

  it('traduit chaque geste selon la case', () => {
    expect(resolveIntent('primary', 2, playing)).toEqual({ type: 'chord' });
    expect(resolveIntent('chord', 2, playing)).toEqual({ type: 'chord' });
    expect(resolveIntent('flag', 2, playing)).toBeNull();
    expect(resolveIntent('chord', 'hidden', playing)).toBeNull();
    expect(resolveIntent('primary', 'hidden', playing)).toEqual({ type: 'reveal' });
    expect(resolveIntent('primary', 'hidden', { flagMode: true, ready: false })).toEqual({ type: 'toggleFlag' });
    expect(resolveIntent('flag', 'flag', playing)).toEqual({ type: 'toggleFlag' });
    expect(resolveIntent('primary', 'flag', playing).message).toMatch(/drapeau/);
    expect(resolveIntent('flag', 'hidden', { flagMode: false, ready: true }).message).toMatch(/premier clic/);
  });
});

describe('gestes sur les cases', () => {
  let root;
  let intents;
  let controller;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="root"><button data-index="7">x</button><p id="outside">hors grille</p></div>';
    root = document.getElementById('root');
    intents = [];
    controller = new AbortController();
    window.navigator.vibrate = jest.fn();
    bindCellInput(root, { window, signal: controller.signal, onIntent: (intent, index) => intents.push([intent, index]) });
  });

  afterEach(() => {
    controller.abort();
    jest.useRealTimers();
  });

  const button = () => root.querySelector('button');
  /**
   * Événement de pointeur minimal (jsdom n'a pas de PointerEvent complet).
   * @param {EventTarget} target - Cible.
   * @param {string} type - Type d'événement.
   * @param {object} fields - Propriétés (pointerType, clientX, clientY).
   */
  function pointer(target, type, fields = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: fields.clientX ?? 0, clientY: fields.clientY ?? 0 });
    Object.defineProperty(event, 'pointerType', { value: fields.pointerType ?? 'mouse' });
    target.dispatchEvent(event);
    return event;
  }

  it('appui court au doigt : ouverture', () => {
    pointer(button(), 'pointerdown', { pointerType: 'touch' });
    jest.advanceTimersByTime(LONG_PRESS_MS - 50);
    pointer(button(), 'pointerup', { pointerType: 'touch' });
    button().click();
    expect(intents).toEqual([['primary', 7]]);
  });

  it('appui long : drapeau, vibration, et le clic qui suit est ignoré', () => {
    pointer(button(), 'pointerdown', { pointerType: 'touch' });
    jest.advanceTimersByTime(LONG_PRESS_MS);
    button().click();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    button().dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(intents).toEqual([['flag', 7]]);
    expect(window.navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it('un doigt qui glisse fait défiler sans poser de drapeau', () => {
    pointer(button(), 'pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 });
    pointer(button(), 'pointermove', { pointerType: 'touch', clientX: 12, clientY: 12 });
    pointer(button(), 'pointermove', { pointerType: 'touch', clientX: 40, clientY: 10 });
    jest.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(intents).toEqual([]);
  });

  it('souris : clic droit pour le drapeau, clic milieu pour l\'accord', () => {
    pointer(button(), 'pointerdown');
    jest.advanceTimersByTime(LONG_PRESS_MS * 2);
    button().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const down = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });
    button().dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    button().dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true }));
    button().dispatchEvent(new MouseEvent('auxclick', { button: 2, bubbles: true, cancelable: true }));
    expect(intents).toEqual([['flag', 7], ['chord', 7]]);
  });

  it('clavier : F pose un drapeau, sauf avec un modificateur', () => {
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'F', bubbles: true }));
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(intents).toEqual([['flag', 7]]);
  });

  it('ignore ce qui n\'est pas une case', () => {
    const outside = document.getElementById('outside');
    pointer(outside, 'pointerdown', { pointerType: 'touch' });
    jest.advanceTimersByTime(LONG_PRESS_MS * 2);
    outside.click();
    outside.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    outside.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(intents).toEqual([]);
  });
});

describe('chronomètre', () => {
  it('compte le temps hors pauses', () => {
    let now = 1000;
    const clock = new Clock(() => now);
    expect(clock.elapsed()).toBe(0);
    clock.start();
    now = 3000;
    clock.start();
    clock.pause();
    clock.pause();
    now = 9000;
    expect(clock.elapsed()).toBe(2000);
    clock.start();
    now = 9500;
    expect(clock.running).toBe(true);
    expect(clock.elapsed()).toBe(2500);
    clock.reset();
    expect([clock.elapsed(), clock.running]).toEqual([0, false]);
  });

  it('formate en minutes et secondes, avec dixièmes à la demande', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_432)).toBe('1:05');
    expect(formatTime(65_432, { tenths: true })).toBe('1:05,4');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('records', () => {
  const kitWith = (stored, saved = true) => ({ loadProgress: jest.fn(() => stored), saveProgress: jest.fn(() => saved) });

  it('valide le format v1', () => {
    expect(isRecordData(emptyRecords())).toBe(true);
    expect(isRecordData(null)).toBe(false);
    expect(isRecordData({ version: 2, best: {} })).toBe(false);
    const broken = emptyRecords();
    broken.best.expert.classic = -1;
    expect(isRecordData(broken)).toBe(false);
    delete broken.best.expert;
    expect(isRecordData(broken)).toBe(false);
  });

  it('garde le meilleur temps par niveau et par mode, hors parties assistées', () => {
    const kit = kitWith(null);
    const records = new MinesweeperRecords(kit, jest.fn());
    expect(records.submit({ level: 'expert', noGuess: false, time: 90_000, assisted: false })).toEqual({ record: true, previous: null });
    expect(records.submit({ level: 'expert', noGuess: false, time: 95_000, assisted: false })).toEqual({ record: false, previous: 90_000 });
    expect(records.submit({ level: 'expert', noGuess: false, time: 10_000, assisted: true })).toEqual({ record: false, previous: 90_000 });
    expect(records.best('expert', false)).toBe(90_000);
    expect(records.best('expert', true)).toBeNull();
    expect(kit.saveProgress).toHaveBeenCalledTimes(1);
  });

  it('reprend des records valides et prévient d\'un échec d\'écriture', () => {
    const stored = emptyRecords();
    stored.best.beginner.noGuess = 30_000;
    const notify = jest.fn();
    const records = new MinesweeperRecords(kitWith(stored, false), notify);
    expect(records.best('beginner', true)).toBe(30_000);
    records.submit({ level: 'beginner', noGuess: true, time: 20_000, assisted: false });
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/uniquement en mémoire/));
    expect(stored.best.beginner.noGuess).toBe(30_000);
  });

  it('n\'écrase jamais des records illisibles', () => {
    const kit = kitWith({ version: 7 });
    const notify = jest.fn();
    const records = new MinesweeperRecords(kit, notify);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/illisibles/));
    expect(records.submit({ level: 'beginner', noGuess: true, time: 1000, assisted: false }).record).toBe(true);
    expect(kit.saveProgress).not.toHaveBeenCalled();
  });
});
