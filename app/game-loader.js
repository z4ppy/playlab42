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
 * Charge un jeu depuis son ID
 * Valide l'existence et synchronise le hash
 * @param {string} gameId - ID du jeu
 */
export async function openGame(gameId) {
  // Ne pas recharger si le jeu est déjà ouvert
  if (state.currentGame?.id === gameId && state.currentView === 'game') {
    return;
  }

  const path = `games/${gameId}/index.html`;

  try {
    // Valider que le jeu existe avec une HEAD request
    const response = await fetch(path, { method: 'HEAD' });
    if (!response.ok) {
      console.error(`Jeu non trouvé: ${gameId}`);
      window.location.hash = '#/';
      return;
    }

    // Charger le jeu (le nom sera trouvé dans le catalogue ou utilisé comme fallback)
    loadGame(path, gameId, 'game', gameId);

    // Synchroniser le hash
    window.location.hash = `#/games/${gameId}`;

  } catch (error) {
    console.error(`Erreur chargement jeu ${gameId}:`, error);
    window.location.hash = '#/';
  }
}

/**
 * Charge un outil depuis son ID
 * Valide l'existence et synchronise le hash
 * @param {string} toolId - ID de l'outil
 */
export async function openTool(toolId) {
  // Ne pas recharger si l'outil est déjà ouvert
  if (state.currentGame?.id === toolId && state.currentView === 'game') {
    return;
  }

  const path = `tools/${toolId}/index.html`;

  try {
    // Valider que l'outil existe avec une HEAD request
    const response = await fetch(path, { method: 'HEAD' });
    if (!response.ok) {
      console.error(`Outil non trouvé: ${toolId}`);
      window.location.hash = '#/';
      return;
    }

    // Charger l'outil
    loadGame(path, toolId, 'tool', toolId);

    // Synchroniser le hash
    window.location.hash = `#/tools/${toolId}`;

  } catch (error) {
    console.error(`Erreur chargement outil ${toolId}:`, error);
    window.location.hash = '#/';
  }
}

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

    // Synchroniser le hash vers le catalogue
    window.location.hash = '#/';
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
