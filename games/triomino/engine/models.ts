/** Tuile canonique : valeurs normalisées a ≤ b ≤ c, de 0 à 5. */
export interface Triomino {
  id: number;
  values: [number, number, number];
}

export type Orientation = 'UP' | 'DOWN';

export interface Position {
  col: number;
  row: number;
  orientation: Orientation;
}

export interface PlacedTile {
  triomino: Triomino;
  position: Position;
  /** [sommet, coin-gauche, coin-droit] dans l'orientation visuelle du triangle. */
  placed: [number, number, number];
}

export type Board = Record<string, PlacedTile>;

export interface PlayerState {
  id: string;
  rack: Triomino[];
  score: number;
}

export type BonusType = 'bridge' | 'hexagon' | 'double-hexagon';

export interface Bonus {
  type: BonusType;
  points: number;
}

export type GameMode = 'standard' | 'simplified' | 'kids';

export interface TriominoConfig {
  mode: GameMode;
  targetScore?: number;
  playerIds: string[];
  seed: number;
}

export type GamePhase = 'playing' | 'finished';

export interface TriominoState {
  board: Board;
  players: PlayerState[];
  drawPile: Triomino[];
  currentPlayerIndex: number;
  drawsThisTurn: number;
  phase: GamePhase;
  winners: string[] | null;
  turn: number;
  config: TriominoConfig;
  /** Seed historique de configuration, pas l'état interne après mélange. */
  rngState: number;
  lastDrawnTile: Triomino | null;
}

export interface PlaceAction {
  type: 'PLACE';
  triominoId: number;
  position: Position;
  placed: [number, number, number];
}

export interface DrawAction {
  type: 'DRAW';
}

export interface PassAction {
  type: 'PASS';
}

export type TriominoAction = PlaceAction | DrawAction | PassAction;

/** Vue sans valeurs des racks adverses ni de la pioche. */
export interface PlayerView {
  board: Board;
  myRack: Triomino[];
  opponentRackSizes: Record<string, number>;
  scores: Record<string, number>;
  currentPlayerId: string;
  drawPileSize: number;
  drawsThisTurn: number;
  phase: GamePhase;
  winners: string[] | null;
  turn: number;
  /** Visible uniquement au joueur courant qui a pioché. */
  lastDrawnTile: Triomino | null;
  config: TriominoConfig;
}
