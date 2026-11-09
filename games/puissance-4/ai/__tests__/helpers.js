/**
 * Outils partagés par les tests de l'IA : positions écrites comme des suites
 * de colonnes (1 à 7) et parties aléatoires reproductibles.
 */

import { SeededRandom } from '../../../../lib/seeded-random.js';
import { Puissance4Engine } from '../../engine.js';
import { positionFromView } from '../bitboard.js';

export const engine = new Puissance4Engine();
export const PLAYERS = ['rouge', 'jaune'];

/**
 * État du moteur après une suite de colonnes 1-7 (« 4453 »).
 * @param {string} sequence - Colonnes jouées, joueurs en alternance (Rouge d'abord)
 * @returns {import('../../engine.js').Puissance4State}
 */
export function stateAfter(sequence) {
  return [...sequence].reduce(
    (state, digit) => engine.applyAction(state, { type: 'drop', column: Number(digit) - 1 }, state.currentPlayerId),
    engine.init({ seed: 1, playerIds: PLAYERS }),
  );
}

/**
 * Bitboards du joueur au trait après une suite de colonnes.
 * @param {string} sequence - Colonnes jouées
 * @returns {import('../bitboard.js').BitPosition}
 */
export const positionAfter = (sequence) => positionFromView(stateAfter(sequence));

/**
 * Partie aléatoire reproductible arrêtée après `stones` jetons (ou à la fin).
 * @param {number} seed - Graine
 * @param {number} stones - Nombre de jetons visé
 * @returns {import('../../engine.js').Puissance4State}
 */
export function randomState(seed, stones) {
  const rng = new SeededRandom(seed);
  let state = engine.init({ seed, playerIds: PLAYERS });
  while (!state.gameOver && state.moves.length < stones) {
    state = engine.applyAction(state, rng.pick(engine.getValidActions(state, state.currentPlayerId)), state.currentPlayerId);
  }
  return state;
}
