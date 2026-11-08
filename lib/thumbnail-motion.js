/**
 * Animation des vignettes du portail.
 *
 * - Avec une souris : la vignette s'anime au survol de la carte ou quand elle reçoit
 *   le focus clavier, puis revient à l'image fixe.
 * - Sur écran tactile (pas de survol) : seule la carte arrêtée au centre de l'écran
 *   s'anime, après un court délai, pour ne télécharger que ce qui est regardé.
 *
 * Aucune animation si le système demande de réduire les animations, si le mode
 * « économie de données » est actif ou si la connexion est lente. L'animation n'est
 * affichée qu'une fois entièrement chargée : en cas d'échec, l'image fixe reste.
 * @module lib/thumbnail-motion
 */

/** Délai avant d'animer la carte centrale sur écran tactile, en millisecondes. */
export const TOUCH_DWELL_MS = 500;

/** Bande centrale de l'écran (marges haut et bas exclues) où une carte est « regardée ». */
const CENTER_BAND = '-35% 0px -35% 0px';

/**
 * Indique si l'environnement autorise les vignettes animées.
 * @param {Window} win - Fenêtre du navigateur (injectable pour les tests)
 * @returns {boolean} Faux si animations réduites, économie de données ou connexion lente
 */
export function motionAllowed(win = window) {
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {return false;}
  const connection = win.navigator?.connection;
  if (connection?.saveData) {return false;}
  return !['slow-2g', '2g'].includes(connection?.effectiveType);
}

/**
 * Indique si l'appareil a un vrai survol (souris, pavé tactile).
 * @param {Window} win - Fenêtre du navigateur
 * @returns {boolean} Vrai pour un pointeur précis capable de survoler
 */
export function canHover(win = window) {
  return Boolean(win.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
}

/**
 * Crée le contrôleur d'une vignette : bascule vers l'animation une fois chargée,
 * revient à l'image fixe à l'arrêt.
 * @param {HTMLImageElement} img - Vignette affichée
 * @param {string} animatedSrc - Chemin de la variante animée
 * @param {{win: Window, ImageCtor: typeof Image}} env - Environnement injectable
 * @returns {{start: () => void, stop: () => void}} Commandes de la vignette
 */
function thumbnailController(img, animatedSrc, { win, ImageCtor }) {
  const staticSrc = img.getAttribute('src');
  let wanted = false;
  return {
    start() {
      if (wanted || !motionAllowed(win)) {return;}
      wanted = true;
      // Précharger : l'image fixe reste visible tant que l'animation n'est pas prête
      const preload = new ImageCtor();
      preload.onload = () => {
        if (wanted) {img.setAttribute('src', animatedSrc);}
      };
      preload.src = animatedSrc;
    },
    stop() {
      wanted = false;
      if (img.getAttribute('src') !== staticSrc) {img.setAttribute('src', staticSrc);}
    },
  };
}

/**
 * Observateur partagé des cartes sur écran tactile : une seule carte animée à la fois.
 * @param {Window} win - Fenêtre du navigateur
 * @returns {{observe: (card: Element, controller: object) => void}|null} Null sans IntersectionObserver
 */
function createCenterObserver(win) {
  if (typeof win.IntersectionObserver !== 'function') {return null;}
  const controllers = new Map();
  const timers = new Map();
  let active = null;

  const observer = new win.IntersectionObserver(entries => {
    for (const entry of entries) {
      const controller = controllers.get(entry.target);
      if (!controller) {continue;}
      win.clearTimeout(timers.get(entry.target));
      if (entry.isIntersecting) {
        timers.set(entry.target, win.setTimeout(() => {
          if (active && active !== controller) {active.stop();}
          active = controller;
          controller.start();
        }, TOUCH_DWELL_MS));
      } else {
        controller.stop();
        if (active === controller) {active = null;}
      }
    }
  }, { rootMargin: CENTER_BAND });

  return {
    observe(card, controller) {
      controllers.set(card, controller);
      observer.observe(card);
    },
  };
}

const centerObservers = new WeakMap();

/**
 * Branche l'animation d'une vignette sur sa carte.
 * @param {Element} card - Carte qui reçoit le survol, le focus ou le défilement
 * @param {HTMLImageElement} img - Vignette affichée
 * @param {string} animatedSrc - Chemin de la variante animée
 * @param {{win?: Window, ImageCtor?: typeof Image}} [env] - Environnement injectable pour les tests
 * @returns {{start: () => void, stop: () => void}} Commandes de la vignette
 */
export function attachThumbnailMotion(card, img, animatedSrc, { win = window, ImageCtor = win.Image } = {}) {
  const controller = thumbnailController(img, animatedSrc, { win, ImageCtor });
  if (canHover(win)) {
    card.addEventListener('pointerenter', controller.start);
    card.addEventListener('pointerleave', controller.stop);
  } else {
    if (!centerObservers.has(win)) {centerObservers.set(win, createCenterObserver(win));}
    centerObservers.get(win)?.observe(card, controller);
  }
  // Le focus clavier anime aussi la vignette, quel que soit l'appareil
  card.addEventListener('focusin', controller.start);
  card.addEventListener('focusout', controller.stop);
  return controller;
}
