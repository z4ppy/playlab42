/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

// Seule la frontière avec le jeu est doublée ; stockage, thème et rendus restent réels.
jest.unstable_mockModule('./game-loader.js', () => ({
  updateSoundButton: () => {
    document.getElementById('btn-sound').setAttribute('aria-pressed', String(state.preferences.sound));
  },
}));

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { loadPreferences } = await import('./storage.js');
const { updateTabUI } = await import('./tabs.js');
const { renderParcours } = await import('./parcours.js');
const { syncTheme, THEMES } = await import('../lib/theme.js');
const settings = await import('./settings.js');

const epic = { id: 'algo', title: 'Algorithmes', description: 'Découvrir', slideCount: 4, tags: [] };
const recents = [
  { id: 'tictactoe', type: 'game', timestamp: 1 },
  { id: 'neural-style', type: 'tool', timestamp: 2 },
  { id: 'relativity-lab', type: 'tool', timestamp: 3 },
];

function snapshot() {
  return {
    storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
    state: JSON.parse(JSON.stringify(state)),
    ui: document.body.innerHTML,
    theme: document.documentElement.getAttribute('data-theme'),
  };
}

function expectNoSuccess() {
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][0]).not.toMatch(/^Données compatibles effacées/);
}

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  window.matchMedia = jest.fn(() => ({ matches: false }));
  localStorage.setItem('player', '{"name":"Ada"}');
  localStorage.setItem('preferences', '{"sound":false}');
  localStorage.setItem('recent_games', JSON.stringify(recents));
  localStorage.setItem('playlab42.activeTab', 'games');
  localStorage.setItem('playlab42.theme', 'light');
  localStorage.setItem('parcours-progress', '{"algo":{"visited":["a"],"current":"a"}}');
  localStorage.setItem('scores_tictactoe', '[{"score":3,"date":1,"player":"Ada"}]');
  localStorage.setItem('progress_tictactoe', '{"round":2}');
  localStorage.setItem('scores_neural-style', 'format propriétaire');
  localStorage.setItem('progress_relativity-lab', '{"clock":9}');
  localStorage.setItem('foreign-favorites', '["algo"]');
  localStorage.setItem('playlab42.local-data.schema', '{"version":1}');
  setState({
    currentGame: null, currentView: 'catalogue', activeTab: 'games',
    preferences: { sound: true, pseudo: 'Anonyme' }, recentGames: [],
    activeFilter: '', parcoursCategory: null, bookmarkTagFilter: null,
    catalogue: { games: [], tools: [] },
    parcoursCatalogue: { epics: [epic], featured: { recent: [epic], pinned: [epic] } },
    bookmarksCatalogue: { categories: [] },
  });
  expect(loadPreferences()).toBe(true);
  el.search.value = '';
  el.viewCatalogue.classList.add('active');
  el.viewSettings.classList.remove('active');
  el.viewGame.classList.remove('active');
  updateTabUI();
  syncTheme();
  settings.showSettings();
  el.btnSound.setAttribute('aria-pressed', 'false');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Paramètres : réinitialisation observable', () => {
  it('refuse un jeu actif sans confirmation ni mutation du stockage, mémoire ou UI', () => {
    state.currentGame = { id: 'tictactoe', type: 'game' };
    const before = snapshot();
    settings.clearAllData();
    expect(snapshot()).toEqual(before);
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Fermez le jeu'));
    expectNoSuccess();
  });

  it('une confirmation refusée ne mute aucune donnée ni interface', () => {
    confirm.mockReturnValue(false);
    const before = snapshot();
    const write = jest.spyOn(Storage.prototype, 'setItem');
    const remove = jest.spyOn(Storage.prototype, 'removeItem');
    settings.clearAllData();
    expect(snapshot()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it.each([
    ['schéma futur', 'playlab42.local-data.schema', '{"version":2}', 'plus récent'],
    ['format de récents incompatible', 'recent_games', '{"version":2,"items":[]}', 'invalide'],
    ['JSON corrompu', 'player', '{"name":', 'JSON invalide'],
  ])('préserve les originaux lors du refus : %s', (_label, key, raw, reason) => {
    localStorage.setItem(key, raw);
    const before = snapshot();
    settings.clearAllData();
    expect(snapshot()).toEqual(before);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining(reason));
    expectNoSuccess();
  });

  it('annule une suppression échouée après une première suppression réelle', () => {
    const before = snapshot();
    const removeItem = Storage.prototype.removeItem;
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === 'preferences') { throw new Error('suppression interdite'); }
      return removeItem.call(this, key);
    });
    settings.clearAllData();
    expect(snapshot()).toEqual(before);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Réinitialisation impossible'));
    expectNoSuccess();
  });

  it.each(['player', 'preferences', 'recent_games', 'playlab42.activeTab'])(
    'distingue suppression réussie et relecture échouée de %s sans publier un état mémoire non relu',
    failedKey => {
      const before = snapshot();
      const getItem = Storage.prototype.getItem;
      let failRead = false;
      const removeItem = Storage.prototype.removeItem;
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
        removeItem.call(this, key);
        if (key === 'playlab42.local-data.schema') { failRead = true; }
      });
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (failRead && key === failedKey) { throw new Error('relecture indisponible'); }
        return getItem.call(this, key);
      },
      );
      settings.clearAllData();
      failRead = false;
      const after = snapshot();
      expect(after.storage.player).toBeUndefined();
      expect(after.storage.preferences).toBeUndefined();
      expect(after.storage['foreign-favorites']).toBe(before.storage['foreign-favorites']);
      expect(after.state).toEqual(before.state);
      expect(after.ui).toBe(before.ui);
      expect(after.theme).toBe(before.theme);
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('leur relecture a échoué'));
      expectNoSuccess();
    });

  it('réinitialise le profil, le thème, les récents compatibles et la progression sans perdre les exclus ni favoris', () => {
    const catalogue = JSON.parse(JSON.stringify(state.parcoursCatalogue));
    const themes = [];
    const onTheme = event => themes.push(event.detail.theme);
    window.addEventListener('themechange', onTheme);
    try {
      settings.clearAllData();
    } finally {
      window.removeEventListener('themechange', onTheme);
    }
    expect(Object.keys(localStorage).sort()).toEqual([
      'foreign-favorites', 'progress_relativity-lab', 'recent_games', 'scores_neural-style',
    ]);
    expect(JSON.parse(localStorage.getItem('recent_games'))).toEqual(recents.slice(1));
    expect(state.recentGames).toEqual(recents.slice(1));
    expect(state.preferences).toEqual({ sound: true, pseudo: 'Anonyme' });
    expect(state.parcoursCatalogue).toEqual(catalogue);
    expect(localStorage.getItem('foreign-favorites')).toBe('["algo"]');
    expect(localStorage.getItem('scores_neural-style')).toBe('format propriétaire');
    expect(localStorage.getItem('progress_relativity-lab')).toBe('{"clock":9}');
    expect(el.inputPseudo.value).toBe('Anonyme');
    expect(el.soundOn.getAttribute('aria-pressed')).toBe('true');
    expect(el.soundOff.getAttribute('aria-pressed')).toBe('false');
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(el.themeSystem.getAttribute('aria-pressed')).toBe('true');
    expect(themes).toEqual(['dark']);
    expect(state.activeTab).toBe('parcours');
    expect(el.tabParcours.getAttribute('aria-selected')).toBe('true');
    expect(el.panelParcours.classList.contains('active')).toBe(true);
    expect(el.parcoursCategoriesExpanded.textContent).toContain('Commencer le parcours');
    expect(el.parcoursCategoriesExpanded.textContent).not.toContain('Continuer votre lecture');
    expect(alert).toHaveBeenCalledWith('Données compatibles effacées. Les données des outils exclus ont été conservées.');
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('efface tous les récents quand aucun outil exclu n’y figure', () => {
    localStorage.setItem('recent_games', JSON.stringify(recents.slice(0, 1)));
    settings.clearAllData();
    expect(localStorage.getItem('recent_games')).toBeNull();
    expect(state.recentGames).toEqual([]);
  });

  it('recalcule réellement une carte en cours après le reset', () => {
    state.activeTab = 'parcours';
    renderParcours();
    expect(el.parcoursCategoriesExpanded.textContent).toContain('Continuer votre lecture');
    settings.clearAllData();
    expect(el.parcoursCategoriesExpanded.textContent).not.toContain('Continuer votre lecture');
    expect(el.parcoursCategoriesExpanded.querySelector('.epic-progress-bar').style.width).toBe('0%');
  });
});

