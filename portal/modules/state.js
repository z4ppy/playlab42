/**
 * État global de l'application Playlab42
 * @module app/state
 * @see openspec/specs/portal/spec.md
 */

// === Constantes ===

/**
 * Clés de stockage localStorage
 */
export const STORAGE_KEYS = {
  PLAYER: 'player',
  PREFERENCES: 'preferences',
  RECENT: 'recent_games',
  ACTIVE_TAB: 'playlab42.activeTab',
};

/**
 * Nombre maximum de jeux/outils récents à conserver
 */
export const MAX_RECENT = 5;

// === État de l'application ===

/**
 * État global partagé entre tous les modules
 * @type {Object}
 */
export const state = {
  /** Vue courante : 'catalogue', 'game', 'parcours', 'settings' */
  currentView: 'catalogue',

  /** Onglet actif : 'parcours', 'tools', 'games', 'bookmarks' */
  activeTab: 'parcours',

  /** Jeu/outil actuellement chargé */
  currentGame: null,

  /** Catalogue des jeux et outils */
  catalogue: null,

  /** Catalogue des parcours */
  parcoursCatalogue: null,

  /** Catégorie sélectionnée pour filtrer les parcours */
  parcoursCategory: null,

  /** Instance du viewer de parcours */
  parcoursViewer: null,

  /** Catalogue des bookmarks */
  bookmarksCatalogue: null,

  /** Tag actif pour filtrer les bookmarks */
  bookmarkTagFilter: null,

  /** Préférences utilisateur */
  preferences: {
    sound: true,
    pseudo: 'Anonyme',
  },

  /** Historique des jeux/outils récents */
  recentGames: [],

  /** Filtre de tag actif (catalogue) */
  activeFilter: '',
};

// === Fonctions de mutation ===

/**
 * Met à jour l'état global
 * @param {Object} updates - Propriétés à mettre à jour
 */
export function setState(updates) {
  Object.assign(state, updates);
}
