/**
 * Tests du format RLE et de la bibliothèque de motifs.
 */

import { createLifeGrid, placePattern, stepLife } from '../src/grid.js';
import { encodeRle, findPattern, parseRle, PATTERNS, rleToCells, rotatePattern } from '../src/patterns.js';
import { lifeRuleTable, parseLifeRule } from '../src/rules.js';

/** Fait évoluer un motif de la bibliothèque au centre d'une grille. */
function run(id, size, generations) {
  const entry = /** @type {import('../src/patterns.js').LibraryPattern} */ (findPattern(id));
  const rule = /** @type {any} */ (parseLifeRule(entry.rule ?? 'B3/S23').rule);
  const grid = createLifeGrid(size, size);
  placePattern(grid, parseRle(entry.rle), size / 2, size / 2);
  const start = encodeRle(grid.cells, size, size);
  const table = lifeRuleTable(rule);
  for (let g = 0; g < generations; g++) {
    stepLife(grid, table);
  }
  return { grid, start };
}

describe('format RLE', () => {
  it('décode le planeur', () => {
    expect(parseRle('bo$2bo$3o!')).toEqual({
      width: 3,
      height: 3,
      cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
    });
  });

  it('ignore en-têtes, commentaires, espaces et la suite après « ! »', () => {
    const rle = '#N Clignotant\nx = 3, y = 1, rule = B3/S23\n3\no!ignoré';
    expect(parseRle(rle)).toEqual({ width: 3, height: 1, cells: [[0, 0], [1, 0], [2, 0]] });
  });

  it('accepte les lignes vides multiples « 2$ » et les symboles . et *', () => {
    expect(parseRle('*.*2$o').cells).toEqual([[0, 0], [2, 0], [0, 2]]);
  });

  it('refuse un caractère inconnu', () => {
    expect(() => parseRle('3x!')).toThrow(/inattendu/);
  });

  it('encode une grille de façon compacte et réversible', () => {
    const width = 6;
    const height = 6;
    const cells = new Uint8Array(width * height);
    for (const [x, y] of [[1, 2], [2, 2], [3, 2], [5, 5]]) {
      cells[y * width + x] = 1;
    }
    const rle = encodeRle(cells, width, height);
    expect(rle).toBe('2$b3o3$5bo!');
    expect(Array.from(rleToCells(rle, width, height))).toEqual(Array.from(cells));
  });

  it('une grille vide donne « ! »', () => {
    expect(encodeRle(new Uint8Array(9), 3, 3)).toBe('!');
  });

  it('ignore les cellules hors cadre au décodage vers une grille', () => {
    expect(Array.from(rleToCells('5o!', 2, 1))).toEqual([1, 1]);
  });
});

describe('bornes du décodage RLE', () => {
  it('refuse une plage vivante qui dépasse la largeur, sans allouer', () => {
    expect(() => parseRle('999999999o!', { maxWidth: 48, maxHeight: 48 })).toThrow('trop grand');
    expect(() => parseRle('40b9o!', { maxWidth: 48, maxHeight: 48 })).toThrow('trop grand');
  });

  it('refuse une cellule vivante sous la dernière ligne autorisée', () => {
    expect(() => parseRle('o$o!', { maxWidth: 65, maxHeight: 1 })).toThrow('trop grand');
    expect(() => parseRle('999999999$o!', { maxWidth: 48, maxHeight: 48 })).toThrow('trop grand');
  });

  it('accepte un motif qui touche exactement les bornes', () => {
    expect(parseRle('48o$47bo!', { maxWidth: 48, maxHeight: 2 })).toMatchObject({ width: 48, height: 2 });
  });

  it('applique une borne par défaut même sans option', () => {
    expect(() => parseRle('999999999o!')).toThrow('trop grand');
  });
});

describe('bibliothèque de motifs', () => {
  it('tous les motifs se décodent, avec un identifiant unique', () => {
    const ids = new Set();
    for (const pattern of PATTERNS) {
      const parsed = parseRle(pattern.rle);
      expect(parsed.cells.length).toBeGreaterThan(0);
      ids.add(pattern.id);
    }
    expect(ids.size).toBe(PATTERNS.length);
  });

  it('le canon de Gosper mesure 36×9 et émet des planeurs', () => {
    const gun = parseRle(/** @type {any} */ (findPattern('gosper-gun')).rle);
    expect([gun.width, gun.height, gun.cells.length]).toEqual([36, 9, 36]);
    // Période 30 : la population croît de 5 cellules (un planeur) par période.
    const { grid: after30 } = run('gosper-gun', 128, 30);
    const { grid: after60 } = run('gosper-gun', 128, 60);
    expect(after60.population - after30.population).toBe(5);
  });

  it.each([
    ['blinker', 2],
    ['toad', 2],
    ['beacon', 2],
    ['pulsar', 3],
    ['pentadecathlon', 15],
    ['kok-galaxy', 8],
    ['block', 1],
  ])('l’oscillateur %s revient à son état après %i générations', (id, period) => {
    const { grid, start } = run(id, 32, period);
    expect(encodeRle(grid.cells, 32, 32)).toBe(start);
  });

  it.each([
    ['glider', 4],
    ['lwss', 4],
    ['mwss', 4],
    ['hwss', 4],
  ])('le vaisseau %s garde sa forme après %i générations', (id, period) => {
    const { grid, start } = run(id, 32, period);
    const before = parseRle(start);
    const after = parseRle(encodeRle(grid.cells, 32, 32));
    expect(after.cells.length).toBe(before.cells.length);
    expect(encodeRle(grid.cells, 32, 32)).not.toBe(start);
  });

  it('le réplicateur HighLife se duplique', () => {
    // Après 12 générations, deux copies du réplicateur coexistent.
    const { grid } = run('highlife-replicator', 64, 12);
    expect(grid.population).toBe(24);
  });

  it('une rotation de 4 quarts de tour redonne le motif', () => {
    const glider = parseRle('bo$2bo$3o!');
    const quarter = rotatePattern(glider);
    expect(quarter.width).toBe(3);
    expect(quarter.cells).toContainEqual([2, 1]);
    const full = rotatePattern(rotatePattern(rotatePattern(quarter)));
    expect(full).toEqual(glider);
  });

  it('une rotation échange largeur et hauteur', () => {
    const line = rotatePattern(parseRle('3o!'));
    expect([line.width, line.height]).toEqual([1, 3]);
    expect(line.cells).toEqual([[0, 0], [0, 1], [0, 2]]);
  });
});
