/**
 * Géométrie : rectangles contraints, ellipses, Bresenham et ancrages.
 */

import {
  anchorOffset,
  ANCHORS,
  bresenhamLine,
  clipToDocument,
  constrainAngle,
  ellipseContains,
  ellipseInRect,
  inflateRect,
  intersectRect,
  isEmptyRect,
  rectContains,
  rectFromCorners,
  rectFromDrag,
  snapRectOut,
  unionRect,
} from '../src/core/geometry.js';

describe('rectangles tracés par glisser', () => {
  it('oriente positivement quel que soit le sens du geste', () => {
    expect(rectFromCorners({ x: 10, y: 8 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 3, width: 8, height: 5 });
  });

  it('contraint au carré en gardant le sens du geste', () => {
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 14, y: 30 }, { square: true })).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 0, y: 4 }, { square: true })).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('contraint au carré même sur un axe nul', () => {
    expect(rectFromDrag({ x: 0, y: 0 }, { x: 0, y: 5 }, { square: true })).toEqual({ x: 0, y: 0, width: 5, height: 5 });
  });

  it('trace depuis le centre', () => {
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 13, y: 12 }, { fromCenter: true })).toEqual({ x: 7, y: 8, width: 6, height: 4 });
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 13, y: 11 }, { fromCenter: true, square: true }))
      .toEqual({ x: 7, y: 7, width: 6, height: 6 });
  });
});

describe('constrainAngle', () => {
  it('aligne sur l\'horizontale, la verticale et les diagonales', () => {
    expect(constrainAngle({ x: 0, y: 0 }, { x: 10, y: 1 })).toEqual({ x: 10, y: 0 });
    expect(constrainAngle({ x: 0, y: 0 }, { x: -1, y: -10 })).toEqual({ x: 0, y: -10 });
    const diagonal = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 8 });
    expect(diagonal.x).toBeCloseTo(9, 6);
    expect(diagonal.y).toBeCloseTo(9, 6);
  });

  it('renvoie le départ pour un segment nul', () => {
    expect(constrainAngle({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });
});

describe('ellipses', () => {
  it('inscrit l\'ellipse dans son rectangle', () => {
    expect(ellipseInRect({ x: 0, y: 0, width: 10, height: 4 })).toEqual({ cx: 5, cy: 2, rx: 5, ry: 2 });
  });

  it('teste l\'appartenance (bord inclus)', () => {
    const e = { cx: 5, cy: 5, rx: 5, ry: 2 };
    expect(ellipseContains(e, { x: 5, y: 5 })).toBe(true);
    expect(ellipseContains(e, { x: 10, y: 5 })).toBe(true);
    expect(ellipseContains(e, { x: 5, y: 8 })).toBe(false);
    expect(ellipseContains(e, { x: 9, y: 6.9 })).toBe(false);
  });

  it('un cercle contraint a ses rayons égaux', () => {
    const e = ellipseInRect(rectFromDrag({ x: 0, y: 0 }, { x: 7, y: 3 }, { square: true }));
    expect(e.rx).toBe(e.ry);
  });

  it('une ellipse dégénérée est vide', () => {
    expect(ellipseContains({ cx: 0, cy: 0, rx: 0, ry: 3 }, { x: 0, y: 0 })).toBe(false);
  });
});

describe('opérations sur les rectangles', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  const b = { x: 5, y: 5, width: 10, height: 10 };

  it('intersecte et unit', () => {
    expect(intersectRect(a, b)).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    expect(intersectRect(a, { x: 20, y: 0, width: 1, height: 1 })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(unionRect(a, b)).toEqual({ x: 0, y: 0, width: 15, height: 15 });
    expect(unionRect(null, b)).toEqual(b);
    expect(unionRect(a, null)).toEqual(a);
    expect(unionRect(null, null)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('arrondit vers l\'extérieur, agrandit et découpe au document', () => {
    expect(snapRectOut({ x: 1.5, y: 2.2, width: 3, height: 0.5 })).toEqual({ x: 1, y: 2, width: 4, height: 1 });
    expect(inflateRect(a, 2)).toEqual({ x: -2, y: -2, width: 14, height: 14 });
    expect(clipToDocument({ x: -3.5, y: 8, width: 20, height: 9 }, 12, 10)).toEqual({ x: 0, y: 8, width: 12, height: 2 });
  });

  it('teste vide et appartenance', () => {
    expect(isEmptyRect(null)).toBe(true);
    expect(isEmptyRect({ x: 0, y: 0, width: 0, height: 3 })).toBe(true);
    expect(isEmptyRect(a)).toBe(false);
    expect(rectContains(a, { x: 0, y: 9.9 })).toBe(true);
    expect(rectContains(a, { x: 10, y: 0 })).toBe(false);
  });
});

describe('bresenhamLine', () => {
  const collect = (...args) => {
    const points = [];
    bresenhamLine(...args, (x, y) => points.push([x, y]));
    return points;
  };

  it('relie les extrémités sans trou (8-connexité)', () => {
    const points = collect(0, 0, 7, 3);
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([7, 3]);
    expect(points).toHaveLength(8);
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThanOrEqual(1);
      expect(Math.abs(points[i][1] - points[i - 1][1])).toBeLessThanOrEqual(1);
    }
  });

  it('gère les sens négatifs et le point unique', () => {
    expect(collect(3, 3, 0, 0)).toEqual([[3, 3], [2, 2], [1, 1], [0, 0]]);
    expect(collect(2.4, 2.6, 2.4, 2.6)).toEqual([[2, 3]]);
  });

  it('trace un très long segment sans récursion', () => {
    let count = 0;
    bresenhamLine(0, 0, 200000, 1, () => count++);
    expect(count).toBe(200001);
  });
});

describe('anchorOffset', () => {
  const from = { width: 10, height: 10 };
  const to = { width: 20, height: 30 };

  it.each([
    ['top-left', { dx: 0, dy: 0 }],
    ['center', { dx: 5, dy: 10 }],
    ['bottom-right', { dx: 10, dy: 20 }],
    ['top', { dx: 5, dy: 0 }],
    ['left', { dx: 0, dy: 10 }],
    ['inconnu', { dx: 5, dy: 10 }],
  ])('ancre %s', (anchor, expected) => {
    expect(anchorOffset(from, to, anchor)).toEqual(expected);
  });

  it('recadre en négatif quand le canevas rétrécit', () => {
    expect(anchorOffset(to, from, 'bottom-right')).toEqual({ dx: -10, dy: -20 });
  });

  it('expose neuf ancrages', () => {
    expect(ANCHORS).toHaveLength(9);
  });
});
