/**
 * Géométrie pure du document : rectangles, contraintes de formes, tracé de
 * segments au pixel et ancrage du redimensionnement du canevas.
 *
 * Un rectangle est { x, y, width, height } avec width et height >= 0.
 */

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 */

/** Rectangle vide de référence. */
export const EMPTY_RECT = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/**
 * Rectangle orienté positivement passant par deux coins opposés.
 * @param {Point} a
 * @param {Point} b
 * @returns {Rect}
 */
export function rectFromCorners(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * Rectangle d'une forme tracée par glisser.
 * - square : largeur = hauteur (le plus grand côté l'emporte, sens du geste conservé) ;
 * - fromCenter : le point de départ est le centre et non un coin.
 * @param {Point} start
 * @param {Point} end
 * @param {{square?: boolean, fromCenter?: boolean}} [options]
 * @returns {Rect}
 */
export function rectFromDrag(start, end, options = {}) {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (options.square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  if (options.fromCenter) {
    return rectFromCorners({ x: start.x - dx, y: start.y - dy }, { x: start.x + dx, y: start.y + dy });
  }
  return rectFromCorners(start, { x: start.x + dx, y: start.y + dy });
}

/**
 * Contraint l'extrémité d'un segment à un multiple de 45° en conservant sa longueur projetée.
 * @param {Point} start
 * @param {Point} end
 * @returns {Point}
 */
export function constrainAngle(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x: start.x, y: start.y };
  }
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  // Projection du geste sur la direction retenue : le trait suit la main sans dépasser.
  const reach = dx * Math.cos(angle) + dy * Math.sin(angle);
  return {
    x: start.x + Math.round(Math.cos(angle) * reach * 1e6) / 1e6,
    y: start.y + Math.round(Math.sin(angle) * reach * 1e6) / 1e6,
  };
}

/**
 * Centre et rayons de l'ellipse inscrite dans un rectangle.
 * @param {Rect} rect
 * @returns {{cx: number, cy: number, rx: number, ry: number}}
 */
export function ellipseInRect(rect) {
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: rect.width / 2,
    ry: rect.height / 2,
  };
}

/**
 * Vrai si le point est dans l'ellipse (bord inclus). Ellipse dégénérée : vide.
 * @param {{cx: number, cy: number, rx: number, ry: number}} ellipse
 * @param {Point} point
 */
export function ellipseContains({ cx, cy, rx, ry }, point) {
  if (rx <= 0 || ry <= 0) {
    return false;
  }
  const nx = (point.x - cx) / rx;
  const ny = (point.y - cy) / ry;
  return nx * nx + ny * ny <= 1 + 1e-9;
}

/** Vrai si le rectangle n'a pas d'aire. */
export function isEmptyRect(rect) {
  return !rect || rect.width <= 0 || rect.height <= 0;
}

/**
 * Plus petit rectangle à coordonnées entières contenant le rectangle donné.
 * @param {Rect} rect
 * @returns {Rect}
 */
export function snapRectOut(rect) {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  return {
    x,
    y,
    width: Math.ceil(rect.x + rect.width) - x,
    height: Math.ceil(rect.y + rect.height) - y,
  };
}

/**
 * Agrandit un rectangle de `margin` de chaque côté.
 * @param {Rect} rect
 * @param {number} margin
 */
export function inflateRect(rect, margin) {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + 2 * margin, height: rect.height + 2 * margin };
}

/**
 * Intersection de deux rectangles (EMPTY_RECT si disjoints).
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Rect}
 */
export function intersectRect(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) {
    return { ...EMPTY_RECT };
  }
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Union englobante ; un rectangle vide est neutre.
 * @param {Rect|null} a
 * @param {Rect|null} b
 * @returns {Rect}
 */
export function unionRect(a, b) {
  if (isEmptyRect(a)) {
    return isEmptyRect(b) ? { ...EMPTY_RECT } : { ...b };
  }
  if (isEmptyRect(b)) {
    return { ...a };
  }
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Rectangle entier limité au document [0, width[ x [0, height[.
 * @param {Rect} rect
 * @param {number} width
 * @param {number} height
 */
export function clipToDocument(rect, width, height) {
  return intersectRect(snapRectOut(rect), { x: 0, y: 0, width, height });
}

/**
 * Vrai si le point est dans le rectangle (bords gauche/haut inclus).
 * @param {Rect} rect
 * @param {Point} point
 */
export function rectContains(rect, point) {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

/**
 * Pixels entiers d'un segment (algorithme de Bresenham), extrémités incluses.
 * Itératif : aucun risque de pile, quelle que soit la longueur.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {(x: number, y: number) => void} visit
 */
export function bresenhamLine(x0, y0, x1, y1, visit) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    visit(x, y);
    if (x === tx && y === ty) {
      return;
    }
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

/** Ancrages du redimensionnement : ligne (haut/milieu/bas) x colonne (gauche/centre/droite). */
export const ANCHORS = Object.freeze([
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
]);

/**
 * Décalage à appliquer à l'ancien contenu pour l'ancrer dans le nouveau canevas.
 * @param {{width: number, height: number}} from
 * @param {{width: number, height: number}} to
 * @param {string} anchor - Un des ANCHORS (centre par défaut si inconnu)
 * @returns {{dx: number, dy: number}}
 */
export function anchorOffset(from, to, anchor) {
  const index = ANCHORS.indexOf(anchor);
  const position = index < 0 ? 4 : index;
  // 0 = aligné à gauche/haut, 0.5 = centré, 1 = aligné à droite/bas.
  const column = (position % 3) / 2;
  const row = Math.floor(position / 3) / 2;
  return {
    dx: Math.round((to.width - from.width) * column),
    dy: Math.round((to.height - from.height) * row),
  };
}
