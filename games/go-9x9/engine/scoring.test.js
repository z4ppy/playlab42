import { Go9x9Engine } from '../engine.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';

const config = { seed: 42, playerIds: ['black', 'white'], manualScoring: true };
const engine = new Go9x9Engine();

function review(first = 'black') {
  let state = engine.init(config);
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      if (x === 0 || x === 8 || y === 0 || y === 8) { state.board[y][x] = 1; }
    }
  }
  state.board[4][4] = 2;
  state.board[4][5] = 2;
  state.currentPlayerId = first;
  state = engine.applyAction(freezeInput(state), { type: 'pass' }, first);
  return engine.applyAction(freezeInput(state), { type: 'pass' }, state.currentPlayerId);
}

test('la page peut demander une revue sans changer le scoring automatique par défaut', () => {
  const automatic = engine.init({ seed: 42, playerIds: ['black', 'white'] });
  expect(automatic).not.toHaveProperty('manualScoring');
  expect(automatic).not.toHaveProperty('deadStones');
  let state = engine.init(config);
  expect(state.scoring).toBe(false);
  state = engine.applyAction(state, { type: 'pass' }, 'black');
  expect(state.scoring).toBe(false);
  state = engine.applyAction(state, { type: 'pass' }, 'white');
  expect(state).toMatchObject({ scoring: true, gameOver: false, scores: null, winners: null, deadStones: [] });
  expect(engine.isGameOver(state)).toBe(false);
  expect(engine.getScores(state)).toBeNull();
  for (const player of state.playerIds) {
    expect(engine.getValidActions(state, player)).toEqual([]);
    for (const action of [{ type: 'place', x: 4, y: 4 }, { type: 'pass' }, { type: 'resign' }]) {
      expect(engine.isValidAction(state, action, player)).toBe(false);
      expect(() => engine.applyAction(state, action, player)).toThrow('Invalid action');
    }
  }
});

test('le marquage bascule le groupe entier et reste réversible sans muter le plateau', () => {
  const state = freezeInput(review());
  const marked = engine.toggleDeadGroup(state, 4, 4);
  expect(marked.deadStones).toEqual([40, 41]);
  expect(state.deadStones).toEqual([]);
  expect(marked.board).toEqual(state.board);
  expect(marked.captures).toEqual(state.captures);
  const alive = engine.toggleDeadGroup(freezeInput(marked), 5, 4);
  expect(alive.deadStones).toEqual([]);
  expect(marked.deadStones).toEqual([40, 41]);
  const both = engine.toggleDeadGroup(freezeInput(marked), 0, 0);
  expect(both.deadStones).toHaveLength(34);
  const onlyBlack = engine.toggleDeadGroup(both, 4, 4);
  expect(onlyBlack.deadStones).toHaveLength(32);
  expect(onlyBlack.deadStones).not.toContain(40);
});

test('des groupes distincts de même couleur ne sont pas marqués ensemble', () => {
  const base = engine.init(config);
  base.board[0][0] = 2;
  base.board[4][4] = 2;
  base.board[4][5] = 2;
  let state = engine.applyAction(base, { type: 'pass' }, 'black');
  state = engine.applyAction(state, { type: 'pass' }, 'white');
  expect(engine.toggleDeadGroup(state, 4, 4).deadStones).toEqual([40, 41]);
});

test.each([
  ['4', 4], [NaN, 4], [9, 4], [-1, 4], [4.5, 4],
  [4, '4'], [4, NaN], [4, 9], [4, -1], [4, 4.5], [3, 3],
])('refuse un marquage invalide (%s, %s) sans modifier la revue', (x, y) => {
  const state = freezeInput(review());
  expect(() => engine.toggleDeadGroup(state, x, y)).toThrow('Choisissez une pierre');
  expect(state.deadStones).toEqual([]);
});

test.each(['toggleDeadGroup', 'confirmScore', 'resumePlay'])('%s refuse les phases de jeu et de fin', method => {
  const state = freezeInput(engine.init(config));
  expect(() => engine[method](state, 0, 0)).toThrow('comptage');
  const ended = freezeInput(engine.applyAction(state, { type: 'resign' }, 'black'));
  expect(() => engine[method](ended, 0, 0)).toThrow('comptage');
  const invalid = freezeInput({ ...review(), gameOver: true });
  expect(() => engine[method](invalid, 0, 0)).toThrow('comptage');
});

test('confirme le score chinois après retrait des seuls groupes marqués sans ajouter de captures', () => {
  const state = freezeInput(engine.toggleDeadGroup(review(), 4, 4));
  const ended = engine.confirmScore(state);
  expect(ended).toMatchObject({
    gameOver: true, scoring: false, currentPlayerId: null,
    scores: { black: 81, white: 6.5 }, winners: ['black'], deadStones: [40, 41],
  });
  expect(engine.getScores(ended)).toEqual({ black: 81, white: 6.5 });
  expect(ended.board).toEqual(state.board);
  expect(ended.captures).toEqual({ black: 0, white: 0 });
  expect(state.scores).toBeNull();
  expect(engine.confirmScore(freezeInput(JSON.parse(JSON.stringify(state))))).toEqual(ended);
});

test('les groupes non marqués restent vivants ; les deux couleurs peuvent être retirées', () => {
  expect(engine.confirmScore(review()).scores).toEqual({ black: 32, white: 8.5 });
  const whiteSurvives = engine.toggleDeadGroup(review(), 0, 0);
  expect(engine.confirmScore(whiteSurvives).scores).toEqual({ black: 0, white: 87.5 });
  const empty = engine.toggleDeadGroup(whiteSurvives, 4, 4);
  expect(engine.confirmScore(empty).scores).toEqual({ black: 0, white: 6.5 });
});

test.each(['black', 'white'])('reprend au joueur suivant %s avec plateau et captures conservés', first => {
  const state = freezeInput(engine.toggleDeadGroup(review(first), 4, 4));
  const resumed = engine.resumePlay(state);
  expect(resumed).toMatchObject({
    scoring: false, gameOver: false, deadStones: [], passesInARow: 0,
    currentPlayerId: first, scores: null,
  });
  expect(resumed.board).toEqual(state.board);
  expect(resumed.captures).toEqual(state.captures);
  expect(engine.isValidAction(resumed, { type: 'place', x: 3, y: 3 }, first)).toBe(true);
  expect(state.deadStones).toEqual([40, 41]);
  expect(state.scoring).toBe(true);
});
