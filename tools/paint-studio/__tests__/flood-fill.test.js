/**
 * Pot de peinture : zone connexe, tolérance, bords, spirale, grands canevas.
 */

import { colorMatches, floodRegion, paintMask, sourceOverPixel } from '../src/core/flood-fill.js';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

/** Tampon à partir d'un dessin ASCII : « # » = noir, autre = blanc. */
function fromAscii(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => data.set(ch === '#' ? BLACK : WHITE, (y * width + x) * 4)));
  return { width, height, data };
}

/** Masque en ASCII (« o » = rempli). */
function maskAscii(result, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      row += result.mask[y * width + x] ? 'o' : '.';
    }
    rows.push(row);
  }
  return rows;
}

describe('floodRegion', () => {
  it('remplit une zone fermée sans traverser les murs (4-voisinage)', () => {
    const buffer = fromAscii([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    const inner = floodRegion(buffer, 2, 2);
    expect(inner.count).toBe(1);
    expect(inner.bounds).toEqual({ x: 2, y: 2, width: 1, height: 1 });
    const outer = floodRegion(buffer, 0, 0);
    expect(outer.count).toBe(16);
    expect(outer.bounds).toEqual({ x: 0, y: 0, width: 5, height: 5 });
  });

  it('ne passe pas par une diagonale', () => {
    const buffer = fromAscii([
      '.#',
      '#.',
    ]);
    expect(floodRegion(buffer, 0, 0).count).toBe(1);
  });

  it('remplit jusqu\'aux bords du canevas', () => {
    const buffer = fromAscii(['...', '...']);
    const result = floodRegion(buffer, 2, 1);
    expect(result.count).toBe(6);
    expect(maskAscii(result, 3, 2)).toEqual(['ooo', 'ooo']);
  });

  it('renvoie null hors du canevas et accepte des coordonnées flottantes', () => {
    const buffer = fromAscii(['..']);
    expect(floodRegion(buffer, -1, 0)).toBeNull();
    expect(floodRegion(buffer, 2, 0)).toBeNull();
    expect(floodRegion(buffer, 0, 1)).toBeNull();
    expect(floodRegion(buffer, 1.9, 0.5).count).toBe(2);
  });

  it('applique la tolérance par canal, alpha compris', () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255, 110, 100, 100, 255, 130, 100, 100, 255, 100, 100, 100, 200,
    ]);
    const buffer = { width: 4, height: 1, data };
    expect(floodRegion(buffer, 0, 0, { tolerance: 0 }).count).toBe(1);
    expect(floodRegion(buffer, 0, 0, { tolerance: 10 }).count).toBe(2);
    expect(floodRegion(buffer, 0, 0, { tolerance: 30 }).count).toBe(3);
    expect(floodRegion(buffer, 0, 0, { tolerance: 55 }).count).toBe(4);
    expect(floodRegion(buffer, 0, 0, { tolerance: 999 }).count).toBe(4);
    expect(floodRegion(buffer, 0, 0, { tolerance: -5 }).count).toBe(1);
  });

  it('suit un couloir en spirale jusqu\'au centre', () => {
    const rows = [
      '.........',
      '########.',
      '.......#.',
      '.#####.#.',
      '.#...#.#.',
      '.#.###.#.',
      '.#.....#.',
      '.#######.',
      '.........',
    ];
    const buffer = fromAscii(rows);
    const result = floodRegion(buffer, 0, 0);
    const free = rows.join('').split('').filter((ch) => ch === '.').length;
    expect(result.count).toBe(free);
    // Le cœur de la spirale est atteint.
    expect(result.mask[4 * 9 + 3]).toBe(1);
  });

  it('traite un grand canevas sans dépassement de pile', () => {
    const width = 2048;
    const height = 2048;
    const data = new Uint8ClampedArray(width * height * 4);
    // Lignes verticales en peigne : un parcours récursif plongerait très profond.
    for (let x = 1; x < width; x += 2) {
      const gapAtTop = (x - 1) % 4 === 0;
      for (let y = 0; y < height; y++) {
        const open = gapAtTop ? y === 0 : y === height - 1;
        if (!open) {
          data[(y * width + x) * 4 + 3] = 255;
        }
      }
    }
    const result = floodRegion({ width, height, data }, 0, 0);
    expect(result.count).toBeGreaterThan((width * height) / 2);
    expect(result.bounds).toEqual({ x: 0, y: 0, width, height });
  });
});

describe('peinture du masque', () => {
  it('remplace avec une couleur opaque et seulement dans le masque', () => {
    const buffer = fromAscii(['.#.']);
    const region = floodRegion(buffer, 0, 0);
    paintMask(buffer, region.mask, region.bounds, { r: 255, g: 0, b: 0, a: 255 });
    expect([...buffer.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...buffer.data.slice(4, 8)]).toEqual(BLACK);
    expect([...buffer.data.slice(8, 12)]).toEqual(WHITE);
  });

  it('mélange une couleur translucide (source-over)', () => {
    const data = new Uint8ClampedArray([0, 0, 255, 255]);
    sourceOverPixel(data, 0, { r: 255, g: 0, b: 0 }, 0.5);
    expect([...data]).toEqual([128, 0, 128, 255]);
  });

  it('pose une couleur translucide sur du transparent sans l\'assombrir', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0]);
    sourceOverPixel(data, 0, { r: 200, g: 100, b: 50 }, 0.5);
    expect([...data]).toEqual([200, 100, 50, 128]);
  });

  it('laisse transparent un pixel transparent recouvert d\'une couleur transparente', () => {
    const data = new Uint8ClampedArray([9, 9, 9, 0]);
    sourceOverPixel(data, 0, { r: 1, g: 2, b: 3 }, 0);
    expect([...data]).toEqual([0, 0, 0, 0]);
  });

  it('compare les couleurs avec tolérance', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 40]);
    expect(colorMatches(data, 0, [10, 20, 30, 40], 0)).toBe(true);
    expect(colorMatches(data, 0, [12, 20, 30, 40], 1)).toBe(false);
  });
});
