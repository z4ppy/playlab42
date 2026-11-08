/**
 * Modes de fusion, transformation de vue et raccourcis clavier.
 */

import { BLEND_MODES, blendChannel, compositeBuffers, isBlendMode } from '../src/core/blend.js';
import {
  clampZoom, docToScreen, fitView, keepInView, MAX_ZOOM, MIN_ZOOM, screenToDoc, stepZoom, zoomAt, zoomTo,
} from '../src/core/viewport.js';
import { comboOf, isNativeActivation, resolveShortcut, SHORTCUTS } from '../src/core/shortcuts.js';
import { filled } from './helpers/memory-surface.js';

describe('modes de fusion', () => {
  it('reconnaît les modes proposés', () => {
    for (const mode of BLEND_MODES) {
      expect(isBlendMode(mode.id)).toBe(true);
    }
    expect(isBlendMode('plasma')).toBe(false);
    expect(isBlendMode('__proto__')).toBe(false);
    expect(isBlendMode(3)).toBe(false);
  });

  it.each([
    ['source-over', 0.2, 0.6, 0.6],
    ['multiply', 0.5, 0.5, 0.25],
    ['screen', 0.5, 0.5, 0.75],
    ['overlay', 0.25, 1, 0.5],
    ['overlay', 0.75, 0, 0.5],
    ['darken', 0.3, 0.6, 0.3],
    ['lighten', 0.3, 0.6, 0.6],
    ['color-dodge', 0, 0.5, 0],
    ['color-dodge', 0.5, 1, 1],
    ['color-dodge', 0.25, 0.5, 0.5],
    ['color-burn', 1, 0.5, 1],
    ['color-burn', 0.5, 0, 0],
    ['color-burn', 0.75, 0.5, 0.5],
    ['hard-light', 0.5, 0.25, 0.25],
    ['hard-light', 0.5, 0.75, 0.75],
    ['soft-light', 0.5, 0.5, 0.5],
    ['soft-light', 0.2, 1, 0.448],
    ['soft-light', 0.64, 1, 0.8],
    ['soft-light', 0.5, 0, 0.25],
    ['difference', 0.2, 0.7, 0.5],
    ['exclusion', 0.5, 0.5, 0.5],
    ['inconnu', 0.2, 0.6, 0.6],
  ])('%s : B(%d, %d) = %d', (mode, cb, cs, expected) => {
    expect(blendChannel(mode, cb, cs)).toBeCloseTo(expected, 6);
  });

  it('compose un calque translucide en tenant compte des alphas', () => {
    const dst = filled(2, 1, [0, 0, 0, 0]);
    compositeBuffers(dst, filled(2, 1, [255, 0, 0, 255]), { opacity: 0.5 });
    expect([...dst.data.slice(0, 4)]).toEqual([255, 0, 0, 128]);
  });

  it('compose avec décalage, en ignorant ce qui déborde et les pixels transparents', () => {
    const dst = filled(3, 1, [10, 10, 10, 255]);
    const src = filled(2, 1, [200, 200, 200, 255]);
    src.data[3] = 0;
    compositeBuffers(dst, src, { dx: 2, mode: 'multiply' });
    expect([...dst.data]).toEqual([10, 10, 10, 255, 10, 10, 10, 255, 10, 10, 10, 255]);
    compositeBuffers(dst, filled(1, 1, [255, 255, 255, 255]), { dx: 1, mode: 'difference' });
    expect([...dst.data.slice(4, 8)]).toEqual([245, 245, 245, 255]);
    compositeBuffers(dst, filled(1, 1, [255, 255, 255, 255]), { mode: 'plasma' });
    expect([...dst.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});

describe('viewport', () => {
  it('ajuste et centre le document', () => {
    expect(fitView(100, 50, 232, 232, 16)).toEqual({ scale: 2, x: 16, y: 66 });
    expect(fitView(10, 10, 1000, 1000).scale).toBe(8);
    expect(fitView(4096, 4096, 10, 10).scale).toBe(MIN_ZOOM);
  });

  it('zoome en gardant le point visé fixe', () => {
    const view = { scale: 1, x: 10, y: 20 };
    const center = { x: 110, y: 70 };
    const before = screenToDoc(view, center);
    const zoomed = zoomAt(view, 4, center);
    expect(zoomed.scale).toBe(4);
    const after = docToScreen(zoomed, before);
    expect(after.x).toBeCloseTo(center.x, 6);
    expect(after.y).toBeCloseTo(center.y, 6);
    expect(zoomTo(view, 1000, center).scale).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
  });

  it('passe d\'un palier de zoom à l\'autre', () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(0.667);
    expect(stepZoom(1.2, 1)).toBe(1.5);
    expect(stepZoom(64, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(0.05, -1)).toBe(MIN_ZOOM);
  });

  it('garde une partie du document visible', () => {
    const doc = { width: 100, height: 100 };
    const screen = { width: 300, height: 300 };
    expect(keepInView({ scale: 1, x: 5000, y: -5000 }, doc, screen)).toEqual({ scale: 1, x: 252, y: -52 });
    expect(keepInView({ scale: 1, x: 10, y: 10 }, doc, screen)).toEqual({ scale: 1, x: 10, y: 10 });
  });
});

describe('raccourcis clavier', () => {
  it('normalise les combinaisons', () => {
    expect(comboOf({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('mod+shift+z');
    expect(comboOf({ key: 'z', metaKey: true })).toBe('mod+z');
    expect(comboOf({ key: '?', shiftKey: true })).toBe('?');
  });

  it.each([
    [{ key: 'b' }, { command: 'tool', arg: 'brush' }],
    [{ key: 'B', shiftKey: true }, { command: 'tool', arg: 'brush' }],
    [{ key: 'u' }, { command: 'tool-cycle', arg: 'rect,ellipse' }],
    [{ key: 'z', ctrlKey: true }, { command: 'undo', arg: null }],
    [{ key: 'z', metaKey: true, shiftKey: true }, { command: 'redo', arg: null }],
    [{ key: 'y', ctrlKey: true }, { command: 'redo', arg: null }],
    [{ key: ']' }, { command: 'size', arg: '1' }],
    [{ key: 'Escape' }, { command: 'escape', arg: null }],
    [{ key: '&', code: 'Digit1' }, { command: 'opacity', arg: '10' }],
    [{ key: 'à', code: 'Digit0' }, { command: 'opacity', arg: '100' }],
    [{ key: '5', code: 'Numpad5' }, { command: 'opacity', arg: '50' }],
    [{ key: '0', code: 'Digit0', ctrlKey: true }, { command: 'zoom-fit', arg: null }],
  ])('%o -> %o', (event, expected) => {
    expect(resolveShortcut(event)).toEqual(expected);
  });

  it('ignore les touches inconnues et Alt seul', () => {
    expect(resolveShortcut({ key: 'q' })).toBeNull();
    expect(resolveShortcut({ key: 'b', altKey: true })).toBeNull();
  });

  it('laisse Entrée et Espace activer le bouton focalisé', () => {
    expect(isNativeActivation({ key: 'Enter' }, true)).toBe(true);
    expect(isNativeActivation({ key: ' ', code: 'Space' }, true)).toBe(true);
    expect(isNativeActivation({ key: 'Unidentified', code: 'Space' }, true)).toBe(true);
    expect(isNativeActivation({ key: 'b' }, true)).toBe(false);
    expect(isNativeActivation({ key: 'Escape' }, true)).toBe(false);
    // Sur la zone de dessin ou hors de tout contrôle : raccourcis (valider, déplacer la vue).
    expect(isNativeActivation({ key: 'Enter' }, false)).toBe(false);
    expect(isNativeActivation({ key: ' ', code: 'Space' }, false)).toBe(false);
    // Une sélection flottante garde Entrée pour sa validation ; Espace reste au bouton.
    expect(isNativeActivation({ key: 'Enter' }, true, true)).toBe(false);
    expect(isNativeActivation({ key: ' ', code: 'Space' }, true, true)).toBe(true);
  });

  it('documente chaque raccourci affiché avec un libellé', () => {
    for (const shortcut of SHORTCUTS.filter((s) => s.keys)) {
      expect(shortcut.label).toEqual(expect.any(String));
    }
  });
});
