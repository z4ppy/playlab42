/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

document.body.innerHTML = `
  <button id="origin">Ouvrir</button>
  <section id="view-catalogue" class="active"></section>
  <section id="view-settings"></section>
  <section id="view-game">
    <h2 id="game-title"></h2>
    <div id="loading"><div class="spinner"></div><p>Chargement...</p></div>
    <iframe id="game-iframe"></iframe>
    <button id="btn-back"></button>
    <button id="btn-fullscreen"></button>
    <button id="btn-sound"></button>
  </section>`;

const { state } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const {
  openGame, openTool, loadGame, unloadGame, toggleFullscreen, toggleSound,
} = await import('./game-loader.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function expectCurrent(id, type = 'game', path = `games/${id}/index.html`) {
  expect(state.currentGame).toMatchObject({ id, type, path });
  expect(state.currentView).toBe('game');
  expect(el.gameIframe.getAttribute('src')).toBe(path);
  expect(window.location.hash).toBe(`#/${type === 'game' ? 'games' : 'tools'}/${id}`);
  expect(el.viewGame.classList.contains('active')).toBe(true);
  expect(el.viewCatalogue.classList.contains('active')).toBe(false);
  expect(document.body.classList.contains('game-active')).toBe(true);
  expect(state.recentGames[0]).toMatchObject({ id, type });
  expect(JSON.parse(localStorage.getItem('recent_games'))[0]).toMatchObject({ id, type });
}

