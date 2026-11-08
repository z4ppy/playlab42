/**
 * Surface de dessin au doigt, au stylet ou à la souris (Pointer Events).
 *
 * Le trait est dessiné opaque sur fond transparent : le canal alpha sert
 * directement d'« encre » au prétraitement, quel que soit le thème. La couleur
 * visible est celle du texte du thème et peut être changée sans redessiner.
 */

/** Épaisseur du trait relative au côté du canvas (proche des traits MNIST). */
const STROKE_RATIO = 0.085;

export class DrawingPad {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas carré (résolution interne fixe).
   * @param {object} options
   * @param {() => void} options.onChange - Appelé à chaque modification du dessin.
   * @param {() => void} [options.onStrokeEnd] - Appelé quand le doigt se lève.
   * @param {string} [options.color] - Couleur CSS initiale du trait.
   */
  constructor(canvas, { onChange, onStrokeEnd = () => {}, color = '#000' }) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
    this.onChange = onChange;
    this.onStrokeEnd = onStrokeEnd;
    this.color = color;
    /** Un seul pointeur actif : un second doigt ne dessine pas de trait parasite. */
    this.pointerId = /** @type {number|null} */ (null);
    this.last = { x: 0, y: 0 };
    this.isEmpty = true;
    this.handlers = {
      pointerdown: (/** @type {PointerEvent} */ e) => this.start(e),
      pointermove: (/** @type {PointerEvent} */ e) => this.move(e),
      pointerup: (/** @type {PointerEvent} */ e) => this.end(e),
      pointercancel: (/** @type {PointerEvent} */ e) => this.end(e),
    };
    for (const [type, handler] of Object.entries(this.handlers)) {
      canvas.addEventListener(type, /** @type {EventListener} */ (handler));
    }
  }

  /** Retire les écouteurs. */
  destroy() {
    for (const [type, handler] of Object.entries(this.handlers)) {
      this.canvas.removeEventListener(type, /** @type {EventListener} */ (handler));
    }
  }

  /**
   * Coordonnées du pointeur dans le repère interne du canvas.
   * @param {PointerEvent} event
   * @returns {{x: number, y: number}}
   */
  toCanvas(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  /** @param {PointerEvent} event */
  start(event) {
    if (this.pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.last = this.toCanvas(event);
    // Un simple appui dépose un point (utile pour le « . » d'un trait court).
    this.segment(this.last, this.last);
  }

  /** @param {PointerEvent} event */
  move(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    event.preventDefault();
    // Les événements fusionnés donnent un trait fluide même à 60 Hz.
    const events = event.getCoalescedEvents?.() ?? [];
    for (const sample of events.length ? events : [event]) {
      const point = this.toCanvas(sample);
      this.segment(this.last, point);
      this.last = point;
    }
  }

  /** @param {PointerEvent} event */
  end(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.pointerId = null;
    this.onStrokeEnd();
  }

  /**
   * Trace un segment épais à bouts ronds.
   * @param {{x: number, y: number}} from
   * @param {{x: number, y: number}} to
   */
  segment(from, to) {
    const { ctx } = this;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.canvas.width * STROKE_RATIO;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    // Décalage infime : un segment de longueur nulle ne dessine rien dans certains navigateurs.
    ctx.lineTo(to.x + 0.01, to.y);
    ctx.stroke();
    this.isEmpty = false;
    this.onChange();
  }

  /** Efface tout le dessin. */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.isEmpty = true;
    this.pointerId = null;
    this.onChange();
  }

  /**
   * Change la couleur visible du trait en conservant l'encre (canal alpha).
   * @param {string} color
   */
  setColor(color) {
    this.color = color;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /**
   * Remplace le dessin par une image 28×28 (par exemple un chiffre MNIST),
   * agrandie avec lissage pour ressembler à un trait.
   * @param {Uint8Array} pixels - 784 intensités 0..255.
   */
  drawImage28(pixels) {
    const small = document.createElement('canvas');
    small.width = 28;
    small.height = 28;
    const smallCtx = /** @type {CanvasRenderingContext2D} */ (small.getContext('2d'));
    const data = smallCtx.createImageData(28, 28);
    pixels.forEach((value, i) => data.data.set([0, 0, 0, value], i * 4));
    smallCtx.putImageData(data, 0, 0);
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    this.isEmpty = false;
    this.setColor(this.color);
    this.onChange();
  }

  /**
   * Pixels RGBA courants (pour le prétraitement).
   * @returns {Uint8ClampedArray}
   */
  pixels() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
  }
}
