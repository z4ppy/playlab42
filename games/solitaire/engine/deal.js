/**
 * Donne reproductible : un numéro de donne (la seed) produit toujours la même
 * distribution, quel que soit le navigateur ou Node.
 *
 * Convention : le jeu est créé dans l'ordre de `createDeck`, mélangé par
 * Fisher-Yates avec `SeededRandom`, puis distribué rangée par rangée comme sur
 * une table : la colonne `c` reçoit `c + 1` cartes, la dernière face visible.
 * Les 24 cartes restantes forment le talon (la dernière du tableau est piochée
 * en premier).
 *
 * @module games/solitaire/engine/deal
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import { createDeck } from './cards.js';
import { COLUMN_COUNT, FOUNDATION_COUNT } from './rules.js';

/** Plus grand numéro de donne : une seed entière non signée sur 32 bits. */
export const MAX_DEAL_NUMBER = 0xffffffff;

/**
 * Distribue la donne `dealNumber`.
 * @param {number} dealNumber - Entier de 0 à MAX_DEAL_NUMBER
 * @param {1|3} drawCount - Cartes par pioche
 * @returns {{board: import('./rules.js').Board, rngState: number}}
 */
export function dealBoard(dealNumber, drawCount) {
  const rng = new SeededRandom(dealNumber);
  // shuffle mute son tableau : createDeck en fournit toujours un neuf.
  const deck = rng.shuffle(createDeck());
  const columns = Array.from({ length: COLUMN_COUNT }, () => []);
  let next = 0;
  for (let row = 0; row < COLUMN_COUNT; row++) {
    for (let column = row; column < COLUMN_COUNT; column++) {
      columns[column].push(deck[next++]);
    }
  }
  const tableau = columns.map(cards => ({ down: cards.slice(0, -1), up: cards.slice(-1) }));
  return {
    board: {
      drawCount,
      tableau,
      stock: deck.slice(next),
      waste: [],
      foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    },
    rngState: rng.getState(),
  };
}
