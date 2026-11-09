/**
 * « Poissons » : X-Wing (taille 2) et Swordfish (taille 3).
 *
 * Exemple X-Wing sur le chiffre 5 : dans la ligne 2, le 5 n'est possible qu'en
 * colonnes 3 et 8 ; dans la ligne 7 aussi, et seulement en colonnes 3 et 8.
 * Deux cas possibles : 5 en L2C3 et L7C8, ou 5 en L2C8 et L7C3. Dans les deux
 * cas, les colonnes 3 et 8 reçoivent leur 5 sur les lignes 2 et 7 → on retire
 * le 5 de toutes les autres cases des colonnes 3 et 8.
 * Swordfish applique le même raisonnement à 3 lignes et 3 colonnes.
 * Les rôles des lignes et des colonnes peuvent être échangés.
 */

import { COLUMNS, DIGITS, ROWS, cellAt, combinations, countDigits, digitBit, digitsOf } from '../grid.js';
import { eliminationsIn, makeStep, unitRef } from './shared.js';

const FISH_IDS = { 2: 'xWing', 3: 'swordfish' };
const LINE_INDEXES = DIGITS.map((value) => value - 1);

/**
 * Deux orientations : lignes de base et colonnes de couverture, ou l'inverse.
 * `cellOf(base, cross)` donne la case à l'intersection d'une ligne de base et d'une ligne de couverture.
 */
const ORIENTATIONS = [
  { bases: ROWS, covers: COLUMNS, cellOf: (base, cross) => cellAt(base, cross) },
  { bases: COLUMNS, covers: ROWS, cellOf: (base, cross) => cellAt(cross, base) },
];

/** Index (0..8) des bits d'un masque : le bit k désigne la ligne de couverture k. */
const crossIndexes = (mask) => digitsOf(mask).map((position) => position - 1);

/** Masque des lignes de couverture où `bit` est candidat dans la ligne de base. */
function crossMask(board, orientation, base, bit) {
  let mask = 0;
  for (const cross of LINE_INDEXES) {
    if (board.candidates[orientation.cellOf(base.index, cross)] & bit) {
      mask |= 1 << cross;
    }
  }
  return mask;
}

function findFishForDigit(board, size, value, orientation) {
  const bit = digitBit(value);
  const lines = orientation.bases
    .map((base) => ({ base, mask: crossMask(board, orientation, base, bit) }))
    .filter(({ mask }) => countDigits(mask) >= 2 && countDigits(mask) <= size);
  for (const group of combinations(lines, size)) {
    const union = group.reduce((mask, line) => mask | line.mask, 0);
    if (countDigits(union) !== size) {
      continue;
    }
    const baseIndexes = group.map(({ base }) => base.index);
    const covers = crossIndexes(union).map((cross) => orientation.covers[cross]);
    const outside = covers.flatMap((cover) => LINE_INDEXES
      .filter((base) => !baseIndexes.includes(base))
      .map((base) => orientation.cellOf(base, cover.index)));
    const eliminations = eliminationsIn(board, outside, bit);
    if (eliminations.length > 0) {
      const cells = group.flatMap(({ base, mask }) => crossIndexes(mask).map((cross) => orientation.cellOf(base.index, cross)));
      return makeStep(FISH_IDS[size], {
        eliminations,
        units: [...group.map(({ base }) => unitRef(base)), ...covers.map(unitRef)],
        cells: cells.sort((a, b) => a - b),
        digits: [value],
      });
    }
  }
  return null;
}

/**
 * @param {import('./shared.js').Board} board
 * @param {2 | 3} size 2 = X-Wing, 3 = Swordfish.
 * @returns {import('./shared.js').Step | null}
 */
export function findFish(board, size) {
  for (const value of DIGITS) {
    for (const orientation of ORIENTATIONS) {
      const step = findFishForDigit(board, size, value, orientation);
      if (step) {
        return step;
      }
    }
  }
  return null;
}
