import { describe, expect, it } from '@jest/globals';
import { SeededRandom } from '../../../../lib/seeded-random.js';
import {
  BOXES, CELL_COUNT, PEERS, UNITS, cellLongName, cellName, columnOf, combinations, computeCandidates,
  countDigits, digitsOf, findConflicts, formatGrid, isGridArray, maskOf, parseGrid, rowOf, seesEachOther,
  singleDigit, unitCells, unitName,
} from '../grid.js';
import { countSolutions, createSolvedGrid, findSolution, solveExact } from '../exact-solver.js';
import { applyStep, createBoard, findNextStep, findPlacementChain, hasContradiction, solveLogically } from '../human-solver.js';
import { LEVELS, isLevelId, levelById, ratePuzzle, techniquesByLevel } from '../difficulty.js';
import { INKALA, classicGivens, classicSolution } from './fixtures.js';

const isValidSolution = (grid) => isGridArray(grid) && !grid.includes(0) && findConflicts(grid).length === 0;

describe('Grille : géométrie et notations', () => {
  it('décrit 27 unités de 9 cases et 20 pairs par case', () => {
    expect(UNITS).toHaveLength(27);
    expect(UNITS.every((unit) => unit.cells.length === 9)).toBe(true);
    expect(PEERS.every((peers) => peers.length === 20)).toBe(true);
    expect(BOXES[4].cells).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
    expect(unitCells({ type: 'column', index: 2 })).toEqual([2, 11, 20, 29, 38, 47, 56, 65, 74]);
    expect(seesEachOther(0, 80)).toBe(false);
    expect(seesEachOther(0, 20)).toBe(true);
    expect(seesEachOther(5, 5)).toBe(false);
  });

  it('manipule les masques de chiffres', () => {
    expect(maskOf([2, 7])).toBe(0b001000010);
    expect(digitsOf(0b001000010)).toEqual([2, 7]);
    expect(countDigits(0x1ff)).toBe(9);
    expect(singleDigit(maskOf([6]))).toBe(6);
  });

  it('lit et écrit une grille, et refuse un format invalide', () => {
    const text = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
    expect(formatGrid(parseGrid(text))).toBe(text);
    expect(parseGrid(text.replaceAll('.', '0'))).toEqual(parseGrid(text));
    expect(() => parseGrid('123')).toThrow('81 caractères');
    expect(() => parseGrid(`${text.slice(0, 80)}x`)).toThrow();
    expect(isGridArray(new Array(81).fill(10))).toBe(false);
    expect(isGridArray('x')).toBe(false);
  });

  it('nomme cases et unités en numérotation humaine', () => {
    expect(cellName(37)).toBe('L5C2');
    expect(cellLongName(37)).toBe('ligne 5, colonne 2');
    expect(rowOf(37)).toBe(4);
    expect(columnOf(37)).toBe(1);
    expect(unitName({ type: 'box', index: 3 })).toBe('la boîte 4');
  });

  it('calcule candidats et conflits', () => {
    const givens = classicGivens();
    const candidates = computeCandidates(givens);
    expect(candidates[0]).toBe(0);
    // L1C3 : la ligne 1 a 5, 3, 7 ; la colonne 3 a 8 ; la boîte 1 a 5, 3, 6, 9, 8 → {1, 2, 4}.
    expect(digitsOf(candidates[2])).toEqual([1, 2, 4]);
    expect(findConflicts(givens)).toEqual([]);
    const broken = [...givens];
    broken[2] = 5;
    expect(findConflicts(broken)).toEqual([0, 2]);
  });

  it('énumère les combinaisons dans l’ordre lexicographique', () => {
    expect([...combinations([1, 2, 3, 4], 2)]).toEqual([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]);
    expect([...combinations([1, 2], 3)]).toEqual([]);
  });
});

describe('Solveur exact (retour sur trace avec masques de bits)', () => {
  it('résout une grille connue', () => {
    expect(solveExact(classicGivens())).toEqual(classicSolution());
    const { solution, nodes } = findSolution(classicGivens());
    expect(solution).toEqual(classicSolution());
    expect(nodes).toBeGreaterThan(0);
  });

  it('résout aussi une grille très difficile pour un humain', () => {
    const solution = solveExact(parseGrid(INKALA));
    expect(isValidSolution(solution)).toBe(true);
    expect(countSolutions(parseGrid(INKALA))).toBe(1);
  });

  it('compte 0, 1 ou au moins 2 solutions', () => {
    expect(countSolutions(classicGivens())).toBe(1);
    // Doublon dans les données : aucune solution.
    const duplicate = classicGivens();
    duplicate[2] = 5;
    expect(countSolutions(duplicate)).toBe(0);
    expect(findSolution(duplicate)).toEqual({ solution: null, nodes: 0 });
    // Chiffre compatible localement mais faux (L1C3 vaut 4) : aucune solution, sans doublon.
    const wrong = classicGivens();
    wrong[2] = 1;
    expect(findConflicts(wrong)).toEqual([]);
    expect(countSolutions(wrong)).toBe(0);
    expect(solveExact(wrong)).toBeNull();
    // Grille vide : le comptage s'arrête à la limite demandée.
    const empty = new Array(CELL_COUNT).fill(0);
    expect(countSolutions(empty)).toBe(2);
    expect(countSolutions(empty, 5)).toBe(5);
  });

  it('détecte plusieurs solutions quand deux chiffres sont interchangeables', () => {
    // Sans aucun 1 ni 2, la solution et sa copie où 1 et 2 sont échangés restent valides.
    const solution = classicSolution();
    const grid = solution.map((value) => (value <= 2 ? 0 : value));
    const swapped = solution.map((value) => (value <= 2 ? 3 - value : value));
    expect(isValidSolution(swapped)).toBe(true);
    expect(countSolutions(grid)).toBe(2);
    expect(countSolutions(grid, 1)).toBe(1);
  });

  it('tire des grilles complètes valides et reproductibles', () => {
    const first = createSolvedGrid(new SeededRandom(1));
    expect(isValidSolution(first)).toBe(true);
    expect(createSolvedGrid(new SeededRandom(1))).toEqual(first);
    expect(createSolvedGrid(new SeededRandom(2))).not.toEqual(first);
  });
});

