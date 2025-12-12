/**
 * Tests unitaires pour CheckersEngine
 * @see openspec/specs/game-engine/spec.md
 */

import { CheckersEngine } from './engine.js';

describe('CheckersEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CheckersEngine();
  });

  describe('init()', () => {
    it('crée un plateau 10x10', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      expect(state.board.length).toBe(10);
      expect(state.board[0].length).toBe(10);
    });

    it('place 20 pions blancs sur les rangées 0-3', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      let whitePawns = 0;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 10; col++) {
          const piece = state.board[row][col];
          if (piece && piece.player === 0) {
            expect(piece.type).toBe('pawn');
            expect((row + col) % 2).toBe(1); // Cases noires uniquement
            whitePawns++;
          }
        }
      }

      expect(whitePawns).toBe(20);
    });

    it('place 20 pions noirs sur les rangées 6-9', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      let blackPawns = 0;
      for (let row = 6; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const piece = state.board[row][col];
          if (piece && piece.player === 1) {
            expect(piece.type).toBe('pawn');
            expect((row + col) % 2).toBe(1); // Cases noires uniquement
            blackPawns++;
          }
        }
      }

      expect(blackPawns).toBe(20);
    });

    it('laisse les rangées 4-5 vides', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      for (let row = 4; row < 6; row++) {
        for (let col = 0; col < 10; col++) {
          expect(state.board[row][col]).toBeNull();
        }
      }
    });

    it('commence avec le joueur blanc (0)', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      expect(state.currentPlayer).toBe(0);
      expect(state.status).toBe('playing');
      expect(state.winner).toBeNull();
    });

    it('conserve la seed pour le replay', () => {
      const state = engine.init({
        seed: 12345,
        playerIds: ['p1', 'p2'],
      });

      expect(state.seed).toBe('12345');
    });
  });

  describe('getValidActions() - Mouvements simples', () => {
    it('retourne les mouvements diagonaux avant pour un pion blanc', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Pion blanc en (3, 0) peut aller en (4, 1) (rangée 4 est vide)
      const actions = engine.getValidActions(state, 'p1');
      const pawnMoves = actions.filter(
        (a) => a.from.row === 3 && a.from.col === 0,
      );

      expect(pawnMoves.length).toBe(1);
      expect(pawnMoves).toContainEqual({
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      });
    });

    it('ne permet pas aux pions blancs d\'avancer en arrière', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const actions = engine.getValidActions(state, 'p1');

      // Aucun mouvement vers le haut (row décroissante)
      for (const action of actions) {
        if (action.to.row < action.from.row) {
          expect(true).toBe(false); // Ne devrait pas arriver
        }
      }
    });

    it('retourne un tableau vide si ce n\'est pas le tour du joueur', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const actions = engine.getValidActions(state, 'p2'); // Tour de p1

      expect(actions).toEqual([]);
    });
  });

  describe('applyAction() - Mouvements simples', () => {
    it('déplace un pion correctement', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const action = {
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.board[3][0]).toBeNull();
      expect(newState.board[4][1]).toEqual({ type: 'pawn', player: 0 });
    });

    it('change de joueur après un mouvement', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const action = {
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.currentPlayer).toBe(1);
    });

    it('ajoute le mouvement à l\'historique', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const action = {
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.moveHistory.length).toBe(1);
      expect(newState.moveHistory[0]).toEqual({
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      });
    });

    it('ne modifie pas l\'état original (immutabilité)', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });
      const originalFirstRow = [...state.board[0]];

      const action = {
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      };

      engine.applyAction(state, action, 'p1');

      expect(state.board[0]).toEqual(originalFirstRow);
    });

    it('lève une erreur pour un mouvement invalide', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const action = {
        type: 'move',
        from: { row: 2, col: 1 },
        to: { row: 5, col: 5 }, // Mouvement impossible
      };

      expect(() => engine.applyAction(state, action, 'p1')).toThrow('Invalid action');
    });
  });

  describe('Captures simples', () => {
    it('détecte une capture possible', () => {
      // Créer une situation de capture
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Déplacer un pion noir pour créer une opportunité de capture
      state.board[4][3] = { type: 'pawn', player: 1 };
      state.board[3][2] = { type: 'pawn', player: 0 };

      const actions = engine.getValidActions(state, 'p1');
      const captureActions = actions.filter((a) => a.from.row === 3 && a.from.col === 2);

      expect(captureActions.length).toBeGreaterThan(0);
      expect(captureActions).toContainEqual({
        type: 'move',
        from: { row: 3, col: 2 },
        to: { row: 5, col: 4 },
      });
    });

    it('exécute une capture et supprime la pièce adverse', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer les pions pour une capture
      state.board[3][2] = { type: 'pawn', player: 0 };
      state.board[4][3] = { type: 'pawn', player: 1 };
      state.board[5][4] = null;

      const action = {
        type: 'move',
        from: { row: 3, col: 2 },
        to: { row: 5, col: 4 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.board[3][2]).toBeNull(); // Position départ vide
      expect(newState.board[4][3]).toBeNull(); // Pièce capturée supprimée
      expect(newState.board[5][4]).toEqual({ type: 'pawn', player: 0 }); // Pion arrivé
      expect(newState.moveHistory[0].captures).toEqual([{ row: 4, col: 3 }]);
    });

    it('oblige à capturer quand une capture est possible', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer pour avoir une capture possible et un mouvement simple
      state.board[3][2] = { type: 'pawn', player: 0 };
      state.board[4][3] = { type: 'pawn', player: 1 };
      state.board[3][4] = { type: 'pawn', player: 0 };

      const actions = engine.getValidActions(state, 'p1');

      // Seule la capture doit être possible (pas le mouvement simple de 3,4)
      const simpleMove = actions.find(
        (a) => a.from.row === 3 && a.from.col === 4 && a.to.row === 4 && a.to.col === 5,
      );
      expect(simpleMove).toBeUndefined();

      // La capture doit être présente
      const capture = actions.find(
        (a) => a.from.row === 3 && a.from.col === 2 && a.to.row === 5 && a.to.col === 4,
      );
      expect(capture).toBeDefined();
    });
  });

  describe('Promotion en dame', () => {
    it('promeut un pion blanc atteignant la rangée 9', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer un pion blanc proche de la promotion
      state.board[8][7] = { type: 'pawn', player: 0 };
      state.board[9][8] = null;

      const action = {
        type: 'move',
        from: { row: 8, col: 7 },
        to: { row: 9, col: 8 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.board[9][8]).toEqual({ type: 'king', player: 0 });
    });

    it('promeut un pion noir atteignant la rangée 0', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer un pion noir proche de la promotion
      state.board[1][2] = { type: 'pawn', player: 1 };
      state.board[0][1] = null;
      state.currentPlayer = 1;

      const action = {
        type: 'move',
        from: { row: 1, col: 2 },
        to: { row: 0, col: 1 },
      };

      const newState = engine.applyAction(state, action, 'p2');

      expect(newState.board[0][1]).toEqual({ type: 'king', player: 1 });
    });
  });

  describe('Mouvements de dame', () => {
    it('permet à une dame de se déplacer sur plusieurs cases', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer une dame blanche
      state.board[5][4] = { type: 'king', player: 0 };

      const actions = engine.getValidActions(state, 'p1');
      const kingMoves = actions.filter((a) => a.from.row === 5 && a.from.col === 4);

      // Une dame doit avoir plusieurs options de distance
      const longMove = kingMoves.find((a) => Math.abs(a.to.row - a.from.row) > 1);
      expect(longMove).toBeDefined();
    });

    it('arrête le mouvement de la dame si une pièce bloque', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Placer une dame et une pièce bloquante
      state.board[5][4] = { type: 'king', player: 0 };
      state.board[7][6] = { type: 'pawn', player: 0 }; // Bloque la diagonale

      const actions = engine.getValidActions(state, 'p1');
      const kingMoves = actions.filter((a) => a.from.row === 5 && a.from.col === 4);

      // Ne doit pas pouvoir aller en 8,7 ou au-delà
      const blockedMove = kingMoves.find((a) => a.to.row === 8 && a.to.col === 7);
      expect(blockedMove).toBeUndefined();

      // Doit pouvoir aller en 6,5
      const allowedMove = kingMoves.find((a) => a.to.row === 6 && a.to.col === 5);
      expect(allowedMove).toBeDefined();
    });
  });

  describe('Fin de partie', () => {
    it('détecte une victoire par élimination', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Enlever tous les pions noirs sauf un
      for (let row = 6; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          state.board[row][col] = null;
        }
      }
      state.board[6][1] = { type: 'pawn', player: 1 };

      // Capturer le dernier pion
      state.board[5][2] = { type: 'pawn', player: 0 };
      state.board[6][1] = { type: 'pawn', player: 1 };

      const action = {
        type: 'move',
        from: { row: 5, col: 2 },
        to: { row: 7, col: 0 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.status).toBe('won');
      expect(newState.winner).toBe(0);
    });

    it('détecte une victoire par blocage', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Créer une situation où le joueur noir ne peut plus bouger
      // Enlever tous les pions sauf quelques-uns
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          state.board[row][col] = null;
        }
      }

      // Pion noir bloqué dans un coin
      state.board[9][0] = { type: 'pawn', player: 1 };
      state.board[8][1] = { type: 'pawn', player: 0 };

      // Pion blanc qui joue
      state.board[6][3] = { type: 'pawn', player: 0 };
      state.board[7][4] = null;

      const action = {
        type: 'move',
        from: { row: 6, col: 3 },
        to: { row: 7, col: 4 },
      };

      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.status).toBe('won');
      expect(newState.winner).toBe(0);
    });
  });

  describe('getPlayerView()', () => {
    it('retourne l\'état complet (pas de fog of war)', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const view = engine.getPlayerView(state, 'p1');

      expect(view).toEqual(state);
    });
  });

  describe('Déterminisme', () => {
    it('produit le même état avec la même seed et les mêmes actions', () => {
      const state1 = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const state2 = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      expect(state1).toEqual(state2);

      const action = {
        type: 'move',
        from: { row: 3, col: 0 },
        to: { row: 4, col: 1 },
      };

      const newState1 = engine.applyAction(state1, action, 'p1');
      const newState2 = engine.applyAction(state2, action, 'p1');

      expect(newState1).toEqual(newState2);
    });
  });
});
