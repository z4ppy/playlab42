import { jest } from '@jest/globals';

// Un solveur qui échoue toujours force le recours à un trou d'initiation.
jest.unstable_mockModule('./solver.js', () => ({ solve: () => null }));
const { generateHole, MAX_ATTEMPTS } = await import('./generator.js');
const { INITIATION } = await import('./levels.js');

test('après douze échecs, reprend un trou d’initiation (hors premier putt) sous son nouvel identifiant', () => {
  expect(MAX_ATTEMPTS).toBe(12);
  const hole = generateHole(7, { id: 'free-7-0', name: 'Libre 1', difficulty: 1 });
  expect(hole).toMatchObject({ id: 'free-7-0', name: 'Libre 1', fallback: true });
  expect(INITIATION.slice(1).map(raw => raw.reference)).toContainEqual(hole.reference);
  expect(generateHole(7, { id: 'free-7-0', name: 'Libre 1', difficulty: 1 })).toEqual(hole);
});
