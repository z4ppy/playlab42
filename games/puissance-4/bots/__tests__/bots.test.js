/**
 * Bots : contrat du lab (vue + actions + RNG), règles de chaque niveau,
 * reproductibilité et tournois à graines fixes qui mesurent la force.
 */

import { SeededRandom } from '../../../../lib/seeded-random.js';
import { freezeInput } from '../../../../lib/__tests__/engine-contract-helpers.js';
import { engine, randomState, stateAfter } from '../../ai/__tests__/helpers.js';
import { GreedyBot } from '../greedy.js';
import { LEVELS, isLevel } from '../levels.js';
import { MinimaxBot } from '../minimax.js';
import { RandomBot } from '../random.js';

/**
 * Budget réduit (≈ 0,1 s par coup) pour garder les tournois rapides ; le niveau
 * Expert en a cinq fois plus. Mesuré : à 50 000 nœuds, Minimax perd encore deux
 * parties sur trois en second joueur contre Greedy ; à 150 000, il gagne tout.
 */
const TOURNAMENT_BUDGET = { maxNodes: 150_000 };

/** Fait choisir un bot depuis la vue gelée du joueur au trait. */
function choose(bot, state, seed = 1) {
  const view = freezeInput(engine.getPlayerView(state, state.currentPlayerId));
  const actions = freezeInput(engine.getValidActions(state, state.currentPlayerId));
  const action = bot.chooseAction(view, actions, new SeededRandom(seed));
  expect(actions).toContain(action);
  return action.column;
}

/**
 * Partie complète entre deux bots ; renvoie la couleur gagnante ou null (nul).
 * @param {object} red - Bot de Rouge (premier joueur)
 * @param {object} yellow - Bot de Jaune
 * @param {number} seed - Graine du RNG partagé
 */
function playMatch(red, yellow, seed) {
  const rng = new SeededRandom(seed);
  const bots = { rouge: red, jaune: yellow };
  let state = engine.init({ seed, playerIds: ['rouge', 'jaune'] });
  while (!state.gameOver) {
    const player = state.currentPlayerId;
    const action = bots[player].chooseAction(engine.getPlayerView(state, player), engine.getValidActions(state, player), rng);
    state = engine.applyAction(state, action, player);
  }
  return state.winners?.[0] ?? null;
}

