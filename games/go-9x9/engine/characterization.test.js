import { createHash } from 'node:crypto';
import { Go9x9Engine } from '../engine.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';

const config = { seed: 42, playerIds: ['black', 'white'] };
const empty = () => new Go9x9Engine().init(config);
const finish = (engine, state) => {
  const passed = engine.applyAction(freezeInput(state), { type: 'pass' }, state.currentPlayerId);
  return engine.applyAction(passed, { type: 'pass' }, passed.currentPlayerId);
};

test('conserve ordre, légalité et transitions de toutes les actions de 180 positions P1', () => {
  const engine = new Go9x9Engine();
  const hash = createHash('sha256');
  let applications = 0;
  for (let seed = 0; seed < 6; seed++) {
    let state = engine.init({ ...config, seed });
    for (let turn = 0; turn < 30; turn++) {
      state = freezeInput(JSON.parse(JSON.stringify(state)));
      const snapshot = JSON.stringify(state);
      const player = state.currentPlayerId;
      const actions = engine.getValidActions(state, player);
      hash.update(JSON.stringify([state, actions]));
      for (const action of actions) {
        expect(engine.isValidAction(state, freezeInput(action), player)).toBe(true);
        hash.update(JSON.stringify(engine.applyAction(state, action, player)));
        applications++;
      }
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          expect(engine.isValidAction(state, { type: 'place', x, y }, player))
            .toBe(actions.some(action => action.type === 'place' && action.x === x && action.y === y));
        }
      }
      expect(JSON.stringify(state)).toBe(snapshot);
      const placements = actions.filter(action => action.type === 'place');
      state = engine.applyAction(state, placements[(seed * 11 + turn * 7) % placements.length], player);
    }
  }
  expect({ applications, digest: hash.digest('hex') }).toEqual({
    applications: 12329, digest: '1bc3582eb6b46d3fa05fdcaba26a427b62b8771c3e70969a98518df21df4c35f',
  });
});

test.each([
  ['vide', [], { black: 0, white: 6.5 }],
  ['territoire noir seul', [[4, 4, 1]], { black: 81, white: 6.5 }],
  ['territoire blanc seul', [[4, 4, 2]], { black: 0, white: 87.5 }],
  ['région neutre', [[0, 0, 1], [8, 8, 2]], { black: 1, white: 7.5 }],
  ['coin noir et extérieur neutre', [[1, 0, 1], [0, 1, 1], [8, 8, 2]], { black: 3, white: 7.5 }],
])('score chinois : %s', (_label, stones, scores) => {
  const engine = new Go9x9Engine();
  const state = empty();
  for (const [x, y, color] of stones) { state.board[y][x] = color; }
  const next = finish(engine, state);
  expect(next.scores).toEqual(scores);
  expect(engine.getScores(next)).toEqual({ black: scores.black, white: scores.white });
  expect(next.currentPlayerId).toBeNull();
});

test('capture un groupe de deux pierres avant de vérifier les libertés du groupe joué', () => {
  const engine = new Go9x9Engine();
  const state = empty();
  for (const [x, y] of [[0, 0], [1, 0]]) { state.board[y][x] = 2; }
  for (const [x, y] of [[2, 0], [0, 1], [2, 1], [1, 2]]) { state.board[y][x] = 1; }
  const action = freezeInput({ type: 'place', x: 1, y: 1 });
  const next = engine.applyAction(freezeInput(state), action, 'black');
  expect(next.captures.black).toBe(2);
  expect(next.board[0].slice(0, 2)).toEqual([0, 0]);
  expect(next.board[1][1]).toBe(1);
});

test('interdit la reprise immédiate d’un vrai ko puis la permet après une passe', () => {
  const engine = new Go9x9Engine();
  const state = empty();
  for (const [x, y] of [[1, 2], [2, 1], [3, 2]]) { state.board[y][x] = 1; }
  for (const [x, y] of [[2, 2], [1, 3], [3, 3], [2, 4]]) { state.board[y][x] = 2; }
  const captured = engine.applyAction(freezeInput(state), { type: 'place', x: 2, y: 3 }, 'black');
  const recapture = { type: 'place', x: 2, y: 2 };
  expect(captured.captures.black).toBe(1);
  expect(engine.isValidAction(captured, recapture, 'white')).toBe(false);
  expect(engine.getValidActions(captured, 'white')).not.toContainEqual(recapture);
  expect(() => engine.applyAction(captured, recapture, 'white')).toThrow('Invalid action');
  const passed = engine.applyAction(captured, { type: 'pass' }, 'white');
  const elsewhere = engine.applyAction(passed, { type: 'place', x: 8, y: 8 }, 'black');
  expect(engine.isValidAction(elsewhere, recapture, 'white')).toBe(true);
});
