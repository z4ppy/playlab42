/**
 * Partie simulée « sans deviner » : le solveur joue seul une grille connue.
 *
 * On part du premier clic, puis on ouvre à chaque tour toutes les cases que
 * le solveur prouve sûres à partir de ce qu'il voit (jamais des mines). Si
 * la grille finit entièrement ouverte, elle est résoluble par pure logique.
 */
import { adjacentMineCounts } from '../engine/grid.js';
import { MARK, openCells } from '../engine/board.js';
import { findSafeCells } from './solver.js';

/**
 * @typedef {Object} KnownGrid
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number[]} mines - Indices des mines.
 */

/**
 * Joue une grille connue en n'ouvrant que des cases prouvées sûres.
 * @param {KnownGrid} grid - Grille complète.
 * @param {number} firstIndex - Premier clic (doit être sans mine).
 * @param {{nodeBudget?: number}} [options] - Garde-fou d'énumération du solveur.
 * @returns {{solved: boolean, opened: number}} Résolue sans pari, et cases ouvertes.
 * @throws {Error} Si le solveur ouvrait une mine (ce serait un défaut du solveur).
 */
export function solveFromFirstClick(grid, firstIndex, options = {}) {
  const { width, height, mines } = grid;
  const counts = adjacentMineCounts(width, height, mines);
  const board = { width, height, mineSet: new Set(mines), counts };
  const safeTotal = width * height - mines.length;
  let marks = new Array(width * height).fill(MARK.HIDDEN);
  let opened = 0;
  let next = [firstIndex];
  while (next.length > 0) {
    const result = openCells(board, marks, next);
    if (result.exploded.length > 0) { throw new Error('Solveur incohérent : une case « sûre » cachait une mine.'); }
    marks = result.marks;
    opened += result.opened.length;
    if (opened === safeTotal) { return { solved: true, opened }; }
    const view = { width, height, mineCount: mines.length, cells: marks.map((mark, index) => (mark === MARK.OPEN ? counts[index] : 'hidden')) };
    next = findSafeCells(view, options);
  }
  return { solved: false, opened };
}
