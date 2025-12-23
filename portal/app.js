/**
 * Playlab42 - Point d'entrée de l'application
 * @module app
 * @see openspec/specs/portal/spec.md
 *
 * Ce fichier orchestre l'initialisation de l'application.
 * La logique métier est répartie dans les modules du dossier modules/.
 */

import { state } from './modules/state.js';
import { loadPreferences } from './modules/storage.js';
import { updateTabUI } from './modules/tabs.js';
import { setupEventListeners } from './modules/events.js';
import { loadCatalogue } from './modules/catalogue.js';
import { loadParcoursCatalogue, renderParcours } from './modules/parcours.js';
import { loadBookmarksCatalogue, renderBookmarks } from './modules/bookmarks.js';
import { updateSoundButton } from './modules/game-loader.js';
import { initRouter } from './modules/router.js';

/**
 * Initialise l'application
 */
async function init() {
  // Charger les préférences utilisateur
  loadPreferences();

  // Initialiser l'interface
  updateSoundButton();
  updateTabUI();

  // Configurer les event listeners
  setupEventListeners();

  // Charger les catalogues en parallèle
  await Promise.all([
    loadCatalogue(),
    loadParcoursCatalogue(),
    loadBookmarksCatalogue(),
  ]);

  // Rendre l'onglet actif
  if (state.activeTab === 'parcours') {
    renderParcours();
  }

  if (state.activeTab === 'bookmarks') {
    renderBookmarks();
  }

  // Initialiser le routeur
  initRouter();
}

init();
