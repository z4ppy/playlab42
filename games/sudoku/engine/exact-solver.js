/**
 * Solveur exact par retour sur trace (backtracking) avec masques de bits.
 *
 * Principe : on maintient, pour chaque ligne, colonne et boîte, le masque des
 * chiffres déjà utilisés. Les candidats d'une case vide sont alors
 * `ALL_DIGITS & ~(ligne | colonne | boîte)` : une seule opération, sans parcours.
 * À chaque nœud, on choisit la case vide qui a le MOINS de candidats
 * (heuristique MRV, « Minimum Remaining Values ») : une case à 0 candidat coupe
 * immédiatement la branche, une case à 1 candidat est jouée sans branchement.
 * Cette heuristique suffit à résoudre n'importe quelle grille 9 × 9 en quelques
 * millisecondes, ce qui permet de compter les solutions pendant la génération.
 *
 * Ce solveur ne « raisonne » pas : il essaie et revient en arrière. Il sert de
 * référence (unicité, solution) et de contrepoint au solveur humain.
 */

import { ALL_DIGITS, CELL_COUNT, boxOf, columnOf, countDigits, digitBit, digitsOf, rowOf } from './grid.js';

const ROW = Int8Array.from({ length: CELL_COUNT }, (_, cell) => rowOf(cell));
const COLUMN = Int8Array.from({ length: CELL_COUNT }, (_, cell) => columnOf(cell));
const BOX = Int8Array.from({ length: CELL_COUNT }, (_, cell) => boxOf(cell));

/**
 * Prépare l'état de recherche ; retourne null si la grille contient déjà un doublon.
 * @param {number[]} values
 */
function createSearch(values) {
  const search = {
    grid: Int8Array.from(values),
    rows: new Int16Array(9), columns: new Int16Array(9), boxes: new Int16Array(9),
    nodes: 0,
  };
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = values[cell];
    if (value === 0) {
      continue;
    }
    if (candidatesAt(search, cell) & digitBit(value)) {
      place(search, cell, value);
    } else {
      return null;
    }
  }
  return search;
}

function candidatesAt(search, cell) {
  return ALL_DIGITS & ~(search.rows[ROW[cell]] | search.columns[COLUMN[cell]] | search.boxes[BOX[cell]]);
}

function place(search, cell, value) {
  const bit = digitBit(value);
  search.grid[cell] = value;
  search.rows[ROW[cell]] |= bit;
  search.columns[COLUMN[cell]] |= bit;
  search.boxes[BOX[cell]] |= bit;
}

function unplace(search, cell, value) {
  const keep = ~digitBit(value);
  search.grid[cell] = 0;
  search.rows[ROW[cell]] &= keep;
  search.columns[COLUMN[cell]] &= keep;
  search.boxes[BOX[cell]] &= keep;
}

/**
 * Case vide la plus contrainte (MRV).
 * @returns {{cell: number, mask: number}} cell = -1 si la grille est pleine ; mask = 0 si impasse.
 */
function mostConstrainedCell(search) {
  let best = { cell: -1, mask: 0 };
  let bestCount = 10;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (search.grid[cell] !== 0) {
      continue;
    }
    const mask = candidatesAt(search, cell);
    const count = countDigits(mask);
    if (count < bestCount) {
      best = { cell, mask };
      bestCount = count;
      if (count <= 1) {
        break;
      }
    }
  }
  return best;
}

/**
 * Exploration récursive. `visit` reçoit chaque solution et retourne true pour arrêter.
 * @returns {boolean} true si la recherche doit s'arrêter.
 */
function explore(search, orderDigits, visit) {
  search.nodes++;
  const { cell, mask } = mostConstrainedCell(search);
  if (cell === -1) {
    return visit(search.grid);
  }
  for (const value of orderDigits(digitsOf(mask))) {
    place(search, cell, value);
    const stop = explore(search, orderDigits, visit);
    unplace(search, cell, value);
    if (stop) {
      return true;
    }
  }
  return false;
}

const naturalOrder = (digits) => digits;

/**
 * Compte les solutions d'une grille, en s'arrêtant dès `limit` atteint.
 * Avec limit = 2 (valeur par défaut), on distingue 0, 1 ou « au moins 2 » solutions :
 * c'est exactement ce qu'il faut pour vérifier l'unicité.
 * @param {number[]} values Grille (0 = vide).
 * @param {number} [limit=2] Nombre de solutions au-delà duquel on s'arrête.
 * @returns {number} Nombre de solutions trouvées, borné par limit.
 */
export function countSolutions(values, limit = 2) {
  const search = createSearch(values);
  if (!search) {
    return 0;
  }
  let count = 0;
  explore(search, naturalOrder, () => ++count >= limit);
  return count;
}

/**
 * Cherche la première solution et mesure l'effort (nœuds explorés).
 * @param {number[]} values
 * @returns {{solution: number[] | null, nodes: number}}
 */
export function findSolution(values) {
  const search = createSearch(values);
  if (!search) {
    return { solution: null, nodes: 0 };
  }
  let solution = null;
  explore(search, naturalOrder, (grid) => {
    solution = Array.from(grid);
    return true;
  });
  return { solution, nodes: search.nodes };
}

/**
 * Première solution d'une grille, ou null si elle n'en a aucune.
 * @param {number[]} values
 * @returns {number[] | null}
 */
export function solveExact(values) {
  return findSolution(values).solution;
}

/**
 * Grille complète aléatoire : on résout la grille vide en mélangeant l'ordre des
 * chiffres essayés à chaque nœud. Le hasard vient exclusivement du `SeededRandom` fourni.
 * @param {import('../../../lib/seeded-random.js').SeededRandom} rng
 * @returns {number[]}
 */
export function createSolvedGrid(rng) {
  const search = createSearch(new Array(CELL_COUNT).fill(0));
  let solution = null;
  explore(search, (digits) => rng.shuffle(digits), (grid) => {
    solution = Array.from(grid);
    return true;
  });
  return solution;
}
