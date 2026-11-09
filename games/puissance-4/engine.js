/**
 * Moteur de Puissance 4 — isomorphe, pur et déterministe.
 *
 * Règles : deux joueurs lâchent à tour de rôle un jeton dans l'une des
 * 7 colonnes ; il tombe sur la case libre la plus basse. Le premier qui aligne
 * 4 jetons (horizontale, verticale ou diagonale) gagne ; grille pleine = nul.
 *
 * Le moteur ne touche ni au DOM, ni au stockage, ni à l'horloge : l'état est un
 * objet JSON lisible, jamais modifié en place. Les animations, l'IA et la
 * temporisation appartiennent au client.
 *
 * @see lib/types/game-engine.ts
 */

import {
  COLORS,
  createBoard,
  findWinningLine,
  isBoardFull,
  isColumnIndex,
  landingRow,
  withDisc,
} from './engine/board.js';

/**
 * @typedef {import('./engine/board.js').Color} Color
 * @typedef {import('./engine/board.js').Board} Board
 * @typedef {import('./engine/board.js').Cell} Cell
 *
 * @typedef {Object} Puissance4Config
 * @property {number} seed - Seed de la partie (conservée pour le replay ; le jeu n'a pas de hasard)
 * @property {[string, string]} playerIds - Joueur Rouge puis joueur Jaune
 * @property {string} [firstPlayerId] - Joueur qui commence (Rouge par défaut)
 *
 * @typedef {Object} Move
 * @property {string} playerId - Auteur du coup
 * @property {number} col - Colonne jouée (0 à 6)
 * @property {number} row - Ligne d'arrivée (0 = haut)
 *
 * @typedef {Object} Puissance4State
 * @property {Board} board - Grille 6 × 7, ligne 0 en haut
 * @property {[string, string]} playerIds - Joueur Rouge puis joueur Jaune
 * @property {Record<string, Color>} colors - Couleur de chaque joueur
 * @property {string} firstPlayerId - Joueur qui a commencé
 * @property {string} currentPlayerId - Joueur dont c'est le tour
 * @property {Move[]} moves - Historique complet des coups
 * @property {number} turn - Numéro du coup à jouer (1 au départ)
 * @property {boolean} gameOver - Partie terminée ?
 * @property {string[] | null} winners - Gagnant, ou null (en cours ou nul)
 * @property {Cell[] | null} winningLine - Cases de l'alignement gagnant, pour l'affichage
 * @property {number} rngState - Seed conservée (aucun tirage aléatoire dans les règles)
 *
 * @typedef {{ type: 'drop', column: number }} Puissance4Action
 */

/**
 * Vérifie la forme d'une action, sans regarder la grille.
 * @param {unknown} action - Action reçue
 * @returns {action is Puissance4Action}
 */
function isDropAction(action) {
  return action !== null
    && typeof action === 'object'
    && !Array.isArray(action)
    && action.type === 'drop'
    && isColumnIndex(action.column);
}

/**
 * Valide la configuration et renvoie les deux joueurs et le premier à jouer.
 * @param {Puissance4Config} config - Configuration reçue
 * @returns {{ playerIds: [string, string], firstPlayerId: string }}
 * @throws {Error} Si les joueurs ou le premier joueur sont invalides
 */
function readPlayers(config) {
  const ids = config?.playerIds;
  const valid = Array.isArray(ids) && ids.length === 2
    && ids.every((id) => typeof id === 'string' && id.length > 0) && ids[0] !== ids[1];
  if (!valid) {
    throw new Error('Puissance 4 : il faut exactement deux identifiants de joueurs distincts.');
  }
  const firstPlayerId = config.firstPlayerId ?? ids[0];
  if (!ids.includes(firstPlayerId)) {
    throw new Error(`Puissance 4 : premier joueur inconnu « ${firstPlayerId} ».`);
  }
  return { playerIds: [ids[0], ids[1]], firstPlayerId };
}

