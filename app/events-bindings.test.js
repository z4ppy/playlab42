/**
 * @jest-environment jsdom
 *
 * Bindings publics du portail : rendus, navigation et stockage réels.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const { state, setState, STORAGE_KEYS } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { setupEventListeners } = await import('./events.js');
const { updateTabUI } = await import('./tabs.js');
const { renderCatalogue } = await import('./catalogue.js');
const { loadGame } = await import('./game-loader.js');

setupEventListeners();

const savedScores = JSON.stringify([{ score: 42, date: 1, player: 'Ada' }]);

function key(target, value, modifiers = {}) {
  const event = new KeyboardEvent('keydown', {
    key: value, bubbles: true, cancelable: true, ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

function clickFilter(container, selector) {
  const button = container.querySelector(selector);
  const child = document.createElement('span');
  child.textContent = 'Choisir';
  button.appendChild(child);
  child.click();
}

function loadedGame() {
  loadGame('games/alpha/index.html', 'Alpha', 'game', 'alpha');
  el.gameIframe.onload();
}

function assertCatalogue() {
  expect(state.currentView).toBe('catalogue');
  expect(state.currentGame).toBeNull();
  expect(el.gameIframe.src).toBe('about:blank');
  expect(el.viewCatalogue.classList.contains('active')).toBe(true);
  expect(el.viewGame.classList.contains('active')).toBe(false);
  expect(document.body.classList.contains('game-active')).toBe(false);
  expect(window.location.hash).toBe('#/');
}

describe('Bindings DOM publics de app/events', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    // Frontière navigateur absente de jsdom ; les fonctions de thème restent réelles.
    window.matchMedia = jest.fn(() => ({ matches: false }));
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('game-active', 'fullscreen');
    el.viewCatalogue.classList.add('active');
    el.viewGame.classList.remove('active');
    el.viewSettings.classList.remove('active');
    el.gameIframe.src = 'about:blank';
    setState({
      currentView: 'catalogue', currentGame: null, activeTab: 'games',
      activeFilter: '', parcoursCategory: null, bookmarkTagFilter: null,
      recentGames: [], preferences: { sound: true, pseudo: 'Cyrille' },
      catalogue: {
        games: [
          { id: 'alpha', name: 'Alpha', description: 'Logique', tags: ['logique'], path: 'games/alpha/index.html' },
          { id: 'beta', name: 'Beta', description: 'Autre', tags: ['autre'], path: 'games/beta/index.html' },
        ],
        tools: [
          { id: 'alpha', name: 'Alpha', description: 'Logique', tags: ['logique'], path: 'tools/alpha.html' },
          { id: 'beta', name: 'Beta', description: 'Autre', tags: ['autre'], path: 'tools/beta.html' },
        ],
      },
      parcoursCatalogue: {
        epics: [
          { id: 'alpha', title: 'Alpha', description: 'Logique', hierarchy: ['dev'], tags: ['logique'], slideCount: 2 },
          { id: 'beta', title: 'Beta', description: 'Autre', hierarchy: ['autres'], tags: ['autre'], slideCount: 2 },
        ],
      },
      bookmarksCatalogue: {
        tags: [{ id: 'ide', count: 1 }, { id: 'cli', count: 1 }],
        categories: [{
          id: 'ressources', label: 'Ressources',
          bookmarks: [
            { title: 'Alpha', description: 'Éditeur', url: 'https://alpha.example', tags: ['ide'] },
            { title: 'Beta', description: 'Terminal', url: 'https://beta.example', tags: ['cli'] },
          ],
        }],
      },
    });
    el.search.value = '';
    updateTabUI();
    renderCatalogue();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
    delete window.matchMedia;
  });

  it.each([
    ['parcours', '1', '2 parcours'],
    ['tools', '2', '2 outils'],
    ['games', '3', '2 jeux'],
    ['bookmarks', '4', '2 liens'],
  ])('le clic puis le raccourci %s sélectionnent, rendent et persistent l’onglet', (tab, shortcut, count) => {
    setState({ activeTab: tab === 'games' ? 'tools' : 'games', activeFilter: 'ancien' });
    document.querySelector(`[data-tab="${tab}"]`).click();
    expect(state.activeTab).toBe(tab);
    expect(state.activeFilter).toBe('');
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe(tab);
    expect(el.catalogueStatus.textContent).toBe(count);
    expect(document.querySelector(`[data-tab="${tab}"]`).getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById(`panel-${tab}`).classList.contains('active')).toBe(true);

    setState({ activeTab: tab === 'games' ? 'tools' : 'games' });
    key(document.body, shortcut);
    expect(state.activeTab).toBe(tab);
    expect(el.catalogueStatus.textContent).toBe(count);
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe(tab);
  });

  it('la délégation filtre les cartes de jeux puis restaure tous les résultats', () => {
    clickFilter(el.filters, '[data-tag="logique"]');
    expect(state.activeFilter).toBe('logique');
    expect(el.cardsGames.querySelectorAll('.card')).toHaveLength(1);
    expect(el.cardsGames.textContent).toContain('Alpha');
    expect(el.cardsGames.textContent).not.toContain('Beta');
    clickFilter(el.filters, '[data-tag=""]');
    expect(state.activeFilter).toBe('');
    expect(el.cardsGames.querySelectorAll('.card')).toHaveLength(2);
  });

  it('la délégation de tag rend les parcours quand cet onglet est actif', () => {
    el.tabParcours.click();
    clickFilter(el.filters, '[data-tag="logique"]');
    expect(state.activeFilter).toBe('logique');
    expect(el.catalogueStatus.textContent).toBe('1 parcours');
    expect(el.cardsParcours.querySelectorAll('.epic-card')).toHaveLength(1);
    expect(el.cardsParcours.textContent).toContain('Alpha');
  });

  it('les catégories déléguées puis Backspace reviennent à tous les parcours', () => {
    el.tabParcours.click();
    clickFilter(el.parcoursCategoryFilters, '[data-category="dev"]');
    expect(state.parcoursCategory).toBe('dev');
    expect(el.catalogueStatus.textContent).toBe('1 parcours');
    expect(key(document.body, 'Backspace').defaultPrevented).toBe(true);
    expect(state.parcoursCategory).toBeNull();
    expect(el.catalogueStatus.textContent).toBe('2 parcours');
    clickFilter(el.parcoursCategoryFilters, '[data-category="dev"]');
    clickFilter(el.parcoursCategoryFilters, '[data-category=""]');
    expect(state.parcoursCategory).toBeNull();
    expect(el.catalogueStatus.textContent).toBe('2 parcours');
  });

  it('les tags délégués limitent les liens externes puis rétablissent la liste', () => {
    el.tabBookmarks.click();
    clickFilter(el.bookmarkFilters, '[data-tag="cli"]');
    expect(state.bookmarkTagFilter).toBe('cli');
    expect(el.bookmarkTree.querySelectorAll('.bookmark-item a')).toHaveLength(1);
    expect(el.bookmarkTree.querySelector('.bookmark-item a').href).toBe('https://beta.example/');
    clickFilter(el.bookmarkFilters, '[data-tag=""]');
    expect(state.bookmarkTagFilter).toBeNull();
    expect(el.catalogueStatus.textContent).toBe('2 liens');
  });

  it.each([
    ['games', 'jeux'], ['tools', 'outils'], ['parcours', 'parcours'], ['bookmarks', 'liens'],
  ])('la recherche différée %s ne rend que la dernière saisie puis reset restaure tout', (tab, noun) => {
    document.querySelector(`[data-tab="${tab}"]`).click();
    el.search.value = 'Beta';
    el.search.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(150);
    el.search.value = 'Alpha';
    el.search.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(199);
    expect(el.catalogueStatus.textContent).toBe(`2 ${noun}`);
    jest.advanceTimersByTime(1);
    expect(el.catalogueStatus.textContent).toBe(`1 ${noun === 'jeux' ? 'jeu' : noun === 'outils' ? 'outil' : noun === 'liens' ? 'lien' : noun}`);
    expect(el.resetDiscovery.hidden).toBe(false);
    setState({ activeFilter: 'logique', parcoursCategory: 'dev', bookmarkTagFilter: 'ide' });
    el.resetDiscovery.click();
    expect(el.search.value).toBe('');
    expect(state.activeFilter).toBe('');
    expect(state.parcoursCategory).toBeNull();
    expect(state.bookmarkTagFilter).toBeNull();
    expect(el.catalogueStatus.textContent).toBe(`2 ${noun}`);
    expect(el.resetDiscovery.hidden).toBe(true);
    expect(document.activeElement).toBe(el.search);
  });

  it('une recherche sans résultat distingue une liste vide d’un catalogue indisponible', () => {
    el.tabParcours.click();
    el.search.value = 'absent';
    el.search.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(200);
    expect(el.emptyParcours.textContent).toContain('ne correspond');
    expect(el.emptyParcours.hasAttribute('role')).toBe(false);
    setState({ parcoursCatalogue: null });
    el.search.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(200);
    expect(el.emptyParcours.getAttribute('role')).toBe('alert');
    expect(el.emptyParcours.textContent).toContain('Impossible');
    expect(el.catalogueStatus.textContent).toBe('Parcours indisponibles');
  });

  it('les boutons et raccourcis plein écran/son modifient DOM et préférences sauvegardées', () => {
    loadedGame();
    el.btnFullscreen.click();
    expect(document.body.classList.contains('fullscreen')).toBe(true);
    expect(el.btnFullscreen.getAttribute('aria-pressed')).toBe('true');
    key(document.body, 'f');
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(el.btnFullscreen.getAttribute('aria-pressed')).toBe('false');
    el.btnSound.click();
    expect(state.preferences.sound).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFERENCES))).toEqual({ sound: false });
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('false');
    key(document.body, 'm');
    expect(state.preferences.sound).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFERENCES))).toEqual({ sound: true });
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['bouton', 'Escape'])('%s ferme réellement le jeu et restaure le focus', (action) => {
    el.tabGames.focus();
    loadedGame();
    if (action === 'bouton') { el.btnBack.click(); }
    else { key(document.body, 'Escape'); }
    expect(state.currentView).toBe('game');
    jest.advanceTimersByTime(100);
    assertCatalogue();
    expect(document.activeElement).toBe(el.tabGames);
  });

  it.each(['bouton', 'Escape'])('%s ferme les paramètres et sauvegarde le pseudo nettoyé', (action) => {
    el.btnSettings.focus();
    el.btnSettings.click();
    expect(state.currentView).toBe('settings');
    expect(el.viewSettings.classList.contains('active')).toBe(true);
    expect(document.activeElement).toBe(el.inputPseudo);
    el.inputPseudo.value = '  Ada  ';
    if (action === 'bouton') { el.btnCloseSettings.click(); }
    else { key(el.inputPseudo, 'Escape'); }
    expect(state.currentView).toBe('catalogue');
    expect(el.viewSettings.classList.contains('active')).toBe(false);
    expect(state.preferences.pseudo).toBe('Ada');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYER))).toEqual({ name: 'Ada' });
    expect(document.activeElement).toBe(el.btnSettings);
  });

  it('les deux boutons son des paramètres persistent leurs choix et annoncent leur état', () => {
    el.btnSettings.click();
    for (const [button, sound] of [[el.soundOff, false], [el.soundOn, true]]) {
      button.click();
      expect(state.preferences.sound).toBe(sound);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFERENCES))).toEqual({ sound });
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(el.btnSound.getAttribute('aria-pressed')).toBe(String(sound));
    }
  });

  it('les trois boutons thème synchronisent stockage, document et notification publique', () => {
    const changed = [];
    const listener = event => changed.push(event.detail.theme);
    window.addEventListener('themechange', listener);
    try {
      el.btnSettings.click();
      for (const [button, theme] of [[el.themeDark, 'dark'], [el.themeLight, 'light'], [el.themeSystem, 'system']]) {
        button.click();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(document.documentElement.getAttribute('data-theme')).toBe(theme === 'system' ? null : theme);
        expect(localStorage.getItem('playlab42.theme')).toBe(theme === 'system' ? null : theme);
      }
      expect(changed).toEqual(['dark', 'light', 'dark']);
    } finally {
      window.removeEventListener('themechange', listener);
    }
  });

  it('un événement clavier déjà traité ne change ni onglet ni stockage', () => {
    el.tabGames.addEventListener('keydown', event => event.preventDefault(), { once: true });
    expect(key(el.tabGames, '2').defaultPrevented).toBe(true);
    expect(state.activeTab).toBe('games');
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBeNull();
  });

  it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }])(
    'les modificateurs %p ne déclenchent pas les contrôles du jeu',
    (modifiers) => {
      loadedGame();
      key(document.body, 'f', modifiers);
      key(document.body, 'm', modifiers);
      expect(document.body.classList.contains('fullscreen')).toBe(false);
      expect(state.preferences.sound).toBe(true);
    },
  );

  it('la saisie conserve Backspace et les raccourcis hors de la vue concernée sont inertes', () => {
    el.tabParcours.click();
    clickFilter(el.parcoursCategoryFilters, '[data-category="dev"]');
    expect(key(el.search, 'Backspace').defaultPrevented).toBe(false);
    expect(state.parcoursCategory).toBe('dev');
    expect(key(document.body, '/').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el.search);
    key(document.body, 'f');
    key(document.body, 'm');
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(state.preferences.sound).toBe(true);
    el.btnSettings.click();
    key(document.body, '2');
    expect(state.activeTab).toBe('parcours');
    expect(key(document.body, '/').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(el.inputPseudo);
  });

  it('le bouton reset refusé ne modifie ni données ni état', () => {
    localStorage.setItem('scores_alpha', savedScores);
    const preferences = state.preferences;
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    el.btnClearData.click();
    expect(localStorage.getItem('scores_alpha')).toBe(savedScores);
    expect(state.preferences).toBe(preferences);
    expect(alert).not.toHaveBeenCalled();
  });

  it('le bouton reset avec jeu chargé affiche le refus sans même demander confirmation', () => {
    loadedGame();
    const game = state.currentGame;
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    el.btnClearData.click();
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Fermez le jeu'));
    expect(state.currentGame).toBe(game);
    expect(state.currentView).toBe('game');
  });

  it('le bouton reset signale une erreur de stockage sans annoncer un succès', () => {
    localStorage.setItem('scores_alpha', savedScores);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('Stockage refusé');
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw failure; });
    el.btnClearData.click();
    expect(warning).toHaveBeenCalledWith('Erreur réinitialisation données:', expect.objectContaining({
      code: 'storage', cause: failure,
    }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Réinitialisation impossible : Stockage inaccessible ou quota dépassé.');
    expect(localStorage.getItem('scores_alpha')).toBe(savedScores);
    expect(state.preferences.pseudo).toBe('Cyrille');
  });

  it('le bouton reset accepté efface les données compatibles sans toucher aux données étrangères', () => {
    localStorage.setItem('scores_alpha', savedScores);
    localStorage.setItem('etranger', 'conserver');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    el.btnClearData.click();
    expect(localStorage.getItem('scores_alpha')).toBeNull();
    expect(localStorage.getItem('etranger')).toBe('conserver');
    expect(state.preferences).toEqual({ sound: true, pseudo: 'Anonyme' });
    expect(state.activeTab).toBe('parcours');
    expect(el.inputPseudo.value).toBe('Anonyme');
    expect(el.tabParcours.getAttribute('aria-selected')).toBe('true');
    expect(el.catalogueStatus.textContent).toBe('2 parcours');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Données compatibles effacées'));
  });
});
