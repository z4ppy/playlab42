/**
 * Scénario déterministe partagé par les tests de caractérisation.
 *
 * @module tools/particle-life/__tests__/seeded-run
 */

import { Simulation } from '../src/Simulation';
import type { Particle, SimulationStats } from '../src/types';

export interface SeededSnapshot {
  attractions: number[][];
  particles: Particle[];
  stats: SimulationStats;
  tick: number;
}

/** Générateur mulberry32 : suite reproductible substituée à Math.random. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runSeeded(seed: number, ticks: number): SeededSnapshot {
  const random = createSeededRandom(seed);
  const originalRandom = Math.random;
  Math.random = random;
  try {
    const sim = new Simulation({
      particleCount: 14,
      groupCount: 3,
      width: 160,
      height: 120,
      interactionRadius: 70,
      friction: 0.08,
      forceStrength: 1.5,
    });
    for (let i = 0; i < ticks; i++) sim.update();
    return {
      attractions: sim.getAttractions().map((row) => [...row]),
      particles: sim.getParticles().map((p) => ({ ...p })),
      stats: sim.getStats(),
      tick: sim.getState().tick,
    };
  } finally {
    Math.random = originalRandom;
  }
}
