/**
 * Tic-Tac-Toe Engine - Moteur de jeu isomorphe
 * Fonctionne côté client ET serveur
 *
 * @see openspec/specs/game-engine/spec.md
 */

/**
 * @typedef {'X' | 'O' | null} Cell
 * @typedef {[Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]} Board
 *
 * @typedef {Object} TicTacToeState
 * @property {Board} board - Grille 3x3 (indices 0-8)
 * @property {string} currentPlayerId - ID du joueur actif
 * @property {boolean} gameOver - Partie terminée ?
 * @property {string[]|null} winners - Gagnant(s) ou null si nul
 * @property {number} turn - Numéro du tour
 * @property {number} rngState - État du RNG (pour replay)
 *
 * @typedef {Object} TicTacToeAction
 * @property {'place'} type - Type d'action
 * @property {number} position - Position 0-8
 *
 * @typedef {Object} TicTacToeConfig
 * @property {number} seed - Seed pour le RNG
 * @property {[string, string]} playerIds - IDs des 2 joueurs
 */

// Lignes gagnantes (indices)
const WINNING_LINES = [
  [0, 1, 2], // Ligne 1
  [3, 4, 5], // Ligne 2
  [6, 7, 8], // Ligne 3
  [0, 3, 6], // Colonne 1
  [1, 4, 7], // Colonne 2
  [2, 5, 8], // Colonne 3
  [0, 4, 8], // Diagonale \
  [2, 4, 6], // Diagonale /
];

/**
 * Moteur de jeu Tic-Tac-Toe
 */
export class TicTacToeEngine {
  /**
   * Initialise une nouvelle partie
   * @param {TicTacToeConfig} config
   * @returns {TicTacToeState}
   */
  init(config) {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      currentPlayerId: config.playerIds[0],
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
      playerIds: config.playerIds,
      symbols: {
        [config.playerIds[0]]: 'X',
        [config.playerIds[1]]: 'O',
      },
    };
  }

  /**
   * Applique une action et retourne le nouvel état
   * @param {TicTacToeState} state
   * @param {TicTacToeAction} action
   * @param {string} playerId
   * @returns {TicTacToeState}
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    // Copier l'état (immutabilité)
    const newBoard = [...state.board];
    newBoard[action.position] = state.symbols[playerId];

    const newState = {
      ...state,
      board: newBoard,
      turn: state.turn + 1,
    };

    // Vérifier victoire
    const winner = this.#checkWinner(newBoard);
    if (winner) {
      newState.gameOver = true;
      // Trouver le playerId correspondant au symbole gagnant
      const winnerId = Object.entries(state.symbols).find(
        ([, sym]) => sym === winner
      )?.[0];
      newState.winners = winnerId ? [winnerId] : null;
    } else if (newBoard.every((cell) => cell !== null)) {
      // Match nul
      newState.gameOver = true;
      newState.winners = null;
    } else {
      // Tour suivant
      newState.currentPlayerId = this.#getNextPlayer(state);
    }

    return newState;
  }

  /**
   * Vérifie si une action est valide
   * @param {TicTacToeState} state
   * @param {TicTacToeAction} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    return (
      !state.gameOver &&
      state.currentPlayerId === playerId &&
      action.type === 'place' &&
      action.position >= 0 &&
      action.position <= 8 &&
      state.board[action.position] === null
    );
  }

  /**
   * Retourne les actions valides pour un joueur
   * @param {TicTacToeState} state
   * @param {string} playerId
   * @returns {TicTacToeAction[]}
   */
  getValidActions(state, playerId) {
    if (state.gameOver || state.currentPlayerId !== playerId) {
      return [];
    }

    return state.board
      .map((cell, i) => (cell === null ? { type: 'place', position: i } : null))
      .filter((action) => action !== null);
  }

  /**
   * Retourne la vue d'un joueur (pas de fog of war dans ce jeu)
   * @param {TicTacToeState} state
   * @param {string} _playerId
   * @returns {TicTacToeState}
   */
  getPlayerView(state, _playerId) {
    // Pas de fog of war, on retourne l'état complet
    return state;
  }

  /**
   * Vérifie si la partie est terminée
   * @param {TicTacToeState} state
   * @returns {boolean}
   */
  isGameOver(state) {
    return state.gameOver;
  }

  /**
   * Retourne le(s) gagnant(s)
   * @param {TicTacToeState} state
   * @returns {string[]|null}
   */
  getWinners(state) {
    return state.winners;
  }

  /**
   * Retourne le joueur actif
   * @param {TicTacToeState} state
   * @returns {string}
   */
  getCurrentPlayer(state) {
    return state.currentPlayerId;
  }

  /**
   * Retourne la ligne gagnante (pour l'affichage)
   * @param {Board} board
   * @returns {number[]|null}
   */
  getWinningLine(board) {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return line;
      }
    }
    return null;
  }

  /**
   * Vérifie s'il y a un gagnant
   * @param {Board} board
   * @returns {Cell}
   */
  #checkWinner(board) {
    for (const [a, b, c] of WINNING_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  /**
   * Retourne l'ID du joueur suivant
   * @param {TicTacToeState} state
   * @returns {string}
   */
  #getNextPlayer(state) {
    const idx = state.playerIds.indexOf(state.currentPlayerId);
    return state.playerIds[(idx + 1) % state.playerIds.length];
  }
}

export default TicTacToeEngine;
