/**
 * Tests unitaires pour TicTacToeEngine
 * @see openspec/specs/game-engine/spec.md
 */

import { TicTacToeEngine } from './engine.js';

describe('TicTacToeEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  describe('init()', () => {
    it('crée un état initial valide', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['player1', 'player2'],
      });

      expect(state.board).toEqual([null, null, null, null, null, null, null, null, null]);
      expect(state.currentPlayerId).toBe('player1');
      expect(state.gameOver).toBe(false);
      expect(state.winners).toBe(null);
      expect(state.turn).toBe(1);
      expect(state.playerIds).toEqual(['player1', 'player2']);
    });

    it('assigne X au premier joueur et O au second', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['alice', 'bob'],
      });

      expect(state.symbols.alice).toBe('X');
      expect(state.symbols.bob).toBe('O');
    });

    it('conserve la seed pour le replay', () => {
      const state = engine.init({
        seed: 12345,
        playerIds: ['p1', 'p2'],
      });

      expect(state.rngState).toBe(12345);
    });
  });

  describe('applyAction()', () => {
    it('place le symbole sur la case', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const newState = engine.applyAction(state, { type: 'place', position: 4 }, 'p1');

      expect(newState.board[4]).toBe('X');
    });

    it('passe au joueur suivant après un coup', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const newState = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');

      expect(newState.currentPlayerId).toBe('p2');
    });

    it('incrémente le numéro de tour', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const newState = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');

      expect(newState.turn).toBe(2);
    });

    it('ne modifie pas l\'état original (immutabilité)', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });
      const originalBoard = [...state.board];

      engine.applyAction(state, { type: 'place', position: 4 }, 'p1');

      expect(state.board).toEqual(originalBoard);
    });

    it('lève une erreur pour une action invalide', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Case déjà occupée
      const stateWithX = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');

      expect(() => {
        engine.applyAction(stateWithX, { type: 'place', position: 0 }, 'p2');
      }).toThrow('Invalid action');
    });
  });

  describe('isValidAction()', () => {
    it('accepte un coup sur une case vide', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      expect(engine.isValidAction(state, { type: 'place', position: 4 }, 'p1')).toBe(true);
    });

    it('refuse un coup sur une case occupée', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });
      const stateWithX = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');

      expect(engine.isValidAction(stateWithX, { type: 'place', position: 0 }, 'p2')).toBe(false);
    });

    it('refuse un coup si ce n\'est pas le tour du joueur', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      expect(engine.isValidAction(state, { type: 'place', position: 0 }, 'p2')).toBe(false);
    });

    it('refuse un coup après la fin de partie', () => {
      let state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // X gagne en ligne 0
      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1'); // X
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2'); // O
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1'); // X
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2'); // O
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1'); // X gagne

      expect(engine.isValidAction(state, { type: 'place', position: 5 }, 'p2')).toBe(false);
    });

    it('refuse une position hors limites', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      expect(engine.isValidAction(state, { type: 'place', position: -1 }, 'p1')).toBe(false);
      expect(engine.isValidAction(state, { type: 'place', position: 9 }, 'p1')).toBe(false);
    });
  });

  describe('getValidActions()', () => {
    it('retourne 9 actions au début', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const actions = engine.getValidActions(state, 'p1');

      expect(actions).toHaveLength(9);
      expect(actions).toContainEqual({ type: 'place', position: 0 });
      expect(actions).toContainEqual({ type: 'place', position: 8 });
    });

    it('retourne moins d\'actions quand des cases sont prises', () => {
      let state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });
      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');

      const actions = engine.getValidActions(state, 'p1');

      expect(actions).toHaveLength(7);
      expect(actions).not.toContainEqual({ type: 'place', position: 0 });
      expect(actions).not.toContainEqual({ type: 'place', position: 4 });
    });

    it('retourne un tableau vide si ce n\'est pas le tour du joueur', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const actions = engine.getValidActions(state, 'p2');

      expect(actions).toEqual([]);
    });

    it('retourne un tableau vide après la fin de partie', () => {
      let state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // X gagne
      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');

      expect(engine.getValidActions(state, 'p1')).toEqual([]);
      expect(engine.getValidActions(state, 'p2')).toEqual([]);
    });
  });

  describe('Détection de victoire', () => {
    const testWin = (positions, winnerId) => {
      let state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      // Alterner les coups pour atteindre les positions gagnantes
      const moves = positions.map((pos, i) => ({
        position: pos,
        player: i % 2 === 0 ? 'p1' : 'p2',
      }));

      for (const { position, player } of moves) {
        if (state.currentPlayerId !== player) {
          // Ajouter un coup intermédiaire si nécessaire
          const otherMove = engine.getValidActions(state, state.currentPlayerId)
            .find(a => !positions.includes(a.position));
          if (otherMove) {
            state = engine.applyAction(state, otherMove, state.currentPlayerId);
          }
        }
        state = engine.applyAction(state, { type: 'place', position }, state.currentPlayerId);
      }

      return state;
    };

    it('détecte la victoire en ligne horizontale (0,1,2)', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p1']);
    });

    it('détecte la victoire en colonne (0,3,6)', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 6 }, 'p1');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p1']);
    });

    it('détecte la victoire en diagonale (0,4,8)', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 8 }, 'p1');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p1']);
    });

    it('détecte la victoire en anti-diagonale (2,4,6)', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 6 }, 'p1');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p1']);
    });

    it('détecte la victoire du joueur 2', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 6 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 5 }, 'p2');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p2']);
    });
  });

  describe('Détection de match nul', () => {
    it('détecte le match nul quand la grille est pleine sans gagnant', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      // Grille finale:
      // X | O | X
      // X | X | O
      // O | X | O
      const moves = [
        { position: 0, player: 'p1' }, // X
        { position: 1, player: 'p2' }, // O
        { position: 2, player: 'p1' }, // X
        { position: 4, player: 'p2' }, // O - centre pour éviter victoire
        { position: 3, player: 'p1' }, // X
        { position: 6, player: 'p2' }, // O
        { position: 5, player: 'p1' }, // X - mais c'est le tour de p2!
      ];

      // Partie nulle classique
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p1'); // X centre
      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p2'); // O coin
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1'); // X coin
      state = engine.applyAction(state, { type: 'place', position: 6 }, 'p2'); // O bloque diag
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p1'); // X
      state = engine.applyAction(state, { type: 'place', position: 5 }, 'p2'); // O bloque
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1'); // X
      state = engine.applyAction(state, { type: 'place', position: 7 }, 'p2'); // O
      state = engine.applyAction(state, { type: 'place', position: 8 }, 'p1'); // X - dernier coup

      expect(state.gameOver).toBe(true);
      expect(state.winners).toBe(null);
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

  describe('getWinningLine()', () => {
    it('retourne la ligne gagnante', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');

      const line = engine.getWinningLine(state.board);

      expect(line).toEqual([0, 1, 2]);
    });

    it('retourne null s\'il n\'y a pas de gagnant', () => {
      const state = engine.init({
        seed: 42,
        playerIds: ['p1', 'p2'],
      });

      const line = engine.getWinningLine(state.board);

      expect(line).toBe(null);
    });

    it('retourne chacune des 8 lignes dans leur ordre de déclaration', () => {
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
      ];
      for (const line of lines) {
        const board = Array(9).fill(null);
        for (const index of line) { board[index] = 'O'; }
        expect(engine.getWinningLine(board)).toEqual(line);
      }
    });

    it('privilégie la première ligne déclarée quand deux lignes sont complètes', () => {
      const board = ['X', 'X', 'X', 'X', 'O', 'O', 'X', 'O', 'O'];
      expect(engine.getWinningLine(board)).toEqual([0, 1, 2]);
      expect(engine.getWinningLine(['X', 'O', 'O', 'X', 'X', 'X', 'X', 'O', 'O'])).toEqual([3, 4, 5]);
    });

    it('retourne une copie : modifier la ligne n\'altère pas les lignes du moteur', () => {
      const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
      engine.getWinningLine(board).push(99);
      expect(engine.getWinningLine(board)).toEqual([0, 1, 2]);
    });

    it('ne modifie pas la grille inspectée', () => {
      const board = Object.freeze(['X', 'X', 'X', null, 'O', 'O', null, null, null]);
      expect(engine.getWinningLine(board)).toEqual([0, 1, 2]);
      expect(board).toEqual(['X', 'X', 'X', null, 'O', 'O', null, null, null]);
    });
  });

  describe('Méthodes utilitaires', () => {
    it('isGameOver() retourne le bon état', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      expect(engine.isGameOver(state)).toBe(false);

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');

      expect(engine.isGameOver(state)).toBe(true);
    });

    it('getWinners() retourne les gagnants', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      expect(engine.getWinners(state)).toBe(null);

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 3 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 1 }, 'p1');
      state = engine.applyAction(state, { type: 'place', position: 4 }, 'p2');
      state = engine.applyAction(state, { type: 'place', position: 2 }, 'p1');

      expect(engine.getWinners(state)).toEqual(['p1']);
    });

    it('getCurrentPlayer() retourne le joueur actif', () => {
      let state = engine.init({ seed: 42, playerIds: ['p1', 'p2'] });

      expect(engine.getCurrentPlayer(state)).toBe('p1');

      state = engine.applyAction(state, { type: 'place', position: 0 }, 'p1');

      expect(engine.getCurrentPlayer(state)).toBe('p2');
    });
  });
});
