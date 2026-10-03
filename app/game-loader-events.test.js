/**
 * @jest-environment jsdom
 *
 * Contrats croisés : intentions de navigation et messages iframe réels.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { openGame, openTool, loadGame, unloadGame } = await import('./game-loader.js');
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

function receive(source) {
  const messages = [];
  source.addEventListener('message', event => messages.push(event.data));
  return messages;
}

function expectCurrent(id, type = 'game') {
  expect(state.currentGame).toMatchObject({ id, type });
  expect(state.currentView).toBe('game');
  expect(el.gameIframe.getAttribute('src')).toBe(`${type === 'game' ? 'games' : 'tools'}/${id}/index.html`);
  expect(window.location.hash).toBe(`#/${type === 'game' ? 'games' : 'tools'}/${id}`);
  expect(el.viewGame.classList.contains('active')).toBe(true);
  expect(el.viewCatalogue.classList.contains('active')).toBe(false);
  expect(document.body.classList.contains('game-active')).toBe(true);
  expect(state.recentGames[0]).toMatchObject({ id, type });
  expect(JSON.parse(localStorage.getItem('recent_games'))[0]).toMatchObject({ id, type });
}

describe('Cycle de vie commun au loader et aux messages du portail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    unloadGame();
    jest.advanceTimersByTime(100);
    jest.clearAllTimers();
    localStorage.clear();
    setState({
      currentGame: null, currentView: 'catalogue', recentGames: [],
      preferences: { sound: true, pseudo: 'Ada' },
      catalogue: { games: [], tools: [] },
    });
    el.loading.innerHTML = '<div class="spinner"></div><p>Chargement...</p>';
    global.fetch = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['game', 'tool'])('rouvre vraiment le même %s après unload avant 100 ms', async (type) => {
    loadGame(`${type === 'game' ? 'games' : 'tools'}/a/index.html`, 'A', type, 'a');
    const sessionA = state.currentGame;
    const sourceA = el.gameIframe.contentWindow;
    const loadedA = el.gameIframe.onload;
    const oldMessages = receive(sourceA);
    unloadGame();
    await jest.advanceTimersByTimeAsync(0);
    expect(oldMessages).toEqual([{ type: 'unload' }]);
    fetch.mockResolvedValueOnce({ ok: true });
    await (type === 'game' ? openGame : openTool)('a');
    expect(state.currentGame).not.toBe(sessionA);
    expect(el.gameIframe.contentWindow).not.toBe(sourceA);
    expect(fetch).toHaveBeenCalledTimes(1);
    expectCurrent('a', type);
    expect(state.recentGames).toHaveLength(1);
    loadedA();
    expect(el.loading.classList.contains('hidden')).toBe(false);
    const newMessages = receive(el.gameIframe.contentWindow);
    send({ type: 'ready', game: 'a' });
    await jest.advanceTimersByTimeAsync(0);
    expect(newMessages).toEqual([{ type: 'preference', key: 'sound', value: true }]);
    el.gameIframe.onload();
    jest.advanceTimersByTime(100);
    expectCurrent('a', type);
    expect(el.loading.classList.contains('hidden')).toBe(true);
  });

  it.each(['game', 'tool'])('le même %s actif reste un no-op et sa resélection annule B', async (type) => {
    fetch.mockResolvedValueOnce({ ok: true });
    const open = type === 'game' ? openGame : openTool;
    await open('a');
    const sessionA = state.currentGame;
    const sourceA = el.gameIframe.contentWindow;
    const loadedA = el.gameIframe.onload;
    await open('a');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.currentGame).toBe(sessionA);
    expect(el.gameIframe.contentWindow).toBe(sourceA);
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pendingB = openGame('b');
    await open('a');
    b.resolve({ ok: true });
    await pendingB;
    expectCurrent('a', type);
    expect(state.currentGame).toBe(sessionA);
    expect(el.gameIframe.contentWindow).toBe(sourceA);
    loadedA();
    expect(el.loading.classList.contains('hidden')).toBe(true);
    send({ type: 'quit', game: 'a' });
    jest.advanceTimersByTime(100);
    expect(state.currentGame).toBeNull();
  });

  it.each([{ type: 'quit', game: 'a' }, { type: 'quit' }])(
    'le quit $game de A pendant HEAD B ne peut pas annuler la nouvelle intention',
    async (message) => {
      fetch.mockResolvedValueOnce({ ok: true });
      await openGame('a');
      const sourceA = el.gameIframe.contentWindow;
      const oldMessages = receive(sourceA);
      const b = deferred();
      fetch.mockReturnValueOnce(b.promise);
      const pendingB = openGame('b');
      send(message, sourceA);
      send({ type: 'ready', game: 'a' }, sourceA);
      await jest.advanceTimersByTimeAsync(100);
      expect(state.currentGame.id).toBe('a');
      expect(oldMessages).toEqual([{ type: 'preference', key: 'sound', value: true }]);
      b.resolve({ ok: true });
      await pendingB;
      expectCurrent('b');
      const currentMessages = receive(el.gameIframe.contentWindow);
      send({ type: 'ready', game: 'a' }, sourceA);
      send({ type: 'quit', game: 'a' }, sourceA);
      send({ type: 'ready', game: 'b' });
      await jest.advanceTimersByTimeAsync(0);
      expect(currentMessages).toEqual([{ type: 'preference', key: 'sound', value: true }]);
      expect(oldMessages).toEqual([{ type: 'preference', key: 'sound', value: true }]);
      const error = { message: 'Erreur réelle B' };
      send({ type: 'error', game: 'b', error });
      expect(console.error).toHaveBeenCalledWith('[Portal] Erreur jeu:', error);
      el.gameIframe.onerror();
      expect(el.loading.classList.contains('hidden')).toBe(false);
      expect(el.loading.textContent).toBe('Erreur de chargement');
      jest.advanceTimersByTime(5000);
      expectCurrent('b');
      expect(el.loading.textContent).toBe('Erreur de chargement');
    },
  );

  it.each(['404', 'réseau'])('après échec HEAD B (%s), A restant peut à nouveau quitter', async (failure) => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const sourceA = el.gameIframe.contentWindow;
    const oldMessages = receive(sourceA);
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pendingB = openGame('b');
    send({ type: 'quit', game: 'a' }, sourceA);
    jest.advanceTimersByTime(100);
    const error = new Error('Réseau B');
    if (failure === '404') { b.resolve({ ok: false, status: 404 }); }
    else { b.reject(error); }
    await pendingB;
    expect(console.error).toHaveBeenCalledWith(
      ...(failure === '404' ? ['Jeu non trouvé: b'] : ['Erreur chargement jeu b:', error]),
    );
    expect(window.location.hash).toBe('#/');
    expect(state.currentGame.id).toBe('a');
    expect(el.gameIframe.contentWindow).toBe(sourceA);
    send({ type: 'ready', game: 'a' });
    await jest.advanceTimersByTimeAsync(0);
    expect(oldMessages).toEqual([{ type: 'preference', key: 'sound', value: true }]);
    send({ type: 'quit', game: 'a' });
    await jest.advanceTimersByTimeAsync(100);
    expect(oldMessages[1]).toEqual({ type: 'unload' });
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(el.gameIframe.src).toBe('about:blank');
    expect(state.recentGames.map(item => item.id)).toEqual(['a']);
  });

  it.each(['bouton', 'Escape'])('la fermeture explicite %s annule bien HEAD B', async (action) => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const received = receive(el.gameIframe.contentWindow);
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pendingB = openGame('b');
    if (action === 'bouton') { el.btnBack.click(); }
    else { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
    await jest.advanceTimersByTimeAsync(100);
    b.resolve({ ok: true });
    await pendingB;
    expect(received).toEqual([{ type: 'unload' }]);
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(window.location.hash).toBe('#/');
    expect(el.gameIframe.src).toBe('about:blank');
    expect(state.recentGames.map(item => item.id)).toEqual(['a']);
  });

  it('ignore ready et quit de la session en cours de shutdown sans retarder sa fermeture', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const sourceA = el.gameIframe.contentWindow;
    const received = receive(sourceA);
    unloadGame();
    await jest.advanceTimersByTimeAsync(50);
    send({ type: 'ready', game: 'a' }, sourceA);
    send({ type: 'quit', game: 'a' }, sourceA);
    await jest.advanceTimersByTimeAsync(50);
    expect(received).toEqual([{ type: 'unload' }]);
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(el.gameIframe.src).toBe('about:blank');
  });
});
