/**
 * Bots au format du lab : ils ne décident qu'à partir de la vue et des
 * actions légales, de façon reproductible. Le taux de victoire est mesuré sur
 * quelques donnes fixes en CI ; `SOLITAIRE_BENCH=200` lance une mesure large.
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';
import { SolitaireEngine } from '../engine.js';
import { RandomBot } from '../bots/random.js';
import { HeuristicBot } from '../bots/heuristic.js';
import { measureWinRate, playOut } from '../ai/benchmark.js';
import { PLAYER, board, column, stateWith } from './positions.js';

const engine = new SolitaireEngine();

function decide(bot, state, seed = 1) {
  const view = freezeInput(engine.getPlayerView(state, PLAYER));
  return bot.chooseAction(view, freezeInput(engine.getValidActions(state, PLAYER)), new SeededRandom(seed));
}

describe('Bot aléatoire', () => {
  it('choisit une action légale, la même pour la même graine', () => {
    const state = engine.init({ seed: 4 });
    const bot = new RandomBot();
    const action = decide(bot, state, 9);
    expect(engine.isValidAction(state, action, PLAYER)).toBe(true);
    expect(decide(bot, state, 9)).toEqual(action);
    expect(bot).toMatchObject({ name: 'Aléatoire', difficulty: 'easy' });
  });
});

describe('Bot heuristique', () => {
  it('joue le coup de l\'indice et en garde l\'explication', () => {
    const bot = new HeuristicBot();
    bot.onGameStart(PLAYER, {});
    const state = stateWith(board({ tableau: [column(['KS'])], waste: ['AH'], stock: ['2C'] }));
    expect(decide(bot, state)).toEqual({ type: 'move', from: 'waste', to: 'foundation-1', count: 1 });
    expect(bot.lastHint.explanation).toMatch(/^Monte l’as de cœur/);
  });

  it('ignore les cartes cachées : deux états à la même vue donnent le même choix', () => {
    const state = engine.init({ seed: 12 });
    const twin = structuredClone(state);
    twin.board.stock.reverse();
    twin.board.tableau[5].down.reverse();
    expect(decide(new HeuristicBot(), twin)).toEqual(decide(new HeuristicBot(), state));
  });

  it('pioche, puis joue au hasard, quand il se déclare bloqué', () => {
    const bot = new HeuristicBot();
    const stale = stateWith(board({ tableau: [column(['KS'])], stock: ['2C'] }), { stalePasses: 1 });
    expect(decide(bot, stale)).toEqual({ type: 'draw' });
    expect(bot.lastHint.kind).toBe('blocked');
    const choices = [{ type: 'move', from: 'tableau-0', to: 'tableau-1', count: 1 }];
    const view = engine.getPlayerView(stale, PLAYER);
    expect(bot.chooseAction(view, choices, new SeededRandom(1))).toEqual(choices[0]);
  });

  it('oublie ses positions mémorisées à chaque nouvelle partie', () => {
    const bot = new HeuristicBot();
    const state = engine.init({ seed: 2 });
    const first = decide(bot, state);
    bot.onGameStart(PLAYER, {});
    expect(bot.lastHint).toBeNull();
    expect(decide(bot, state)).toEqual(first);
  });
});

describe('Taux de victoire (donnes fixes)', () => {
  it('rejoue une partie gagnée par le bot de façon identique', () => {
    const first = playOut(new HeuristicBot(), { seed: 1, drawCount: 1 });
    expect(first.won).toBe(true);
    expect(playOut(new HeuristicBot(), { seed: 1, drawCount: 1 })).toEqual(first);
  });

  it('gagne des donnes de référence et bat nettement le hasard', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const heuristic = measureWinRate(() => new HeuristicBot(), { seeds, drawCount: 1 });
    const random = measureWinRate(() => new RandomBot(), { seeds, drawCount: 1, maxActions: 300 });
    expect(heuristic.wonSeeds).toEqual([1, 3, 4]);
    expect(random.wins).toBe(0);
  });

  it('s\'arrête au plafond d\'actions', () => {
    expect(playOut(new RandomBot(), { seed: 1, drawCount: 3, maxActions: 5 }).actions).toBe(5);
  });

  const sample = Number(process.env.SOLITAIRE_BENCH ?? 0);
  (sample > 0 ? it : it.skip)(`mesure large hors CI sur ${sample} donnes`, () => {
    const seeds = Array.from({ length: sample }, (_, index) => index + 1);
    for (const drawCount of [1, 3]) {
      const result = measureWinRate(() => new HeuristicBot(), { seeds, drawCount });
      console.log(`Pioche ${drawCount} : ${result.wins}/${result.games} donnes gagnées (${(100 * result.rate).toFixed(1)} %)`);
    }
  }, 3_600_000);
});
