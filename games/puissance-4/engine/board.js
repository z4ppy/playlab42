/**
 * Grille de Puissance 4 : dimensions, gravité et détection des alignements.
 *
 * Fonctions pures sur une grille lisible `board[ligne][colonne]`, la ligne 0
 * étant en haut (comme à l'écran). Aucune ne modifie la grille reçue.
 * Le module IA utilise une autre représentation (bitboards) pour la vitesse ;
 * les tests vérifient que les deux détections de victoire concordent.
 */

/** Nombre de colonnes de la grille. */
export const COLUMNS = 7;

/** Nombre de lignes de la grille. */
export const ROWS = 6;

/** Nombre de jetons alignés nécessaires pour gagner. */
export const CONNECT = 4;

/** Couleurs des jetons, dans l'ordre des joueurs de la configuration. */
export const COLORS = Object.freeze(['red', 'yellow']);

/**
 * Directions d'alignement à explorer depuis un jeton : horizontale, verticale
 * et les deux diagonales. La direction opposée est parcourue par symétrie.
 */
const DIRECTIONS = Object.freeze([
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]);

/**
 * @typedef {'red' | 'yellow'} Color
 * @typedef {(Color | null)[][]} Board
 * @typedef {{ row: number, col: number }} Cell
 */

/**
 * Crée une grille vide de ROWS × COLUMNS.
 * @returns {Board}
 */
export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
}

/**
 * Indique si un numéro de colonne existe sur la grille.
 * @param {unknown} col - Valeur à contrôler
 * @returns {boolean}
 */
export function isColumnIndex(col) {
  return Number.isInteger(col) && col >= 0 && col < COLUMNS;
}

/**
 * Ligne où atterrit un jeton lâché dans une colonne (gravité).
 * @param {Board} board - Grille courante
 * @param {number} col - Colonne visée
 * @returns {number} Ligne d'arrivée, ou -1 si la colonne est pleine
 */
export function landingRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      return row;
    }
  }
  return -1;
}

/**
 * Copie la grille en posant un jeton : seule la ligne modifiée est recopiée.
 * @param {Board} board - Grille d'origine (non modifiée)
 * @param {Cell} cell - Case à remplir
 * @param {Color} color - Couleur du jeton
 * @returns {Board}
 */
export function withDisc(board, { row, col }, color) {
  return board.map((line, index) => (index === row
    ? line.map((value, column) => (column === col ? color : value))
    : line));
}

/**
 * Compte les jetons de même couleur contigus dans une direction, sans la case de départ.
 * @param {Board} board - Grille
 * @param {Cell} start - Case de départ
 * @param {number} dRow - Pas vertical
 * @param {number} dCol - Pas horizontal
 * @returns {Cell[]} Cases contiguës, de la plus proche à la plus lointaine
 */
function collectRun(board, { row, col }, dRow, dCol) {
  const color = board[row][col];
  const run = [];
  let r = row + dRow;
  let c = col + dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && board[r][c] === color) {
    run.push({ row: r, col: c });
    r += dRow;
    c += dCol;
  }
  return run;
}

/**
 * Cherche un alignement gagnant passant par la case qui vient d'être jouée.
 * Il suffit de regarder autour du dernier jeton : un alignement plus ancien
 * aurait déjà terminé la partie.
 * @param {Board} board - Grille après le coup
 * @param {Cell} last - Case du dernier jeton posé
 * @returns {Cell[] | null} Toutes les cases de l'alignement (4 ou plus), triées par colonne puis ligne
 */
export function findWinningLine(board, last) {
  for (const [dRow, dCol] of DIRECTIONS) {
    const backward = collectRun(board, last, -dRow, -dCol).reverse();
    const forward = collectRun(board, last, dRow, dCol);
    const line = [...backward, { row: last.row, col: last.col }, ...forward];
    if (line.length >= CONNECT) {
      return line.sort((a, b) => a.col - b.col || a.row - b.row);
    }
  }
  return null;
}

/**
 * Indique si la rangée du haut est pleine, donc toute la grille.
 * @param {Board} board - Grille
 * @returns {boolean}
 */
export function isBoardFull(board) {
  return board[0].every((cell) => cell !== null);
}
