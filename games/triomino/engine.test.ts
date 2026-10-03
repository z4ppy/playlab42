/**
 * Tests du moteur Triomino
 * @see openspec/changes/add-triomino-game/specs/triomino-rules/spec.md
 */

import { jest } from '@jest/globals';
import {
  generateAllTiles,
  isValidPlacement,
  detectBonus,
  TriominoEngine,
  type Position,
  type Board,
  type TriominoConfig,
  type PlaceAction,
  type TriominoAction,
  type Triomino,
  type TriominoState,
  type GameMode,
} from './engine.js';

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

const defaultConfig = (players = 2, seed = 42): TriominoConfig => ({
  mode: 'standard',
  playerIds: Array.from({ length: players }, (_, i) => `p${i + 1}`),
  seed,
});

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function tile(values: [number, number, number]): Triomino {
  const sorted = [...values].sort((a, b) => a - b);
  const result = generateAllTiles().find((candidate) =>
    candidate.values.every((value, index) => value === sorted[index]),
  );
  if (!result) throw new Error(`Tuile inconnue : ${values}`);
  return result;
}

function position(seqX: number, row: number): Position {
  return {
    col: Math.floor(seqX / 2),
    row,
    orientation: seqX % 2 === 0 ? 'UP' : 'DOWN',
  };
}

function key(pos: Position): string {
  return `${pos.col},${pos.row},${pos.orientation}`;
}

function fixture(
  board: Board,
  racks: [Triomino[], Triomino[]],
  mode: GameMode = 'standard',
  drawPile: Triomino[] = [],
): TriominoState {
  return {
    board,
    players: racks.map((rack, index) => ({ id: `p${index + 1}`, rack, score: 0 })),
    drawPile,
    currentPlayerIndex: 0,
    drawsThisTurn: 0,
    phase: 'playing',
    winners: null,
    turn: Object.keys(board).length + 1,
    config: { ...defaultConfig(), mode },
    rngState: 42,
    lastDrawnTile: null,
  };
}

// Deux anneaux partagent le côté gauche de △(seqX=0,row=0).
// Anneau au sommet haut : trois triangles row=-1, trois row=0.
// Anneau au sommet bas-gauche : trois triangles row=0, trois row=1.
// Les valeurs des sommets partagés correspondent ; les dix tuiles sont uniques.
const twoRings: [number, number, [number, number, number]][] = [
  [0, 0, [5, 5, 3]], // La tuile qui ferme les deux anneaux (somme = 13).
  [-1, 0, [5, 5, 5]],
  [1, 0, [3, 5, 2]],
  [-1, -1, [4, 5, 5]],
  [0, -1, [5, 4, 4]],
  [1, -1, [4, 5, 2]],
  [-2, 0, [5, 2, 5]],
  [-2, 1, [0, 2, 5]],
  [-1, 1, [5, 0, 4]],
  [0, 1, [4, 5, 3]],
];

function ringBoard(indices: number[]): Board {
  return Object.fromEntries(indices.map((index) => {
    const [seqX, row, placed] = twoRings[index];
    const pos = position(seqX, row);
    const placedValues: [number, number, number] = [...placed];
    return [key(pos), { triomino: tile(placed), position: pos, placed: placedValues }];
  }));
}

function expectStocks(state: TriominoState): void {
  const ids = [
    ...Object.values(state.board).map((entry) => entry.triomino.id),
    ...state.players.flatMap((player) => player.rack.map((entry) => entry.id)),
    ...state.drawPile.map((entry) => entry.id),
  ];
  expect(ids.sort((a, b) => a - b)).toEqual(generateAllTiles().map((entry) => entry.id));
}

describe('GreedyBot', () => {
  test('préserve les choix légaux et refuse une liste sans action valide', async () => {
    // Le bot référence le moteur généré ; lui fournir sa vraie implémentation TS.
    jest.unstable_mockModule('../dist/engine.js', () => ({ detectBonus }), { virtual: true });
    const { GreedyBot } = await import('./bots/greedy.js');
    const engine = new TriominoEngine();
    const state = engine.init(defaultConfig(2, 42));
    const playerId = engine.getCurrentPlayer(state);
    const view = engine.getPlayerView(state, playerId);
    const bot = new GreedyBot();
    const rng = { pick: <T>(values: T[]): T => values[0] };
    const draw: TriominoAction = { type: 'DRAW' };
    const pass: TriominoAction = { type: 'PASS' };
    expect(bot.chooseAction(view, [pass, draw], rng)).toBe(draw);
    expect(bot.chooseAction(view, [pass], rng)).toBe(pass);
    expect(() => bot.chooseAction(view, [], rng)).toThrow('Aucune action valide');
    const chosen = bot.chooseAction(view, engine.getLegalActions(state, playerId), rng);
    expect(chosen.type).toBe('PLACE');
    expect(engine.isValidAction(state, chosen, playerId)).toBe(true);
  });
});

