/**
 * Lecture d'une vue joueur pour le solveur.
 *
 * Le solveur ne connaît que ce qu'un joueur voit : les chiffres ouverts et les
 * cases encore fermées. Les drapeaux sont lus pour rédiger les explications,
 * mais jamais crus : un drapeau posé par un humain peut être faux.
 */
import { neighborTable } from '../engine/grid.js';

/**
 * @typedef {number|'hidden'|'flag'|'mine'|'exploded'|'wrong-flag'} CellView
 *
 * @typedef {Object} SolverInput
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mineCount - Nombre total de mines.
 * @property {ReadonlyArray<CellView>} cells - Contenu visible de chaque case.
 *
 * @typedef {Object} Constraint
 * @property {number} origin - Case du chiffre.
 * @property {number} value - Chiffre affiché.
 * @property {number[]} cells - Voisines fermées (inconnues) du chiffre.
 *
 * @typedef {Object} BoardKnowledge
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mineCount - Nombre total de mines.
 * @property {ReadonlyArray<CellView>} cells - Vue d'origine.
 * @property {number[]} unknown - Cases fermées, drapées ou non.
 * @property {Constraint[]} constraints - Un chiffre ouvert touchant au moins une case fermée.
 * @property {Map<number, number[]>} constraintsByCell - Contraintes (indices) touchant chaque case fermée.
 */

/**
 * Une case est inconnue tant qu'elle n'affiche pas de chiffre.
 * @param {CellView} cell - Contenu visible.
 * @returns {boolean}
 */
export const isUnknown = cell => typeof cell !== 'number';

/**
 * Construit les contraintes « ce chiffre voit exactement N mines parmi ces cases ».
 * @param {SolverInput} view - Vue joueur (ou vue simulée par le générateur).
 * @returns {BoardKnowledge} Connaissances exploitables par les techniques du solveur.
 */
export function readBoard(view) {
  const { width, height, mineCount, cells } = view;
  const table = neighborTable(width, height);
  const unknown = [];
  const constraints = [];
  const constraintsByCell = new Map();
  cells.forEach((cell, index) => {
    if (isUnknown(cell)) {
      unknown.push(index);
      return;
    }
    const hidden = table[index].filter(neighbor => isUnknown(cells[neighbor]));
    if (hidden.length === 0) { return; }
    for (const neighbor of hidden) {
      if (!constraintsByCell.has(neighbor)) { constraintsByCell.set(neighbor, []); }
      constraintsByCell.get(neighbor).push(constraints.length);
    }
    constraints.push({ origin: index, value: cell, cells: hidden });
  });
  return { width, height, mineCount, cells, unknown, constraints, constraintsByCell };
}

/**
 * @typedef {Object} ReducedConstraint
 * @property {number} origin - Case du chiffre.
 * @property {number} value - Chiffre affiché.
 * @property {number[]} cells - Voisines encore indéterminées.
 * @property {number} need - Mines restant à placer parmi `cells`.
 * @property {number[]} knownMines - Voisines déjà prouvées minées.
 * @property {number[]} uses - Voisines déjà déduites (mines ou sûres) retirées de la contrainte.
 */

/**
 * Retire d'une contrainte les cases déjà déduites.
 * @param {Constraint} constraint - Contrainte d'origine.
 * @param {ReadonlyMap<number, 'safe'|'mine'>} known - Déductions déjà établies.
 * @returns {ReducedConstraint}
 */
export function reduceConstraint(constraint, known) {
  const cells = [];
  const knownMines = [];
  const uses = [];
  for (const cell of constraint.cells) {
    const fact = known.get(cell);
    if (fact === undefined) {
      cells.push(cell);
    } else {
      uses.push(cell);
      if (fact === 'mine') { knownMines.push(cell); }
    }
  }
  return {
    origin: constraint.origin, value: constraint.value, cells,
    need: constraint.value - knownMines.length, knownMines, uses,
  };
}
