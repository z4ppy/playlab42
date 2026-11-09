/**
 * Web Worker de l'IA : la recherche (jusqu'à une seconde de calcul) tourne
 * ici, hors du fil principal, pour que l'interface reste fluide.
 * Toute la logique est dans protocol.js, testée sans navigateur.
 */

import { handleAiRequest } from './protocol.js';

self.addEventListener('message', (event) => {
  self.postMessage(handleAiRequest(event.data));
});
