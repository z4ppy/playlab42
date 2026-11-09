/**
 * Intersections boîte/ligne : quand les candidats d'un chiffre sont alignés.
 *
 * - Pointage : dans une boîte, le 3 n'est possible que sur la ligne 5.
 *   Le 3 de cette boîte sera donc sur la ligne 5 ; la ligne 5 ne peut pas
 *   recevoir un second 3 ailleurs → on retire le 3 du reste de la ligne 5.
 * - Réduction boîte-ligne : sur la ligne 5, le 3 n'est possible que dans la boîte 4.
 *   Le 3 de la ligne 5 sera dans la boîte 4 → on retire le 3 des autres cases
 *   de la boîte 4 (celles qui ne sont pas sur la ligne 5).
 * Les deux raisonnements sont symétriques ; ils ne posent aucun chiffre mais
 * retirent des candidats, ce qui débloque ensuite des singletons.
 */

import { BOXES, COLUMNS, DIGITS, ROWS, boxOf, columnOf, digitBit, rowOf } from '../grid.js';
import { eliminationsIn, makeStep, positionsOf, unitRef } from './shared.js';

/** Ligne et/ou colonne communes à toutes les cases (liste vide si aucune). */
function sharedLines(cells) {
  const lines = [];
  if (cells.every((cell) => rowOf(cell) === rowOf(cells[0]))) {
    lines.push(ROWS[rowOf(cells[0])]);
  }
  if (cells.every((cell) => columnOf(cell) === columnOf(cells[0]))) {
    lines.push(COLUMNS[columnOf(cells[0])]);
  }
  return lines;
}

/**
 * Cherche, pour chaque couple (unité source, chiffre), des candidats tous contenus
 * dans une unité cible, et retire ce chiffre du reste de l'unité cible.
 * @param {object} board
 * @param {string} technique
 * @param {readonly object[]} sources Unités où l'on observe l'alignement.
 * @param {(cells: number[]) => object[]} targetsOf Unités cibles qui contiennent toutes ces cases.
 */
function findAlignment(board, technique, sources, targetsOf) {
  for (const source of sources) {
    for (const value of DIGITS) {
      const cells = positionsOf(board, source.cells, value);
      if (cells.length < 2) {
        continue;
      }
      for (const target of targetsOf(cells)) {
        const outside = target.cells.filter((cell) => !source.cells.includes(cell));
        const eliminations = eliminationsIn(board, outside, digitBit(value));
        if (eliminations.length > 0) {
          return makeStep(technique, {
            eliminations, units: [unitRef(source), unitRef(target)], cells, digits: [value],
          });
        }
      }
    }
  }
  return null;
}

/**
 * @param {import('./shared.js').Board} board
 * @returns {import('./shared.js').Step | null}
 */
export function findPointing(board) {
  return findAlignment(board, 'pointing', BOXES, sharedLines);
}

/**
 * @param {import('./shared.js').Board} board
 * @returns {import('./shared.js').Step | null}
 */
export function findBoxLineReduction(board) {
  const sharedBox = (cells) => (cells.every((cell) => boxOf(cell) === boxOf(cells[0])) ? [BOXES[boxOf(cells[0])]] : []);
  return findAlignment(board, 'boxLineReduction', [...ROWS, ...COLUMNS], sharedBox);
}
