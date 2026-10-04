/**
 * Rendu du damier de Dames : une case-bouton par position, ligne par ligne.
 * Les droits de jouer viennent de l'état, de la sélection et des coups légaux
 * fournis par le moteur ; ce module ne recalcule aucune règle.
 */

const BOARD_SIZE = 10;

/**
 * @typedef {Object} BoardView
 * @property {{board: Array, currentPlayer: number, status: string}} state État du moteur.
 * @property {{row: number, col: number} | null} selected Case sélectionnée.
 * @property {Array<{to: {row: number, col: number}}>} moves Coups légaux de la case sélectionnée.
 * @property {boolean} humanTurn Le joueur actif est un humain.
 */

const isSameSquare = (square, row, col) => square?.row === row && square?.col === col;

/**
 * @param {{player: number, type: string}} piece Pièce du moteur.
 * @returns {HTMLDivElement} Pièce dessinée, dame comprise.
 */
function createPieceElement(piece) {
  const element = document.createElement('div');
  element.className = `piece ${piece.player === 0 ? 'white' : 'black'}`;
  if (piece.type === 'king') {
    element.classList.add('king');
  }
  return element;
}

function describePiece(piece, currentPlayer) {
  const kind = piece.type === 'king' ? 'dame' : 'pion';
  const owner = piece.player === 0 ? 'blanc' : 'noir';
  return `${kind} ${owner}${piece.player === currentPlayer ? ', joueur actif' : ''}`;
}

/**
 * @param {number} row Ligne.
 * @param {number} col Colonne.
 * @param {object | null} piece Pièce de la case.
 * @param {{currentPlayer: number, legalTarget: boolean}} context Joueur actif et destination légale.
 * @returns {string} Description accessible de la case.
 */
function describeSquare(row, col, piece, { currentPlayer, legalTarget }) {
  const description = piece ? describePiece(piece, currentPlayer) : 'vide';
  return `Ligne ${row + 1}, colonne ${col + 1}, ${description}${legalTarget ? ', destination autorisée' : ''}`;
}

function canInteract(view, piece, legalTarget) {
  const { state, humanTurn } = view;
  if (state.status !== 'playing' || !humanTurn) {
    return false;
  }
  return legalTarget || piece?.player === state.currentPlayer;
}

function createSquare(view, row, col, onSquareClick) {
  const { state, selected, moves } = view;
  const square = document.createElement('button');
  square.type = 'button';
  square.className = 'square';
  square.dataset.row = row;
  square.dataset.col = col;
  square.classList.add((row + col) % 2 === 1 ? 'dark' : 'light');
  const piece = state.board[row][col];
  if (piece) {
    square.appendChild(createPieceElement(piece));
  }
  const isSelected = isSameSquare(selected, row, col);
  if (isSelected) {
    square.classList.add('selected');
  }
  const legalTarget = moves.some((move) => isSameSquare(move.to, row, col));
  if (legalTarget) {
    square.classList.add('possible-move');
  }
  square.setAttribute('aria-label', describeSquare(row, col, piece, { currentPlayer: state.currentPlayer, legalTarget }));
  square.setAttribute('aria-pressed', String(isSelected));
  square.setAttribute('aria-disabled', String(!canInteract(view, piece, legalTarget)));
  square.addEventListener('click', () => onSquareClick(row, col));
  return square;
}

/**
 * Remplace le contenu du plateau par les cases de la vue.
 * @param {HTMLElement} boardEl Conteneur du damier.
 * @param {BoardView} view État affiché.
 * @param {(row: number, col: number) => void} onSquareClick Réaction à un clic de case.
 */
export function renderCheckersBoard(boardEl, view, onSquareClick) {
  boardEl.innerHTML = '';
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      boardEl.appendChild(createSquare(view, row, col, onSquareClick));
    }
  }
}
