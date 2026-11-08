/**
 * Gestes sur la surface de jeu, unifiés souris / stylet / doigt via les
 * Pointer Events :
 * - un doigt : geste « principal » (dessiner, effacer, déplacer, viser un motif) ;
 * - deux doigts : pincer pour zoomer et glisser pour déplacer. L'arrivée du
 *   second doigt annule le geste principal commencé par le premier ;
 * - molette : zoom ; survol à la souris : position du pinceau.
 */

/**
 * Rappels fournis par l'application. Les points sont en pixels CSS relatifs au canvas.
 * @typedef {object} GestureHandlers
 * @property {(p: {x: number, y: number}, pointerType: string) => void} start - Début du geste
 *   principal ; pointerType (« mouse », « pen », « touch ») dit si un survol suivra
 * @property {(p: {x: number, y: number}) => void} move - Suite du geste principal
 * @property {(p: {x: number, y: number}) => void} end - Fin normale du geste principal
 * @property {() => void} cancel - Geste principal annulé (second doigt, perte du pointeur)
 * @property {(factor: number, cx: number, cy: number, dx: number, dy: number) => void} pinch
 * @property {(p: {x: number, y: number}|null) => void} hover - Survol (souris), null en sortie
 * @property {(factor: number, cx: number, cy: number) => void} wheel
 */

export class GestureController {
  /**
   * @param {HTMLElement} element
   * @param {GestureHandlers} handlers
   */
  constructor(element, handlers) {
    this.element = element;
    this.handlers = handlers;
    /** @type {Map<number, {x: number, y: number}>} */
    this.pointers = new Map();
    /** @type {'idle'|'primary'|'pinch'|'ignore'} */
    this.state = 'idle';
    this.pinchDistance = 0;
    this.pinchCenter = { x: 0, y: 0 };
    this.bind();
  }

  bind() {
    const el = this.element;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e, false));
    el.addEventListener('pointercancel', (e) => this.onUp(e, true));
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') {
        this.handlers.hover(null);
      }
    });
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    // Empêche le menu contextuel d'un appui long pendant le dessin.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * @param {PointerEvent} e
   * @returns {{x: number, y: number}}
   */
  point(e) {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /**
   * @param {PointerEvent} e
   */
  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    e.preventDefault();
    this.element.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, this.point(e));
    if (this.pointers.size === 1) {
      this.state = 'primary';
      this.handlers.start(this.point(e), e.pointerType);
    } else if (this.pointers.size === 2) {
      if (this.state === 'primary') {
        this.handlers.cancel();
      }
      this.beginPinch();
    }
  }

  beginPinch() {
    this.state = 'pinch';
    const [a, b] = [...this.pointers.values()];
    this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /**
   * @param {PointerEvent} e
   */
  onMove(e) {
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') {
        this.handlers.hover(this.point(e));
      }
      return;
    }
    this.pointers.set(e.pointerId, this.point(e));
    if (this.state === 'primary') {
      this.handlers.move(this.point(e));
    } else if (this.state === 'pinch' && this.pointers.size >= 2) {
      this.updatePinch();
    }
  }

  updatePinch() {
    const [a, b] = [...this.pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.handlers.pinch(
      distance / this.pinchDistance,
      center.x,
      center.y,
      center.x - this.pinchCenter.x,
      center.y - this.pinchCenter.y,
    );
    this.pinchDistance = distance;
    this.pinchCenter = center;
  }

  /**
   * @param {PointerEvent} e
   * @param {boolean} cancelled
   */
  onUp(e, cancelled) {
    if (!this.pointers.has(e.pointerId)) {
      return;
    }
    this.pointers.delete(e.pointerId);
    if (this.state === 'primary') {
      if (cancelled) {
        this.handlers.cancel();
      } else {
        this.handlers.end(this.point(e));
      }
    }
    // Après un pincement, on attend que tous les doigts soient levés.
    this.state = this.pointers.size === 0 ? 'idle' : 'ignore';
  }

  /**
   * @param {WheelEvent} e
   */
  onWheel(e) {
    e.preventDefault();
    const rect = this.element.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    this.handlers.wheel(factor, e.clientX - rect.left, e.clientY - rect.top);
  }
}
