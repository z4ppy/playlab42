import type { Board, Bonus, BonusType, PlayerState, Position, Triomino, TriominoConfig } from './models.js';
import { getHexRings, getNeighbors, posKey } from './placement.js';

export const MAX_DRAWS_PER_TURN = 3;
const simplifiedBonuses: Record<BonusType, number> = {
  bridge: 1, hexagon: 1, 'double-hexagon': 2,
};

function isBridge(board: Board, pos: Position): boolean {
  const occupied = getNeighbors(pos).filter(neighbor => board[posKey(neighbor.pos)] !== undefined);
  if (occupied.length !== 2) return false;
  const firstNeighbors = new Set(getNeighbors(occupied[0].pos).map(neighbor => posKey(neighbor.pos)));
  return !firstNeighbors.has(posKey(occupied[1].pos));
}

/** Priorité exclusive : double hexagone > hexagone > pont. */
export function detectBonus(board: Board, pos: Position): Bonus | null {
  const completed = getHexRings(pos).filter(ring => ring.every(position => board[posKey(position)] !== undefined));
  if (completed.length >= 2) return { type: 'double-hexagon', points: 60 };
  if (completed.length === 1) return { type: 'hexagon', points: 50 };
  return isBridge(board, pos) ? { type: 'bridge', points: 40 } : null;
}

export function tileTotal(tile: Triomino): number {
  return tile.values[0] + tile.values[1] + tile.values[2];
}

function sumTiles(tiles: Triomino[]): number {
  return tiles.reduce((total, tile) => total + tileTotal(tile), 0);
}

export function calcPlacementScore(tile: Triomino, bonus: Bonus | null, config: TriominoConfig): number {
  if (config.mode === 'kids') return 0;
  if (config.mode === 'simplified') return 1 + (bonus ? simplifiedBonuses[bonus.type] : 0);
  return tileTotal(tile) + (bonus ? bonus.points : 0);
}

export function drawPenalty(drawsThisTurn: number, config: TriominoConfig): number {
  if (config.mode === 'kids') return 0;
  return 5 + (drawsThisTurn === MAX_DRAWS_PER_TURN ? 10 : 0);
}

function highestScorers(players: PlayerState[]): string[] {
  const max = Math.max(...players.map(player => player.score));
  return players.filter(player => player.score === max).map(player => player.id);
}

function lastTilePoints(players: PlayerState[], winnerIndex: number, config: TriominoConfig): number {
  if (config.mode === 'kids') return 0;
  const bonus = config.mode === 'simplified' ? 5 : 25;
  const opponents = players.filter((_, index) => index !== winnerIndex);
  return bonus + opponents.reduce((total, player) => total + sumTiles(player.rack), 0);
}

export function scoreLastTile(
  players: PlayerState[], winnerIndex: number, config: TriominoConfig,
): { players: PlayerState[]; winners: string[] } {
  const points = lastTilePoints(players, winnerIndex, config);
  const finalPlayers = players.map((player, index) => index === winnerIndex
    ? { ...player, score: player.score + points } : player);
  return {
    players: finalPlayers,
    winners: config.mode === 'kids' ? [finalPlayers[winnerIndex].id] : highestScorers(finalPlayers),
  };
}

export function scoreBlocked(
  players: PlayerState[], config: TriominoConfig,
): { players: PlayerState[]; winners: string[] } {
  if (config.mode === 'kids') {
    const minRack = Math.min(...players.map(player => player.rack.length));
    return { players, winners: players.filter(player => player.rack.length === minRack).map(player => player.id) };
  }
  const finalPlayers = players.map(player => ({ ...player, score: player.score - sumTiles(player.rack) }));
  return { players: finalPlayers, winners: highestScorers(finalPlayers) };
}
