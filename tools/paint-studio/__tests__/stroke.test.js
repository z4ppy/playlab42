/**
 * Lissage des tracés (Catmull-Rom, moyenne pondérée) et espacement des tampons.
 */

import { catmullRom, dabProfile, pressureSize, smoothPoint, StrokeStamper } from '../src/core/stroke.js';

const p = (x, y, pressure = 1) => ({ x, y, pressure });

describe('catmullRom', () => {
  it('passe par p1 et p2', () => {
    const a = p(0, 0);
    const b = p(10, 0);
    const c = p(20, 10);
    const d = p(30, 10);
    expect(catmullRom(a, b, c, d, 0)).toEqual(expect.objectContaining({ x: 10, y: 0 }));
    expect(catmullRom(a, b, c, d, 1)).toEqual(expect.objectContaining({ x: 20, y: 10 }));
  });

  it('reste rectiligne sur des points alignés et interpole la pression', () => {
    const mid = catmullRom(p(0, 0, 0), p(10, 0, 0), p(20, 0, 1), p(30, 0, 1), 0.5);
    expect(mid.x).toBeCloseTo(15, 6);
    expect(mid.y).toBeCloseTo(0, 6);
    expect(mid.pressure).toBeCloseTo(0.5, 6);
  });
});

describe('smoothPoint', () => {
  it('sans lissage, suit exactement le point brut', () => {
    expect(smoothPoint(p(0, 0), p(10, 10, 0.5), 0)).toEqual(p(10, 10, 0.5));
  });

  it('avec lissage maximal, avance encore (jamais figé)', () => {
    const next = smoothPoint(p(0, 0), p(10, 0), 1);
    expect(next.x).toBeCloseTo(1, 6);
  });

  it('avec un lissage moyen, reste entre les deux', () => {
    const next = smoothPoint(p(0, 0), p(10, 0), 0.5);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(10);
  });
});

describe('pressureSize et dabProfile', () => {
  it('interpole le diamètre selon la pression', () => {
    expect(pressureSize(20, 1)).toBe(20);
    expect(pressureSize(20, 0)).toBeCloseTo(3, 6);
    expect(pressureSize(20, 2)).toBe(20);
    expect(pressureSize(10, 0.5, 0)).toBe(5);
  });

  it('donne un bord net à dureté maximale et un dégradé décroissant sinon', () => {
    expect(dabProfile(1)).toEqual([[0, 1], [0.98, 1], [1, 0]]);
    const soft = dabProfile(0.2);
    expect(soft[0]).toEqual([0, 1]);
    expect(soft[1]).toEqual([0.2, 1]);
    expect(soft[soft.length - 1][0]).toBeCloseTo(1, 6);
    expect(soft[soft.length - 1][1]).toBeCloseTo(0, 6);
    for (let i = 1; i < soft.length; i++) {
      expect(soft[i][0]).toBeGreaterThanOrEqual(soft[i - 1][0]);
      expect(soft[i][1]).toBeLessThanOrEqual(soft[i - 1][1]);
    }
    expect(dabProfile(-1)[1]).toEqual([0, 1]);
  });
});

/** Trace complet : points bruts -> tampons. */
function stroke(stamper, points) {
  const stamps = [...stamper.begin(points[0])];
  for (const point of points.slice(1)) {
    stamps.push(...stamper.add(point));
  }
  stamps.push(...stamper.end());
  return stamps;
}

describe('StrokeStamper', () => {
  it('pose un tampon pour un simple tapotement', () => {
    const stamper = new StrokeStamper({ spacing: () => 2 });
    expect(stroke(stamper, [p(5, 5)])).toEqual([p(5, 5)]);
  });

  it('espace régulièrement les tampons et rejoint le dernier point', () => {
    const stamper = new StrokeStamper({ spacing: () => 2, smoothing: 0 });
    const points = Array.from({ length: 11 }, (_, i) => p(i * 10, 0));
    const stamps = stroke(stamper, points);
    // 100 px à 2 px d'intervalle : 1 tampon initial + 50 tampons.
    expect(stamps.length).toBeGreaterThanOrEqual(50);
    expect(stamps.length).toBeLessThanOrEqual(52);
    for (let i = 1; i < stamps.length; i++) {
      const gap = Math.hypot(stamps[i].x - stamps[i - 1].x, stamps[i].y - stamps[i - 1].y);
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(2.5);
    }
    expect(stamps[stamps.length - 1].x).toBeGreaterThan(98);
  });

  it('lisse un tracé en zigzag (amplitude réduite)', () => {
    const zigzag = Array.from({ length: 30 }, (_, i) => p(i * 4, i % 2 === 0 ? 0 : 8));
    const raw = stroke(new StrokeStamper({ spacing: () => 1, smoothing: 0 }), zigzag);
    const smooth = stroke(new StrokeStamper({ spacing: () => 1, smoothing: 0.8 }), zigzag);
    const amplitude = (stamps) => {
      // Tiers central : hors du régime transitoire du début et du raccord final.
      const third = Math.floor(stamps.length / 3);
      const ys = stamps.slice(third, -third).map((s) => s.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(amplitude(smooth)).toBeLessThan(amplitude(raw) / 2);
  });

  it('borne l\'espacement à un demi-pixel et suit la pression', () => {
    const stamper = new StrokeStamper({ spacing: (pressure) => pressure * 4, smoothing: 0 });
    const stamps = stroke(stamper, [p(0, 0, 0), p(10, 0, 0), p(20, 0, 1), p(30, 0, 1)]);
    expect(stamps.length).toBeGreaterThan(10);
    expect(stamps.length).toBeLessThan(60);
  });

  it('ignore les micro-mouvements et accepte add sans begin', () => {
    const stamper = new StrokeStamper({ spacing: () => 1 });
    expect(stamper.add(p(1, 1))).toEqual([p(1, 1)]);
    expect(stamper.add(p(1.1, 1))).toEqual([]);
    expect(stamper.end()).toEqual([]);
    expect(stamper.end()).toEqual([]);
  });
});
