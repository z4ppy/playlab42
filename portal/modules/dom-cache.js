/**
 * Cache des éléments DOM de l'application
 * @module app/dom-cache
 *
 * Centralise l'accès aux éléments DOM pour éviter les requêtes répétées.
 * Les éléments sont mis en cache au chargement du module.
 */

import { $ } from '../../lib/dom.js';

/**
 * Cache des éléments DOM de l'application
 * @type {Object}
 */
export const el = {
  // === Views ===
  viewCatalogue: $('#view-catalogue'),
  viewGame: $('#view-game'),
  viewParcours: $('#view-parcours'),
  viewSettings: $('#view-settings'),

  // === Catalogue ===
  search: $('#search'),
  filters: $('#filters'),
  cardsGames: $('#cards-games'),
  cardsTools: $('#cards-tools'),
  emptyGames: $('#empty-games'),
  emptyTools: $('#empty-tools'),

  // === Tabs ===
  tabParcours: $('#tab-parcours'),
  tabTools: $('#tab-tools'),
  tabGames: $('#tab-games'),
  tabBookmarks: $('#tab-bookmarks'),
  panelParcours: $('#panel-parcours'),
  panelTools: $('#panel-tools'),
  panelGames: $('#panel-games'),
  panelBookmarks: $('#panel-bookmarks'),

  // === Bookmarks ===
  bookmarkFilters: $('#bookmark-filters'),
  bookmarkTree: $('#bookmark-tree'),
  emptyBookmarks: $('#empty-bookmarks'),
  bookmarkPreview: $('#bookmark-preview'),

  // === Parcours ===
  parcoursCategoryFilters: $('#parcours-category-filters'),
  parcoursCategoriesExpanded: $('#parcours-categories-expanded'),
  parcoursList: $('#parcours-list'),
  cardsParcours: $('#cards-parcours'),
  emptyParcours: $('#empty-parcours'),

  // === Game ===
  gameTitle: $('#game-title'),
  gameIframe: $('#game-iframe'),
  loading: $('#loading'),
  btnBack: $('#btn-back'),
  btnFullscreen: $('#btn-fullscreen'),
  btnSound: $('#btn-sound'),

  // === Settings ===
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
