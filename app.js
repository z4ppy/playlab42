/**
 * Playlab42 - Application du portail
 * @see openspec/specs/portal/spec.md
 */

// === État de l'application ===
const state = {
  currentView: 'catalogue',
  activeTab: 'tools', // Onglet par défaut
  currentGame: null,
  catalogue: null,
  preferences: {
    sound: true,
    pseudo: 'Anonyme'
  },
  recentGames: [],
  activeFilter: ''
};

// === Constantes ===
const STORAGE_KEYS = {
  PLAYER: 'player',
  PREFERENCES: 'preferences',
  RECENT: 'recent_games',
  ACTIVE_TAB: 'playlab42.activeTab'
};
const MAX_RECENT = 5;

// === Éléments DOM ===
const elements = {
  // Views
  viewCatalogue: document.getElementById('view-catalogue'),
  viewGame: document.getElementById('view-game'),
  viewSettings: document.getElementById('view-settings'),

  // Catalogue
  search: document.getElementById('search'),
  filters: document.getElementById('filters'),
  cardsGames: document.getElementById('cards-games'),
  cardsTools: document.getElementById('cards-tools'),
  emptyGames: document.getElementById('empty-games'),
  emptyTools: document.getElementById('empty-tools'),

  // Tabs
  tabTools: document.getElementById('tab-tools'),
  tabGames: document.getElementById('tab-games'),
  panelTools: document.getElementById('panel-tools'),
  panelGames: document.getElementById('panel-games'),

  // Game
  gameTitle: document.getElementById('game-title'),
  gameIframe: document.getElementById('game-iframe'),
  loading: document.getElementById('loading'),
  btnBack: document.getElementById('btn-back'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  btnSound: document.getElementById('btn-sound'),

  // Settings
  btnSettings: document.getElementById('btn-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  inputPseudo: document.getElementById('input-pseudo'),
  soundOn: document.getElementById('sound-on'),
  soundOff: document.getElementById('sound-off'),
  btnClearData: document.getElementById('btn-clear-data')
};

// === Utilitaires ===

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
    console.warn('Failed to load preferences:', e);
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
    console.warn('Failed to save preferences:', e);
  }
}

/**
 * Ajoute un jeu/outil aux récents
 */
function addToRecent(id, type) {
  // Retirer si déjà présent
  state.recentGames = state.recentGames.filter(r => r.id !== id);
  // Ajouter en premier
  state.recentGames.unshift({ id, type, timestamp: Date.now() });
  // Limiter
  state.recentGames = state.recentGames.slice(0, MAX_RECENT);
  savePreferences();
}

// === Tabs ===

/**
 * Change l'onglet actif
 * @param {string} tab - 'tools' ou 'games'
 */
function switchTab(tab) {
  if (tab !== 'tools' && tab !== 'games') return;
  if (state.activeTab === tab) return;

  state.activeTab = tab;
  state.activeFilter = ''; // Reset filter on tab change
  savePreferences();
  updateTabUI();
  renderCatalogue();
}

/**
 * Met à jour l'UI des onglets
 */
function updateTabUI() {
  // Tabs
  elements.tabTools.classList.toggle('active', state.activeTab === 'tools');
  elements.tabTools.setAttribute('aria-selected', state.activeTab === 'tools');
  elements.tabGames.classList.toggle('active', state.activeTab === 'games');
  elements.tabGames.setAttribute('aria-selected', state.activeTab === 'games');

  // Panels
  elements.panelTools.classList.toggle('active', state.activeTab === 'tools');
  elements.panelGames.classList.toggle('active', state.activeTab === 'games');
}

// === Catalogue ===

/**
 * Charge le catalogue depuis le serveur
 */
async function loadCatalogue() {
  try {
    const response = await fetch('/data/catalogue.json');
    if (!response.ok) throw new Error('Catalogue not found');
    state.catalogue = await response.json();
    renderCatalogue();
  } catch (e) {
    console.error('Failed to load catalogue:', e);
    elements.cardsGames.innerHTML = '<p class="error">Erreur de chargement du catalogue</p>';
    elements.cardsTools.innerHTML = '';
  }
}

/**
 * Extrait tous les tags uniques de l'onglet actif
 */
