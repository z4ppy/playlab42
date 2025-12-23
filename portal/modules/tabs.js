/**
 * Gestion des onglets du catalogue
 * @module app/tabs
 *
 * Contrôle le changement d'onglet et la mise à jour de l'interface.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { savePreferences } from './storage.js';

// Imports différés pour éviter les dépendances circulaires
// Ces fonctions seront injectées depuis events.js
let renderCatalogueCallback = null;
let renderParcoursCallback = null;
let renderBookmarksCallback = null;

/**
 * Enregistre les callbacks de rendu
 * @param {Object} callbacks - Fonctions de rendu
 */
export function registerRenderCallbacks(callbacks) {
  renderCatalogueCallback = callbacks.renderCatalogue;
  renderParcoursCallback = callbacks.renderParcours;
  renderBookmarksCallback = callbacks.renderBookmarks;
}

/**
 * Change l'onglet actif
 * @param {string} tab - Onglet cible ('tools', 'games', 'parcours', 'bookmarks')
 */
export function switchTab(tab) {
  if (tab !== 'tools' && tab !== 'games' && tab !== 'parcours' && tab !== 'bookmarks') { return; }
  if (state.activeTab === tab) { return; }

  setState({
    activeTab: tab,
    activeFilter: '',
    parcoursCategory: null,
    bookmarkTagFilter: null,
  });

  savePreferences();
  updateTabUI();

  // Rendu de l'onglet actif
  if (tab === 'parcours' && renderParcoursCallback) {
    renderParcoursCallback();
  } else if (tab === 'bookmarks' && renderBookmarksCallback) {
    renderBookmarksCallback();
  } else if (renderCatalogueCallback) {
    renderCatalogueCallback();
  }
}

/**
 * Met à jour l'interface des onglets
 */
export function updateTabUI() {
  // Classes et aria des onglets
  el.tabParcours.classList.toggle('active', state.activeTab === 'parcours');
  el.tabParcours.setAttribute('aria-selected', state.activeTab === 'parcours');
  el.tabTools.classList.toggle('active', state.activeTab === 'tools');
  el.tabTools.setAttribute('aria-selected', state.activeTab === 'tools');
  el.tabGames.classList.toggle('active', state.activeTab === 'games');
  el.tabGames.setAttribute('aria-selected', state.activeTab === 'games');
  el.tabBookmarks.classList.toggle('active', state.activeTab === 'bookmarks');
  el.tabBookmarks.setAttribute('aria-selected', state.activeTab === 'bookmarks');

  // Panels
  el.panelParcours.classList.toggle('active', state.activeTab === 'parcours');
  el.panelTools.classList.toggle('active', state.activeTab === 'tools');
  el.panelGames.classList.toggle('active', state.activeTab === 'games');
  el.panelBookmarks.classList.toggle('active', state.activeTab === 'bookmarks');

  // Masquer les filtres globaux sur Parcours et Bookmarks (ils ont leurs propres filtres)
  const hideFilters = state.activeTab === 'parcours' || state.activeTab === 'bookmarks';
  el.filters.style.display = hideFilters ? 'none' : 'flex';
}
