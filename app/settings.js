/**
 * Gestion des paramètres utilisateur
 * @module app/settings
 *
 * Affichage et modification des préférences.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { loadPreferences, savePreferences } from './storage.js';
import { updateSoundButton } from './game-loader.js';
import { getTheme, setTheme, syncTheme, THEMES } from '../lib/theme.js';
import { clearLocalData } from '../lib/local-data.js';
import { updateTabUI } from './tabs.js';
import { renderParcours } from './parcours.js';

let returnFocus = null;

/**
 * Affiche la vue des paramètres
 */
export function showSettings() {
  returnFocus = document.activeElement;
  setState({ currentView: 'settings' });
  el.viewCatalogue.classList.remove('active');
  el.viewGame.classList.remove('active');
  el.viewSettings.classList.add('active');

  el.inputPseudo.value = state.preferences.pseudo;
  updateSoundToggles();
  updateThemeToggles();
  el.inputPseudo.focus();
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
  if (returnFocus?.isConnected) {
    returnFocus.focus();
  }
}

/**
 * Met à jour les toggles son
 */
export function updateSoundToggles() {
  el.soundOn.classList.toggle('active', state.preferences.sound);
  el.soundOff.classList.toggle('active', !state.preferences.sound);
  el.soundOn.setAttribute('aria-pressed', String(state.preferences.sound));
  el.soundOff.setAttribute('aria-pressed', String(!state.preferences.sound));
}

/**
 * Met à jour les toggles thème
 */
export function updateThemeToggles() {
  const theme = getTheme();
  el.themeSystem.classList.toggle('active', theme === THEMES.SYSTEM);
  el.themeDark.classList.toggle('active', theme === THEMES.DARK);
  el.themeLight.classList.toggle('active', theme === THEMES.LIGHT);
  el.themeSystem.setAttribute('aria-pressed', String(theme === THEMES.SYSTEM));
  el.themeDark.setAttribute('aria-pressed', String(theme === THEMES.DARK));
  el.themeLight.setAttribute('aria-pressed', String(theme === THEMES.LIGHT));
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
 * Efface les données gérées, sans modifier les outils exclus.
 * Une relecture échouée conserve l'état affiché et demande un rechargement.
 */
export function clearAllData() {
  if (state.currentGame) {
    alert('Fermez le jeu ou l’outil ouvert avant de réinitialiser les données.');
    return;
  }
  if (!confirm('Fermez les autres onglets et jeux. Effacer les données compatibles (scores, progressions, préférences) ? Neural Style, Relativity et les données étrangères seront conservés.')) {
    return;
  }
  try {
    clearLocalData();
  } catch (error) {
    console.warn('Erreur réinitialisation données:', error);
    alert(`Réinitialisation impossible : ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const previousState = {
    preferences: state.preferences,
    recentGames: state.recentGames,
    activeTab: state.activeTab,
  };
  setState({
    preferences: { sound: true, pseudo: 'Anonyme' },
    recentGames: [],
    activeTab: 'parcours',
  });
  if (!loadPreferences()) {
    setState(previousState);
    alert('Données effacées, mais leur relecture a échoué. Rechargez le portail et vérifiez vos données.');
    return;
  }
  syncTheme();

  el.inputPseudo.value = 'Anonyme';
  updateSoundToggles();
  updateSoundButton();
  updateThemeToggles();
  updateTabUI();
  renderParcours();

  alert('Données compatibles effacées. Les données des outils exclus ont été conservées.');
}
