/**
 * @jest-environment jsdom
 *
 * Priorité des commandes et propriété du focus : DOM et handlers réels.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { setupEventListeners } = await import('./events.js');
const { loadGame, unloadGame } = await import('./game-loader.js');
setupEventListeners();

function key(target, value, modifiers = {}) {
  const event = new KeyboardEvent('keydown', {
    key: value, bubbles: true, cancelable: true, ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

describe('Priorité des raccourcis du portail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    unloadGame();
    jest.advanceTimersByTime(100);
    localStorage.clear();
    setState({
      currentView: 'catalogue', currentGame: null, activeTab: 'games',
      catalogue: null, parcoursCatalogue: null, bookmarksCatalogue: null,
      recentGames: [], parcoursCategory: null,
      preferences: { sound: true, pseudo: 'Ada' },
    });
    document.body.classList.remove('fullscreen');
    el.btnSettings.focus();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['input', 'textarea', 'select', 'editable'])(
    'la cible %s garde ses caractères et ne déclenche aucune commande catalogue/jeu',
    (kind) => {
      const target = document.createElement(kind === 'editable' ? 'div' : kind);
      if (kind === 'editable') {
        target.setAttribute('contenteditable', 'true');
        target.appendChild(document.createElement('span'));
      }
      document.body.appendChild(target);
      const dispatchTarget = target.firstElementChild || target;
      try {
        for (const value of ['/', '1', '2', '3', '4', 'Backspace']) {
          expect(key(dispatchTarget, value).defaultPrevented).toBe(false);
        }
        expect(state.activeTab).toBe('games');
        expect(document.activeElement).toBe(el.btnSettings);
        loadGame('games/a/index.html', 'A', 'game', 'a');
        key(dispatchTarget, 'f');
        key(dispatchTarget, 'm');
        expect(document.body.classList.contains('fullscreen')).toBe(false);
        expect(state.preferences.sound).toBe(true);
      } finally {
        target.remove();
      }
    },
  );

  it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }])(
    'Échap reste une fermeture explicite dans une saisie même avec %p',
    (modifiers) => {
      el.btnSettings.click();
      el.inputPseudo.value = '  Cyrille  ';
      expect(key(el.inputPseudo, 'Escape', modifiers).defaultPrevented).toBe(false);
      expect(state.currentView).toBe('catalogue');
      expect(state.preferences.pseudo).toBe('Cyrille');
      expect(document.activeElement).toBe(el.btnSettings);
      loadGame('games/a/index.html', 'A', 'game', 'a');
      key(el.inputPseudo, 'Escape', modifiers);
      jest.advanceTimersByTime(100);
      expect(state.currentGame).toBeNull();
      expect(document.activeElement).toBe(el.btnSettings);
    },
  );

  it('un Échap déjà consommé ne ferme pas les paramètres', () => {
    el.btnSettings.click();
    el.inputPseudo.addEventListener('keydown', event => event.preventDefault(), { once: true });
    expect(key(el.inputPseudo, 'Escape').defaultPrevented).toBe(true);
    expect(state.currentView).toBe('settings');
    expect(document.activeElement).toBe(el.inputPseudo);
  });

  it.each(['catalogue', 'settings', 'game'])(
    'Tab et Shift+Tab dans %s restent au navigateur, sans piège de focus global',
    (view) => {
      if (view === 'settings') { el.btnSettings.click(); }
      if (view === 'game') { loadGame('games/a/index.html', 'A', 'game', 'a'); }
      const focused = document.activeElement;
      expect(key(focused, 'Tab').defaultPrevented).toBe(false);
      expect(key(focused, 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(focused);
      expect(state.currentView).toBe(view);
    },
  );

  it('la casse des commandes reste exacte et Shift ne bloque pas une touche minuscule', () => {
    loadGame('games/a/index.html', 'A', 'game', 'a');
    key(document.body, 'F');
    key(document.body, 'M');
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(state.preferences.sound).toBe(true);
    key(document.body, 'f', { shiftKey: true });
    key(document.body, 'm', { shiftKey: true });
    expect(document.body.classList.contains('fullscreen')).toBe(true);
    expect(state.preferences.sound).toBe(false);
  });

  it('Échap au catalogue et une touche inconnue ne déplacent pas le focus', () => {
    const focused = document.activeElement;
    expect(key(focused, 'Escape').defaultPrevented).toBe(false);
    expect(key(focused, 'inconnue').defaultPrevented).toBe(false);
    expect(state.currentView).toBe('catalogue');
    expect(document.activeElement).toBe(focused);
  });

  it.each([
    { activeTab: 'parcours', parcoursCategory: null },
    { activeTab: 'games', parcoursCategory: 'dev' },
  ])('Backspace sans catégorie parcours active reste natif : %p', (updates) => {
    setState(updates);
    expect(key(document.body, 'Backspace').defaultPrevented).toBe(false);
    expect(state.parcoursCategory).toBe(updates.parcoursCategory);
    expect(state.activeTab).toBe(updates.activeTab);
  });
});
