/**
 * Gestion de l'état global de l'application
 */

/**
 * État global de l'application
 */
export const state = {
  currentView: 'catalogue',
  activeTab: 'parcours',
  currentGame: null,
  catalogue: null,
  parcoursCatalogue: null,
  parcoursCategory: null, // Catégorie sélectionnée pour filtrer
  parcoursViewer: null, // Instance du viewer de parcours
  bookmarksCatalogue: null, // Catalogue des bookmarks
  bookmarkTagFilter: null, // Tag actif pour filtrer les bookmarks
  preferences: {
    sound: true,
    pseudo: 'Anonyme',
  },
  recentGames: [],
  activeFilter: '',
};

/**
 * Met à jour l'état global et déclenche un re-render si nécessaire
 * @param {object} updates - Objet contenant les propriétés à mettre à jour
 */
export function setState(updates) {
  Object.assign(state, updates);
}
