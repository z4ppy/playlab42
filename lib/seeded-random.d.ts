/**
 * Contrat TypeScript du module JavaScript partagé, sans seconde implémentation.
 * @see openspec/specs/seeded-random/spec.md
 */
export class SeededRandom {
  constructor(seed: number);
  random(): number;
  int(min: number, max: number): number;
  pick<T>(array: T[]): T;
  shuffle<T>(array: T[]): T[];
  chance(probability: number): boolean;
  /** État accumulé, non limité à 32 bits après les tirages. */
  getState(): number;
  clone(): SeededRandom;
  /** Normalise l’état sauvegardé en uint32, comme le constructeur historique. */
  static fromState(state: number): SeededRandom;
}

export default SeededRandom;
