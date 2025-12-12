/**
 * Playlab42 - Application du portail
 * @see openspec/specs/portal/spec.md
 */

import { $, on, delegate, escapeHtml, cloneTemplate, debounce } from './lib/dom.js';
import { getTheme, setTheme, THEMES } from './lib/theme.js';

// === État de l'application ===
const state = {
  currentView: 'catalogue',
  activeTab: 'tools',
  currentGame: null,
  catalogue: null,
  preferences: {
    sound: true,
    pseudo: 'Anonyme',
  },
  recentGames: [],
  activeFilter: '',
};

// === Constantes ===
const STORAGE_KEYS = {
  PLAYER: 'player',
  PREFERENCES: 'preferences',
  RECENT: 'recent_games',
  ACTIVE_TAB: 'playlab42.activeTab',
};
const MAX_RECENT = 5;

// === Éléments DOM (cache) ===
const el = {
  // Views
  viewCatalogue: $('#view-catalogue'),
  viewGame: $('#view-game'),
  viewSettings: $('#view-settings'),

  // Catalogue
  search: $('#search'),
  filters: $('#filters'),
  cardsGames: $('#cards-games'),
  cardsTools: $('#cards-tools'),
  emptyGames: $('#empty-games'),
  emptyTools: $('#empty-tools'),

  // Tabs
  tabTools: $('#tab-tools'),
  tabGames: $('#tab-games'),
  panelTools: $('#panel-tools'),
  panelGames: $('#panel-games'),

  // Game
  gameTitle: $('#game-title'),
  gameIframe: $('#game-iframe'),
  loading: $('#loading'),
  btnBack: $('#btn-back'),
  btnFullscreen: $('#btn-fullscreen'),
  btnSound: $('#btn-sound'),

  // Settings
  btnSettings: $('#btn-settings'),
  btnCloseSettings: $('#btn-close-settings'),
  inputPseudo: $('#input-pseudo'),
  soundOn: $('#sound-on'),
  soundOff: $('#sound-off'),
  themeSystem: $('#theme-system'),
  themeDark: $('#theme-dark'),
  themeLight: $('#theme-light'),
  btnClearData: $('#btn-clear-data'),
};

// === Utilitaires ===

/**
 * Met à jour l'état et déclenche un re-render si nécessaire
 */
function setState(updates) {
  Object.assign(state, updates);
}

/**
 * Charge les préférences depuis localStorage
 */
function loadPreferences() {
  try {
    const player = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (player) {
      const parsed = JSON.parse(player);
      state.preferences.pseudo = parsed.name || 'Anonyme';
    }

    const prefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      state.preferences.sound = parsed.sound !== false;
    }

    const recent = localStorage.getItem(STORAGE_KEYS.RECENT);
    if (recent) {
      state.recentGames = JSON.parse(recent);
    }

    const activeTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (activeTab === 'tools' || activeTab === 'games') {
      state.activeTab = activeTab;
    }
  } catch (e) {
    console.warn('Erreur chargement préférences:', e);
  }
}

/**
 * Sauvegarde les préférences dans localStorage
 */
function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify({ name: state.preferences.pseudo }));
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ sound: state.preferences.sound }));
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(state.recentGames));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, state.activeTab);
  } catch (e) {
    console.warn('Erreur sauvegarde préférences:', e);
  }
}

/**
 * Ajoute un jeu/outil aux récents
 */
function addToRecent(id, type) {
  state.recentGames = state.recentGames.filter(r => r.id !== id);
  state.recentGames.unshift({ id, type, timestamp: Date.now() });
  state.recentGames = state.recentGames.slice(0, MAX_RECENT);
  savePreferences();
}

// === Tabs ===

/**
 * Change l'onglet actif
 */
function switchTab(tab) {
  if (tab !== 'tools' && tab !== 'games') {return;}
  if (state.activeTab === tab) {return;}

  setState({ activeTab: tab, activeFilter: '' });
  savePreferences();
  updateTabUI();
  renderCatalogue();
}

