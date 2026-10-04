import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('./assets.js', () => ({
  AssetLoader: jest.fn().mockImplementation(() => ({ dispose: jest.fn() })),
}));

const { GameKit } = await import('./gamekit.js');

describe('GameKit : écouteurs du portail et crochets de session', () => {
  let originalWindow;
  let originalDocument;
  let onMessage;
  let onVisibility;

  beforeEach(() => {
    GameKit.gameName = null;
    GameKit.assets = null;
    GameKit._soundEnabled = true;
    GameKit._paused = false;
    GameKit._initialized = false;
    originalWindow = global.window;
    originalDocument = global.document;
    global.window = {
      parent: { postMessage: jest.fn() },
      addEventListener: jest.fn((name, listener) => { if (name === 'message') { onMessage = listener; } }),
      removeEventListener: jest.fn(),
    };
    global.document = {
      hidden: false,
      addEventListener: jest.fn((name, listener) => { if (name === 'visibilitychange') { onVisibility = listener; } }),
      removeEventListener: jest.fn(),
    };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    GameKit.init('lifecycle');
  });

  afterEach(() => {
    GameKit.dispose();
    global.window = originalWindow;
    global.document = originalDocument;
    jest.restoreAllMocks();
  });

  const message = data => onMessage({ data });

  it('ignore les événements sans donnée, sans type ou de type inconnu', () => {
    global.window.onGamePause = jest.fn();
    for (const event of [{}, { data: null }, { data: {} }, { data: { type: '' } }, { data: { type: 'inconnu' } }]) {
      onMessage(event);
    }
    expect(global.window.onGamePause).not.toHaveBeenCalled();
    expect(GameKit.isPaused()).toBe(false);
    expect(GameKit._initialized).toBe(true);
  });

  it('pause et reprise changent l\'état avant d\'appeler le crochet, sans argument', () => {
    const seen = [];
    global.window.onGamePause = jest.fn((...args) => seen.push(['pause', GameKit.isPaused(), args.length]));
    global.window.onGameResume = jest.fn((...args) => seen.push(['resume', GameKit.isPaused(), args.length]));
    message({ type: 'pause' });
    message({ type: 'resume' });
    expect(seen).toEqual([['pause', true, 0], ['resume', false, 0]]);
  });

  it('pause et reprise du portail fonctionnent sans crochet défini ou avec une valeur non fonction', () => {
    message({ type: 'pause' });
    expect(GameKit.isPaused()).toBe(true);
    global.window.onGameResume = 'pas une fonction';
    message({ type: 'resume' });
    expect(GameKit.isPaused()).toBe(false);
    global.window.onGamePause = 42;
    message({ type: 'pause' });
    expect(GameKit.isPaused()).toBe(true);
  });

  it('la préférence son ne notifie que pour la clé sound avec un booléen', () => {
    global.window.onSoundChange = jest.fn();
    message({ type: 'preference', key: 'sound', value: false });
    expect(global.window.onSoundChange).toHaveBeenLastCalledWith(false);
    message({ type: 'preference', key: 'sound', value: true });
    expect(global.window.onSoundChange).toHaveBeenLastCalledWith(true);
    message({ type: 'preference', key: 'music', value: false });
    message({ type: 'preference', key: 'sound', value: 'non' });
    message({ type: 'preference', key: 'sound' });
    expect(global.window.onSoundChange).toHaveBeenCalledTimes(2);
    expect(GameKit.isSoundEnabled()).toBe(true);
  });

  it('applique la préférence son sans crochet défini', () => {
    message({ type: 'preference', key: 'sound', value: false });
    expect(GameKit.isSoundEnabled()).toBe(false);
    global.window.onSoundChange = {};
    message({ type: 'preference', key: 'sound', value: true });
    expect(GameKit.isSoundEnabled()).toBe(true);
  });

  it('un onglet masqué met en pause, un onglet visible reprend, avec ou sans crochet', () => {
    global.document.hidden = true;
    onVisibility();
    expect(GameKit.isPaused()).toBe(true);
    global.document.hidden = false;
    onVisibility();
    expect(GameKit.isPaused()).toBe(false);

    global.window.onGamePause = jest.fn();
    global.window.onGameResume = jest.fn();
    global.document.hidden = true;
    onVisibility();
    global.document.hidden = false;
    onVisibility();
    expect(global.window.onGamePause).toHaveBeenCalledTimes(1);
    expect(global.window.onGameResume).toHaveBeenCalledTimes(1);
  });

  it('un crochet non fonction ne bloque pas la visibilité', () => {
    global.window.onGamePause = 'x';
    global.window.onGameResume = null;
    global.document.hidden = true;
    expect(() => onVisibility()).not.toThrow();
    global.document.hidden = false;
    expect(() => onVisibility()).not.toThrow();
    expect(GameKit.isPaused()).toBe(false);
  });

  it('unload libère la session une seule fois puis les anciens écouteurs sont inertes', () => {
    global.window.onGameDispose = jest.fn();
    global.window.onGamePause = jest.fn();
    const staleVisibility = onVisibility;
    message({ type: 'unload' });
    message({ type: 'unload' });
    global.document.hidden = true;
    staleVisibility();
    expect(global.window.onGameDispose).toHaveBeenCalledTimes(1);
    expect(global.window.onGamePause).not.toHaveBeenCalled();
    expect(GameKit._initialized).toBe(false);
    expect(GameKit._cleanupListeners).toBeNull();
  });

  it('une nouvelle session enregistre de nouveaux écouteurs indépendants des anciens', () => {
    const firstMessage = onMessage;
    const firstVisibility = onVisibility;
    GameKit.dispose();
    GameKit.init('seconde');
    expect(onMessage).not.toBe(firstMessage);
    expect(onVisibility).not.toBe(firstVisibility);
    global.window.onGamePause = jest.fn();
    firstMessage({ data: { type: 'pause' } });
    firstVisibility();
    expect(global.window.onGamePause).not.toHaveBeenCalled();
    message({ type: 'pause' });
    expect(global.window.onGamePause).toHaveBeenCalledTimes(1);
    expect(global.window.parent.postMessage).toHaveBeenLastCalledWith({ type: 'ready', game: 'seconde' }, '*');
  });

  it('un crochet de dispose absent ou invalide n\'empêche pas le nettoyage', () => {
    global.window.onGameDispose = 'x';
    expect(() => GameKit.dispose()).not.toThrow();
    expect(GameKit.assets).toBeNull();
  });

  it('libère une session dont le chargeur de ressources est déjà absent', () => {
    GameKit.assets = null;
    expect(() => GameKit.dispose()).not.toThrow();
    expect(GameKit._initialized).toBe(false);
  });
});
