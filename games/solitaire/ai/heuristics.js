/**
 * Heuristiques partagées par le solveur et le planificateur d'indices.
 *
 * Trois outils distincts :
 * - `findSafeMove` : un coup vers une fondation qui ne peut jamais nuire ;
 * - `rankMove` : l'ordre dans lequel essayer les coups (le meilleur d'abord) ;
 * - `evaluate` : la valeur d'une position quand on ne peut pas aller au bout.
 *
 * Ordonner les coups ne retire aucune possibilité : seul `findSafeMove`
 * élague, et uniquement des alternatives prouvées inutiles.
 *
 * @module games/solitaire/ai/heuristics
 */

import { KING, SUITS, cardInfo } from '../engine/cards.js';
import { foundationCount, hiddenCount, listMoves, parsePile } from '../engine/rules.js';

/** Poids de l'évaluation : découvrir une carte cachée prime sur le reste. */
export const WEIGHTS = Object.freeze({
  hidden: -50,
  foundation: 20,
  emptyColumn: 15,
  reserve: -2,
});

/** Couleur de chaque fondation, dans l'ordre de `SUITS`. */
const FOUNDATION_IS_RED = SUITS.map(suit => cardInfo(`A${suit}`).red);

/**
 * Une carte peut monter sans risque si aucune carte ne pourra plus avoir
 * besoin d'elle comme support : as et 2 toujours (un as va à sa fondation,
 * jamais sur un 2), sinon quand les deux fondations de l'autre couleur ont déjà
 * reçu le rang inférieur. Jouer ce coup tout de suite ne perd donc aucune
 * solution : le solveur peut l'imposer sans explorer d'alternative.
 * @param {string} card
 * @param {string[][]} foundations
 * @returns {boolean}
 */
export function isSafeToFound(card, foundations) {
  const { rank, red } = cardInfo(card);
  if (rank <= 2) {
    return true;
  }
  return foundations.every((foundation, index) => FOUNDATION_IS_RED[index] === red || foundation.length >= rank - 1);
}

/**
 * Premier coup sûr vers une fondation, s'il existe.
 * @param {import('../engine/rules.js').Board} board
 * @param {import('../engine/rules.js').SolitaireAction[]} [moves] - Coups déjà listés
 * @returns {import('../engine/rules.js').MoveAction|null}
 */
export function findSafeMove(board, moves = listMoves(board)) {
  return moves.find(move => move.type === 'move' && move.to.startsWith('foundation')
    && isSafeToFound(movedCard(board, move), board.foundations)) ?? null;
}

/**
 * Carte la plus basse d'un déplacement (celle qui se pose sur la destination).
 * @param {import('../engine/rules.js').Board} board
 * @param {import('../engine/rules.js').MoveAction} move
 * @returns {string}
 */
export function movedCard(board, move) {
  return takenCard(board, move.from, move.count);
}

/**
 * Carte la plus basse quand on prend `count` cartes sur la pile `from`.
 * @param {import('../engine/rules.js').Board} board
 * @param {string} from - Identifiant de pile valide
 * @param {number} count
 * @returns {string}
 */
export function takenCard(board, from, count) {
  const pile = parsePile(from);
  if (pile.zone === 'tableau') {
    const { up } = board.tableau[pile.index];
    return up[up.length - count];
  }
  const cards = pile.zone === 'waste' ? board.waste : board.foundations[pile.index];
  return cards[cards.length - 1];
}

/** Une séquence partielle mérite d'être déplacée si elle découvre une carte qui monte. */
function exposesFoundationCard(board, column, count) {
  const { up } = column;
  const exposed = up[up.length - count - 1];
  const { suitIndex, rank } = cardInfo(exposed);
  return board.foundations[suitIndex].length === rank - 1;
}

/** Priorités d'essai des coups, de la plus forte à la plus faible. */
export const MOVE_PRIORITY = Object.freeze({
  revealToFoundation: 600,
  reveal: 500,
  toFoundation: 400,
  exposeForFoundation: 300,
  wasteToTableau: 250,
  emptyColumn: 120,
  rearrange: 20,
  draw: 1,
  recycle: 0,
  fromFoundation: -50,
  pointlessKing: -100,
});

/**
 * En dessous de ce rang, un coup ne fait que réarranger le tableau : la
 * recherche rapide l'ignore (au prix de la complétude, voir `solve`).
 */
export const PROMISING_RANK = MOVE_PRIORITY.emptyColumn;

/** Priorité d'un coup partant du tableau vers une autre colonne. */
function rankTableauMove(board, move, column) {
  if (move.count < column.up.length) {
    return exposesFoundationCard(board, column, move.count) ? MOVE_PRIORITY.exposeForFoundation : MOVE_PRIORITY.rearrange;
  }
  if (column.down.length) {
    // Découvrir une carte cachée, d'abord dans les colonnes les plus chargées.
    return MOVE_PRIORITY.reveal + column.down.length * 10;
  }
  // Vider une colonne n'a d'intérêt que pour y placer un roi venu d'ailleurs.
  return cardInfo(column.up[0]).rank === KING ? MOVE_PRIORITY.pointlessKing : MOVE_PRIORITY.emptyColumn;
}

/**
 * Score d'ordre d'un coup : plus il est élevé, plus tôt il est essayé.
 * @param {import('../engine/rules.js').Board} board
 * @param {import('../engine/rules.js').SolitaireAction} move
 * @returns {number}
 */
export function rankMove(board, move) {
  if (move.type !== 'move') {
    return move.type === 'draw' ? MOVE_PRIORITY.draw : MOVE_PRIORITY.recycle;
  }
  const from = parsePile(move.from);
  const toFoundation = move.to.startsWith('foundation');
  if (from.zone === 'tableau') {
    const column = board.tableau[from.index];
    const reveals = move.count === column.up.length && column.down.length > 0;
    if (toFoundation) {
      return reveals ? MOVE_PRIORITY.revealToFoundation : MOVE_PRIORITY.toFoundation;
    }
    return rankTableauMove(board, move, column);
  }
  if (toFoundation) {
    return MOVE_PRIORITY.toFoundation;
  }
  return from.zone === 'waste' ? MOVE_PRIORITY.wasteToTableau : MOVE_PRIORITY.fromFoundation;
}

/**
 * Trie des coups du plus prometteur au moins prometteur (tri stable).
 * @param {import('../engine/rules.js').Board} board
 * @param {import('../engine/rules.js').SolitaireAction[]} moves
 * @returns {import('../engine/rules.js').SolitaireAction[]}
 */
export function orderMoves(board, moves) {
  return moves
    .map((move, index) => ({ move, index, rank: rankMove(board, move) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map(entry => entry.move);
}

/**
 * Valeur d'une position, sans lire l'identité des cartes : elle reste donc
 * calculable quand une carte vient d'être retournée sans être connue.
 * @param {import('../engine/rules.js').Board} board
 * @returns {number}
 */
export function evaluate(board) {
  const emptyColumns = board.tableau.filter(column => !column.down.length && !column.up.length).length;
  return WEIGHTS.hidden * hiddenCount(board)
    + WEIGHTS.foundation * foundationCount(board)
    + WEIGHTS.emptyColumn * emptyColumns
    + WEIGHTS.reserve * (board.stock.length + board.waste.length);
}
