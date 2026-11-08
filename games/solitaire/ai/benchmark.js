/**
 * Mesure reproductible du taux de victoire d'un bot sur des donnes fixes.
 *
 * Le bot ne voit que `getPlayerView`. Une partie s'arrête sur victoire, quand
 * le bot se déclare bloqué (`lastHint.kind === 'blocked'`), quand le moteur ne
 * propose plus aucune action, ou au-delà d'un plafond d'actions.
 *
 * @module games/solitaire/ai/benchmark
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import { SolitaireEngine } from '../engine.js';

/** Plafond d'actions par partie : une partie gagnée en compte rarement plus de 300. */
export const MAX_ACTIONS = 1500;

/**
 * Joue une donne jusqu'au bout avec un bot.
 * @param {object} bot - Bot du lab (`chooseAction`, `onGameStart` optionnel)
 * @param {{seed: number, drawCount: 1|3, maxActions?: number}} game
 * @returns {{won: boolean, actions: number, state: import('../engine.js').SolitaireState}}
 */
export function playOut(bot, { seed, drawCount, maxActions = MAX_ACTIONS }) {
  const engine = new SolitaireEngine();
  let state = engine.init({ seed, options: { drawCount } });
  const player = engine.getCurrentPlayer(state);
  const rng = new SeededRandom(seed);
  bot.onGameStart?.(player, { seed, drawCount });
  let actions = 0;
  while (!engine.isGameOver(state) && actions < maxActions) {
    const action = bot.chooseAction(engine.getPlayerView(state, player), engine.getValidActions(state, player), rng);
    if (bot.lastHint?.kind === 'blocked') {
      break;
    }
    state = engine.applyAction(state, action, player);
    actions++;
  }
  return { won: engine.getWinners(state) !== null, actions, state };
}

/**
 * Taux de victoire sur une liste de donnes.
 * @param {() => object} createBot - Fabrique d'un bot neuf par partie
 * @param {{seeds: number[], drawCount: 1|3, maxActions?: number}} batch
 * @returns {{games: number, wins: number, rate: number, wonSeeds: number[]}}
 */
export function measureWinRate(createBot, { seeds, drawCount, maxActions }) {
  const wonSeeds = seeds.filter(seed => playOut(createBot(), { seed, drawCount, maxActions }).won);
  return { games: seeds.length, wins: wonSeeds.length, rate: wonSeeds.length / seeds.length, wonSeeds };
}
