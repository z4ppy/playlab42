import { fitView, worldToScreen, screenToWorld, panBy, zoomAt, pinchView, zoomLimits, snapshotTransform } from '../src/view.js';
import { buildStyleIndex, resolveColorMode, depthColor, gradientColor, quantizedWidth, GRADIENT_STEPS } from '../src/style.js';
import { buildSvg, MAX_SVG_SEGMENTS } from '../src/svg-export.js';
import { interpret } from '../src/turtle.js';

const round = ([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];

describe('vue', () => {
  const bounds = { minX: -1, minY: 0, maxX: 1, maxY: 4 };

  test('le cadrage centre la boîte et respecte la marge', () => {
    const view = fitView(bounds, 200, 100, 10);
    expect(view.scale).toBe(20);
    expect(round(worldToScreen(view, 0, 2))).toEqual([100, 50]);
    expect(round(worldToScreen(view, 0, 4))).toEqual([100, 10]);
    expect(round(worldToScreen(view, 0, 0))).toEqual([100, 90]);
  });

  test('dessin plat ou vide : pas de division par zéro', () => {
    const flat = fitView({ minX: 0, minY: 0, maxX: 10, maxY: 0 }, 100, 100, 0);
    expect(flat.scale).toBe(10);
    expect(fitView(null, 100, 80)).toEqual({ scale: 1, tx: 50, ty: 40 });
  });

  test('écran ⇄ monde sont réciproques', () => {
    const view = { scale: 3, tx: 10, ty: 40 };
    expect(round(screenToWorld(view, ...worldToScreen(view, 2.5, -7)))).toEqual([2.5, -7]);
  });

  test('le zoom garde le point visé immobile et respecte les bornes', () => {
    const view = { scale: 2, tx: 5, ty: 9 };
    const target = screenToWorld(view, 30, 40);
    const zoomed = zoomAt(view, 3, 30, 40);
    expect(round(worldToScreen(zoomed, ...target))).toEqual([30, 40]);
    expect(zoomAt(view, 100, 0, 0, { min: 1, max: 10 }).scale).toBe(10);
    expect(zoomAt(view, 0.01, 0, 0, { min: 1, max: 10 }).scale).toBe(1);
  });

  test('pincer : écartement ⇒ zoom, milieu déplacé ⇒ translation', () => {
    const view = { scale: 1, tx: 0, ty: 0 };
    const pinched = pinchView(view, [[0, 0], [10, 0]], [[0, 10], [20, 10]]);
    expect(pinched.scale).toBe(2);
    // Le point monde sous l'ancien milieu (5, 0) se retrouve sous le nouveau (10, 10).
    expect(round(worldToScreen(pinched, ...screenToWorld(view, 5, 0)))).toEqual([10, 10]);
    expect(panBy(view, 3, -4)).toEqual({ scale: 1, tx: 3, ty: -4 });
  });

  test('bornes de zoom et transformation d’aperçu', () => {
    expect(zoomLimits({ scale: 2 })).toEqual({ min: 0.2, max: 10000 });
    const from = { scale: 2, tx: 10, ty: 20 };
    const to = zoomAt(panBy(from, 7, 3), 1.5, 50, 50);
    const [a, , , d, e, f] = snapshotTransform(from, to);
    // Un pixel de l'image (rendu avec `from`) doit atterrir là où `to` place le même point monde.
    const world = screenToWorld(from, 40, 60);
    const expected = worldToScreen(to, ...world);
    expect(round([a * 40 + e, d * 60 + f])).toEqual(round(expected));
  });
});

describe('styles', () => {
  const tree = interpret('F[+F[+F]]F', { angle: 30, step: 1, heading: 90 });
  const options = { colorMode: 'auto', lineWidth: 4, widthDecay: 0.5, theme: 'dark' };

  test('auto ⇒ profondeur pour une plante, progression pour une courbe', () => {
    expect(resolveColorMode('auto', 2)).toBe('depth');
    expect(resolveColorMode('auto', 0)).toBe('gradient');
    expect(resolveColorMode('solid', 3)).toBe('solid');
  });

  test('épaisseur décroissante avec la profondeur et styles dédupliqués', () => {
    const index = buildStyleIndex(tree, options);
    expect(index.mode).toBe('depth');
    const widths = [...index.keys].map((k) => index.styles[k].width);
    expect(widths).toEqual([4, 2, 1, 4]);
    expect(index.styles).toHaveLength(3);
    expect(quantizedWidth(1, 20, options)).toBe(1);
  });

  test('progression : couleurs ordonnées le long de la courbe', () => {
    const line = interpret('F'.repeat(GRADIENT_STEPS * 2), { angle: 90 });
    const index = buildStyleIndex(line, { ...options, colorMode: 'gradient' });
    expect(index.styles).toHaveLength(GRADIENT_STEPS);
    expect(index.keys[0]).toBe(0);
    expect(index.keys[line.count - 1]).toBe(GRADIENT_STEPS - 1);
  });

  test('couleurs adaptées au thème', () => {
    expect(depthColor(0, 'light')).not.toBe(depthColor(0, 'dark'));
    expect(gradientColor(1, 'light')).toMatch(/^hsl\(\d+ 75% 38%\)$/);
    const solid = buildStyleIndex(tree, { ...options, colorMode: 'solid', accent: '#123456' });
    expect(new Set(solid.styles.map((s) => s.color))).toEqual(new Set(['#123456']));
  });
});

describe('export SVG', () => {
  test('fusionne les segments contigus en polylignes et recadre', () => {
    const drawing = interpret('F+F+F', { angle: 90, step: 1, heading: 0 });
    const index = buildStyleIndex(drawing, { colorMode: 'solid', lineWidth: 2, widthDecay: 1, theme: 'light', accent: '#000' });
    const svg = buildSvg(drawing, index, { size: 120, padding: 10, background: '#fff' });
    expect(svg).toContain('viewBox="0 0 120 120"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#fff"/>');
    expect(svg).toContain('d="M10 110L110 110L110 10L10 10"');
    expect(svg.match(/<path /g)).toHaveLength(1);
  });

  test('échappe le titre et refuse les cas impossibles', () => {
    const drawing = interpret('F', { angle: 90 });
    const index = buildStyleIndex(drawing, { colorMode: 'solid', lineWidth: 1, widthDecay: 1, theme: 'dark' });
    expect(buildSvg(drawing, index, { title: '<a&b>' })).toContain('<title>&#60;a&#38;b&#62;</title>');
    expect(() => buildSvg(interpret('X', { angle: 90 }), index)).toThrow(/vide/);
    expect(() => buildSvg({ ...drawing, count: MAX_SVG_SEGMENTS + 1 }, index)).toThrow(/PNG/);
  });
});
