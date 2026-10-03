/**
 * Tests unitaires pour CheckersEngine
 * @see openspec/specs/game-engine/spec.md
 */

import { CheckersEngine } from './engine.js';
import { RandomBot } from './bots/random.js';
import { SmartBot } from './bots/smart.js';

function positionState(placements, currentPlayer = 0) {
  const state = new CheckersEngine().init({ seed: 42, playerIds: ['p1', 'p2'] });
  state.board = Array.from({ length: 10 }, () => Array(10).fill(null));
  state.currentPlayer = currentPlayer;
  for (const [row, col, player, type = 'pawn'] of placements) {
    state.board[row][col] = { player, type };
  }
  return state;
}

function freezeInput(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeInput);
    Object.freeze(value);
  }
  return value;
}

function jsonCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

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
      // L'action de capture doit inclure la pièce capturée
      expect(captureActions).toContainEqual(
        expect.objectContaining({
          type: 'move',
          from: { row: 3, col: 2 },
          to: { row: 5, col: 4 },
        }),
      );
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

      // Vider le plateau pour tester les mouvements de dame
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          state.board[row][col] = null;
        }
      }

      // Placer une dame blanche et un pion noir pour garder la partie active
      state.board[5][4] = { type: 'king', player: 0 };
      state.board[0][1] = { type: 'pawn', player: 1 };

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

      // Vider le plateau
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          state.board[row][col] = null;
        }
      }

      // Placer une dame blanche, une pièce bloquante et un pion noir
      state.board[5][4] = { type: 'king', player: 0 };
      state.board[7][6] = { type: 'pawn', player: 0 }; // Bloque la diagonale
      state.board[0][1] = { type: 'pawn', player: 1 }; // Pion noir pour garder la partie active

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
      state.board[8][1] = { type: 'pawn', player: 0 }; // Bloque mouvement simple
      state.board[7][2] = { type: 'pawn', player: 0 }; // Bloque la capture

      // Pion blanc qui joue
      state.board[6][3] = { type: 'pawn', player: 0 };

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

  describe('Erreurs', () => {
    it('lance une erreur si ce n\'est pas le tour du joueur', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Le joueur 1 commence (currentPlayer = 0)
      const action = {
        type: 'move',
        from: { row: 6, col: 1 },
        to: { row: 5, col: 0 },
      };

      // p2 essaie de jouer alors que c'est le tour de p1
      expect(() => engine.applyAction(state, action, 'p2')).toThrow('Not your turn');
    });
  });

  describe('Match nul', () => {
    it('déclare un match nul après 40 coups sans capture', () => {
      // Créer un état avec uniquement des dames pour simuler
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Vider le plateau et placer seulement quelques dames
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          state.board[row][col] = null;
        }
      }

      // Placer une dame blanche et une dame noire
      state.board[0][1] = { player: 0, type: 'king' };
      state.board[9][0] = { player: 1, type: 'king' };

      // Simuler 40 coups sans capture dans l'historique
      state.moveHistory = [];
      for (let i = 0; i < 40; i++) {
        state.moveHistory.push({
          from: { row: 0, col: 1 },
          to: { row: 1, col: 2 },
          captures: [], // Aucune capture
        });
      }

      // Le prochain mouvement devrait déclencher le match nul
      // On doit simuler un mouvement valide
      state.currentPlayer = 0;

      // Faire un mouvement valide
      const action = {
        type: 'move',
        from: { row: 0, col: 1 },
        to: { row: 1, col: 2 },
      };

      const newState = engine.applyAction(state, action, 'p1');
      expect(newState.status).toBe('draw');
    });

  });

  describe('Contrat des rafles et des métadonnées', () => {
    const zigzag = () => positionState([
      [2, 1, 0], [3, 2, 1], [5, 2, 1], [8, 9, 1], [0, 9, 0],
    ]);
    const zigzagAction = {
      type: 'move',
      from: { row: 2, col: 1 },
      to: { row: 6, col: 1 },
      captured: [{ row: 3, col: 2 }, { row: 5, col: 2 }],
    };

    it('énumère uniquement la rafle complète changeant de diagonale', () => {
      const state = freezeInput(zigzag());
      expect(engine.getValidActions(state, 'p1')).toEqual([zigzagAction]);
      expect(engine.isValidAction(state, {
        type: 'move', from: zigzagAction.from, to: { row: 4, col: 3 },
      }, 'p1')).toBe(false);
    });

    it.each([
      ['l’action légale complète', zigzagAction],
      ['captured absent', {
        type: 'move', from: zigzagAction.from, to: zigzagAction.to,
      }],
      ['captured vide', { ...zigzagAction, captured: [] }],
      ['captured contradictoire', {
        ...zigzagAction, captured: [{ row: 0, col: 9 }, { row: 8, col: 9 }],
      }],
    ])('applique les captures exactes avec %s, sans muter les entrées', (_name, input) => {
      const state = freezeInput(zigzag());
      const action = freezeInput(jsonCopy(input));
      const beforeState = jsonCopy(state);
      const beforeAction = jsonCopy(action);
      const next = engine.applyAction(state, action, 'p1');
      const expectedBoard = jsonCopy(state.board);
      expectedBoard[2][1] = null;
      expectedBoard[3][2] = null;
      expectedBoard[5][2] = null;
      expectedBoard[6][1] = { player: 0, type: 'pawn' };
      expect(next.board).toEqual(expectedBoard);
      expect(next.moveHistory).toEqual([{
        from: zigzagAction.from, to: zigzagAction.to, captures: zigzagAction.captured,
      }]);
      expect(next).toMatchObject({
        currentPlayer: 1, status: 'playing', winner: null, seed: '42',
      });
      expect(jsonCopy(state)).toEqual(beforeState);
      expect(jsonCopy(action)).toEqual(beforeAction);
    });

    it('ne fabrique aucune capture à partir des métadonnées d’un déplacement simple', () => {
      const state = freezeInput(engine.init({ seed: 42, playerIds: ['p1', 'p2'] }));
      const legal = engine.getValidActions(state, 'p1')[0];
      const forged = freezeInput({ ...legal, captured: [{ row: 6, col: 1 }] });
      expect(engine.isValidAction(state, forged, 'p1')).toBe(true);
      expect(engine.applyAction(state, forged, 'p1'))
        .toEqual(engine.applyAction(state, legal, 'p1'));
      expect(engine.applyAction(state, forged, 'p1').board[6][1])
        .toEqual({ player: 1, type: 'pawn' });
    });

    it('impose la prise majoritaire entre pièces et refuse la capture courte sans mutation', () => {
      const state = freezeInput(positionState([
        [2, 1, 0], [3, 2, 1], [5, 2, 1], [2, 7, 0], [3, 8, 1],
      ]));
      const before = jsonCopy(state);
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toEqual([zigzagAction]);
      const short = freezeInput({
        type: 'move', from: { row: 2, col: 7 }, to: { row: 4, col: 9 },
        captured: [{ row: 3, col: 8 }],
      });
      for (const action of [short, { ...short, captured: zigzagAction.captured }]) {
        expect(engine.isValidAction(state, action, 'p1')).toBe(false);
        expect(() => engine.applyAction(state, action, 'p1')).toThrow('Invalid action');
      }
      expect(jsonCopy(state)).toEqual(before);
      expect(short.captured).toEqual([{ row: 3, col: 8 }]);
      const next = engine.applyAction(state, freezeInput(actions[0]), 'p1');
      expect(next.moveHistory[0].captures).toEqual(zigzagAction.captured);
      expect(next.board[3][2]).toBeNull();
      expect(next.board[5][2]).toBeNull();
      expect(next.board[3][8]).toEqual({ player: 1, type: 'pawn' });
    });

    it('compare toutes les rafles complètes d’une même pièce, pas seulement les premiers sauts', () => {
      const state = freezeInput(positionState([
        [4, 3, 0], [5, 4, 1], [7, 6, 1], [5, 2, 1],
      ]));
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toEqual([{
        type: 'move', from: { row: 4, col: 3 }, to: { row: 8, col: 7 },
        captured: [{ row: 5, col: 4 }, { row: 7, col: 6 }],
      }]);
      const short = freezeInput({
        type: 'move', from: { row: 4, col: 3 }, to: { row: 6, col: 1 },
        captured: [{ row: 5, col: 2 }],
      });
      expect(engine.isValidAction(state, short, 'p1')).toBe(false);
      expect(() => engine.applyAction(state, short, 'p1')).toThrow('Invalid action');
      const next = engine.applyAction(state, freezeInput(actions[0]), 'p1');
      expect(next.board[5][4]).toBeNull();
      expect(next.board[7][6]).toBeNull();
      expect(next.board[5][2]).toEqual({ player: 1, type: 'pawn' });
    });

    it.each([
      undefined,
      [{ row: 3, col: 8 }],
      [{ row: 3, col: 2 }, { row: 5, col: 2 }],
    ])('refuse les extrémités d’une prise courte même avec captured=%j', (captured) => {
      const state = freezeInput(positionState([
        [2, 1, 0], [3, 2, 1], [5, 2, 1], [2, 7, 0], [3, 8, 1],
      ]));
      const action = freezeInput({
        type: 'move', from: { row: 2, col: 7 }, to: { row: 4, col: 9 }, captured,
      });
      const snapshot = jsonCopy({ state, action });
      expect(() => engine.applyAction(state, action, 'p1')).toThrow('Invalid action');
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
      expect(jsonCopy({ state, action })).toEqual(snapshot);
    });

    it('canonicalise un trajet court devenu illégal vers le trajet maximal aux mêmes extrémités', () => {
      const state = freezeInput(positionState([
        [6, 7, 0, 'king'], [4, 1, 1], [7, 8, 1], [4, 5, 1], [7, 4, 1],
      ]));
      const from = { row: 6, col: 7 };
      const to = { row: 5, col: 0 };
      const maximal = {
        type: 'move', from, to,
        captured: [{ row: 7, col: 8 }, { row: 4, col: 5 }, { row: 4, col: 1 }],
      };
      expect(engine.getValidActions(state, 'p1')
        .filter((action) => action.to.row === to.row && action.to.col === to.col))
        .toEqual([maximal]);
      const short = freezeInput({
        type: 'move', from, to, captured: [{ row: 4, col: 5 }, { row: 4, col: 1 }],
      });
      // Compatibilité from/to : les métadonnées courtes ne rendent pas ces
      // extrémités illégales, mais n'autorisent jamais la prise courte.
      expect(engine.isValidAction(state, short, 'p1')).toBe(true);
      const next = engine.applyAction(state, short, 'p1');
      expect(next).toEqual(engine.applyAction(state, freezeInput(maximal), 'p1'));
      expect(next.board[7][8]).toBeNull();
      expect(short.captured).toEqual([{ row: 4, col: 5 }, { row: 4, col: 1 }]);
    });

    it('conserve dans leur ordre toutes les rafles maximales à égalité d’une pièce', () => {
      const state = freezeInput(positionState([
        [4, 3, 0], [5, 4, 1], [7, 6, 1], [5, 2, 1], [7, 2, 1],
      ]));
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toEqual([
        {
          type: 'move', from: { row: 4, col: 3 }, to: { row: 8, col: 7 },
          captured: [{ row: 5, col: 4 }, { row: 7, col: 6 }],
        },
        {
          type: 'move', from: { row: 4, col: 3 }, to: { row: 8, col: 3 },
          captured: [{ row: 5, col: 2 }, { row: 7, col: 2 }],
        },
      ]);
      for (const action of actions) {
        const next = engine.applyAction(state, freezeInput(action), 'p1');
        expect(next.moveHistory[0].captures).toEqual(action.captured);
        for (const capture of action.captured) {
          expect(next.board[capture.row][capture.col]).toBeNull();
        }
      }
    });

    it('ne donne priorité ni à une dame ni à la capture d’une dame à nombre égal', () => {
      const state = freezeInput(positionState([
        [2, 1, 0], [3, 2, 1], [2, 7, 0, 'king'], [3, 8, 1, 'king'],
      ]));
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toEqual([
        {
          type: 'move', from: { row: 2, col: 1 }, to: { row: 4, col: 3 },
          captured: [{ row: 3, col: 2 }],
        },
        {
          type: 'move', from: { row: 2, col: 7 }, to: { row: 4, col: 9 },
          captured: [{ row: 3, col: 8 }],
        },
      ]);
      for (const action of actions) {
        const next = engine.applyAction(state, freezeInput(action), 'p1');
        expect(next.moveHistory[0].captures).toEqual(action.captured);
        expect(next.board[action.to.row][action.to.col].type)
          .toBe(state.board[action.from.row][action.from.col].type);
      }
      for (const bot of [new RandomBot(), new SmartBot()]) {
        const chosen = bot.chooseAction(state, freezeInput(actions), { pick: (values) => values[0] });
        expect(actions).toContainEqual(chosen);
        expect(engine.applyAction(state, chosen, 'p1').moveHistory[0].captures)
          .toEqual(chosen.captured);
      }
    });

    it('préserve tous les déplacements simples quand aucune capture n’existe', () => {
      const state = freezeInput(engine.init({ seed: 42, playerIds: ['p1', 'p2'] }));
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toHaveLength(9);
      expect(actions.every((action) => action.from.row === 3 && action.to.row === 4)).toBe(true);
      for (const action of actions) {
        expect(action.captured).toBeUndefined();
        const next = engine.applyAction(state, freezeInput(action), 'p1');
        expect(next.moveHistory[0].captures).toBeUndefined();
        expect(next.board[action.to.row][action.to.col]).toEqual({ player: 0, type: 'pawn' });
      }
    });

    it.each([
      [0, 'p1', [[5, 4, 0], [4, 3, 1]], { row: 5, col: 4 }, { row: 3, col: 2 }],
      [1, 'p2', [[4, 3, 1], [5, 4, 0]], { row: 4, col: 3 }, { row: 6, col: 5 }],
    ])('permet au pion du joueur %i de capturer en arrière', (player, id, pieces, from, to) => {
      const state = freezeInput(positionState(pieces, player));
      const actions = engine.getValidActions(state, id);
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ from, to });
      const next = engine.applyAction(state, freezeInput(actions[0]), id);
      expect(next.board[to.row][to.col]).toEqual({ player, type: 'pawn' });
      expect(next).toMatchObject({ status: 'won', winner: player });
    });

    it('ne promeut pas pendant une rafle qui quitte la dernière rangée', () => {
      const state = positionState([[7, 2, 0], [8, 3, 1], [8, 5, 1]]);
      const actions = engine.getValidActions(state, 'p1');
      expect(actions).toEqual([{
        type: 'move', from: { row: 7, col: 2 }, to: { row: 7, col: 6 },
        captured: [{ row: 8, col: 3 }, { row: 8, col: 5 }],
      }]);
      const next = engine.applyAction(state, actions[0], 'p1');
      expect(next.board[7][6]).toEqual({ player: 0, type: 'pawn' });
      expect(next).toMatchObject({ status: 'won', winner: 0 });
    });

    it('promeut à la fin d’une capture atteignant la dernière rangée', () => {
      const state = positionState([[7, 2, 0], [8, 3, 1]]);
      const action = engine.getValidActions(state, 'p1')[0];
      const next = engine.applyAction(state, action, 'p1');
      expect(next.board[9][4]).toEqual({ player: 0, type: 'king' });
      expect(next).toMatchObject({ status: 'won', winner: 0 });
      expect(engine.getValidActions(next, 'p2')).toEqual([]);
      expect(engine.isValidAction(next, action, 'p1')).toBe(false);
    });

    it('une dame peut atterrir sur chaque case libre au-delà de la prise', () => {
      const state = freezeInput(positionState([[2, 1, 0, 'king'], [4, 3, 1]]));
      const actions = engine.getValidActions(state, 'p1');
      expect(actions.map((action) => action.to)).toEqual([
        { row: 5, col: 4 }, { row: 6, col: 5 }, { row: 7, col: 6 },
        { row: 8, col: 7 }, { row: 9, col: 8 },
      ]);
      for (const action of actions) {
        expect(action.captured).toEqual([{ row: 4, col: 3 }]);
        const next = engine.applyAction(state, freezeInput(action), 'p1');
        expect(next.board[4][3]).toBeNull();
        expect(next.board[action.to.row][action.to.col]).toEqual({ player: 0, type: 'king' });
        expect(next).toMatchObject({ status: 'won', winner: 0 });
      }
    });

    it('une dame ne traverse pas deux adversaires contigus ni une pièce alliée', () => {
      const blocked = positionState([[2, 1, 0, 'king'], [4, 3, 1], [5, 4, 1]]);
      expect(engine.getValidActions(blocked, 'p1').every((action) => !action.captured)).toBe(true);
      const ally = positionState([[2, 1, 0, 'king'], [4, 3, 0], [5, 4, 1]]);
      const kingActions = engine.getValidActions(ally, 'p1')
        .filter((action) => action.from.row === 2);
      expect(kingActions).toEqual([]);
    });

    it('préserve les trajets maximaux distincts partageant les mêmes extrémités', () => {
      const state = freezeInput(positionState([
        [1, 4, 0, 'king'], [6, 3, 1], [3, 6, 1], [6, 7, 1], [2, 3, 1], [6, 5, 1],
      ]));
      const alternatives = engine.getValidActions(state, 'p1')
        .filter((action) => action.to.row === 0 && action.to.col === 5);
      expect(alternatives).toEqual([
        {
          type: 'move', from: { row: 1, col: 4 }, to: { row: 0, col: 5 },
          captured: [{ row: 3, col: 6 }, { row: 6, col: 5 }, { row: 6, col: 3 }, { row: 2, col: 3 }],
        },
        {
          type: 'move', from: { row: 1, col: 4 }, to: { row: 0, col: 5 },
          captured: [{ row: 3, col: 6 }, { row: 6, col: 7 }, { row: 6, col: 5 }, { row: 2, col: 3 }],
        },
        {
          type: 'move', from: { row: 1, col: 4 }, to: { row: 0, col: 5 },
          captured: [{ row: 3, col: 6 }, { row: 6, col: 7 }, { row: 6, col: 3 }, { row: 2, col: 3 }],
        },
      ]);
      for (const action of alternatives) {
        const next = engine.applyAction(state, freezeInput(action), 'p1');
        expect(next.moveHistory[0].captures).toEqual(action.captured);
        const expectedBoard = jsonCopy(state.board);
        expectedBoard[1][4] = null;
        expectedBoard[0][5] = { player: 0, type: 'king' };
        for (const capture of action.captured) {
          expectedBoard[capture.row][capture.col] = null;
        }
        expect(next.board).toEqual(expectedBoard);
      }
      // Sans trajet légal fourni, l'ordre déterministe des actions tranche l'ambiguïté.
      const { captured: _captured, ...withoutRoute } = alternatives[0];
      expect(engine.applyAction(state, freezeInput(withoutRoute), 'p1'))
        .toEqual(engine.applyAction(state, alternatives[0], 'p1'));
      expect(engine.applyAction(state, { ...withoutRoute, captured: [{ row: 6, col: 7 }] }, 'p1'))
        .toEqual(engine.applyAction(state, alternatives[0], 'p1'));
    });

    it('refuse une action illégale sans modifier état, historique ou action', () => {
      const state = freezeInput(zigzag());
      const action = freezeInput({
        type: 'move', from: { row: 0, col: 9 }, to: { row: 1, col: 8 },
        captured: zigzagAction.captured,
      });
      const before = jsonCopy({ state, action });
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
      expect(() => engine.applyAction(state, action, 'p1')).toThrow('Invalid action');
      expect(jsonCopy({ state, action })).toEqual(before);
    });
  });

  describe('Replay JSON avec le moteur réel', () => {
    it('reprend une partie légale et conserve chaque état, action, capture et seed', () => {
      const config = { seed: 314159, playerIds: ['p1', 'p2'] };
      let state = engine.init(config);
      let restored = jsonCopy(state);
      const recorded = [];
      const expectedStates = [];
      for (let turn = 0; turn < 24 && state.status === 'playing'; turn++) {
        const id = state.playerIds[state.currentPlayer];
        freezeInput(state);
        freezeInput(restored);
        const legal = engine.getValidActions(state, id);
        expect(engine.getValidActions(restored, id)).toEqual(legal);
        const action = freezeInput(legal[(turn * 7) % legal.length]);
        const snapshot = jsonCopy({ state, action });
        const inputState = state;
        recorded.push(jsonCopy(action));
        state = engine.applyAction(state, action, id);
        restored = jsonCopy(engine.applyAction(restored, jsonCopy(action), id));
        expect(restored).toEqual(jsonCopy(state));
        expect(jsonCopy(inputState)).toEqual(snapshot.state);
        expect(jsonCopy(action)).toEqual(snapshot.action);
        expect(state.seed).toBe('314159');
        expectedStates.push(jsonCopy(state));
      }
      expect(recorded).toHaveLength(24);
      expect(recorded.some((action) => action.captured?.length > 0)).toBe(true);
      let replay = engine.init(config);
      jsonCopy(recorded).forEach((action, index) => {
        const id = replay.playerIds[replay.currentPlayer];
        expect(engine.getValidActions(replay, id)).toContainEqual(action);
        replay = engine.applyAction(freezeInput(replay), freezeInput(action), id);
        expect(jsonCopy(replay)).toEqual(expectedStates[index]);
      });
    });
  });
});
