/**
 * @file Rendu du plateau et textes d'état du Go 9x9, sans état propre.
 */

/**
 * @param {number} value - Contenu de l'intersection (0, 1 ou 2).
 * @returns {string} Description accessible de l'intersection.
 */
export function describeStone(value) {
  if (value === 1) { return 'pierre noire'; }
  return value === 2 ? 'pierre blanche' : 'vide';
}

/**
 * @param {object|null} lastMove - Dernier coup de l'état.
 * @param {number} x - Colonne.
 * @param {number} y - Ligne.
 * @returns {boolean} Vrai si le dernier coup est une pose à cette intersection.
 */
export function isLastMove(lastMove, x, y) {
  return Boolean(lastMove) && lastMove.type === 'place' && lastMove.x === x && lastMove.y === y;
}

/**
 * Met à jour une intersection du plateau.
 * @param {HTMLElement} cell - Intersection existante.
 * @param {object} state - État du moteur.
 * @param {boolean} interactive - Vrai si un joueur humain peut jouer.
 * @param {Document} doc - Document utilisé pour créer les pierres.
 */
export function renderCell(cell, state, interactive, doc) {
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const value = state.board[y][x];
  const label = `Ligne ${y + 1}, colonne ${x + 1}, ${describeStone(value)}`;
  cell.setAttribute('aria-label', label);
  cell.setAttribute('aria-disabled', String(!interactive || value !== 0));
  cell.innerHTML = '';
  cell.classList.remove('last-move');
  if (value === 1 || value === 2) {
    const stone = doc.createElement('div');
    stone.className = `stone ${value === 1 ? 'black' : 'white'}`;
    cell.appendChild(stone);
  }
  if (isLastMove(state.lastMove, x, y)) {
    cell.classList.add('last-move');
    cell.setAttribute('aria-label', `${label}, dernier coup`);
  }
}

/**
 * @param {object} state - État terminé.
 * @param {string} humanId - Identifiant de Noir.
 * @param {string} opponentId - Identifiant de Blanc.
 * @returns {string} Résultat de la partie.
 */
export function endStatus(state, humanId, opponentId) {
  if (state.winners === null) { return 'Partie terminée : égalité'; }
  if (state.winners.includes(humanId)) { return 'Victoire Noir'; }
  return state.winners.includes(opponentId) ? 'Victoire Blanc' : 'Partie terminée';
}

/**
 * @param {object} state - État du moteur.
 * @param {{humanId: string, opponentId: string, bot: object|null, currentHuman: string|null}} context - Contexte de la page.
 * @returns {string} Texte de statut.
 */
export function statusText(state, { humanId, opponentId, bot, currentHuman }) {
  if (state.gameOver) { return endStatus(state, humanId, opponentId); }
  if (bot) { return currentHuman ? 'À vous (Noir)' : 'Le bot joue (Blanc)'; }
  return `Au tour du joueur ${state.currentPlayerId === humanId ? 'Noir' : 'Blanc'}`;
}

/**
 * @param {object} state - État du moteur.
 * @returns {{black: string, white: string}} Scores affichés.
 */
export function scoreTexts(state) {
  if (!state.scores) { return { black: '-', white: '-' }; }
  return { black: state.scores.black.toFixed(1), white: state.scores.white.toFixed(1) };
}
