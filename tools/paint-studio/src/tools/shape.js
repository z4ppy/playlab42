/**
 * Formes : ligne, rectangle et ellipse, en contour, remplies ou les deux.
 *
 * L'aperçu est redessiné sur le calque en cours à chaque mouvement ; la forme
 * n'est appliquée au calque qu'au relâchement. Contraintes : Maj (ou l'option
 * « Contraindre ») donne carré, cercle ou angle multiple de 45° ; Alt (ou
 * « Depuis le centre ») part du centre.
 */

import { constrainAngle, ellipseInRect, inflateRect, rectFromCorners, rectFromDrag } from '../core/geometry.js';
import { toCss } from '../core/color.js';

/** Tracé du chemin de chaque forme dans le contexte. */
const PATHS = {
  line(ctx, start, end) {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    return rectFromCorners(start, end);
  },
  rect(ctx, start, end, constraints) {
    const r = rectFromDrag(start, end, constraints);
    ctx.rect(r.x, r.y, r.width, r.height);
    return r;
  },
  ellipse(ctx, start, end, constraints) {
    const r = rectFromDrag(start, end, constraints);
    const { cx, cy, rx, ry } = ellipseInRect(r);
    ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    return r;
  },
};

const META = {
  line: { join: 'round', label: 'Ligne', icon: '╱', key: 'L', options: ['size', 'opacity', 'constrain'] },
  rect: { join: 'miter', label: 'Rectangle', icon: '▭', key: 'U', options: ['size', 'opacity', 'fillMode', 'constrain', 'fromCenter'] },
  ellipse: { join: 'round', label: 'Ellipse', icon: '◯', key: 'U', options: ['size', 'opacity', 'fillMode', 'constrain', 'fromCenter'] },
};

/**
 * @param {'line'|'rect'|'ellipse'} kind
 */
export function createShapeTool(kind) {
  /** @type {{x: number, y: number}|null} */
  let start = null;

  function preview(editor, p) {
    const settings = editor.settingsFor(kind);
    const constraints = { square: settings.constrain || p.shift, fromCenter: settings.fromCenter || p.alt };
    const end = kind === 'line' && constraints.square ? constrainAngle(start, p) : p;
    const mode = kind === 'line' ? 'stroke' : settings.fillMode;
    const { ctx } = editor.pending;
    editor.pending.clearContent();
    ctx.save();
    ctx.lineWidth = settings.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = META[kind].join;
    ctx.strokeStyle = toCss({ ...editor.strokeColor, a: 255 });
    // « Contour et fond » : fond dans l'autre couleur, comme les logiciels classiques.
    ctx.fillStyle = toCss({ ...(mode === 'both' ? editor.otherColor : editor.strokeColor), a: 255 });
    ctx.beginPath();
    const bounds = PATHS[kind](ctx, start, end, constraints);
    if (mode !== 'stroke') {
      ctx.fill();
    }
    if (mode !== 'fill') {
      ctx.stroke();
    }
    ctx.restore();
    editor.pending.mark(inflateRect(bounds, settings.size / 2 + 2));
    editor.renderPending();
  }

  return {
    id: kind,
    ...META[kind],
    cursor: 'crosshair',
    defaults: { size: 4, opacity: 100, fillMode: 'stroke', constrain: false, fromCenter: false },

    down(editor, p) {
      const settings = editor.settingsFor(kind);
      if (!editor.beginPending({ opacity: settings.opacity / 100, secondary: p.secondary })) {
        return;
      }
      start = { x: p.x, y: p.y };
      preview(editor, p);
    },

    move(editor, p) {
      if (start) {
        preview(editor, p);
      }
    },

    up(editor) {
      if (start) {
        start = null;
        editor.commitPending(META[kind].label);
      }
    },

    cancel(editor) {
      start = null;
      editor.cancelPending();
    },
  };
}
