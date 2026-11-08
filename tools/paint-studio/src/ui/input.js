/**
 * Entrées sur la zone de dessin (Pointer Events : souris, stylet, doigt).
 *
 * - un pointeur : geste de l'outil actif, ou panoramique (outil Main, Espace
 *   maintenu, bouton du milieu) ; bouton droit = couleur secondaire ;
 * - deux doigts : pincer pour zoomer, glisser pour déplacer la vue ; l'arrivée
 *   du second doigt annule proprement le geste commencé par le premier ;
 * - rejet de la paume : pendant un tracé au stylet, les contacts tactiles
 *   sont ignorés ;
 * - molette : zoom centré sur le curseur ; événements « coalescés » lus pour
 *   ne perdre aucun point d'un tracé rapide.
 */

/** Sensibilité de la molette (facteur par pixel de défilement). */
const WHEEL_SENSITIVITY = 0.0015;

/** Rend le focus au document (élément focalisé hors du corps de page). */
function releaseFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
}

export class CanvasInput {
  /**
   * @param {HTMLElement} element - Zone de dessin
   * @param {any} editor - Reçoit toolDown/Move/Up/Cancel, panBy, zoomAt, setHover
   */
  constructor(element, editor) {
    this.element = element;
    this.editor = editor;
    /** @type {Map<number, {x: number, y: number, type: string}>} */
    this.pointers = new Map();
    /** @type {'idle'|'draw'|'pan'|'pinch'|'wait'} wait : doigts restants après un pincement */
    this.mode = 'idle';
    this.activeId = -1;
    this.penActive = false;
    this.last = { x: 0, y: 0 };
    this.pinch = { distance: 0, center: { x: 0, y: 0 } };
    const handlers = {
      pointerdown: (e) => this.onDown(e),
      pointermove: (e) => this.onMove(e),
      pointerup: (e) => this.onUp(e, false),
      pointercancel: (e) => this.onUp(e, true),
      pointerleave: (e) => this.onLeave(e),
      wheel: (e) => this.onWheel(e),
      contextmenu: (e) => e.preventDefault(),
    };
    for (const [type, handler] of Object.entries(handlers)) {
      element.addEventListener(type, handler, { passive: false });
    }
  }

  /** Garde le pointeur même s'il sort de la zone ; refusé si le pointeur a déjà disparu. */
  capture(pointerId) {
    try {
      this.element.setPointerCapture(pointerId);
    } catch {
      // Pointeur relâché entre-temps (ou événement synthétique) : rien à capturer.
    }
  }

