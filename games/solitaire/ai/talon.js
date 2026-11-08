/**
 * Coups composés du talon pour le solveur à information complète.
 *
 * Piocher ne change ni le tableau ni les fondations : une suite de pioches
 * n'a d'intérêt que si elle amène une carte jouable sur la défausse. Et un
 * coup du tableau ne dépend pas de l'état du talon, il peut donc toujours être
 * joué avant ces pioches. On remplace donc les actions `draw` et `recycle` par
 * des séquences « piocher jusqu'à telle carte, puis la jouer » : la recherche
 * reste complète mais devient beaucoup moins profonde.
 *
 * @module games/solitaire/ai/talon
 */

import { applyMove, isLegalMove, tableauId, foundationId, COLUMN_COUNT, WASTE } from '../engine/rules.js';
import { cardInfo } from '../engine/cards.js';

const DRAW = Object.freeze({ type: 'draw' });
const RECYCLE = Object.freeze({ type: 'recycle' });

/**
 * Coups possibles de la carte du dessus de la défausse.
 * @param {import('../engine/rules.js').Board} board
 * @returns {import('../engine/rules.js').MoveAction[]}
 */
function wastePlays(board) {
  const card = board.waste[board.waste.length - 1];
  const targets = [foundationId(cardInfo(card).suitIndex)];
  for (let index = 0; index < COLUMN_COUNT; index++) {
    targets.push(tableauId(index));
  }
  return targets
    .map(to => ({ type: 'move', from: WASTE, to, count: 1 }))
    .filter(move => isLegalMove(board, move));
}

/**
 * Séquences « pioches puis coup de la défausse », au plus un tour complet.
 * Sans coup joué, la position dans le cycle du talon ne dépend que de la
 * taille de la défausse : c'est la clé qui détecte le retour au départ.
 * @param {import('../engine/rules.js').Board} board - Plateau entièrement connu
 * @returns {import('../engine/rules.js').SolitaireAction[][]}
 */
export function talonSequences(board) {
  const sequences = [];
  const visited = new Set([board.waste.length]);
  const prefix = [];
  let current = board;
  while (current.stock.length || current.waste.length) {
    const action = current.stock.length ? DRAW : RECYCLE;
    current = applyMove(current, action).board;
    prefix.push(action);
    if (visited.has(current.waste.length)) {
      break;
    }
    visited.add(current.waste.length);
    if (current.waste.length) {
      sequences.push(...wastePlays(current).map(play => [...prefix, play]));
    }
  }
  return sequences;
}
