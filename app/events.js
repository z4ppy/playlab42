/**
 * Configuration des event listeners
 * @module app/events
 *
 * Centralise la configuration de tous les handlers d'événements.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { on, delegate, debounce } from '../lib/dom.js';
import { THEMES } from '../lib/theme.js';
import { updateDiscoveryControls } from '../lib/catalogue-ui.js';

import { switchTab, registerRenderCallbacks, handleTabKeydown } from './tabs.js';
import { renderCatalogue } from './catalogue.js';
import { renderParcours, selectParcoursCategory } from './parcours.js';
import { renderBookmarks, selectBookmarkTag } from './bookmarks.js';
import { unloadGame, toggleFullscreen, toggleSound } from './game-loader.js';
import { showSettings, hideSettings, setSoundPreference, setThemePreference, clearAllData } from './settings.js';
import { handlePortalKeydown } from './keyboard-commands.js';
import { handleGameMessage } from './game-messages.js';

export { handlePortalKeydown };

/**
 * Configure tous les event listeners de l'application
 */
export function setupEventListeners() {
  on(document.querySelector('.skip-link'), 'click', (event) => {
    event.preventDefault();
    document.querySelector('#main').focus();
  });
  // Enregistrer les callbacks de rendu pour tabs.js
  registerRenderCallbacks({
    renderCatalogue,
    renderParcours,
    renderBookmarks,
  });

  // === Catalogue - click sur carte (délégation via lien hash) ===
  // Les cards sont maintenant des liens avec href="#/games/:id" ou href="#/tools/:id"
  // Le routeur gère automatiquement le changement de hash via l'événement hashchange
  // Donc pas besoin de handler spécial ici - le navigateur fait le travail

  // === Catalogue - onglets ===
  on(el.tabParcours, 'click', () => switchTab('parcours'));
  on(el.tabTools, 'click', () => switchTab('tools'));
  on(el.tabGames, 'click', () => switchTab('games'));
  on(el.tabBookmarks, 'click', () => switchTab('bookmarks'));
  on(document.querySelector('.tabs'), 'keydown', handleTabKeydown);

  // === Parcours - click sur filtre de catégorie (délégation) ===
  delegate(el.parcoursCategoryFilters, 'click', '.filter', (btn) => {
    const categoryId = btn.dataset.category || null;
    selectParcoursCategory(categoryId);
  });

  // === Catalogue - filtres (délégation) ===
  delegate(el.filters, 'click', '.filter', (btn) => {
    setState({ activeFilter: btn.dataset.tag });
    if (state.activeTab === 'parcours') {
      renderParcours();
    } else {
      renderCatalogue();
    }
  });

  // === Bookmarks - filtres (délégation) ===
  delegate(el.bookmarkFilters, 'click', '.filter', (btn) => {
    selectBookmarkTag(btn.dataset.tag || null);
  });

  // === Catalogue - recherche ===
  const renderActiveCatalogue = () => {
    if (state.activeTab === 'parcours') {
      renderParcours();
    } else if (state.activeTab === 'bookmarks') {
      renderBookmarks();
    } else {
      renderCatalogue();
    }
    updateDiscoveryControls();
  };
  on(el.search, 'input', debounce(renderActiveCatalogue, 200));
  on(el.resetDiscovery, 'click', () => {
    el.search.value = '';
    setState({ activeFilter: '', parcoursCategory: null, bookmarkTagFilter: null });
    renderActiveCatalogue();
    el.search.focus();
  });

  // === Game - contrôles ===
  on(el.btnBack, 'click', unloadGame);
  on(el.btnFullscreen, 'click', toggleFullscreen);
  on(el.btnSound, 'click', toggleSound);

  // === Settings ===
  on(el.btnSettings, 'click', showSettings);
  on(el.btnCloseSettings, 'click', hideSettings);
  on(el.soundOn, 'click', () => setSoundPreference(true));
  on(el.soundOff, 'click', () => setSoundPreference(false));
  on(el.themeSystem, 'click', () => setThemePreference(THEMES.SYSTEM));
  on(el.themeDark, 'click', () => setThemePreference(THEMES.DARK));
  on(el.themeLight, 'click', () => setThemePreference(THEMES.LIGHT));
  on(el.btnClearData, 'click', clearAllData);

  // === Raccourcis clavier ===
  on(document, 'keydown', handlePortalKeydown);

  // === Messages du jeu ===
  on(window, 'message', handleGameMessage);
}
