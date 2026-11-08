/**
 * Pinceau et gomme : tampons ronds dégradés (dureté), espacés le long d'un
 * tracé lissé, diamètre modulé par la pression du stylet.
 *
 * Interface commune des outils (voir tools/index.js) : down / move / up /
 * cancel reçoivent l'éditeur et un point document { x, y, pressure, ... }.
 */

import { dabProfile, pressureSize, StrokeStamper } from '../core/stroke.js';
import { toCss } from '../core/color.js';
import { createCanvas, context2d } from '../ui/canvas-surface.js';

/** Espacement des tampons en fraction du diamètre (15 % : trait continu et rapide). */
const SPACING_RATIO = 0.15;

/**
 * Cache du tampon : un disque dégradé dessiné une fois par (taille, dureté, couleur).
 */
class DabCache {
  constructor() {
    this.key = '';
    this.canvas = createCanvas(1, 1);
  }

  /**
   * @param {number} diameter - Diamètre maximal en pixels
   * @param {number} hardness - Dans [0, 1]
   * @param {{r: number, g: number, b: number}} color
   */
  get(diameter, hardness, color) {
    const key = `${diameter}|${hardness}|${color.r},${color.g},${color.b}`;
    if (key !== this.key) {
      this.key = key;
      this.draw(diameter, hardness, color);
    }
    return this.canvas;
  }

  draw(diameter, hardness, color) {
    // Rayon entier, au moins 1 px : le tampon est ensuite mis à l'échelle (pression).
    const radius = Math.max(1, Math.ceil(diameter / 2));
    this.canvas.width = radius * 2;
    this.canvas.height = radius * 2;
    const ctx = context2d(this.canvas);
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    for (const [offset, alpha] of dabProfile(hardness)) {
      gradient.addColorStop(offset, toCss({ ...color, a: alpha * 255 }));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, radius * 2, radius * 2);
  }
}

/**
 * Fabrique le pinceau (peinture) ou la gomme (effacement).
 * @param {{id: string, label: string, icon: string, key: string, erase: boolean}} spec
 */
export function createBrushTool({ id, label, icon, key, erase }) {
  const dabs = new DabCache();
  /** @type {StrokeStamper|null} */
  let stamper = null;
  let usePressure = false;

  /** Diamètre d'un tampon selon la pression (souris et doigt : pleine taille). */
  const diameterOf = (settings, pressure) => (usePressure ? pressureSize(settings.size, pressure) : settings.size);

  function stamp(editor, stamps) {
    const settings = editor.settingsFor(id);
    const dab = dabs.get(settings.size, settings.hardness / 100, erase ? { r: 0, g: 0, b: 0 } : editor.strokeColor);
    const { ctx } = editor.pending;
    for (const s of stamps) {
      const d = Math.max(0.5, diameterOf(settings, s.pressure));
      ctx.drawImage(dab, s.x - d / 2, s.y - d / 2, d, d);
      editor.pending.mark({ x: s.x - d / 2 - 1, y: s.y - d / 2 - 1, width: d + 2, height: d + 2 });
    }
    editor.renderPending();
  }

  return {
    id,
    label,
    icon,
    key,
    cursor: 'brush',
    options: ['size', 'opacity', 'hardness', 'smoothing', 'pressure'],
    defaults: { size: erase ? 40 : 16, opacity: 100, hardness: erase ? 80 : 60, smoothing: 50, pressure: true },

    down(editor, p) {
      const settings = editor.settingsFor(id);
      if (!editor.beginPending({ erase, opacity: settings.opacity / 100, secondary: p.secondary })) {
        return;
      }
      usePressure = settings.pressure && p.pointerType === 'pen';
      stamper = new StrokeStamper({
        smoothing: settings.smoothing / 100,
        spacing: (pressure) => diameterOf(settings, pressure) * SPACING_RATIO,
      });
      stamp(editor, stamper.begin(p));
    },

    move(editor, p) {
      if (stamper) {
        stamp(editor, stamper.add(p));
      }
    },

    up(editor) {
      if (stamper) {
        stamp(editor, stamper.end());
        stamper = null;
        editor.commitPending(erase ? 'Gomme' : 'Pinceau');
      }
    },

    cancel(editor) {
      stamper = null;
      editor.cancelPending();
    },
  };
}
