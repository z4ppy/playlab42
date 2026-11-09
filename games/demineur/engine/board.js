/**
 * Ouverture des cases, partagée par le moteur et par la simulation du générateur.
 * Fonctions pures : elles reçoivent un tableau de marques et en rendent une copie.
 */
import { neighborTable } from './grid.js';

/** Marques possibles d'une case dans l'état du moteur. */
export const MARK = Object.freeze({ HIDDEN: 'hidden', FLAG: 'flag', OPEN: 'open' });

/**
 * @typedef {Object} OpeningBoard
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {ReadonlySet<number>} mineSet - Mines de la grille.
 * @property {ReadonlyArray<number>} counts - Mines voisines de chaque case.
 */

/**
 * Ouvre des cases puis propage l'ouverture en cascade autour des « 0 ».
 *
 * Une case drapée n'est jamais ouverte par la cascade (comme dans le jeu
 * original) : le joueur garde la main sur ses drapeaux, même faux.
 * Une mine ouverte n'étend pas la cascade : c'est l'explosion.
 *
 * @param {OpeningBoard} board - Grille et comptes de mines voisines.
 * @param {ReadonlyArray<string>} marks - Marques actuelles (non modifiées).
 * @param {number[]} starts - Cases à ouvrir, dans l'ordre.
 * @returns {{marks: string[], opened: number[], exploded: number[]}} Nouvelles marques,
 *   cases ouvertes dans l'ordre de la cascade et mines ouvertes.
 */
export function openCells(board, marks, starts) {
  const table = neighborTable(board.width, board.height);
  const next = [...marks];
  const opened = [];
  const exploded = [];
  const queue = [...starts];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (next[index] !== MARK.HIDDEN) { continue; }
    next[index] = MARK.OPEN;
    opened.push(index);
    if (board.mineSet.has(index)) {
      exploded.push(index);
    } else if (board.counts[index] === 0) {
      queue.push(...table[index]);
    }
  }
  return { marks: next, opened, exploded };
}
