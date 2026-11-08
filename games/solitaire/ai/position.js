/**
 * Positions pour l'IA : reconstruction depuis la vue du joueur et hachage.
 *
 * La vue ne contient que l'information visible. Pour réutiliser les mêmes
 * règles que le moteur, on la reconvertit en plateau où chaque carte cachée
 * (colonne face cachée, talon) est remplacée par `null`. L'IA ne lit jamais
 * une carte `null` : elle s'arrête dès qu'un coup en découvrirait une.
 *
 * @module games/solitaire/ai/position
 */

/** Marqueur d'une carte inconnue dans une clé de hachage (deux caractères comme un code). */
const UNKNOWN_KEY = '??';

/**
 * Plateau construit depuis une vue `getPlayerView` (aucune carte cachée connue).
 * @param {import('../engine.js').SolitaireView} view
 * @returns {import('../engine/rules.js').Board}
 */
export function boardFromView(view) {
  return {
    drawCount: view.drawCount,
    tableau: view.tableau.map(column => ({
      down: Array(column.downCount).fill(null),
      up: [...column.up],
    })),
    stock: Array(view.stockCount).fill(null),
    waste: [...view.waste],
    foundations: view.foundations.map(foundation => [...foundation]),
  };
}

/** Concatène des codes de carte de longueur fixe, `null` devenant `??`. */
function cardsKey(cards) {
  let key = '';
  for (const card of cards) {
    key += card ?? UNKNOWN_KEY;
  }
  return key;
}

/**
 * Clé canonique d'une position. Les colonnes sont triées : deux positions qui
 * ne diffèrent que par l'ordre des colonnes ont exactement les mêmes suites
 * gagnantes, le solveur n'en explore donc qu'une. Les fondations se résument à
 * leur hauteur ; talon et défausse gardent leur ordre, qui change les pioches.
 * @param {import('../engine/rules.js').Board} board
 * @returns {string}
 */
export function hashBoard(board) {
  const columns = board.tableau.map(column => `${cardsKey(column.down)}/${cardsKey(column.up)}`).sort();
  const heights = board.foundations.map(foundation => foundation.length).join('.');
  return `${heights}|${columns.join(',')}|${cardsKey(board.stock)}|${cardsKey(board.waste)}`;
}

/**
 * Indique si le plateau ne contient aucune carte inconnue.
 * @param {import('../engine/rules.js').Board} board
 * @returns {boolean}
 */
export function isFullyKnown(board) {
  return !board.stock.includes(null) && board.tableau.every(column => !column.down.includes(null));
}
