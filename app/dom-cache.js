/**
 * Cache des éléments DOM pour éviter les querySelector répétés
 */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/**
 * Éléments DOM cachés
 */
export const el = {
  // Views
  viewCatalogue: $('#view-catalogue'),
  viewGame: $('#view-game'),
  viewParcours: $('#view-parcours'),

  // Tabs
  tabs: $$('.tab-btn'),
  tabContents: $$('.tab-content'),

  // Catalogue
  catalogueContainer: $('#catalogue-container'),
  catalogueGrid: $('#catalogue-grid'),
  filters: $('#filters'),
  search: $('#search'),

  // Parcours
  parcoursContainer: $('#parcours-container'),
  parcoursCategoryFilters: $('#parcours-category-filters'),
  parcoursGrid: $('#parcours-grid'),

  // Bookmarks
  bookmarksContainer: $('#bookmarks-container'),
  bookmarkTagFilters: $('#bookmark-tag-filters'),
  bookmarksGrid: $('#bookmarks-grid'),
  bookmarkPreview: $('#bookmark-preview'),

  // Game view
  gameFrame: $('#game-frame'),
  gameTitle: $('#game-title'),
  gameInfo: $('#game-info'),
  btnBack: $('#btn-back'),
  btnFullscreen: $('#btn-fullscreen'),
  btnSound: $('#btn-sound'),
  btnSettings: $('#btn-settings'),

  // Settings modal
  settingsModal: $('#settings-modal'),
  btnCloseSettings: $('#btn-close-settings'),
  pseudoInput: $('#pseudo-input'),
  btnSavePseudo: $('#btn-save-pseudo'),
};
