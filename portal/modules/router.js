/**
 * Routage basé sur le hash URL
 * @module app/router
 *
 * Gère les liens profonds vers les parcours.
 */

import { state } from './state.js';
import { openEpic, closeParcours } from './parcours.js';

/**
 * Gère le routage basé sur le hash URL
 */
export function handleHashRoute() {
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

/**
 * Initialise le listener de changement de hash
 */
export function initRouter() {
  // Gérer le hash initial
  if (window.location.hash) {
    handleHashRoute();
  }

  // Écouter les changements de hash
  window.addEventListener('hashchange', handleHashRoute);
}
