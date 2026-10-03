/**
 * Tests unitaires des fonctions pures de forces.
 *
 * @module tools/particle-life/__tests__/forces
 */

import {
  forceFunction,
  nearestImageDelta,
  pairForce,
  totalForce,
  wrapCoordinate,
} from '../src/forces';
import type { Particle, SimulationConfig } from '../src/types';

const config: SimulationConfig = {
  particleCount: 0,
  groupCount: 2,
  interactionRadius: 50,
  friction: 0,
  forceStrength: 1,
  width: 200,
  height: 100,
};
const attractions = [
  [1, 0.5],
  [-1, 1],
];
const particle = (x: number, y: number, group = 0): Particle => ({ x, y, vx: 0, vy: 0, group });

describe('forceFunction', () => {
  it.each([
    [0, -1],
    [0.15, -0.5],
    [0.6, 0.45],
    [1, 0.15],
  ])('distance normalisée %p → %p', (input, expected) => {
    expect(forceFunction(input)).toBeCloseTo(expected, 12);
  });

  it('bascule de branche à 0,3 sans saut vers la répulsion', () => {
    expect(forceFunction(0.3)).toBeCloseTo(0.15, 12);
    expect(forceFunction(0.2999)).toBeLessThan(0);
  });
});

describe('nearestImageDelta', () => {
  it.each([
    [10, 200, 10],
    [100, 200, 100],
    [101, 200, -99],
    [-100, 200, -100],
    [-101, 200, 99],
  ])('écart %p dans un monde de %p → %p', (delta, size, expected) => {
    expect(nearestImageDelta(delta, size)).toBe(expected);
  });
});

describe('wrapCoordinate', () => {
  it.each([
    [-1, 200, 199],
    [0, 200, 0],
    [199.5, 200, 199.5],
    [200, 200, 0],
    [450, 200, 250],
  ])('%p dans [0, %p[ → %p', (value, size, expected) => {
    expect(wrapCoordinate(value, size)).toBe(expected);
  });
});

describe('pairForce', () => {
  it('retourne la force vectorielle pondérée par la matrice dirigée', () => {
    const force = pairForce(particle(10, 10, 0), particle(40, 10, 1), attractions, config);
    expect(force?.fx).toBeCloseTo(0.45 * 0.5, 12);
    expect(force?.fy).toBe(0);
  });

  it.each([
    ['trop loin', particle(61, 10)],
    ['trop proche', particle(10.5, 10)],
    ['confondue', particle(10, 10)],
  ])('retourne null pour une paire %s', (_label, other) => {
    expect(pairForce(particle(10, 10), other, attractions, config)).toBeNull();
  });

  it('utilise l\'image torique la plus proche', () => {
    const force = pairForce(particle(5, 10), particle(195, 10), attractions, config);
    expect(force?.fx).toBeCloseTo(1 / 3, 12);
  });

  it('ne modifie pas les particules', () => {
    const a = particle(10, 10);
    const b = particle(30, 10);
    pairForce(a, b, attractions, config);
    expect(a).toEqual({ x: 10, y: 10, vx: 0, vy: 0, group: 0 });
    expect(b).toEqual({ x: 30, y: 10, vx: 0, vy: 0, group: 0 });
  });
});

describe('totalForce', () => {
  it('somme les voisins en ignorant la particule elle-même', () => {
    const particles = [particle(50, 50), particle(80, 50), particle(50, 20), particle(190, 90)];
    const force = totalForce(particles, 0, attractions, config);
    expect(force.fx).toBeCloseTo(0.45, 12);
    expect(force.fy).toBeCloseTo(-0.45, 12);
  });

  it('retourne une force nulle sans voisin', () => {
    expect(totalForce([particle(1, 1)], 0, attractions, config)).toEqual({ fx: 0, fy: 0 });
  });
});
