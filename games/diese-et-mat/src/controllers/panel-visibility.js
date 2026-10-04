/**
 * Visibilité commune des panneaux musicaux (métronome, piano, accordeur, synthé).
 *
 * Le panneau est un overlay dont la classe `visible` pilote l'affichage.
 * Chaque contrôleur garde ses propres hooks d'arrêt dans `hide()`.
 *
 * @module controllers/panel-visibility
 */

const VISIBLE_CLASS = 'visible';

/**
 * Rend l'overlay visible puis initialise le contrôleur.
 * Sans overlay, ne fait rien.
 *
 * @param {{elements: {overlay?: HTMLElement}, _init: Function}} controller
 */
export function showPanel(controller) {
  const overlay = controller.elements.overlay;
  if (overlay) {
    overlay.classList.add(VISIBLE_CLASS);
    controller._init();
  }
}

/**
 * Masque l'overlay s'il existe.
 *
 * @param {{elements: {overlay?: HTMLElement}}} controller
 */
export function hidePanel(controller) {
  controller.elements.overlay?.classList.remove(VISIBLE_CLASS);
}

/**
 * Indique si l'overlay est visible.
 *
 * @param {{elements: {overlay?: HTMLElement}}} controller
 * @returns {boolean}
 */
export function isPanelVisible(controller) {
  return controller.elements.overlay?.classList.contains(VISIBLE_CLASS) || false;
}
