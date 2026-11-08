/**
 * Sous-ensembles nus et cachés (paires, triplets) dans une même unité.
 *
 * - Sous-ensemble nu : N cases d'une unité n'ont, à elles toutes, que N candidats.
 *   Exemple (paire nue) : dans la ligne 3, L3C1 = {2, 7} et L3C4 = {2, 7}.
 *   Le 2 et le 7 iront dans ces deux cases (dans un ordre inconnu) ; aucune autre
 *   case de la ligne 3 ne peut les recevoir → on les retire ailleurs dans la ligne.
 * - Sous-ensemble caché : N chiffres d'une unité ne sont possibles que dans N cases.
 *   Exemple (paire cachée) : dans la colonne 2, le 4 et le 8 ne sont possibles
 *   qu'en L1C2 et L6C2. Ces deux cases leur sont réservées → on retire leurs
 *   autres candidats.
 * Les deux formes sont duales : un sous-ensemble nu de taille N dans une unité de
 * K cases vides correspond toujours à un sous-ensemble caché de taille K - N.
 */

import { DIGITS, UNITS, combinations, countDigits, digitsOf, maskOf } from '../grid.js';
import { eliminationsIn, makeStep, openCells, positionsOf, unitRef } from './shared.js';

const NAKED_IDS = { 2: 'nakedPair', 3: 'nakedTriple' };
const HIDDEN_IDS = { 2: 'hiddenPair', 3: 'hiddenTriple' };

const unionOfCandidates = (board, cells) => cells.reduce((mask, cell) => mask | board.candidates[cell], 0);

/**
 * @param {import('./shared.js').Board} board
 * @param {2 | 3} size Taille du sous-ensemble.
 * @returns {import('./shared.js').Step | null}
 */
export function findNakedSubset(board, size) {
  for (const unit of UNITS) {
    const open = openCells(board, unit);
    const pool = open.filter((cell) => countDigits(board.candidates[cell]) <= size);
    for (const cells of combinations(pool, size)) {
      const mask = unionOfCandidates(board, cells);
      if (countDigits(mask) !== size) {
        continue;
      }
      const others = open.filter((cell) => !cells.includes(cell));
      const eliminations = eliminationsIn(board, others, mask);
      if (eliminations.length > 0) {
        return makeStep(NAKED_IDS[size], { eliminations, units: [unitRef(unit)], cells, digits: digitsOf(mask) });
      }
    }
  }
  return null;
}

/**
 * @param {import('./shared.js').Board} board
 * @param {2 | 3} size Taille du sous-ensemble.
 * @returns {import('./shared.js').Step | null}
 */
export function findHiddenSubset(board, size) {
  for (const unit of UNITS) {
    const positions = new Map(DIGITS.map((value) => [value, positionsOf(board, unit.cells, value)]));
    // Un chiffre à une seule place relève du singleton caché ; à zéro place, il est déjà posé.
    const pool = DIGITS.filter((value) => positions.get(value).length >= 2 && positions.get(value).length <= size);
    for (const digits of combinations(pool, size)) {
      const cells = [...new Set(digits.flatMap((value) => positions.get(value)))].sort((a, b) => a - b);
      if (cells.length !== size) {
        continue;
      }
      const eliminations = eliminationsIn(board, cells, ~maskOf(digits));
      if (eliminations.length > 0) {
        return makeStep(HIDDEN_IDS[size], { eliminations, units: [unitRef(unit)], cells, digits });
      }
    }
  }
  return null;
}

