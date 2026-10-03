import { TicTacToeEngine } from '../games/tictactoe/engine.js';
import { CheckersEngine } from '../games/checkers/engine.js';
import { Go9x9Engine } from '../games/go-9x9/engine.js';
import { MastermindEngine } from '../games/mastermind/engine.js';
import { TetrisEngine } from '../games/tetris/engine.js';
import { TriominoEngine } from '../games/triomino/engine';
import { exerciseEngineContract, freezeInput } from './__tests__/engine-contract-helpers.js';

const multiplayer = { seed: 42, playerIds: ['p1', 'p2'] };
const fullView = (engine, state) => {
  expect(engine.getPlayerView(state, engine.getCurrentPlayer(state))).toEqual(state);
};

const fixtures = [
  {
    name: 'Morpion', engine: new TicTacToeEngine(), config: multiplayer,
    assertView: fullView,
    invalidActions: () => [{ type: 'place', position: '0' }, { type: 'place', position: 0.5 }],
    finish(engine, state) {
      for (const position of [0, 3, 1, 4, 2]) {
        state = engine.applyAction(state, { type: 'place', position }, engine.getCurrentPlayer(state));
      }
      return { state, winners: ['p1'], player: 'p1' };
    },
  },
  {
    name: 'Dames', engine: new CheckersEngine(), config: multiplayer,
    assertView: fullView,
    invalidActions: (state) => [
      { ...new CheckersEngine().getValidActions(state, 'p1')[0], type: 'UNKNOWN' },
      { type: 'move', from: {}, to: {} },
    ],
    finish(engine, state) {
      state.board = Array.from({ length: 10 }, () => Array(10).fill(null));
      state.board[4][3] = { type: 'pawn', player: 0 };
      state.board[5][4] = { type: 'pawn', player: 1 };
      state = engine.applyAction(freezeInput(state), engine.getValidActions(state, 'p1')[0], 'p1');
      return { state, winners: ['p1'], player: 'p2' };
    },
  },
  {
    name: 'Go', engine: new Go9x9Engine(), config: multiplayer,
    assertView: fullView,
    invalidActions: () => [
      { type: 'place', x: '0', y: 0 }, { type: 'place', x: 0, y: 0.5 },
      { type: 'place', x: -1, y: 0 },
    ],
    finish(engine, state) {
      return {
        state: engine.applyAction(state, { type: 'resign' }, 'p1'),
        winners: ['p2'], player: 'p1',
      };
    },
  },
  {
    name: 'Mastermind', engine: new MastermindEngine(), config: { seed: 42, playerId: 'p1' },
    assertView(engine, state) {
      const view = engine.getPlayerView(state, 'p1');
      expect(view.secretCode).toBeNull();
      expect(view.attempts).toEqual(state.attempts);
    },
    invalidActions: () => [
      { type: 'submit', code: [] }, { type: 'submit', code: Array(4) },
      { type: 'reset' },
    ],
    finish(engine, state) {
      return {
        state: engine.applyAction(state, { type: 'submit', code: state.secretCode }, 'p1'),
        winners: ['p1'], player: 'p1',
      };
    },
  },
  {
    name: 'Tetris', engine: new TetrisEngine(), config: { seed: 42, playerIds: ['p1'] },
    assertView: fullView,
    invalidActions: () => [{ type: 'tick' }, { type: 'tick', delta: -1 }],
    finish(engine, state) {
      for (let count = 0; count < 100 && !engine.isGameOver(state); count++) {
        state = engine.applyAction(state, { type: 'hardDrop' }, 'p1');
      }
      return { state, winners: null, player: 'p1' };
    },
  },
  {
    name: 'Triomino', engine: new TriominoEngine(),
    config: { ...multiplayer, mode: 'standard' },
    assertView(engine, state) {
      for (const player of state.players) {
        const view = engine.getPlayerView(state, player.id);
        expect(view.myRack).toEqual(player.rack);
        expect(view).not.toHaveProperty('players');
        expect(view).not.toHaveProperty('drawPile');
        expect(view.opponentRackSizes).toEqual(
          Object.fromEntries(state.players.filter((p) => p.id !== player.id).map((p) => [p.id, p.rack.length])),
        );
      }
    },
    invalidActions: (state) => [{
      type: 'PLACE', triominoId: state.players[state.currentPlayerIndex].rack[0].id,
    }],
    finish(engine, state) {
      const player = engine.getCurrentPlayer(state);
      state.players[state.currentPlayerIndex].rack = [state.players[state.currentPlayerIndex].rack[0]];
      state = engine.applyAction(freezeInput(state), engine.getValidActions(state, player)[0], player);
      return { state, winners: [player], player };
    },
  },
];

