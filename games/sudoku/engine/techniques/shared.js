/**
 * Outils communs aux techniques du solveur humain.
 *
 * Une technique reçoit un plateau de travail `{values, candidates}` (lecture seule)
 * et retourne la première déduction trouvée, décrite par un « pas » JSON :
 *
 * @typedef {{cell: number, value: number}} CellValue
 * @typedef {{type: 'row' | 'column' | 'box', index: number}} UnitRef
 * @typedef {Object} Step
 * @property {string} technique Identifiant de la technique (voir techniques/index.js).
 * @property {CellValue[]} placements Chiffres à poser (singletons).
 * @property {CellValue[]} eliminations Candidats à retirer (autres techniques).
 * @property {UnitRef[]} units Unités où regarder, la principale en premier.
 * @property {number[]} cells Cases qui forment le motif (pivot, paire, X-Wing...).
 * @property {number[]} digits Chiffres concernés par le motif.
 *
 * @typedef {{values: number[], candidates: number[]}} Board
 */

import { digitBit, digitsOf } from '../grid.js';

/**
 * Construit un pas complet, avec des listes vides par défaut.
 * @param {string} technique
 * @param {Partial<Step>} details
 * @returns {Step}
 */
export function makeStep(technique, details) {
  return {
    technique,
    placements: [],
    eliminations: [],
    units: [],
    cells: [],
    digits: [],
    ...details,
  };
}

/** Référence JSON d'une unité, sans sa liste de cases. */
export const unitRef = (unit) => ({ type: unit.type, index: unit.index });

/**
 * Cases d'une liste où `value` est encore candidat.
 * @param {Board} board
 * @param {readonly number[]} cells
 * @param {number} value
 * @returns {number[]}
 */
export function positionsOf(board, cells, value) {
  const bit = digitBit(value);
  return cells.filter((cell) => board.candidates[cell] & bit);
}

/**
 * Candidats de `mask` présents dans les cases données : ce qu'une technique peut retirer.
 * @param {Board} board
 * @param {readonly number[]} cells
 * @param {number} mask
 * @returns {CellValue[]}
 */
export function eliminationsIn(board, cells, mask) {
  return cells.flatMap((cell) => digitsOf(board.candidates[cell] & mask).map((value) => ({ cell, value })));
}

/** Cases encore vides d'une unité. */
export const openCells = (board, unit) => unit.cells.filter((cell) => board.values[cell] === 0);
