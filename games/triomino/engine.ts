/**
 * Moteur Triomino isomorphe : orchestration des transitions immuables.
 * @see openspec/changes/add-triomino-game/specs/triomino-rules/spec.md
 */
import type { GameEngine } from '../../lib/types/game-engine.js';
import { SeededRandom } from '../../lib/seeded-random.js';
import type {
  Board, PlaceAction, PlayerState, PlayerView, TriominoAction, TriominoConfig, TriominoState,
} from './engine/models.js';
import { canPlace, findLegalPlacements, generateAllTiles, posKey } from './engine/placement.js';
import {
  calcPlacementScore, detectBonus, drawPenalty, MAX_DRAWS_PER_TURN,
  scoreBlocked, scoreLastTile, tileTotal,
} from './engine/scoring.js';

export type {
  Board, Bonus, BonusType, DrawAction, GameMode, GamePhase, Orientation, PassAction,
  PlaceAction, PlacedTile, PlayerState, PlayerView, Position, Triomino, TriominoAction,
  TriominoConfig, TriominoState,
} from './engine/models.js';
export { generateAllTiles, isValidPlacement } from './engine/placement.js';
export { detectBonus } from './engine/scoring.js';

function isActionObject(action: TriominoAction): boolean {
  return Boolean(action) && typeof action === 'object' && !Array.isArray(action);
}

export class TriominoEngine implements GameEngine<TriominoState, TriominoAction, PlayerView, TriominoConfig> {
  /** Distribue les tuiles ; départage les premières tuiles avec le RNG partagé. */
  init(config: TriominoConfig): TriominoState {
    const rng = new SeededRandom(config.seed);
    const allTiles = generateAllTiles();
    rng.shuffle(allTiles);
    const handSize = config.playerIds.length === 2 ? 9 : 7;
    const players: PlayerState[] = config.playerIds.map((id, index) => ({
      id, rack: allTiles.slice(index * handSize, (index + 1) * handSize), score: 0,
    }));
    return {
      board: {},
      players,
      drawPile: allTiles.slice(config.playerIds.length * handSize),
      currentPlayerIndex: this.#determineFirstPlayer(players, rng),
      drawsThisTurn: 0,
      phase: 'playing',
      winners: null,
      turn: 1,
      config,
      rngState: config.seed,
      lastDrawnTile: null,
    };
  }

