/**
 * Tests des conversions valeurs → couleurs utilisées par les visualisations.
 */
import { describeConfidence, formatPercent, maxAbs, mixColors, parseCssColor, valuesToRgba } from '../src/visuals.js';

describe('parseCssColor', () => {
  test.each([
    ['#ff8fa3', [255, 143, 163]],
    ['  #0af ', [0, 170, 255]],
    ['rgb(1, 2, 3)', [1, 2, 3]],
    ['rgba(10 20 30 / 0.5)', [10, 20, 30]],
  ])('décode %s', (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected);
  });

  test('renvoie la couleur de repli pour une valeur inconnue', () => {
    expect(parseCssColor('canvastext', [1, 1, 1])).toEqual([1, 1, 1]);
  });
});

describe('mixColors', () => {
  test('interpole linéairement et borne t dans [0, 1]', () => {
    expect(mixColors([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(mixColors([0, 0, 0], [200, 100, 50], 2)).toEqual([200, 100, 50]);
    expect(mixColors([0, 0, 0], [200, 100, 50], -1)).toEqual([0, 0, 0]);
  });
});

describe('valuesToRgba', () => {
  const palette = { background: [0, 0, 0], positive: [200, 0, 0], negative: [0, 0, 200] };

  test('normalise par la plus grande valeur absolue de la tranche', () => {
    expect(maxAbs([1, -4, 2], 0, 3)).toBe(4);
    const rgba = valuesToRgba([0, 2, 4], { count: 3, palette });
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 100, 0, 0, 255, 200, 0, 0, 255]);
  });

  test('utilise la couleur négative en mode signé et respecte l\'offset', () => {
    const rgba = valuesToRgba([9, 9, -1, 1], { offset: 2, count: 2, palette });
    expect(Array.from(rgba)).toEqual([0, 0, 200, 255, 200, 0, 0, 255]);
  });

  test('une carte entièrement nulle reste au fond (pas de division par zéro)', () => {
    expect(Array.from(valuesToRgba([0, 0], { count: 2, palette }))).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
  });
});

describe('textes', () => {
  test('formatPercent arrondit à la française', () => {
    expect(formatPercent(0.9876)).toBe('99\u202F%');
    expect(formatPercent(0.98765, 2)).toBe('98,77\u202F%');
  });

  test('formatPercent ne laisse jamais « % » passer seul à la ligne', () => {
    // Non-régression : une espace ordinaire coupait « 100 » et « % » sur mobile.
    expect(formatPercent(1)).toBe('100\u202F%');
    expect(formatPercent(1)).not.toContain(' ');
  });

  test('describeConfidence qualifie la décision', () => {
    expect(describeConfidence([0.95, 0.05], [0, 1])).toMatch(/sûr de lui/);
    expect(describeConfidence([0.7, 0.3], [0, 1])).toMatch(/1 arrive en second/);
    expect(describeConfidence([0.4, 0.35], [0, 1])).toBe('Hésitation entre 0 et 1.');
  });
});
