import { readFileSync } from 'node:fs';
import SeededRandom, { SeededRandom as NamedSeededRandom } from './seeded-random.js';

const { vectors } = JSON.parse(readFileSync(
  new URL('../games/triomino/fixtures/rng-legacy.json', import.meta.url), 'utf8',
));

describe('Compatibilité avec le Mulberry32 historique de Triomino', () => {
  test.each(vectors)('conserve les sorties et la consommation pour la seed $seed', vector => {
    const rng = new SeededRandom(vector.seed);
    expect(SeededRandom).toBe(NamedSeededRandom);
    expect(rng.getState()).toBe(vector.initialState);
    expect(Array.from({ length: 8 }, () => rng.random())).toEqual(vector.sequence);
    expect(rng.getState()).toBe(vector.sequenceState);
    expect(rng.int(-3, 5)).toBe(vector.int);
    expect(rng.int(7, 7)).toBe(vector.singletonInt);
    expect(rng.pick(['a', 'b', 'c'])).toBe(vector.pick);
    expect(rng.pick(['seul'])).toBe(vector.singletonPick);
    const array = [0, 1, 2, 3, 4, 5];
    expect(rng.shuffle(array)).toBe(array);
    expect(array).toEqual(vector.shuffled);
    expect(rng.getState()).toBe(vector.finalState);
  });

  test('les tableaux vides ne consomment rien, les bornes et choix uniques consomment un tirage', () => {
    const rng = new SeededRandom(-1);
    const initial = rng.getState();
    expect(() => rng.pick([])).toThrow('Cannot pick from empty array');
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle(['seul'])).toEqual(['seul']);
    expect(rng.getState()).toBe(initial);
    expect(rng.int(2, 2)).toBe(2);
    expect(rng.getState()).toBe(initial + 0x6d2b79f5);
    expect(rng.pick(['seul'])).toBe('seul');
    expect(rng.getState()).toBe(initial + 2 * 0x6d2b79f5);
  });

  test('clone conserve l’état accumulé, fromState conserve sa normalisation historique uint32', () => {
    const rng = new SeededRandom(-1);
    for (let i = 0; i < 8; i++) {
      rng.random();
    }
    const state = rng.getState();
    expect(state).toBeGreaterThan(2 ** 32);
    const clone = rng.clone();
    const restored = SeededRandom.fromState(JSON.parse(JSON.stringify(state)));
    expect(clone.getState()).toBe(state);
    expect(restored.getState()).toBe(state >>> 0);
    const sequence = Array.from({ length: 32 }, () => rng.random());
    expect(Array.from({ length: 32 }, () => clone.random())).toEqual(sequence);
    expect(Array.from({ length: 32 }, () => restored.random())).toEqual(sequence);
    expect(clone.getState()).toBe(rng.getState());
    expect(restored.getState()).toBe((state >>> 0) + 32 * 0x6d2b79f5);
  });
});
