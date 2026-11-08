/**
 * Surface de calque en mémoire (Uint8ClampedArray) pour tester le modèle sans DOM.
 * Même contrat que la surface canvas : read / write / composite.
 */

import { compositeBuffers } from '../../src/core/blend.js';
import { extractRect, writeRect } from '../../src/core/history.js';

export function createMemorySurface(width, height) {
  const buffer = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  return {
    width,
    height,
    buffer,
    read: (rect) => extractRect(buffer, rect),
    write: (source, x, y) => writeRect(buffer, source, x, y),
    composite: (source, opacity, mode) => compositeBuffers(buffer, source.buffer, { opacity, mode }),
  };
}

/** Pixel RVBA d'une surface. */
export function pixelAt(surface, x, y) {
  const i = (y * surface.width + x) * 4;
  return [...surface.buffer.data.slice(i, i + 4)];
}

/** Tampon d'une seule couleur. */
export function filled(width, height, rgba) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data.set(rgba, i);
  }
  return { width, height, data };
}
