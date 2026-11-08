/**
 * Singletons : les deux seules techniques qui posent directement un chiffre.
 *
 * - Singleton caché : dans une unité, un chiffre n'a plus qu'une case possible.
 *   Exemple : dans la boîte 4, toutes les cases sauf L5C2 sont remplies ou
 *   voient déjà un 6 → le 6 de la boîte 4 est forcément en L5C2.
 * - Singleton nu : une case n'a plus qu'un candidat.
 *   Exemple : L5C2 voit déjà 1, 2, 3, 4, 5, 7, 8 et 9 dans sa ligne, sa colonne
 *   et sa boîte → elle ne peut contenir que 6.
 */

import { BOXES, CELL_COUNT, COLUMNS, ROWS, countDigits, singleDigit } from '../grid.js';
import { makeStep, unitRef } from './shared.js';

/** Les boîtes d'abord : c'est là que l'œil humain repère le plus vite un singleton caché. */
const HIDDEN_SINGLE_SEARCH_ORDER = [...BOXES, ...ROWS, ...COLUMNS];

/**
 * Chiffres candidats dans une seule case de l'unité.
 * `once` accumule les chiffres vus au moins une fois, `twice` ceux vus au moins deux fois :
 * `once & ~twice` donne, en un passage, les chiffres à une seule place.
 */
function uniqueDigits(board, unit) {
  let once = 0;
  let twice = 0;
  for (const cell of unit.cells) {
    const mask = board.candidates[cell];
    twice |= once & mask;
    once |= mask;
  }
  return once & ~twice;
}

/**
 * @param {import('./shared.js').Board} board
 * @returns {import('./shared.js').Step | null}
 */
export function findHiddenSingle(board) {
  for (const unit of HIDDEN_SINGLE_SEARCH_ORDER) {
    const unique = uniqueDigits(board, unit);
    if (unique) {
      // Bit de poids faible : le plus petit chiffre concerné, pour un ordre stable.
      const bit = unique & -unique;
      const value = singleDigit(bit);
      const cell = unit.cells.find((candidate) => board.candidates[candidate] & bit);
      return makeStep('hiddenSingle', {
        placements: [{ cell, value }], units: [unitRef(unit)], cells: [cell], digits: [value],
      });
    }
  }
  return null;
}

/**
 * @param {import('./shared.js').Board} board
 * @returns {import('./shared.js').Step | null}
 */
export function findNakedSingle(board) {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const mask = board.candidates[cell];
    if (board.values[cell] === 0 && countDigits(mask) === 1) {
      const value = singleDigit(mask);
      return makeStep('nakedSingle', { placements: [{ cell, value }], cells: [cell], digits: [value] });
    }
  }
  return null;
}
