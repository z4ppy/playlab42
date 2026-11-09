/**
 * Rendu DOM de la grille : 7 boutons-colonnes de 6 cases chacun.
 *
 * Chaque colonne est un vrai <button> : Entrée et Espace jouent nativement,
 * le module partagé `board-navigation.js` gère les flèches et un seul arrêt Tab.
 * Les animations (chute, aperçu fantôme, ligne gagnante) sont en CSS et
 * désactivées par `prefers-reduced-motion` (voir lib/ui.css).
 */

import { createBoardNavigation } from '../../board-navigation.js';
import { COLUMNS, ROWS, landingRow } from '../engine/board.js';
import { columnLabel } from './text.js';

/**
 * Crée un élément avec ses classes.
 * @param {string} tag - Balise
 * @param {string} className - Classes CSS
 * @returns {HTMLElement}
 */
function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/**
 * Construit le bouton d'une colonne et ses 6 cases.
 * @param {number} col - Colonne (0 à 6)
 * @returns {HTMLButtonElement}
 */
function buildColumn(col) {
  const button = /** @type {HTMLButtonElement} */ (element('button', 'p4-column'));
  button.type = 'button';
  button.dataset.col = String(col);
  for (let row = 0; row < ROWS; row++) {
    const cell = element('span', 'p4-cell');
    cell.dataset.row = String(row);
    cell.append(element('span', 'p4-disc'));
    button.append(cell);
  }
  return button;
}

/**
 * @typedef {Object} BoardRenderOptions
 * @property {boolean} interactive - L'humain peut-il jouer maintenant ?
 * @property {'red' | 'yellow'} turnColor - Couleur de l'aperçu fantôme
 * @property {number | null} [hintColumn] - Colonne conseillée à souligner
 * @property {boolean} [animateLast] - Faire tomber le dernier jeton (nouveau coup)
 */

/**
 * Monte la grille dans `root` et renvoie ses commandes de rendu.
 * @param {HTMLElement} root - Conteneur de la grille
 * @param {{ onPlay: (column: number) => void }} handlers - Coup demandé par l'utilisateur
 * @returns {{ render: (state: import('../engine.js').Puissance4State, options: BoardRenderOptions) => void, focusColumn: (col: number) => void }}
 */
export function createBoardView(root, { onPlay }) {
  const columns = Array.from({ length: COLUMNS }, (_, col) => buildColumn(col));
  root.replaceChildren(...columns);
  columns.forEach((button, col) => button.addEventListener('click', () => onPlay(col)));
  const navigation = createBoardNavigation(root, COLUMNS);
  // Nombre de coups au moment de la dernière chute animée : le jeton garde sa
  // classe d'animation tant qu'il reste le dernier, même si l'on redessine.
  let animatedMoveCount = -1;

  return {
    render(state, options) {
      if (options.animateLast) {
        animatedMoveCount = state.moves.length;
      }
      navigation.beforeRender();
      root.classList.toggle('is-interactive', options.interactive);
      root.classList.toggle('is-over', state.gameOver);
      root.dataset.turn = options.turnColor;
      const context = {
        state,
        options,
        last: state.moves.at(-1),
        dropping: animatedMoveCount === state.moves.length,
        winning: new Set((state.winningLine ?? []).map(({ row, col }) => `${row},${col}`)),
      };
      columns.forEach((button, col) => renderColumn(button, col, context));
      navigation.afterRender();
    },
    focusColumn(col) {
      columns[col]?.focus();
    },
  };
}

/**
 * Met à jour une colonne : libellé, disponibilité, indice et cases.
 * @param {HTMLButtonElement} button - Bouton de la colonne
 * @param {number} col - Colonne
 * @param {object} context - État et options du rendu courant
 */
function renderColumn(button, col, context) {
  const { state, options } = context;
  const landing = landingRow(state.board, col);
  button.setAttribute('aria-label', columnLabel(state, col));
  button.setAttribute('aria-disabled', String(!options.interactive || landing < 0));
  button.classList.toggle('is-hint', options.hintColumn === col);
  [...button.children].forEach((cell, row) => {
    const isLast = context.last?.row === row && context.last?.col === col;
    cell.classList.toggle('is-landing', row === landing);
    cell.firstElementChild.className = discClass(state.board[row][col], {
      winning: context.winning.has(`${row},${col}`),
      last: isLast,
      dropping: isLast && context.dropping,
    });
    cell.style.setProperty('--drop-rows', String(row + 1));
  });
}

/**
 * Classes d'un jeton selon sa couleur et son rôle.
 * @param {'red' | 'yellow' | null} color - Couleur, ou null si la case est vide
 * @param {{ winning: boolean, last: boolean, dropping: boolean }} flags - Rôles du jeton
 * @returns {string}
 */
export function discClass(color, { winning, last, dropping }) {
  if (color === null) {
    return 'p4-disc';
  }
  const roles = [winning && 'is-winning', last && 'is-last', dropping && 'is-dropping'].filter(Boolean);
  return ['p4-disc', `p4-disc--${color}`, ...roles].join(' ');
}
