/**
 * Bot Smart - Utilise Minimax pour jouer intelligemment
 * @see openspec/specs/bot/spec.md
 */

import { CheckersEngine } from '../engine.js';

export class SmartBot {
  name = 'Smart';
  description = 'Utilise l\'algorithme Minimax';
  difficulty = 'medium';

  #engine = new CheckersEngine();
  #maxDepth = 4; // Profondeur de recherche

  /**
   * Choisit la meilleure action selon Minimax
   * @param {object} state - État actuel du jeu
   * @param {Array} validActions - Actions valides
   * @param {object} _rng - Générateur aléatoire (non utilisé)
   * @returns {object} Meilleure action
   */
  chooseAction(state, validActions, _rng) {
    if (validActions.length === 0) return null;
    if (validActions.length === 1) return validActions[0];

    const currentPlayer = state.currentPlayer;
    let bestAction = validActions[0];
    let bestScore = -Infinity;

    // Évaluer chaque action
    for (const action of validActions) {
      try {
        const playerId = state.playerIds[currentPlayer];
        const newState = this.#engine.applyAction(state, action, playerId);
        const score = this.#minimax(newState, this.#maxDepth - 1, false, -Infinity, Infinity, currentPlayer);

        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      } catch (error) {
        // Action invalide, ignorer
        console.error('Erreur lors de l\'évaluation:', error);
      }
    }

    return bestAction;
  }

  /**
   * Algorithme Minimax avec alpha-beta pruning
   * @param {object} state - État du jeu
   * @param {number} depth - Profondeur restante
   * @param {boolean} maximizing - Maximiser ou minimiser
   * @param {number} alpha - Valeur alpha
   * @param {number} beta - Valeur beta
   * @param {number} player - Joueur d'origine (pour l'évaluation)
   * @returns {number} Score de l'état
   * @private
   */
  #minimax(state, depth, maximizing, alpha, beta, player) {
    // Condition d'arrêt
    if (depth === 0 || state.status !== 'playing') {
      return this.#evaluate(state, player);
    }

    const currentPlayer = state.currentPlayer;
    const playerId = state.playerIds[currentPlayer];
    const validActions = this.#engine.getValidActions(state, playerId);

    if (validActions.length === 0) {
      return this.#evaluate(state, player);
    }

    if (maximizing) {
      let maxScore = -Infinity;
      for (const action of validActions) {
        try {
          const newState = this.#engine.applyAction(state, action, playerId);
          const score = this.#minimax(newState, depth - 1, false, alpha, beta, player);
          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break; // Alpha-beta pruning
        } catch (error) {
          // Ignorer les actions invalides
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const action of validActions) {
        try {
          const newState = this.#engine.applyAction(state, action, playerId);
          const score = this.#minimax(newState, depth - 1, true, alpha, beta, player);
          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break; // Alpha-beta pruning
        } catch (error) {
          // Ignorer les actions invalides
        }
      }
      return minScore;
    }
  }

  /**
   * Évalue un état de jeu
   * @param {object} state - État du jeu
   * @param {number} player - Joueur à évaluer
   * @returns {number} Score de l'état
   * @private
   */
  #evaluate(state, player) {
    // Victoire/défaite
    if (state.status === 'won') {
      return state.winner === player ? 10000 : -10000;
    }

    if (state.status === 'draw') {
      return 0;
    }

    let score = 0;

    // Compter les pièces et leur valeur
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const piece = state.board[row][col];
        if (!piece) continue;

        let pieceValue = 0;

        // Valeur de base
        if (piece.type === 'pawn') {
          pieceValue = 100;

          // Bonus pour l'avancement (pions proches de la promotion)
          const advancementRow = piece.player === 0 ? row : (9 - row);
          pieceValue += advancementRow * 5;

          // Bonus pour les pions au centre
          const centerDistance = Math.abs(4.5 - col);
          pieceValue += (4.5 - centerDistance) * 3;

        } else { // king
          pieceValue = 300;

          // Bonus pour les dames au centre
          const centerRow = Math.abs(4.5 - row);
          const centerCol = Math.abs(4.5 - col);
          pieceValue += (9 - centerRow - centerCol) * 5;
        }

        // Ajouter ou soustraire selon le joueur
        if (piece.player === player) {
          score += pieceValue;
        } else {
          score -= pieceValue;
        }
      }
    }

    return score;
  }
}

export default SmartBot;