function getTagsForCurrentTab() {
  if (!state.catalogue) return [];
  const items = state.activeTab === 'games' ? state.catalogue.games : state.catalogue.tools;
  const tags = new Set();
  items.forEach(item => {
    item.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Rend les filtres de tags pour l'onglet actif
 */
function renderFilters() {
  const tags = getTagsForCurrentTab();
  elements.filters.innerHTML = `
    <button class="filter ${state.activeFilter === '' ? 'active' : ''}" data-tag="">Tous</button>
    ${tags.map(tag => `
      <button class="filter ${state.activeFilter === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>
    `).join('')}
  `;
}

/**
 * Crée le HTML d'une carte
 */
function createCard(item, type) {
  const thumbSrc = type === 'game'
    ? item.path.replace('index.html', 'thumb.png')
    : null;

  return `
    <div class="card" data-id="${item.id}" data-type="${type}" data-path="${item.path}">
      <div class="card-thumb">
        ${thumbSrc
          ? `<img src="${thumbSrc}" alt="${item.name}" loading="lazy" onerror="this.parentElement.textContent='${item.icon || '🎮'}'">`
          : (item.icon || '🔧')
        }
      </div>
      <div class="card-info">
        <h3>${item.icon ? item.icon + ' ' : ''}${item.name}</h3>
        <p>${item.description}</p>
        ${item.tags?.length ? `
          <div class="card-tags">
            ${item.tags.slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Filtre les items selon la recherche et le tag actif
 */
function filterItems(items) {
  const search = elements.search.value.toLowerCase().trim();
  return items.filter(item => {
    // Filtre par tag
    if (state.activeFilter && !item.tags?.includes(state.activeFilter)) {
      return false;
    }
    // Filtre par recherche
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
  if (!state.catalogue) return;

  renderFilters();

  // Tools (si onglet actif)
  if (state.activeTab === 'tools') {
    const filteredTools = filterItems(state.catalogue.tools);
    elements.cardsTools.innerHTML = filteredTools.map(t => createCard(t, 'tool')).join('');
    elements.emptyTools.classList.toggle('visible', filteredTools.length === 0 && state.catalogue.tools.length > 0);
  }

  // Games (si onglet actif)
  if (state.activeTab === 'games') {
    const filteredGames = filterItems(state.catalogue.games);
    elements.cardsGames.innerHTML = filteredGames.map(g => createCard(g, 'game')).join('');
    elements.emptyGames.classList.toggle('visible', filteredGames.length === 0 && state.catalogue.games.length > 0);
  }
}

// === Game Loader ===

/**
 * Charge un jeu/outil dans l'iframe
 */
function loadGame(path, name, type, id) {
  state.currentGame = { path, name, type, id };
  state.currentView = 'game';

  // UI
  elements.viewCatalogue.classList.remove('active');
  elements.viewSettings.classList.remove('active');
  elements.viewGame.classList.add('active');
  elements.gameTitle.textContent = name;
  elements.loading.classList.remove('hidden');

  // Charger l'iframe
  elements.gameIframe.src = path;

  // Ajouter aux récents
  addToRecent(id, type);

  // Timeout de chargement
  const timeout = setTimeout(() => {
    elements.loading.innerHTML = '<p>Chargement lent...</p>';
  }, 5000);

  elements.gameIframe.onload = () => {
    clearTimeout(timeout);
    elements.loading.classList.add('hidden');
  };

  elements.gameIframe.onerror = () => {
    clearTimeout(timeout);
    elements.loading.innerHTML = '<p>Erreur de chargement</p>';
  };
}

/**
 * Décharge le jeu et retourne au catalogue
 */
function unloadGame() {
  // Notifier le jeu
  if (elements.gameIframe.contentWindow) {
    elements.gameIframe.contentWindow.postMessage({ type: 'unload' }, '*');
  }

  // Attendre un peu puis décharger
  setTimeout(() => {
    elements.gameIframe.src = 'about:blank';
    state.currentGame = null;
    state.currentView = 'catalogue';

    elements.viewGame.classList.remove('active');
    elements.viewSettings.classList.remove('active');
    elements.viewCatalogue.classList.add('active');
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

  // Notifier le jeu
  if (elements.gameIframe.contentWindow) {
    elements.gameIframe.contentWindow.postMessage({
      type: 'preference',
      key: 'sound',
      value: state.preferences.sound
    }, '*');
  }
}

function updateSoundButton() {
  elements.btnSound.textContent = state.preferences.sound ? '🔊' : '🔇';
}

// === Settings ===

function showSettings() {
  state.currentView = 'settings';
  elements.viewCatalogue.classList.remove('active');
  elements.viewGame.classList.remove('active');
  elements.viewSettings.classList.add('active');

  // Remplir les valeurs
  elements.inputPseudo.value = state.preferences.pseudo;
  updateSoundToggles();
}

function hideSettings() {
  // Sauvegarder le pseudo
  const newPseudo = elements.inputPseudo.value.trim() || 'Anonyme';
  state.preferences.pseudo = newPseudo;
  savePreferences();

  state.currentView = 'catalogue';
  elements.viewSettings.classList.remove('active');
  elements.viewCatalogue.classList.add('active');
}

function updateSoundToggles() {
  elements.soundOn.classList.toggle('active', state.preferences.sound);
  elements.soundOff.classList.toggle('active', !state.preferences.sound);
}

function setSoundPreference(enabled) {
  state.preferences.sound = enabled;
  updateSoundToggles();
  updateSoundButton();
  savePreferences();
}

function clearAllData() {
  if (!confirm('Effacer toutes les données (scores, progression, préférences) ?')) {
    return;
  }

  // Effacer tout le localStorage lié à Playlab42
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

  // Reset state
  state.preferences = { sound: true, pseudo: 'Anonyme' };
  state.recentGames = [];

  // Update UI
  elements.inputPseudo.value = 'Anonyme';
  updateSoundToggles();

  alert('Données effacées');
}

// === Event Listeners ===

function setupEventListeners() {
  // Catalogue - click sur carte
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) {
      const path = card.dataset.path;
      const id = card.dataset.id;
      const type = card.dataset.type;
      const name = card.querySelector('h3').textContent;
      loadGame(path, name, type, id);
    }
  });

  // Catalogue - onglets
  elements.tabTools.addEventListener('click', () => switchTab('tools'));
  elements.tabGames.addEventListener('click', () => switchTab('games'));

  // Catalogue - filtres
  elements.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (btn) {
      state.activeFilter = btn.dataset.tag;
      renderCatalogue();
    }
  });

  // Catalogue - recherche
  let searchDebounce;
  elements.search.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderCatalogue, 200);
  });

  // Game - retour
  elements.btnBack.addEventListener('click', unloadGame);

  // Game - fullscreen
  elements.btnFullscreen.addEventListener('click', toggleFullscreen);

  // Game - son
  elements.btnSound.addEventListener('click', toggleSound);

  // Settings
  elements.btnSettings.addEventListener('click', showSettings);
  elements.btnCloseSettings.addEventListener('click', hideSettings);
  elements.soundOn.addEventListener('click', () => setSoundPreference(true));
  elements.soundOff.addEventListener('click', () => setSoundPreference(false));
  elements.btnClearData.addEventListener('click', clearAllData);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape - fermer jeu ou settings
    if (e.key === 'Escape') {
      if (state.currentView === 'game') {
        unloadGame();
      } else if (state.currentView === 'settings') {
        hideSettings();
      }
    }

    // F - fullscreen (en jeu)
    if (e.key === 'f' && state.currentView === 'game') {
      toggleFullscreen();
    }

    // M - mute (en jeu)
    if (e.key === 'm' && state.currentView === 'game') {
      toggleSound();
    }

    // / - focus recherche (au catalogue)
    if (e.key === '/' && state.currentView === 'catalogue') {
      e.preventDefault();
      elements.search.focus();
    }

    // 1 - onglet Outils (au catalogue)
    if (e.key === '1' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('tools');
    }

    // 2 - onglet Jeux (au catalogue)
    if (e.key === '2' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('games');
    }
  });

  // Messages du jeu
  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'ready':
        console.log(`[Portal] Game ready: ${e.data.game}`);
        break;

      case 'score':
        console.log(`[Portal] Score: ${e.data.score}`);
        // Optionnel: afficher un toast
        break;

      case 'quit':
        unloadGame();
        break;

      case 'error':
        console.error(`[Portal] Game error:`, e.data.error);
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

// Lancer
init();