  /** Position relative à la zone, en pixels CSS. */
  local(e) {
    const box = this.element.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  /**
   * Point document enrichi pour les outils.
   * @param {PointerEvent} e
   */
  docPoint(e) {
    const point = this.editor.toDoc(this.local(e));
    // Souris et doigt n'ont pas de pression réelle : appui franc.
    const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 1;
    return {
      ...point,
      pressure,
      pointerType: e.pointerType,
      shift: e.shiftKey,
      alt: e.altKey,
      secondary: this.secondary,
    };
  }

  touchCount() {
    let count = 0;
    for (const pointer of this.pointers.values()) {
      count += pointer.type === 'touch' ? 1 : 0;
    }
    return count;
  }

  /** Vrai si le geste doit déplacer la vue plutôt que dessiner. */
  shouldPan(e) {
    return e.button === 1 || this.editor.spaceHeld || this.editor.tool.pans;
  }

  /** @param {PointerEvent} e */
  onDown(e) {
    if ((e.pointerType === 'touch' && this.penActive) || e.button > 2) {
      return;
    }
    // preventDefault empêche le navigateur de déplacer le focus : on libère
    // nous-mêmes le dernier bouton cliqué, qui sinon recevrait Espace et Entrée.
    e.preventDefault();
    releaseFocus();
    if (e.pointerType === 'pen') {
      this.dropTouches();
    }
    this.capture(e.pointerId);
    this.pointers.set(e.pointerId, { ...this.local(e), type: e.pointerType });
    if (this.touchCount() >= 2) {
      this.startPinch();
      return;
    }
    if (this.mode !== 'idle') {
      return;
    }
    this.activeId = e.pointerId;
    this.last = this.local(e);
    if (this.shouldPan(e)) {
      this.mode = 'pan';
      return;
    }
    this.mode = 'draw';
    this.penActive = e.pointerType === 'pen';
    this.secondary = e.button === 2;
    this.editor.toolDown(this.docPoint(e));
  }

  /**
   * Priorité au stylet : la paume posée AVANT lui (cas le plus fréquent) a pu
   * démarrer un tracé ou un pincement. On l'annule sans trace et on oublie ces
   * contacts : leurs mouvements et relâchements seront ensuite ignorés.
   */
  dropTouches() {
    if (this.touchCount() === 0) {
      return;
    }
    if (this.mode === 'draw') {
      this.editor.toolCancel();
    }
    for (const [id, pointer] of this.pointers) {
      if (pointer.type === 'touch') {
        this.pointers.delete(id);
      }
    }
    this.mode = 'idle';
    this.activeId = -1;
  }

  /** @param {PointerEvent} e */
  onMove(e) {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { ...this.local(e), type: e.pointerType });
    }
    if (e.pointerType !== 'touch') {
      this.editor.setHover(this.editor.toDoc(this.local(e)));
    }
    if (this.mode === 'pinch') {
      this.updatePinch();
    } else if (e.pointerId === this.activeId) {
      this.continueGesture(e);
    }
  }

  /** Suite du geste principal (panoramique ou outil). */
  continueGesture(e) {
    if (this.mode === 'pan') {
      const point = this.local(e);
      this.editor.panBy(point.x - this.last.x, point.y - this.last.y);
      this.last = point;
      return;
    }
    if (this.mode === 'draw') {
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const event of events.length > 0 ? events : [e]) {
        this.editor.toolMove(this.docPoint(event));
      }
    }
  }

  /**
   * @param {PointerEvent} e
   * @param {boolean} cancelled - pointercancel (geste système, perte du pointeur)
   */
  onUp(e, cancelled) {
    if (!this.pointers.delete(e.pointerId)) {
      return;
    }
    if (e.pointerId === this.activeId && this.mode === 'draw') {
      this.finishDraw(e, cancelled);
    }
    if (e.pointerId === this.activeId && this.mode === 'pan') {
      this.mode = 'idle';
    }
    if (this.mode === 'pinch' && this.touchCount() < 2) {
      this.mode = 'wait';
    }
    if (this.pointers.size === 0) {
      this.mode = 'idle';
      this.activeId = -1;
    }
  }

  finishDraw(e, cancelled) {
    this.mode = 'idle';
    this.activeId = -1;
    this.penActive = false;
    if (cancelled) {
      this.editor.toolCancel();
    } else {
      this.editor.toolUp(this.docPoint(e));
    }
  }

  /** Bascule en pincement : le geste en cours est annulé sans trace. */
  startPinch() {
    if (this.mode === 'draw') {
      this.editor.toolCancel();
    }
    this.mode = 'pinch';
    this.pinch = this.measurePinch();
  }

  /** Centre et écart des deux premiers doigts. */
  measurePinch() {
    const [a, b] = [...this.pointers.values()].filter((p) => p.type === 'touch');
    return {
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  updatePinch() {
    if (this.touchCount() < 2) {
      return;
    }
    const next = this.measurePinch();
    this.editor.panBy(next.center.x - this.pinch.center.x, next.center.y - this.pinch.center.y);
    this.editor.zoomAt(next.distance / this.pinch.distance, next.center);
    this.pinch = next;
  }

  /** @param {WheelEvent} e */
  onWheel(e) {
    e.preventDefault();
    // deltaMode 1 = lignes (Firefox) : environ 16 px par ligne.
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    this.editor.zoomAt(Math.exp(-delta * WHEEL_SENSITIVITY * (e.ctrlKey ? 4 : 1)), this.local(e));
  }

  /** @param {PointerEvent} e */
  onLeave(e) {
    if (e.pointerType !== 'touch') {
      this.editor.setHover(null);
    }
  }
}
