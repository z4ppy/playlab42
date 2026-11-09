import { describe, expect, it } from '@jest/globals';
import { SeededRandom } from '../../../../lib/seeded-random.js';
import { CELL_COUNT, findConflicts } from '../grid.js';
import { countSolutions, solveExact } from '../exact-solver.js';
import { LEVEL_IDS, levelById, ratePuzzle } from '../difficulty.js';
import { MAX_ATTEMPTS, generatePuzzle } from '../generator.js';

const SEEDS = [1, 42, 2026];

describe('Générateur de grilles', () => {
  describe.each(LEVEL_IDS)('niveau %s', (levelId) => {
    it.each(SEEDS)('seed %i : solution unique, symétrie centrale, niveau exact', (seed) => {
      const puzzle = generatePuzzle(new SeededRandom(seed), levelId);
      expect(puzzle.exact).toBe(true);
      expect(puzzle.level).toBe(levelId);
      expect(puzzle.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS[levelId]);
      // Unicité vérifiée par le solveur exact, indépendamment du solveur humain.
      expect(countSolutions(puzzle.givens)).toBe(1);
      expect(solveExact(puzzle.givens)).toEqual(puzzle.solution);
      expect(findConflicts(puzzle.solution)).toEqual([]);
      // Symétrie centrale : la case i est donnée si et seulement si la case 80 - i l'est.
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        expect(puzzle.givens[cell] === 0).toBe(puzzle.givens[CELL_COUNT - 1 - cell] === 0);
        expect([0, puzzle.solution[cell]]).toContain(puzzle.givens[cell]);
      }
      // Classement cohérent : le solveur humain retrouve le même niveau.
      expect(ratePuzzle(puzzle.givens).level).toBe(levelId);
    });
  });

  it('est déterministe : même seed et même niveau donnent la même grille', () => {
    const first = generatePuzzle(new SeededRandom(7), 'medium');
    expect(generatePuzzle(new SeededRandom(7), 'medium')).toEqual(first);
    expect(generatePuzzle(new SeededRandom(8), 'medium').givens).not.toEqual(first.givens);
  });

  it('les niveaux difficiles exigent bien leurs techniques', () => {
    const expert = ratePuzzle(generatePuzzle(new SeededRandom(42), 'expert').givens);
    expect(Object.keys(expert.techniques)).toEqual(expect.arrayContaining([expect.stringMatching(/xWing|xyWing|swordfish/)]));
    const easy = ratePuzzle(generatePuzzle(new SeededRandom(42), 'easy').givens);
    expect(Object.keys(easy.techniques).every((id) => ['hiddenSingle', 'nakedSingle'].includes(id))).toBe(true);
  });

  it('se replie sur la meilleure grille obtenue quand les essais sont épuisés', () => {
    const results = [1, 2, 3, 4, 5].map((seed) => generatePuzzle(new SeededRandom(seed), 'expert', 1));
    expect(results.every((puzzle) => puzzle.attempts === 1)).toBe(true);
    const fallbacks = results.filter((puzzle) => !puzzle.exact);
    expect(fallbacks.length).toBeGreaterThan(0);
    for (const puzzle of fallbacks) {
      expect(levelById(puzzle.level).rank).toBeLessThan(4);
      expect(countSolutions(puzzle.givens)).toBe(1);
    }
  });
});
