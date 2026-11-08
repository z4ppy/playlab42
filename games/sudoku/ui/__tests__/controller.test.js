/** @jest-environment jsdom */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { SudokuEngine } from '../../engine.js';

/*
 * Contrôleur réel (ui/app.js) branché sur le vrai index.html, le vrai moteur et
 * GameKit. jsdom n'a pas de Worker : la génération passe par le repli synchrone.
 */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const solution = new SudokuEngine().init({ seed: 1234, playerIds: ['joueur'], difficulty: 'easy' }).solution;

const $ = (selector) => document.querySelector(selector);
const cell = (index) => $(`.cell[data-cell="${index}"]`);
const label = (index) => cell(index).getAttribute('aria-label');
const press = (key, options = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const emptyCells = () => [...document.querySelectorAll('.cell')].filter((button) => / vide/.test(button.getAttribute('aria-label')))
  .map((button) => Number(button.dataset.cell));

beforeAll(async () => {
  document.body.innerHTML = body;
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close(value) {
    this.returnValue = value ?? '';
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  history.replaceState(null, '', '#easy-1234');
  await import('../app.js');
  await flush();
});

afterAll(() => {
  window.onGameDispose();
  localStorage.clear();
});

describe('Contrôleur Sudoku', () => {
  it('ouvre la grille du lien partagé', () => {
    expect($('#puzzle-label').textContent).toBe('Grille n° 1234 · Facile');
    expect(document.querySelectorAll('.cell')).toHaveLength(81);
    expect(location.hash).toBe('#easy-1234');
    expect($('#level').value).toBe('easy');
  });

  it('demande une case avant un chiffre, refuse les cases données', () => {
    $('.pad-digit[data-digit="1"]').click();
    expect($('#message').textContent).toBe('Sélectionnez d’abord une case.');
    $('.cell.is-given').click();
    press('5');
    expect($('#message').textContent).toContain('donnée');
  });

  it('pose, efface, annule et refait au clavier et au pavé', () => {
    const [index] = emptyCells();
    cell(index).click();
    press(String(solution[index]));
    expect(label(index)).toMatch(new RegExp(`, ${solution[index]}$`));
    expect($('#announcer').textContent).toContain(`${solution[index]} en ligne`);
    $(`.pad-digit[data-digit="${solution[index]}"]`).click();
    expect(label(index)).toMatch(/vide$/);
    press('z', { ctrlKey: true });
    expect(label(index)).toMatch(new RegExp(`, ${solution[index]}$`));
    $('#redo').click();
    expect(label(index)).toMatch(/vide$/);
    $('#undo').click();
    press('Delete');
    expect(label(index)).toMatch(/vide$/);
    press('Delete');
    expect($('#message').textContent).toBe('Cette case est déjà vide.');
    press('y', { ctrlKey: true });
  });

  it('gère le mode notes et les notes automatiques', () => {
    const [index] = emptyCells();
    cell(index).click();
    press('n');
    expect($('#notes-mode').getAttribute('aria-pressed')).toBe('true');
    press('3');
    expect(label(index)).toMatch(/note 3$/);
    $('.cell.is-given').click();
    press('4');
    expect($('#message').textContent).toContain('donnée');
    cell(index).click();
    $('#notes-mode').click();
    cell(index).click();
    $('#fill-notes').click();
    expect($('#message').textContent).toContain('Notes remplies');
    expect(label(emptyCells()[1])).toMatch(/notes? \d/);
    $('#undo').click();
  });

  it('donne un indice en deux temps puis l’applique', () => {
    $('#hint').click();
    expect($('#coach-text').textContent).toMatch(/^Indice \(/);
    expect($('#hint').textContent).toBe('Voir l’explication');
    expect(document.querySelectorAll('.is-hint-focus').length).toBeGreaterThan(0);
    press('h');
    expect($('#apply-hint').hidden).toBe(false);
    const target = Number($('.is-hint-target').dataset.cell);
    $('#apply-hint').click();
    expect(label(target)).toMatch(/, \d$/);
    expect($('#coach-text').textContent).toMatch(/^Appliqué/);
  });

  it('vérifie les erreurs sans révéler la solution', () => {
    const index = emptyCells()[0];
    cell(index).click();
    const wrong = solution[index] === 9 ? 1 : solution[index] + 1;
    press(String(wrong));
    $('#check').click();
    expect(cell(index).classList.contains('is-error')).toBe(true);
    expect($('#coach-text').textContent).toMatch(/1 erreur signalée|erreurs signalées/);
    press('Backspace');
    $('#check').click();
  });

  it('met en pause, masque la grille et bloque la saisie', () => {
    press('p');
    expect($('#pause-cover').hidden).toBe(false);
    expect($('#board').inert).toBe(true);
    press('5');
    expect($('#message').textContent).toBe('Partie en pause : reprenez pour jouer.');
    // Ni indice, ni vérification, ni coup de l'IA pendant la pause.
    press('h');
    $('#check').click();
    $('#ai-step').click();
    expect($('#coach-text').textContent).not.toMatch(/^Indice/);
    window.onGamePause();
    window.onGameResume();
    expect($('#pause-text').textContent).toContain('Reprendre');
    $('#resume').click();
    expect($('#pause-cover').hidden).toBe(true);
  });

  it('applique les réglages, le thème et le partage', async () => {
    $('#opt-conflicts').checked = false;
    $('#opt-conflicts').dispatchEvent(new Event('change'));
    $('#opt-highlight').checked = false;
    $('#opt-highlight').dispatchEvent(new Event('change'));
    $('#theme').value = 'light';
    $('#theme').dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('light');
    $('#share').click();
    expect($('#share-output').textContent).toContain('#easy-1234');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn(() => Promise.resolve()) }, configurable: true });
    $('#share').click();
    await flush();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('#easy-1234'));
    expect($('#share-output').textContent).toBe('Lien copié.');
    // Une saisie dans un champ ne déclenche aucun raccourci.
    $('#grid-number').dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect($('#notes-mode').getAttribute('aria-pressed')).toBe('false');
  });

  it('laisse l’IA jouer coup par coup jusqu’à la victoire', () => {
    $('#bot').value = 'backtracking';
    $('#ai-step').click();
    expect($('#ai-log').textContent).toMatch(/^Retour sur trace : /);
    $('#bot').value = 'logic';
    for (let turn = 0; turn < 81 && !$('#victory').open; turn++) {
      $('#ai-step').click();
    }
    expect($('#victory').open).toBe(true);
    expect($('#victory-summary').textContent).toContain('avec l’aide de l’IA');
    expect($('#victory-stats').children).toHaveLength(3);
    press('5');
    $('#victory').close('close');
  });

  it('lance et arrête la résolution automatique, relance une grille', async () => {
    $('#new-game').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect($('#puzzle-label').textContent).toMatch(/^Grille n° \d+ · Facile$/);
    jest.useFakeTimers();
    $('#ai-run').click();
    expect($('#ai-run').getAttribute('aria-pressed')).toBe('true');
    press('5');
    expect($('#message').textContent).toContain('L’IA est en train de jouer');
    jest.advanceTimersByTime(0);
    jest.advanceTimersByTime(Number($('#speed').value));
    expect($('.cell.is-ai-move')).not.toBeNull();
    $('#ai-run').click();
    expect($('#ai-run').getAttribute('aria-pressed')).toBe('false');
    jest.useRealTimers();
  });

  it('ouvre une grille par son numéro et restaure la partie sauvegardée', async () => {
    $('#grid-number').value = 'abc';
    $('#open-grid').dispatchEvent(new Event('submit', { cancelable: true }));
    expect($('#message').textContent).toContain('invalide');
    $('#level').value = 'easy';
    $('#grid-number').value = '77';
    $('#open-grid').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect($('#puzzle-label').textContent).toBe('Grille n° 77 · Facile');
    const [index] = emptyCells();
    cell(index).click();
    press(String(1));
    window.onGamePause();
    const saved = JSON.parse(localStorage.getItem('progress_sudoku'));
    expect(saved.current.state.seed).toBe(77);
    expect(saved.current.state.values[index]).toBe(1);
    // En pause, la grille est figée : « Recommencer » attend la reprise.
    $('#restart').click();
    expect(label(index)).toMatch(/, 1$/);
    window.onGameResume();
    $('#resume').click();
    $('#restart').click();
    expect(label(index)).toMatch(/vide$/);
  });

  it('enregistre un record pour une grille résolue sans l’IA', () => {
    const grid77 = new SudokuEngine().init({ seed: 77, playerIds: ['joueur'], difficulty: 'easy' }).solution;
    for (const index of emptyCells()) {
      cell(index).click();
      press(String(grid77[index]));
    }
    expect($('#victory').open).toBe(true);
    expect($('#victory-summary').textContent).toMatch(/^Bravo/);
    expect($('#victory-stats').textContent).toContain('Nouveau record');
    $('#victory').close('new');
  });
});
