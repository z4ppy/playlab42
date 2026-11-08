/**
 * Transformation entre la grille (cellules) et l'écran (pixels CSS) :
 * ajustement, zoom autour d'un point et conversion des touchers en cellules.
 * Module pur, sans DOM.
 */

/**
 * Vue courante : une cellule mesure `scale` pixels et la cellule (0, 0)
 * commence au pixel (offsetX, offsetY).
 * @typedef {object} View
 * @property {number} scale
 * @property {number} offsetX
 * @property {number} offsetY
 */

/** Taille minimale d'une cellule à l'écran, en pixels CSS. */
export const MIN_CELL_PX = 0.5;

/** Taille maximale d'une cellule à l'écran, en pixels CSS. */
export const MAX_CELL_PX = 64;

/**
 * Vue qui fait tenir toute la grille dans la zone, centrée.
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @returns {View}
 */
export function fitView(gridWidth, gridHeight, viewWidth, viewHeight) {
  const scale = Math.max(MIN_CELL_PX, Math.min(viewWidth / gridWidth, viewHeight / gridHeight));
  return {
    scale,
    offsetX: (viewWidth - gridWidth * scale) / 2,
    offsetY: (viewHeight - gridHeight * scale) / 2,
  };
}

/**
 * Zoome d'un facteur en gardant fixe le point (px, py) de l'écran.
 * @param {View} view
 * @param {number} factor - > 1 pour grossir
 * @param {number} px
 * @param {number} py
 * @returns {View}
 */
export function zoomAt(view, factor, px, py) {
  const scale = Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, view.scale * factor));
  const ratio = scale / view.scale;
  return {
    scale,
    offsetX: px - (px - view.offsetX) * ratio,
    offsetY: py - (py - view.offsetY) * ratio,
  };
}

/**
 * Déplace la vue.
 * @param {View} view
 * @param {number} dx
 * @param {number} dy
 * @returns {View}
 */
export function panView(view, dx, dy) {
  return { scale: view.scale, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy };
}

/**
 * Empêche de perdre la grille hors de l'écran : au moins `keep` pixels de
 * grille restent visibles dans chaque direction.
 * @param {View} view
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {number} [keep]
 * @returns {View}
 */
export function clampView(view, gridWidth, gridHeight, viewWidth, viewHeight, keep = 48) {
  const width = gridWidth * view.scale;
  const height = gridHeight * view.scale;
  const clamp = (/** @type {number} */ value, /** @type {number} */ min, /** @type {number} */ max) =>
    Math.min(Math.max(value, min), max);
  return {
    scale: view.scale,
    offsetX: clamp(view.offsetX, Math.min(keep, viewWidth) - width, viewWidth - Math.min(keep, width)),
    offsetY: clamp(view.offsetY, Math.min(keep, viewHeight) - height, viewHeight - Math.min(keep, height)),
  };
}

/**
 * Cellule sous un point de l'écran, ou null hors de la grille.
 * @param {View} view
 * @param {number} px
 * @param {number} py
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {{ x: number, y: number }|null}
 */
export function screenToCell(view, px, py, gridWidth, gridHeight) {
  const x = Math.floor((px - view.offsetX) / view.scale);
  const y = Math.floor((py - view.offsetY) / view.scale);
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
    return null;
  }
  return { x, y };
}

/**
 * Déplace le curseur clavier d'une cellule à l'autre, sans sortir de la grille.
 * @param {{ x: number, y: number }} cell
 * @param {number} dx
 * @param {number} dy
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {{ x: number, y: number }}
 */
export function moveCursor(cell, dx, dy, gridWidth, gridHeight) {
  return {
    x: Math.min(Math.max(cell.x + dx, 0), gridWidth - 1),
    y: Math.min(Math.max(cell.y + dy, 0), gridHeight - 1),
  };
}

/**
 * Décale la vue au minimum pour qu'une cellule (et `reach` pixels autour,
 * par exemple un motif centré sur elle) sortie de l'écran redevienne
 * visible, avec une marge de `margin` pixels (curseur clavier, grille zoomée).
 * Une zone déjà entièrement visible ne fait pas bouger la vue.
 * @param {View} view
 * @param {{ x: number, y: number }} cell
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {{ margin?: number, reach?: number }} [options]
 * @returns {View}
 */
export function revealCell(view, cell, viewWidth, viewHeight, { margin = 24, reach = 0 } = {}) {
  /**
   * @param {number} start - Position écran du bord de la cellule
   * @param {number} length - Taille de la zone
   * @returns {number} Décalage à appliquer
   */
  const shift = (start, length) => {
    const size = view.scale + 2 * reach;
    const from = start - reach;
    if (from >= 0 && from + size <= length) {
      return 0;
    }
    const room = Math.min(margin, Math.max(0, (length - size) / 2));
    if (size > length) {
      // Zone plus grande que l'écran : on centre la cellule.
      return (length - view.scale) / 2 - start;
    }
    return from < room ? room - from : length - room - (from + size);
  };
  return {
    scale: view.scale,
    offsetX: view.offsetX + shift(view.offsetX + cell.x * view.scale, viewWidth),
    offsetY: view.offsetY + shift(view.offsetY + cell.y * view.scale, viewHeight),
  };
}
