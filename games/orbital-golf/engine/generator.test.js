import { DEFAULT_GREEN, validateHole } from './level.js';
import { dailySeed, fnv1a32, generateHole, holeSeed, layoutIsClear } from './generator.js';
import { simulateShot } from './physics.js';
import { REFERENCE_MAX_SECONDS, directShotWorks, fineNeighbours, isApproach } from './solver.js';

/**
 * Références figées : graine du parcours, difficulté, par, angle, puissance, nombre de corps.
 * Une différence signale un changement de physique ou de génération, à revoir sciemment
 * (les parcours libres déjà partagés par leur graine en dépendent).
 * La propriété « tous résolubles » sur 1 000 graines reste un script local hors CI.
 */
const GOLDEN = [
  [1, 0, 2, 438, 43, 1], [1, 0.5, 2, 3588, 37, 2], [1, 1, 3, 600, 57, 3],
  [2, 0, 3, 2238, 37, 1], [2, 0.5, 2, 3588, 47, 2], [2, 1, 3, 2400, 70, 4],
  [3, 0, 2, 3588, 47, 1], [3, 0.5, 2, 1938, 37, 2], [3, 1, 3, 2637, 30, 3],
  [4, 0, 2, 2163, 27, 1], [4, 0.5, 2, 2088, 27, 2], [4, 1, 3, 663, 50, 4],
  [5, 0, 3, 2013, 20, 1], [5, 0.5, 3, 1863, 30, 2], [5, 1, 3, 1587, 30, 4],
  [6, 0, 3, 288, 30, 1], [6, 0.5, 2, 213, 27, 2], [6, 1, 3, 588, 50, 3],
  [7, 0, 2, 438, 37, 1], [7, 0.5, 3, 288, 30, 2], [7, 1, 2, 675, 30, 3],
  [8, 0, 2, 1338, 27, 1], [8, 0.5, 2, 1287, 30, 2], [8, 1, 2, 138, 47, 3],
];

describe('Graines', () => {
  test('FNV-1a 32 bits sur des valeurs de référence', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  test('la graine du jour ne dépend que de la date fournie', () => {
    expect(dailySeed('2026-01-01')).toBe(fnv1a32('orbital-golf:2026-01-01'));
    expect(dailySeed('2026-01-01')).not.toBe(dailySeed('2026-01-02'));
  });

  test('chaque trou a sa graine, indépendante des trous précédents', () => {
    expect(holeSeed(42, 0)).toBe(fnv1a32('42:0'));
    expect(holeSeed(-1, 3)).toBe(fnv1a32('4294967295:3'));
    expect(holeSeed(42, 1)).not.toBe(holeSeed(42, 0));
  });
});

describe('Génération d’un trou', () => {
  test('même graine, même trou ; graines différentes, trous différents', () => {
    const options = { id: 'g', name: 'G', difficulty: 0.5 };
    const first = generateHole(holeSeed(1, 0), options);
    expect(generateHole(holeSeed(1, 0), options)).toEqual(first);
    expect(generateHole(holeSeed(2, 0), options)).not.toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  test.each(GOLDEN)('graine %i, difficulté %d : par %i, tir %i/%i, %i corps, solution vérifiée',
    (seed, difficulty, par, angle, power, count) => {
      const hole = generateHole(holeSeed(seed, 0), { id: `g${seed}`, name: 'G', difficulty });
      expect(validateHole({ ...hole, tee: [hole.tee.x, hole.tee.y] })).toEqual([]);
      expect(hole.fallback).toBeUndefined();
      expect([hole.par, hole.reference.angle, hole.reference.power, hole.bodies.length]).toEqual([par, angle, power, count]);
      expect(hole.tee.x % 1 + hole.tee.y % 1 + hole.hole.x % 1 + hole.hole.y % 1).toBe(0);
      expect(Math.hypot(hole.hole.x - hole.tee.x, hole.hole.y - hole.tee.y)).toBeGreaterThanOrEqual(550);
      const result = simulateShot(hole, hole.tee, angle, power, 0);
      expect(isApproach(hole, result)).toBe(true);
      expect(result.duration).toBeLessThanOrEqual(REFERENCE_MAX_SECONDS);
      expect(fineNeighbours(hole, hole.reference)).toBeGreaterThanOrEqual(2);
      if (difficulty >= 0.3) { expect(directShotWorks(hole)).toBe(false); }
    }, 60000);
});

describe('Dégagement d’une scène', () => {
  const ends = { tee: [150, 500], hole: { x: 850, y: 500 } };
  const planet = (x, y, radius = 50) => ({ kind: 'planet', x, y, radius, mass: 2 });
  const moon = (cx, cy, r) => ({ kind: 'moon', radius: 20, mass: 0.5, orbit: { cx, cy, r, period: 5, phase: 0 } });

  test('accepte deux surfaces séparées d’au moins 60 u', () => {
    expect(layoutIsClear([planet(500, 300), planet(500, 460)], ends)).toBe(true);
    expect(layoutIsClear([planet(500, 300), planet(500, 459)], ends)).toBe(false);
  });

  test('exige un départ dégagé et un green libre', () => {
    expect(layoutIsClear([planet(260, 500)], ends)).toBe(true);
    expect(layoutIsClear([planet(259, 500)], ends)).toBe(false);
    expect(layoutIsClear([planet(850 - 50 - DEFAULT_GREEN - 10, 500)], ends)).toBe(true);
    expect(layoutIsClear([planet(850 - 50 - DEFAULT_GREEN - 9, 500)], ends)).toBe(false);
  });

  test('l’horizon d’un trou noir compte comme son encombrement', () => {
    expect(layoutIsClear([{ kind: 'blackhole', x: 500, y: 500, mass: 9 }, planet(500, 640)], ends)).toBe(true);
    expect(layoutIsClear([{ kind: 'blackhole', x: 500, y: 500, mass: 9 }, planet(500, 639)], ends)).toBe(false);
  });

  test('le couloir d’une lune évite départ, green et autres corps', () => {
    const host = planet(500, 500);
    expect(layoutIsClear([host, moon(500, 500, 130)], ends)).toBe(true);
    expect(layoutIsClear([host, planet(500, 800), moon(500, 500, 230)], ends)).toBe(false);
    expect(layoutIsClear([host, moon(500, 500, 320)], ends)).toBe(false);
    expect(layoutIsClear([host, moon(500, 500, 230)], { tee: [150, 500], hole: { x: 750, y: 500 } })).toBe(false);
  });
});
