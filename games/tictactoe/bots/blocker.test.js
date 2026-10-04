/**
 * Caractérisation du bot Blocker : priorités, ordre des lignes et trajectoires seedées.
 */

import { createHash } from 'node:crypto';
import { TicTacToeEngine } from '../engine.js';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';
import { BlockerBot } from './blocker.js';
import { RandomBot } from './random.js';

const PLAYERS = ['p1', 'p2'];

function viewOf(cells, symbols = { p1: 'X', p2: 'O' }) {
  return { board: cells.map((cell) => (cell === '.' ? null : cell)), symbols };
}

function actionsFor(view) {
  return view.board
    .map((cell, position) => (cell === null ? { type: 'place', position } : null))
    .filter(Boolean);
}

function choose(cells, playerId = 'p1') {
  const bot = new BlockerBot();
  bot.onGameStart(playerId, {});
  const view = freezeInput(viewOf(cells));
  return bot.chooseAction(view, freezeInput(actionsFor(view)), new SeededRandom(7));
}

describe('BlockerBot', () => {
  it('gagne avant de bloquer', () => {
    expect(choose(['X', 'X', '.', 'O', 'O', '.', '.', '.', '.'])).toEqual({ type: 'place', position: 2 });
  });

  it('bloque quand aucun coup ne gagne', () => {
    expect(choose(['O', 'O', '.', '.', 'X', '.', '.', '.', '.'])).toEqual({ type: 'place', position: 2 });
  });

  it('conserve l\'ordre des lignes quand plusieurs menaces existent', () => {
    // Ligne 3-4-5 déclarée avant la colonne 0-3-6 : la case 5 est choisie.
    expect(choose(['X', 'O', 'O', 'X', 'X', '.', '.', 'O', '.'])).toEqual({ type: 'place', position: 5 });
    // Ligne 0-1-2 avant la diagonale 0-4-8 pour l'adversaire.
    expect(choose(['O', 'O', '.', '.', 'O', 'X', 'X', '.', '.'])).toEqual({ type: 'place', position: 2 });
  });

  it('ignore une ligne menaçante dont la case libre n\'est pas jouable', () => {
    const bot = new BlockerBot();
    bot.onGameStart('p1', {});
    const view = viewOf(['X', 'X', '.', '.', '.', '.', '.', '.', '.']);
    const action = bot.chooseAction(view, [{ type: 'place', position: 8 }], new SeededRandom(1));
    expect(action).toEqual({ type: 'place', position: 8 });
  });

  it('prend le centre puis un coin seedé puis une case seedée', () => {
    expect(choose(['.', '.', '.', '.', '.', '.', '.', '.', '.'])).toEqual({ type: 'place', position: 4 });
    expect(choose(['.', '.', '.', '.', 'O', '.', '.', '.', '.'])).toEqual({ type: 'place', position: 0 });
    expect(choose(['X', '.', 'O', '.', 'O', 'X', 'O', '.', 'X'])).toEqual({ type: 'place', position: 1 });
  });

  it('joue le symbole du bot second joueur sans modifier la vue', () => {
    const bot = new BlockerBot();
    bot.onGameStart('p2', {});
    const view = freezeInput(viewOf(['X', 'X', '.', 'O', 'O', '.', '.', '.', '.']));
    const snapshot = JSON.stringify(view);
    expect(bot.chooseAction(view, freezeInput(actionsFor(view)), new SeededRandom(1)))
      .toEqual({ type: 'place', position: 5 });
    expect(JSON.stringify(view)).toBe(snapshot);
  });

  it('conserve les trajectoires seedées de 60 parties', () => {
    const engine = new TicTacToeEngine();
    const hash = createHash('sha256');
    const results = { p1: 0, p2: 0, draw: 0 };
    for (let seed = 0; seed < 60; seed++) {
      const rng = new SeededRandom(seed);
      const bots = seed % 2 === 0
        ? { p1: new BlockerBot(), p2: new RandomBot() }
        : { p1: new RandomBot(), p2: new BlockerBot() };
      let state = engine.init({ seed, playerIds: PLAYERS });
      for (const id of PLAYERS) { bots[id].onGameStart?.(id, { symbols: state.symbols }); }
      while (!engine.isGameOver(state)) {
        const id = engine.getCurrentPlayer(state);
        const view = freezeInput(JSON.parse(JSON.stringify(engine.getPlayerView(state, id))));
        const action = bots[id].chooseAction(view, engine.getValidActions(state, id), rng);
        hash.update(JSON.stringify(action));
        state = engine.applyAction(state, action, id);
      }
      const winner = engine.getWinners(state);
      results[winner ? winner[0] : 'draw']++;
      hash.update(JSON.stringify(state));
    }
    expect({ results, digest: hash.digest('hex') }).toEqual({
      results: { p1: 30, p2: 25, draw: 5 },
      digest: '0fff15a1b4caabdb5b4fd2c774b03955dbac0a49cbfa31fdcb033c21c7e4e244',
    });
  });
});
