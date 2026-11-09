/**
 * Catalogue ordonné des techniques du solveur humain.
 *
 * L'ordre compte : le solveur essaie toujours la technique la plus simple d'abord,
 * comme un joueur qui ne sort le X-Wing que lorsque rien d'autre ne marche.
 * Ainsi, la technique la plus avancée utilisée pendant une résolution mesure
 * honnêtement la difficulté d'une grille (voir difficulty.js).
 */

import { findFish } from './fish.js';
import { findBoxLineReduction, findPointing } from './intersections.js';
import { findHiddenSingle, findNakedSingle } from './singles.js';
import { findHiddenSubset, findNakedSubset } from './subsets.js';
import { findXYWing } from './wings.js';

/**
 * @typedef {Object} Technique
 * @property {string} id Identifiant stable, repris dans les pas.
 * @property {string} name Nom français affiché.
 * @property {1 | 2 | 3 | 4} rank Niveau de difficulté : 1 Facile … 4 Expert.
 * @property {(board: import('./shared.js').Board) => import('./shared.js').Step | null} find
 */

/** @type {readonly Technique[]} */
export const TECHNIQUES = Object.freeze([
  { id: 'hiddenSingle', name: 'Singleton caché', rank: 1, find: findHiddenSingle },
  { id: 'nakedSingle', name: 'Singleton nu', rank: 1, find: findNakedSingle },
  { id: 'pointing', name: 'Pointage', rank: 2, find: findPointing },
  { id: 'boxLineReduction', name: 'Réduction boîte-ligne', rank: 2, find: findBoxLineReduction },
  { id: 'nakedPair', name: 'Paire nue', rank: 3, find: (board) => findNakedSubset(board, 2) },
  { id: 'hiddenPair', name: 'Paire cachée', rank: 3, find: (board) => findHiddenSubset(board, 2) },
  { id: 'nakedTriple', name: 'Triplet nu', rank: 3, find: (board) => findNakedSubset(board, 3) },
  { id: 'hiddenTriple', name: 'Triplet caché', rank: 3, find: (board) => findHiddenSubset(board, 3) },
  { id: 'xWing', name: 'X-Wing', rank: 4, find: (board) => findFish(board, 2) },
  { id: 'xyWing', name: 'XY-Wing', rank: 4, find: findXYWing },
  { id: 'swordfish', name: 'Swordfish', rank: 4, find: (board) => findFish(board, 3) },
].map(Object.freeze));

const BY_ID = new Map(TECHNIQUES.map((technique) => [technique.id, technique]));

/**
 * @param {string} id
 * @returns {Technique}
 * @throws {Error} Si la technique est inconnue.
 */
export function techniqueById(id) {
  const technique = BY_ID.get(id);
  if (!technique) {
    throw new Error(`Technique inconnue : ${id}`);
  }
  return technique;
}