/** Construit un plateau avec une seule tuile posée au centre */
function boardWithOne(placed: [number, number, number]): Board {
  const pos: Position = { col: 0, row: 0, orientation: 'UP' };
  return {
    '0,0,UP': {
      triomino: tile(placed),
      position: pos,
      placed,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Génération des 56 tuiles
// ---------------------------------------------------------------------------

describe('generateAllTiles', () => {
  test('génère exactement 56 tuiles', () => {
    const tiles = generateAllTiles();
    expect(tiles.length).toBe(56);
  });

  test('toutes les tuiles sont uniques (IDs distincts)', () => {
    const tiles = generateAllTiles();
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(56);
  });

  test('toutes les tuiles sont normalisées (a ? b ? c)', () => {
    const tiles = generateAllTiles();
    for (const tile of tiles) {
      const [a, b, c] = tile.values;
      expect(a).toBeLessThanOrEqual(b);
      expect(b).toBeLessThanOrEqual(c);
    }
  });

  test('les valeurs sont toutes comprises entre 0 et 5', () => {
    const tiles = generateAllTiles();
    for (const tile of tiles) {
      for (const v of tile.values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  test('pas de tuile dupliquée (valeurs distinctes)', () => {
    const tiles = generateAllTiles();
    const keys = new Set(tiles.map((t) => t.values.join(',')));
    expect(keys.size).toBe(56);
  });

  test('contient bien la tuile (0,0,0)', () => {
    const tiles = generateAllTiles();
    expect(tiles.some((t) => t.values[0] === 0 && t.values[1] === 0 && t.values[2] === 0)).toBe(true);
  });

  test('contient bien la tuile (5,5,5)', () => {
    const tiles = generateAllTiles();
    expect(tiles.some((t) => t.values[0] === 5 && t.values[1] === 5 && t.values[2] === 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Placement valide / invalide
// ---------------------------------------------------------------------------

describe('isValidPlacement', () => {
  test('premier placement au centre valide', () => {
    const pos: Position = { col: 0, row: 0, orientation: 'UP' };
    expect(isValidPlacement({}, pos, [1, 2, 3], true)).toBe(true);
  });

  test('refusé si la case est déjà occupée', () => {
    const board = boardWithOne([1, 2, 3]);
    const pos: Position = { col: 0, row: 0, orientation: 'UP' };
    expect(isValidPlacement(board, pos, [1, 2, 3], false)).toBe(false);
  });

  test('refusé si aucun voisin', () => {
    const board = boardWithOne([1, 2, 3]);
    const pos: Position = { col: 5, row: 5, orientation: 'UP' };
    expect(isValidPlacement(board, pos, [1, 2, 3], false)).toBe(false);
  });

  test('accepté si voisin et valeurs correctes (UP côté droit ? DOWN même col)', () => {
    // Tuile UP [1,2,3] posée en (0,0,UP) : placed[0]=1, placed[1]=2, placed[2]=3
    // DOWN(0,0) est le voisin gauche de UP(0,0) : DOWN.src[0,1] ? UP.nbr[2,0]
    // ? DOWN.placed[0] = UP.placed[2] = 3, DOWN.placed[1] = UP.placed[0] = 1
    const board = boardWithOne([1, 2, 3]);
    const pos: Position = { col: 0, row: 0, orientation: 'DOWN' };
    expect(isValidPlacement(board, pos, [3, 1, 0], false)).toBe(true);
  });

  test('refusé si valeurs ne correspondent pas sur le côté partagé', () => {
    const board = boardWithOne([1, 2, 3]);
    const pos: Position = { col: 0, row: 0, orientation: 'DOWN' };
    // DOWN.placed[0] doit = UP.placed[2]=3, DOWN.placed[1] doit = UP.placed[0]=1
    // Ici [9,9] ? [3,1]
    expect(isValidPlacement(board, pos, [9, 9, 0], false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Détection de bonus
// ---------------------------------------------------------------------------

describe('detectBonus', () => {
  test('pas de bonus sur un plateau vide', () => {
    const board = boardWithOne([1, 2, 3]);
    expect(detectBonus(board, { col: 0, row: 0, orientation: 'UP' })).toBeNull();
  });

});

describe('Transitions et replays publics', () => {
  test.each<GameMode>(['standard', 'simplified', 'kids'])(
    'rejoue une partie %s avec PLACE/DRAW/PASS et reprise JSON après une pioche',
    (mode) => {
      const engine = new TriominoEngine();
      const config = freeze({ ...defaultConfig(2, 99), mode });
      let state = engine.init(config);
      let replay = new TriominoEngine().init(copy(config));
      let restored: TriominoState | null = null;
      const seen = new Set<string>();
      let steps = 0;
      // Référence observée sur 8f68836 : protège aussi l'ordre RNG, pas seulement
      // deux exécutions d'une même implémentation éventuellement modifiée.
      expect(state.players.map((player) => player.rack.map((entry) => entry.id))).toEqual([
        [11, 34, 6, 13, 54, 22, 21, 49, 1],
        [4, 30, 23, 47, 32, 52, 24, 35, 43],
      ]);
      expect(state.currentPlayerIndex).toBe(0);

      while (!engine.isGameOver(state) && steps < 500) {
        const before = copy(state);
        freeze(state);
        const playerId = engine.getCurrentPlayer(state);
        const actions = engine.getLegalActions(state, playerId);
        expect(actions.length).toBeGreaterThan(0);
        for (const candidate of actions) {
          expect(engine.isValidAction(state, candidate, playerId)).toBe(true);
        }
        expect(engine.getLegalActions(replay, playerId)).toEqual(actions);
        if (restored) expect(engine.getLegalActions(restored, playerId)).toEqual(actions);

        // Après la première pose, choisir volontairement trois pioches puis PASS.
        // Les tours suivants utilisent la première pose légale, sinon DRAW/PASS.
        const preferredType = state.turn === 2
          ? (state.drawsThisTurn < 3 ? 'DRAW' : 'PASS')
          : 'PLACE';
        const action = freeze(copy(actions.find((candidate) => candidate.type === preferredType) ?? actions[0]));
        const actionBefore = copy(action);
        seen.add(action.type);
        const next = engine.applyAction(state, action, playerId);
        replay = new TriominoEngine().applyAction(replay, copy(action), playerId);
        if (restored) restored = new TriominoEngine().applyAction(restored, copy(action), playerId);
        else if (action.type === 'DRAW') {
          restored = copy(next);
          expect(restored.lastDrawnTile).not.toBeNull();
          expect(restored.drawsThisTurn).toBe(1);
        }
        expect(state).toEqual(before);
        expect(action).toEqual(actionBefore);
        expect(next).not.toBe(state);
        expect(next).toEqual(replay);
        if (restored) expect(next).toEqual(restored);
        expect(next.rngState).toBe(config.seed);
        expectStocks(next);
        state = next;
        steps++;
      }

      expect(steps).toBe(73);
      expect(state.turn).toBe(45);
      expect(Object.keys(state.board)).toHaveLength(44);
      expect(state.drawPile).toHaveLength(10);
      expect(state.players.map((player) => player.rack.map((entry) => entry.id))).toEqual([[], [55, 20]]);
      if (mode === 'standard') {
        expect(state.players.map((player) => player.score)).toEqual([183, 134]);
      }
      expect(seen).toEqual(new Set(['PLACE', 'DRAW', 'PASS']));
      expect(engine.isGameOver(state)).toBe(true);
      expect(engine.getWinners(state)).not.toBeNull();
      expect(engine.getLegalActions(state, engine.getCurrentPlayer(state))).toEqual([]);
      expect(restored).toEqual(state);
      expect(replay).toEqual(state);
    },
  );

  test('la pioche prend la dernière tuile, garde le tour et permet de la poser', () => {
    const engine = new TriominoEngine();
    const first = tile([1, 1, 1]);
    const drawn = tile([2, 2, 2]);
    const state = freeze(fixture({}, [[first], [tile([2, 2, 3])]], 'standard', [drawn]));
    const afterDraw = engine.applyAction(state, freeze({ type: 'DRAW' }), 'p1');
    expect(afterDraw.drawPile).toEqual([]);
    expect(afterDraw.players[0].rack).toEqual([first, drawn]);
    expect(afterDraw.players[0].score).toBe(-5);
    expect(afterDraw.turn).toBe(state.turn);
    expect(afterDraw.currentPlayerIndex).toBe(0);
    expect(afterDraw.lastDrawnTile).toEqual(drawn);
    const place: PlaceAction = {
      type: 'PLACE', triominoId: drawn.id, position: position(0, 0), placed: [2, 2, 2],
    };
    expect(engine.getLegalActions(afterDraw, 'p1')).toContainEqual(place);
    const next = engine.applyAction(freeze(afterDraw), freeze(place), 'p1');
    expect(next.players[0].rack).toEqual([first]);
    expect(next.players[0].score).toBe(1); // -5 + (2+2+2).
    expect(next.drawsThisTurn).toBe(0);
    expect(next.lastDrawnTile).toBeNull();
    expect(next.turn).toBe(state.turn + 1);
    expect(next.currentPlayerIndex).toBe(1);
  });

  test.each<GameMode>(['standard', 'simplified', 'kids'])(
    'trois pioches en %s puis PASS réinitialisent le tour sans malus supplémentaire',
    (mode) => {
      const engine = new TriominoEngine();
      let state = fixture({}, [[tile([1, 1, 1])], [tile([0, 0, 0])]], mode,
        [tile([2, 2, 2]), tile([3, 3, 3]), tile([4, 4, 4]), tile([5, 5, 5])]);
      for (const [index, penalty] of [5, 10, 25].entries()) {
        const before = copy(state);
        const expectedTile = state.drawPile.at(-1);
        state = engine.applyAction(freeze(state), freeze({ type: 'DRAW' }), 'p1');
        expect(state.lastDrawnTile).toEqual(expectedTile);
        expect(state.drawsThisTurn).toBe(index + 1);
        expect(state.players[0].score).toBe(mode === 'kids' ? 0 : -penalty);
        expect(state.turn).toBe(before.turn);
      }
      expect(engine.isValidAction(state, { type: 'DRAW' }, 'p1')).toBe(false);
      const next = engine.applyAction(freeze(state), freeze({ type: 'PASS' }), 'p1');
      expect(next.phase).toBe('playing'); // La pioche non vide interdit le blocage.
      expect(next.players).toEqual(state.players);
      expect(next.currentPlayerIndex).toBe(1);
      expect(next.turn).toBe(state.turn + 1);
      expect(next.drawsThisTurn).toBe(0);
      expect(next.lastDrawnTile).toBeNull();
    },
  );
});

describe('Bonus géométriques et modes', () => {
  const shapes = [
    { name: 'pont', indices: [1, 2], bonus: 'bridge', standard: 40, simplified: 1 },
    // La fermeture du premier anneau crée aussi un pont : seul +50 compte.
    { name: 'hexagone prioritaire au pont', indices: [1, 2, 3, 4, 5], bonus: 'hexagon', standard: 50, simplified: 1 },
    { name: 'double hexagone prioritaire', indices: [1, 2, 3, 4, 5, 6, 7, 8, 9], bonus: 'double-hexagon', standard: 60, simplified: 2 },
  ];

  test.each(shapes)('$name est réellement posé et scoré dans les trois modes', (shape) => {
    const engine = new TriominoEngine();
    const action: PlaceAction = {
      type: 'PLACE', triominoId: tile([3, 5, 5]).id,
      position: position(0, 0), placed: [5, 5, 3],
    };
    for (const mode of ['standard', 'simplified', 'kids'] satisfies GameMode[]) {
      const state = freeze(fixture(ringBoard(shape.indices),
        [[tile([3, 5, 5]), tile([0, 0, 0])], [tile([1, 1, 1])]], mode, [tile([2, 2, 2])]));
      const before = copy(state);
      expect(engine.getLegalActions(state, 'p1')).toContainEqual(action);
      const next = engine.applyAction(state, freeze(action), 'p1');
      expect(detectBonus(next.board, action.position)).toEqual({ type: shape.bonus, points: shape.standard });
      expect(next.players[0].score).toBe(mode === 'kids' ? 0
        : mode === 'simplified' ? 1 + shape.simplified : 13 + shape.standard);
      expect(next.players[0].rack).toEqual([tile([0, 0, 0])]);
      expect(next.currentPlayerIndex).toBe(1);
      expect(state).toEqual(before);
    }
  });

  test('un anneau incomplet et trois côtés occupés ne donnent pas un hexagone', () => {
    const engine = new TriominoEngine();
    const state = fixture(ringBoard([1, 2, 3, 5, 9]),
      [[tile([3, 5, 5]), tile([0, 0, 0])], [tile([1, 1, 1])]], 'standard', [tile([2, 2, 2])]);
    const action: PlaceAction = {
      type: 'PLACE', triominoId: tile([3, 5, 5]).id, position: position(0, 0), placed: [5, 5, 3],
    };
    const next = engine.applyAction(freeze(state), freeze(action), 'p1');
    expect(detectBonus(next.board, action.position)).toBeNull();
    expect(next.players[0].score).toBe(13);
  });
});

describe('Refus sans mutation et fin de partie', () => {
  const engine = new TriominoEngine();

  test('refuse les actions hors tour, tuiles absentes, réflexions et côtés incompatibles', () => {
    const state = freeze(fixture(boardWithOne([1, 2, 3]),
      [[tile([0, 1, 3]), tile([2, 2, 2])], [tile([5, 5, 5])]], 'standard', [tile([4, 4, 4])]));
    const before = copy(state);
    const legal: PlaceAction = {
      type: 'PLACE', triominoId: tile([0, 1, 3]).id, position: position(1, 0), placed: [3, 0, 1],
    };
    const invalid: TriominoAction[] = [
      { ...legal, triominoId: tile([5, 5, 5]).id },
      { ...legal, placed: [3, 1, 0] }, // Réflexion, pas rotation.
      { ...legal, position: position(0, 0) }, // Case occupée.
      { ...legal, position: position(10, 10) }, // Isolée.
      legal, // Côté gauche : [3,0] au lieu de [3,1].
      { type: 'PASS' },
    ];
    for (const action of invalid) {
      freeze(action);
      const saved = copy(action);
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
      expect(() => engine.applyAction(state, action, 'p1')).toThrow('Action invalide');
      expect(action).toEqual(saved);
      expect(state).toEqual(before);
    }
    expect(engine.getLegalActions(state, 'p2')).toEqual([]);
    expect(engine.isValidAction(state, { type: 'DRAW' }, 'p2')).toBe(false);
    expect(() => engine.applyAction(state, { type: 'DRAW' }, 'p2')).toThrow('Action invalide');
  });

  test('première pose uniquement au centre, comme les actions proposées', () => {
    const state = freeze(fixture({}, [[tile([1, 2, 3])], [tile([4, 4, 4])]]));
    for (const pos of [position(2, 0), position(0, 1), position(1, 0)]) {
      const action: PlaceAction = {
        type: 'PLACE', triominoId: tile([1, 2, 3]).id, position: pos, placed: [1, 2, 3],
      };
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
      expect(() => engine.applyAction(state, freeze(action), 'p1')).toThrow('Action invalide');
    }
  });

  test.each<GameMode>(['standard', 'simplified', 'kids'])(
    'dernière tuile en %s applique pose, bonus et reliquat adverse puis ferme les actions',
    (mode) => {
      const state = freeze(fixture({}, [[tile([1, 2, 3])], [tile([4, 4, 4]), tile([0, 0, 1])]], mode));
      const action: PlaceAction = {
        type: 'PLACE', triominoId: tile([1, 2, 3]).id, position: position(0, 0), placed: [1, 2, 3],
      };
      const next = engine.applyAction(state, freeze(action), 'p1');
      // Reliquat adverse = 12+1 ; bonus fixe 25 (standard) ou 5 (simplified).
      expect(next.players[0].score).toBe(mode === 'kids' ? 0 : mode === 'standard' ? 6 + 25 + 13 : 1 + 5 + 13);
      expect(next.players[1].score).toBe(0);
      expect(next.players[0].rack).toEqual([]);
      expect(engine.isGameOver(next)).toBe(true);
      expect(engine.getWinners(next)).toEqual(['p1']);
      for (const candidate of [action, { type: 'DRAW' }, { type: 'PASS' }] satisfies TriominoAction[]) {
        expect(engine.isValidAction(next, candidate, 'p1')).toBe(false);
        expect(() => engine.applyAction(freeze(next), freeze(candidate), 'p1')).toThrow('Action invalide');
      }
      expect(engine.getLegalActions(next, 'p1')).toEqual([]);
    },
  );

  test.each<GameMode>(['standard', 'simplified'])(
    'vider son rack ne suffit pas à gagner en %s si le score adverse reste supérieur',
    (mode) => {
      const state = fixture({}, [[tile([0, 0, 0])], [tile([1, 1, 1])]], mode);
      state.players[1].score = 100;
      const next = engine.applyAction(freeze(state), freeze({
        type: 'PLACE', triominoId: tile([0, 0, 0]).id, position: position(0, 0), placed: [0, 0, 0],
      }), 'p1');
      expect(next.players.map((player) => player.score)).toEqual([mode === 'standard' ? 28 : 9, 100]);
      expect(engine.getWinners(next)).toEqual(['p2']);
    },
  );

  test('égalité après la dernière pose partage la victoire en standard', () => {
    const state = fixture({}, [[tile([0, 0, 0])], [tile([1, 1, 1])]]);
    state.players[1].score = 28;
    const next = engine.applyAction(freeze(state), freeze({
      type: 'PLACE', triominoId: tile([0, 0, 0]).id, position: position(0, 0), placed: [0, 0, 0],
    }), 'p1');
    expect(engine.getWinners(next)).toEqual(['p1', 'p2']);
  });

  test.each<GameMode>(['standard', 'simplified', 'kids'])(
    'pioche vide : PASS sans malus, blocage en %s avec reliquats mais sans bonus final',
    (mode) => {
      const state = fixture(boardWithOne([5, 5, 5]),
        [[tile([0, 0, 1])], [tile([1, 1, 1]), tile([2, 2, 2])]], mode);
      state.players[0].score = mode === 'kids' ? 0 : 10;
      state.players[1].score = mode === 'kids' ? 0 : 18;
      const before = copy(state);
      freeze(state);
      expect(engine.getLegalActions(state, 'p1')).toEqual([{ type: 'PASS' }]);
      expect(engine.isValidAction(state, { type: 'DRAW' }, 'p1')).toBe(false);
      expect(() => engine.applyAction(state, { type: 'DRAW' }, 'p1')).toThrow('Action invalide');
      const next = engine.applyAction(state, freeze({ type: 'PASS' }), 'p1');
      expect(next.players.map((player) => player.score)).toEqual(mode === 'kids' ? [0, 0] : [9, 9]);
      expect(next.phase).toBe('finished');
      expect(next.winners).toEqual(mode === 'kids' ? ['p1'] : ['p1', 'p2']);
      expect(next.players.map((player) => player.rack)).toEqual(state.players.map((player) => player.rack));
      expect(state).toEqual(before);
    },
  );

  test('PASS avec pioche vide ne termine pas si un autre joueur peut encore poser', () => {
    const state = freeze(fixture(boardWithOne([5, 5, 5]),
      [[tile([0, 0, 0])], [tile([1, 5, 5])]]));
    const next = engine.applyAction(state, freeze({ type: 'PASS' }), 'p1');
    expect(next.phase).toBe('playing');
    expect(next.players).toEqual(state.players);
    expect(next.currentPlayerIndex).toBe(1);
    expect(engine.getLegalActions(next, 'p2').some((action) => action.type === 'PLACE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Initialisation de la partie
// ---------------------------------------------------------------------------

describe('TriominoEngine.init', () => {
  const engine = new TriominoEngine();

  test('2 joueurs ? 9 tuiles chacun', () => {
    const state = engine.init(defaultConfig(2));
    expect(state.players[0].rack.length).toBe(9);
    expect(state.players[1].rack.length).toBe(9);
  });

  test('3 joueurs ? 7 tuiles chacun', () => {
    const state = engine.init(defaultConfig(3));
    for (const p of state.players) {
      expect(p.rack.length).toBe(7);
    }
  });

  test('4 joueurs ? 7 tuiles chacun', () => {
    const state = engine.init(defaultConfig(4));
    for (const p of state.players) {
      expect(p.rack.length).toBe(7);
    }
  });

  test('2 joueurs : pioche = 56 - 18 = 38 tuiles', () => {
    const state = engine.init(defaultConfig(2));
    expect(state.drawPile.length).toBe(38);
  });

  test('4 joueurs : pioche = 56 - 28 = 28 tuiles', () => {
    const state = engine.init(defaultConfig(4));
    expect(state.drawPile.length).toBe(28);
  });

  test('scores initiaux à 0', () => {
    const state = engine.init(defaultConfig(2));
    for (const p of state.players) {
      expect(p.score).toBe(0);
    }
  });

  test('phase = playing', () => {
    const state = engine.init(defaultConfig(2));
    expect(state.phase).toBe('playing');
  });

  test('plateau vide au départ', () => {
    const state = engine.init(defaultConfig(2));
    expect(Object.keys(state.board).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Score standard
// ---------------------------------------------------------------------------

describe('Score standard', () => {
  const engine = new TriominoEngine();

  test('premier joueur marque la somme des 3 chiffres', () => {
    const state = engine.init(defaultConfig(2, 42));
    const currentPlayer = state.players[state.currentPlayerIndex];
    const tile = currentPlayer.rack[0];
    const action: PlaceAction = {
      type: 'PLACE',
      triominoId: tile.id,
      position: { col: 0, row: 0, orientation: 'UP' },
      placed: tile.values,
    };
    const newState = engine.applyAction(state, action, currentPlayer.id);
    const expected = tile.values[0] + tile.values[1] + tile.values[2];
    expect(newState.players[state.currentPlayerIndex].score).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 6. Pénalités de pioche
// ---------------------------------------------------------------------------

describe('Pénalités de pioche', () => {
  const engine = new TriominoEngine();

  test('piocher 1 tuile = -5 pts', () => {
    const state = engine.init(defaultConfig(2, 1));
    const currentPlayer = state.players[state.currentPlayerIndex];
    const newState = engine.applyAction(state, { type: 'DRAW' }, currentPlayer.id);
    expect(newState.players[state.currentPlayerIndex].score).toBe(-5);
  });

  test('piocher 2 tuiles = -10 pts', () => {
    let state = engine.init(defaultConfig(2, 1));
    const idx = state.currentPlayerIndex;
    const pid = state.players[idx].id;
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    expect(state.players[idx].score).toBe(-10);
  });

  test('piocher 3 tuiles = -25 pts (5+5+5+10)', () => {
    let state = engine.init(defaultConfig(2, 1));
    const idx = state.currentPlayerIndex;
    const pid = state.players[idx].id;
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    expect(state.players[idx].score).toBe(-25);
  });

  test('impossible de piocher une 4ème fois', () => {
    let state = engine.init(defaultConfig(2, 1));
    const idx = state.currentPlayerIndex;
    const pid = state.players[idx].id;
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    expect(engine.isValidAction(state, { type: 'DRAW' }, pid)).toBe(false);
  });

  test('après 3 piochages, PASS est valide', () => {
    let state = engine.init(defaultConfig(2, 1));
    const idx = state.currentPlayerIndex;
    const pid = state.players[idx].id;
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    expect(engine.isValidAction(state, { type: 'PASS' }, pid)).toBe(true);
  });

  test('pas de pénalité en mode kids', () => {
    const config: TriominoConfig = { mode: 'kids', playerIds: ['p1', 'p2'], seed: 1 };
    let state = engine.init(config);
    const idx = state.currentPlayerIndex;
    const pid = state.players[idx].id;
    state = engine.applyAction(state, { type: 'DRAW' }, pid);
    expect(state.players[idx].score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Déterminisme
// ---------------------------------------------------------------------------

describe('Déterminisme', () => {
  const engine = new TriominoEngine();

  test('même seed ? même état initial', () => {
    const s1 = engine.init(defaultConfig(2, 99));
    const s2 = engine.init(defaultConfig(2, 99));
    expect(JSON.stringify(s1.players)).toBe(JSON.stringify(s2.players));
    expect(JSON.stringify(s1.drawPile)).toBe(JSON.stringify(s2.drawPile));
  });

  test('seeds différentes ? états différents (probabilité écrasante)', () => {
    const s1 = engine.init(defaultConfig(2, 1));
    const s2 = engine.init(defaultConfig(2, 2));
    expect(JSON.stringify(s1.players)).not.toBe(JSON.stringify(s2.players));
  });
});

// ---------------------------------------------------------------------------
// 8. Sérialisation JSON
// ---------------------------------------------------------------------------

describe('Sérialisation JSON', () => {
  const engine = new TriominoEngine();

  test("l'état initial est sérialisable", () => {
    const state = engine.init(defaultConfig(2, 42));
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  test("l'état est restaurable depuis JSON", () => {
    const state = engine.init(defaultConfig(2, 42));
    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);
    expect(restored.players.length).toBe(2);
    expect(restored.phase).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
// 9. Fog of war
// ---------------------------------------------------------------------------

describe('getPlayerView', () => {
  const engine = new TriominoEngine();

  test('refuse explicitement un joueur inconnu', () => {
    const state = engine.init(defaultConfig(2, 42));
    expect(() => engine.getPlayerView(state, 'absent')).toThrow('Joueur inconnu : absent');
  });

  test('le joueur voit son propre rack', () => {
    const state = engine.init(defaultConfig(2, 42));
    const pid = state.players[0].id;
    const view = engine.getPlayerView(state, pid);
    expect(view.myRack.length).toBe(9);
  });

  test("le joueur ne voit pas les valeurs du rack adverse", () => {
    const state = engine.init(defaultConfig(2, 42));
    const pid = state.players[0].id;
    const view = engine.getPlayerView(state, pid);
    expect(view.opponentRackSizes.p2).toBe(9);
    // La vue ne doit pas exposer les valeurs des tuiles adverses
    expect(view).not.toHaveProperty('opponentRacks');
  });

  test("les scores de tous les joueurs sont visibles", () => {
    const state = engine.init(defaultConfig(2, 42));
    const view = engine.getPlayerView(state, 'p1');
    expect(view.scores.p1).toBeDefined();
    expect(view.scores.p2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 10. Variantes
// ---------------------------------------------------------------------------

describe('Mode simplifié', () => {
  const engine = new TriominoEngine();

  test('placement vaut 1 pt', () => {
    const config: TriominoConfig = { mode: 'simplified', playerIds: ['p1', 'p2'], seed: 42 };
    const state = engine.init(config);
    const currentPlayer = state.players[state.currentPlayerIndex];
    const tile = currentPlayer.rack[0];
    const action: PlaceAction = {
      type: 'PLACE',
      triominoId: tile.id,
      position: { col: 0, row: 0, orientation: 'UP' },
      placed: tile.values,
    };
    const newState = engine.applyAction(state, action, currentPlayer.id);
    expect(newState.players[state.currentPlayerIndex].score).toBe(1);
  });
});

describe('Mode kids', () => {
  const engine = new TriominoEngine();

  test('placement vaut 0 pt', () => {
    const config: TriominoConfig = { mode: 'kids', playerIds: ['p1', 'p2'], seed: 42 };
    const state = engine.init(config);
    const currentPlayer = state.players[state.currentPlayerIndex];
    const tile = currentPlayer.rack[0];
    const action: PlaceAction = {
      type: 'PLACE',
      triominoId: tile.id,
      position: { col: 0, row: 0, orientation: 'UP' },
      placed: tile.values,
    };
    const newState = engine.applyAction(state, action, currentPlayer.id);
    expect(newState.players[state.currentPlayerIndex].score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Placement en coordonnées négatives (régression modulo négatif)
// ---------------------------------------------------------------------------

describe('Placement en coordonnées négatives', () => {
  const engine = new TriominoEngine();

  test('[0,0,0] peut se poser sur un côté [0,0] en seqX négatif', () => {
    // Tuile UP(0,0) visuellement △ avec base [0,0]
    const board: Board = {
      '0,0,UP': {
        triomino: { id: 1, values: [0, 0, 3] },
        position: { col: 0, row: 0, orientation: 'UP' } as Position,
        placed: [3, 0, 0] as [number, number, number],
      },
    };

    // Le voisin gauche est en seqX=-1 -> col=-1, DOWN
    // srcIndices gauche=[0,1]=[3,0], nbrIndices=[2,0]
    // Pour [0,0,0]: nbr[2]=0=src[0]=3 -> ne match pas (correct)
    // Le voisin base est en row+1 -> UP(0,1) visuellement ▽
    // srcIndices base=[1,2]=[0,0], nbrIndices=[1,2]
    // Pour [0,0,0]: nbr[1]=0=src[1]=0 ✓, nbr[2]=0=src[2]=0 ✓
    const posBase: Position = { col: 0, row: 1, orientation: 'UP' };
    expect(isValidPlacement(board, posBase, [0, 0, 0], false)).toBe(true);
  });

  test('placements valides trouvés quand le plateau s\'étend en seqX négatif', () => {
    // Plateau en L avec des tuiles en coordonnées négatives
    const board: Board = {
      '0,0,UP': {
        triomino: { id: 1, values: [0, 3, 4] },
        position: { col: 0, row: 0, orientation: 'UP' } as Position,
        placed: [4, 0, 3] as [number, number, number],
      },
      '-1,0,DOWN': {
        triomino: { id: 2, values: [0, 3, 4] },
        position: { col: -1, row: 0, orientation: 'DOWN' } as Position,
        placed: [0, 3, 4] as [number, number, number],
      },
      '-1,0,UP': {
        triomino: { id: 3, values: [0, 0, 3] },
        position: { col: -1, row: 0, orientation: 'UP' } as Position,
        placed: [3, 0, 0] as [number, number, number],
      },
    };

    // UP(-1,0) seqX=-2, visuellement △ ((-2+0)%2=0 → pair → △)
    // Sa base est en seqX=-2, row+1 → UP(-1,1) visuellement ▽
    // base srcIndices=[1,2]=[0,0], nbrIndices=[1,2]
    // [0,0,0] : nbr[1]=0=0 ✓, nbr[2]=0=0 ✓ → doit être valide
    const posBase: Position = { col: -1, row: 1, orientation: 'UP' };
    expect(isValidPlacement(board, posBase, [0, 0, 0], false)).toBe(true);

    // Vérifions aussi que getLegalActions trouve ce placement
    const state = {
      board,
      players: [
        { id: 'p1', rack: [{ id: 0, values: [0, 0, 0] as [number, number, number] }], score: 0 },
        { id: 'p2', rack: [] as { id: number; values: [number, number, number] }[], score: 0 },
      ],
      drawPile: [] as { id: number; values: [number, number, number] }[],
      currentPlayerIndex: 0,
      drawsThisTurn: 0,
      phase: 'playing' as const,
      winners: null,
      turn: 5,
      config: { mode: 'standard' as const, playerIds: ['p1', 'p2'], seed: 42 },
      rngState: 42,
      lastDrawnTile: null,
    };

    const actions = engine.getLegalActions(state, 'p1');
    const placements = actions.filter((a): a is PlaceAction => a.type === 'PLACE');
    expect(placements.length).toBeGreaterThan(0);
  });
});
