/**
 * Solveur des trous générés : prouve qu'un trou est jouable avant de le proposer.
 *
 * 1. Grille grossière (48 angles × 9 puissances) notée par la meilleure
 *    approche du trou ; les vols sont limités à 7 s.
 * 2. Affinage 5 × 5 (pas de 1,2° et 3 %) autour des six meilleurs candidats.
 * 3. Acceptation d'une cellule « approche réussie » (trou ou arrêt sur le green)
 *    dont au moins deux voisines de grille réussissent aussi, puis contrôle fin
 *    des voisins à ±0,5° et ±2 % ; tir direct vers le trou refusé si d ≥ 0,3.
 * 4. Par : 2 si la fenêtre d'affinage compte au moins 8 réussites, 3 sinon.
 *
 * Budget : environ 600 vols par tentative, sans allocation dans la boucle.
 */
import { simulateShot } from './physics.js';

/** Durée maximale d'un vol de référence : au-delà, la solution est jugée chaotique. */
export const REFERENCE_MAX_SECONDS = 7;
const COARSE_ANGLES = 48;
const COARSE_POWERS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const CANDIDATES = 6;
const REFINE_ANGLE = 12;
const REFINE_POWER = 3;
const WIDE_WINDOW = 8;
const DIRECT_POWERS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * Approche réussie : balle rentrée, ou arrêtée sur le green.
 * @param {object} hole - Trou normalisé.
 * @param {{outcome:string, x:number, y:number}} result - Fin de vol.
 * @returns {boolean} Le coup suivant serait un putt.
 */
export function isApproach(hole, result) {
  if (result.outcome === 'holed') { return true; }
  if (result.outcome !== 'rest') { return false; }
  return Math.hypot(result.x - hole.hole.x, result.y - hole.hole.y) <= hole.green;
}

/** @param {number} angle - Dixièmes de degré, éventuellement hors plage. @returns {number} Angle dans [0, 3600[. */
export function wrapAngle(angle) {
  return ((Math.round(angle) % 3600) + 3600) % 3600;
}

/** @param {number} power - Puissance. @returns {number} Puissance entière dans [1, 100]. */
const clampPower = power => Math.min(100, Math.max(1, Math.round(power)));

/**
 * @param {object} hole - Trou normalisé.
 * @param {number} angle - Dixièmes de degré.
 * @param {number} power - Puissance.
 * @returns {{angle:number, power:number, success:boolean, closest:number}} Essai.
 */
function trial(hole, angle, power) {
  const result = simulateShot(hole, hole.tee, angle, power, 0, { maxSeconds: REFERENCE_MAX_SECONDS });
  // Une balle encore en mouvement à la coupure n'est pas une solution : en jeu,
  // le vol continuerait jusqu'à 10 s et pourrait finir ailleurs.
  const success = result.duration < REFERENCE_MAX_SECONDS && isApproach(hole, result);
  return { angle, power, success, closest: success ? 0 : result.closest };
}

/** @param {object} hole - Trou normalisé. @returns {object[]} Les meilleurs essais grossiers. */
function coarseCandidates(hole) {
  const trials = [];
  for (let index = 0; index < COARSE_ANGLES; index++) {
    const angle = Math.round(index * 3600 / COARSE_ANGLES);
    for (const power of COARSE_POWERS) { trials.push(trial(hole, angle, power)); }
  }
  return trials.sort((a, b) => a.closest - b.closest).slice(0, CANDIDATES);
}

/**
 * Affine une grille 5 × 5 autour d'un candidat.
 * @param {object} hole - Trou normalisé.
 * @param {{angle:number, power:number}} center - Candidat.
 * @returns {object[][]} Essais indexés [ligne de puissance][colonne d'angle].
 */
function refine(hole, center) {
  const grid = [];
  for (let row = -2; row <= 2; row++) {
    const power = clampPower(center.power + row * REFINE_POWER);
    grid.push([-2, -1, 0, 1, 2].map(column => trial(hole, wrapAngle(center.angle + column * REFINE_ANGLE), power)));
  }
  return grid;
}

/**
 * @param {object[][]} grid - Grille affinée.
 * @param {number} row - Ligne.
 * @param {number} column - Colonne.
 * @returns {number} Voisines de grille réussies (0 à 4).
 */
function gridNeighbours(grid, row, column) {
  const around = [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]];
  return around.filter(([r, c]) => grid[r]?.[c]?.success).length;
}

/**
 * Robustesse humaine : au moins deux tirs voisins sur quatre (±0,5°, ±2 %) réussissent.
 * @param {object} hole - Trou normalisé.
 * @param {{angle:number, power:number}} shot - Tir candidat.
 * @returns {number} Nombre de voisins fins réussis.
 */
export function fineNeighbours(hole, shot) {
  const shots = [
    [shot.angle - 5, shot.power], [shot.angle + 5, shot.power],
    [shot.angle, shot.power - 2], [shot.angle, shot.power + 2],
  ];
  return shots.filter(([angle, power]) => trial(hole, wrapAngle(angle), clampPower(power)).success).length;
}

/**
 * Cellules acceptables d'une grille, les plus entourées d'abord.
 * @param {object[][]} grid - Grille affinée.
 * @returns {object[]} Essais réussis, rapides et entourés.
 */
function acceptedCells(grid) {
  const cells = [];
  grid.forEach((line, row) => line.forEach((cell, column) => {
    const neighbours = gridNeighbours(grid, row, column);
    if (cell.success && neighbours >= 2) {
      cells.push({ ...cell, neighbours });
    }
  }));
  return cells.sort((a, b) => b.neighbours - a.neighbours);
}

/**
 * Un trou dont le tir direct réussit ne demande aucune lecture de la gravité.
 * @param {object} hole - Trou normalisé.
 * @returns {boolean} Vrai si un tir dans l'axe départ–trou réussit.
 */
export function directShotWorks(hole) {
  const radians = Math.atan2(hole.hole.y - hole.tee.y, hole.hole.x - hole.tee.x);
  const angle = wrapAngle(radians * 1800 / Math.PI);
  return DIRECT_POWERS.some(power => trial(hole, angle, power).success);
}

/**
 * Cherche un tir de référence robuste.
 * @param {object} hole - Trou normalisé.
 * @param {number} difficulty - Difficulté dans [0, 1].
 * @returns {{reference:{angle:number,power:number}, par:number, window:number}|null} Solution ou null.
 */
export function solve(hole, difficulty) {
  if (difficulty >= 0.3 && directShotWorks(hole)) { return null; }
  for (const candidate of coarseCandidates(hole)) {
    const grid = refine(hole, candidate);
    const window = grid.flat().filter(cell => cell.success).length;
    const found = acceptedCells(grid).find(cell => fineNeighbours(hole, cell) >= 2);
    if (found) {
      return { reference: { angle: found.angle, power: found.power }, par: window >= WIDE_WINDOW ? 2 : 3, window };
    }
  }
  return null;
}
