/** @jest-environment jsdom */
/**
 * Parcours de la vraie page (index.html) pilotée par le contrôleur, en jsdom.
 * Horloge, hasard, minuteries et GameKit sont injectés ou simulés.
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { MinesweeperController, readSettings, AI_DELAY_MS } from './controller.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

describe('Démineur : page et contrôleur', () => {
  let controller;
  let kit;
  let clock;
  let portrait;

  /**
   * Monte la page et le contrôleur.
   * @param {{search?: string, stored?: unknown, portraitMatches?: boolean}} [options] - URL, records stockés, écran portrait.
   */
  function mount({ search = '', stored = null, portraitMatches = false } = {}) {
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    window.history.replaceState(null, '', `/games/demineur/index.html${search}`);
    portrait = Object.assign(new EventTarget(), { matches: portraitMatches });
    window.matchMedia = jest.fn(() => portrait);
    window.requestAnimationFrame = jest.fn(() => 1);
    window.cancelAnimationFrame = jest.fn();
    kit = {
      init: jest.fn(), loadProgress: jest.fn(() => stored), saveProgress: jest.fn(() => true),
    };
    clock = 0;
    controller = new MinesweeperController({ document, window, kit, now: () => clock, random: () => 0.25 });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mount();
  });

  afterEach(() => {
    controller.dispose();
    jest.useRealTimers();
  });

  const $ = id => document.getElementById(id);
  const cell = index => document.querySelector(`#board [data-index="${index}"]`);
  const cells = () => [...document.querySelectorAll('#board button')];
  /** Clic puis fin de la génération différée. */
  function clickCell(index) {
    cell(index).click();
    jest.advanceTimersByTime(50);
  }
  function key(target, value) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  }
  const safeCells = () => controller.state.marks.map((_, index) => index).filter(index => !controller.state.mines.includes(index));

  it('affiche une grille Débutant fermée, prête au premier clic', () => {
    expect(kit.init).toHaveBeenCalledWith('demineur');
    expect(cells()).toHaveLength(81);
    expect($('board').getAttribute('aria-label')).toBe('Grille de 9 colonnes et 9 lignes, 10 mines');
    expect(cell(0).getAttribute('aria-label')).toBe('(1, 1) : fermée');
    expect(cell(0).tabIndex).toBe(0);
    expect($('status').textContent).toBe('Premier clic sans risque');
    expect($('mines-left').textContent).toBe('10');
    expect($('seed-info').textContent).toBe('Grille n° 1073741824 · Débutant · sans hasard');
    expect($('best').textContent).toBe('Record : —');
  });

  it('ouvre une zone au premier clic, puis démarre le chronomètre', () => {
    cell(40).click();
    expect($('status').textContent).toBe('Génération d\'une grille sans hasard…');
    expect(controller.state.status).toBe('ready');
    jest.advanceTimersByTime(50);
    expect(controller.state.status).toBe('playing');
    expect(cell(40).classList.contains('open')).toBe(true);
    expect(cell(40).getAttribute('aria-label')).toBe('(5, 5) : vide');
    clock = 65_000;
    jest.advanceTimersByTime(250);
    expect($('timer').textContent).toBe('1:05');
    expect($('status').textContent).toMatch(/^\d+ \/ 71 cases ouvertes$/);
  });

  it('pose des drapeaux au clic droit, à la touche F et en mode drapeau', () => {
    clickCell(40);
    const [a, b, c] = controller.state.marks.flatMap((mark, index) => (mark === 'hidden' ? [index] : []));
    cell(a).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(cell(a).classList.contains('flag')).toBe(true);
    key(cell(b), 'f');
    expect($('mines-left').textContent).toBe('8');
    $('flag-mode').click();
    expect($('flag-mode').getAttribute('aria-pressed')).toBe('true');
    expect($('board').classList.contains('flag-mode')).toBe(true);
    cell(c).click();
    expect(cell(c).getAttribute('aria-label')).toMatch(/drapeau$/);
    cell(c).click();
    expect(cell(c).classList.contains('hidden')).toBe(true);
    $('flag-mode').click();
    cell(a).click();
    expect($('announcer').textContent).toBe('Cette case porte un drapeau : retirez-le pour l\'ouvrir.');
  });

  it('refuse le drapeau avant le premier clic, avec une explication', () => {
    cell(3).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect($('announcer').textContent).toMatch(/^Ouvrez d'abord une case/);
    expect(controller.state.status).toBe('ready');
  });

  it('ouvre les voisines d\'un chiffre (accord) au clic et au clic milieu', () => {
    clickCell(40);
    const view = controller.view();
    const number = view.cells.findIndex((value, index) => value > 0
      && controller.engine.isValidAction(controller.state, { type: 'chord', index }, 'joueur') === false);
    cell(number).dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true }));
    expect($('announcer').textContent).toMatch(/^Accord impossible/);
    // Pose les bons drapeaux autour du chiffre puis accord par clic gauche.
    const around = [...Array(81).keys()].filter(index => controller.state.mines.includes(index)
      && Math.abs(index % 9 - number % 9) <= 1 && Math.abs(Math.floor(index / 9) - Math.floor(number / 9)) <= 1);
    around.forEach(index => key(cell(index), 'F'));
    const before = controller.view().openedCount;
    cell(number).click();
    expect(controller.view().openedCount).toBeGreaterThanOrEqual(before);
    expect(controller.state.status).not.toBe('lost');
  });

  it('donne un indice expliqué, met en évidence la case et ses chiffres sources', () => {
    $('hint').click();
    expect($('reasoning-title').textContent).toBe('Indice : ouvrir (5, 5)');
    expect(controller.assisted).toBe(false);
    clickCell(40);
    key(cell(40), 'h');
    expect(controller.assisted).toBe(true);
    expect($('reasoning-title').textContent).toMatch(/^Indice : (ouvrir|drapeau en) \(\d, \d\)$/);
    expect($('reasoning-text').textContent.length).toBeGreaterThan(30);
    expect(document.querySelectorAll('#board .hint')).toHaveLength(1);
  });

  it('superpose les probabilités et les explique', () => {
    clickCell(40);
    $('risks').click();
    expect($('risks').getAttribute('aria-pressed')).toBe('true');
    expect($('reasoning-title').textContent).toBe('Carte des probabilités');
    const risky = document.querySelectorAll('#board .risk');
    expect(risky.length).toBe(81 - controller.view().openedCount);
    expect(risky[0].getAttribute('aria-label')).toMatch(/risque \d+ %|risque [<>] /);
    $('risks').click();
    expect(document.querySelectorAll('#board .risk')).toHaveLength(0);
  });

  it('laisse l\'IA jouer pas à pas jusqu\'à la victoire, sans record', () => {
    $('watch-ai').click();
    expect($('watch-ai').getAttribute('aria-pressed')).toBe('true');
    expect($('watch-ai').textContent).toContain('Arrêter l\'IA');
    expect($('reasoning-title').textContent).toBe('L\'IA joue : ouvrir (5, 5)');
    for (let step = 0; step < 200 && controller.state.status !== 'won'; step++) { jest.advanceTimersByTime(AI_DELAY_MS); }
    expect(controller.state.status).toBe('won');
    expect($('mines-left').textContent).toBe('0');
    expect($('hint').disabled).toBe(true);
    jest.advanceTimersByTime(1000);
    expect($('end-dialog').classList.contains('open')).toBe(true);
    expect($('end-title').textContent).toBe('Grille déminée !');
    expect($('end-record').textContent).toMatch(/^Partie assistée/);
    expect(kit.saveProgress).not.toHaveBeenCalled();
  });

  it('arrête l\'IA quand le joueur reprend la main', () => {
    $('watch-ai').click();
    jest.advanceTimersByTime(AI_DELAY_MS * 3);
    const hidden = controller.state.marks.findIndex(mark => mark === 'hidden');
    cell(hidden).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(controller.aiRunning).toBe(false);
    const moves = controller.state.moves;
    jest.advanceTimersByTime(AI_DELAY_MS * 3);
    expect(controller.state.moves).toBe(moves);
    $('watch-ai').click();
    $('watch-ai').click();
    expect(controller.aiRunning).toBe(false);
  });

  it('enregistre un record sans aide et l\'affiche', async () => {
    clickCell(40);
    clock = 42_300;
    safeCells().forEach(index => { if (controller.state.marks[index] === 'hidden') { cell(index).click(); } });
    expect(controller.state.status).toBe('won');
    expect(kit.saveProgress).toHaveBeenCalledWith(expect.objectContaining({
      version: 1, best: expect.objectContaining({ beginner: { noGuess: 42_300, classic: null } }),
    }));
    expect($('best').textContent).toBe('Record : 0:42,3');
    jest.advanceTimersByTime(1000);
    expect($('end-text').textContent).toBe('Débutant terminé en 0:42,3.');
    expect($('end-record').textContent).toBe('Premier record pour ce niveau !');
    await Promise.resolve();
    expect(document.activeElement).toBe($('replay'));
    key(document.activeElement, 'Escape');
    expect($('end-dialog').classList.contains('open')).toBe(false);
  });

  it('compare au record existant', () => {
    controller.dispose();
    const best = { beginner: { noGuess: 10_000, classic: null }, intermediate: { noGuess: null, classic: null }, expert: { noGuess: null, classic: null } };
    mount({ stored: { version: 1, best } });
    expect($('best').textContent).toBe('Record : 0:10,0');
    clickCell(40);
    clock = 20_000;
    safeCells().forEach(index => { if (controller.state.marks[index] === 'hidden') { cell(index).click(); } });
    jest.advanceTimersByTime(1000);
    expect($('end-record').textContent).toBe('Record à battre : 0:10,0.');
  });

  it('perd sur une mine, dévoile la grille et permet de rejouer la même grille', () => {
    clickCell(40);
    const mines = [...controller.state.mines];
    cell(mines[0]).click();
    expect(controller.state.status).toBe('lost');
    expect(cell(mines[0]).classList.contains('exploded')).toBe(true);
    expect(cell(mines[1]).classList.contains('mine')).toBe(true);
    expect($('announcer').textContent).toBe('Boum ! Une mine a explosé.');
    jest.advanceTimersByTime(1000);
    expect($('end-title').textContent).toBe('Boum !');
    $('same-grid').click();
    jest.advanceTimersByTime(50);
    expect(controller.state.mines).toEqual(mines);
    expect(controller.state.status).toBe('playing');
    expect(controller.replayed).toBe(true);
    $('close-end').click();
    $('replay').click();
    expect(controller.state.status).toBe('ready');
  });

  it('change de niveau et de mode, et lit les réglages de l\'URL', () => {
    document.querySelector('input[value="intermediate"]').click();
    expect(cells()).toHaveLength(256);
    $('no-guess').click();
    expect(controller.noGuess).toBe(false);
    expect($('mode-badge').textContent).toBe('Classique');
    clickCell(0);
    expect(controller.state.generation).toEqual({ attempts: 1, guaranteed: false });
    $('new-game').click();
    expect(controller.state.status).toBe('ready');
    controller.dispose();
    mount({ search: '?level=expert&seed=99&classique' });
    expect(controller.seed).toBe(99);
    expect(cells()).toHaveLength(480);
    expect(document.querySelector('input[value="expert"]').checked).toBe(true);
  });

  it('pivote la grille Expert sur un écran en portrait et suit les rotations', () => {
    controller.dispose();
    mount({ search: '?level=expert', portraitMatches: true });
    expect($('board').getAttribute('aria-label')).toBe('Grille de 16 colonnes et 30 lignes, 99 mines');
    // La première case affichée est (1, 1) ; la case moteur 1 (x = 1, y = 0) est affichée en (1, 2).
    expect(cell(1).getAttribute('aria-label')).toBe('(1, 2) : fermée');
    portrait.matches = false;
    portrait.dispatchEvent(new Event('change'));
    expect($('board').getAttribute('aria-label')).toBe('Grille de 30 colonnes et 16 lignes, 99 mines');
  });

  it('se met en pause (portail ou onglet masqué) sans compter le temps', () => {
    clickCell(40);
    clock = 5_000;
    window.onGamePause();
    expect($('board-wrap').classList.contains('paused')).toBe(true);
    expect($('status').textContent).toBe('Partie en pause');
    clock = 60_000;
    const before = controller.view().openedCount;
    const hidden = controller.state.marks.findIndex(mark => mark === 'hidden');
    cell(hidden).click();
    expect(controller.view().openedCount).toBe(before);
    window.onGameResume();
    expect($('timer').textContent).toBe('0:05');
  });

  it('prévient si les records stockés sont illisibles, sans les écraser', () => {
    controller.dispose();
    mount({ stored: { version: 99 } });
    expect($('storage-notice').hidden).toBe(false);
    expect($('storage-notice').textContent).toMatch(/illisibles/);
  });

  it('libère ses écouteurs au démontage', () => {
    window.onGameDispose();
    const moves = controller.state.moves;
    cell(40).click();
    jest.advanceTimersByTime(100);
    expect(controller.state.moves).toBe(moves);
    expect(() => controller.dispose()).not.toThrow();
  });

  it('signale un élément manquant de la page', () => {
    controller.dispose();
    document.getElementById('hint').remove();
    expect(() => new MinesweeperController({ document, window, kit })).toThrow('#hint');
    controller = { dispose() {} };
  });
});

describe('readSettings', () => {
  it('valide niveau, seed et mode', () => {
    expect(readSettings('')).toEqual({ level: 'beginner', noGuess: true, seed: null });
    expect(readSettings('?level=expert&seed=4294967296&classique')).toEqual({ level: 'expert', noGuess: false, seed: 0 });
    expect(readSettings('?level=__proto__&seed=-3')).toEqual({ level: 'beginner', noGuess: true, seed: null });
  });
});
