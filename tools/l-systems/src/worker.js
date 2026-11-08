/**
 * Worker de calcul : la réécriture et la tortue tournent hors du fil
 * principal, l'interface reste réactive même pour des millions de symboles.
 * Les tableaux de segments sont transférés (pas copiés) au fil principal.
 */

import { computeDrawing, describeError } from './compute.js';

self.addEventListener('message', (event) => {
  const { id, params } = event.data;
  try {
    const result = computeDrawing(params);
    self.postMessage({ id, ok: true, result }, [
      result.segments.buffer,
      result.depths.buffer,
      result.widths.buffer,
    ]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: describeError(error) });
  }
});
