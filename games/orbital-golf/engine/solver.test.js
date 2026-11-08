import { normalizeHole } from './level.js';
import { INITIATION } from './levels.js';
import { simulateShot } from './physics.js';
import { REFERENCE_MAX_SECONDS, directShotWorks, isApproach, solve, wrapAngle } from './solver.js';

const [firstPutt, firstCurve] = INITIATION.map(normalizeHole);

describe('Outils du solveur', () => {
  test('ramène un angle quelconque dans [0, 3600[ en dixièmes de degré', () => {
    expect([wrapAngle(-5), wrapAngle(3600), wrapAngle(3605.4), wrapAngle(1799.6)]).toEqual([3595, 0, 5, 1800]);
  });

  test('une approche réussie rentre ou s’arrête sur le green', () => {
    const at = (outcome, x, y) => ({ outcome, x, y });
    expect(isApproach(firstPutt, at('holed', 0, 0))).toBe(true);
    expect(isApproach(firstPutt, at('rest', 850 + firstPutt.green, 500))).toBe(true);
    expect(isApproach(firstPutt, at('rest', 851 + firstPutt.green, 500))).toBe(false);
    expect(isApproach(firstPutt, at('out', 850, 500))).toBe(false);
  });

  test('détecte un trou que le tir direct suffit à jouer', () => {
    expect(directShotWorks(firstPutt)).toBe(true);
    expect(directShotWorks(firstCurve)).toBe(false);
  });
});

describe('Recherche d’un tir de référence', () => {
  test('trouve un tir robuste, rapide, et en déduit le par', () => {
    const solution = solve(firstCurve, 0.5);
    expect(solution.par).toBeGreaterThanOrEqual(2);
    expect(solution.par).toBeLessThanOrEqual(3);
    expect(solution.window).toBeGreaterThan(0);
    const { angle, power } = solution.reference;
    const result = simulateShot(firstCurve, firstCurve.tee, angle, power, 0);
    expect(isApproach(firstCurve, result)).toBe(true);
    expect(result.duration).toBeLessThanOrEqual(REFERENCE_MAX_SECONDS);
  });

  test('refuse un trou trivial dès la difficulté 0,3, l’accepte en dessous', () => {
    expect(solve(firstPutt, 0.3)).toBeNull();
    expect(solve(firstPutt, 0)).not.toBeNull();
  });

  test('renvoie null quand aucun tir n’atteint le green', () => {
    const unreachable = normalizeHole({ id: 'u', name: 'u', par: 2, tee: [500, 500], hole: { x: 5000, y: 5000 }, bodies: [] });
    expect(solve(unreachable, 0)).toBeNull();
  });
});
