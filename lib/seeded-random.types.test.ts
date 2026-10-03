import { expect, test } from '@jest/globals';
import SeededRandom, { SeededRandom as NamedSeededRandom } from './seeded-random.js';

test('le contrat TypeScript conserve les exports et les types génériques du vrai module JS', () => {
  expect(SeededRandom).toBe(NamedSeededRandom);
  const rng: NamedSeededRandom = new SeededRandom(42);
  const objects = [{ id: 'a' }, { id: 'b' }];
  const picked: { id: string } = rng.pick(objects);
  const shuffled: { id: string }[] = rng.shuffle(objects);
  const number: number = rng.int(1, 2) + rng.random() + rng.getState();
  const chance: boolean = rng.chance(0.5);
  const clone: NamedSeededRandom = rng.clone();
  const restored: NamedSeededRandom = SeededRandom.fromState(clone.getState());
  expect(objects).toContain(picked);
  expect(shuffled).toBe(objects);
  expect(Number.isFinite(number)).toBe(true);
  expect(typeof chance).toBe('boolean');
  expect(restored.random()).toBe(clone.random());
});

// Vérifié aussi par tsc explicitement : Jest ne contrôle pas les types.
function rejectInvalidTypes(rng: SeededRandom): void {
  // @ts-expect-error Une seed doit être numérique.
  new SeededRandom('42');
  // @ts-expect-error Un état sauvegardé doit être numérique.
  SeededRandom.fromState('42');
  // @ts-expect-error Le résultat conserve le type de l’élément choisi.
  const value: number = rng.pick(['texte']);
  void value;
}
void rejectInvalidTypes;
