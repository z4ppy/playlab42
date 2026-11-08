/**
 * Grilles et plateaux de test construits à la main.
 */

import { ALL_DIGITS, CELL_COUNT, digitBit, parseGrid } from '../grid.js';

/** Grille classique (Wikipédia) : résolue par singletons seuls. */
export const CLASSIC = `
  53..7....
  6..195...
  .98....6.
  8...6...3
  4..8.3..1
  7...2...6
  .6....28.
  ...419..5
  ....8..79`;

export const CLASSIC_SOLUTION = `
  534678912
  672195348
  198342567
  859761423
  426853791
  713924856
  961537284
  287419635
  345286179`;

/** Grille d'Arto Inkala, solution unique mais hors de portée des techniques implémentées. */
export const INKALA = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';

export const classicGivens = () => parseGrid(CLASSIC);
export const classicSolution = () => parseGrid(CLASSIC_SOLUTION);

/**
 * Plateau « fragment » : toutes les cases vides avec les neuf candidats.
 * Les tests retirent ensuite des candidats pour isoler un motif.
 */
export function openBoard() {
  return { values: new Array(CELL_COUNT).fill(0), candidates: new Array(CELL_COUNT).fill(ALL_DIGITS) };
}

/**
 * Retire `value` des cases `cells` sauf de celles de `keep`.
 * @param {{candidates: number[]}} board
 * @param {number[]} cells
 * @param {number} value
 * @param {number[]} keep
 */
export function removeCandidate(board, cells, value, keep = []) {
  for (const cell of cells) {
    if (!keep.includes(cell)) {
      board.candidates[cell] &= ~digitBit(value);
    }
  }
}

/** Gèle récursivement une valeur pour détecter toute mutation. */
export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
