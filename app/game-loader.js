/**
 * Chargement et contrôle des jeux/outils
 * @module app/game-loader
 *
 * Gestion de l'iframe, fullscreen et son.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { addToRecent, savePreferences } from './storage.js';

let returnFocus = null;
let navigationId = 0;
let pendingNavigation = false;
let loadTimeout = null;
let unloadTimeout = null;
let iframeSession = null;

// Une intention plus récente annule les HEAD et la fermeture différée précédents.
function beginNavigation() {
  clearTimeout(unloadTimeout);
  pendingNavigation = false;
  return ++navigationId;
}

function setLoadingText(text) {
  const label = el.loading.querySelector('p') || el.loading;
  label.textContent = text;
}

/**
 * Indique si la session affichée peut encore piloter le portail.
 * Un HEAD suivant la suspend ; unload l'invalide immédiatement.
 * @param {boolean} [allowPendingNavigation=false] - Autoriser ready non destructif pendant un HEAD.
 * @returns {boolean}
 */
export function isCurrentGameSession(allowPendingNavigation = false) {
  return iframeSession !== null && iframeSession === state.currentGame &&
    (allowPendingNavigation || !pendingNavigation);
}

/**
 * Charge un jeu depuis son ID
 * Valide l'existence et synchronise le hash, uniquement si la demande est courante.
 * @param {string} gameId - ID du jeu
 */
export async function openGame(gameId) {
  const navigation = beginNavigation();
  // Ne pas recharger si le jeu est déjà ouvert
  if (isCurrentGameSession() && state.currentGame.id === gameId && state.currentView === 'game') {
    return;
  }

  const path = `games/${gameId}/index.html`;
  pendingNavigation = true;

  try {
    // Valider que le jeu existe avec une HEAD request
    const response = await fetch(path, { method: 'HEAD' });
    if (navigation !== navigationId) { return; }
    pendingNavigation = false;
    if (!response.ok) {
      console.error(`Jeu non trouvé: ${gameId}`);
      window.location.hash = '#/';
      return;
    }

    // Charger le jeu (le nom sera trouvé dans le catalogue ou utilisé comme fallback)
    const name = state.catalogue?.games.find(game => game.id === gameId)?.name || gameId;
    renderGame(path, name, 'game', gameId);

    // Synchroniser le hash
    window.location.hash = `#/games/${gameId}`;

  } catch (error) {
    if (navigation !== navigationId) { return; }
    pendingNavigation = false;
    console.error(`Erreur chargement jeu ${gameId}:`, error);
    window.location.hash = '#/';
  }
}

/**
 * Charge un outil depuis son ID
 * Valide l'existence et synchronise le hash
 * Les outils peuvent être:
 * - Simples: tools/{id}.html
 * - Complexes: tools/{id}/index.html
 * Une demande remplacée ne poursuit pas le repli et ne modifie pas le portail.
 * @param {string} toolId - ID de l'outil
 */
export async function openTool(toolId) {
  const navigation = beginNavigation();
  // Ne pas recharger si l'outil est déjà ouvert
  if (isCurrentGameSession() && state.currentGame.id === toolId && state.currentView === 'game') {
    return;
  }

  const tool = state.catalogue?.tools.find(item => item.id === toolId);
  // Le catalogue evite une requete 404 pour les outils au format fichier.
  const paths = tool?.path ? [tool.path] : [
    `tools/${toolId}/index.html`,
    `tools/${toolId}.html`,
  ];
  pendingNavigation = true;

  try {
    let validPath = null;

    for (const path of paths) {
      const response = await fetch(path, { method: 'HEAD' });
      if (navigation !== navigationId) { return; }
      if (response.ok) {
        validPath = path;
        break;
      }
    }
    pendingNavigation = false;

    if (!validPath) {
      console.error(`Outil non trouvé: ${toolId}`);
      window.location.hash = '#/';
      return;
    }

    // Charger l'outil
    const name = tool?.name || toolId;
    renderGame(validPath, name, 'tool', toolId);

    // Synchroniser le hash
    window.location.hash = `#/tools/${toolId}`;

  } catch (error) {
    if (navigation !== navigationId) { return; }
    pendingNavigation = false;
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
  beginNavigation();
  renderGame(path, name, type, id);
}

function renderGame(path, name, type, id) {
  clearTimeout(loadTimeout);
  const session = { path, name, type, id };
  iframeSession = session;
  // Le HEAD suivant suspend les callbacks ; resélectionner ce jeu les réautorise.
  const isCurrent = () => iframeSession === session && isCurrentGameSession();
  if (state.currentView !== 'game') {
    returnFocus = document.activeElement;
  }
  setState({
    currentGame: session,
    currentView: 'game',
  });

  el.viewCatalogue.classList.remove('active');
  el.viewSettings.classList.remove('active');
  el.viewGame.classList.add('active');
  document.body.classList.add('game-active');
  el.gameTitle.textContent = name;
  setLoadingText('Chargement...');
  el.loading.classList.remove('hidden');

  el.gameIframe.title = `${type === 'game' ? 'Jeu' : 'Outil'} : ${name}`;
  el.btnBack?.focus();
  addToRecent(id, type);

  loadTimeout = setTimeout(() => {
    if (!isCurrent()) { return; }
    setLoadingText('Chargement lent...');
  }, 5000);

  el.gameIframe.onload = () => {
    if (!isCurrent()) { return; }
    clearTimeout(loadTimeout);
    el.loading.classList.add('hidden');
  };

  el.gameIframe.onerror = () => {
    if (!isCurrent()) { return; }
    clearTimeout(loadTimeout);
    el.loading.classList.remove('hidden');
    setLoadingText('Erreur de chargement');
  };
  el.gameIframe.src = path;
}

/**
 * Décharge le jeu et retourne au catalogue
 */
export function unloadGame() {
  const navigation = beginNavigation();
  iframeSession = null;
  clearTimeout(loadTimeout);
  el.gameIframe.onload = null;
  el.gameIframe.onerror = null;
  if (el.gameIframe.contentWindow) {
    el.gameIframe.contentWindow.postMessage({ type: 'unload' }, '*');
  }

  unloadTimeout = setTimeout(() => {
    if (navigation !== navigationId) { return; }
    el.gameIframe.src = 'about:blank';
    setState({
      currentGame: null,
      currentView: 'catalogue',
    });

    el.viewGame.classList.remove('active');
    el.viewSettings.classList.remove('active');
    el.viewCatalogue.classList.add('active');
    document.body.classList.remove('fullscreen');
    el.btnFullscreen?.setAttribute('aria-pressed', 'false');
    el.btnFullscreen?.setAttribute('aria-label', 'Plein écran');
    document.body.classList.remove('game-active');

    // Synchroniser le hash vers le catalogue
    window.location.hash = '#/';
    if (returnFocus?.isConnected) {
      returnFocus.focus();
    }
  }, 100);
}

/**
 * Bascule le mode plein écran
 */
export function toggleFullscreen() {
  document.body.classList.toggle('fullscreen');
  const fullscreen = document.body.classList.contains('fullscreen');
  el.btnFullscreen.setAttribute('aria-pressed', String(fullscreen));
  el.btnFullscreen.setAttribute('aria-label', fullscreen ? 'Quitter le plein écran' : 'Plein écran');
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
  el.btnSound.setAttribute('aria-label', state.preferences.sound ? 'Désactiver le son' : 'Activer le son');
  el.btnSound.setAttribute('aria-pressed', String(state.preferences.sound));
}