fixtures.forEach(exerciseEngineContract);

describe('Conventions spécifiques compatibles', () => {
  it('Go expose les scores canoniques par ID sans migrer les scores JSON par couleur', () => {
    const engine = new Go9x9Engine();
    let state = engine.init(multiplayer);
    expect(engine.getScores(state)).toBeNull();
    state = engine.applyAction(state, { type: 'pass' }, 'p1');
    state = engine.applyAction(state, { type: 'pass' }, 'p2');
    const restored = JSON.parse(JSON.stringify(state));
    const snapshot = JSON.stringify(restored);
    expect(engine.getScores(freezeInput(restored))).toEqual({
      p1: state.scores.black, p2: state.scores.white,
    });
    expect(restored.scores).toEqual({ black: 0, white: 6.5 });
    expect(JSON.stringify(restored)).toBe(snapshot);
  });

  it('Dames expose un match nul restauré sans convertir les champs historiques', () => {
    const engine = new CheckersEngine();
    const state = freezeInput({ ...engine.init(multiplayer), status: 'draw', winner: null });
    expect(engine.isGameOver(state)).toBe(true);
    expect(engine.getWinners(state)).toBeNull();
    expect(engine.getCurrentPlayer(state)).toBeNull();
    expect(state.status).toBe('draw');
    expect(state.currentPlayer).toBe(0);
  });

  it('Triomino conserve getLegalActions comme alias exact, y compris après JSON', () => {
    const engine = new TriominoEngine();
    const state = engine.init({ ...multiplayer, mode: 'standard' });
    const player = engine.getCurrentPlayer(state);
    expect(engine.getValidActions(state, player)).toEqual(engine.getLegalActions(state, player));
  });

  it('Triomino cache aussi la dernière tuile piochée à l’adversaire', () => {
    const engine = new TriominoEngine();
    const state = engine.init({ ...multiplayer, mode: 'standard' });
    const player = engine.getCurrentPlayer(state);
    const other = state.players.find((p) => p.id !== player).id;
    const next = engine.applyAction(freezeInput(state), { type: 'DRAW' }, player);
    expect(engine.getPlayerView(next, player).lastDrawnTile).toEqual(next.lastDrawnTile);
    expect(engine.getPlayerView(next, other).lastDrawnTile).toBeNull();
    expect(() => engine.getPlayerView(next, 'intruder')).toThrow('Joueur inconnu');
  });

  it('Mastermind énumère les 1296 guesses, jamais un template ni un reset sans seed', () => {
    const engine = new MastermindEngine();
    const state = engine.init({ seed: 42, playerId: 'p1' });
    const actions = engine.getValidActions(state, 'p1');
    expect(actions).toHaveLength(1296);
    expect(new Set(actions.map((action) => action.code.join(''))).size).toBe(1296);
    expect(actions[0]).toEqual({ type: 'submit', code: ['R', 'R', 'R', 'R'] });
    expect(actions.at(-1)).toEqual({ type: 'submit', code: ['V', 'V', 'V', 'V'] });
    expect(actions.every((action) => engine.isValidAction(state, action, 'p1'))).toBe(true);
    const ended = engine.applyAction(state, { type: 'submit', code: state.secretCode }, 'p1');
    expect(engine.getPlayerView(ended, 'p1').secretCode).toEqual(state.secretCode);
    expect(engine.getValidActions(ended, 'p1')).toEqual([]);
  });
});
