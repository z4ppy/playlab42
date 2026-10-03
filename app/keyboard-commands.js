/**
 * Commandes clavier du portail.
 * Le focus natif et les pièges de focus locaux ne sont pas pilotés ici.
 * @module app/keyboard-commands
 */
import { state } from './state.js';
import { el } from './dom-cache.js';
import { isEditableTarget } from '../lib/dom.js';
import { switchTab } from './tabs.js';
import { selectParcoursCategory } from './parcours.js';
import { unloadGame, toggleFullscreen, toggleSound } from './game-loader.js';
import { hideSettings } from './settings.js';

function ignoresShortcut(event) {
  return event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target);
}

function closeCurrentView() {
  if (state.currentView === 'game') {
    unloadGame();
  } else if (state.currentView === 'settings') {
    hideSettings();
  }
}

function dispatchGameCommand(key) {
  switch (key) {
    case 'f': toggleFullscreen(); break;
    case 'm': toggleSound(); break;
  }
}

function dispatchCatalogueCommand(event) {
  switch (event.key) {
    case '/':
      event.preventDefault();
      el.search.focus();
      break;
    case '1': switchTab('parcours'); break;
    case '2': switchTab('tools'); break;
    case '3': switchTab('games'); break;
    case '4': switchTab('bookmarks'); break;
    case 'Backspace':
      if (state.activeTab === 'parcours' && state.parcoursCategory) {
        event.preventDefault();
        selectParcoursCategory(null);
      }
      break;
  }
}

/**
 * Applique les commandes de la vue courante sans intercepter la saisie ou Tab.
 * Échap ferme explicitement la vue, même depuis une saisie avec modificateur ;
 * un événement déjà consommé par un composant reste toujours prioritaire.
 * @param {KeyboardEvent} event - Événement clavier
 */
export function handlePortalKeydown(event) {
  if (event.defaultPrevented) { return; }
  if (event.key === 'Escape') {
    closeCurrentView();
    return;
  }
  if (ignoresShortcut(event)) { return; }

  switch (state.currentView) {
    case 'game': dispatchGameCommand(event.key); break;
    case 'catalogue': dispatchCatalogueCommand(event); break;
  }
}
