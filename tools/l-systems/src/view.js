/**
 * Cadrage, déplacement et zoom de la vue — logique pure.
 *
 * Une vue `{ scale, tx, ty }` projette le monde (y vers le haut) sur l'écran
 * (y vers le bas, en pixels physiques du canvas) :
 *   X = scale · x + tx        Y = −scale · y + ty
 */

/**
 * @typedef {object} View
 * @property {number} scale - Pixels par unité du monde
 * @property {number} tx - Décalage horizontal (px)
 * @property {number} ty - Décalage vertical (px)
 */

/**
 * Cadre la boîte englobante au centre d'une surface, avec une marge.
 * @param {import('./turtle.js').Bounds|null} bounds - Boîte du dessin
 * @param {number} width - Largeur de la surface (px)
 * @param {number} height - Hauteur de la surface (px)
 * @param {number} [padding] - Marge (px) de chaque côté
 * @returns {View}
 */
export function fitView(bounds, width, height, padding = 16) {
  const finite = bounds && [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite);
  if (!finite) {
    // Bornes absentes ou non finies : vue neutre plutôt que scale 0 / tx NaN.
    return { scale: 1, tx: width / 2, ty: height / 2 };
  }
  // Un dessin plat (segment unique, ligne droite) a une dimension nulle.
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const usableW = Math.max(width - 2 * padding, 1);
  const usableH = Math.max(height - 2 * padding, 1);
  const scale = Math.min(usableW / spanX, usableH / spanY);
  if (!(scale > 0) || !Number.isFinite(scale)) {
    return { scale: 1, tx: width / 2, ty: height / 2 };
  }
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { scale, tx: width / 2 - scale * centerX, ty: height / 2 + scale * centerY };
}

/**
 * Projette un point du monde à l'écran.
 * @param {View} view - Vue
 * @param {number} x - Abscisse monde
 * @param {number} y - Ordonnée monde
 * @returns {[number, number]}
 */
export function worldToScreen(view, x, y) {
  return [view.scale * x + view.tx, -view.scale * y + view.ty];
}

/**
 * Projette un point de l'écran dans le monde.
 * @param {View} view - Vue
 * @param {number} px - Abscisse écran
 * @param {number} py - Ordonnée écran
 * @returns {[number, number]}
 */
export function screenToWorld(view, px, py) {
  return [(px - view.tx) / view.scale, (view.ty - py) / view.scale];
}

/**
 * Translate la vue.
 * @param {View} view - Vue
 * @param {number} dx - Déplacement horizontal (px)
 * @param {number} dy - Déplacement vertical (px)
 * @returns {View}
 */
export function panBy(view, dx, dy) {
  return { scale: view.scale, tx: view.tx + dx, ty: view.ty + dy };
}

/**
 * Zoome autour d'un point écran qui reste immobile sous le doigt / curseur.
 * @param {View} view - Vue
 * @param {number} factor - Facteur (> 1 : rapprocher)
 * @param {number} px - Abscisse du point fixe (px)
 * @param {number} py - Ordonnée du point fixe (px)
 * @param {{ min: number, max: number }} [limits] - Échelles extrêmes
 * @returns {View}
 */
export function zoomAt(view, factor, px, py, limits = { min: 0, max: Infinity }) {
  const scale = Math.min(limits.max, Math.max(limits.min, view.scale * factor));
  const k = scale / view.scale;
  return { scale, tx: px - k * (px - view.tx), ty: py - k * (py - view.ty) };
}

/**
 * Applique un geste à deux doigts : le zoom suit l'écartement, la
 * translation suit le milieu des deux doigts.
 * @param {View} view - Vue au début du mouvement élémentaire
 * @param {[number, number][]} before - Positions précédentes [a, b]
 * @param {[number, number][]} after - Positions actuelles [a, b]
 * @param {{ min: number, max: number }} [limits] - Échelles extrêmes
 * @returns {View}
 */
export function pinchView(view, before, after, limits) {
  const distance = ([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const middle = ([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const factor = distance(before) > 0 ? distance(after) / distance(before) : 1;
  const [mx0, my0] = middle(before);
  const [mx1, my1] = middle(after);
  return panBy(zoomAt(view, factor, mx0, my0, limits), mx1 - mx0, my1 - my0);
}

/**
 * Bornes de zoom relatives au cadrage automatique.
 * @param {View} fitted - Vue cadrée
 * @returns {{ min: number, max: number }}
 */
export function zoomLimits(fitted) {
  return { min: fitted.scale * 0.1, max: fitted.scale * 5000 };
}

/**
 * Transformation qui amène une image rendue avec `from` à la vue `to`
 * (aperçu instantané pendant un geste, avant le vrai rendu).
 * @param {View} from - Vue de l'image
 * @param {View} to - Vue cible
 * @returns {[number, number, number, number, number, number]} Matrice setTransform
 */
export function snapshotTransform(from, to) {
  const k = to.scale / from.scale;
  return [k, 0, 0, k, to.tx - k * from.tx, to.ty - k * from.ty];
}