  /** Refuse une commande invalide avant toute transition. */
  applyAction(state: TriominoState, action: TriominoAction, playerId: string): TriominoState {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error(`Action invalide : ${action?.type} pour le joueur ${playerId}`);
    }
    switch (action.type) {
      case 'PLACE': return this.#applyPlace(state, action);
      case 'DRAW': return this.#applyDraw(state);
      case 'PASS': return this.#completeTurn(state);
    }
  }

  isValidAction(state: TriominoState, action: TriominoAction, playerId: string): boolean {
    if (state.phase === 'finished' || !isActionObject(action)) return false;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return false;
    switch (action.type) {
      case 'PLACE': return canPlace(state.board, currentPlayer.rack, action);
      case 'DRAW': return state.drawsThisTurn < MAX_DRAWS_PER_TURN && state.drawPile.length > 0;
      case 'PASS': return state.drawPile.length === 0 || state.drawsThisTurn >= MAX_DRAWS_PER_TURN;
      default: return false;
    }
  }

  /** Placements dans l'ordre du rack, puis DRAW et/ou PASS selon le tour. */
  getLegalActions(state: TriominoState, playerId: string): TriominoAction[] {
    if (state.phase === 'finished') return [];
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return [];
    const isFirst = Object.keys(state.board).length === 0;
    const actions: TriominoAction[] = currentPlayer.rack.flatMap(tile =>
      findLegalPlacements(state.board, tile, isFirst));
    if (state.drawsThisTurn < MAX_DRAWS_PER_TURN && state.drawPile.length > 0) {
      actions.push({ type: 'DRAW' });
    }
    if (state.drawPile.length === 0 || state.drawsThisTurn >= MAX_DRAWS_PER_TURN) {
      actions.push({ type: 'PASS' });
    }
    return actions;
  }

  /** Nom canonique ; l'alias historique reste disponible aux interfaces et bots. */
  getValidActions(state: TriominoState, playerId: string): TriominoAction[] {
    return this.getLegalActions(state, playerId);
  }

  /** @throws Si le joueur n'appartient pas à la partie. */
  getPlayerView(state: TriominoState, playerId: string): PlayerView {
    const me = state.players.find(player => player.id === playerId);
    if (!me) throw new Error(`Joueur inconnu : ${playerId}`);
    const opponentRackSizes: Record<string, number> = {};
    const scores: Record<string, number> = {};
    for (const player of state.players) {
      scores[player.id] = player.score;
      if (player.id !== playerId) opponentRackSizes[player.id] = player.rack.length;
    }
    return {
      board: state.board,
      myRack: me.rack,
      opponentRackSizes,
      scores,
      currentPlayerId: state.players[state.currentPlayerIndex].id,
      drawPileSize: state.drawPile.length,
      drawsThisTurn: state.drawsThisTurn,
      phase: state.phase,
      winners: state.winners,
      turn: state.turn,
      lastDrawnTile: me.id === state.players[state.currentPlayerIndex].id ? state.lastDrawnTile : null,
      config: state.config,
    };
  }

  isGameOver(state: TriominoState): boolean {
    return state.phase === 'finished';
  }

  getWinners(state: TriominoState): string[] | null {
    return state.winners;
  }

  getCurrentPlayer(state: TriominoState): string {
    return state.players[state.currentPlayerIndex].id;
  }

  #determineFirstPlayer(players: PlayerState[], rng: SeededRandom): number {
    const totals = players.map(player => tileTotal(player.rack[0]));
    const max = Math.max(...totals);
    const candidates = totals.map((total, index) => total === max ? index : -1).filter(index => index !== -1);
    if (candidates.length === 1) return candidates[0];
    return candidates[rng.int(0, candidates.length - 1)];
  }

  #applyPlace(state: TriominoState, action: PlaceAction): TriominoState {
    const playerIndex = state.currentPlayerIndex;
    const player = state.players[playerIndex];
    const tile = player.rack.find(candidate => candidate.id === action.triominoId);
    if (!tile) throw new Error(`Tuile absente du rack : ${action.triominoId}`);
    const board: Board = {
      ...state.board,
      [posKey(action.position)]: { triomino: tile, position: action.position, placed: action.placed },
    };
    const points = calcPlacementScore(tile, detectBonus(board, action.position), state.config);
    const rack = player.rack.filter(candidate => candidate.id !== action.triominoId);
    const players = state.players.map((entry, index) => index === playerIndex
      ? { ...entry, rack, score: entry.score + points } : entry);
    if (rack.length === 0) {
      return {
        ...state, board, ...scoreLastTile(players, playerIndex, state.config),
        phase: 'finished', drawsThisTurn: 0, lastDrawnTile: null,
      };
    }
    return this.#completeTurn({ ...state, board, players });
  }

  #applyDraw(state: TriominoState): TriominoState {
    const drawPile = [...state.drawPile];
    const drawnTile = drawPile.pop();
    if (!drawnTile) throw new Error('Pioche vide');
    const drawsThisTurn = state.drawsThisTurn + 1;
    const penalty = drawPenalty(drawsThisTurn, state.config);
    const players = state.players.map((player, index) => index === state.currentPlayerIndex
      ? { ...player, rack: [...player.rack, drawnTile], score: player.score - penalty } : player);
    return { ...state, players, drawPile, drawsThisTurn, lastDrawnTile: drawnTile };
  }

  /** PLACE et PASS avancent le tour, effacent la pioche visible et vérifient le blocage. */
  #completeTurn(state: TriominoState): TriominoState {
    const next: TriominoState = {
      ...state,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      drawsThisTurn: 0,
      turn: state.turn + 1,
      lastDrawnTile: null,
    };
    if (!this.#isBlocked(next)) return next;
    return { ...next, ...scoreBlocked(next.players, next.config), phase: 'finished' };
  }

  #isBlocked(state: TriominoState): boolean {
    if (state.drawPile.length > 0) return false;
    const isFirst = Object.keys(state.board).length === 0;
    return !state.players.some(player => player.rack.some(tile =>
      findLegalPlacements(state.board, tile, isFirst).length > 0));
  }
}

export default TriominoEngine;
