/**
 * Générateur de grilles à solution unique, ciblant un niveau de difficulté.
 *
 * Algorithme d'un essai (entièrement déterminé par le SeededRandom reçu) :
 * 1. Tirer une grille complète aléatoire (solveur exact à ordre de chiffres mélangé).
 * 2. Creuser : mélanger les 41 « orbites » de la symétrie centrale (la case i va
 *    avec 80 - i, la case centrale 40 est seule) et retirer chaque orbite tant que
 *    la grille garde une solution unique (comptage exact arrêté à 2 solutions).
 *    On obtient une grille minimale : aucun autre retrait symétrique n'est possible.
 * 3. Remonter : si cette grille exige une technique plus difficile que la cible,
 *    ou une technique inconnue du solveur humain, on remet des orbites retirées
 *    (dans un ordre aléatoire) jusqu'à ce que le solveur humain la résolve sans
 *    dépasser la cible. Ajouter des indices conserve l'unicité.
 * 4. L'essai réussit si la technique la plus difficile requise est exactement
 *    celle du niveau visé. Sinon, on recommence avec une nouvelle grille complète.
 *
 * Le nombre d'essais est borné (MAX_ATTEMPTS). Repli documenté : si aucun essai
 * n'atteint le niveau, on retient l'essai le plus difficile obtenu (jamais au-dessus
 * de la cible) et on le signale par `exact: false`. Comme tout dépend de la seed,
 * le même couple (seed, niveau) redonne toujours la même grille, repli compris.
 */

import { CELL_COUNT } from './grid.js';
import { countSolutions, createSolvedGrid } from './exact-solver.js';
import { levelById, ratePuzzle } from './difficulty.js';

/**
 * Essais maximum par niveau, calibrés sur les fréquences mesurées (voir README) :
 * un essai coûte environ 5 ms ; les grilles « Difficile » sont les plus rares.
 */
export const MAX_ATTEMPTS = Object.freeze({ easy: 10, medium: 80, hard: 250, expert: 150 });

/** Orbites de la symétrie centrale : [i, 80 - i] pour i < 40, puis [40]. */
const ORBITS = Object.freeze([
  ...Array.from({ length: (CELL_COUNT - 1) / 2 }, (_, cell) => Object.freeze([cell, CELL_COUNT - 1 - cell])),
  Object.freeze([(CELL_COUNT - 1) / 2]),
]);

const fill = (givens, orbit, values) => orbit.forEach((cell) => { givens[cell] = values[cell]; });

/**
 * Étape 2 : retire les orbites tant que la solution reste unique.
 * @returns {{givens: number[], removed: (readonly number[])[]}}
 */
function carveMinimal(solution, rng) {
  const givens = [...solution];
  const removed = [];
  const empty = new Array(CELL_COUNT).fill(0);
  for (const orbit of rng.shuffle([...ORBITS])) {
    fill(givens, orbit, empty);
    if (countSolutions(givens, 2) === 1) {
      removed.push(orbit);
    } else {
      fill(givens, orbit, solution);
    }
  }
  return { givens, removed };
}

/**
 * Étape 3 : remet des indices jusqu'à ce que la grille soit classée au plus au rang visé.
 * @returns {number} Rang obtenu.
 */
function relaxToRank(givens, removed, solution, rng, targetRank) {
  const pool = rng.shuffle([...removed]);
  let rating = ratePuzzle(givens, targetRank);
  while (rating.level === null) {
    fill(givens, pool.pop(), solution);
    rating = ratePuzzle(givens, targetRank);
  }
  return rating.rank;
}

/**
 * @typedef {Object} GeneratedPuzzle
 * @property {number[]} givens Chiffres donnés (0 = vide).
 * @property {number[]} solution Solution unique.
 * @property {import('./difficulty.js').LevelId} level Niveau réellement obtenu.
 * @property {boolean} exact Vrai si le niveau obtenu est le niveau demandé.
 * @property {number} attempts Nombre de grilles complètes essayées.
 */

/**
 * Génère une grille du niveau demandé.
 * @param {import('../../../lib/seeded-random.js').SeededRandom} rng Consommé (et donc avancé).
 * @param {import('./difficulty.js').LevelId} levelId
 * @param {number} [maxAttempts]
 * @returns {GeneratedPuzzle}
 */
export function generatePuzzle(rng, levelId, maxAttempts = MAX_ATTEMPTS[levelId]) {
  const target = levelById(levelId);
  let best = null;
  let attempts = 0;
  while (attempts < maxAttempts && best?.rank !== target.rank) {
    attempts++;
    const solution = createSolvedGrid(rng);
    const { givens, removed } = carveMinimal(solution, rng);
    const rank = relaxToRank(givens, removed, solution, rng, target.rank);
    if (!best || rank > best.rank) {
      best = { givens, solution, rank };
    }
  }
  return {
    givens: best.givens, solution: best.solution, level: ratePuzzle(best.givens).level,
    exact: best.rank === target.rank, attempts,
  };
}
