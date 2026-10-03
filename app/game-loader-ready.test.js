/**
 * @jest-environment jsdom
 *
 * Le vrai SDK initialise une seule fois sa préférence via ready.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const sdkSource = execFileSync('node_modules/.bin/esbuild', [
  'lib/gamekit.js', '--bundle', '--format=iife', '--global-name=PlaylabGameKit',
  `--define:import.meta.url=${JSON.stringify(new URL('/lib/assets.js', window.location.href).href)}`,
], { encoding: 'utf8' });

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { openGame, unloadGame } = await import('./game-loader.js');
const { setupEventListeners } = await import('./events.js');
setupEventListeners();

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function send(data, source = el.gameIframe.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', {
    data, source, origin: window.location.origin,
  }));
}

describe('Préférence ready et reprise de la session affichée', () => {
  let sdk;

  beforeEach(() => {
    jest.useFakeTimers();
    unloadGame();
    jest.advanceTimersByTime(100);
    jest.clearAllTimers();
    localStorage.clear();
    setState({
      currentView: 'catalogue', currentGame: null, recentGames: [],
      catalogue: { games: [], tools: [] },
      preferences: { sound: false, pseudo: 'Ada' },
    });
    global.fetch = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    sdk?.dispose();
    sdk = null;
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function initializeDisplayedSdk() {
    const source = el.gameIframe.contentWindow;
    source.document.open();
    source.document.write('<!doctype html><html><head></head><body></body></html>');
    source.document.close();
    const script = source.document.createElement('script');
    script.textContent = sdkSource;
    source.document.head.appendChild(script);
    sdk = source.PlaylabGameKit.GameKit;
    expect(sdk.isSoundEnabled()).toBe(true);
    // jsdom omet source/origin sur postMessage ; seule cette frontière navigateur
    // est adaptée. Le SDK, ses listeners et le traitement portail restent réels.
    const postMessage = jest.spyOn(window, 'postMessage').mockImplementation((data) => {
      setTimeout(() => send(data, source), 0);
    });
    sdk.init('a');
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready', game: 'a' }, '*');
    await jest.advanceTimersByTimeAsync(0);
    return source;
  }

  it.each(['resélection', '404', 'réseau'])(
    'conserve sound=false après ready A pendant HEAD B et reprise par %s',
    async (recovery) => {
      fetch.mockResolvedValueOnce({ ok: true });
      await openGame('a');
      const sessionA = state.currentGame;
      const b = deferred();
      fetch.mockReturnValueOnce(b.promise);
      const pendingB = openGame('b');
      const sourceA = await initializeDisplayedSdk();
      send({ type: 'quit', game: 'a' }, sourceA);
      if (recovery === 'resélection') {
        await openGame('a');
        b.resolve({ ok: true });
      } else if (recovery === '404') {
        b.resolve({ ok: false, status: 404 });
      } else {
        b.reject(new Error('Réseau B'));
      }
      await pendingB;
      expect(state.currentGame).toBe(sessionA);
      expect(el.gameIframe.contentWindow).toBe(sourceA);
      expect(window.location.hash).toBe(recovery === 'resélection' ? '#/games/a' : '#/');
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(state.recentGames.map(item => item.id)).toEqual(['a']);
      expect(state.preferences.sound).toBe(false);
      expect(sdk.isSoundEnabled()).toBe(false);
      expect(window.postMessage).toHaveBeenCalledTimes(1);
    },
  );

  it('unload dispose le vrai SDK et interdit ready de shutdown malgré le HEAD B en attente', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pendingB = openGame('b');
    const sourceA = await initializeDisplayedSdk();
    unloadGame();
    await jest.advanceTimersByTimeAsync(0);
    expect(sdk._initialized).toBe(false);
    expect(sdk.assets).toBeNull();
    const disposedMessages = [];
    sourceA.addEventListener('message', event => disposedMessages.push(event.data));
    send({ type: 'ready', game: 'a' }, sourceA);
    await jest.advanceTimersByTimeAsync(100);
    b.resolve({ ok: true });
    await pendingB;
    expect(disposedMessages).toEqual([]);
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(window.location.hash).toBe('#/');
    expect(el.gameIframe.src).toBe('about:blank');
  });
});
