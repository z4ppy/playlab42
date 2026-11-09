/**
 * Niveaux de difficulté, définis par la technique la plus avancée nécessaire.
 *
 * Le nombre de cases vides est un mauvais indicateur : une grille à 25 chiffres
 * donnés peut se résoudre avec des singletons, une autre à 30 exiger un X-Wing.
 * Ici, on résout la grille avec le solveur humain (techniques simples d'abord)
 * et le niveau est celui de la technique la plus difficile qu'il a dû employer.
 */

import { solveLogically } from './human-solver.js';
import { TECHNIQUES } from './techniques/index.js';

/**
 * @typedef {'easy' | 'medium' | 'hard' | 'expert'} LevelId
 * @typedef {{id: LevelId, label: string, rank: number}} Level
 */

/** @type {readonly Level[]} */
export const LEVELS = Object.freeze([
  { id: 'easy', label: 'Facile', rank: 1 },
  { id: 'medium', label: 'Moyen', rank: 2 },
  { id: 'hard', label: 'Difficile', rank: 3 },
  { id: 'expert', label: 'Expert', rank: 4 },
].map(Object.freeze));

export const LEVEL_IDS = Object.freeze(LEVELS.map((level) => level.id));

/** @param {unknown} id @returns {id is LevelId} */
export const isLevelId = (id) => LEVEL_IDS.includes(/** @type {LevelId} */ (id));

/** @param {LevelId} id @returns {Level} */
export const levelById = (id) => LEVELS.find((level) => level.id === id);

/** @param {number} rank @returns {Level} */
export const levelByRank = (rank) => LEVELS.find((level) => level.rank === rank);

/**
 * Techniques classées par niveau, pour la documentation et l'interface.
 * @returns {Record<LevelId, string[]>}
 */
export function techniquesByLevel() {
  return Object.fromEntries(LEVELS.map((level) => [
    level.id, TECHNIQUES.filter((technique) => technique.rank === level.rank).map((technique) => technique.name),
  ]));
}

/**
 * @typedef {Object} Rating
 * @property {LevelId | null} level Niveau, ou null si le solveur humain ne termine pas.
 * @property {number} rank Rang du niveau (0 si non classé).
 * @property {Record<string, number>} techniques Nombre d'utilisations de chaque technique.
 * @property {number} steps Nombre total de déductions.
 */

/**
 * Classe une grille.
 * @param {number[]} values
 * @param {number} [maxRank=4] Arrête l'analyse au-delà de ce rang (accélère la génération des niveaux faciles).
 * @returns {Rating}
 */
export function ratePuzzle(values, maxRank = 4) {
  const result = solveLogically(values, maxRank);
  const techniques = {};
  for (const step of result.steps) {
    techniques[step.technique] = (techniques[step.technique] ?? 0) + 1;
  }
  const solved = result.status === 'solved';
  // Une grille déjà pleine (aucune déduction) est considérée comme facile.
  const rank = solved ? Math.max(1, result.hardestRank) : 0;
  return { level: solved ? levelByRank(rank).id : null, rank, techniques, steps: result.steps.length };
}
