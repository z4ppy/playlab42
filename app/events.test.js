/**
 * @jest-environment jsdom
 *
 * Contrats des messages iframe : DOM, état et déchargement réels.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { loadGame } = await import('./game-loader.js');
const { setupEventListeners } = await import('./events.js');

setupEventListeners();

const origin = window.location.origin;
const messages = [
  { type: 'ready', game: 'exemple' },
  { type: 'quit', game: 'exemple' },
  { type: 'score', game: 'exemple', score: 42 },
  { type: 'error', game: 'exemple', error: { message: 'Échec du jeu', line: 12 } },
];

function send(data, source = el.gameIframe.contentWindow, messageOrigin = origin) {
  const event = new MessageEvent('message', { data, source, origin: messageOrigin });
  window.dispatchEvent(event);
  return event;
}

function assertGameUnchanged(game, src) {
  expect(state.currentGame).toBe(game);
  expect(state.currentView).toBe('game');
  expect(el.gameIframe.src).toBe(src);
  expect(el.viewGame.classList.contains('active')).toBe(true);
  expect(document.body.classList.contains('game-active')).toBe(true);
}

describe('Messages de la session iframe du portail', () => {
  let postMessage;
  let log;
  let error;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    setState({
      currentView: 'catalogue', currentGame: null, recentGames: [],
      preferences: { sound: false, pseudo: 'Anonyme' },
    });
    loadGame('games/exemple/index.html', 'Exemple', 'game', 'exemple');
    el.gameIframe.onload();
    postMessage = jest.spyOn(el.gameIframe.contentWindow, 'postMessage');
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([true, false])('ready transmet réellement la préférence son %s à l’iframe chargée', async (sound) => {
    state.preferences.sound = sound;
    const received = [];
    el.gameIframe.contentWindow.addEventListener('message', event => received.push(event.data));
    const game = state.currentGame;
    const src = el.gameIframe.src;

    expect(send(messages[0])).toBeInstanceOf(MessageEvent);
    await jest.advanceTimersByTimeAsync(0);

    expect(received).toEqual([{ type: 'preference', key: 'sound', value: sound }]);
    expect(postMessage).toHaveBeenCalledWith(received[0], origin);
    expect(log).toHaveBeenCalledWith('[Portal] Jeu prêt: exemple');
    assertGameUnchanged(game, src);
  });

  it.each([
    { type: 'quit', game: 'exemple' },
    { type: 'quit' },
  ])('quit valide $game conserve le déchargement différé et le retour catalogue', async (data) => {
    const game = state.currentGame;
    const src = el.gameIframe.src;
    const received = [];
    el.gameIframe.contentWindow.addEventListener('message', event => received.push(event.data));

    send(data);
    await jest.advanceTimersByTimeAsync(0);
    expect(received).toEqual([{ type: 'unload' }]);
    expect(postMessage).toHaveBeenCalledWith({ type: 'unload' }, '*');
    assertGameUnchanged(game, src);
    jest.advanceTimersByTime(100);

    expect(el.gameIframe.src).toBe('about:blank');
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(el.viewCatalogue.classList.contains('active')).toBe(true);
    expect(el.viewGame.classList.contains('active')).toBe(false);
    expect(document.body.classList.contains('game-active')).toBe(false);
    expect(window.location.hash).toBe('#/');
  });

  it('score est journalisé sans modifier la session ni persister un second score', () => {
    const game = state.currentGame;
    const src = el.gameIframe.src;
    send(messages[2]);
    expect(log).toHaveBeenCalledWith('[Portal] Score: 42');
    expect(localStorage.getItem('scores_exemple')).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
    assertGameUnchanged(game, src);
  });

  it('error reste visible avec son objet original sans fermer le jeu', () => {
    const game = state.currentGame;
    const src = el.gameIframe.src;
    send(messages[3]);
    expect(error).toHaveBeenCalledWith('[Portal] Erreur jeu:', messages[3].error);
    expect(error.mock.calls[0][1]).toBe(messages[3].error);
    expect(postMessage).not.toHaveBeenCalled();
    assertGameUnchanged(game, src);
  });

  describe.each(messages)('Attribution du message $type', (data) => {
    it.each(['autre fenêtre', 'autre origine', 'ancienne iframe', 'ancienne session', 'source absente'])(
      'refuse %s sans attribuer de journal ni modifier le jeu courant',
      (reason) => {
        let source = el.gameIframe.contentWindow;
        let messageOrigin = origin;
        let foreignIframe;

        if (reason === 'autre fenêtre') {
          foreignIframe = document.createElement('iframe');
          document.body.appendChild(foreignIframe);
          source = foreignIframe.contentWindow;
        } else if (reason === 'autre origine') {
          messageOrigin = 'https://autre.example';
        } else if (reason === 'source absente') {
          source = null;
        } else if (reason === 'ancienne iframe') {
          loadGame('games/suivant/index.html', 'Suivant', 'game', 'suivant');
          el.gameIframe.onload();
          expect(el.gameIframe.contentWindow).not.toBe(source);
          postMessage = jest.spyOn(el.gameIframe.contentWindow, 'postMessage');
        } else {
          // Un WindowProxy peut rester identique après navigation dans un navigateur.
          loadGame('games/suivant/index.html', 'Suivant', 'game', 'suivant');
          el.gameIframe.onload();
          source = el.gameIframe.contentWindow;
          postMessage = jest.spyOn(source, 'postMessage');
        }

        const game = state.currentGame;
        const src = el.gameIframe.src;
        try {
          send(data, source, messageOrigin);
          jest.advanceTimersByTime(100);
          assertGameUnchanged(game, src);
          expect(postMessage).not.toHaveBeenCalled();
          expect(log).not.toHaveBeenCalled();
          expect(error).not.toHaveBeenCalled();
        } finally {
          foreignIframe?.remove();
        }
      },
    );

    it('ignore les messages sans jeu chargé même si l’iframe existe encore', () => {
      setState({ currentGame: null, currentView: 'catalogue' });
      const src = el.gameIframe.src;
      send(data);
      jest.advanceTimersByTime(100);
      expect(state.currentGame).toBeNull();
      expect(state.currentView).toBe('catalogue');
      expect(el.gameIframe.src).toBe(src);
      expect(postMessage).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('ignore les messages quand l’iframe n’est plus disponible', () => {
      const iframe = el.gameIframe;
      const uncaught = jest.fn();
      window.addEventListener('error', uncaught);
      try {
        el.gameIframe = null;
        send(data, iframe.contentWindow);
        jest.advanceTimersByTime(100);
        expect(uncaught).not.toHaveBeenCalled();
        expect(state.currentGame.id).toBe('exemple');
        expect(state.currentView).toBe('game');
        expect(postMessage).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      } finally {
        el.gameIframe = iframe;
        window.removeEventListener('error', uncaught);
      }
    });
  });

  it.each([
    null, undefined, false, 42, 'quit', [], {},
    { type: null }, { type: 42 }, { type: {} }, { type: 'inconnu' },
    Object.assign([], { type: 'quit' }),
  ])('ignore les données invalides %p sans effet ni exception', (data) => {
    const game = state.currentGame;
    const src = el.gameIframe.src;
    const uncaught = jest.fn();
    window.addEventListener('error', uncaught);
    try {
      send(data);
      jest.advanceTimersByTime(100);
      expect(uncaught).not.toHaveBeenCalled();
      assertGameUnchanged(game, src);
      expect(postMessage).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('error', uncaught);
    }
  });
});
