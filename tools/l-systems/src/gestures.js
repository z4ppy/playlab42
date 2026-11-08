/**
 * Gestes sur la surface de dessin : glisser (1 doigt ou souris), pincer
 * (2 doigts), molette, double-tap / double-clic et clavier.
 *
 * Les positions sont converties en pixels physiques du canvas, l'unité des
 * vues (voir view.js). Les Pointer Events unifient souris, stylet et tactile ;
 * la surface porte `touch-action: none` pour que le navigateur ne fasse ni
 * défilement ni zoom de page pendant le geste.
 */

/** Délai maximal entre deux taps pour un double-tap (ms). */
const DOUBLE_TAP_MS = 320;

/** Distance maximale (px CSS) pour qu'un appui compte comme un tap. */
const TAP_SLOP = 10;

/**
 * @typedef {object} GestureHandlers
 * @property {() => void} onStart - Début d'interaction (stoppe l'animation)
 * @property {(dx: number, dy: number) => void} onPan - Déplacement
 * @property {(before: [number, number][], after: [number, number][]) => void} onPinch - Pincement
 * @property {(factor: number, x: number, y: number) => void} onZoom - Zoom ponctuel
 * @property {() => void} onEnd - Fin de geste (rendu complet)
 */

/**
 * Position d'un événement en pixels physiques du canvas.
 * @param {HTMLCanvasElement} canvas - Canvas
 * @param {{ clientX: number, clientY: number }} event - Événement
 * @returns {[number, number]}
 */
export function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = rect.width > 0 ? canvas.width / rect.width : 1;
  return [(event.clientX - rect.left) * ratio, (event.clientY - rect.top) * ratio];
}

/**
 * Branche les gestes ; renvoie la fonction de nettoyage.
 * @param {HTMLCanvasElement} canvas - Surface
 * @param {GestureHandlers} handlers - Rappels
 * @returns {() => void}
 */
export function attachGestures(canvas, handlers) {
  /** @type {Map<number, [number, number]>} */
  const pointers = new Map();
  let tap = { time: 0, x: 0, y: 0, moved: false, startX: 0, startY: 0 };

  const onDown = (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, canvasPoint(canvas, event));
    tap = { ...tap, moved: pointers.size > 1, startX: event.clientX, startY: event.clientY };
    handlers.onStart();
  };

  const onMove = (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    const current = canvasPoint(canvas, event);
    if (Math.hypot(event.clientX - tap.startX, event.clientY - tap.startY) > TAP_SLOP) {
      tap.moved = true;
    }
    if (pointers.size === 1) {
      handlers.onPan(current[0] - previous[0], current[1] - previous[1]);
    } else if (pointers.size === 2) {
      const before = [...pointers.values()];
      pointers.set(event.pointerId, current);
      handlers.onPinch(before, [...pointers.values()]);
      return;
    }
    pointers.set(event.pointerId, current);
  };

  const onUp = (event) => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (pointers.size === 0) {
      detectDoubleTap(event);
      handlers.onEnd();
    }
  };

  // Double-tap / double-clic : zoom ×2 au point touché (alternative au pincement).
  const detectDoubleTap = (event) => {
    if (tap.moved || event.type === 'pointercancel') {
      tap.time = 0;
      return;
    }
    const now = performance.now();
    if (now - tap.time < DOUBLE_TAP_MS) {
      const [x, y] = canvasPoint(canvas, event);
      handlers.onZoom(2, x, y);
      tap.time = 0;
      return;
    }
    tap.time = now;
  };

  const onWheel = (event) => {
    event.preventDefault();
    const [x, y] = canvasPoint(canvas, event);
    // Pavés tactiles : deltaY petit et fréquent ; souris : par crans de ~100.
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    handlers.onStart();
    handlers.onZoom(Math.exp(-delta * 0.0015), x, y);
    handlers.onEnd();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}

/** Actions clavier sur la surface : [dx, dy, facteur de zoom, recentrer]. */
export const KEY_ACTIONS = {
  ArrowLeft: { pan: [40, 0] },
  ArrowRight: { pan: [-40, 0] },
  ArrowUp: { pan: [0, 40] },
  ArrowDown: { pan: [0, -40] },
  '+': { zoom: 1.25 },
  '=': { zoom: 1.25 },
  '-': { zoom: 0.8 },
  '0': { recenter: true },
};
