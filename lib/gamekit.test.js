/**
 * Tests unitaires pour lib/gamekit.js
 * GameKit - SDK pour les jeux Playlab42
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock du module assets avant l'import de gamekit
jest.unstable_mockModule('./assets.js', () => ({
  AssetLoader: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
  })),
}));

const { GameKit } = await import('./gamekit.js');

describe('GameKit', () => {
  let mockLocalStorage;
  let originalWindow;
  let originalDocument;
  let messageListeners;
  let visibilityListeners;

  beforeEach(() => {
    // Reset GameKit state
    GameKit.gameName = null;
    GameKit.assets = null;
    GameKit._soundEnabled = true;
    GameKit._paused = false;
    GameKit._initialized = false;

    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
      setItem: jest.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: jest.fn((key) => { delete mockLocalStorage.store[key]; }),
    };
    global.localStorage = mockLocalStorage;

    // Collecter les event listeners
    messageListeners = [];
    visibilityListeners = [];

    // Mock window
    originalWindow = global.window;
    global.window = {
      parent: { postMessage: jest.fn() },
      addEventListener: jest.fn((event, listener) => {
        if (event === 'message') {
          messageListeners.push(listener);
        }
      }),
      removeEventListener: jest.fn(),
      onSoundChange: undefined,
      onGamePause: undefined,
      onGameResume: undefined,
      onGameDispose: undefined,
    };

    // Mock document
    originalDocument = global.document;
    global.document = {
      hidden: false,
      addEventListener: jest.fn((event, listener) => {
        if (event === 'visibilitychange') {
          visibilityListeners.push(listener);
        }
      }),
    };

    // Mock console.warn
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // init()
  // ===========================================================================
  describe('init()', () => {
    it('initialise GameKit avec le nom du jeu', () => {
      GameKit.init('test-game');

      expect(GameKit.gameName).toBe('test-game');
      expect(GameKit._initialized).toBe(true);
    });

    it('crée un AssetLoader', () => {
      GameKit.init('test-game');

      expect(GameKit.assets).toBeDefined();
    });

    it('envoie un message "ready" au portail', () => {
      GameKit.init('test-game');

      expect(global.window.parent.postMessage).toHaveBeenCalledWith(
        { type: 'ready', game: 'test-game' },
        '*',
      );
    });

    it('configure les event listeners', () => {
      GameKit.init('test-game');

      expect(global.window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(global.document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('ne réinitialise pas si déjà initialisé', () => {
      GameKit.init('game1');
      GameKit.init('game2');

      expect(GameKit.gameName).toBe('game1');
      expect(console.warn).toHaveBeenCalledWith('GameKit already initialized');
    });
  });

  // ===========================================================================
  // _setupListeners() - Message handling
  // ===========================================================================
  describe('Message handling', () => {
    beforeEach(() => {
      GameKit.init('test-game');
    });

    it('gère le message "unload"', () => {
      jest.spyOn(GameKit, 'dispose');

      // Simuler un message unload
      const listener = messageListeners[0];
      listener({ data: { type: 'unload' } });

      expect(GameKit.dispose).toHaveBeenCalled();
    });

    it('gère le message "preference" pour le son', () => {
      global.window.onSoundChange = jest.fn();

      const listener = messageListeners[0];
      listener({ data: { type: 'preference', key: 'sound', value: false } });

      expect(GameKit._soundEnabled).toBe(false);
      expect(global.window.onSoundChange).toHaveBeenCalledWith(false);
    });

    it('gère le message "pause"', () => {
      global.window.onGamePause = jest.fn();

      const listener = messageListeners[0];
      listener({ data: { type: 'pause' } });

      expect(GameKit._paused).toBe(true);
      expect(global.window.onGamePause).toHaveBeenCalled();
    });

    it('gère le message "resume"', () => {
      GameKit._paused = true;
      global.window.onGameResume = jest.fn();

      const listener = messageListeners[0];
      listener({ data: { type: 'resume' } });

      expect(GameKit._paused).toBe(false);
      expect(global.window.onGameResume).toHaveBeenCalled();
    });

    it('ignore les messages sans type', () => {
      const listener = messageListeners[0];

      expect(() => listener({ data: {} })).not.toThrow();
      expect(() => listener({ data: null })).not.toThrow();
    });
  });

  // ===========================================================================
  // Visibility change
  // ===========================================================================
  describe('Visibility change', () => {
    beforeEach(() => {
      GameKit.init('test-game');
    });

    it('met en pause quand l\'onglet est masqué', () => {
      global.window.onGamePause = jest.fn();
      global.document.hidden = true;

      const listener = visibilityListeners[0];
      listener();

      expect(GameKit._paused).toBe(true);
      expect(global.window.onGamePause).toHaveBeenCalled();
    });

    it('reprend quand l\'onglet redevient visible', () => {
      GameKit._paused = true;
      global.window.onGameResume = jest.fn();
      global.document.hidden = false;

      const listener = visibilityListeners[0];
      listener();

      expect(GameKit._paused).toBe(false);
      expect(global.window.onGameResume).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // dispose()
  // ===========================================================================
  describe('dispose()', () => {
    it('libère les ressources de l\'AssetLoader', () => {
      GameKit.init('test-game');
      const mockDispose = GameKit.assets.dispose;

      GameKit.dispose();

      expect(mockDispose).toHaveBeenCalled();
      expect(GameKit.assets).toBeNull();
    });

    it('appelle onGameDispose si défini', () => {
      GameKit.init('test-game');
      global.window.onGameDispose = jest.fn();

      GameKit.dispose();

      expect(global.window.onGameDispose).toHaveBeenCalled();
    });

    it('marque comme non initialisé', () => {
      GameKit.init('test-game');

      GameKit.dispose();

      expect(GameKit._initialized).toBe(false);
    });
  });

  // ===========================================================================
  // isPaused() et isSoundEnabled()
  // ===========================================================================
  describe('isPaused() et isSoundEnabled()', () => {
    it('isPaused() retourne l\'état de pause', () => {
      GameKit._paused = false;
      expect(GameKit.isPaused()).toBe(false);

      GameKit._paused = true;
      expect(GameKit.isPaused()).toBe(true);
    });

    it('isSoundEnabled() retourne l\'état du son', () => {
      GameKit._soundEnabled = true;
      expect(GameKit.isSoundEnabled()).toBe(true);

      GameKit._soundEnabled = false;
      expect(GameKit.isSoundEnabled()).toBe(false);
    });
  });

  // ===========================================================================
  // getPlayer()
  // ===========================================================================
  describe('getPlayer()', () => {
    it('retourne le joueur depuis localStorage', () => {
      mockLocalStorage.store['player'] = JSON.stringify({ name: 'Alice' });

      const player = GameKit.getPlayer();

      expect(player).toEqual({ name: 'Alice' });
    });

    it('retourne "Anonyme" si pas de joueur', () => {
      const player = GameKit.getPlayer();

      expect(player).toEqual({ name: 'Anonyme' });
    });

    it('retourne "Anonyme" si données corrompues', () => {
      mockLocalStorage.store['player'] = 'invalid json';

      const player = GameKit.getPlayer();

      expect(player).toEqual({ name: 'Anonyme' });
    });
  });

  // ===========================================================================
  // saveScore()
  // ===========================================================================
  describe('saveScore()', () => {
    beforeEach(() => {
      GameKit.init('test-game');
    });

    it('sauvegarde un score', () => {
      const result = GameKit.saveScore(1000);

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      const savedScores = JSON.parse(mockLocalStorage.store['scores_test-game']);
      expect(savedScores[0].score).toBe(1000);
    });

    it('inclut le timestamp et le nom du joueur', () => {
      mockLocalStorage.store['player'] = JSON.stringify({ name: 'Bob' });

      GameKit.saveScore(500);

      const savedScores = JSON.parse(mockLocalStorage.store['scores_test-game']);
      expect(savedScores[0].player).toBe('Bob');
      expect(savedScores[0].date).toBeDefined();
    });

    it('trie les scores par ordre décroissant', () => {
      GameKit.saveScore(100);
      GameKit.saveScore(300);
      GameKit.saveScore(200);

      const savedScores = JSON.parse(mockLocalStorage.store['scores_test-game']);
      expect(savedScores[0].score).toBe(300);
      expect(savedScores[1].score).toBe(200);
      expect(savedScores[2].score).toBe(100);
    });

    it('limite à 10 scores', () => {
      for (let i = 1; i <= 15; i++) {
        GameKit.saveScore(i * 100);
      }

      const savedScores = JSON.parse(mockLocalStorage.store['scores_test-game']);
      expect(savedScores).toHaveLength(10);
      expect(savedScores[0].score).toBe(1500); // Le plus grand
    });

    it('envoie le score au portail', () => {
      GameKit.saveScore(1000);

      expect(global.window.parent.postMessage).toHaveBeenCalledWith(
        { type: 'score', game: 'test-game', score: 1000 },
        '*',
      );
    });

    it('retourne false si GameKit non initialisé', () => {
      GameKit._initialized = false;
      GameKit.gameName = null;

      const result = GameKit.saveScore(100);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('GameKit not initialized');
    });

    it('retourne false si localStorage échoue', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = GameKit.saveScore(100);

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // getHighScores()
  // ===========================================================================
  describe('getHighScores()', () => {
    it('retourne les scores sauvegardés', () => {
      GameKit.gameName = 'test-game';
      mockLocalStorage.store['scores_test-game'] = JSON.stringify([
        { score: 1000, player: 'Alice' },
        { score: 500, player: 'Bob' },
      ]);

      const scores = GameKit.getHighScores();

      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBe(1000);
    });

    it('retourne un tableau vide si pas de scores', () => {
      GameKit.gameName = 'test-game';

      const scores = GameKit.getHighScores();

      expect(scores).toEqual([]);
    });

    it('retourne un tableau vide si GameKit non initialisé', () => {
      GameKit.gameName = null;

      const scores = GameKit.getHighScores();

      expect(scores).toEqual([]);
    });

    it('retourne un tableau vide si données corrompues', () => {
      GameKit.gameName = 'test-game';
      mockLocalStorage.store['scores_test-game'] = 'invalid json';

      const scores = GameKit.getHighScores();

      expect(scores).toEqual([]);
    });
  });

  // ===========================================================================
  // saveProgress() et loadProgress()
  // ===========================================================================
  describe('saveProgress() et loadProgress()', () => {
    beforeEach(() => {
      GameKit.init('test-game');
    });

    it('saveProgress() sauvegarde les données', () => {
      const data = { level: 5, items: ['sword', 'shield'] };

      const result = GameKit.saveProgress(data);

      expect(result).toBe(true);
      const saved = JSON.parse(mockLocalStorage.store['progress_test-game']);
      expect(saved).toEqual(data);
    });

    it('loadProgress() charge les données', () => {
      mockLocalStorage.store['progress_test-game'] = JSON.stringify({ level: 3 });

      const data = GameKit.loadProgress();

      expect(data).toEqual({ level: 3 });
    });

    it('loadProgress() retourne null si pas de données', () => {
      const data = GameKit.loadProgress();

      expect(data).toBeNull();
    });

    it('loadProgress() supprime les données corrompues', () => {
      mockLocalStorage.store['progress_test-game'] = 'invalid json';

      const data = GameKit.loadProgress();

      expect(data).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('progress_test-game');
    });

    it('saveProgress() retourne false si non initialisé', () => {
      GameKit.gameName = null;

      const result = GameKit.saveProgress({ data: 'test' });

      expect(result).toBe(false);
    });

    it('loadProgress() retourne null si non initialisé', () => {
      GameKit.gameName = null;

      const result = GameKit.loadProgress();

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // clearProgress()
  // ===========================================================================
  describe('clearProgress()', () => {
    it('supprime la progression sauvegardée', () => {
      GameKit.gameName = 'test-game';
      mockLocalStorage.store['progress_test-game'] = JSON.stringify({ data: 'test' });

      GameKit.clearProgress();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('progress_test-game');
    });

    it('ne fait rien si gameName est null', () => {
      GameKit.gameName = null;

      GameKit.clearProgress();

      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // quit()
  // ===========================================================================
  describe('quit()', () => {
    it('envoie un message "quit" au portail', () => {
      GameKit.gameName = 'test-game';

      GameKit.quit();

      expect(global.window.parent.postMessage).toHaveBeenCalledWith(
        { type: 'quit', game: 'test-game' },
        '*',
      );
    });
  });

  // ===========================================================================
  // _postMessage()
  // ===========================================================================
  describe('_postMessage()', () => {
    it('n\'envoie pas si window.parent === window', () => {
      global.window.parent = global.window;
      GameKit.gameName = 'test-game';

      GameKit.quit();

      // postMessage ne devrait pas être appelé car parent === window
      // (le jeu n'est pas dans une iframe)
    });
  });
});
