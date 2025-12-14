/**
 * Checkers Engine - Moteur de jeu de Dames isomorphe
 * Fonctionne côté client ET serveur
 * Règles françaises (10x10)
 *
 * @see openspec/specs/game-engine/spec.md
 */

/**
 * @typedef {'pawn' | 'king'} PieceType
 *
 * @typedef {Object} Piece
 * @property {PieceType} type - Type de pièce
 * @property {0 | 1} player - Propriétaire (0=blanc, 1=noir)
 *
 * @typedef {Object} Position
 * @property {number} row - Ligne (0-9)
 * @property {number} col - Colonne (0-9)
 *
 * @typedef {Object} Move
 * @property {Position} from - Position de départ
 * @property {Position} to - Position d'arrivée
 * @property {Position[]} [captures] - Pièces capturées
 *
 * @typedef {Object} CheckersState
 * @property {(Piece | null)[][]} board - Plateau 10x10
 * @property {0 | 1} currentPlayer - Joueur actif
 * @property {'playing' | 'won' | 'draw'} status - Statut de la partie
 * @property {0 | 1 | null} winner - Gagnant
 * @property {Move[]} moveHistory - Historique des coups
 * @property {string} seed - Seed pour déterminisme
 * @property {string[]} playerIds - IDs des joueurs
 *
 * @typedef {Object} CheckersAction
 * @property {'move'} type - Type d'action
 * @property {Position} from - Position de départ
 * @property {Position} to - Position d'arrivée
 *
 * @typedef {Object} CheckersConfig
 * @property {number} seed - Seed pour le RNG
 * @property {[string, string]} playerIds - IDs des 2 joueurs
 */

/**
 * Moteur de jeu de Dames
 */