describe('Solveur humain', () => {
  it('résout la grille classique par singletons uniquement', () => {
    const result = solveLogically(classicGivens());
    expect(result.status).toBe('solved');
    expect(result.values).toEqual(classicSolution());
    expect(result.hardestRank).toBe(1);
    // Les singletons cachés, cherchés en premier, suffisent ici.
    expect(new Set(result.steps.map((step) => step.technique))).toEqual(new Set(['hiddenSingle']));
  });

  it('reste bloqué sur une grille hors de portée de ses techniques', () => {
    const result = solveLogically(parseGrid(INKALA));
    expect(result.status).toBe('stuck');
    expect(result.values).toContain(0);
    expect(ratePuzzle(parseGrid(INKALA))).toMatchObject({ level: null, rank: 0 });
  });

  it('respecte un rang maximal', () => {
    const board = createBoard(new Array(CELL_COUNT).fill(0));
    expect(findNextStep(board, 1)).toBeNull();
  });

  it('détecte les contradictions', () => {
    expect(hasContradiction(createBoard(classicGivens()))).toBe(false);
    const duplicate = classicGivens();
    duplicate[2] = 5;
    expect(hasContradiction(createBoard(duplicate))).toBe(true);
    expect(solveLogically(duplicate).status).toBe('contradiction');
    const board = createBoard(classicGivens());
    board.candidates[2] = 0;
    expect(hasContradiction(board)).toBe(true);
    const missing = createBoard(new Array(CELL_COUNT).fill(0));
    missing.candidates = missing.candidates.map((mask, cell) => (cell < 9 ? mask & ~1 : mask));
    // Le 1 n'a plus de place dans la ligne 1.
    expect(hasContradiction(missing)).toBe(true);
  });

  it('refuse une grille pleine mais incohérente', () => {
    const swapped = classicSolution();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(solveLogically(swapped)).toMatchObject({ status: 'contradiction', steps: [] });
  });

  it('applique une pose en retirant le chiffre des pairs', () => {
    const board = createBoard(new Array(CELL_COUNT).fill(0));
    applyStep(board, { placements: [{ cell: 0, value: 4 }], eliminations: [{ cell: 80, value: 9 }] });
    expect(board.values[0]).toBe(4);
    expect(board.candidates[0]).toBe(0);
    expect(digitsOf(board.candidates[1])).not.toContain(4);
    expect(digitsOf(board.candidates[80])).not.toContain(9);
    expect(digitsOf(board.candidates[80])).toContain(4);
  });

  it('enchaîne les déductions jusqu’à la prochaine pose', () => {
    const chain = findPlacementChain(classicGivens());
    expect(chain.status).toBe('placement');
    expect(chain.steps.at(-1).placements).toHaveLength(1);
    expect(findPlacementChain(classicSolution())).toEqual({ status: 'solved', steps: [] });
    expect(findPlacementChain(parseGrid(INKALA)).status).toBe('stuck');
    const duplicate = classicGivens();
    duplicate[2] = 5;
    expect(findPlacementChain(duplicate).status).toBe('contradiction');
  });

  it('une résolution complète par la logique prouve l’unicité', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const solution = createSolvedGrid(new SeededRandom(seed));
      const puzzle = solution.map((value, cell) => (cell % 3 === 0 ? 0 : value));
      if (solveLogically(puzzle).status === 'solved') {
        expect(countSolutions(puzzle)).toBe(1);
      }
    }
  });
});

describe('Difficulté', () => {
  it('définit quatre niveaux ordonnés et leurs techniques', () => {
    expect(LEVELS.map((level) => level.label)).toEqual(['Facile', 'Moyen', 'Difficile', 'Expert']);
    expect(isLevelId('expert')).toBe(true);
    expect(isLevelId('impossible')).toBe(false);
    expect(levelById('hard').rank).toBe(3);
    const byLevel = techniquesByLevel();
    expect(byLevel.easy).toEqual(['Singleton caché', 'Singleton nu']);
    expect(byLevel.expert).toEqual(['X-Wing', 'XY-Wing', 'Swordfish']);
  });

  it('classe selon la technique la plus difficile requise, pas selon le nombre de cases vides', () => {
    const rating = ratePuzzle(classicGivens());
    expect(rating).toMatchObject({ level: 'easy', rank: 1 });
    expect(rating.steps).toBe(51);
    expect(Object.keys(rating.techniques)).toEqual(expect.arrayContaining(['hiddenSingle']));
    expect(ratePuzzle(classicSolution())).toMatchObject({ level: 'easy', steps: 0 });
  });
});
