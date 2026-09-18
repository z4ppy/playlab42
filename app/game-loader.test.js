/**
 * @jest-environment jsdom
 *
 * Tests: app/game-loader.js - openGame et openTool
 * @see openspec/changes/archive/extend-hash-routing-games-tools/specs/router-games-tools/spec.md
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock de fetch (HEAD de validation d'existence)
global.fetch = jest.fn();

// Mocks ESM : unstable_mockModule + import dynamique (cf. jest.config.js)
const state = { currentGame: null, currentView: 'catalogue', preferences: { sound: true } };
const setState = jest.fn((updates) => Object.assign(state, updates));

// Élément DOM minimal : loadGame() manipule classList, textContent et src
const stubEl = () => document.createElement('div');
const el = {
  viewCatalogue: stubEl(),
  viewSettings: stubEl(),
  viewGame: stubEl(),
  gameTitle: stubEl(),
  loading: stubEl(),
  gameIframe: stubEl(),
  btnSound: stubEl(),
};

jest.unstable_mockModule('./state.js', () => ({
  state,
  setState,
  STORAGE_KEYS: {},
  MAX_RECENT: 5,
}));
jest.unstable_mockModule('./dom-cache.js', () => ({ el }));
jest.unstable_mockModule('./storage.js', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn(),
  getEpicProgress: jest.fn(),
  addToRecent: jest.fn(),
}));

// Import dynamique après les mocks
const { openGame, openTool } = await import('./game-loader.js');

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

      await openGame('tictactoe');

      // Verify hash was set
      expect(window.location.hash).toBe('#/games/tictactoe');
    });

    it('returns to catalogue with #/ hash when game not found (404)', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await openGame('nonexistent');

      expect(window.location.hash).toBe('#/');
    });

    it('returns to catalogue on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

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
    it('tries complex path first (tools/:id/index.html)', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openTool('relativity-lab');

      expect(global.fetch).toHaveBeenCalledWith(
        'tools/relativity-lab/index.html',
        { method: 'HEAD' },
      );
    });

    it('falls back to simple path (tools/:id.html) if complex fails', async () => {
      // Complex path fails, simple path succeeds
      global.fetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await openTool('json-formatter');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1,
        'tools/json-formatter/index.html',
        { method: 'HEAD' },
      );
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        'tools/json-formatter.html',
        { method: 'HEAD' },
      );
    });

    it('loads tool when HEAD request succeeds', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      await openTool('relativity-lab');

      expect(window.location.hash).toBe('#/tools/relativity-lab');
    });

    it('returns to catalogue with #/ hash when tool not found in both paths', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false });

      await openTool('nonexistent-tool');

      expect(window.location.hash).toBe('#/');
    });

    it('returns to catalogue on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

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
