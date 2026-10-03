import {
  TriominoEngine, generateAllTiles, isValidPlacement,
  type Board, type GameMode, type PlaceAction, type Position,
  type Triomino, type TriominoAction, type TriominoState,
} from '../engine';

const engine = new TriominoEngine();
const modes: GameMode[] = ['standard', 'simplified', 'kids'];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const pos = (seqX: number, row: number): Position => ({
  col: Math.floor(seqX / 2), row, orientation: seqX % 2 === 0 ? 'UP' : 'DOWN',
});
const key = (position: Position): string => `${position.col},${position.row},${position.orientation}`;
function tile(values: [number, number, number]): Triomino {
  const sorted = [...values].sort((a, b) => a - b);
  const found = generateAllTiles().find(candidate =>
    candidate.values.every((value, index) => value === sorted[index]));
  if (!found) throw new Error('Tuile inconnue');
  return found;
}
function state(mode: GameMode, board: Board = {}): TriominoState {
  return {
    ...engine.init({ mode, playerIds: ['alice', 'bob'], seed: 42 }),
    board, currentPlayerIndex: 0, drawPile: [tile([5, 5, 5])],
    players: [
      { id: 'alice', rack: [tile([1, 2, 5]), tile([1, 3, 4]), tile([0, 2, 4])], score: 0 },
      { id: 'bob', rack: [tile([0, 0, 0])], score: 0 },
    ],
  };
}

describe.each(modes)('Responsabilités publiques Triomino : %s', mode => {
  test.each([
    [0, 0], [1, 0], [-1, 0], [-2, -1], [2, 1], [-3, -2],
  ])('les trois côtés correspondent en seqX=%i, row=%i, sans réflexion', (sx, row) => {
    const position = pos(sx, row);
    const board: Board = {
      [key(position)]: { position, triomino: tile([1, 2, 4]), placed: [1, 2, 4] },
    };
    const initial = state(mode, board);
    const before = copy(initial);
    const baseRow = row + (((sx + row) % 2 === 0) ? 1 : -1);
    const placements: PlaceAction[] = [
      { type: 'PLACE', triominoId: tile([1, 2, 5]).id, position: pos(sx - 1, row), placed: [2, 5, 1] },
      { type: 'PLACE', triominoId: tile([1, 3, 4]).id, position: pos(sx + 1, row), placed: [4, 1, 3] },
      { type: 'PLACE', triominoId: tile([0, 2, 4]).id, position: pos(sx, baseRow), placed: [0, 2, 4] },
    ];
    const legal = engine.getValidActions(initial, 'alice');
    expect(legal).toEqual(engine.getLegalActions(initial, 'alice'));
    for (const action of placements) {
      expect(legal).toContainEqual(action);
      expect(engine.isValidAction(initial, action, 'alice')).toBe(true);
      const next = engine.applyAction(initial, action, 'alice');
      expect(next.board[key(action.position)].placed).toEqual(action.placed);
      expect(next.players[0].score).toBe(mode === 'kids' ? 0
        : mode === 'simplified' ? 1 : action.placed.reduce((sum, value) => sum + value, 0));
      const reflected = { ...action, placed: [action.placed[0], action.placed[2], action.placed[1]] };
      expect(engine.isValidAction(initial, reflected as PlaceAction, 'alice')).toBe(false);
      expect(initial).toEqual(before);
    }
    expect(isValidPlacement(board, pos(sx, baseRow), [0, 4, 2], false)).toBe(false);
  });

  test('ordonne les rotations distinctes, puis DRAW et PASS après trois tirages', () => {
    let current = state(mode);
    current.players[0].rack = [tile([1, 2, 3]), tile([2, 2, 2])];
    current.drawPile = [tile([0, 0, 1]), tile([0, 0, 2]), tile([0, 0, 3])];
    expect(engine.getValidActions(current, 'alice')).toEqual([
      ...[[1, 2, 3], [2, 3, 1], [3, 1, 2]].map(placed => ({
        type: 'PLACE', triominoId: tile([1, 2, 3]).id, position: pos(0, 0), placed,
      })),
      { type: 'PLACE', triominoId: tile([2, 2, 2]).id, position: pos(0, 0), placed: [2, 2, 2] },
      { type: 'DRAW' },
    ]);
    for (let draw = 1; draw <= 3; draw++) {
      const before = copy(current);
      const next = engine.applyAction(current, { type: 'DRAW' }, 'alice');
      expect(current).toEqual(before);
      expect(next).toEqual(engine.applyAction(copy(current), { type: 'DRAW' }, 'alice'));
      expect(engine.getPlayerView(next, 'alice').lastDrawnTile).toEqual(before.drawPile.at(-1));
      const opponent = engine.getPlayerView(next, 'bob');
      expect(opponent.lastDrawnTile).toBeNull();
      expect(opponent.opponentRackSizes).toEqual({ alice: 2 + draw });
      expect(opponent).not.toHaveProperty('drawPile');
      current = next;
    }
    expect(current.players[0].score).toBe(mode === 'kids' ? 0 : -25);
    expect(engine.getValidActions(current, 'alice').at(-1)).toEqual({ type: 'PASS' });
    const passed = engine.applyAction(copy(current), { type: 'PASS' }, 'alice');
    expect(passed.lastDrawnTile).toBeNull();
    expect(passed.drawsThisTurn).toBe(0);
    expect(passed.turn).toBe(current.turn + 1);
  });

  test.each([
    null, undefined, [], 1, 'DRAW', {}, { type: 'RESET' }, { type: 'draw' },
    { type: 'PLACE' }, { type: 'PLACE', position: {}, placed: [] },
    { type: 'PLACE', position: pos(0, 0), placed: [1, 2] },
    { type: 'PLACE', position: { col: 0.5, row: 0, orientation: 'UP' }, placed: [1, 2, 4] },
    { type: 'PLACE', position: { col: 0, row: NaN, orientation: 'UP' }, placed: [1, 2, 4] },
    { type: 'PLACE', position: { col: 0, row: 0, orientation: 'SIDE' }, placed: [1, 2, 4] },
    { type: 'PLACE', position: pos(0, 0), placed: [1, 2, '4'] },
  ])('refuse une commande mal formée sans mutation : %j', raw => {
    const initial = state(mode);
    const before = copy(initial);
    const action = raw as TriominoAction;
    expect(engine.isValidAction(initial, action, 'alice')).toBe(false);
    expect(() => engine.applyAction(initial, action, 'alice')).toThrow('Action invalide');
    expect(initial).toEqual(before);
  });

  test('départage un blocage à égalité et conserve les scores kids même non nuls', () => {
    const position = pos(0, 0);
    const initial = state(mode, {
      [key(position)]: { position, triomino: tile([5, 5, 5]), placed: [5, 5, 5] },
    });
    initial.drawPile = [];
    initial.players = [
      { id: 'alice', rack: [tile([0, 0, 1])], score: mode === 'kids' ? 90 : 10 },
      { id: 'bob', rack: [tile([2, 2, 2])], score: mode === 'kids' ? -90 : 15 },
    ];
    const next = engine.applyAction(copy(initial), { type: 'PASS' }, 'alice');
    expect(next.phase).toBe('finished');
    expect(next.winners).toEqual(['alice', 'bob']);
    expect(next.players.map(player => player.score)).toEqual(mode === 'kids' ? [90, -90] : [9, 9]);
  });
});
