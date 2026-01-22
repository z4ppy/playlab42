/**
 * Tests unitaires pour le moteur Mastermind
 */

import { MastermindEngine } from './engine.js';

describe('MastermindEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new MastermindEngine();
  });

  describe('init', () => {
    it('should initialize a new game with secret code', () => {
      const state = engine.init({ seed: 12345, playerId: 'player1' });

      expect(state.secretCode).toHaveLength(4);
      expect(state.secretCode.every((c) => ['R', 'B', 'G', 'Y', 'O', 'V'].includes(c))).toBe(true);
      expect(state.attempts).toEqual([]);
      expect(state.gameOver).toBe(false);
      expect(state.winner).toBeNull();
      expect(state.maxAttempts).toBe(10);
      expect(state.playerId).toBe('player1');
    });

    it('should generate same secret code with same seed', () => {
      const state1 = engine.init({ seed: 42, playerId: 'p1' });
      const state2 = engine.init({ seed: 42, playerId: 'p2' });

      expect(state1.secretCode).toEqual(state2.secretCode);
    });

    it('should generate different secret codes with different seeds', () => {
      const state1 = engine.init({ seed: 1, playerId: 'p1' });
      const state2 = engine.init({ seed: 2, playerId: 'p1' });

      expect(state1.secretCode).not.toEqual(state2.secretCode);
    });
  });

  describe('Feedback Calculation (via applyAction)', () => {
    it('should give 4 black for all correct', () => {
      const state = engine.init({ seed: 1000, playerId: 'p1' });
      // On utilise le code secret lui-même
      const action = { type: 'submit', code: state.secretCode };
      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.attempts).toHaveLength(1);
      expect(newState.attempts[0].feedback).toEqual({ black: 4, white: 0 });
      expect(newState.gameOver).toBe(true);
      expect(newState.winner).toBe('p1');
    });

    it('should give 0 black 0 white for all wrong colors', () => {
      // Forcer un code secret connu
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      const action = { type: 'submit', code: ['O', 'V', 'O', 'V'] };
      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.attempts[0].feedback).toEqual({ black: 0, white: 0 });
      expect(newState.gameOver).toBe(false);
    });

    it('should give 0 black 4 white for all colors wrong position', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'R', 'B', 'B'],
      };

      const action = { type: 'submit', code: ['B', 'B', 'R', 'R'] };
      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.attempts[0].feedback).toEqual({ black: 0, white: 4 });
    });

    it('should give 1 black 3 white for mixed match', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      const action = { type: 'submit', code: ['R', 'Y', 'B', 'G'] };
      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.attempts[0].feedback).toEqual({ black: 1, white: 3 });
    });

    it('should handle duplicates correctly (no double counting)', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      // Deux R dans la tentative, mais un seul dans le secret
      const action = { type: 'submit', code: ['R', 'R', 'O', 'O'] };
      const newState = engine.applyAction(state, action, 'p1');

      expect(newState.attempts[0].feedback).toEqual({ black: 1, white: 0 });
    });

    it('should handle complex duplicate scenario', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'B', 'Y'],
      };

      // 3 B dans la tentative, mais seulement 2 dans le secret
      const action = { type: 'submit', code: ['B', 'B', 'B', 'O'] };
      const newState = engine.applyAction(state, action, 'p1');

      // Position 1 : B correct (1 black)
      // Position 2 : B correct (1 black)
      // Position 0 : B déjà comptés les 2 dans le secret, pas de white
      // Total : 2 black, 0 white
      expect(newState.attempts[0].feedback).toEqual({ black: 2, white: 0 });
    });
  });

  describe('Game Flow', () => {
    it('should track multiple attempts', () => {
      const state1 = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      const state2 = engine.applyAction(state1, { type: 'submit', code: ['O', 'O', 'O', 'O'] }, 'p1');
      expect(state2.attempts).toHaveLength(1);

      const state3 = engine.applyAction(state2, { type: 'submit', code: ['R', 'R', 'R', 'R'] }, 'p1');
      expect(state3.attempts).toHaveLength(2);
      expect(state3.gameOver).toBe(false);
    });

    it('should end game after 10 failed attempts', () => {
      let state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      // 9 tentatives ratées
      for (let i = 0; i < 9; i++) {
        state = engine.applyAction(state, { type: 'submit', code: ['O', 'O', 'O', 'O'] }, 'p1');
        expect(state.gameOver).toBe(false);
      }

      // 10ème tentative ratée
      state = engine.applyAction(state, { type: 'submit', code: ['O', 'O', 'O', 'O'] }, 'p1');
      expect(state.gameOver).toBe(true);
      expect(state.winner).toBeNull(); // Défaite
      expect(state.attempts).toHaveLength(10);
    });

    it('should end game on correct guess', () => {
      const state1 = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
      };

      const state2 = engine.applyAction(state1, { type: 'submit', code: ['R', 'B', 'G', 'Y'] }, 'p1');

      expect(state2.gameOver).toBe(true);
      expect(state2.winner).toBe('p1');
      expect(state2.attempts).toHaveLength(1);
    });
  });

  describe('isValidAction', () => {
    let state;

    beforeEach(() => {
      state = engine.init({ seed: 1, playerId: 'p1' });
    });

    it('should accept valid submit action', () => {
      const action = { type: 'submit', code: ['R', 'B', 'G', 'Y'] };
      expect(engine.isValidAction(state, action, 'p1')).toBe(true);
    });

    it('should reject submit with wrong number of colors', () => {
      const action = { type: 'submit', code: ['R', 'B'] };
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
    });

    it('should reject submit with invalid color', () => {
      const action = { type: 'submit', code: ['R', 'B', 'G', 'X'] };
      expect(engine.isValidAction(state, action, 'p1')).toBe(false);
    });

    it('should reject submit when game is over', () => {
      const gameOverState = { ...state, gameOver: true };
      const action = { type: 'submit', code: ['R', 'B', 'G', 'Y'] };
      expect(engine.isValidAction(gameOverState, action, 'p1')).toBe(false);
    });

    it('should reject action from wrong player', () => {
      const action = { type: 'submit', code: ['R', 'B', 'G', 'Y'] };
      expect(engine.isValidAction(state, action, 'p2')).toBe(false);
    });

    it('should accept reset action', () => {
      const action = { type: 'reset' };
      expect(engine.isValidAction(state, action, 'p1')).toBe(true);
    });
  });

  describe('getValidActions', () => {
    it('should return reset and submit actions for active game', () => {
      const state = engine.init({ seed: 1, playerId: 'p1' });
      const actions = engine.getValidActions(state, 'p1');

      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({ type: 'reset' });
      expect(actions[1].type).toBe('submit');
    });

    it('should return only reset action when game is over', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        gameOver: true,
      };
      const actions = engine.getValidActions(state, 'p1');

      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: 'reset' });
    });

    it('should return empty array for wrong player', () => {
      const state = engine.init({ seed: 1, playerId: 'p1' });
      const actions = engine.getValidActions(state, 'p2');

      expect(actions).toEqual([]);
    });
  });

  describe('getPlayerView', () => {
    it('should hide secret code during game', () => {
      const state = engine.init({ seed: 1, playerId: 'p1' });
      const view = engine.getPlayerView(state, 'p1');

      expect(view.secretCode).toBeNull();
      expect(view.attempts).toEqual([]);
      expect(view.gameOver).toBe(false);
    });

    it('should reveal secret code when game is over', () => {
      const state = {
        ...engine.init({ seed: 1, playerId: 'p1' }),
        secretCode: ['R', 'B', 'G', 'Y'],
        gameOver: true,
      };

      const view = engine.getPlayerView(state, 'p1');

      expect(view.secretCode).toEqual(['R', 'B', 'G', 'Y']);
    });
  });

  describe('Reset Action', () => {
    it('should start a new game with reset action', () => {
      let state = engine.init({ seed: 1, playerId: 'p1' });

      // Faire quelques tentatives
      state = engine.applyAction(state, { type: 'submit', code: ['R', 'R', 'R', 'R'] }, 'p1');
      state = engine.applyAction(state, { type: 'submit', code: ['B', 'B', 'B', 'B'] }, 'p1');

      expect(state.attempts).toHaveLength(2);

      // Reset
      const newState = engine.applyAction(state, { type: 'reset' }, 'p1');

      expect(newState.attempts).toHaveLength(0);
      expect(newState.gameOver).toBe(false);
      expect(newState.winner).toBeNull();
      // Le code secret devrait être différent (nouveau seed basé sur Date.now())
    });
  });

  describe('Determinism', () => {
    it('should produce same game with same seed and actions', () => {
      const state1a = engine.init({ seed: 42, playerId: 'p1' });
      const state1b = engine.applyAction(state1a, { type: 'submit', code: ['R', 'B', 'G', 'Y'] }, 'p1');
      const state1c = engine.applyAction(state1b, { type: 'submit', code: ['O', 'V', 'R', 'B'] }, 'p1');

      const state2a = engine.init({ seed: 42, playerId: 'p1' });
      const state2b = engine.applyAction(state2a, { type: 'submit', code: ['R', 'B', 'G', 'Y'] }, 'p1');
      const state2c = engine.applyAction(state2b, { type: 'submit', code: ['O', 'V', 'R', 'B'] }, 'p1');

      expect(state1a.secretCode).toEqual(state2a.secretCode);
      expect(state1b.attempts).toEqual(state2b.attempts);
      expect(state1c.attempts).toEqual(state2c.attempts);
    });
  });
});
