/**
 * Configuration des event listeners
 * @module app/events
 *
 * Centralise la configuration de tous les handlers d'événements.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { on, delegate, debounce, isEditableTarget } from '../lib/dom.js';
import { THEMES } from '../lib/theme.js';
import { updateDiscoveryControls } from '../lib/catalogue-ui.js';

import { switchTab, registerRenderCallbacks, handleTabKeydown } from './tabs.js';
import { renderCatalogue } from './catalogue.js';
import { renderParcours, selectParcoursCategory } from './parcours.js';
import { renderBookmarks, selectBookmarkTag } from './bookmarks.js';
import { unloadGame, toggleFullscreen, toggleSound, isCurrentGameSession } from './game-loader.js';
import { showSettings, hideSettings, setSoundPreference, setThemePreference, clearAllData } from './settings.js';

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
  on(window, 'message', (e) => {
    if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data) ||
        typeof e.data.type !== 'string') { return; }
    if (!isCurrentGameSession(e.data.type === 'ready') || !e.source ||
        e.source !== el.gameIframe?.contentWindow ||
        e.origin !== window.location.origin) { return; }
    // Le WindowProxy peut survivre à une navigation ; le slug distingue alors les jeux.
    // Les anciens messages sans slug restent acceptés depuis l'iframe courante.
    if (e.data.game !== undefined && e.data.game !== state.currentGame.id) { return; }

    switch (e.data.type) {
      case 'ready':
        console.log(`[Portal] Jeu prêt: ${e.data.game}`);
        e.source.postMessage({
          type: 'preference',
          key: 'sound',
          value: state.preferences.sound,
        }, window.location.origin);
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

/**
 * Applique les raccourcis sans intercepter les contrôles de saisie.
 * @param {KeyboardEvent} e - Événement clavier
 */
export function handlePortalKeydown(e) {
  if (e.defaultPrevented) { return; }
  if (e.key === 'Escape') {
    if (state.currentView === 'game') {
      unloadGame();
    } else if (state.currentView === 'settings') {
      hideSettings();
    }
  }

  if (e.altKey || e.ctrlKey || e.metaKey || isEditableTarget(e.target)) { return; }

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

  if (e.key === '1' && state.currentView === 'catalogue') {
    switchTab('parcours');
  }

  if (e.key === '2' && state.currentView === 'catalogue') {
    switchTab('tools');
  }

  if (e.key === '3' && state.currentView === 'catalogue') {
    switchTab('games');
  }

  if (e.key === '4' && state.currentView === 'catalogue') {
    switchTab('bookmarks');
  }

  // Retour à l'accueil parcours (Backspace quand en mode catégorie)
  if (e.key === 'Backspace' && state.currentView === 'catalogue' && state.activeTab === 'parcours' && state.parcoursCategory) {
    e.preventDefault();
    selectParcoursCategory(null);
  }
}
