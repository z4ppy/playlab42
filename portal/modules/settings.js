/**
 * Gestion des paramètres utilisateur
 * @module app/settings
 *
 * Affichage et modification des préférences.
 */

import { state, setState, STORAGE_KEYS } from './state.js';
import { el } from './dom-cache.js';
import { savePreferences } from './storage.js';
import { updateSoundButton } from './game-loader.js';
import { getTheme, setTheme, THEMES } from '../../lib/theme.js';

/**
 * Affiche la vue des paramètres
 */
export function showSettings() {
  setState({ currentView: 'settings' });
  el.viewCatalogue.classList.remove('active');
  el.viewGame.classList.remove('active');
  el.viewSettings.classList.add('active');

  el.inputPseudo.value = state.preferences.pseudo;
  updateSoundToggles();
  updateThemeToggles();
}

/**
 * Cache les paramètres et retourne au catalogue
 */
export function hideSettings() {
  const newPseudo = el.inputPseudo.value.trim() || 'Anonyme';
  state.preferences.pseudo = newPseudo;
  savePreferences();

  setState({ currentView: 'catalogue' });
  el.viewSettings.classList.remove('active');
  el.viewCatalogue.classList.add('active');
}

/**
 * Met à jour les toggles son
 */
export function updateSoundToggles() {
  el.soundOn.classList.toggle('active', state.preferences.sound);
  el.soundOff.classList.toggle('active', !state.preferences.sound);
}

/**
 * Met à jour les toggles thème
 */
export function updateThemeToggles() {
  const theme = getTheme();
  el.themeSystem.classList.toggle('active', theme === THEMES.SYSTEM);
  el.themeDark.classList.toggle('active', theme === THEMES.DARK);
  el.themeLight.classList.toggle('active', theme === THEMES.LIGHT);
}

/**
 * Définit la préférence son
 * @param {boolean} enabled - Son activé ou non
 */
export function setSoundPreference(enabled) {
  state.preferences.sound = enabled;
  updateSoundToggles();
  updateSoundButton();
  savePreferences();
}

/**
 * Définit la préférence thème
 * @param {string} theme - Thème choisi
 */
export function setThemePreference(theme) {
  setTheme(theme);
  updateThemeToggles();
}

/**
 * Efface toutes les données utilisateur
 */
export function clearAllData() {
  if (!confirm('Effacer toutes les données (scores, progression, préférences) ?')) {
    return;
  }

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('scores_') || key.startsWith('progress_') ||
        key === STORAGE_KEYS.PLAYER || key === STORAGE_KEYS.PREFERENCES ||
        key === STORAGE_KEYS.RECENT) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  state.preferences = { sound: true, pseudo: 'Anonyme' };
  state.recentGames = [];

  el.inputPseudo.value = 'Anonyme';
  updateSoundToggles();

  alert('Données effacées');
}
