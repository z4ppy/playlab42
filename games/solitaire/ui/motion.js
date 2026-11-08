/**
 * Animations du client (technique FLIP : First, Last, Invert, Play).
 *
 * Avant un rendu on mémorise la position de chaque carte visible (par son
 * code), après le rendu on la fait partir de l'ancienne position. Le rendu
 * reste donc un simple « tout redessiner », et toutes les animations de
 * déplacement viennent gratuitement. Rien ne bouge si l'utilisateur préfère
 * réduire les animations.
 *
 * @module games/solitaire/ui/motion
 */

import { RANKS, SUITS } from '../engine/cards.js';
import { createStaticCard } from './card-view.js';

const MOVE_MS = 190;
const EASING = 'cubic-bezier(.2,.8,.2,1)';

/**
 * L'utilisateur préfère-t-il réduire les animations ?
 * @param {Window} win
 * @returns {boolean}
 */
export function prefersReducedMotion(win) {
  return win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Positions actuelles des cartes visibles.
 * @param {ParentNode} root
 * @returns {Map<string, DOMRect>}
 */
export function captureCards(root) {
  const rects = new Map();
  for (const element of root.querySelectorAll('[data-card]')) {
    rects.set(element.dataset.card, element.getBoundingClientRect());
  }
  return rects;
}

/**
 * Anime chaque carte depuis sa position précédente ; une carte nouvelle part
 * de `origin` (le talon pour une pioche), ou apparaît en se retournant.
 * @param {ParentNode} root
 * @param {Map<string, DOMRect>} before - Résultat de `captureCards`
 * @param {{origin?: DOMRect|null, win: Window}} options
 */
export function playMoves(root, before, { origin = null, win }) {
  if (prefersReducedMotion(win)) {
    return;
  }
  for (const element of root.querySelectorAll('[data-card]')) {
    const last = element.getBoundingClientRect();
    const first = before.get(element.dataset.card) ?? origin;
    if (!first) {
      element.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: MOVE_MS, easing: EASING });
      continue;
    }
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 50 }, { transform: 'none', zIndex: 50 }],
        { duration: MOVE_MS, easing: EASING },
      );
    }
  }
}

/**
 * Petit refus visuel quand une carte n'a aucune destination.
 * @param {Element} element
 * @param {Window} win
 */
export function shake(element, win) {
  if (prefersReducedMotion(win)) {
    return;
  }
  element.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
    { duration: 220 },
  );
}

/**
 * Cascade de victoire sobre : les cartes des fondations glissent l'une après
 * l'autre vers le bas de la table en s'estompant.
 * @param {HTMLElement} table - Table de jeu
 * @param {Window} win
 * @returns {Promise<void>} Résolue à la fin de la cascade (aussitôt si animations réduites)
 */
export function victoryCascade(table, win) {
  const piles = [...table.querySelectorAll('.pile-foundation')];
  if (prefersReducedMotion(win) || !piles.length) {
    return Promise.resolve();
  }
  const height = table.getBoundingClientRect().height;
  const animations = [];
  // Du roi vers l'as : chaque tour fait tomber une carte de chaque fondation.
  for (let round = 0; round < RANKS.length; round++) {
    piles.forEach((pile, index) => {
      const ghost = createStaticCard(table.ownerDocument, `${RANKS[RANKS.length - 1 - round]}${SUITS[index]}`);
      ghost.removeAttribute('data-card');
      ghost.classList.add('card-ghost');
      pile.append(ghost);
      const drift = (index - 1.5) * 24;
      const animation = ghost.animate(
        [{ transform: 'none', opacity: 1 }, { transform: `translate(${drift}px, ${height * 0.8}px) rotate(${drift / 3}deg)`, opacity: 0 }],
        { duration: 900, delay: (round * 4 + index) * 45, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
      );
      animations.push(animation.finished.finally(() => ghost.remove()));
    });
  }
  return Promise.allSettled(animations).then(() => undefined);
}
