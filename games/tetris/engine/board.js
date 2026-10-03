/** Matrices initiales SRS, protégées contre les mutations extérieures. */
export const PIECES = Object.freeze(Object.fromEntries(Object.entries({
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
}).map(([type, matrix]) => [
  type, Object.freeze(matrix.map(row => Object.freeze(row))),
])));

/**
 * Retourne les quatre cellules absolues d'une pièce (y négatif autorisé).
 * @param {import('../engine.js').Piece} piece - Pièce SRS.
 * @returns {{x:number,y:number}[]} Cellules occupées.
 */
export function getCells(piece) {
  const matrix = PIECES[piece.type];
  const size = matrix.length;
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!matrix[y][x]) { continue; }
      let rx = x;
      let ry = y;
      if (piece.type !== 'O') {
        for (let i = 0; i < piece.rotation; i++) {
          [rx, ry] = [size - 1 - ry, rx];
        }
      }
      cells.push({ x: piece.x + rx, y: piece.y + ry });
    }
  }
  return cells;
}

/** @param {number} level - Niveau positif. @returns {number} Millisecondes par case. */
export function getDropInterval(level) {
  return Math.max(50, Math.floor(1000 * 0.8 ** (Math.max(1, level) - 1)));
}

/** Détecte murs, plancher et blocs sans considérer le haut comme un mur. */
export function fits(state, piece) {
  return getCells(piece).every(({ x, y }) =>
    x >= 0 && x < 10 && y < 20 && (y < 0 || state.board[y][x] === null));
}

/**
 * Projette la pièce sans modifier l'état.
 * @param {import('../engine.js').TetrisState} state - État.
 * @returns {import('../engine.js').Piece|null} Position de verrouillage.
 */
export function getGhostPiece(state) {
  if (!state.active) { return null; }
  const ghost = { ...state.active };
  while (fits(state, { ...ghost, y: ghost.y + 1 })) { ghost.y++; }
  return ghost;
}

/**
 * Une rotation T et trois coins occupés distinguent spin complet et mini.
 * Les deux coins avant ou le cinquième kick SRS font un spin complet.
 * @param {import('../engine.js').TetrisState} state - État avant pose.
 * @returns {string|null} 'T-spin', 'T-spin mini' ou null.
 */
export function getSpin(state) {
  const piece = state.active;
  if (piece.type !== 'T' || !state.lastRotation) { return null; }
  const x = piece.x + 1;
  const y = piece.y + 1;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
    const cx = x + dx;
    const cy = y + dy;
    return cx < 0 || cx >= 10 || cy < 0 || cy >= 20 || state.board[cy][cx] !== null;
  });
  if (corners.filter(Boolean).length < 3) { return null; }
  const front = [[0, 1], [1, 2], [2, 3], [3, 0]][piece.rotation];
  return (front.every(index => corners[index]) || state.lastRotation.kick === 4)
    ? 'T-spin' : 'T-spin mini';
}

/** Pose visible et suppression des lignes ; le bilan de score est distinct. */
export function placeAndClear(state, cells) {
  for (const { x, y } of cells) { state.board[y][x] = state.active.type; }
  const remaining = state.board.filter(row => row.some(cell => cell === null));
  const lines = 20 - remaining.length;
  state.board = [
    ...Array.from({ length: lines }, () => Array(10).fill(null)), ...remaining,
  ];
  return lines;
}
