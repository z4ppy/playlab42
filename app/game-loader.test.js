/**
 * Tests: app/game-loader.js - openGame et openTool
 * @see openspec/changes/extend-hash-routing-games-tools/specs/router-games-tools/spec.md
 */

import { openGame, openTool, loadGame, unloadGame } from './game-loader.js';
import { state, setState } from './state.js';
import { el } from './dom-cache.js';

// Mock fetch
global.fetch = jest.fn();

// Mocks
jest.mock('./state.js');
jest.mock('./dom-cache.js');
jest.mock('./storage.js');

describe('game-loader: openGame and openTool functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
    state.currentGame = null;
    state.currentView = 'catalogue';
    window.location.hash = '';
  });

  // ===== openGame TESTS =====

  describe('openGame(gameId)', () => {
    it('validates game existence with HEAD request before loading', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openGame('tictactoe');

      expect(global.fetch).toHaveBeenCalledWith(
        'games/tictactoe/index.html',
        { method: 'HEAD' },
      );
    });

    it('loads game when HEAD request succeeds', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });
      jest.spyOn(window.location, 'hash', 'set');

      await openGame('tictactoe');

      // Verify hash was set
      expect(window.location.hash).toBe('#/games/tictactoe');
    });

    it('returns to catalogue with #/ hash when game not found (404)', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      jest.spyOn(window.location, 'hash', 'set');

      await openGame('nonexistent');

      expect(window.location.hash).toBe('#/');
    });

    it('returns to catalogue on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      jest.spyOn(window.location, 'hash', 'set');

      await openGame('tictactoe');

      expect(window.location.hash).toBe('#/');
    });

    it('does not reload if same game already open', async () => {
      state.currentGame = { id: 'tictactoe' };
      state.currentView = 'game';

      await openGame('tictactoe');

      // fetch should not be called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('loads different game if different ID provided', async () => {
      state.currentGame = { id: 'tictactoe' };
      state.currentView = 'game';
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openGame('checkers');

      expect(global.fetch).toHaveBeenCalledWith(
        'games/checkers/index.html',
        { method: 'HEAD' },
      );
    });
  });

  // ===== openTool TESTS =====

  describe('openTool(toolId)', () => {
    it('validates tool existence with HEAD request before loading', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openTool('json-formatter');

      expect(global.fetch).toHaveBeenCalledWith(
        'tools/json-formatter/index.html',
        { method: 'HEAD' },
      );
    });

    it('loads tool when HEAD request succeeds', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });
      jest.spyOn(window.location, 'hash', 'set');

      await openTool('json-formatter');

      expect(window.location.hash).toBe('#/tools/json-formatter');
    });

    it('returns to catalogue with #/ hash when tool not found', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      jest.spyOn(window.location, 'hash', 'set');

      await openTool('nonexistent-tool');

      expect(window.location.hash).toBe('#/');
    });

    it('returns to catalogue on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      jest.spyOn(window.location, 'hash', 'set');

      await openTool('json-formatter');

      expect(window.location.hash).toBe('#/');
    });

    it('does not reload if same tool already open', async () => {
      state.currentGame = { id: 'json-formatter' };
      state.currentView = 'game';

      await openTool('json-formatter');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ===== EDGE CASES =====

  describe('Edge cases', () => {
    it('handles IDs with hyphens: openGame("card-game")', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openGame('card-game');

      expect(global.fetch).toHaveBeenCalledWith(
        'games/card-game/index.html',
        { method: 'HEAD' },
      );
    });

    it('handles IDs with numbers: openGame("game2048")', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openGame('game2048');

      expect(global.fetch).toHaveBeenCalledWith(
        'games/game2048/index.html',
        { method: 'HEAD' },
      );
    });
  });
});