describe('Isolation des chargements réels du portail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    unloadGame();
    jest.advanceTimersByTime(100);
    jest.clearAllTimers();
    el.gameIframe.onload = null;
    el.gameIframe.onerror = null;
    localStorage.clear();
    state.recentGames = [];
    state.catalogue = { games: [{ id: 'b', name: 'Jeu B' }], tools: [] };
    state.preferences = { sound: true, pseudo: 'Anonyme' };
    el.loading.innerHTML = '<div class="spinner"></div><p>Chargement...</p>';
    el.loading.classList.add('hidden');
    document.body.className = '';
    window.location.hash = '#/';
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(['game', 'tool'])('garde B lorsque les HEAD %s terminent dans l’ordre inverse', async (type) => {
    const a = deferred();
    const b = deferred();
    fetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const open = type === 'game' ? openGame : openTool;
    const pendingA = open('a');
    const pendingB = open('b');
    b.resolve({ ok: true });
    await pendingB;
    a.resolve({ ok: true });
    await pendingA;
    expectCurrent('b', type, `${type === 'game' ? 'games' : 'tools'}/b/index.html`);
    expect(state.recentGames.map(item => item.id)).toEqual(['b']);
    expect(el.gameTitle.textContent).toBe(type === 'game' ? 'Jeu B' : 'b');
  });

  it.each([['game', 'tool'], ['tool', 'game']])(
    'partage l’intention entre HEAD %s A et %s B sans attribuer A à B',
    async (typeA, typeB) => {
      const a = deferred();
      const b = deferred();
      fetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      const pendingA = (typeA === 'game' ? openGame : openTool)('a');
      const pendingB = (typeB === 'game' ? openGame : openTool)('b');
      b.resolve({ ok: true });
      await pendingB;
      a.resolve({ ok: true });
      await pendingA;
      expectCurrent('b', typeB, `${typeB === 'game' ? 'games' : 'tools'}/b/index.html`);
      expect(state.recentGames).toHaveLength(1);
    },
  );

  it.each(['game', 'tool'])(
    'préserve le moment de lecture du nom catalogue %s pendant le HEAD',
    async (type) => {
      state.catalogue = {
        games: [{ id: 'a', name: 'Nom initial' }],
        tools: [{ id: 'a', name: 'Nom initial', path: 'tools/a.html' }],
      };
      const a = deferred();
      fetch.mockReturnValueOnce(a.promise);
      const pendingA = (type === 'game' ? openGame : openTool)('a');
      state.catalogue = {
        games: [{ id: 'a', name: 'Nom arrivé pendant HEAD' }],
        tools: [{ id: 'a', name: 'Nom arrivé pendant HEAD', path: 'tools/autre.html' }],
      };
      a.resolve({ ok: true });
      await pendingA;
      const name = type === 'game' ? 'Nom arrivé pendant HEAD' : 'Nom initial';
      expect(state.currentGame.name).toBe(name);
      expect(el.gameTitle.textContent).toBe(name);
      expectCurrent('a', type, type === 'game' ? 'games/a/index.html' : 'tools/a.html');
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['game', 'rejet'], ['game', '404'], ['tool', 'rejet'], ['tool', '404'],
  ])('ignore le HEAD %s A (%s) après B sans modifier son hash', async (type, failure) => {
    const a = deferred();
    fetch.mockReturnValueOnce(a.promise).mockResolvedValueOnce({ ok: true });
    const pendingA = (type === 'game' ? openGame : openTool)('a');
    await openGame('b');
    if (failure === 'rejet') {
      a.reject(new Error('Réseau A'));
    } else {
      a.resolve({ ok: false, status: 404 });
    }
    await pendingA;
    expectCurrent('b');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('ne poursuit pas le repli outil annulé après le HEAD 404', async () => {
    const a = deferred();
    fetch.mockReturnValueOnce(a.promise).mockResolvedValueOnce({ ok: true });
    const pendingA = openTool('a');
    await openGame('b');
    a.resolve({ ok: false, status: 404 });
    await pendingA;
    expectCurrent('b');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ne décharge pas B ouvert avant les 100 ms de fermeture A', async () => {
    fetch.mockResolvedValue({ ok: true });
    document.getElementById('origin').focus();
    await openGame('a');
    toggleFullscreen();
    unloadGame();
    jest.advanceTimersByTime(50);
    await openGame('b');
    jest.advanceTimersByTime(50);
    expectCurrent('b');
    expect(document.activeElement).toBe(el.btnBack);
    expect(document.body.classList.contains('fullscreen')).toBe(true);
  });

  it('annule le HEAD en attente quand on ferme vers le catalogue', async () => {
    const a = deferred();
    fetch.mockReturnValueOnce(a.promise);
    const pending = openGame('a');
    unloadGame();
    jest.advanceTimersByTime(100);
    a.resolve({ ok: true });
    await pending;
    expect(state.currentGame).toBeNull();
    expect(el.gameIframe.getAttribute('src')).toBe('about:blank');
    expect(window.location.hash).toBe('#/');
    expect(state.recentGames).toEqual([]);
  });

  it('ne ferme pas A pendant le HEAD B qui dépasse les 100 ms', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    unloadGame();
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pending = openGame('b');
    jest.advanceTimersByTime(100);
    expect(state.currentGame.id).toBe('a');
    expect(el.gameIframe.getAttribute('src')).toBe('games/a/index.html');
    b.resolve({ ok: true });
    await pending;
    expectCurrent('b');
  });

  it('une ouverture directe invalide aussi les HEAD en attente', async () => {
    const a = deferred();
    fetch.mockReturnValueOnce(a.promise);
    const pending = openGame('a');
    loadGame('tools/b.html', 'B', 'tool', 'b');
    a.resolve({ ok: true });
    await pending;
    expect(state.currentGame).toMatchObject({ id: 'b', type: 'tool' });
    expect(el.gameIframe.getAttribute('src')).toBe('tools/b.html');
    expect(state.recentGames.map(item => item.id)).toEqual(['b']);
  });

  it('resélectionner A déjà ouvert annule une demande B en attente', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const loadedA = el.gameIframe.onload;
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pending = openGame('b');
    await openGame('a');
    b.resolve({ ok: true });
    await pending;
    expectCurrent('a');
    loadedA();
    expect(el.loading.classList.contains('hidden')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('le timer 5 s de A ne change pas le chargement de B', async () => {
    fetch.mockResolvedValue({ ok: true });
    await openGame('a');
    jest.advanceTimersByTime(4900);
    await openGame('b');
    jest.advanceTimersByTime(100);
    expectCurrent('b');
    expect(el.loading.textContent).toContain('Chargement...');
    expect(el.loading.classList.contains('hidden')).toBe(false);
    jest.advanceTimersByTime(4900);
    expect(el.loading.textContent).toBe('Chargement lent...');
  });

  it.each(['onload', 'onerror'])('ignore un ancien %s même pendant le HEAD B', async (event) => {
    fetch.mockResolvedValueOnce({ ok: true });
    await openGame('a');
    const callbackA = el.gameIframe[event];
    const b = deferred();
    fetch.mockReturnValueOnce(b.promise);
    const pending = openGame('b');
    const before = el.loading.outerHTML;
    callbackA();
    expect(el.loading.outerHTML).toBe(before);
    b.resolve({ ok: true });
    await pending;
    callbackA();
    expectCurrent('b');
    expect(el.loading.classList.contains('hidden')).toBe(false);
    expect(el.loading.textContent).toContain('Chargement...');
    jest.advanceTimersByTime(5000);
    expect(el.loading.textContent).toBe('Chargement lent...');
  });

  it('conserve une vraie erreur B visible malgré onload A puis remet le texte à neuf', async () => {
    fetch.mockResolvedValue({ ok: true });
    await openGame('a');
    const loadedA = el.gameIframe.onload;
    await openGame('b');
    el.gameIframe.onerror();
    loadedA();
    jest.advanceTimersByTime(5000);
    expectCurrent('b');
    expect(el.loading.classList.contains('hidden')).toBe(false);
    expect(el.loading.textContent).toBe('Erreur de chargement');
    expect(el.loading.querySelector('.spinner')).not.toBeNull();
    await openGame('c');
    expect(el.loading.textContent).toContain('Chargement...');
    el.gameIframe.onload();
    jest.advanceTimersByTime(5000);
    expect(el.loading.classList.contains('hidden')).toBe(true);
  });

  it('rend une erreur iframe courante visible même après la fin du chargement', async () => {
    fetch.mockResolvedValue({ ok: true });
    await openGame('b');
    el.gameIframe.onload();
    expect(el.loading.classList.contains('hidden')).toBe(true);
    el.gameIframe.onerror();
    expect(el.loading.classList.contains('hidden')).toBe(false);
    expect(el.loading.textContent).toBe('Erreur de chargement');
    jest.advanceTimersByTime(5000);
    expect(el.loading.textContent).toBe('Erreur de chargement');
    expectCurrent('b');
  });

  it('ferme normalement, rend le focus et neutralise callbacks et timer anciens', async () => {
    fetch.mockResolvedValue({ ok: true });
    const origin = document.getElementById('origin');
    origin.focus();
    await openGame('a');
    const loadedA = el.gameIframe.onload;
    const failedA = el.gameIframe.onerror;
    toggleFullscreen();
    unloadGame();
    jest.advanceTimersByTime(99);
    expect(state.currentView).toBe('game');
    jest.advanceTimersByTime(1);
    expect(state.currentGame).toBeNull();
    expect(state.currentView).toBe('catalogue');
    expect(window.location.hash).toBe('#/');
    expect(el.gameIframe.getAttribute('src')).toBe('about:blank');
    expect(el.viewCatalogue.classList.contains('active')).toBe(true);
    expect(el.viewGame.classList.contains('active')).toBe(false);
    expect(document.body.classList.contains('game-active')).toBe(false);
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(el.btnFullscreen.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(origin);
    const before = el.loading.outerHTML;
    loadedA();
    failedA();
    jest.advanceTimersByTime(5000);
    expect(el.loading.outerHTML).toBe(before);
  });

  it.each(['game', 'tool'])('garde visibles les erreurs réseau courantes %s sans repli artificiel', async (type) => {
    const error = new Error('Réseau courant');
    fetch.mockRejectedValueOnce(error);
    await (type === 'game' ? openGame : openTool)('absent');
    expect(window.location.hash).toBe('#/');
    expect(state.currentGame).toBeNull();
    expect(state.recentGames).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      `Erreur chargement ${type === 'game' ? 'jeu' : 'outil'} absent:`, error,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('préserve le repli HEAD 404 des outils et le chemin catalogue', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({ ok: true });
    await openTool('simple');
    expectCurrent('simple', 'tool', 'tools/simple.html');
    el.gameIframe.onload();
    expect(el.loading.classList.contains('hidden')).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(2, 'tools/simple.html', { method: 'HEAD' });
    state.catalogue.tools = [{ id: 'listed', name: 'Outil listé', path: 'tools/listed.html' }];
    fetch.mockResolvedValueOnce({ ok: true });
    await openTool('listed');
    expectCurrent('listed', 'tool', 'tools/listed.html');
    expect(el.gameIframe.title).toBe('Outil : Outil listé');
    expect(fetch).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(5000);
    expect(el.loading.textContent).toBe('Chargement lent...');
    el.gameIframe.onload();
    expect(el.loading.classList.contains('hidden')).toBe(true);
  });

  it('refuse les HEAD 404 courants sans iframe ni récent et affiche le diagnostic', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    await openGame('absent');
    expect(console.error).toHaveBeenCalledWith('Jeu non trouvé: absent');
    await openTool('absent');
    expect(console.error).toHaveBeenCalledWith('Outil non trouvé: absent');
    expect(window.location.hash).toBe('#/');
    expect(state.currentGame).toBeNull();
    expect(state.recentGames).toEqual([]);
    expect(el.gameIframe.getAttribute('src')).toBe('about:blank');
  });

  it('préserve son, préférences persistées et boutons accessibles', async () => {
    fetch.mockResolvedValue({ ok: true });
    await openGame('b');
    expect(el.gameIframe.title).toBe('Jeu : Jeu B');
    expect(el.loading.querySelector('.spinner')).not.toBeNull();
    toggleSound();
    expect(state.preferences.sound).toBe(false);
    expect(JSON.parse(localStorage.getItem('preferences')).sound).toBe(false);
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('false');
    expect(el.btnSound.getAttribute('aria-label')).toBe('Activer le son');
    toggleSound();
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('true');
    toggleFullscreen();
    expect(el.btnFullscreen.getAttribute('aria-label')).toBe('Quitter le plein écran');
    toggleFullscreen();
    expect(el.btnFullscreen.getAttribute('aria-pressed')).toBe('false');
  });
});
