/**
 * Crayon pixel : carrés pleins sans anticrénelage, reliés au pixel près
 * (Bresenham), pour le pixel art. Pas de lissage : chaque pixel visé compte.
 */

import { bresenhamLine } from '../core/geometry.js';
import { toCss } from '../core/color.js';

export function createPencilTool() {
  /** @type {{x: number, y: number}|null} Dernier pixel posé. */
  let last = null;

  /** Pose un carré de `size` pixels centré sur le pixel (x, y). */
  function plot(editor, size, x, y) {
    const offset = Math.floor(size / 2);
    editor.pending.ctx.fillRect(x - offset, y - offset, size, size);
    editor.pending.mark({ x: x - offset, y: y - offset, width: size, height: size });
  }

  function lineTo(editor, p) {
    const { size } = editor.settingsFor('pencil');
    const target = { x: Math.floor(p.x), y: Math.floor(p.y) };
    const from = last ?? target;
    editor.pending.ctx.fillStyle = toCss({ ...editor.strokeColor, a: 255 });
    bresenhamLine(from.x, from.y, target.x, target.y, (x, y) => plot(editor, size, x, y));
    last = target;
    editor.renderPending();
  }

  return {
    id: 'pencil',
    label: 'Crayon',
    icon: '✏️',
    key: 'P',
    cursor: 'brush',
    options: ['size', 'opacity'],
    defaults: { size: 1, opacity: 100 },

    down(editor, p) {
      const settings = editor.settingsFor('pencil');
      if (!editor.beginPending({ opacity: settings.opacity / 100, secondary: p.secondary })) {
        return;
      }
      last = null;
      lineTo(editor, p);
    },

    move(editor, p) {
      if (last) {
        lineTo(editor, p);
      }
    },

    up(editor) {
      if (last) {
        last = null;
        editor.commitPending('Crayon');
      }
    },

    cancel(editor) {
      last = null;
      editor.cancelPending();
    },
  };
}
