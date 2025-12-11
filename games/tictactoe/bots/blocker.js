/**
 * Bot Blocker - Bloque les alignements adverses
 * @see openspec/specs/bot/spec.md
 */

// Lignes gagnantes
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export class BlockerBot {
  name = 'Blocker';
  description = 'Bloque les alignements adverses';
  difficulty = 'medium';

  #playerId = null;
  #mySymbol = null;
  #opponentSymbol = null;

  /**
   * Appelé au début de la partie
   * @param {string} playerId - ID du bot
   * @param {object} config - Configuration (contient symbols)
   */
  onGameStart(playerId, config) {
    this.#playerId = playerId;
  }

  /**
   * Choisit une action intelligente
   * @param {object} view - Vue du jeu
   * @param {Array} validActions - Actions valides
   * @param {object} rng - Générateur aléatoire
   * @returns {object} Action choisie
   */
  chooseAction(view, validActions, rng) {
    const board = view.board;
    this.#mySymbol = view.symbols[this.#playerId];
    this.#opponentSymbol = this.#mySymbol === 'X' ? 'O' : 'X';

    // 1. Gagner si possible
    const winMove = this.#findWinningMove(board, this.#mySymbol, validActions);
    if (winMove) return winMove;

    // 2. Bloquer l'adversaire
    const blockMove = this.#findWinningMove(board, this.#opponentSymbol, validActions);
    if (blockMove) return blockMove;

    // 3. Prendre le centre si libre
    const centerAction = validActions.find((a) => a.position === 4);
    if (centerAction) return centerAction;

    // 4. Prendre un coin si libre
    const corners = [0, 2, 6, 8];
    const cornerActions = validActions.filter((a) => corners.includes(a.position));
    if (cornerActions.length > 0) {
      return rng.pick(cornerActions);
    }

    // 5. Jouer au hasard
    return rng.pick(validActions);
  }

  /**
   * Trouve un coup gagnant pour un symbole donné
   * @param {Array} board
   * @param {string} symbol
   * @param {Array} validActions
   * @returns {object|null}
   */
  #findWinningMove(board, symbol, validActions) {
    for (const line of LINES) {
      const cells = line.map((i) => board[i]);
      const symbolCount = cells.filter((c) => c === symbol).length;
      const emptyCount = cells.filter((c) => c === null).length;

      // 2 symboles et 1 case vide = coup gagnant/bloquant
      if (symbolCount === 2 && emptyCount === 1) {
        const emptyIndex = line.find((i) => board[i] === null);
        const action = validActions.find((a) => a.position === emptyIndex);
        if (action) return action;
      }
    }
    return null;
  }
}

export default BlockerBot;
