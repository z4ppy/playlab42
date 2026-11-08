/**
 * Glisser-déposer à la souris, au doigt et au stylet (Pointer Events), et
 * distinction clic simple / double-clic.
 *
 * Un appui ne devient un glisser qu'au-delà de quelques pixels : en dessous,
 * le navigateur émet un `click` ordinaire, traité comme un déplacement
 * automatique. Pendant le glisser, des copies des cartes suivent le pointeur
 * dans une couche fixe (jamais coupée par un conteneur) ; les originaux sont
 * seulement masqués. Le dépôt vise la pile qui recouvre le plus la carte de
 * tête ; un dépôt refusé ramène les cartes à leur place.
 *
 * @module games/solitaire/ui/pointer
 */

import { prefersReducedMotion } from './motion.js';

/** Distance en pixels au-delà de laquelle un appui devient un glisser. */
export const DRAG_THRESHOLD = 6;

/** Délai d'attente d'un second appui pour reconnaître un double-clic. */
export const DOUBLE_TAP_MS = 260;

/**
 * Surface commune de deux rectangles.
 * @param {DOMRect} a
 * @param {DOMRect} b
 * @returns {number}
 */
export function overlapArea(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Choisit l'appui simple ou double : n'attend un second appui que si les deux
 * gestes mèneraient à des coups différents, pour garder le clic instantané.
 */
export class TapResolver {
  #pending = null;

  /**
   * @param {{setTimeout: Function, clearTimeout: Function}} timers
   */
  constructor(timers) {
    this.timers = timers;
  }

  /**
   * @param {string} key - Identité de l'élément appuyé
   * @param {() => void} single - Geste d'un appui
   * @param {(() => void)|null} double - Geste de deux appuis rapprochés, ou null
   */
  tap(key, single, double) {
    if (this.#pending?.key === key) {
      this.timers.clearTimeout(this.#pending.timer);
      const { double: run } = this.#pending;
      this.#pending = null;
      run();
      return;
    }
    this.flush();
    if (!double) {
      single();
      return;
    }
    const timer = this.timers.setTimeout(() => this.flush(), DOUBLE_TAP_MS);
    this.#pending = { key, single, double, timer };
  }

  /** Élément dont un second appui est attendu, ou `null`. */
  get pendingKey() {
    return this.#pending?.key ?? null;
  }

  /** Exécute tout de suite l'appui simple en attente (avant un autre geste). */
  flush() {
    if (!this.#pending) {
      return;
    }
    const { single, timer } = this.#pending;
    this.timers.clearTimeout(timer);
    this.#pending = null;
    single();
  }
}

/**
 * @typedef {Object} DragHandlers
 * @property {(pile: string, count: number) => boolean} canDrag - La prise est-elle déplaçable ?
 * @property {(move: {from: string, count: number, to: string}) => boolean} canDrop
 * @property {(move: {from: string, count: number, to: string}, ghosts: Map<string, DOMRect>) => void} drop
 * @property {() => void} [start] - Début d'un glisser (interrompt l'IA, par exemple)
 */

export class DragController {
  #drag = null;
  #suppressClick = false;

  /**
   * @param {HTMLElement} root - Table de jeu
   * @param {DragHandlers} handlers
   */
  constructor(root, handlers) {
    this.root = root;
    this.doc = root.ownerDocument;
    this.win = this.doc.defaultView;
    this.handlers = handlers;
    this.listeners = [
      ['pointerdown', event => this.#down(event)],
      ['pointermove', event => this.#move(event)],
      ['pointerup', event => this.#up(event)],
      ['pointercancel', () => this.cancel()],
      // Au doigt, la carte détient une capture implicite que la table reprend au début
      // du glisser : seule la perte de la capture de la table annule le geste.
      ['lostpointercapture', event => event.target === root && this.cancel()],
      // Le clic qui suit un glisser ne doit pas rejouer un déplacement automatique.
      ['click', event => this.#swallowClick(event), true],
    ];
    for (const [type, listener, capture] of this.listeners) {
      root.addEventListener(type, listener, capture === true);
    }
  }

  /** Retire les écouteurs (démontage du jeu). */
  dispose() {
    this.cancel();
    for (const [type, listener, capture] of this.listeners) {
      this.root.removeEventListener(type, listener, capture === true);
    }
  }

  /** Un glisser est-il en cours ? */
  get active() {
    return Boolean(this.#drag?.layer);
  }

  #down(event) {
    // Un glisser terminé hors de sa carte ne produit pas de clic : rien à ignorer après lui.
    this.#suppressClick = false;
    const card = event.target.closest?.('.card[data-pile]');
    if (!card || event.button !== 0 || !event.isPrimary) {
      return;
    }
    const pile = card.dataset.pile;
    const count = Number(card.dataset.count);
    if (!this.handlers.canDrag(pile, count)) {
      return;
    }
    this.#drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pile, count, layer: null };
  }

  #move(event) {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.layer) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      this.#lift(drag);
    }
    event.preventDefault();
    drag.layer.style.transform = `translate(${dx}px, ${dy}px)`;
    this.#highlight(this.#targetFor(drag));
  }

  #up(event) {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    if (!drag.layer) {
      this.#drag = null;
      return;
    }
    this.#suppressClick = true;
    const to = this.#targetFor(drag);
    const move = { from: drag.pile, count: drag.count, to };
    if (to && this.handlers.canDrop(move)) {
      const ghosts = new Map([...drag.layer.children].map(ghost => [ghost.dataset.ghost, ghost.getBoundingClientRect()]));
      this.#clear();
      this.handlers.drop(move, ghosts);
      return;
    }
    this.#returnHome(drag);
  }

  /** Annule le glisser en cours sans jouer de coup. */
  cancel() {
    if (this.#drag?.layer) {
      this.#clear();
    }
    this.#drag = null;
  }

  #swallowClick(event) {
    if (this.#suppressClick) {
      this.#suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /** Cartes de la prise, de la plus basse à celle du dessus. */
  #liftedCards(drag) {
    return [...this.root.querySelectorAll(`[data-pile="${drag.pile}"][data-card]`)]
      .filter(card => Number(card.dataset.count) <= drag.count && Number(card.dataset.count) > 0)
      .sort((a, b) => Number(b.dataset.count) - Number(a.dataset.count));
  }

  #lift(drag) {
    this.handlers.start?.();
    const layer = this.doc.createElement('div');
    layer.className = 'drag-layer';
    layer.setAttribute('aria-hidden', 'true');
    drag.cards = this.#liftedCards(drag);
    drag.homes = drag.cards.map(card => card.getBoundingClientRect());
    // Hors de la table, les copies retrouvent la taille de carte qui règle leurs polices.
    layer.style.setProperty('--card-w', `${drag.homes[0].width}px`);
    layer.style.setProperty('--card-h', `${drag.homes[0].height}px`);
    drag.cards.forEach((card, index) => {
      const ghost = card.cloneNode(true);
      const rect = drag.homes[index];
      ghost.removeAttribute('data-pile');
      ghost.removeAttribute('data-card');
      ghost.dataset.ghost = card.dataset.card;
      Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      layer.append(ghost);
      card.classList.add('is-lifted');
    });
    this.doc.body.append(layer);
    drag.layer = layer;
    this.root.setPointerCapture?.(drag.pointerId);
  }

  /** Pile de tableau ou de fondation qui recouvre le plus la carte de tête. */
  #targetFor(drag) {
    const lead = drag.layer.firstElementChild.getBoundingClientRect();
    let best = null;
    let bestArea = 0;
    for (const pile of this.root.querySelectorAll('.pile-column, .pile-foundation')) {
      const area = overlapArea(lead, pile.getBoundingClientRect());
      if (area > bestArea) {
        best = pile.dataset.pileZone;
        bestArea = area;
      }
    }
    return best;
  }

  #highlight(to) {
    const move = { from: this.#drag.pile, count: this.#drag.count, to };
    for (const pile of this.root.querySelectorAll('.is-drop-target')) {
      pile.classList.remove('is-drop-target');
    }
    if (to && to !== move.from && this.handlers.canDrop(move)) {
      this.root.querySelector(`[data-pile-zone="${to}"]`).classList.add('is-drop-target');
    }
  }

  /** Dépôt refusé : les copies reviennent à leur place, puis disparaissent. */
  #returnHome(drag) {
    const { layer } = drag;
    this.#drag = null;
    const done = () => this.#clearLayer(layer, drag.cards);
    if (prefersReducedMotion(this.win)) {
      done();
      return;
    }
    const animation = layer.animate([{ transform: layer.style.transform }, { transform: 'translate(0, 0)' }], { duration: 160, easing: 'ease-out' });
    animation.finished.then(done, done);
  }

  #clear() {
    const drag = this.#drag;
    this.#drag = null;
    this.#clearLayer(drag.layer, drag.cards);
  }

  #clearLayer(layer, cards) {
    layer.remove();
    for (const card of cards) {
      card.classList.remove('is-lifted');
    }
    for (const pile of this.root.querySelectorAll('.is-drop-target')) {
      pile.classList.remove('is-drop-target');
    }
  }
}
