/**
 * Tic-Tac-Toe Engine - Moteur de jeu isomorphe
 * Fonctionne côté client ET serveur
 *
 * @see openspec/specs/game-engine/spec.md
 */

import { WINNING_LINES } from './engine/winning-lines.js';

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
 * @property {[string, string]} playerIds - IDs des deux joueurs
 * @property {Record<string, 'X' | 'O'>} symbols - Symboles par ID de joueur
 *
 * @typedef {Object} TicTacToeAction
 * @property {'place'} type - Type d'action
 * @property {number} position - Position 0-8
 *
 * @typedef {Object} TicTacToeConfig
 * @property {number} seed - Seed pour le RNG
 * @property {[string, string]} playerIds - IDs des 2 joueurs
 */

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
        ([, sym]) => sym === winner,
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
      action !== null &&
      typeof action === 'object' &&
      !Array.isArray(action) &&
      action.type === 'place' &&
      Number.isInteger(action.position) &&
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
    const line = this.#findWinningLine(board);
    return line ? [...line] : null;
  }

  /**
   * Trouve la première ligne complète, sans copie
   * @param {Board} board
   * @returns {readonly number[]|null}
   */
  #findWinningLine(board) {
    return WINNING_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? null;
  }

  /**
   * Vérifie s'il y a un gagnant
   * @param {Board} board
   * @returns {Cell}
   */
  #checkWinner(board) {
    const line = this.#findWinningLine(board);
    return line ? board[line[0]] : null;
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
