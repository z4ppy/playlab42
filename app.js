/**
 * Playlab42 - Application du portail
 * @see openspec/specs/portal/spec.md
 */

import { $, on, delegate, escapeHtml, cloneTemplate, debounce } from './lib/dom.js';
import { getTheme, setTheme, THEMES } from './lib/theme.js';
import { ParcoursViewer } from './lib/parcours-viewer.js';

// === État de l'application ===
const state = {
  currentView: 'catalogue',
  activeTab: 'parcours',
  currentGame: null,
  catalogue: null,
  parcoursCatalogue: null,
  parcoursCategory: null, // Catégorie sélectionnée pour filtrer
  parcoursViewer: null, // Instance du viewer de parcours
  bookmarksCatalogue: null, // Catalogue des bookmarks
  bookmarkTagFilter: null, // Tag actif pour filtrer les bookmarks
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
  viewParcours: $('#view-parcours'),
  viewSettings: $('#view-settings'),

  // Catalogue
  search: $('#search'),
  filters: $('#filters'),
  cardsGames: $('#cards-games'),
  cardsTools: $('#cards-tools'),
  emptyGames: $('#empty-games'),
  emptyTools: $('#empty-tools'),

  // Tabs
  tabParcours: $('#tab-parcours'),
  tabTools: $('#tab-tools'),
  tabGames: $('#tab-games'),
  tabBookmarks: $('#tab-bookmarks'),
  panelParcours: $('#panel-parcours'),
  panelTools: $('#panel-tools'),
  panelGames: $('#panel-games'),
  panelBookmarks: $('#panel-bookmarks'),

  // Bookmarks
  bookmarkFilters: $('#bookmark-filters'),
  bookmarkTree: $('#bookmark-tree'),
  emptyBookmarks: $('#empty-bookmarks'),
  bookmarkPreview: $('#bookmark-preview'),

  // Parcours
  parcoursCategoryFilters: $('#parcours-category-filters'),
  parcoursCategoriesExpanded: $('#parcours-categories-expanded'),
  parcoursList: $('#parcours-list'),
  cardsParcours: $('#cards-parcours'),
  emptyParcours: $('#empty-parcours'),

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
    if (activeTab === 'tools' || activeTab === 'games' || activeTab === 'parcours' || activeTab === 'bookmarks') {
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
  if (tab !== 'tools' && tab !== 'games' && tab !== 'parcours' && tab !== 'bookmarks') {return;}
  if (state.activeTab === tab) {return;}

  setState({ activeTab: tab, activeFilter: '', parcoursCategory: null, bookmarkTagFilter: null });
  savePreferences();
  updateTabUI();

  if (tab === 'parcours') {
    renderParcours();
  } else if (tab === 'bookmarks') {
    renderBookmarks();
  } else {
    renderCatalogue();
  }
}

/**
 * Met à jour l'UI des onglets
 */
function updateTabUI() {
  el.tabParcours.classList.toggle('active', state.activeTab === 'parcours');
  el.tabParcours.setAttribute('aria-selected', state.activeTab === 'parcours');
  el.tabTools.classList.toggle('active', state.activeTab === 'tools');
  el.tabTools.setAttribute('aria-selected', state.activeTab === 'tools');
  el.tabGames.classList.toggle('active', state.activeTab === 'games');
  el.tabGames.setAttribute('aria-selected', state.activeTab === 'games');
  el.tabBookmarks.classList.toggle('active', state.activeTab === 'bookmarks');
  el.tabBookmarks.setAttribute('aria-selected', state.activeTab === 'bookmarks');

  el.panelParcours.classList.toggle('active', state.activeTab === 'parcours');
  el.panelTools.classList.toggle('active', state.activeTab === 'tools');
  el.panelGames.classList.toggle('active', state.activeTab === 'games');
  el.panelBookmarks.classList.toggle('active', state.activeTab === 'bookmarks');

  // Masquer les filtres globaux sur Parcours et Bookmarks (ils ont leurs propres filtres)
  const hideFilters = state.activeTab === 'parcours' || state.activeTab === 'bookmarks';
  el.filters.style.display = hideFilters ? 'none' : 'flex';
}

// === Catalogue ===

/**
 * Charge le catalogue depuis le serveur
 */
async function loadCatalogue() {
  try {
    const response = await fetch('./data/catalogue.json');
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

// === Parcours ===

/**
 * Charge le catalogue parcours depuis le serveur
 */
async function loadParcoursCatalogue() {
  try {
    const response = await fetch('./data/parcours.json');
    if (!response.ok) {throw new Error('Catalogue parcours introuvable');}
    setState({ parcoursCatalogue: await response.json() });
  } catch (e) {
    console.warn('Catalogue parcours non disponible:', e.message);
    setState({ parcoursCatalogue: null });
  }
}

/**
 * Récupère la progression d'un epic depuis localStorage
 */
function getEpicProgress(epicId) {
  try {
    const key = 'parcours-progress';
    const data = localStorage.getItem(key);
    if (!data) {return { visited: [], current: null };}
    const progress = JSON.parse(data);
    return progress[epicId] || { visited: [], current: null };
  } catch {
    return { visited: [], current: null };
  }
}

/**
 * Crée un élément carte Epic
 */
function createEpicCardElement(epic) {
  const fragment = cloneTemplate('epic-card-template');
  const card = fragment.querySelector('.epic-card');
  const thumb = fragment.querySelector('.epic-thumb');
  const title = fragment.querySelector('.epic-title');
  const desc = fragment.querySelector('.epic-description');
  const duration = fragment.querySelector('.epic-duration');
  const slides = fragment.querySelector('.epic-slides');
  const tagsContainer = fragment.querySelector('.epic-tags');
  const progressBar = fragment.querySelector('.epic-progress-bar');

  // Data attributes
  card.dataset.epicId = epic.id;
  card.dataset.path = epic.path;

  // Thumbnail
  if (epic.thumbnail) {
    const img = document.createElement('img');
    img.src = epic.thumbnail;
    img.alt = escapeHtml(epic.title);
    img.loading = 'lazy';
    img.onerror = () => {
      thumb.textContent = epic.icon || '📚';
    };
    thumb.appendChild(img);
  } else {
    thumb.textContent = epic.icon || '📚';
  }

  // Info
  title.textContent = (epic.icon ? `${epic.icon} ` : '') + escapeHtml(epic.title);
  desc.textContent = escapeHtml(epic.description);

  // Meta
  if (epic.duration) {
    duration.textContent = `⏱ ${epic.duration}`;
  }
  slides.textContent = `📄 ${epic.slideCount} slides`;

  // Tags
  if (epic.tags?.length) {
    for (const tag of epic.tags.slice(0, 3)) {
      const tagEl = document.createElement('span');
      tagEl.className = 'epic-tag';
      tagEl.textContent = escapeHtml(tag);
      tagsContainer.appendChild(tagEl);
    }
  }

  // Progress
  const progress = getEpicProgress(epic.id);
  const visitedCount = progress.visited?.length || 0;
  const progressPercent = epic.slideCount > 0 ? (visitedCount / epic.slideCount) * 100 : 0;
  progressBar.style.width = `${progressPercent}%`;

  if (progressPercent >= 100) {
    card.classList.add('completed');
  } else if (progressPercent > 0) {
    card.classList.add('in-progress');
  }

  return fragment;
}

/**
 * Filtre les epics selon la recherche et la catégorie active
 */
function filterEpics(epics) {
  const search = el.search.value.toLowerCase().trim();
  return epics.filter(epic => {
    // Filtre par catégorie
    if (state.parcoursCategory && epic.hierarchy[0] !== state.parcoursCategory) {
      return false;
    }
    // Filtre par tag
    if (state.activeFilter && !epic.tags?.includes(state.activeFilter)) {
      return false;
    }
    // Filtre par recherche
    if (search) {
      const searchable = `${epic.title} ${epic.description} ${epic.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Rend les filtres par catégorie pour les parcours
 */
function renderParcoursCategoryFilters() {
  if (!state.parcoursCatalogue) {return;}

  el.parcoursCategoryFilters.textContent = '';

  const { epics, taxonomy } = state.parcoursCatalogue;

  // Construire les catégories à partir des epics réels
  const categoriesWithCount = {};
  for (const epic of epics) {
    const catId = epic.hierarchy[0] || 'autres';
    if (!categoriesWithCount[catId]) {
      const taxCat = taxonomy.hierarchy.find(h => h.id === catId);
      categoriesWithCount[catId] = {
        id: catId,
        label: taxCat?.label || catId,
        icon: taxCat?.icon || '📁',
        order: catId === 'playlab42' ? 0 : (catId === 'autres' ? 99 : (taxCat?.order || 50)),
        count: 0,
      };
    }
    categoriesWithCount[catId].count++;
  }

  // Bouton "Tous"
  const allBtn = document.createElement('button');
  allBtn.className = `filter${!state.parcoursCategory ? ' active' : ''}`;
  allBtn.dataset.category = '';
  allBtn.textContent = 'Tous';
  el.parcoursCategoryFilters.appendChild(allBtn);

  // Boutons par catégorie (ordre: playlab42 en premier, autres en dernier)
  const sortedCategories = Object.values(categoriesWithCount).sort((a, b) => {
    if (a.id === 'playlab42') {return -1;}
    if (b.id === 'playlab42') {return 1;}
    if (a.id === 'autres') {return 1;}
    if (b.id === 'autres') {return -1;}
    return (a.order || 0) - (b.order || 0);
  });

  for (const category of sortedCategories) {
    if (category.count === 0) {continue;} // Masquer catégories vides

    const btn = document.createElement('button');
    btn.className = `filter${state.parcoursCategory === category.id ? ' active' : ''}`;
    btn.dataset.category = category.id;
    btn.textContent = `${category.icon || ''} ${category.label} (${category.count})`;
    el.parcoursCategoryFilters.appendChild(btn);
  }
}

/**
 * Crée une section de catégorie dépliée
 */
function createCategorySectionElement(category, epicsInCategory) {
  const fragment = cloneTemplate('category-section-template');
  const title = fragment.querySelector('.category-section-title');
  const epicsContainer = fragment.querySelector('.category-epics');

  title.textContent = `${category.icon || ''} ${category.label}`;

  for (const epic of epicsInCategory) {
    epicsContainer.appendChild(createEpicCardElement(epic));
  }

  return fragment;
}

/**
 * Rend la page d'accueil Parcours
 *
 * Ordre d'affichage :
 * 1. Catégorie PlayLab42 (tous les epics de playlab42)
 * 2. Récemment ajoutés (epics récents HORS playlab42)
 * 3. Autres catégories (epics pas encore affichés)
 */
function renderParcours() {
  if (!state.parcoursCatalogue) {
    el.emptyParcours.classList.add('visible');
    return;
  }

  const { epics, taxonomy, featured } = state.parcoursCatalogue;

  // Reset
  el.parcoursCategoryFilters.textContent = '';
  el.parcoursCategoriesExpanded.textContent = '';
  el.cardsParcours.textContent = '';

  // Toujours afficher les filtres par catégorie
  renderParcoursCategoryFilters();

  // Mode recherche : afficher liste filtrée
  const hasSearch = el.search.value.trim().length > 0;

  if (hasSearch) {
    // Masquer accueil, afficher liste
    el.parcoursCategoriesExpanded.style.display = 'none';
    el.parcoursList.style.display = 'block';

    const filteredEpics = filterEpics(epics);
    for (const epic of filteredEpics) {
      el.cardsParcours.appendChild(createEpicCardElement(epic));
    }
    el.emptyParcours.classList.toggle('visible', filteredEpics.length === 0);
    return;
  }

  // Mode accueil
  el.parcoursList.style.display = 'none';
  el.emptyParcours.classList.remove('visible');
  el.parcoursCategoriesExpanded.style.display = 'block';

  // Set pour tracker les epics déjà affichés
  const displayedIds = new Set();

  // Construire la liste des catégories basée sur les epics réels
  // (indépendamment du threshold dans la taxonomie)
  const categoriesFromEpics = {};
  for (const epic of epics) {
    const catId = epic.hierarchy[0] || 'autres';
    if (!categoriesFromEpics[catId]) {
      // Chercher les infos dans la taxonomie si disponible
      const taxCat = taxonomy.hierarchy.find(h => h.id === catId);
      categoriesFromEpics[catId] = {
        id: catId,
        label: taxCat?.label || catId,
        icon: taxCat?.icon || '📁',
        order: taxCat?.order || (catId === 'autres' ? 99 : 50),
      };
    }
  }

  // Trier les catégories : playlab42 en premier, autres en dernier
  const sortedHierarchy = Object.values(categoriesFromEpics).sort((a, b) => {
    if (a.id === 'playlab42') {return -1;}
    if (b.id === 'playlab42') {return 1;}
    if (a.id === 'autres') {return 1;}
    if (b.id === 'autres') {return -1;}
    return (a.order || 0) - (b.order || 0);
  });

  // Trouver la catégorie playlab42
  const playlab42Category = sortedHierarchy.find(c => c.id === 'playlab42');

  // === 1. Afficher la catégorie PlayLab42 ===
  if (playlab42Category && (!state.parcoursCategory || state.parcoursCategory === 'playlab42')) {
    const playlab42Epics = epics.filter(e => e.hierarchy[0] === 'playlab42');

    if (playlab42Epics.length > 0) {
      el.parcoursCategoriesExpanded.appendChild(
        createCategorySectionElement(playlab42Category, playlab42Epics),
      );
      playlab42Epics.forEach(e => displayedIds.add(e.id));
    }
  }

  // === 2. Afficher les récents (HORS playlab42) ===
  const recentEpics = (featured.recent || []).filter(e => {
    // Exclure ceux déjà affichés (playlab42)
    if (displayedIds.has(e.id)) {return false;}
    // Si filtre par catégorie, respecter le filtre
    if (state.parcoursCategory && e.hierarchy[0] !== state.parcoursCategory) {return false;}
    return true;
  });

  if (recentEpics.length > 0) {
    // Créer une section "Récemment ajoutés"
    const recentCategory = {
      id: 'recent',
      label: 'Récemment ajoutés',
      icon: '🕐',
    };
    el.parcoursCategoriesExpanded.appendChild(
      createCategorySectionElement(recentCategory, recentEpics),
    );
    recentEpics.forEach(e => displayedIds.add(e.id));
  }

  // === 3. Afficher les autres catégories (epics pas encore affichés) ===
  for (const category of sortedHierarchy) {
    // Skip playlab42, déjà affiché en premier
    if (category.id === 'playlab42') {continue;}

    // Si filtre par catégorie et pas cette catégorie, skip
    if (state.parcoursCategory && state.parcoursCategory !== category.id) {continue;}

    // Epics de cette catégorie, excluant ceux déjà affichés
    const epicsInCategory = epics.filter(e =>
      e.hierarchy[0] === category.id && !displayedIds.has(e.id),
    );

    // Ne pas afficher catégorie vide
    if (epicsInCategory.length === 0) {continue;}

    el.parcoursCategoriesExpanded.appendChild(
      createCategorySectionElement(category, epicsInCategory),
    );
  }
}

/**
 * Ouvre un Epic dans le viewer
 * @param {string} epicId - ID de l'epic
 * @param {string} [slideId] - ID de la slide (optionnel)
 */
function openEpic(epicId, slideId = null) {
  // Masquer les autres vues
  el.viewCatalogue.classList.remove('active');
  el.viewGame.classList.remove('active');
  el.viewSettings.classList.remove('active');
  el.viewParcours.classList.add('active');

  setState({ currentView: 'parcours' });

  // Créer le viewer s'il n'existe pas
  if (!state.parcoursViewer) {
    state.parcoursViewer = new ParcoursViewer(el.viewParcours, {
      onClose: () => {
        closeParcours();
      },
      onSlideChange: (slide, index) => {
        console.log(`[Portal] Slide ${index + 1}: ${slide.title}`);
      },
    });
  }

  // Charger l'epic
  state.parcoursViewer.load(epicId, slideId);
}

/**
 * Ferme le viewer de parcours et retourne au catalogue
 */
function closeParcours() {
  el.viewParcours.classList.remove('active');
  el.viewCatalogue.classList.add('active');
  setState({ currentView: 'catalogue' });
}

/**
 * Sélectionne une catégorie pour filtrer les parcours
 */
function selectParcoursCategory(categoryId) {
  setState({ parcoursCategory: categoryId });
  renderParcours();
}

// === Bookmarks ===

/**
 * Charge le catalogue bookmarks depuis le serveur
 */
async function loadBookmarksCatalogue() {
  try {
    const response = await fetch('./data/bookmarks.json');
    if (!response.ok) {throw new Error('Catalogue bookmarks introuvable');}
    setState({ bookmarksCatalogue: await response.json() });
  } catch (e) {
    console.warn('Catalogue bookmarks non disponible:', e.message);
    setState({ bookmarksCatalogue: null });
  }
}

/**
 * Récupère les tags uniques des bookmarks
 */
function getBookmarkTags() {
  if (!state.bookmarksCatalogue?.tags) {return [];}
  return state.bookmarksCatalogue.tags;
}

/**
 * Rend les filtres de tags pour les bookmarks
 */
function renderBookmarkFilters() {
  const tags = getBookmarkTags();
  el.bookmarkFilters.textContent = '';

  // Bouton "Tous"
  const allBtn = document.createElement('button');
  allBtn.className = `filter${!state.bookmarkTagFilter ? ' active' : ''}`;
  allBtn.dataset.tag = '';
  allBtn.textContent = 'Tous';
  el.bookmarkFilters.appendChild(allBtn);

  // Boutons par tag (top 10)
  for (const tag of tags.slice(0, 10)) {
    const btn = document.createElement('button');
    btn.className = `filter${state.bookmarkTagFilter === tag.id ? ' active' : ''}`;
    btn.dataset.tag = tag.id;
    btn.textContent = `${tag.id} (${tag.count})`;
    el.bookmarkFilters.appendChild(btn);
  }
}

/**
 * Filtre les bookmarks d'une catégorie
 */
function filterBookmarks(bookmarks) {
  const search = el.search.value.toLowerCase().trim();

  return bookmarks.filter(bookmark => {
    // Filtre par tag
    if (state.bookmarkTagFilter && !bookmark.tags?.includes(state.bookmarkTagFilter)) {
      return false;
    }
    // Filtre par recherche
    if (search) {
      const searchable = `${bookmark.displayTitle || bookmark.title} ${bookmark.displayDescription || bookmark.description || ''} ${bookmark.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Crée un élément catégorie de bookmarks
 */
function createBookmarkCategoryElement(category) {
  const fragment = cloneTemplate('bookmark-category-template');
  const container = fragment.querySelector('.bookmark-category');
  const icon = fragment.querySelector('.bookmark-category-icon');
  const label = fragment.querySelector('.bookmark-category-label');
  const count = fragment.querySelector('.bookmark-category-count');
  const list = fragment.querySelector('.bookmark-list');

  icon.textContent = category.icon || '📁';
  label.textContent = category.label;

  const filteredBookmarks = filterBookmarks(category.bookmarks);
  count.textContent = `(${filteredBookmarks.length})`;

  // Ajouter les bookmarks
  for (const bookmark of filteredBookmarks) {
    list.appendChild(createBookmarkItemElement(bookmark));
  }

  // Masquer si aucun bookmark après filtrage
  if (filteredBookmarks.length === 0) {
    container.style.display = 'none';
  }

  return fragment;
}

/**
 * Crée un élément bookmark
 */
function createBookmarkItemElement(bookmark) {
  const fragment = cloneTemplate('bookmark-item-template');
  const link = fragment.querySelector('a');
  const icon = fragment.querySelector('.bookmark-icon');
  const title = fragment.querySelector('.bookmark-title');
  const description = fragment.querySelector('.bookmark-description');
  const domain = fragment.querySelector('.bookmark-domain');

  link.href = bookmark.url;
  link.dataset.bookmarkUrl = bookmark.url;
  icon.textContent = bookmark.icon || '🔗';
  title.textContent = escapeHtml(bookmark.displayTitle || bookmark.title);
  description.textContent = escapeHtml(bookmark.displayDescription || bookmark.description || '');
  domain.textContent = bookmark.domain;

  // Stocker les données pour la preview
  link.dataset.bookmark = JSON.stringify(bookmark);

  return fragment;
}

/**
 * Affiche la preview card d'un bookmark
 */
function showBookmarkPreview(bookmarkData, anchorElement) {
  const preview = el.bookmarkPreview;
  if (!preview) {
    return;
  }

  const imageEl = preview.querySelector('.bookmark-preview-image');
  const titleEl = preview.querySelector('.bookmark-preview-title');
  const descEl = preview.querySelector('.bookmark-preview-description');
  const domainEl = preview.querySelector('.bookmark-preview-domain');

  // Remplir le contenu
  titleEl.textContent = bookmarkData.displayTitle || bookmarkData.title;
  descEl.textContent = bookmarkData.displayDescription || bookmarkData.description || '';
  domainEl.textContent = bookmarkData.domain;

  // Image OG ou fallback
  const ogImage = bookmarkData.meta?.ogImage;
  if (ogImage) {
    imageEl.style.backgroundImage = `url(${ogImage})`;
    imageEl.classList.add('has-image');
  } else {
    imageEl.style.backgroundImage = '';
    imageEl.classList.remove('has-image');
  }

  // Positionner la preview
  const rect = anchorElement.getBoundingClientRect();
  const previewWidth = 320;
  const previewHeight = 200;
  const margin = 12;

  // Position par défaut : à droite de l'élément
  let left = rect.right + margin;
  let top = rect.top;

  // Si déborde à droite, afficher à gauche
  if (left + previewWidth > window.innerWidth) {
    left = rect.left - previewWidth - margin;
  }

  // Si déborde en bas, remonter
  if (top + previewHeight > window.innerHeight) {
    top = window.innerHeight - previewHeight - margin;
  }

  // Si déborde en haut, descendre
  if (top < margin) {
    top = margin;
  }

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.classList.add('visible');
  preview.setAttribute('aria-hidden', 'false');
}

/**
 * Cache la preview card
 */
function hideBookmarkPreview() {
  const preview = el.bookmarkPreview;
  if (!preview) {
    return;
  }

  preview.classList.remove('visible');
  preview.setAttribute('aria-hidden', 'true');
}

/**
 * Rend les bookmarks
 */
function renderBookmarks() {
  if (!state.bookmarksCatalogue) {
    el.emptyBookmarks.classList.add('visible');
    return;
  }

  const { categories } = state.bookmarksCatalogue;

  // Reset
  el.bookmarkTree.textContent = '';
  el.emptyBookmarks.classList.remove('visible');

  // Rendre les filtres
  renderBookmarkFilters();

  // Rendre les catégories
  let totalVisible = 0;
  for (const category of categories) {
    const filteredBookmarks = filterBookmarks(category.bookmarks);
    if (filteredBookmarks.length > 0) {
      el.bookmarkTree.appendChild(createBookmarkCategoryElement(category));
      totalVisible += filteredBookmarks.length;
    }
  }

  // Message vide si aucun résultat
  el.emptyBookmarks.classList.toggle('visible', totalVisible === 0);
}

/**
 * Sélectionne un tag pour filtrer les bookmarks
 */
function selectBookmarkTag(tagId) {
  setState({ bookmarkTagFilter: tagId || null });
  renderBookmarks();
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
  document.body.classList.add('game-active');
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
    document.body.classList.remove('game-active');
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
  on(el.tabParcours, 'click', () => switchTab('parcours'));
  on(el.tabTools, 'click', () => switchTab('tools'));
  on(el.tabGames, 'click', () => switchTab('games'));
  on(el.tabBookmarks, 'click', () => switchTab('bookmarks'));

  // Parcours - click sur carte epic (délégation)
  delegate(document, 'click', '.epic-card', (card) => {
    const epicId = card.dataset.epicId;
    openEpic(epicId);
  });

  // Parcours - click sur filtre de catégorie (délégation)
  delegate(el.parcoursCategoryFilters, 'click', '.filter', (btn) => {
    const categoryId = btn.dataset.category || null;
    selectParcoursCategory(categoryId);
  });

  // Catalogue - filtres (délégation)
  delegate(el.filters, 'click', '.filter', (btn) => {
    setState({ activeFilter: btn.dataset.tag });
    if (state.activeTab === 'parcours') {
      renderParcours();
    } else {
      renderCatalogue();
    }
  });

  // Bookmarks - filtres (délégation)
  delegate(el.bookmarkFilters, 'click', '.filter', (btn) => {
    selectBookmarkTag(btn.dataset.tag || null);
  });

  // Bookmarks - preview au survol (délégation)
  if (el.bookmarkTree) {
    el.bookmarkTree.addEventListener('mouseenter', (e) => {
      const link = e.target.closest('.bookmark-item a[data-bookmark]');
      if (link && link.dataset.bookmark) {
        try {
          const bookmarkData = JSON.parse(link.dataset.bookmark);
          showBookmarkPreview(bookmarkData, link);
        } catch {
          // Ignorer les erreurs de parsing
        }
      }
    }, true);

    el.bookmarkTree.addEventListener('mouseleave', (e) => {
      const link = e.target.closest('.bookmark-item a[data-bookmark]');
      if (link) {
        hideBookmarkPreview();
      }
    }, true);
  }

  // Catalogue - recherche
  on(el.search, 'input', debounce(() => {
    if (state.activeTab === 'parcours') {
      renderParcours();
    } else if (state.activeTab === 'bookmarks') {
      renderBookmarks();
    } else {
      renderCatalogue();
    }
  }, 200));

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
      switchTab('parcours');
    }

    if (e.key === '2' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('tools');
    }

    if (e.key === '3' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('games');
    }

    if (e.key === '4' && state.currentView === 'catalogue' && document.activeElement.tagName !== 'INPUT') {
      switchTab('bookmarks');
    }

    // Retour à l'accueil parcours (Backspace quand en mode catégorie)
    if (e.key === 'Backspace' && state.activeTab === 'parcours' && state.parcoursCategory && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      selectParcoursCategory(null);
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

// === Hash Routing ===

/**
 * Gère le routage basé sur le hash URL
 */
function handleHashRoute() {
  const hash = window.location.hash;

  // Route parcours: #/parcours/{epicId}/{slideId}
  const parcoursMatch = hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);
  if (parcoursMatch) {
    const [, epicId, slideId] = parcoursMatch;
    openEpic(epicId, slideId);
    return;
  }

  // Pas de route spéciale, afficher le catalogue
  if (state.currentView === 'parcours') {
    closeParcours();
  }
}

// === Initialisation ===

async function init() {
  loadPreferences();
  updateSoundButton();
  updateTabUI();
  setupEventListeners();

  // Charger les catalogues en parallèle
  await Promise.all([
    loadCatalogue(),
    loadParcoursCatalogue(),
    loadBookmarksCatalogue(),
  ]);

  // Si l'onglet actif est parcours, rendre les parcours
  if (state.activeTab === 'parcours') {
    renderParcours();
  }

  // Si l'onglet actif est bookmarks, rendre les bookmarks
  if (state.activeTab === 'bookmarks') {
    renderBookmarks();
  }

  // Gérer le hash initial
  if (window.location.hash) {
    handleHashRoute();
  }

  // Écouter les changements de hash
  window.addEventListener('hashchange', handleHashRoute);
}

init();