/**
 * Moteur de jeu Puissance 4, conforme au contrat GameEngine du lab.
 */
export class Puissance4Engine {
  /**
   * Initialise une partie. Le premier identifiant joue Rouge, le second Jaune.
   * @param {Puissance4Config} config - Configuration de la partie
   * @returns {Puissance4State}
   */
  init(config) {
    const { playerIds, firstPlayerId } = readPlayers(config);
    return {
      board: createBoard(),
      playerIds,
      colors: { [playerIds[0]]: COLORS[0], [playerIds[1]]: COLORS[1] },
      firstPlayerId,
      currentPlayerId: firstPlayerId,
      moves: [],
      turn: 1,
      gameOver: false,
      winners: null,
      winningLine: null,
      rngState: Number(config.seed) >>> 0,
    };
  }

  /**
   * Lâche un jeton et renvoie le nouvel état ; l'état reçu reste intact.
   * @param {Puissance4State} state - État courant
   * @param {Puissance4Action} action - Colonne choisie
   * @param {string} playerId - Joueur qui agit
   * @returns {Puissance4State}
   * @throws {Error} Si l'action est invalide (partie finie, mauvais joueur, colonne pleine…)
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error(`Puissance 4 : coup invalide pour ${String(playerId)}.`);
    }
    const cell = { row: landingRow(state.board, action.column), col: action.column };
    const board = withDisc(state.board, cell, state.colors[playerId]);
    const winningLine = findWinningLine(board, cell);
    const gameOver = winningLine !== null || isBoardFull(board);
    return {
      ...state,
      board,
      moves: [...state.moves, { playerId, col: cell.col, row: cell.row }],
      turn: state.turn + 1,
      currentPlayerId: gameOver ? state.currentPlayerId : this.#opponentOf(state, playerId),
      gameOver,
      winners: winningLine ? [playerId] : null,
      winningLine,
    };
  }

  /**
   * Indique si le joueur peut lâcher un jeton dans la colonne demandée.
   * @param {Puissance4State} state - État courant
   * @param {unknown} action - Action à valider
   * @param {string} playerId - Joueur qui veut jouer
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    return !state.gameOver
      && playerId === state.currentPlayerId
      && isDropAction(action)
      && landingRow(state.board, action.column) >= 0;
  }

  /**
   * Colonnes encore jouables, de gauche à droite.
   * @param {Puissance4State} state - État courant
   * @param {string} playerId - Joueur interrogé
   * @returns {Puissance4Action[]} Vide si ce n'est pas son tour ou si la partie est finie
   */
  getValidActions(state, playerId) {
    if (state.gameOver || playerId !== state.currentPlayerId) {
      return [];
    }
    return state.board[0].flatMap((cell, column) => (cell === null ? [{ type: 'drop', column }] : []));
  }

  /**
   * Vue d'un joueur : information complète, rien n'est caché au Puissance 4.
   * @param {Puissance4State} state - État courant
   * @param {string} _playerId - Joueur (sans effet)
   * @returns {Puissance4State}
   */
  getPlayerView(state, _playerId) {
    return state;
  }

  /**
   * @param {Puissance4State} state - État courant
   * @returns {boolean}
   */
  isGameOver(state) {
    return state.gameOver;
  }

  /**
   * @param {Puissance4State} state - État courant
   * @returns {string[] | null} Gagnant, ou null en cours de partie et en cas de nul
   */
  getWinners(state) {
    return state.winners;
  }

  /**
   * @param {Puissance4State} state - État courant
   * @returns {string}
   */
  getCurrentPlayer(state) {
    return state.currentPlayerId;
  }

  /**
   * @param {Puissance4State} state - État courant
   * @param {string} playerId - Joueur dont on cherche l'adversaire
   * @returns {string}
   */
  #opponentOf(state, playerId) {
    return state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];
  }
}

export default Puissance4Engine;