/**
 * Met à jour l'UI des onglets
 */
function updateTabUI() {
  el.tabTools.classList.toggle('active', state.activeTab === 'tools');
  el.tabTools.setAttribute('aria-selected', state.activeTab === 'tools');
  el.tabGames.classList.toggle('active', state.activeTab === 'games');
  el.tabGames.setAttribute('aria-selected', state.activeTab === 'games');

  el.panelTools.classList.toggle('active', state.activeTab === 'tools');
  el.panelGames.classList.toggle('active', state.activeTab === 'games');
}

// === Catalogue ===

/**
 * Charge le catalogue depuis le serveur
 */
async function loadCatalogue() {
  try {
    const response = await fetch('/data/catalogue.json');
    if (!response.ok) {throw new Error('Catalogue introuvable');}
    setState({ catalogue: await response.json() });
    renderCatalogue();
  } catch (e) {
    console.error('Erreur chargement catalogue:', e);
    el.cardsGames.textContent = '';
    el.cardsTools.textContent = '';
    const errorEl = document.createElement('p');
    errorEl.className = 'error';
    errorEl.textContent = 'Erreur de chargement du catalogue';
    el.cardsGames.appendChild(errorEl);
  }
}

/**
 * Extrait tous les tags uniques de l'onglet actif
 */
