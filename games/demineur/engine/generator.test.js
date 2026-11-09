/**
 * Tests du générateur : premier clic sûr, mode sans hasard, déterminisme et repli borné.
 */
import { generateMines, placeMines, MAX_NO_GUESS_ATTEMPTS } from './generator.js';
import { LEVELS, adjacentMineCounts, neighborTable, toCoords } from './grid.js';
import { solveFromFirstClick } from '../solver/playthrough.js';
import { SeededRandom } from '../../../lib/seeded-random.js';

const spec = (level, firstIndex, noGuess = true) => ({
  width: level.width, height: level.height, mineCount: level.mines, firstIndex, noGuess,
});

describe('géométrie', () => {
  it('liste les voisins dans l\'ordre de lecture, coins et bords compris', () => {
    expect(neighborTable(3, 3)[4]).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(neighborTable(3, 3)[0]).toEqual([1, 3, 4]);
    expect(neighborTable(3, 2)[5]).toEqual([1, 2, 4]);
    expect(neighborTable(3, 3)).toBe(neighborTable(3, 3));
    expect(toCoords(13, 9)).toEqual({ x: 4, y: 1 });
    expect(adjacentMineCounts(3, 1, [1])).toEqual([1, 0, 1]);
  });
});

describe('placeMines', () => {
  it('tire le bon nombre de mines, triées, hors de la zone du premier clic', () => {
    const rng = new SeededRandom(1);
    for (const index of [0, 40, 80]) {
      const mines = placeMines(spec(LEVELS.beginner, index), rng);
      expect(mines).toHaveLength(10);
      expect(mines).toEqual([...new Set(mines)].sort((a, b) => a - b));
      expect([index, ...neighborTable(9, 9)[index]].some(cell => mines.includes(cell))).toBe(false);
    }
  });

  it('ne protège que le premier clic quand la grille est trop dense pour sa zone', () => {
    const mines = placeMines({ width: 3, height: 3, mineCount: 8, firstIndex: 4, noGuess: false }, new SeededRandom(1));
    expect(mines).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
});

describe('generateMines', () => {
  it('mode classique : un seul tirage, sans garantie', () => {
    const result = generateMines(spec(LEVELS.expert, 0, false), new SeededRandom(3));
    expect(result).toMatchObject({ attempts: 1, guaranteed: false });
    expect(result.mines).toHaveLength(99);
  });

  it.each(Object.values(LEVELS))('mode sans hasard ($label) : le solveur résout la grille depuis le premier clic', (level) => {
    for (const seed of [1, 2, 3]) {
      const first = Math.floor(level.height / 2) * level.width + Math.floor(level.width / 2);
      const result = generateMines(spec(level, first), new SeededRandom(seed));
      expect(result.guaranteed).toBe(true);
      expect(result.attempts).toBeLessThanOrEqual(MAX_NO_GUESS_ATTEMPTS);
      expect(solveFromFirstClick({ width: level.width, height: level.height, mines: result.mines }, first).solved).toBe(true);
    }
  });

  it('est déterministe : même seed et même clic donnent la même grille et le même état du générateur', () => {
    const rngA = new SeededRandom(77);
    const rngB = new SeededRandom(77);
    const a = generateMines(spec(LEVELS.expert, 17), rngA);
    const b = generateMines(spec(LEVELS.expert, 17), rngB);
    expect(a).toEqual(b);
    expect(rngA.getState()).toBe(rngB.getState());
  });

  it('se replie sur la grille la plus avancée après le nombre maximal d\'essais', () => {
    // 5 × 5 avec 14 mines depuis un coin : presque jamais résoluble sans pari.
    const dense = { width: 5, height: 5, mineCount: 14, firstIndex: 0, noGuess: true };
    const result = generateMines(dense, new SeededRandom(4), { maxAttempts: 3 });
    expect(result).toMatchObject({ attempts: 3, guaranteed: false });
    expect(result.mines).toHaveLength(14);
    // Repli = l'essai qui a ouvert le plus de cases parmi les trois tirages.
    const replay = new SeededRandom(4);
    const tries = [1, 2, 3].map(() => placeMines(dense, replay));
    const opened = tries.map(mines => solveFromFirstClick({ ...dense, mines }, 0).opened);
    expect(result.mines).toEqual(tries[opened.indexOf(Math.max(...opened))]);
  });
});

describe('solveFromFirstClick', () => {
  it('résout une grille logique et s\'arrête sur un pari obligatoire', () => {
    // Mur de mines à droite : tout s'ouvre depuis le coin gauche.
    expect(solveFromFirstClick({ width: 3, height: 1, mines: [2] }, 0)).toEqual({ solved: true, opened: 2 });
    // Deux mines symétriques : 50/50 inévitable après l'ouverture.
    expect(solveFromFirstClick({ width: 4, height: 2, mines: [2, 7] }, 0)).toEqual({ solved: false, opened: 4 });
  });

  it('signale une incohérence si une case « sûre » cachait une mine', () => {
    expect(() => solveFromFirstClick({ width: 3, height: 1, mines: [0] }, 0)).toThrow('Solveur incohérent');
  });
});
