import { createHash } from 'node:crypto';
import { CheckersEngine } from '../engine.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';

test('conserve les actions ordonnées et toutes les transitions de 625 positions de référence P1', () => {
  const engine = new CheckersEngine();
  const hash = createHash('sha256');
  let applications = 0;
  for (let seed = 0; seed < 25; seed++) {
    let state = engine.init({ seed, playerIds: ['p1', 'p2'] });
    for (let turn = 0; turn < 25; turn++) {
      state = freezeInput(JSON.parse(JSON.stringify(state)));
      const snapshot = JSON.stringify(state);
      const player = engine.getCurrentPlayer(state);
      const actions = engine.getValidActions(state, player);
      hash.update(JSON.stringify([state, actions]));
      for (const action of actions) {
        expect(engine.isValidAction(state, freezeInput(action), player)).toBe(true);
        const next = engine.applyAction(state, action, player);
        hash.update(JSON.stringify(next));
        applications++;
      }
      expect(JSON.stringify(state)).toBe(snapshot);
      state = engine.applyAction(state, actions[(seed * 13 + turn * 7) % actions.length], player);
    }
  }
  expect({ applications, digest: hash.digest('hex') }).toEqual({
    applications: 4807, digest: 'f772119806c767a1474f7c3de572c99e45046082540930ad6e28424f6eac458b',
  });
});

test('la victoire prime sur les règles de nullité lors de la quarantième transition', () => {
  const engine = new CheckersEngine();
  const state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });
  state.board = Array.from({ length: 10 }, () => Array(10).fill(null));
  state.board[8][1] = { type: 'pawn', player: 0 };
  state.moveHistory = Array.from({ length: 39 }, () => ({
    from: { row: 2, col: 1 }, to: { row: 3, col: 2 },
  }));
  const next = engine.applyAction(freezeInput(state), {
    type: 'move', from: { row: 8, col: 1 }, to: { row: 9, col: 2 },
  }, 'p1');
  expect(next).toMatchObject({ status: 'won', winner: 0, currentPlayer: 1 });
  expect(next.board[9][2]).toEqual({ type: 'king', player: 0 });
  expect(engine.getValidActions(next, 'p2')).toEqual([]);
});

test('énumère les pièces en ordre ligne puis colonne et ignore les pièces adverses', () => {
  const engine = new CheckersEngine();
  const state = engine.init({ seed: 1, playerIds: ['p1', 'p2'] });
  state.board = Array.from({ length: 10 }, () => Array(10).fill(null));
  state.board[6][5] = { type: 'pawn', player: 0 };
  state.board[6][1] = { type: 'pawn', player: 0 };
  state.board[2][4] = { type: 'pawn', player: 1 };
  state.board[9][0] = { type: 'pawn', player: 0 };
  const snapshot = JSON.stringify(state);
  const froms = engine.getValidActions(freezeInput(state), 'p1')
    .map(({ from, to }) => `${from.row}${from.col}>${to.row}${to.col}`);
  expect(froms).toEqual(['61>72', '61>70', '65>76', '65>74']);
  expect(JSON.stringify(state)).toBe(snapshot);
});
