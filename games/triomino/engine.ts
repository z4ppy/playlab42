/**
 * Triomino Engine - Moteur de jeu isomorphe
 * Fonctionne côté client ET serveur
 *
 * @see openspec/specs/game-engine/spec.md
 * @see openspec/changes/add-triomino-game/design.md
 */

// ---------------------------------------------------------------------------
// Mini SeededRandom inline (algorithme Mulberry32, identique à lib/seeded-random.js)
// Inliné pour éviter les problèmes d'import ESM avec ts-jest.
// ---------------------------------------------------------------------------

class SeededRandom {
  #state: number;
  constructor(seed: number) { this.#state = seed >>> 0; }
  random(): number {
    let t = (this.#state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
  pick<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[this.int(0, array.length - 1)];
  }
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une tuile triangulaire avec 3 valeurs normalisées (a ? b ? c, 0-5) */
export interface Triomino {
  id: number;
  /** [sommet, coin-gauche, coin-droit] dans la forme canonique minimale */
  values: [number, number, number];
}

/** Orientation d'un triangle sur le plateau */
export type Orientation = 'UP' | 'DOWN';

/** Position d'une cellule sur le plateau triangulaire */
export interface Position {
  col: number;
  row: number;
  orientation: Orientation;
}

/** Clé unique d'une position (pour Map/Set) */
type PosKey = string;

/** Tuile posée sur le plateau */
export interface PlacedTile {
  triomino: Triomino;
  position: Position;
  /**
   * Valeurs dans le référentiel de la position choisie :
   * - UP  : [sommet-haut, coin-bas-gauche, coin-bas-droit]
   * - DOWN: [sommet-bas,  coin-haut-gauche, coin-haut-droit]
   */
  placed: [number, number, number];
}

/** Plateau de jeu : map de clé de position -> tuile posée */
export type Board = Record<PosKey, PlacedTile>;

/** État d'un joueur */
export interface PlayerState {
  id: string;
  rack: Triomino[];
  score: number;
}

/** Type de bonus obtenus lors d'un placement */
export type BonusType = 'bridge' | 'hexagon' | 'double-hexagon';

/** Bonus accordé lors d'un placement */
export interface Bonus {
  type: BonusType;
  points: number;
}

/** Mode de jeu */
export type GameMode = 'standard' | 'simplified' | 'kids';

/** Configuration d'une partie */
export interface TriominoConfig {
  mode: GameMode;
  /** Score cible pour le mode multi-manches (ex: 400) */
  targetScore?: number;
  playerIds: string[];
  seed: number;
}

/** Phase de jeu */
export type GamePhase = 'playing' | 'finished';

/** État complet de la partie */
export interface TriominoState {
  board: Board;
  players: PlayerState[];
  drawPile: Triomino[];
  currentPlayerIndex: number;
  /** Nombre de tirages effectués par le joueur courant ce tour */
  drawsThisTurn: number;
  phase: GamePhase;
  winners: string[] | null;
  turn: number;
  config: TriominoConfig;
  rngState: number;
  /** Tuile tiree ce tour (en attente de placement éventuel) */
  lastDrawnTile: Triomino | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Placer une tuile sur le plateau */
export interface PlaceAction {
  type: 'PLACE';
  triominoId: number;
  position: Position;
  /** Valeurs dans le référentiel de la position choisie */
  placed: [number, number, number];
}

/** Piocher une tuile */
export interface DrawAction {
  type: 'DRAW';
}

/** Passer son tour (pioche vide ou 3 tirages épuisés sans pouvoir jouer) */
export interface PassAction {
  type: 'PASS';
}

export type TriominoAction = PlaceAction | DrawAction | PassAction;

// ---------------------------------------------------------------------------
// Vue joueur
// ---------------------------------------------------------------------------

/** Vue limitée de la partie pour un joueur (fog of war) */
export interface PlayerView {
  board: Board;
  myRack: Triomino[];
  /** Nombre de tuiles restantes par joueur (sans les valeurs) */
  opponentRackSizes: Record<string, number>;
  scores: Record<string, number>;
  currentPlayerId: string;
  drawPileSize: number;
  drawsThisTurn: number;
  phase: GamePhase;
  winners: string[] | null;
  turn: number;
  lastDrawnTile: Triomino | null;
  config: TriominoConfig;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DRAW_PENALTY = 5;
const TRIPLE_DRAW_EXTRA_PENALTY = 10;
const MAX_DRAWS_PER_TURN = 3;
const LAST_TILE_BONUS = 25;
const BONUS_BRIDGE = 40;
const BONUS_HEXAGON = 50;
const BONUS_DOUBLE_HEXAGON = 60;

// ---------------------------------------------------------------------------
// Génération des tuiles
// ---------------------------------------------------------------------------

/**
 * Génère les 56 tuiles uniques du jeu Triomino.
 * Toutes les combinaisons (a, b, c) avec 0 ? a ? b ? c ? 5.
 */
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

/**
 * Retourne la clé unique d'une position.
 */
function posKey(pos: Position): PosKey {
  return `${pos.col},${pos.row},${pos.orientation}`;
}

/**
 * Retourne les 3 voisins d'une position.
 *
 * Grille triangulaire standard :
 *
 *   Layout en bande :
 *     row 0:  UP(0,0)?  DOWN(0,0)?  UP(1,0)?  DOWN(1,0)? ...
 *     row 1:  UP(0,1)?  DOWN(0,1)?  UP(1,1)?  DOWN(1,1)? ...
 *
 *   Index séquentiel : seqX = col * 2 + (DOWN ? 1 : 0)
 *   Orientation visuelle : (seqX + row) % 2 === 0 ? ?, sinon ?
 *
 *   placed = [sommet, coin-gauche, coin-droit]
 *     côté gauche = sommet?coin-gauche = indices [0,1]
 *     côté droit  = sommet?coin-droit  = indices [0,2]
 *     base        = coin-gauche?coin-droit = indices [1,2]
 *
 *   Trois voisins d'un triangle = les triangles partageant chacun de ses 3 côtés.
 *   Peu importe l'orientation moteur (UP/DOWN), c'est l'orientation VISUELLE
 *   (dérivée de seqX + row) qui détermine quels triangles sont voisins.
 *
 *   Pour un triangle visuellement ? (sommet en haut, base en bas) :
 *     gauche  ? triangle à seqX-1, même row (visuellement ?)
 *     droite  ? triangle à seqX+1, même row (visuellement ?)
 *     base    ? triangle à seqX,   row+1    (visuellement ?, base en haut)
 *
 *   Pour un triangle visuellement ? (sommet en bas, base en haut) :
 *     gauche  ? triangle à seqX-1, même row (visuellement ?)
 *     droite  ? triangle à seqX+1, même row (visuellement ?)
 *     base    ? triangle à seqX,   row-1    (visuellement ?, base en bas)
 *
 *   Conversion seqX ? (col, orientation) :
 *     seqX pair  ? col = seqX/2,     orientation = 'UP'
 *     seqX impair ? col = (seqX-1)/2, orientation = 'DOWN'
 */
type NeighborSide = 'left' | 'right' | 'base';

interface Neighbor {
  pos: Position;
  side: NeighborSide;
  /** Indices dans `placed` de la tuile source qui forment le côté partagé */
  srcIndices: [number, number];
  /** Indices dans `placed` du voisin qui doivent correspondre */
  nbrIndices: [number, number];
}

function seqXOf(pos: Position): number {
  return pos.col * 2 + (pos.orientation === 'DOWN' ? 1 : 0);
}

function posFromSeqX(seqX: number, row: number): Position {
  if (seqX % 2 === 0) {
    return { col: seqX / 2, row, orientation: 'UP' as Orientation };
  } else {
    return { col: (seqX - 1) / 2, row, orientation: 'DOWN' as Orientation };
  }
}

function isVisuallyUp(pos: Position): boolean {
  return ((seqXOf(pos) + pos.row) % 2 + 2) % 2 === 0;
}

function getNeighbors(pos: Position): Neighbor[] {
  const sx = seqXOf(pos);
  const { row } = pos;

  if (isVisuallyUp(pos)) {
    // ? : corners[0]=sommet-haut, [1]=bas-gauche, [2]=bas-droit
    //
    // Côté gauche = segment corners[0]?corners[1] (haut ? bas-gauche)
    //   Voisin = ? à seqX-1, même row
    //   ? corners: [0]=bas, [1]=haut-gauche, [2]=haut-droit
    //   Le point partagé "haut" = src.corners[0] = nbr.corners[2]
    //   Le point partagé "bas"  = src.corners[1] = nbr.corners[0]
    //   ? src[0,1] ? nbr[2,0]
    //
    // Côté droit = segment corners[0]?corners[2] (haut ? bas-droit)
    //   Voisin = ? à seqX+1, même row
    //   Le point partagé "haut" = src.corners[0] = nbr.corners[1]
    //   Le point partagé "bas"  = src.corners[2] = nbr.corners[0]
    //   ? src[0,2] ? nbr[1,0]
    //
    // Base = segment corners[1]?corners[2] (bas-gauche ? bas-droit)
    //   Voisin = ? à seqX, row+1
    //   ? corners: [0]=bas, [1]=haut-gauche, [2]=haut-droit
    //   Le point partagé "gauche" = src.corners[1] = nbr.corners[1]
    //   Le point partagé "droit"  = src.corners[2] = nbr.corners[2]
    //   ? src[1,2] ? nbr[1,2]
    return [
      {
        pos: posFromSeqX(sx - 1, row),
        side: 'left',
        srcIndices: [0, 1],
        nbrIndices: [2, 0],
      },
      {
        pos: posFromSeqX(sx + 1, row),
        side: 'right',
        srcIndices: [0, 2],
        nbrIndices: [1, 0],
      },
      {
        pos: posFromSeqX(sx, row + 1),
        side: 'base',
        srcIndices: [1, 2],
        nbrIndices: [1, 2],
      },
    ];
  } else {
    // ? : corners[0]=sommet-bas, [1]=haut-gauche, [2]=haut-droit
    //
    // Côté gauche = segment corners[0]?corners[1] (bas ? haut-gauche)
    //   Voisin = ? à seqX-1, même row
    //   ? corners: [0]=haut, [1]=bas-gauche, [2]=bas-droit
    //   Le point partagé "bas"  = src.corners[0] = nbr.corners[2]
    //   Le point partagé "haut" = src.corners[1] = nbr.corners[0]
    //   ? src[0,1] ? nbr[2,0]
    //
    // Côté droit = segment corners[0]?corners[2] (bas ? haut-droit)
    //   Voisin = ? à seqX+1, même row
    //   Le point partagé "bas"  = src.corners[0] = nbr.corners[1]
    //   Le point partagé "haut" = src.corners[2] = nbr.corners[0]
    //   ? src[0,2] ? nbr[1,0]
    //
    // Base = segment corners[1]?corners[2] (haut-gauche ? haut-droit)
    //   Voisin = ? à seqX, row-1
    //   ? corners: [0]=haut, [1]=bas-gauche, [2]=bas-droit
    //   Le point partagé "gauche" = src.corners[1] = nbr.corners[1]
    //   Le point partagé "droit"  = src.corners[2] = nbr.corners[2]
    //   ? src[1,2] ? nbr[1,2]
    return [
      {
        pos: posFromSeqX(sx - 1, row),
        side: 'left',
        srcIndices: [0, 1],
        nbrIndices: [2, 0],
      },
      {
        pos: posFromSeqX(sx + 1, row),
        side: 'right',
        srcIndices: [0, 2],
        nbrIndices: [1, 0],
      },
      {
        pos: posFromSeqX(sx, row - 1),
        side: 'base',
        srcIndices: [1, 2],
        nbrIndices: [1, 2],
      },
    ];
  }
}

/**
 * Vérifie que les valeurs d'un côté partagé correspondent entre deux tuiles.
 */
function edgeMatches(
  srcPlaced: [number, number, number],
  srcIndices: [number, number],
  nbrPlaced: [number, number, number],
  nbrIndices: [number, number],
): boolean {
  return (
    srcPlaced[srcIndices[0]] === nbrPlaced[nbrIndices[0]] &&
    srcPlaced[srcIndices[1]] === nbrPlaced[nbrIndices[1]]
  );
}

/**
 * Vérifie si un placement est légal sur le plateau.
 * - Au moins un voisin existant
 * - Tous les voisins existants ont des chiffres correspondants
 * - La position est libre
 */
export function isValidPlacement(
  board: Board,
  position: Position,
  placed: [number, number, number],
  isFirst: boolean,
): boolean {
  const key = posKey(position);

  // La position doit être libre
  if (board[key]) return false;

  // Premier placement : toujours valide (au centre)
  if (isFirst) return true;

  const neighbors = getNeighbors(position);
  let hasNeighbor = false;

  for (const nbr of neighbors) {
    const nbrTile = board[posKey(nbr.pos)];
    if (!nbrTile) continue;
    hasNeighbor = true;

    if (!edgeMatches(placed, nbr.srcIndices, nbrTile.placed, nbr.nbrIndices)) {
      return false;
    }
  }

  return hasNeighbor;
}

// ---------------------------------------------------------------------------
// Détection des bonus
// ---------------------------------------------------------------------------

/**
 * Retourne toutes les positions occupées voisines d'une position.
 */
function occupiedNeighbors(board: Board, pos: Position): PlacedTile[] {
  return getNeighbors(pos)
    .map((n) => board[posKey(n.pos)])
    .filter((t): t is PlacedTile => t !== undefined);
}

/**
 * Détecte si un pont a été formé par la tuile posée en `pos`.
 * Un pont : exactement 2 voisins occupés qui ne sont pas voisins entre eux.
 */
function isBridge(board: Board, pos: Position): boolean {
  const nbrs = getNeighbors(pos)
    .map((n) => ({ nbr: n, tile: board[posKey(n.pos)] }))
    .filter((x) => x.tile !== undefined);

  if (nbrs.length !== 2) return false;

  // Les deux voisins ne doivent pas être adjacents entre eux
  const pos0 = nbrs[0].nbr.pos;
  const pos1 = nbrs[1].nbr.pos;
  const neighbors0Keys = new Set(getNeighbors(pos0).map((n) => posKey(n.pos)));
  return !neighbors0Keys.has(posKey(pos1));
}

/**
 * Retourne les 6 positions formant un anneau hexagonal autour d'un sommet.
 * Un hexagone est formé par 6 triangles partageant un même sommet géométrique.
 *
 * Chaque triangle a 3 sommets. Pour chaque sommet, 6 triangles s'y rencontrent
 * en alternant visuellement △▽ autour de ce point.
 *
 * On identifie les sommets géométriques par leurs coordonnées dans la grille
 * séquentielle (seqX, row) et on énumère les 6 triangles autour de chaque sommet.
 */

/**
 * Retourne les 6 triangles autour d'un sommet géométrique.
 *
 * Un sommet géométrique est situé à l'intersection de triangles.
 * Dans la grille séquentielle, un sommet "haut" (pointe en haut) est touché par :
 *   - Le triangle visuel △ dont c'est le sommet (seqX, row) avec (seqX+row)%2==0
 *   - Les 5 autres triangles autour de ce point
 *
 * On distingue deux types de sommets :
 *   - "peak" (pointe vers le haut, ∧) : sommet supérieur d'un △ ou sommet sup d'un ▽
 *   - "valley" (pointe vers le bas, ∨) : sommet inférieur d'un ▽ ou sommet inf d'un △
 *
 * Autour d'un sommet de type "peak" (∧) situé entre (seqX, row-1) et (seqX, row) :
 *   Les 6 triangles dans l'ordre horaire sont :
 *     (seqX,   row-1)  -- le △ juste au-dessus à droite
 *     (seqX,   row)    -- le ▽ juste en dessous à droite
 *     (seqX-1, row)    -- le △ juste en dessous à gauche
 *     (seqX-1, row-1)  -- le ▽ juste au-dessus à gauche
 *     (seqX-2, row-1)  -- le △ en haut à gauche
 *     (seqX-1, row-1)  -- attention, double, recalcul nécessaire
 *
 * Méthode fiable : un sommet ∧ à la coordonnée pixel (px, py) est touché par
 * exactement les 6 triangles dont l'un des corners tombe sur ce point.
 *
 * Approche simplifiée : on utilise les seqX pour énumérer directement.
 */
function getTrianglesAroundVertex(vertexSeqX: number, vertexRow: number, vertexType: 'peak' | 'valley'): Position[] {
  const positions: Position[] = [];

  if (vertexType === 'peak') {
    // Sommet ∧ : pointe vers le haut
    // Ce sommet est le coin haut de certains triangles et le coin bas d'autres.
    // Les 6 triangles autour (en utilisant seqX) :
    //   - row supérieure (row-1) : les 3 triangles dont la base touche ce point
    //     seqX-2 (visuel △, corner[2]=bas-droit = ce sommet)
    //     seqX-1 (visuel ▽, corner[0]=bas = ce sommet)
    //     seqX   (visuel △, corner[1]=bas-gauche = ce sommet)
    //   - row inférieure (row) : les 3 triangles dont le sommet touche ce point
    //     seqX-1 (visuel △, corner[0]=haut = ce sommet)
    //     seqX   (visuel ▽, corner[1]=haut-gauche = ce sommet... non)
    //
    // Recalcul rigoureux avec le layout de la grille :
    // Un sommet ∧ est le point entre deux rangées. Il est :
    //   - corner[0] (sommet haut) du △ visuel à (seqX-1, row) si (seqX-1+row)%2==0
    //   - corner[0] (sommet bas) du ▽ visuel à (seqX-1, row-1) si (seqX-1+row-1)%2==1
    //
    // Plus simple : énumérons les 6 triangles par seqX offset.
    // Le sommet ∧ est à la frontière entre row-1 et row.
    // Triangles dans row-1 (dont la base est en bas, i.e. visuellement △) :
    //   seqX-2 si visuel △ : son corner bas-droit touche notre sommet
    //   seqX-1 si visuel ▽ : son corner bas touche notre sommet
    //   seqX   si visuel △ : son corner bas-gauche touche notre sommet
    // Triangles dans row (dont le sommet est en haut, i.e. visuellement ▽) :
    //   seqX-1 si visuel △ : son corner haut touche notre sommet
    //   seqX   si visuel ▽ : son corner haut-gauche touche notre sommet... non.
    //
    // Utilisons l'approche directe : on sait que pour un sommet ∧ identifié
    // comme le corner[0] d'un triangle visuellement △ à (seqX_tri, row_tri),
    // les 6 triangles autour sont :

    // Le sommet ∧ est le sommet haut d'un △ visuel.
    // En prenant ce △ comme référence à seqX=s, row=r :
    // Les 6 triangles autour de son sommet haut (corner[0]) sont :
    //   1. (s, r) lui-même — △
    //   2. (s-1, r) — ▽ voisin gauche, son corner[2]=haut-droit = ce sommet
    //   3. (s+1, r) — ▽ voisin droit, son corner[1]=haut-gauche = ce sommet
    //   4. (s-1, r-1) — △, son corner[2]=bas-droit = ce sommet
    //   5. (s, r-1) — ▽, son corner[0]=bas = ce sommet
    //   6. (s+1, r-1) — △, son corner[1]=bas-gauche = ce sommet
    // Mais (s-1,r-1) est un △ seulement si (s-1+r-1)%2==0, idem pour les autres.
    // En fait dans cette grille, la parité alterne, donc si (s+r)%2==0 (notre △),
    // alors (s-1+r)%2==1 (▽), (s+1+r)%2==1 (▽), (s-1+r-1)%2==0 (△), etc. ✓

    positions.push(posFromSeqX(vertexSeqX, vertexRow));       // △ principal
    positions.push(posFromSeqX(vertexSeqX - 1, vertexRow));   // ▽ à gauche
    positions.push(posFromSeqX(vertexSeqX + 1, vertexRow));   // ▽ à droite
    positions.push(posFromSeqX(vertexSeqX - 1, vertexRow - 1)); // △ haut-gauche
    positions.push(posFromSeqX(vertexSeqX, vertexRow - 1));     // ▽ au-dessus
    positions.push(posFromSeqX(vertexSeqX + 1, vertexRow - 1)); // △ haut-droit
  } else {
    // Sommet ∨ : pointe vers le bas
    // Symétrique : c'est le sommet bas d'un ▽ visuel.
    // Le ▽ de référence est à seqX=s, row=r avec (s+r)%2==1.
    // Les 6 triangles autour de son sommet bas (corner[0]) sont :
    positions.push(posFromSeqX(vertexSeqX, vertexRow));       // ▽ principal
    positions.push(posFromSeqX(vertexSeqX - 1, vertexRow));   // △ à gauche
    positions.push(posFromSeqX(vertexSeqX + 1, vertexRow));   // △ à droite
    positions.push(posFromSeqX(vertexSeqX - 1, vertexRow + 1)); // ▽ bas-gauche
    positions.push(posFromSeqX(vertexSeqX, vertexRow + 1));     // △ en-dessous
    positions.push(posFromSeqX(vertexSeqX + 1, vertexRow + 1)); // ▽ bas-droit
  }

  return positions;
}

/**
 * Retourne les anneaux hexagonaux potentiels contenant la tuile posée en `pos`.
 * Chaque triangle a 3 sommets, et chaque sommet peut être le centre d'un hexagone.
 * On retourne donc jusqu'à 3 anneaux de 6 positions.
 */
function getHexRings(pos: Position): Position[][] {
  const sx = seqXOf(pos);
  const { row } = pos;
  const rings: Position[][] = [];

  if (isVisuallyUp(pos)) {
    // △ : corners[0]=sommet-haut (∧), [1]=bas-gauche (∨), [2]=bas-droit (∨)

    // Sommet 0 (∧ en haut) : center = (sx, row) type peak
    rings.push(getTrianglesAroundVertex(sx, row, 'peak'));

    // Sommet 1 (∨ en bas-gauche) : c'est le corner bas du ▽ à (sx-1, row)
    // Ce sommet ∨ est le corner[0] du ▽ visuel à (sx-1, row+1)... non.
    // Le point bas-gauche du △(sx,row) = coin bas-gauche.
    // C'est aussi le coin bas du ▽(sx-1, row) et le coin bas-droit du △(sx-2, row).
    // C'est un sommet ∨. Le ▽ dont c'est le corner[0] est à (sx-1, row).
    // Vérifions : ▽(sx-1, row) a (sx-1+row)%2==1 ✓ (c'est bien un ▽ visuel).
    rings.push(getTrianglesAroundVertex(sx - 1, row, 'valley'));

    // Sommet 2 (∨ en bas-droit) : c'est le corner[0] du ▽(sx+1, row)
    rings.push(getTrianglesAroundVertex(sx + 1, row, 'valley'));
  } else {
    // ▽ : corners[0]=sommet-bas (∨), [1]=haut-gauche (∧), [2]=haut-droit (∧)

    // Sommet 0 (∨ en bas) : center = (sx, row) type valley
    rings.push(getTrianglesAroundVertex(sx, row, 'valley'));

    // Sommet 1 (∧ en haut-gauche) : c'est le corner[0] du △(sx-1, row)
    rings.push(getTrianglesAroundVertex(sx - 1, row, 'peak'));

    // Sommet 2 (∧ en haut-droit) : c'est le corner[0] du △(sx+1, row)
    rings.push(getTrianglesAroundVertex(sx + 1, row, 'peak'));
  }

  return rings;
}

/**
 * Vérifie si toutes les positions d'un anneau sont occupées sur le plateau.
 */
function isRingComplete(board: Board, ring: Position[]): boolean {
  return ring.every((p) => board[posKey(p)] !== undefined);
}

/**
 * Détecte le bonus formé par la tuile posée en `pos`.
 * Double hexagone > Hexagone > Pont (priorité décroissante).
 */
export function detectBonus(board: Board, pos: Position): Bonus | null {
  const rings = getHexRings(pos);
  const completedRings = rings.filter((ring) => isRingComplete(board, ring));

  if (completedRings.length === 0) {
    if (isBridge(board, pos)) {
      return { type: 'bridge', points: BONUS_BRIDGE };
    }
    return null;
  }

  // Vérifier si deux anneaux complets partagent une tuile (double hexagone)
  if (completedRings.length >= 2) {
    return { type: 'double-hexagon', points: BONUS_DOUBLE_HEXAGON };
  }

  return { type: 'hexagon', points: BONUS_HEXAGON };
}

// ---------------------------------------------------------------------------
// Calcul du score
// ---------------------------------------------------------------------------

/**
 * Calcule le score d'un placement selon le mode de jeu.
 */
function calcPlacementScore(
  tile: Triomino,
  bonus: Bonus | null,
  config: TriominoConfig,
): number {
  if (config.mode === 'kids') return 0;

  if (config.mode === 'simplified') {
    let pts = 1; // Placement = 1 pt
    if (bonus?.type === 'bridge') pts += 1;
    else if (bonus?.type === 'hexagon') pts += 1;
    else if (bonus?.type === 'double-hexagon') pts += 2;
    return pts;
  }

  // Mode standard
  const base = tile.values[0] + tile.values[1] + tile.values[2];
  const bonusPts = bonus ? bonus.points : 0;
  return base + bonusPts;
}

/**
 * Calcule le bonus de fin de partie (last tile).
 */
function calcLastTileBonus(config: TriominoConfig): number {
  if (config.mode === 'kids') return 0;
  if (config.mode === 'simplified') return 5;
  return LAST_TILE_BONUS;
}

/**
 * Somme des valeurs d'une liste de tuiles.
 */
function sumTiles(tiles: Triomino[]): number {
  return tiles.reduce((acc, t) => acc + t.values[0] + t.values[1] + t.values[2], 0);
}

// ---------------------------------------------------------------------------
// Moteur principal
// ---------------------------------------------------------------------------

export class TriominoEngine {
  /**
   * Initialise une nouvelle partie.
   */
  init(config: TriominoConfig): TriominoState {
    const rng = new SeededRandom(config.seed);

    // Générer et mélanger les tuiles
    const allTiles = generateAllTiles();
    rng.shuffle(allTiles);

    const { playerIds } = config;
    const handSize = playerIds.length === 2 ? 9 : 7;

    // Distribuer les tuiles
    const players: PlayerState[] = playerIds.map((id, i) => ({
      id,
      rack: allTiles.slice(i * handSize, (i + 1) * handSize),
      score: 0,
    }));

    const drawPile = allTiles.slice(playerIds.length * handSize);

    // Déterminer le premier joueur : celui avec la tuile au total le plus élevé
    const firstPlayerIndex = this.#determineFirstPlayer(players, rng);

    return {
      board: {},
      players,
      drawPile,
      currentPlayerIndex: firstPlayerIndex,
      drawsThisTurn: 0,
      phase: 'playing',
      winners: null,
      turn: 1,
      config,
      rngState: config.seed,
      lastDrawnTile: null,
    };
  }

  /**
   * Applique une action et retourne le nouvel état (immutable).
   */
  applyAction(state: TriominoState, action: TriominoAction, playerId: string): TriominoState {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error(`Action invalide : ${action.type} pour le joueur ${playerId}`);
    }

    switch (action.type) {
      case 'PLACE':
        return this.#applyPlace(state, action);
      case 'DRAW':
        return this.#applyDraw(state);
      case 'PASS':
        return this.#applyPass(state);
    }
  }

  /**
   * Vérifie si une action est valide pour un joueur.
   */
  isValidAction(state: TriominoState, action: TriominoAction, playerId: string): boolean {
    if (state.phase === 'finished') return false;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return false;

    switch (action.type) {
      case 'PLACE': {
        const tile = currentPlayer.rack.find((t) => t.id === action.triominoId);
        if (!tile) return false;
        // Vérifier que placed est une rotation valide de la tuile
        const [a, b, c] = tile.values;
        const validRotations = [[a, b, c], [b, c, a], [c, a, b]];
        const isValidRotation = validRotations.some(
          (r) => r[0] === action.placed[0] && r[1] === action.placed[1] && r[2] === action.placed[2],
        );
        if (!isValidRotation) return false;
        const isFirst = Object.keys(state.board).length === 0;
        return isValidPlacement(state.board, action.position, action.placed, isFirst);
      }
      case 'DRAW':
        // On peut piocher si : moins de 3 tirages ce tour ET pioche non vide
        return state.drawsThisTurn < MAX_DRAWS_PER_TURN && state.drawPile.length > 0;
      case 'PASS':
        // On peut passer si : pioche vide OU 3 tirages épuisés
        return state.drawPile.length === 0 || state.drawsThisTurn >= MAX_DRAWS_PER_TURN;
    }
  }

  /**
   * Retourne toutes les actions légales pour un joueur.
   */
  getLegalActions(state: TriominoState, playerId: string): TriominoAction[] {
    if (state.phase === 'finished') return [];

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return [];

    const actions: TriominoAction[] = [];
    const isFirst = Object.keys(state.board).length === 0;

    // Actions de placement
    for (const tile of currentPlayer.rack) {
      const placements = this.#findLegalPlacements(state.board, tile, isFirst);
      actions.push(...placements);
    }

    // Action de pioche
    if (state.drawsThisTurn < MAX_DRAWS_PER_TURN && state.drawPile.length > 0) {
      actions.push({ type: 'DRAW' });
    }

    // Action de passe
    if (state.drawPile.length === 0 || state.drawsThisTurn >= MAX_DRAWS_PER_TURN) {
      actions.push({ type: 'PASS' });
    }

    return actions;
  }

  /**
   * Retourne la vue d'un joueur (fog of war : valeurs des tuiles adverses masquées).
   */
  getPlayerView(state: TriominoState, playerId: string): PlayerView {
    const me = state.players.find((p) => p.id === playerId)!;

    const opponentRackSizes: Record<string, number> = {};
    const scores: Record<string, number> = {};
    for (const p of state.players) {
      scores[p.id] = p.score;
      if (p.id !== playerId) {
        opponentRackSizes[p.id] = p.rack.length;
      }
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
      lastDrawnTile: state.lastDrawnTile,
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

  // ---------------------------------------------------------------------------
  // Méthodes privées
  // ---------------------------------------------------------------------------

  /**
   * Détermine le premier joueur (plus fort total de tuile).
   * En cas d'égalité, choix aléatoire parmi les ex-aequo.
   */
  #determineFirstPlayer(players: PlayerState[], rng: SeededRandom): number {
    // Chaque joueur "pioche" une tuile (on prend la première de son rack)
    const totals = players.map((p) => {
      const t = p.rack[0];
      return t.values[0] + t.values[1] + t.values[2];
    });

    const max = Math.max(...totals);
    const candidates = totals
      .map((total, i) => (total === max ? i : -1))
      .filter((i) => i !== -1);

    if (candidates.length === 1) return candidates[0];
    return candidates[rng.int(0, candidates.length - 1)];
  }

  /** Applique un placement */
  #applyPlace(state: TriominoState, action: PlaceAction): TriominoState {
    const playerIdx = state.currentPlayerIndex;
    const player = state.players[playerIdx];
    const tile = player.rack.find((t) => t.id === action.triominoId)!;

    // Mettre à jour le plateau
    const key = posKey(action.position);
    const newBoard: Board = {
      ...state.board,
      [key]: { triomino: tile, position: action.position, placed: action.placed },
    };

    // Détecter le bonus
    const bonus = detectBonus(newBoard, action.position);

    // Calculer le score
    const points = calcPlacementScore(tile, bonus, state.config);

    // Retirer la tuile du rack
    const newRack = player.rack.filter((t) => t.id !== action.triominoId);

    // Mettre à jour le joueur
    const newPlayers = state.players.map((p, i) => {
      if (i !== playerIdx) return p;
      return { ...p, rack: newRack, score: p.score + points };
    });

    // Vérifier fin de partie : le joueur a posé sa dernière tuile
    if (newRack.length === 0) {
      return this.#handleLastTile(state, newBoard, newPlayers, playerIdx);
    }

    // Vérifier si la partie est bloquée
    const nextPlayerIndex = (playerIdx + 1) % state.players.length;
    const tentativeState: TriominoState = {
      ...state,
      board: newBoard,
      players: newPlayers,
      currentPlayerIndex: nextPlayerIndex,
      drawsThisTurn: 0,
      turn: state.turn + 1,
      lastDrawnTile: null,
    };

    if (this.#isBlocked(tentativeState)) {
      return this.#handleBlocked(tentativeState);
    }

    return tentativeState;
  }

  /** Applique un tirage de pioche */
  #applyDraw(state: TriominoState): TriominoState {
    const playerIdx = state.currentPlayerIndex;
    const newDrawPile = [...state.drawPile];
    const drawnTile = newDrawPile.pop()!;

    const newDrawsThisTurn = state.drawsThisTurn + 1;

    // Pénalité de pioche
    let penalty = DRAW_PENALTY;
    if (newDrawsThisTurn === MAX_DRAWS_PER_TURN) {
      penalty += TRIPLE_DRAW_EXTRA_PENALTY;
    }

    // Ajouter la tuile au rack du joueur et appliquer la pénalité
    const newPlayers = state.players.map((p, i) => {
      if (i !== playerIdx) return p;
      return {
        ...p,
        rack: [...p.rack, drawnTile],
        score: state.config.mode === 'kids' ? p.score : p.score - penalty,
      };
    });

    return {
      ...state,
      players: newPlayers,
      drawPile: newDrawPile,
      drawsThisTurn: newDrawsThisTurn,
      lastDrawnTile: drawnTile,
    };
  }

  /** Applique un passage de tour */
  #applyPass(state: TriominoState): TriominoState {
    const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    const tentativeState: TriominoState = {
      ...state,
      currentPlayerIndex: nextPlayerIndex,
      drawsThisTurn: 0,
      turn: state.turn + 1,
      lastDrawnTile: null,
    };

    if (this.#isBlocked(tentativeState)) {
      return this.#handleBlocked(tentativeState);
    }

    return tentativeState;
  }

  /** Gère la fin de partie quand un joueur pose sa dernière tuile */
  #handleLastTile(
    state: TriominoState,
    newBoard: Board,
    newPlayers: PlayerState[],
    winnerIdx: number,
  ): TriominoState {
    const bonus = calcLastTileBonus(state.config);

    // Additionner les tuiles restantes des adversaires
    let extraPoints = 0;
    if (state.config.mode !== 'kids') {
      for (let i = 0; i < newPlayers.length; i++) {
        if (i !== winnerIdx) {
          extraPoints += sumTiles(newPlayers[i].rack);
        }
      }
    }

    const finalPlayers = newPlayers.map((p, i) => {
      if (i !== winnerIdx) return p;
      return { ...p, score: p.score + bonus + extraPoints };
    });

    const winnerId = finalPlayers[winnerIdx].id;

    return {
      ...state,
      board: newBoard,
      players: finalPlayers,
      phase: 'finished',
      winners: [winnerId],
      drawsThisTurn: 0,
      lastDrawnTile: null,
    };
  }

  /** Gère la fin de partie par blocage */
  #handleBlocked(state: TriominoState): TriominoState {
    // Chaque joueur soustrait la somme de ses tuiles restantes
    const finalPlayers =
      state.config.mode === 'kids'
        ? state.players
        : state.players.map((p) => ({
            ...p,
            score: p.score - sumTiles(p.rack),
          }));

    // Le gagnant est celui avec le score le plus élevé
    const maxScore = Math.max(...finalPlayers.map((p) => p.score));
    const winners = finalPlayers
      .filter((p) => p.score === maxScore)
      .map((p) => p.id);

    // En mode kids, le gagnant est celui avec le moins de tuiles
    let finalWinners = winners;
    if (state.config.mode === 'kids') {
      const minRack = Math.min(...state.players.map((p) => p.rack.length));
      finalWinners = state.players
        .filter((p) => p.rack.length === minRack)
        .map((p) => p.id);
    }

    return {
      ...state,
      players: finalPlayers,
      phase: 'finished',
      winners: finalWinners,
    };
  }

