/**
 * Tests des bots : choix parmi les actions valides, déterminisme et décisions
 * prises uniquement à partir de la vue joueur.
 */
import { RandomBot } from './random.js';
import { SolverBot } from './solver.js';
import { MinesweeperEngine } from '../engine.js';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';
import { drawView } from '../__tests__/boards.js';

const engine = new MinesweeperEngine();
const P = 'p1';

/**
 * Fait jouer un bot jusqu'à la fin de la partie.
 * @param {object} bot - Bot du jeu.
 * @param {object} config - Configuration du moteur.
 * @param {number} seed - Seed du générateur du bot.
 * @returns {{state: object, moves: object[]}}
 */
function playOut(bot, config, seed) {
  const rng = new SeededRandom(seed);
  let state = engine.init({ playerIds: [P], ...config });
  const moves = [];
  while (!engine.isGameOver(state)) {
    const view = freezeInput(engine.getPlayerView(state, P));
    const action = bot.chooseAction(view, freezeInput(engine.getValidActions(state, P)), rng);
    moves.push(action);
    state = engine.applyAction(state, action, P);
  }
  return { state, moves };
}

describe('RandomBot', () => {
  it('ouvre une case fermée sans drapeau, au hasard mais de façon reproductible', () => {
    const bot = new RandomBot();
    const actions = [{ type: 'toggleFlag', index: 1 }, { type: 'reveal', index: 2 }, { type: 'reveal', index: 3 }];
    const first = bot.chooseAction(null, actions, new SeededRandom(5));
    expect(first.type).toBe('reveal');
    expect(bot.chooseAction(null, actions, new SeededRandom(5))).toBe(first);
  });

  it('se rabat sur les autres actions s\'il n\'y a plus rien à ouvrir', () => {
    const actions = [{ type: 'toggleFlag', index: 1 }];
    expect(new RandomBot().chooseAction(null, actions, new SeededRandom(1))).toBe(actions[0]);
  });

  it('joue une partie complète sans action invalide', () => {
    const { state, moves } = playOut(new RandomBot(), { seed: 8 }, 8);
    expect(engine.isGameOver(state)).toBe(true);
    expect(moves.every(move => move.type === 'reveal')).toBe(true);
  });

  it('expose les métadonnées du contrat Bot', () => {
    expect(new RandomBot()).toMatchObject({ name: 'Hasard', difficulty: 'easy', description: expect.any(String) });
    expect(new SolverBot()).toMatchObject({ name: 'Solveur', difficulty: 'expert', description: expect.any(String) });
  });
});

describe('SolverBot', () => {
  it.each([
    ['beginner', 1], ['beginner', 2], ['intermediate', 3], ['intermediate', 4],
  ])('gagne une grille sans hasard (%s, seed %i) sans jamais parier', (level, seed) => {
    const bot = new SolverBot();
    const rng = new SeededRandom(seed);
    let state = engine.init({ seed, level, playerIds: [P] });
    const kinds = new Set();
    while (!engine.isGameOver(state)) {
      const view = engine.getPlayerView(state, P);
      const decision = bot.decide(view, rng);
      kinds.add(decision.kind);
      expect(decision.reason.length).toBeGreaterThan(20);
      state = engine.applyAction(state, decision.action, P);
    }
    expect(engine.getWinners(state)).toEqual([P]);
    expect(kinds.has('guess')).toBe(false);
  });

  it('est déterministe pour une même seed, y compris en mode classique', () => {
    const config = { seed: 12, level: 'intermediate', noGuess: false };
    expect(playOut(new SolverBot(), config, 99)).toEqual(playOut(new SolverBot(), config, 99));
  });

  it('gagne bien plus souvent que le hasard en mode classique', () => {
    let solverWins = 0;
    let randomWins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const config = { seed, noGuess: false };
      if (engine.getWinners(playOut(new SolverBot(), config, seed).state)) { solverWins += 1; }
      if (engine.getWinners(playOut(new RandomBot(), config, seed).state)) { randomWins += 1; }
    }
    expect(solverWins).toBeGreaterThanOrEqual(8);
    expect(randomWins).toBeLessThan(solverWins);
  });

  it('décide à partir de la seule vue : deux grilles de même apparence donnent le même coup', () => {
    // Même chiffres visibles, mines cachées différentes : « * o . » contre « . o * ».
    const left = drawView('* o .').view;
    const right = drawView('. o *').view;
    expect(left).toEqual(right);
    const bot = new SolverBot();
    const actions = [{ type: 'reveal', index: 0 }, { type: 'reveal', index: 2 }];
    expect(bot.chooseAction(left, actions, new SeededRandom(3))).toEqual(bot.chooseAction(right, actions, new SeededRandom(3)));
  });

  it('départage les paris à égalité avec le générateur fourni', () => {
    const view = drawView('. o *').view;
    const picks = new Set();
    for (let seed = 1; seed <= 20; seed++) { picks.add(new SolverBot().decide(view, new SeededRandom(seed)).index); }
    expect(picks).toEqual(new Set([0, 2]));
  });

  it('transmet les étiquettes de la page à l\'explication', () => {
    const view = drawView('* o .\no o .').view;
    expect(new SolverBot().decide(view, new SeededRandom(1), { label: () => 'ici' }).reason).toContain('en ici');
  });

  it('signale un conseil absent des actions valides au lieu de jouer autre chose', () => {
    const view = drawView('* o .\no o .').view;
    expect(() => new SolverBot().chooseAction(view, [{ type: 'reveal', index: 0 }], new SeededRandom(1)))
      .toThrow('Coup du solveur refusé');
  });
});
