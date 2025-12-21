/**
 * Chargement et contrôle des jeux/outils
 * @module app/game-loader
 *
 * Gestion de l'iframe, fullscreen et son.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { addToRecent, savePreferences } from './storage.js';

/**
 * Charge un jeu/outil dans l'iframe
 * @param {string} path - Chemin vers le jeu/outil
 * @param {string} name - Nom à afficher
 * @param {string} type - Type ('game' ou 'tool')
 * @param {string} id - ID du jeu/outil
 */
export function loadGame(path, name, type, id) {
  setState({
    currentGame: { path, name, type, id },
    currentView: 'game',
  });

  el.viewCatalogue.classList.remove('active');
  el.viewSettings.classList.remove('active');
  el.viewGame.classList.add('active');
  document.body.classList.add('game-active');
  el.gameTitle.textContent = name;
  el.loading.classList.remove('hidden');

  el.gameIframe.src = path;
  addToRecent(id, type);

  const timeout = setTimeout(() => {
    el.loading.textContent = 'Chargement lent...';
  }, 5000);

  el.gameIframe.onload = () => {
    clearTimeout(timeout);
    el.loading.classList.add('hidden');
  };

  el.gameIframe.onerror = () => {
    clearTimeout(timeout);
    el.loading.textContent = 'Erreur de chargement';
  };
}

/**
 * Décharge le jeu et retourne au catalogue
 */
export function unloadGame() {
  if (el.gameIframe.contentWindow) {
    el.gameIframe.contentWindow.postMessage({ type: 'unload' }, '*');
  }

  setTimeout(() => {
    el.gameIframe.src = 'about:blank';
    setState({
      currentGame: null,
      currentView: 'catalogue',
    });

    el.viewGame.classList.remove('active');
    el.viewSettings.classList.remove('active');
    el.viewCatalogue.classList.add('active');
    document.body.classList.remove('fullscreen');
    document.body.classList.remove('game-active');
  }, 100);
}

/**
 * Bascule le mode plein écran
 */
export function toggleFullscreen() {
  document.body.classList.toggle('fullscreen');
}

/**
 * Bascule le son
 */
export function toggleSound() {
  state.preferences.sound = !state.preferences.sound;
  updateSoundButton();
  savePreferences();

  if (el.gameIframe.contentWindow) {
    el.gameIframe.contentWindow.postMessage({
      type: 'preference',
      key: 'sound',
      value: state.preferences.sound,
    }, '*');
  }
}

/**
 * Met à jour l'icône du bouton son
 */
export function updateSoundButton() {
  el.btnSound.textContent = state.preferences.sound ? '🔊' : '🔇';
}
