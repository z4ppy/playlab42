import type { Board, Orientation, PlaceAction, Position, Triomino } from './models.js';

interface Neighbor {
  pos: Position;
  srcIndices: [number, number];
  nbrIndices: [number, number];
}

/** Les 56 combinaisons canoniques, dans l'ordre historique des identifiants. */
export function generateAllTiles(): Triomino[] {
  const tiles: Triomino[] = [];
  let id = 0;
  for (let a = 0; a <= 5; a++) {
    for (let b = a; b <= 5; b++) {
      for (let c = b; c <= 5; c++) {
        tiles.push({ id, values: [a, b, c] });
        id++;
      }
    }
  }
  return tiles;
}

export function posKey(pos: Position): string {
  return `${pos.col},${pos.row},${pos.orientation}`;
}

function seqXOf(pos: Position): number {
  return pos.col * 2 + (pos.orientation === 'DOWN' ? 1 : 0);
}

function posFromSeqX(seqX: number, row: number): Position {
  return seqX % 2 === 0
    ? { col: seqX / 2, row, orientation: 'UP' }
    : { col: (seqX - 1) / 2, row, orientation: 'DOWN' };
}

function isVisuallyUp(pos: Position): boolean {
  return ((seqXOf(pos) + pos.row) % 2 + 2) % 2 === 0;
}

/**
 * L'orientation visuelle dépend de seqX + row, pas seulement de UP/DOWN.
 * Les côtés gauche/droit correspondent à [0,1]/[0,2], la base à [1,2].
 * Les indices partagés restent identiques quand le triangle est inversé ;
 * seule la rangée du voisin de base change.
 */
export function getNeighbors(pos: Position): Neighbor[] {
  const sx = seqXOf(pos);
  const { row } = pos;
  return [
    { pos: posFromSeqX(sx - 1, row), srcIndices: [0, 1], nbrIndices: [2, 0] },
    { pos: posFromSeqX(sx + 1, row), srcIndices: [0, 2], nbrIndices: [1, 0] },
    { pos: posFromSeqX(sx, row + (isVisuallyUp(pos) ? 1 : -1)), srcIndices: [1, 2], nbrIndices: [1, 2] },
  ];
}

function edgeMatches(placed: PlaceAction['placed'], board: Board, neighbor: Neighbor): boolean {
  const tile = board[posKey(neighbor.pos)];
  return neighbor.srcIndices.every((index, endpoint) =>
    placed[index] === tile.placed[neighbor.nbrIndices[endpoint]]);
}

/** Centre pour la première pose ; ensuite tous les côtés occupés doivent correspondre. */
export function isValidPlacement(
  board: Board, position: Position, placed: PlaceAction['placed'], isFirst: boolean,
): boolean {
  if (board[posKey(position)]) return false;
  if (isFirst) {
    return position.col === 0 && position.row === 0 && position.orientation === 'UP';
  }
  const occupied = getNeighbors(position).filter(neighbor => board[posKey(neighbor.pos)] !== undefined);
  return occupied.length > 0 && occupied.every(neighbor => edgeMatches(placed, board, neighbor));
}

/** Trois rotations, jamais de réflexion ; dédoublonnage stable des triples. */
function getAllRotations(tile: Triomino): PlaceAction['placed'][] {
  const [a, b, c] = tile.values;
  const rotations: PlaceAction['placed'][] = [[a, b, c], [b, c, a], [c, a, b]];
  const seen = new Set<string>();
  return rotations.filter(rotation => {
    const key = rotation.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasPlacementShape(action: PlaceAction): boolean {
  return Boolean(action.position) && Array.isArray(action.placed) && action.placed.length === 3
    && Number.isInteger(action.position.col) && Number.isInteger(action.position.row)
    && ['UP', 'DOWN'].includes(action.position.orientation);
}

export function canPlace(board: Board, rack: Triomino[], action: PlaceAction): boolean {
  if (!hasPlacementShape(action)) return false;
  const tile = rack.find(candidate => candidate.id === action.triominoId);
  if (!tile) return false;
  const matchesRotation = getAllRotations(tile).some(rotation =>
    rotation.every((value, index) => value === action.placed[index]));
  return matchesRotation && isValidPlacement(board, action.position, action.placed, Object.keys(board).length === 0);
}

function candidatePositions(board: Board): Position[] {
  const candidates = new Set<string>();
  for (const tile of Object.values(board)) {
    for (const neighbor of getNeighbors(tile.position)) {
      const key = posKey(neighbor.pos);
      if (!board[key]) candidates.add(key);
    }
  }
  return [...candidates].map(key => {
    const [col, row, orientation] = key.split(',');
    return { col: parseInt(col, 10), row: parseInt(row, 10), orientation: orientation as Orientation };
  });
}

/** Ordre stable : positions voisines rencontrées, puis rotations de la tuile. */
export function findLegalPlacements(board: Board, tile: Triomino, isFirst: boolean): PlaceAction[] {
  const positions: Position[] = isFirst ? [{ col: 0, row: 0, orientation: 'UP' }] : candidatePositions(board);
  const actions: PlaceAction[] = [];
  for (const position of positions) {
    for (const placed of getAllRotations(tile)) {
      if (isValidPlacement(board, position, placed, isFirst)) {
        actions.push({ type: 'PLACE', triominoId: tile.id, position, placed });
      }
    }
  }
  return actions;
}

type VertexType = 'peak' | 'valley';

/** Six triangles autour du sommet pointu du triangle de référence. */
function trianglesAroundVertex(seqX: number, row: number, type: VertexType): Position[] {
  const adjacentRow = row + (type === 'peak' ? -1 : 1);
  return [
    posFromSeqX(seqX, row),
    posFromSeqX(seqX - 1, row),
    posFromSeqX(seqX + 1, row),
    posFromSeqX(seqX - 1, adjacentRow),
    posFromSeqX(seqX, adjacentRow),
    posFromSeqX(seqX + 1, adjacentRow),
  ];
}

/** Chaque sommet du triangle peut fermer un anneau de six tuiles. */
export function getHexRings(pos: Position): Position[][] {
  const sx = seqXOf(pos);
  const peakType = isVisuallyUp(pos) ? 'peak' : 'valley';
  const baseType = peakType === 'peak' ? 'valley' : 'peak';
  return [
    trianglesAroundVertex(sx, pos.row, peakType),
    trianglesAroundVertex(sx - 1, pos.row, baseType),
    trianglesAroundVertex(sx + 1, pos.row, baseType),
  ];
}
