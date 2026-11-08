import {
  BALL_RADIUS, DEFAULT_BOUNDS, DEFAULT_GREEN, DEFAULT_PREVIEW,
  bodyCenter, normalizeHole, placeBodies, resolveTarget, validateHole,
} from './level.js';
import { INITIATION } from './levels.js';
import { simulateShot } from './physics.js';
import { directShotWorks, fineNeighbours, isApproach } from './solver.js';

const minimal = { id: 'm', name: 'Minimal', par: 2, tee: [100, 100], hole: { x: 900, y: 900 }, bodies: [] };

describe('Schéma d’un trou', () => {
  test('un trou minimal reçoit limites, green et aperçu par défaut', () => {
    expect(validateHole(minimal)).toEqual([]);
    expect(normalizeHole(minimal)).toEqual({
      id: 'm', name: 'Minimal', par: 2, tee: { x: 100, y: 100 }, hole: { x: 900, y: 900 },
      green: DEFAULT_GREEN, bounds: [...DEFAULT_BOUNDS], previewSeconds: DEFAULT_PREVIEW,
      bodies: [], reference: null,
    });
  });

  test('copie les corps et la leçon sans partager l’entrée', () => {
    const raw = { ...minimal, lesson: 'Courbe', reference: { angle: 10, power: 20 }, bodies: [{ kind: 'planet', x: 1, y: 2, radius: 3, mass: 1 }] };
    const hole = normalizeHole(raw);
    expect(hole.lesson).toBe('Courbe');
    expect(hole.bodies[0]).not.toBe(raw.bodies[0]);
    expect(hole.bounds).not.toBe(DEFAULT_BOUNDS);
    expect(hole.reference).toEqual({ angle: 10, power: 20 });
  });

  test.each([
    [null, ['trou absent']],
    ['texte', ['trou absent']],
    [{ ...minimal, id: '' }, ['champ invalide : id']],
    [{ ...minimal, name: 3 }, ['champ invalide : name']],
    [{ ...minimal, par: 0 }, ['champ invalide : par']],
    [{ ...minimal, par: 2.5 }, ['champ invalide : par']],
    [{ ...minimal, tee: [1] }, ['champ invalide : tee']],
    [{ ...minimal, tee: [1, Number.NaN] }, ['champ invalide : tee']],
    [{ ...minimal, bodies: {}, hole: { on: { body: 0, deg: 0 } } }, ['champ invalide : bodies', 'champ invalide : hole']],
    [{ ...minimal, bodies: [{ kind: 'comet', x: 1, y: 1, mass: 1 }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [{ kind: 'planet', x: 1, y: 1, radius: 0, mass: 1 }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [{ kind: 'planet', x: 1, y: 1, radius: 5, mass: 13 }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [{ kind: 'blackhole', x: 1, mass: 9 }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [{ kind: 'moon', radius: 5, mass: 1, orbit: { cx: 0, cy: 0, r: 0, period: 1, phase: 0 } }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [{ kind: 'moon', radius: 5, mass: 1 }] }, ['champ invalide : bodies']],
    [{ ...minimal, bodies: [null] }, ['champ invalide : bodies']],
    [{ ...minimal, hole: null }, ['champ invalide : hole']],
    [{ ...minimal, hole: { x: 1 } }, ['champ invalide : hole']],
    [{ ...minimal, hole: { on: { body: 0, deg: 0 } } }, ['champ invalide : hole']],
    [{ ...minimal, bounds: [0, 0, 0, 10] }, ['champ invalide : bounds']],
    [{ ...minimal, bounds: [0, 0, 10] }, ['champ invalide : bounds']],
    [{ ...minimal, previewSeconds: 6 }, ['champ invalide : previewSeconds']],
    [{ ...minimal, green: 10 }, ['champ invalide : green']],
    [{ ...minimal, reference: { angle: 3600, power: 1 } }, ['champ invalide : reference']],
    [{ ...minimal, reference: { angle: 1, power: 0 } }, ['champ invalide : reference']],
  ])('signale l’écart %#', (raw, errors) => {
    expect(validateHole(raw)).toEqual(errors);
  });

  test('refuse de normaliser un trou invalide avec un message lisible', () => {
    expect(() => normalizeHole({ ...minimal, par: 9 })).toThrow('Trou invalide (m) : champ invalide : par');
    expect(() => normalizeHole(undefined)).toThrow('Trou invalide (?) : trou absent');
  });

  test('un trou posé sur une planète est centré à R + rayon de balle', () => {
    const bodies = [{ kind: 'planet', x: 100, y: 200, radius: 50, mass: 2 }];
    const target = resolveTarget({ on: { body: 0, deg: 90 } }, bodies);
    expect(target.x).toBeCloseTo(100, 9);
    expect(target.y).toBeCloseTo(200 + 50 + BALL_RADIUS, 9);
    expect(resolveTarget({ x: 3, y: 4 }, bodies)).toEqual({ x: 3, y: 4 });
    expect(() => normalizeHole({ ...minimal, bodies: [{ kind: 'blackhole', x: 1, y: 1, mass: 9 }], hole: { on: { body: 0, deg: 0 } } }))
      .toThrow('champ invalide : hole');
  });
});

describe('Position des corps dans le temps', () => {
  const moon = { kind: 'moon', radius: 10, mass: 1, orbit: { cx: 500, cy: 500, r: 100, period: 4, phase: -90 } };

  test('une lune parcourt son orbite à vitesse imposée ; un corps fixe ne bouge pas', () => {
    const buffer = placeBodies([moon, { kind: 'planet', x: 1, y: 2, radius: 3, mass: 1 }], 1, new Float64Array(8));
    expect(buffer[0]).toBeCloseTo(600, 9);
    expect(buffer[1]).toBeCloseTo(500, 9);
    expect(buffer[2]).toBeCloseTo(0, 9);
    expect(buffer[3]).toBeCloseTo(100 * Math.PI / 2, 9);
    expect([...buffer.slice(4)]).toEqual([1, 2, 0, 0]);
  });

  test('bodyCenter donne la position affichée sans tampon partagé', () => {
    const center = bodyCenter(moon, 0);
    expect(center.x).toBeCloseTo(500, 9);
    expect(center.y).toBeCloseTo(400, 9);
  });
});

describe('Parcours d’initiation', () => {
  const holes = INITIATION.map(normalizeHole);

  test('neuf trous conformes, gelés et stables après un aller-retour JSON', () => {
    expect(holes).toHaveLength(9);
    expect(Object.isFrozen(INITIATION[3].bodies[0])).toBe(true);
    for (const raw of INITIATION) {
      expect(validateHole(raw)).toEqual([]);
      expect(normalizeHole(JSON.parse(JSON.stringify(raw)))).toEqual(normalizeHole(raw));
    }
  });

  test.each(holes.map(hole => [hole.id, hole]))('%s : la référence atteint le green en moins de 7 s', (_id, hole) => {
    const result = simulateShot(hole, hole.tee, hole.reference.angle, hole.reference.power, 0);
    expect(isApproach(hole, result)).toBe(true);
    expect(result.duration).toBeLessThanOrEqual(7);
  });

  test.each(holes.map(hole => [hole.id, hole]))('%s : les tirs voisins (±0,5°, ±2 %%) réussissent au moins 2 fois sur 4', (_id, hole) => {
    expect(fineNeighbours(hole, hole.reference)).toBeGreaterThanOrEqual(2);
  });

  test.each(holes.slice(1).map(hole => [hole.id, hole]))('%s : aucun tir direct dans l’axe ne réussit', (_id, hole) => {
    expect(directShotWorks(hole)).toBe(false);
  });

  test('le par croît du premier putt au grand tour', () => {
    expect(holes.map(hole => hole.par)).toEqual([2, 2, 3, 3, 3, 3, 3, 3, 4]);
  });
});