export class CheckersEngine {
  /**
   * Initialise une nouvelle partie
   * @param {CheckersConfig} config
   * @returns {CheckersState}
   */
  init(config) {
    // Créer plateau 10x10 vide
    const board = Array(10)
      .fill(null)
      .map(() => Array(10).fill(null));

    // Placer les pions blancs (joueur 0) sur les 4 premières rangées
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 10; col++) {
        // Cases noires uniquement (damier)
        if ((row + col) % 2 === 1) {
          board[row][col] = { type: 'pawn', player: 0 };
        }
      }
    }

    // Placer les pions noirs (joueur 1) sur les 4 dernières rangées
    for (let row = 6; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        // Cases noires uniquement
        if ((row + col) % 2 === 1) {
          board[row][col] = { type: 'pawn', player: 1 };
        }
      }
    }

    return {
      board,
      currentPlayer: 0, // Blanc commence
      status: 'playing',
      winner: null,
      moveHistory: [],
      seed: String(config.seed),
      playerIds: config.playerIds,
    };
  }

  /**
   * Applique une action et retourne le nouvel état
   * @param {CheckersState} state
   * @param {CheckersAction} action
   * @param {string} playerId
   * @returns {CheckersState}
   */
  applyAction(state, action, playerId) {
    // Vérifier que c'est le bon joueur
    const playerIndex = state.playerIds.indexOf(playerId);
    if (playerIndex !== state.currentPlayer) {
      throw new Error('Not your turn');
    }

    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    // Copier l'état
    const newBoard = state.board.map((row) => [...row]);
    const piece = newBoard[action.from.row][action.from.col];

    // Calculer les captures (utiliser action.captured si fourni, sinon calculer)
    const captures = action.captured || this.#getCapturesForMove(state, action.from, action.to);

    // Déplacer la pièce
    newBoard[action.to.row][action.to.col] = piece;
    newBoard[action.from.row][action.from.col] = null;

    // Supprimer les pièces capturées
    for (const capture of captures) {
      newBoard[capture.row][capture.col] = null;
    }

    // Promouvoir en dame si dernière rangée
    if (piece.type === 'pawn') {
      const lastRow = piece.player === 0 ? 9 : 0;
      if (action.to.row === lastRow) {
        newBoard[action.to.row][action.to.col] = { ...piece, type: 'king' };
      }
    }

    const move = {
      from: action.from,
      to: action.to,
      captures: captures.length > 0 ? captures : undefined,
    };

    const newState = {
      ...state,
      board: newBoard,
      moveHistory: [...state.moveHistory, move],
      currentPlayer: state.currentPlayer === 0 ? 1 : 0,
    };

    // Vérifier fin de partie
    this.#checkGameEnd(newState);

    // Vérifier règle des 40 coups sans capture
    if (!this.#checkDrawByNoCaptureRule(newState)) {
      // Vérifier répétition de position
      this.#checkDrawByRepetition(newState);
    }

    return newState;
  }

  /**
   * Vérifie si une action est valide
   * @param {CheckersState} state
   * @param {CheckersAction} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    if (state.status !== 'playing') {return false;}

    const playerIndex = state.playerIds.indexOf(playerId);
    if (playerIndex !== state.currentPlayer) {return false;}

    const validActions = this.getValidActions(state, playerId);
    return validActions.some(
      (a) =>
        a.from.row === action.from.row &&
        a.from.col === action.from.col &&
        a.to.row === action.to.row &&
        a.to.col === action.to.col,
    );
  }

  /**
   * Retourne les actions valides pour un joueur
   * @param {CheckersState} state
   * @param {string} playerId
   * @returns {CheckersAction[]}
   */
  getValidActions(state, playerId) {
    if (state.status !== 'playing') {return [];}

    const playerIndex = state.playerIds.indexOf(playerId);
    if (playerIndex !== state.currentPlayer) {return [];}

    const allMoves = [];
    const allCaptures = [];

    // Trouver toutes les pièces du joueur
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const piece = state.board[row][col];
        if (piece && piece.player === playerIndex) {
          const from = { row, col };

          // Obtenir les mouvements possibles
          const moves = this.#getPossibleMoves(state, from);
          const captures = this.#getPossibleCaptures(state, from);

          allMoves.push(...moves);
          allCaptures.push(...captures);
        }
      }
    }

    // Si des captures sont possibles, seules les captures sont valides (prise obligatoire)
    if (allCaptures.length > 0) {
      return allCaptures.map((move) => ({ type: 'move', ...move }));
    }

    return allMoves.map((move) => ({ type: 'move', ...move }));
  }

  /**
   * Retourne la vue d'un joueur (information complète aux Dames)
   * @param {CheckersState} state
   * @param {string} _playerId
   * @returns {CheckersState}
   */
  getPlayerView(state, _playerId) {
    // Pas de fog of war aux Dames
    return state;
  }

  /**
   * Vérifie et met à jour l'état de fin de partie
   * @param {CheckersState} state
   * @private
   */
  #checkGameEnd(state) {
    const opponent = state.currentPlayer;

    // Compter les pièces de l'adversaire
    let opponentPieces = 0;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const piece = state.board[row][col];
        if (piece && piece.player === opponent) {
          opponentPieces++;
        }
      }
    }

    // Victoire par élimination
    if (opponentPieces === 0) {
      state.status = 'won';
      state.winner = opponent === 0 ? 1 : 0;
      return;
    }

    // Vérifier si l'adversaire peut jouer
    const opponentId = state.playerIds[opponent];
    const opponentActions = this.getValidActions(state, opponentId);

    if (opponentActions.length === 0) {
      // Victoire par blocage
      state.status = 'won';
      state.winner = opponent === 0 ? 1 : 0;
    }
  }

  /**
   * Obtient tous les mouvements simples possibles depuis une position
   * @param {CheckersState} state
   * @param {Position} from
   * @returns {{from: Position, to: Position}[]}
   * @private
   */
  #getPossibleMoves(state, from) {
    const piece = state.board[from.row][from.col];
    if (!piece) {return [];}

    const moves = [];
    const directions = this.#getMoveDirections(piece);

    for (const [dr, dc] of directions) {
      if (piece.type === 'pawn') {
        // Pion : un seul pas
        const to = { row: from.row + dr, col: from.col + dc };
        if (this.#isValidPosition(to) && !state.board[to.row][to.col]) {
          moves.push({ from, to });
        }
      } else {
        // Dame : plusieurs pas
        let step = 1;
        while (true) {
          const to = { row: from.row + dr * step, col: from.col + dc * step };
          if (!this.#isValidPosition(to)) {break;}
          if (state.board[to.row][to.col]) {break;} // Case occupée
          moves.push({ from, to });
          step++;
        }
      }
    }

    return moves;
  }

  /**
   * Obtient toutes les captures possibles depuis une position
   * @param {CheckersState} state
   * @param {Position} from
   * @returns {{from: Position, to: Position, captured: Position[]}[]}
   * @private
   */
  #getPossibleCaptures(state, from) {
    const piece = state.board[from.row][from.col];
    if (!piece) {return [];}

    const captures = [];

    // Chercher toutes les captures possibles (y compris multiples)
    const captureSequences = this.#findAllCaptureSequences(state, from, [], new Set());

    for (const sequence of captureSequences) {
      if (sequence.positions && sequence.positions.length > 0) {
        // La dernière position de la séquence
        const lastPos = sequence.positions[sequence.positions.length - 1];
        captures.push({
          from,
          to: lastPos,
          captured: sequence.captured || [],
        });
      }
    }

    return captures;
  }

  /**
   * Trouve toutes les séquences de captures possibles (récursif pour captures multiples)
   * @param {CheckersState} state
   * @param {Position} pos
   * @param {Position[]} capturedSoFar
   * @param {Set<string>} visitedPositions
   * @returns {{positions: Position[], captured: Position[]}[]}
   * @private
   */
  #findAllCaptureSequences(state, pos, capturedSoFar, visitedPositions) {
    const piece = state.board[pos.row][pos.col];
    if (!piece) {return [];}

    const sequences = [];
    const directions = this.#getCaptureDirections(piece);

    // Marquer position actuelle comme visitée
    const posKey = `${pos.row},${pos.col}`;
    visitedPositions.add(posKey);

    for (const [dr, dc] of directions) {
      if (piece.type === 'pawn') {
        // Pion : capture simple
        const target = { row: pos.row + dr, col: pos.col + dc };
        const landing = { row: pos.row + dr * 2, col: pos.col + dc * 2 };

        if (
          this.#isValidPosition(target) &&
          this.#isValidPosition(landing) &&
          state.board[target.row][target.col] &&
          state.board[target.row][target.col].player !== piece.player &&
          !state.board[landing.row][landing.col] &&
          !this.#isPositionCaptured(target, capturedSoFar)
        ) {
          const newCaptured = [...capturedSoFar, target];

          // Simuler l'état après cette capture
          const tempBoard = state.board.map((row) => [...row]);
          tempBoard[landing.row][landing.col] = piece;
          tempBoard[pos.row][pos.col] = null;
          tempBoard[target.row][target.col] = null;

          const tempState = { ...state, board: tempBoard };

          // Chercher des captures multiples
          const furtherCaptures = this.#findAllCaptureSequences(
            tempState,
            landing,
            newCaptured,
            new Set(visitedPositions),
          );

          if (furtherCaptures.length > 0) {
            sequences.push(...furtherCaptures);
          } else {
            sequences.push({ positions: [landing], captured: newCaptured });
          }
        }
      } else {
        // Dame : capture avec atterrissage libre
        let step = 1;
        let targetFound = null;

        // Trouver la pièce adverse
        while (true) {
          const checkPos = { row: pos.row + dr * step, col: pos.col + dc * step };
          if (!this.#isValidPosition(checkPos)) {break;}

          const checkPiece = state.board[checkPos.row][checkPos.col];
          if (checkPiece) {
            if (
              checkPiece.player !== piece.player &&
              !this.#isPositionCaptured(checkPos, capturedSoFar)
            ) {
              targetFound = checkPos;
              step++;
              break;
            } else {
              break; // Pièce alliée ou déjà capturée
            }
          }
          step++;
        }

        // Si une pièce adverse est trouvée, chercher les positions d'atterrissage
        if (targetFound) {
          while (true) {
            const landing = { row: pos.row + dr * step, col: pos.col + dc * step };
            if (!this.#isValidPosition(landing)) {break;}
            if (state.board[landing.row][landing.col]) {break;}

            const newCaptured = [...capturedSoFar, targetFound];

            // Simuler l'état après cette capture
            const tempBoard = state.board.map((row) => [...row]);
            tempBoard[landing.row][landing.col] = piece;
            tempBoard[pos.row][pos.col] = null;
            tempBoard[targetFound.row][targetFound.col] = null;

            const tempState = { ...state, board: tempBoard };

            // Chercher des captures multiples
            const furtherCaptures = this.#findAllCaptureSequences(
              tempState,
              landing,
              newCaptured,
              new Set(visitedPositions),
            );

            if (furtherCaptures.length > 0) {
              sequences.push(...furtherCaptures);
            } else {
              sequences.push({ positions: [landing], captured: newCaptured });
            }

            step++;
          }
        }
      }
    }

    return sequences;
  }

  /**
   * Calcule les pièces capturées pour un mouvement
   * @param {CheckersState} state
   * @param {Position} from
   * @param {Position} to
   * @returns {Position[]}
   * @private
   */
  #getCapturesForMove(state, from, to) {
    const piece = state.board[from.row][from.col];
    if (!piece) {return [];}

    const dr = Math.sign(to.row - from.row);
    const dc = Math.sign(to.col - from.col);
    const distance = Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col));

    const captures = [];

    // Parcourir le chemin
    for (let step = 1; step < distance; step++) {
      const checkPos = { row: from.row + dr * step, col: from.col + dc * step };
      const checkPiece = state.board[checkPos.row][checkPos.col];

      if (checkPiece && checkPiece.player !== piece.player) {
        captures.push(checkPos);
      }
    }

    return captures;
  }

  /**
   * Retourne les directions de mouvement pour une pièce
   * @param {Piece} piece
   * @returns {number[][]}
   * @private
   */
  #getMoveDirections(piece) {
    if (piece.type === 'king') {
      // Dame : toutes les diagonales
      return [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
    } else {
      // Pion : diagonales avant uniquement
      const forward = piece.player === 0 ? 1 : -1;
      return [
        [forward, 1],
        [forward, -1],
      ];
    }
  }

  /**
   * Retourne les directions de capture pour une pièce
   * @param {Piece} piece
   * @returns {number[][]}
   * @private
   */
  #getCaptureDirections(_piece) {
    // Les captures peuvent se faire dans toutes les diagonales (même arrière pour pions)
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
  }

  /**
   * Vérifie si une position est valide (dans le plateau et sur une case noire)
   * @param {Position} pos
   * @returns {boolean}
   * @private
   */
  #isValidPosition(pos) {
    // Vérifier les limites du plateau
    if (pos.row < 0 || pos.row >= 10 || pos.col < 0 || pos.col >= 10) {
      return false;
    }
    // Vérifier que c'est une case noire (damier : cases où row+col est impair)
    return (pos.row + pos.col) % 2 === 1;
  }

  /**
   * Vérifie si une position est dans la liste des captures
   * @param {Position} pos
   * @param {Position[]} captured
   * @returns {boolean}
   * @private
   */
  #isPositionCaptured(pos, captured) {
    return captured.some((c) => c.row === pos.row && c.col === pos.col);
  }

  /**
   * Vérifie la règle des 40 coups sans capture (match nul)
   * @param {CheckersState} state
   * @returns {boolean} true si match nul déclaré
   * @private
   */
  #checkDrawByNoCaptureRule(state) {
    if (state.status !== 'playing') {return false;}

    // Compter les coups depuis la dernière capture
    let movesSinceCapture = 0;
    for (let i = state.moveHistory.length - 1; i >= 0; i--) {
      if (state.moveHistory[i].captures && state.moveHistory[i].captures.length > 0) {
        break;
      }
      movesSinceCapture++;
    }

    // Règle : 40 coups sans capture = match nul
    if (movesSinceCapture >= 40) {
      state.status = 'draw';
      return true;
    }

    return false;
  }

  /**
   * Vérifie la répétition de position (3 fois = match nul)
   * @param {CheckersState} state
   * @private
   */
  #checkDrawByRepetition(state) {
    if (state.status !== 'playing') {return;}

    // Si les 4 derniers coups se répètent (2 coups par joueur)
    if (state.moveHistory.length >= 4) {
      const recent = state.moveHistory.slice(-4);
      if (
        this.#movesEqual(recent[0], recent[2]) &&
        this.#movesEqual(recent[1], recent[3])
      ) {
        state.status = 'draw';
        return;
      }
    }

    // Si les 6 derniers coups montrent une répétition claire (3 fois)
    if (state.moveHistory.length >= 6) {
      const recent = state.moveHistory.slice(-6);
      if (
        this.#movesEqual(recent[0], recent[2]) &&
        this.#movesEqual(recent[2], recent[4]) &&
        this.#movesEqual(recent[1], recent[3]) &&
        this.#movesEqual(recent[3], recent[5])
      ) {
        state.status = 'draw';
      }
    }
  }

  /**
   * Compare deux mouvements
   * @param {object} move1
   * @param {object} move2
   * @returns {boolean}
   * @private
   */
  #movesEqual(move1, move2) {
    return (
      move1.from.row === move2.from.row &&
      move1.from.col === move2.from.col &&
      move1.to.row === move2.to.row &&
      move1.to.col === move2.to.col
    );
  }
}
