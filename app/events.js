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

import { switchTab, registerRenderCallbacks } from './tabs.js';
import { renderCatalogue } from './catalogue.js';
import { renderParcours, openEpic, selectParcoursCategory } from './parcours.js';
import { renderBookmarks, selectBookmarkTag, showBookmarkPreview, hideBookmarkPreview } from './bookmarks.js';
import { unloadGame, toggleFullscreen, toggleSound } from './game-loader.js';
import { showSettings, hideSettings, setSoundPreference, setThemePreference, clearAllData } from './settings.js';

/**
 * Configure tous les event listeners de l'application
 */
export function setupEventListeners() {
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

  // === Parcours - click sur carte epic (délégation) ===
  delegate(document, 'click', '.epic-card', (card) => {
    const epicId = card.dataset.epicId;
    openEpic(epicId);
  });

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

  // === Bookmarks - preview au survol (délégation) ===
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

  // === Catalogue - recherche ===
  on(el.search, 'input', debounce(() => {
    if (state.activeTab === 'parcours') {
      renderParcours();
    } else if (state.activeTab === 'bookmarks') {
      renderBookmarks();
    } else {
      renderCatalogue();
    }
  }, 200));

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

  // === Messages du jeu ===
  on(window, 'message', (e) => {
    if (!e.data || !e.data.type) { return; }

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
