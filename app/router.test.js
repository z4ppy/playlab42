/**
 * Tests: app/router.js
 * @see openspec/changes/extend-hash-routing-games-tools/specs/router-games-tools/spec.md
 */

import { handleHashRoute } from './router.js';
import { state, setState } from './state.js';
import { openEpic, closeParcours } from './parcours.js';
import { openGame, openTool, unloadGame } from './game-loader.js';

// Mocks
jest.mock('./state.js');
jest.mock('./parcours.js');
jest.mock('./game-loader.js');

describe('router: Hash routing for games and tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.currentView = 'catalogue';
  });

  // ===== GAME ROUTES =====

  describe('Route: #/games/:id', () => {
    it('parses #/games/tictactoe and calls openGame', () => {
      window.location.hash = '#/games/tictactoe';
      handleHashRoute();
      expect(openGame).toHaveBeenCalledWith('tictactoe');
    });

    it('parses #/games/checkers and calls openGame', () => {
      window.location.hash = '#/games/checkers';
      handleHashRoute();
      expect(openGame).toHaveBeenCalledWith('checkers');
    });

    it('handles kebab-case IDs like #/games/card-game', () => {
      window.location.hash = '#/games/card-game';
      handleHashRoute();
      expect(openGame).toHaveBeenCalledWith('card-game');
    });

    it('handles IDs with numbers like #/games/game2048', () => {
      window.location.hash = '#/games/game2048';
      handleHashRoute();
      expect(openGame).toHaveBeenCalledWith('game2048');
    });
  });

  describe('Route: #/tools/:id', () => {
    it('parses #/tools/json-formatter and calls openTool', () => {
      window.location.hash = '#/tools/json-formatter';
      handleHashRoute();
      expect(openTool).toHaveBeenCalledWith('json-formatter');
    });

    it('parses #/tools/neural-style and calls openTool', () => {
      window.location.hash = '#/tools/neural-style';
      handleHashRoute();
      expect(openTool).toHaveBeenCalledWith('neural-style');
    });

    it('handles kebab-case IDs like #/tools/my-tool', () => {
      window.location.hash = '#/tools/my-tool';
      handleHashRoute();
      expect(openTool).toHaveBeenCalledWith('my-tool');
    });
  });

  // ===== PARCOURS ROUTES =====

  describe('Route: #/parcours/:epic', () => {
    it('parses #/parcours/guide-contribution and calls openEpic', () => {
      window.location.hash = '#/parcours/guide-contribution';
      handleHashRoute();
      expect(openEpic).toHaveBeenCalledWith('guide-contribution', undefined);
    });

    it('parses #/parcours/deep-learning/slide-2 with slideId', () => {
      window.location.hash = '#/parcours/deep-learning/slide-2';
      handleHashRoute();
      expect(openEpic).toHaveBeenCalledWith('deep-learning', 'slide-2');
    });
  });

  // ===== DEFAULT/FALLBACK =====

  describe('Default: No route match', () => {
    it('closes parcours when hash is empty and currentView is parcours', () => {
      state.currentView = 'parcours';
      window.location.hash = '';
      handleHashRoute();
      expect(closeParcours).toHaveBeenCalled();
      expect(openGame).not.toHaveBeenCalled();
    });

    it('unloads game when hash is empty and currentView is game', () => {
      state.currentView = 'game';
      window.location.hash = '';
      handleHashRoute();
      expect(unloadGame).toHaveBeenCalled();
    });

    it('does nothing when hash is empty and currentView is catalogue', () => {
      state.currentView = 'catalogue';
      window.location.hash = '';
      handleHashRoute();
      expect(closeParcours).not.toHaveBeenCalled();
      expect(unloadGame).not.toHaveBeenCalled();
    });

    it('unloads game on invalid route when currentView is game', () => {
      state.currentView = 'game';
      window.location.hash = '#/invalid/path';
      handleHashRoute();
      expect(unloadGame).toHaveBeenCalled();
    });
  });

  // ===== INVALID FORMATS =====

  describe('Invalid formats: rejected', () => {
    it('rejects #/games/InvalidID (uppercase)', () => {
      window.location.hash = '#/games/InvalidID';
      handleHashRoute();
      expect(openGame).not.toHaveBeenCalled();
    });

    it('rejects #/games/with_underscore (underscore)', () => {
      window.location.hash = '#/games/with_underscore';
      handleHashRoute();
      expect(openGame).not.toHaveBeenCalled();
    });

    it('rejects #/games/with space (space)', () => {
      window.location.hash = '#/games/with space';
      handleHashRoute();
      expect(openGame).not.toHaveBeenCalled();
    });

    it('rejects #/tools/with@symbol', () => {
      window.location.hash = '#/tools/with@symbol';
      handleHashRoute();
      expect(openTool).not.toHaveBeenCalled();
    });
  });

  // ===== PATTERN PRIORITY =====

  describe('Pattern priority: games before tools before parcours', () => {
    it('matches game route before tool route (if both were valid)', () => {
      window.location.hash = '#/games/test';
      handleHashRoute();
      expect(openGame).toHaveBeenCalledWith('test');
      expect(openTool).not.toHaveBeenCalled();
      expect(openEpic).not.toHaveBeenCalled();
    });

    it('matches tool route before parcours route (if both were valid)', () => {
      window.location.hash = '#/tools/test';
      handleHashRoute();
      expect(openTool).toHaveBeenCalledWith('test');
      expect(openEpic).not.toHaveBeenCalled();
    });
  });
});