function getTagsForCurrentTab() {
  if (!state.catalogue) {return [];}
  const items = state.activeTab === 'games' ? state.catalogue.games : state.catalogue.tools;
  const tags = new Set();
  items.forEach(item => {
    item.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Crée un élément filtre
 */
function createFilterElement(tag, isActive) {
  const fragment = cloneTemplate('filter-template');
  const btn = fragment.querySelector('.filter');
  btn.textContent = tag || 'Tous';
  btn.dataset.tag = tag;
  if (isActive) {btn.classList.add('active');}
  return fragment;
}

/**
 * Rend les filtres de tags pour l'onglet actif
 */
function renderFilters() {
  const tags = getTagsForCurrentTab();
  el.filters.textContent = '';

  // Filtre "Tous"
  el.filters.appendChild(createFilterElement('', state.activeFilter === ''));

  // Filtres par tag
  for (const tag of tags) {
    el.filters.appendChild(createFilterElement(tag, state.activeFilter === tag));
  }
}

/**
 * Crée un élément carte
 */
function createCardElement(item, type) {
  const fragment = cloneTemplate('card-template');
  const card = fragment.querySelector('.card');
  const thumb = fragment.querySelector('.card-thumb');
  const title = fragment.querySelector('h3');
  const desc = fragment.querySelector('p');
  const tagsContainer = fragment.querySelector('.card-tags');

  // Data attributes
  card.dataset.id = item.id;
  card.dataset.type = type;
  card.dataset.path = item.path;

  // Thumbnail
  if (type === 'game') {
    const thumbSrc = item.path.replace('index.html', 'thumb.png');
    const img = document.createElement('img');
    img.src = thumbSrc;
    img.alt = escapeHtml(item.name);
    img.loading = 'lazy';
    img.onerror = () => {
      thumb.textContent = item.icon || '🎮';
    };
    thumb.appendChild(img);
  } else {
    thumb.textContent = item.icon || '🔧';
  }

  // Info
  title.textContent = (item.icon ? `${item.icon  } ` : '') + escapeHtml(item.name);
  desc.textContent = escapeHtml(item.description);

  // Tags
  if (item.tags?.length) {
    for (const tag of item.tags.slice(0, 3)) {
      const tagFragment = cloneTemplate('tag-template');
      const tagEl = tagFragment.querySelector('.card-tag');
      tagEl.textContent = escapeHtml(tag);
      tagsContainer.appendChild(tagFragment);
    }
  }

  return fragment;
}

/**
 * Filtre les items selon la recherche et le tag actif
 */
function filterItems(items) {
  const search = el.search.value.toLowerCase().trim();
  return items.filter(item => {
    if (state.activeFilter && !item.tags?.includes(state.activeFilter)) {
      return false;
    }
    if (search) {
      const searchable = `${item.name} ${item.description}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Rend le catalogue (onglet actif uniquement)
 */
function renderCatalogue() {
  if (!state.catalogue) {return;}

  renderFilters();

  if (state.activeTab === 'tools') {
    const filteredTools = filterItems(state.catalogue.tools);
    el.cardsTools.textContent = '';
    for (const tool of filteredTools) {
      el.cardsTools.appendChild(createCardElement(tool, 'tool'));
    }
    el.emptyTools.classList.toggle('visible', filteredTools.length === 0 && state.catalogue.tools.length > 0);
  }

  if (state.activeTab === 'games') {
    const filteredGames = filterItems(state.catalogue.games);
    el.cardsGames.textContent = '';
    for (const game of filteredGames) {
      el.cardsGames.appendChild(createCardElement(game, 'game'));
    }
    el.emptyGames.classList.toggle('visible', filteredGames.length === 0 && state.catalogue.games.length > 0);
  }
}

// === Game Loader ===

/**
 * Charge un jeu/outil dans l'iframe
 */
function loadGame(path, name, type, id) {
  setState({
    currentGame: { path, name, type, id },
    currentView: 'game',
  });

  el.viewCatalogue.classList.remove('active');
  el.viewSettings.classList.remove('active');
  el.viewGame.classList.add('active');
  el.gameTitle.textContent = escapeHtml(name);
  el.loading.classList.remove('hidden');

  el.gameIframe.src = path;
  addToRecent(id, type);

  const timeout = setTimeout(() => {
    el.loading.textContent = 'Chargement lent...';
  }, 5000);

  el.gameIframe.onload = () => {
    clearTimeout(timeout);
    el.loading.classList.add('hidden');
  };

  el.gameIframe.onerror = () => {
    clearTimeout(timeout);
    el.loading.textContent = 'Erreur de chargement';
  };
}

/**
 * Décharge le jeu et retourne au catalogue
 */
function unloadGame() {
  if (el.gameIframe.contentWindow) {
    el.gameIframe.contentWindow.postMessage({ type: 'unload' }, '*');
  }

  setTimeout(() => {
    el.gameIframe.src = 'about:blank';
    setState({
      currentGame: null,
      currentView: 'catalogue',
    });

    el.viewGame.classList.remove('active');
    el.viewSettings.classList.remove('active');
    el.viewCatalogue.classList.add('active');
    document.body.classList.remove('fullscreen');
  }, 100);
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen() {
  document.body.classList.toggle('fullscreen');
}

/**
 * Toggle son
 */
function toggleSound() {
  state.preferences.sound = !state.preferences.sound;
  updateSoundButton();
  savePreferences();

  if (el.gameIframe.contentWindow) {
    el.gameIframe.contentWindow.postMessage({
      type: 'preference',
      key: 'sound',
      value: state.preferences.sound,
    }, '*');
  }
}

function updateSoundButton() {
  el.btnSound.textContent = state.preferences.sound ? '🔊' : '🔇';
}

// === Settings ===

function showSettings() {
  setState({ currentView: 'settings' });
  el.viewCatalogue.classList.remove('active');
  el.viewGame.classList.remove('active');
  el.viewSettings.classList.add('active');

  el.inputPseudo.value = state.preferences.pseudo;
  updateSoundToggles();
  updateThemeToggles();
}

function hideSettings() {
  const newPseudo = el.inputPseudo.value.trim() || 'Anonyme';
  state.preferences.pseudo = newPseudo;
  savePreferences();

  setState({ currentView: 'catalogue' });
  el.viewSettings.classList.remove('active');
  el.viewCatalogue.classList.add('active');
}

function updateSoundToggles() {
  el.soundOn.classList.toggle('active', state.preferences.sound);
  el.soundOff.classList.toggle('active', !state.preferences.sound);
}

function updateThemeToggles() {
  const theme = getTheme();
  el.themeSystem.classList.toggle('active', theme === THEMES.SYSTEM);
  el.themeDark.classList.toggle('active', theme === THEMES.DARK);
  el.themeLight.classList.toggle('active', theme === THEMES.LIGHT);
}

function setSoundPreference(enabled) {
  state.preferences.sound = enabled;
  updateSoundToggles();
  updateSoundButton();
  savePreferences();
}

function setThemePreference(theme) {
  setTheme(theme);
  updateThemeToggles();
}

function clearAllData() {
  if (!confirm('Effacer toutes les données (scores, progression, préférences) ?')) {
    return;
  }

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('scores_') || key.startsWith('progress_') ||
        key === STORAGE_KEYS.PLAYER || key === STORAGE_KEYS.PREFERENCES ||
        key === STORAGE_KEYS.RECENT) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  state.preferences = { sound: true, pseudo: 'Anonyme' };
  state.recentGames = [];

  el.inputPseudo.value = 'Anonyme';
  updateSoundToggles();

  alert('Données effacées');
}

// === Event Listeners ===

function setupEventListeners() {
  // Catalogue - click sur carte (délégation)
  delegate(document, 'click', '.card', (card) => {
    const { path, id, type } = card.dataset;
    const name = card.querySelector('h3').textContent;
    loadGame(path, name, type, id);
  });

  // Catalogue - onglets
  on(el.tabTools, 'click', () => switchTab('tools'));
  on(el.tabGames, 'click', () => switchTab('games'));

  // Catalogue - filtres (délégation)
  delegate(el.filters, 'click', '.filter', (btn) => {
    setState({ activeFilter: btn.dataset.tag });
    renderCatalogue();
  });

  // Catalogue - recherche
  on(el.search, 'input', debounce(renderCatalogue, 200));

  // Game - contrôles
  on(el.btnBack, 'click', unloadGame);
  on(el.btnFullscreen, 'click', toggleFullscreen);
  on(el.btnSound, 'click', toggleSound);

  // Settings
  on(el.btnSettings, 'click', showSettings);
  on(el.btnCloseSettings, 'click', hideSettings);
  on(el.soundOn, 'click', () => setSoundPreference(true));
  on(el.soundOff, 'click', () => setSoundPreference(false));
  on(el.themeSystem, 'click', () => setThemePreference(THEMES.SYSTEM));
  on(el.themeDark, 'click', () => setThemePreference(THEMES.DARK));
  on(el.themeLight, 'click', () => setThemePreference(THEMES.LIGHT));
  on(el.btnClearData, 'click', clearAllData);

  // Raccourcis clavier
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.currentView === 'game') {
        unloadGame();
      } else if (state.currentView === 'settings') {
        hideSettings();
      }
    }

    if (e.key === 'f' && state.currentView === 'game') {
      toggleFullscreen();
    }

    if (e.key === 'm' && state.currentView === 'game') {
      toggleSound();
    }

    if (e.key === '/' && state.currentView === 'catalogue') {
      e.preventDefault();
      el.search.focus();
    }

    if (e.key === '1' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('tools');
    }

    if (e.key === '2' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('games');
    }
  });

  // Messages du jeu
  on(window, 'message', (e) => {
    if (!e.data || !e.data.type) {return;}

    switch (e.data.type) {
      case 'ready':
        console.log(`[Portal] Jeu prêt: ${e.data.game}`);
        break;
      case 'score':
        console.log(`[Portal] Score: ${e.data.score}`);
        break;
      case 'quit':
        unloadGame();
        break;
      case 'error':
        console.error('[Portal] Erreur jeu:', e.data.error);
        break;
    }
  });
}

// === Initialisation ===

async function init() {
  loadPreferences();
  updateSoundButton();
  updateTabUI();
  setupEventListeners();
  await loadCatalogue();
}

init();