describe('RandomBot', () => {
  it('joue une colonne légale, reproductible à graine égale', () => {
    const bot = new RandomBot();
    const state = stateAfter('4444');
    expect(choose(bot, state, 9)).toBe(choose(bot, state, 9));
    const seen = new Set(Array.from({ length: 30 }, (_, seed) => choose(bot, state, seed)));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('GreedyBot', () => {
  const bot = new GreedyBot();

  it('gagne quand il le peut, avant de bloquer', () => {
    // Rouge au trait : gain en colonne 4 ; Jaune menace aussi la colonne 7 (trois en colonne 7).
    expect(choose(bot, stateAfter('172737'))).toBe(3);
  });

  it('bloque la victoire adverse immédiate', () => {
    expect(choose(bot, stateAfter('11223'))).toBe(3);
  });

  it('évite de jouer sous une case gagnante adverse', () => {
    expect(choose(bot, stateAfter('2113372'))).not.toBe(3);
  });

  it('préfère le centre sans menace, puis départage les colonnes voisines au hasard', () => {
    expect(choose(bot, stateAfter(''))).toBe(3);
    const full = stateAfter('444444');
    const picks = new Set(Array.from({ length: 20 }, (_, seed) => choose(bot, full, seed)));
    expect(picks).toEqual(new Set([2, 4]));
  });

  it('joue quand même si tous les coups sont dangereux', () => {
    // Jaune face à une double menace imparable : il doit tout de même jouer.
    expect(typeof choose(bot, stateAfter('33445'))).toBe('number');
    // Seule la colonne 4, piégée, est proposée : le bot la joue faute de mieux.
    const state = stateAfter('2113372');
    const only = [{ type: 'drop', column: 3 }];
    expect(bot.chooseAction(state, only, new SeededRandom(1))).toBe(only[0]);
  });
});

describe('MinimaxBot', () => {
  const bot = new MinimaxBot(TOURNAMENT_BUDGET);

  it('respecte le contrat Bot et expose ses métadonnées', () => {
    expect(bot).toMatchObject({ name: 'Minimax', difficulty: 'expert' });
    expect(new MinimaxBot().budget.maxNodes).toBeGreaterThan(TOURNAMENT_BUDGET.maxNodes);
  });

  it('trouve la double menace et la justifie', () => {
    const state = stateAfter('4433');
    const { action, analysis } = bot.chooseWithAnalysis(state, engine.getValidActions(state, state.currentPlayerId), new SeededRandom(3));
    expect([1, 4]).toContain(action.column);
    expect(analysis.forced).toEqual({ winner: 'self', inMoves: 2 });
  });

  it('ne laisse jamais un gain immédiat évitable à l\'adversaire', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = randomState(seed, 8 + (seed % 20));
      if (state.gameOver) {
        continue;
      }
      const after = engine.applyAction(state, { type: 'drop', column: choose(bot, state, seed) }, state.currentPlayerId);
      if (after.gameOver) {
        continue;
      }
      const opponentWins = engine.getValidActions(after, after.currentPlayerId)
        .some((action) => engine.applyAction(after, action, after.currentPlayerId).winners);
      // Une victoire adverse n'est tolérée que si elle était inévitable.
      if (opponentWins) {
        const avoidable = engine.getValidActions(state, state.currentPlayerId).some((action) => {
          const alternative = engine.applyAction(state, action, state.currentPlayerId);
          return alternative.gameOver || !engine.getValidActions(alternative, alternative.currentPlayerId)
            .some((reply) => engine.applyAction(alternative, reply, alternative.currentPlayerId).winners);
        });
        expect(avoidable).toBe(false);
      }
    }
  });

  it('se replie sur les actions proposées si aucune n\'est parmi les meilleures', () => {
    const state = stateAfter('4433');
    const others = [{ type: 'drop', column: 6 }];
    expect(bot.chooseAction(state, others, new SeededRandom(1))).toBe(others[0]);
  });

  it('rejoue exactement la même partie à graine égale', () => {
    expect(playMatch(bot, new GreedyBot(), 5)).toBe(playMatch(bot, new GreedyBot(), 5));
  });
});

describe('Tournois à graines fixes (force mesurée)', () => {
  /** Bilan d'une série alternant les couleurs. */
  function series(strong, weak, seeds) {
    const results = { wins: 0, draws: 0, losses: 0 };
    seeds.forEach((seed, index) => {
      const strongIsRed = index % 2 === 0;
      const winner = strongIsRed ? playMatch(strong, weak, seed) : playMatch(weak, strong, seed);
      const strongColor = strongIsRed ? 'rouge' : 'jaune';
      if (winner === null) {
        results.draws++;
      } else if (winner === strongColor) {
        results.wins++;
      } else {
        results.losses++;
      }
    });
    return results;
  }

  it('Minimax bat Random dans toutes les parties', () => {
    expect(series(new MinimaxBot(TOURNAMENT_BUDGET), new RandomBot(), [1, 2, 3, 4, 5, 6])).toEqual({ wins: 6, draws: 0, losses: 0 });
  }, 30_000);

  it('Minimax bat Greedy dans toutes les parties, Rouge comme Jaune', () => {
    expect(series(new MinimaxBot(TOURNAMENT_BUDGET), new GreedyBot(), [11, 12, 13, 14, 15, 16])).toEqual({ wins: 6, draws: 0, losses: 0 });
  }, 60_000);

  it('Greedy bat largement Random', () => {
    const results = series(new GreedyBot(), new RandomBot(), Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(results.wins).toBeGreaterThanOrEqual(18);
  });
});

describe('niveaux de l\'interface', () => {
  it('associe chaque niveau à un bot fonctionnel', () => {
    const state = stateAfter('44');
    for (const [id, level] of Object.entries(LEVELS)) {
      expect(isLevel(id)).toBe(true);
      expect(typeof choose(level.create(), state)).toBe('number');
    }
    expect(isLevel('impossible')).toBe(false);
    expect(isLevel('toString')).toBe(false);
  });
});