  /**
   * Vérifie si la partie est bloquée (aucun joueur ne peut poser ni piocher).
   */
  #isBlocked(state: TriominoState): boolean {
    if (state.drawPile.length > 0) return false;

    const isFirst = Object.keys(state.board).length === 0;

    for (const player of state.players) {
      for (const tile of player.rack) {
        const placements = this.#findLegalPlacements(state.board, tile, isFirst);
        if (placements.length > 0) return false;
      }
    }

    return true;
  }

  /**
   * Trouve tous les placements légaux pour une tuile sur le plateau actuel.
   */
  #findLegalPlacements(
    board: Board,
    tile: Triomino,
    isFirst: boolean,
  ): PlaceAction[] {
    const actions: PlaceAction[] = [];

    if (isFirst) {
      // Premier placement : au centre, toutes les orientations
      const centerPos: Position = { col: 0, row: 0, orientation: 'UP' };
      for (const placed of this.#getAllRotations(tile)) {
        actions.push({ type: 'PLACE', triominoId: tile.id, position: centerPos, placed });
      }
      return actions;
    }

    // Trouver les positions candidates (voisins des tuiles existantes)
    const candidates = new Set<PosKey>();
    for (const key of Object.keys(board)) {
      const placedTile = board[key];
      for (const nbr of getNeighbors(placedTile.position)) {
        const nbrKey = posKey(nbr.pos);
        if (!board[nbrKey]) {
          candidates.add(nbrKey);
        }
      }
    }

    for (const candidateKey of candidates) {
      const parts = candidateKey.split(',');
      const pos: Position = {
        col: parseInt(parts[0]),
        row: parseInt(parts[1]),
        orientation: parts[2] as Orientation,
      };

      for (const placed of this.#getAllRotations(tile)) {
        if (isValidPlacement(board, pos, placed, false)) {
          actions.push({ type: 'PLACE', triominoId: tile.id, position: pos, placed });
        }
      }
    }

    return actions;
  }

  /**
   * Retourne toutes les rotations distinctes d'une tuile.
   * Une tuile triangulaire a 3 rotations possible.
   */
  #getAllRotations(tile: Triomino): [number, number, number][] {
    const [a, b, c] = tile.values;
    const rotations: [number, number, number][] = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ];

    // Dédoublonner (ex: tuile [1,1,1] n'a qu'une rotation utile)
    const seen = new Set<string>();
    return rotations.filter((r) => {
      const key = r.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export default TriominoEngine;
