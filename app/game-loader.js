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
 * @returns {Promise<void>} - Résolution après validation de la demande
 */
export function openGame(gameId) {
  return openResource(gameId, 'game', describeGame);
}

function describeGame(id) {
  return {
    paths: [`games/${id}/index.html`],
    // Le catalogue des jeux peut arriver pendant le HEAD.
    getName: () => state.catalogue?.games.find(game => game.id === id)?.name || id,
  };
}

/**
 * Charge un outil depuis son ID
 * Valide l'existence et synchronise le hash
 * Les outils peuvent être:
 * - Simples: tools/{id}.html
 * - Complexes: tools/{id}/index.html
 * Une demande remplacée ne poursuit pas le repli et ne modifie pas le portail.
 * @param {string} toolId - ID de l'outil
 * @returns {Promise<void>} - Résolution après validation de la demande
 */
export function openTool(toolId) {
  return openResource(toolId, 'tool', describeTool);
}

function describeTool(id) {
  const tool = state.catalogue?.tools.find(item => item.id === id);
  return {
    // Le catalogue évite une requête 404 pour les outils au format fichier.
    paths: tool?.path ? [tool.path] : [`tools/${id}/index.html`, `tools/${id}.html`],
    getName: () => tool?.name || id,
  };
}

function isAlreadyDisplayed(id) {
  return isCurrentGameSession() && state.currentGame.id === id && state.currentView === 'game';
}

async function findExistingPath(paths, navigation) {
  for (const path of paths) {
    const response = await fetch(path, { method: 'HEAD' });
    if (navigation !== navigationId) { return null; }
    if (response.ok) { return path; }
  }
  return null;
}

async function openResource(id, type, describe) {
  const navigation = beginNavigation();
  if (isAlreadyDisplayed(id)) { return; }
  const { paths, getName } = describe(id);
  const label = type === 'game' ? 'Jeu' : 'Outil';
  pendingNavigation = true;

  try {
    const path = await findExistingPath(paths, navigation);
    if (navigation !== navigationId) { return; }
    pendingNavigation = false;
    if (!path) {
      console.error(`${label} non trouvé: ${id}`);
      window.location.hash = '#/';
      return;
    }

    renderGame(path, getName(), type, id);
    window.location.hash = `#/${type}s/${id}`;
  } catch (error) {
    if (navigation !== navigationId) { return; }
    pendingNavigation = false;
    console.error(`Erreur chargement ${label.toLowerCase()} ${id}:`, error);
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
