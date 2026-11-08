/**
 * Transformation de vue pure : document -> écran.
 *
 * écran = (x, y) + document x scale. Le zoom autour d'un point garde ce point
 * fixe à l'écran (molette sous le curseur, centre du pincement).
 */

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 64;
/** À partir de ce zoom, une grille marque les pixels. */
export const PIXEL_GRID_ZOOM = 8;

/** Paliers des boutons + / − (multiplicatifs, lisibles en pourcentage). */
const ZOOM_LEVELS = [0.05, 0.1, 0.125, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

/**
 * @typedef {{scale: number, x: number, y: number}} View
 * @typedef {{x: number, y: number}} Point
 */

/** @param {number} scale */
export function clampZoom(scale) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * Vue qui montre tout le document centré, avec une marge.
 * Un petit document n'est pas agrandi au-delà de 800 % (pixel art lisible).
 * @param {number} docWidth
 * @param {number} docHeight
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {number} [margin]
 * @returns {View}
 */
export function fitView(docWidth, docHeight, viewWidth, viewHeight, margin = 16) {
  const availableW = Math.max(1, viewWidth - 2 * margin);
  const availableH = Math.max(1, viewHeight - 2 * margin);
  const scale = clampZoom(Math.min(availableW / docWidth, availableH / docHeight, 8));
  return {
    scale,
    x: Math.round((viewWidth - docWidth * scale) / 2),
    y: Math.round((viewHeight - docHeight * scale) / 2),
  };
}

/**
 * Zoom d'un facteur autour d'un point écran, borné.
 * @param {View} view
 * @param {number} factor
 * @param {Point} center - Coordonnées écran
 * @returns {View}
 */
export function zoomAt(view, factor, center) {
  const scale = clampZoom(view.scale * factor);
  const ratio = scale / view.scale;
  return {
    scale,
    x: center.x - (center.x - view.x) * ratio,
    y: center.y - (center.y - view.y) * ratio,
  };
}

/**
 * Zoom absolu autour d'un point écran.
 * @param {View} view
 * @param {number} scale
 * @param {Point} center
 */
export function zoomTo(view, scale, center) {
  return zoomAt(view, scale / view.scale, center);
}

/**
 * Palier de zoom suivant (+1) ou précédent (−1).
 * @param {number} scale
 * @param {1|-1} direction
 */
export function stepZoom(scale, direction) {
  if (direction > 0) {
    return ZOOM_LEVELS.find((level) => level > scale * 1.001) ?? MAX_ZOOM;
  }
  return [...ZOOM_LEVELS].reverse().find((level) => level < scale / 1.001) ?? MIN_ZOOM;
}

/**
 * @param {View} view
 * @param {Point} point - Écran
 * @returns {Point} Document (flottant)
 */
export function screenToDoc(view, point) {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

/**
 * @param {View} view
 * @param {Point} point - Document
 * @returns {Point} Écran
 */
export function docToScreen(view, point) {
  return { x: view.x + point.x * view.scale, y: view.y + point.y * view.scale };
}

/**
 * Empêche de perdre le document hors de l'écran : au moins `keep` pixels restent visibles.
 * @param {View} view
 * @param {{width: number, height: number}} doc
 * @param {{width: number, height: number}} screen
 * @param {number} [keep]
 * @returns {View}
 */
export function keepInView(view, doc, screen, keep = 48) {
  const w = doc.width * view.scale;
  const h = doc.height * view.scale;
  const limit = (pos, size, total) => Math.min(total - Math.min(keep, size), Math.max(Math.min(keep, size) - size, pos));
  return { scale: view.scale, x: limit(view.x, w, screen.width), y: limit(view.y, h, screen.height) };
}
