/**
 * Attribution et traitement des messages de l'iframe courante.
 * @module app/game-messages
 */
import { state } from './state.js';
import { el } from './dom-cache.js';
import { isCurrentGameSession, unloadGame } from './game-loader.js';

function isMessageData(data) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data) &&
    typeof data.type === 'string';
}

function isCurrentSource(event) {
  return isCurrentGameSession(event.data.type === 'ready') && Boolean(event.source) &&
    event.source === el.gameIframe?.contentWindow && event.origin === window.location.origin;
}

function belongsToCurrentGame(data) {
  // Le WindowProxy peut survivre à une navigation ; le slug distingue les jeux.
  // Les anciens messages sans slug restent acceptés depuis l'iframe courante.
  return data.game === undefined || data.game === state.currentGame.id;
}

/**
 * Accepte uniquement les messages attribuables à la session affichée.
 * ready reste non destructif pendant un HEAD, contrairement à quit.
 * @param {MessageEvent} event - Message reçu du contenu embarqué
 */
export function handleGameMessage(event) {
  if (!isMessageData(event.data) || !isCurrentSource(event) ||
      !belongsToCurrentGame(event.data)) { return; }

  switch (event.data.type) {
    case 'ready':
      console.log(`[Portal] Jeu prêt: ${event.data.game}`);
      event.source.postMessage({
        type: 'preference',
        key: 'sound',
        value: state.preferences.sound,
      }, window.location.origin);
      break;
    case 'score':
      console.log(`[Portal] Score: ${event.data.score}`);
      break;
    case 'quit':
      unloadGame();
      break;
    case 'error':
      console.error('[Portal] Erreur jeu:', event.data.error);
      break;
  }
}
