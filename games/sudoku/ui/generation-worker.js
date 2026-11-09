/**
 * Worker de génération : exécute `SudokuEngine.init` hors du fil principal.
 * Message reçu : {id, config} ; réponse : {id, state} ou {id, error}.
 */

import { SudokuEngine } from '../engine.js';

const engine = new SudokuEngine();

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ id: data.id, state: engine.init(data.config) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
});