describe('Paramètres : préférences et navigation', () => {
  it('sauvegarde le pseudo nettoyé et restitue le focus du bouton connecté', () => {
    el.btnSettings.focus();
    settings.showSettings();
    expect(document.activeElement).toBe(el.inputPseudo);
    el.inputPseudo.value = '  Grace  ';
    settings.hideSettings();
    expect(state.preferences.pseudo).toBe('Grace');
    expect(JSON.parse(localStorage.getItem('player'))).toEqual({ name: 'Grace' });
    expect(state.currentView).toBe('catalogue');
    expect(document.activeElement).toBe(el.btnSettings);
    el.inputPseudo.value = '   ';
    settings.hideSettings();
    expect(JSON.parse(localStorage.getItem('player'))).toEqual({ name: 'Anonyme' });
  });

  it('persiste le son et reflète les trois thèmes dans le stockage et les boutons', () => {
    settings.setSoundPreference(false);
    expect(JSON.parse(localStorage.getItem('preferences'))).toEqual({ sound: false });
    expect(el.soundOff.getAttribute('aria-pressed')).toBe('true');
    expect(el.btnSound.getAttribute('aria-pressed')).toBe('false');
    for (const [theme, button] of [
      [THEMES.LIGHT, el.themeLight], [THEMES.DARK, el.themeDark], [THEMES.SYSTEM, el.themeSystem],
    ]) {
      settings.setThemePreference(theme);
      expect(localStorage.getItem('playlab42.theme')).toBe(theme === THEMES.SYSTEM ? null : theme);
      expect(button.getAttribute('aria-pressed')).toBe('true');
    }
  });
});
