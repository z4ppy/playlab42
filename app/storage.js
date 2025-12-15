/**
 * Gestion du stockage local (localStorage)
 */

import { state, setState } from './state.js';

/**
 * Clés de stockage dans localStorage
 */
export const STORAGE_KEYS = {
  PLAYER: 'player',
  PREFERENCES: 'preferences',
  RECENT: 'recent_games',
  ACTIVE_TAB: 'playlab42.activeTab',
};

/**
 * Nombre maximum de jeux récents à conserver dans l'historique.
 * Limité à 5 pour éviter de surcharger l'UI et le localStorage.
 * @const {number}
 */
const MAX_RECENT = 5;

/**
 * Charge les préférences depuis localStorage
 */
export function loadPreferences() {
  try {
    const player = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (player) {
      const parsed = JSON.parse(player);
      state.preferences.pseudo = parsed.name || 'Anonyme';
    }

    const prefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      state.preferences.sound = parsed.sound !== false;
    }

    const recent = localStorage.getItem(STORAGE_KEYS.RECENT);
    if (recent) {
      state.recentGames = JSON.parse(recent);
    }

    const activeTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (activeTab === 'tools' || activeTab === 'games' || activeTab === 'parcours' || activeTab === 'bookmarks') {
      setState({ activeTab });
    }
  } catch (e) {
    console.warn('Erreur chargement préférences:', e);
  }
}

/**
 * Sauvegarde les préférences dans localStorage
 */
export function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify({ name: state.preferences.pseudo }));
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ sound: state.preferences.sound }));
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(state.recentGames));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, state.activeTab);
  } catch (e) {
    console.warn('Erreur sauvegarde préférences:', e);
  }
}

/**
 * Ajoute un jeu/outil aux récents
 * @param {string} id - ID de l'élément
 * @param {string} type - Type ('game' ou 'tool')
 */
export function addToRecent(id, type) {
  state.recentGames = state.recentGames.filter(r => r.id !== id);
  state.recentGames.unshift({ id, type, timestamp: Date.now() });
  state.recentGames = state.recentGames.slice(0, MAX_RECENT);
  savePreferences();
}
