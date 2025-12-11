/**
 * Bot Perfect - Ne perd jamais (Minimax)
 * @see openspec/specs/bot/spec.md
 */

import { TicTacToeEngine } from '../engine.js';

// Lignes gagnantes
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export class PerfectBot {
  name = 'Perfect';
  description = 'Ne perd jamais (Minimax)';
  difficulty = 'expert';

  #engine = new TicTacToeEngine();
  #playerId = null;
  #opponentId = null;

  /**
   * Appelé au début de la partie
   * @param {string} playerId - ID du bot
   */
  onGameStart(playerId) {
    this.#playerId = playerId;
  }

  /**
   * Choisit le meilleur coup avec Minimax
   * @param {object} view - Vue du jeu
   * @param {Array} validActions - Actions valides
   * @param {object} _rng - Non utilisé (déterministe)
   * @returns {object} Action choisie
   */
  chooseAction(view, validActions, _rng) {
    // Déterminer l'adversaire
    this.#opponentId = view.playerIds.find((id) => id !== this.#playerId);

    let bestScore = -Infinity;
    let bestAction = validActions[0];

    for (const action of validActions) {
      const newState = this.#engine.applyAction(view, action, this.#playerId);
      const score = this.#minimax(newState, 0, false, -Infinity, Infinity);

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Algorithme Minimax avec élagage alpha-beta
   * @param {object} state
   * @param {number} depth
   * @param {boolean} isMaximizing
   * @param {number} alpha
   * @param {number} beta
   * @returns {number}
   */
  #minimax(state, depth, isMaximizing, alpha, beta) {
    // État terminal
    if (this.#engine.isGameOver(state)) {
      return this.#evaluateState(state, depth);
    }

    const currentPlayer = isMaximizing ? this.#playerId : this.#opponentId;
    const validActions = this.#engine.getValidActions(state, currentPlayer);

    if (validActions.length === 0) {
      return this.#evaluateState(state, depth);
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const action of validActions) {
        const newState = this.#engine.applyAction(state, action, currentPlayer);
        const score = this.#minimax(newState, depth + 1, false, alpha, beta);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Élagage
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const action of validActions) {
        const newState = this.#engine.applyAction(state, action, currentPlayer);
        const score = this.#minimax(newState, depth + 1, true, alpha, beta);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Élagage
      }
      return minScore;
    }
  }

  /**
   * Évalue un état terminal
   * @param {object} state
   * @param {number} depth
   * @returns {number}
   */
  #evaluateState(state, depth) {
    const winners = this.#engine.getWinners(state);

    if (winners === null) {
      return 0; // Match nul
    }

    if (winners.includes(this.#playerId)) {
      return 100 - depth; // Victoire (préférer les victoires rapides)
    }

    return -100 + depth; // Défaite (retarder les défaites)
  }
}

export default PerfectBot;
