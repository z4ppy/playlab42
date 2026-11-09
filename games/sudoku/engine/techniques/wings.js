/**
 * XY-Wing : un raisonnement « si... alors » sur trois cases à deux candidats.
 *
 * Exemple : le pivot L4C4 vaut 2 ou 7. Il voit une pince L4C9 = {2, 5} et une
 * autre pince L6C5 = {7, 5}.
 * - Si le pivot vaut 2, la pince L4C9 (qui le voit) ne peut plus être 2 : elle vaut 5.
 * - Si le pivot vaut 7, la pince L6C5 vaut 5.
 * Dans tous les cas, l'une des deux pinces contient 5 : une case qui voit les
 * deux pinces ne peut donc pas contenir 5.
 */

import { CELL_COUNT, PEERS, combinations, countDigits, seesEachOther, singleDigit } from '../grid.js';
import { eliminationsIn, makeStep } from './shared.js';

const isBivalue = (board, cell) => board.values[cell] === 0 && countDigits(board.candidates[cell]) === 2;

/** Pinces possibles : pairs bivalents qui partagent exactement un candidat avec le pivot. */
function pincersOf(board, pivot) {
  const pivotMask = board.candidates[pivot];
  return PEERS[pivot].filter((cell) => isBivalue(board, cell)
    && countDigits(board.candidates[cell] & pivotMask) === 1);
}

/**
 * Chiffre éliminable (masque) par un pivot et deux pinces, ou 0 si le motif est incomplet :
 * les pinces doivent partager le même troisième chiffre z, sur deux candidats distincts du pivot.
 */
function wingDigit(board, pivot, first, second) {
  const pivotMask = board.candidates[pivot];
  const z = board.candidates[first] & ~pivotMask;
  const sameZ = z === (board.candidates[second] & ~pivotMask);
  const coversPivot = ((board.candidates[first] | board.candidates[second]) & pivotMask) === pivotMask;
  return sameZ && coversPivot ? z : 0;
}

/**
 * @param {import('./shared.js').Board} board
 * @returns {import('./shared.js').Step | null}
 */
export function findXYWing(board) {
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    if (!isBivalue(board, pivot)) {
      continue;
    }
    for (const [first, second] of combinations(pincersOf(board, pivot), 2)) {
      const z = wingDigit(board, pivot, first, second);
      const targets = z ? PEERS[first].filter((cell) => cell !== pivot && seesEachOther(cell, second)) : [];
      const eliminations = eliminationsIn(board, targets, z);
      if (eliminations.length > 0) {
        return makeStep('xyWing', {
          eliminations,
          cells: [pivot, first, second],
          // Ordre explicatif : chiffre partagé avec la 1re pince, avec la 2e, puis z.
          digits: [first, second].map((pincer) => singleDigit(board.candidates[pincer] & board.candidates[pivot])).concat(singleDigit(z)),
        });
      }
    }
  }
  return null;
}
