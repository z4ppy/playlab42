/**
 * Tests des transformations écran ↔ grille et des palettes de rendu.
 */

import { clampView, fitView, MAX_CELL_PX, moveCursor, panView, revealCell, screenToCell, zoomAt } from '../src/view.js';
import { ageRatio, buildPalette, mixColor, packColor, paintCells, parseColor } from '../src/palette.js';

describe('curseur clavier', () => {
  it('reste dans la grille', () => {
    expect(moveCursor({ x: 0, y: 5 }, -1, 1, 10, 10)).toEqual({ x: 0, y: 6 });
    expect(moveCursor({ x: 9, y: 9 }, 1, 1, 10, 10)).toEqual({ x: 9, y: 9 });
  });

  it('ne déplace pas la vue si la cellule est déjà visible', () => {
    const view = { scale: 10, offsetX: 0, offsetY: 0 };
    expect(revealCell(view, { x: 5, y: 5 }, 200, 200)).toEqual(view);
  });

  it('décale la vue juste assez pour montrer la cellule avec une marge', () => {
    const view = { scale: 10, offsetX: 0, offsetY: 0 };
    // Cellule 30 : bord droit à 310 px, la zone fait 200 px, marge 24 px.
    expect(revealCell(view, { x: 30, y: 0 }, 200, 200)).toEqual({ scale: 10, offsetX: -134, offsetY: 0 });
    expect(revealCell({ scale: 10, offsetX: -100, offsetY: 0 }, { x: 2, y: 0 }, 200, 200).offsetX).toBe(4);
  });

  it('montre aussi le motif centré sur le curseur', () => {
    const view = { scale: 10, offsetX: 0, offsetY: 0 };
    // Cellule 18 entièrement visible (180-190 px) mais motif de ±20 px au-delà.
    expect(revealCell(view, { x: 18, y: 0 }, 200, 200, { reach: 20 }).offsetX).toBe(-34);
    expect(revealCell(view, { x: 18, y: 5 }, 200, 200).offsetX).toBe(0);
  });
});

describe('vue', () => {
  it('ajuste et centre la grille dans la zone', () => {
    // 100×50 cellules dans 400×400 px : 4 px par cellule, centré verticalement.
    expect(fitView(100, 50, 400, 400)).toEqual({ scale: 4, offsetX: 0, offsetY: 100 });
  });

  it('zoome en gardant le point touché fixe', () => {
    const view = { scale: 2, offsetX: 10, offsetY: 20 };
    const zoomed = zoomAt(view, 2, 50, 60);
    expect(zoomed.scale).toBe(4);
    // La cellule sous (50, 60) reste sous (50, 60).
    expect(screenToCell(zoomed, 50, 60, 100, 100)).toEqual(screenToCell(view, 50, 60, 100, 100));
  });

  it('borne le zoom', () => {
    expect(zoomAt({ scale: 40, offsetX: 0, offsetY: 0 }, 10, 0, 0).scale).toBe(MAX_CELL_PX);
  });

  it('convertit un toucher en cellule, null hors grille', () => {
    const view = { scale: 4, offsetX: 0, offsetY: 100 };
    expect(screenToCell(view, 7.9, 100, 100, 50)).toEqual({ x: 1, y: 0 });
    expect(screenToCell(view, 10, 99, 100, 50)).toBeNull();
    expect(screenToCell(view, 400, 150, 100, 50)).toBeNull();
  });

  it('déplace puis garde une partie de la grille visible', () => {
    const moved = panView({ scale: 1, offsetX: 0, offsetY: 0 }, -1000, 1000);
    expect(moved).toEqual({ scale: 1, offsetX: -1000, offsetY: 1000 });
    expect(clampView(moved, 100, 100, 300, 300)).toEqual({ scale: 1, offsetX: -52, offsetY: 252 });
  });
});

describe('palette', () => {
  it('lit les couleurs hexadécimales et rgb()', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor(' #1a2B3c ')).toEqual([26, 43, 60]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(() => parseColor('bleu')).toThrow(/non reconnue/);
  });

  it('empaquette en RGBA petit-boutiste opaque', () => {
    expect(packColor([0x11, 0x22, 0x33])).toBe(0xff332211);
  });

  it('interpole entre deux couleurs', () => {
    expect(mixColor([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
  });

  it('place les âges sur une échelle logarithmique', () => {
    expect(ageRatio(1)).toBe(0);
    expect(ageRatio(16)).toBe(0.5);
    expect(ageRatio(1000)).toBe(1);
  });

  const colors = { background: '#000000', young: '#ffffff', mid: '#808080', old: '#0000ff', trail: '#ff0000' };

  it('colore les cellules selon l’âge et la traînée', () => {
    const palette = buildPalette(colors);
    expect(palette.alive[1]).toBe(packColor([255, 255, 255]));
    expect(palette.alive[16]).toBe(packColor([128, 128, 128]));
    expect(palette.alive[255]).not.toBe(palette.alive[16]);
    expect(palette.trail[0]).toBe(palette.background);
    expect(palette.trail[255]).toBe(packColor([179, 0, 0]));
  });

  it('sans trace : couleur unique et pas de traînée', () => {
    const palette = buildPalette(colors, false);
    expect(new Set(palette.alive).size).toBe(1);
    expect(new Set(palette.trail).size).toBe(1);
  });

  it('peint les pixels à partir des âges', () => {
    const palette = buildPalette(colors);
    const pixels = new Uint32Array(4);
    paintCells(pixels, Uint16Array.from([0, 1, 300, 0]), Uint8Array.from([0, 0, 0, 255]), palette);
    expect(Array.from(pixels)).toEqual([
      palette.background,
      palette.alive[1],
      palette.alive[255],
      palette.trail[255],
    ]);
    paintCells(pixels, Uint16Array.from([0, 0, 0, 0]), null, palette);
    expect(new Set(pixels).size).toBe(1);
  });
});
