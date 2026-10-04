/** @jest-environment jsdom */
import { describeStone, isLastMove, renderCell, endStatus, statusText, scoreTexts } from './board-render.js';

function makeCell(x, y) {
  const cell = document.createElement('button');
  cell.className = 'cell';
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  return cell;
}

function makeState(overrides = {}) {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[1][2] = 1;
  board[3][4] = 2;
  return { board, lastMove: null, ...overrides };
}

describe('board-render', () => {
  it('décrit les trois contenus d’intersection', () => {
    expect([0, 1, 2].map(describeStone)).toEqual(['vide', 'pierre noire', 'pierre blanche']);
  });

  it('reconnaît uniquement une pose comme dernier coup', () => {
    expect(isLastMove(null, 0, 0)).toBe(false);
    expect(isLastMove({ type: 'pass' }, 0, 0)).toBe(false);
    expect(isLastMove({ type: 'place', x: 1, y: 0 }, 0, 0)).toBe(false);
    expect(isLastMove({ type: 'place', x: 0, y: 1 }, 0, 0)).toBe(false);
    expect(isLastMove({ type: 'place', x: 0, y: 0 }, 0, 0)).toBe(true);
  });

  it('rend une intersection vide désactivée sans humain', () => {
    const cell = makeCell(0, 0);
    cell.innerHTML = '<div class="stone"></div>';
    renderCell(cell, makeState(), false, document);
    expect(cell.getAttribute('aria-label')).toBe('Ligne 1, colonne 1, vide');
    expect(cell.getAttribute('aria-disabled')).toBe('true');
    expect(cell.children).toHaveLength(0);
  });

  it('rend une intersection vide jouable pour un humain', () => {
    const cell = makeCell(0, 0);
    renderCell(cell, makeState(), true, document);
    expect(cell.getAttribute('aria-disabled')).toBe('false');
  });

  it('rend les pierres noire et blanche, toujours désactivées', () => {
    const black = makeCell(2, 1);
    const white = makeCell(4, 3);
    renderCell(black, makeState(), true, document);
    renderCell(white, makeState(), true, document);
    expect(black.querySelector('.stone.black')).not.toBeNull();
    expect(white.querySelector('.stone.white')).not.toBeNull();
    expect(black.getAttribute('aria-label')).toBe('Ligne 2, colonne 3, pierre noire');
    expect(white.getAttribute('aria-disabled')).toBe('true');
  });

  it('marque le dernier coup et efface l’ancien marquage', () => {
    const cell = makeCell(2, 1);
    cell.classList.add('last-move');
    renderCell(cell, makeState(), true, document);
    expect(cell.classList.contains('last-move')).toBe(false);
    renderCell(cell, makeState({ lastMove: { type: 'place', x: 2, y: 1 } }), true, document);
    expect(cell.classList.contains('last-move')).toBe(true);
    expect(cell.getAttribute('aria-label')).toBe('Ligne 2, colonne 3, pierre noire, dernier coup');
  });

  it('formule le résultat de fin de partie', () => {
    expect(endStatus({ winners: null }, 'a', 'b')).toBe('Partie terminée : égalité');
    expect(endStatus({ winners: ['a'] }, 'a', 'b')).toBe('Victoire Noir');
    expect(endStatus({ winners: ['b'] }, 'a', 'b')).toBe('Victoire Blanc');
    expect(endStatus({ winners: [] }, 'a', 'b')).toBe('Partie terminée');
  });

  it('formule le statut selon bot, humain et joueur courant', () => {
    const base = { humanId: 'a', opponentId: 'b' };
    expect(statusText({ gameOver: true, winners: ['a'] }, { ...base, bot: {}, currentHuman: 'a' })).toBe('Victoire Noir');
    expect(statusText({ gameOver: false }, { ...base, bot: {}, currentHuman: 'a' })).toBe('À vous (Noir)');
    expect(statusText({ gameOver: false }, { ...base, bot: {}, currentHuman: null })).toBe('Le bot joue (Blanc)');
    expect(statusText({ gameOver: false, currentPlayerId: 'a' }, { ...base, bot: null, currentHuman: 'a' })).toBe('Au tour du joueur Noir');
    expect(statusText({ gameOver: false, currentPlayerId: 'b' }, { ...base, bot: null, currentHuman: 'b' })).toBe('Au tour du joueur Blanc');
  });

  it('affiche les scores avec une décimale, ou des tirets avant la fin', () => {
    expect(scoreTexts({})).toEqual({ black: '-', white: '-' });
    expect(scoreTexts({ scores: { black: 44, white: 37.5 } })).toEqual({ black: '44.0', white: '37.5' });
  });
});
