/**
 * Destination automatique d'un clic (ou d'Entrée) et d'un double-clic.
 *
 * Un clic choisit la « meilleure » destination : la fondation si la carte y
 * monte sans risque (`isSafeToFound`), sinon une colonne où elle prolonge une
 * séquence, sinon une colonne vide, et la fondation en dernier recours. Une
 * carte qui pourrait encore servir de support reste donc dans le tableau ; le
 * double-clic, lui, l'envoie explicitement sur sa fondation.
 *
 * @module games/solitaire/ui/destinations
 */

import { cardInfo } from '../engine/cards.js';
import { COLUMN_COUNT, foundationId, isLegalMove, parsePile, tableauId } from '../engine/rules.js';
import { isSafeToFound, movedCard, takenCard } from '../ai/heuristics.js';

/**
 * Coup vers la fondation de la carte, s'il est légal (une seule carte).
 * @param {import('../engine/rules.js').Board} board - Plateau issu de la vue
 * @param {string} from - Pile d'origine
 * @param {number} count - Nombre de cartes prises
 * @returns {import('../engine/rules.js').MoveAction|null}
 */
export function foundationMove(board, from, count) {
  if (count !== 1 || parsePile(from)?.zone === 'foundation') {
    return null;
  }
  const card = takenCard(board, from, count);
  if (card === undefined) {
    return null;
  }
  const move = { type: 'move', from, to: foundationId(cardInfo(card).suitIndex), count };
  return isLegalMove(board, move) ? move : null;
}

/**
 * Un roi déjà au fond d'une colonne sans carte cachée ne gagne rien à changer
 * de colonne vide : le clic ne le propose pas (le glisser reste possible).
 */
function isPointlessKingMove(board, from, count, to) {
  const source = parsePile(from);
  const target = board.tableau[parsePile(to).index];
  if (source.zone !== 'tableau' || target.up.length) {
    return false;
  }
  const column = board.tableau[source.index];
  return column.down.length === 0 && count === column.up.length;
}

/** Colonnes qui acceptent la prise, les colonnes occupées d'abord. */
function tableauMoves(board, from, count) {
  const moves = [];
  for (let index = 0; index < COLUMN_COUNT; index++) {
    const move = { type: 'move', from, to: tableauId(index), count };
    if (isLegalMove(board, move) && !isPointlessKingMove(board, from, count, move.to)) {
      moves.push(move);
    }
  }
  const occupied = move => board.tableau[parsePile(move.to).index].up.length > 0;
  return [...moves.filter(occupied), ...moves.filter(move => !occupied(move))];
}

/**
 * Meilleure destination d'un clic, ou `null` si la prise ne va nulle part.
 * @param {import('../engine/rules.js').Board} board - Plateau issu de la vue
 * @param {string} from - Pile d'origine
 * @param {number} count - Nombre de cartes prises
 * @returns {import('../engine/rules.js').MoveAction|null}
 */
export function bestMove(board, from, count) {
  const toFoundation = foundationMove(board, from, count);
  if (toFoundation && isSafeToFound(movedCard(board, toFoundation), board.foundations)) {
    return toFoundation;
  }
  return tableauMoves(board, from, count)[0] ?? toFoundation;
}
