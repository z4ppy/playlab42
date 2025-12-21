/**
 * Gestion de la persistence localStorage
 * @module app/storage
 *
 * Fonctions de lecture/écriture des préférences et données utilisateur.
 */

import { state, STORAGE_KEYS, MAX_RECENT } from './state.js';

/**
 * Charge les préférences depuis localStorage
 */
export function loadPreferences() {
  try {
    // Pseudo joueur
    const player = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (player) {
      const parsed = JSON.parse(player);
      state.preferences.pseudo = parsed.name || 'Anonyme';
    }

    // Préférences son
    const prefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      state.preferences.sound = parsed.sound !== false;
    }

    // Historique récents
    const recent = localStorage.getItem(STORAGE_KEYS.RECENT);
    if (recent) {
      state.recentGames = JSON.parse(recent);
    }

    // Onglet actif
    const activeTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (activeTab === 'tools' || activeTab === 'games' || activeTab === 'parcours' || activeTab === 'bookmarks') {
      state.activeTab = activeTab;
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
 * Récupère la progression d'un epic depuis localStorage
 * @param {string} epicId - ID de l'epic
 * @returns {Object} Progression avec visited[] et current
 */
export function getEpicProgress(epicId) {
  try {
    const key = 'parcours-progress';
    const data = localStorage.getItem(key);
    if (!data) { return { visited: [], current: null }; }
    const progress = JSON.parse(data);
    return progress[epicId] || { visited: [], current: null };
  } catch {
    return { visited: [], current: null };
  }
}

/**
 * Ajoute un jeu/outil à l'historique des récents
 * @param {string} id - ID du jeu/outil
 * @param {string} type - Type ('game' ou 'tool')
 */
export function addToRecent(id, type) {
  // Retirer l'entrée existante si présente
  state.recentGames = state.recentGames.filter(r => r.id !== id);

  // Ajouter en tête
  state.recentGames.unshift({ id, type, timestamp: Date.now() });

  // Limiter la taille
  state.recentGames = state.recentGames.slice(0, MAX_RECENT);

  savePreferences();
}
