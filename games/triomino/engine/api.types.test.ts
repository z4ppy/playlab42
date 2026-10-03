import DefaultEngine, {
  TriominoEngine, generateAllTiles, isValidPlacement, detectBonus,
  type Board, type Bonus, type GameMode, type PlaceAction, type PlayerView,
  type Triomino, type TriominoAction, type TriominoConfig, type TriominoState,
} from '../engine';
import type { GameEngine } from '../../../lib/types/game-engine.js';

const engine: GameEngine<TriominoState, TriominoAction, PlayerView, TriominoConfig> = new TriominoEngine();
const mode: GameMode = 'standard';
const config: TriominoConfig = { mode, playerIds: ['alice', 'bob'], seed: 42, targetScore: 400 };
const state: TriominoState = engine.init(config);
const board: Board = state.board;
const tiles: Triomino[] = generateAllTiles();
const player = engine.getCurrentPlayer(state);
if (player === null) throw new Error('La partie initialisée possède un joueur courant');
const action: PlaceAction = {
  type: 'PLACE', triominoId: tiles[0].id,
  position: { col: 0, row: 0, orientation: 'UP' }, placed: [0, 0, 0],
};
const bonus: Bonus | null = detectBonus(board, action.position);
const view: PlayerView = engine.getPlayerView(state, player);
const lastDrawn: Triomino | null = view.lastDrawnTile;
// @ts-expect-error La vue masque les valeurs de la pioche.
const hiddenPile = view.drawPile;
// @ts-expect-error Le format public conserve les trois sommets obligatoires.
const incomplete: PlaceAction = { ...action, placed: [0, 0] };
// @ts-expect-error Le mode public reste une union fermée.
const unknownMode: TriominoConfig = { ...config, mode: 'training' };

test('les exports historiques restent typés et l’alias canonique garde son format', () => {
  expect(DefaultEngine).toBe(TriominoEngine);
  expect(isValidPlacement(board, action.position, action.placed, true)).toBe(true);
  expect(bonus).toBeNull();
  expect(lastDrawn).toBeNull();
  expect(hiddenPile).toBeUndefined();
  expect(incomplete.placed).toHaveLength(2);
  expect(unknownMode.mode).toBe('training');
  expect(new TriominoEngine().getLegalActions(state, player)).toEqual(engine.getValidActions(state, player));
});
