import { interpret, countSegments } from '../src/turtle.js';
import { expand } from '../src/lsystem.js';

/** Extrait le segment i sous forme [x1, y1, x2, y2] arrondie. */
function segment(drawing, i) {
  return [...drawing.segments.slice(i * 4, i * 4 + 4)].map((v) => Math.round(v * 1000) / 1000 + 0);
}

describe('tortue', () => {
  test('F avance en traçant, f sans tracer, + tourne à gauche', () => {
    const drawing = interpret('FfF+F', { angle: 90, step: 1, heading: 0 });
    expect(drawing.count).toBe(3);
    expect(segment(drawing, 0)).toEqual([0, 0, 1, 0]);
    expect(segment(drawing, 1)).toEqual([2, 0, 3, 0]);
    expect(segment(drawing, 2)).toEqual([3, 0, 3, 1]);
  });

  test('- tourne à droite, | fait demi-tour, G trace aussi', () => {
    const drawing = interpret('F-G|F', { angle: 90, step: 2, heading: 90 });
    expect(segment(drawing, 1)).toEqual([0, 2, 2, 2]);
    expect(segment(drawing, 2)).toEqual([2, 2, 0, 2]);
  });

  test('la pile restaure position, cap et épaisseur ; la profondeur est notée', () => {
    const drawing = interpret('F[+F[!-F]]F', { angle: 90, step: 1, heading: 90 });
    expect(drawing.count).toBe(4);
    expect([...drawing.depths]).toEqual([0, 1, 2, 0]);
    expect(segment(drawing, 3)).toEqual([0, 1, 0, 2]);
    expect(drawing.widths[2]).toBeCloseTo(0.7);
    expect(drawing.widths[3]).toBe(1);
    expect(drawing.maxDepth).toBe(2);
    expect(drawing.unbalanced).toBe(0);
  });

  test('un « ] » orphelin est ignoré et compté', () => {
    const drawing = interpret('F]]F', { angle: 90, step: 1 });
    expect(drawing.count).toBe(2);
    expect(drawing.unbalanced).toBe(2);
  });

  test('bornes exactes du flocon de Koch à n = 0 (triangle équilatéral)', () => {
    const drawing = interpret('F--F--F', { angle: 60, step: 1, heading: 0 });
    expect(drawing.bounds.minX).toBeCloseTo(0);
    expect(drawing.bounds.maxX).toBeCloseTo(1);
    expect(drawing.bounds.minY).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(drawing.bounds.maxY).toBeCloseTo(0);
    // Le triangle se referme.
    expect(segment(drawing, 2).slice(2)).toEqual([0, 0]);
  });

  test('courbe de Koch : largeur constante, hauteur √3/6, 4ⁿ segments', () => {
    const { result } = expand({ axiom: 'F', rules: [{ predecessor: 'F', successor: 'F+F--F+F' }] }, 4);
    const step = 1 / 3 ** 4;
    const drawing = interpret(result, { angle: 60, step, heading: 0 });
    expect(drawing.count).toBe(256);
    expect(drawing.bounds.maxX - drawing.bounds.minX).toBeCloseTo(1, 5);
    expect(drawing.bounds.maxY).toBeCloseTo(Math.sqrt(3) / 6, 5);
  });

  test('triangle de Sierpiński : la figure reste un triangle de côté 2ⁿ', () => {
    const system = { axiom: 'F-G-G', rules: [{ predecessor: 'F', successor: 'F-G+F+G-F' }, { predecessor: 'G', successor: 'GG' }] };
    const { result } = expand(system, 3);
    const drawing = interpret(result, { angle: 120, step: 1, heading: 0 });
    expect(drawing.bounds.maxX - drawing.bounds.minX).toBeCloseTo(8, 5);
    expect(drawing.bounds.maxY - drawing.bounds.minY).toBeCloseTo(4 * Math.sqrt(3), 5);
  });

  test('forme paramétrée : F(l), +(a) et !(w)', () => {
    const drawing = interpret([
      { s: '!', p: [3] },
      { s: 'F', p: [5] },
      { s: '+', p: [90] },
      { s: 'F', p: [] },
    ], { angle: 45, step: 2, heading: 0 });
    expect(segment(drawing, 0)).toEqual([0, 0, 5, 0]);
    expect(segment(drawing, 1)).toEqual([5, 0, 5, 2]);
    expect(drawing.widths[0]).toBe(3);
  });

  test('rien de tracé ⇒ bornes nulles', () => {
    const drawing = interpret('X+f', { angle: 90 });
    expect(drawing.count).toBe(0);
    expect(drawing.bounds).toBeNull();
    expect(countSegments('FGfgX')).toBe(2);
  });
});
