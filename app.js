/**
 * Playlab42 - Point d'entrée de l'application
 * @module app
 * @see openspec/specs/portal/spec.md
 *
 * Ce fichier orchestre l'initialisation de l'application.
 * La logique métier est répartie dans les modules du dossier app/.
 */

import { state } from './app/state.js';
import { loadPreferences } from './app/storage.js';
import { updateTabUI } from './app/tabs.js';
import { setupEventListeners } from './app/events.js';
import { loadCatalogue } from './app/catalogue.js';
import { loadParcoursCatalogue, renderParcours } from './app/parcours.js';
import { loadBookmarksCatalogue, renderBookmarks } from './app/bookmarks.js';
import { updateSoundButton } from './app/game-loader.js';
import { initRouter } from './app/router.js';
import { initBrand } from './app/brand.js';

/**
 * Initialise l'application
 */
async function init() {
  // Animations d'identité : décoratives, lancées avant le chargement des catalogues
  initBrand();

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
