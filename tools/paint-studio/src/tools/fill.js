/**
 * Pot de peinture : remplit la zone connexe de couleur proche du point touché.
 * La zone peut être calculée sur le calque actif ou sur l'image fusionnée
 * (option « Tous les calques ») ; la couleur est toujours posée sur le calque actif.
 * Le remplissage a lieu au relâchement : un second doigt (pincement) l'annule.
 */

import { floodRegion, paintMask } from '../core/flood-fill.js';
import { extractRect } from '../core/history.js';

export function createFillTool() {
  /** @type {{x: number, y: number, secondary: boolean}|null} */
  let target = null;

  return {
    id: 'fill',
    label: 'Pot de peinture',
    icon: '🪣',
    key: 'G',
    cursor: 'crosshair',
    options: ['tolerance', 'opacity', 'sampleAll'],
    defaults: { tolerance: 32, opacity: 100, sampleAll: false },

    down(_editor, p) {
      target = { x: p.x, y: p.y, secondary: Boolean(p.secondary) };
    },

    move() {},

    up(editor) {
      const point = target;
      target = null;
      const layer = point && editor.editableLayer();
      if (!layer) {
        return;
      }
      const settings = editor.settingsFor('fill');
      const whole = { x: 0, y: 0, width: editor.doc.width, height: editor.doc.height };
      const pixels = layer.surface.read(whole);
      const source = settings.sampleAll ? editor.compositeBuffer() : pixels;
      const region = floodRegion(source, point.x, point.y, { tolerance: settings.tolerance });
      if (!region) {
        return;
      }
      const color = point.secondary ? editor.colors.secondary : editor.colors.primary;
      paintMask(pixels, region.mask, region.bounds, { ...color, a: color.a * (settings.opacity / 100) });
      editor.commitPixels(layer, region.bounds, 'Remplissage', () => {
        layer.surface.write(extractRect(pixels, region.bounds), region.bounds.x, region.bounds.y);
      });
    },

    cancel() {
      target = null;
    },
  };
}
