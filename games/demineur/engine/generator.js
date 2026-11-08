/**
 * Génération des mines, après le premier clic.
 *
 * - **Premier clic sûr** : la case cliquée et ses voisines ne reçoivent jamais
 *   de mine, le premier clic ouvre donc toujours une zone (un « 0 »).
 * - **Sans hasard** : on tire une grille, puis le solveur la joue depuis le
 *   premier clic sans jamais deviner. Tant qu'il bloque, on tire la grille
 *   suivante avec le même générateur (dont l'état avance) : le résultat reste
 *   entièrement déterminé par la seed et le premier clic.
 * - **Repli documenté** : après `MAX_NO_GUESS_ATTEMPTS` essais, on garde la
 *   grille que le solveur a le plus avancée et on le signale (`guaranteed:
 *   false`). La partie reste jouable ; un pari pourra être nécessaire.
 */
import { neighborTable } from './grid.js';
import { solveFromFirstClick } from '../solver/playthrough.js';

/**
 * Nombre maximal de grilles tirées en mode sans hasard. Mesures (premier clic
 * au centre, seeds 1 à 100, Node 26) : Débutant 1 essai en moyenne, Intermédiaire
 * 1,5 (5 au pire), Expert 7 (19 au pire sur 40 seeds), soit environ 40 ms par
 * grille Expert. Avec une réussite d'environ 1 sur 7 par essai, 100 essais
 * échouent avec une probabilité de l'ordre de 10⁻⁷ et bornent l'attente à
 * quelques secondes sur un téléphone lent.
 */
export const MAX_NO_GUESS_ATTEMPTS = 100;

/**
 * @typedef {Object} MineSpec
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mineCount - Nombre de mines.
 * @property {number} firstIndex - Premier clic.
 * @property {boolean} noGuess - Exiger une grille résoluble sans pari.
 *
 * @typedef {Object} Generation
 * @property {number[]} mines - Indices des mines, triés.
 * @property {number} attempts - Grilles tirées.
 * @property {boolean} guaranteed - Résolubilité sans pari vérifiée par le solveur.
 */

/**
 * Cases interdites aux mines : le premier clic et, si la place le permet, ses voisines.
 * @param {MineSpec} spec - Dimensions, mines et premier clic.
 * @returns {Set<number>}
 */
function safeZone(spec) {
  const zone = new Set([spec.firstIndex, ...neighborTable(spec.width, spec.height)[spec.firstIndex]]);
  // Grille très dense : on garantit au moins le premier clic lui-même.
  return spec.width * spec.height - zone.size >= spec.mineCount ? zone : new Set([spec.firstIndex]);
}

/**
 * Tire une grille uniformément parmi celles qui respectent la zone sûre.
 * @param {MineSpec} spec - Dimensions, mines et premier clic.
 * @param {import('../../../lib/seeded-random.js').SeededRandom} rng - Générateur (son état avance).
 * @returns {number[]} Mines triées.
 */
export function placeMines(spec, rng) {
  const zone = safeZone(spec);
  const candidates = [];
  for (let index = 0; index < spec.width * spec.height; index++) {
    if (!zone.has(index)) { candidates.push(index); }
  }
  // `shuffle` mélange en place : `candidates` est une copie locale.
  return rng.shuffle(candidates).slice(0, spec.mineCount).sort((a, b) => a - b);
}

/**
 * Génère les mines d'une partie.
 * @param {MineSpec} spec - Dimensions, mines, premier clic et mode.
 * @param {import('../../../lib/seeded-random.js').SeededRandom} rng - Générateur (son état avance).
 * @param {{maxAttempts?: number}} [options] - Borne d'essais (tests).
 * @returns {Generation}
 */
export function generateMines(spec, rng, { maxAttempts = MAX_NO_GUESS_ATTEMPTS } = {}) {
  if (!spec.noGuess) { return { mines: placeMines(spec, rng), attempts: 1, guaranteed: false }; }
  let best = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const mines = placeMines(spec, rng);
    const { solved, opened } = solveFromFirstClick({ ...spec, mines }, spec.firstIndex);
    if (solved) { return { mines, attempts: attempt, guaranteed: true }; }
    if (!best || opened > best.opened) { best = { mines, opened }; }
  }
  return { mines: best.mines, attempts: maxAttempts, guaranteed: false };
}
