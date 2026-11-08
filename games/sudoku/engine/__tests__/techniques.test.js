/**
 * Chaque technique est testée sur un fragment construit à la main : on part d'un
 * plateau où tout est possible, puis on retire des candidats pour faire apparaître
 * exactement le motif recherché. On vérifie la déduction ET son explication.
 */

import { describe, expect, it } from '@jest/globals';
import { BOXES, COLUMNS, ROWS, cellAt, digitBit, maskOf } from '../grid.js';
import { findHiddenSingle, findNakedSingle } from '../techniques/singles.js';
import { findBoxLineReduction, findPointing } from '../techniques/intersections.js';
import { findHiddenSubset, findNakedSubset } from '../techniques/subsets.js';
import { findFish } from '../techniques/fish.js';
import { findXYWing } from '../techniques/wings.js';
import { TECHNIQUES, techniqueById } from '../techniques/index.js';
import { eliminationsText, explainStep, listText } from '../explain.js';
import { openBoard, removeCandidate } from './fixtures.js';

const eliminated = (step) => step.eliminations.map(({ cell, value }) => `${cell}:${value}`).sort();
const expected = (cells, values) => cells.flatMap((cell) => values.map((value) => `${cell}:${value}`)).sort();
const except = (cells, excluded) => cells.filter((cell) => !excluded.includes(cell));

describe('Singletons', () => {
  it('singleton caché : dans la boîte 4, le 6 n’a qu’une place (ligne 5, colonne 2)', () => {
    const board = openBoard();
    const target = cellAt(4, 1);
    removeCandidate(board, BOXES[3].cells, 6, [target]);
    const step = findHiddenSingle(board);
    expect(step).toMatchObject({
      technique: 'hiddenSingle', placements: [{ cell: target, value: 6 }],
      units: [{ type: 'box', index: 3 }], eliminations: [],
    });
    const text = explainStep(step);
    expect(text.hint).toBe('Regardez la boîte 4 : où peut aller le 6 ?');
    expect(text.detail).toContain('Dans la boîte 4, le 6 ne peut aller qu\'en ligne 5, colonne 2');
    expect(text.detail).toContain('(Singleton caché)');
  });

  it('singleton caché : cherche aussi dans les lignes puis les colonnes', () => {
    const board = openBoard();
    removeCandidate(board, COLUMNS[8].cells, 4, [cellAt(2, 8)]);
    expect(findHiddenSingle(board)).toMatchObject({
      placements: [{ cell: cellAt(2, 8), value: 4 }], units: [{ type: 'column', index: 8 }],
    });
  });

  it('singleton nu : une case qui n’a plus qu’un candidat', () => {
    const board = openBoard();
    board.candidates[cellAt(4, 1)] = digitBit(6);
    const step = findNakedSingle(board);
    expect(step).toMatchObject({ technique: 'nakedSingle', placements: [{ cell: cellAt(4, 1), value: 6 }] });
    expect(explainStep(step).detail).toContain('il ne reste que le 6 (Singleton nu)');
    expect(explainStep(step).hint).toContain('ligne 5, colonne 2');
  });

  it('ne trouvent rien quand tout reste possible', () => {
    expect(findHiddenSingle(openBoard())).toBeNull();
    expect(findNakedSingle(openBoard())).toBeNull();
  });
});

describe('Intersections', () => {
  it('pointage : le 3 de la boîte 1 n’est que sur la ligne 1 → retiré du reste de la ligne', () => {
    const board = openBoard();
    removeCandidate(board, BOXES[0].cells, 3, [cellAt(0, 0), cellAt(0, 1)]);
    const step = findPointing(board);
    expect(step.technique).toBe('pointing');
    expect(step.units).toEqual([{ type: 'box', index: 0 }, { type: 'row', index: 0 }]);
    expect(eliminated(step)).toEqual(expected([3, 4, 5, 6, 7, 8], [3]));
    expect(explainStep(step).detail).toBe(
      'Dans la boîte 1, le 3 n\'est possible que sur la ligne 1 (L1C1 et L1C2). '
      + 'Le 3 de la ligne 1 sera donc dans la boîte 1 : on retire le 3 de L1C4, L1C5, L1C6, L1C7, L1C8 et L1C9 (Pointage).',
    );
  });

  it('pointage : fonctionne aussi le long d’une colonne', () => {
    const board = openBoard();
    removeCandidate(board, BOXES[8].cells, 7, [cellAt(6, 8), cellAt(8, 8)]);
    const step = findPointing(board);
    expect(step.units[1]).toEqual({ type: 'column', index: 8 });
    expect(eliminated(step)).toEqual(expected(except(COLUMNS[8].cells, BOXES[8].cells), [7]));
  });

  it('réduction boîte-ligne : le 3 de la ligne 5 n’est que dans la boîte 4', () => {
    const board = openBoard();
    removeCandidate(board, ROWS[4].cells, 3, [cellAt(4, 0), cellAt(4, 1)]);
    const step = findBoxLineReduction(board);
    expect(step.technique).toBe('boxLineReduction');
    expect(step.units).toEqual([{ type: 'row', index: 4 }, { type: 'box', index: 3 }]);
    expect(eliminated(step)).toEqual(expected(except(BOXES[3].cells, ROWS[4].cells), [3]));
    expect(explainStep(step).hint).toBe('Regardez où peut aller le 3 sur la ligne 5.');
    expect(explainStep(step).detail).toContain('(Réduction boîte-ligne)');
  });

  it('ignorent un alignement qui n’élimine rien', () => {
    const board = openBoard();
    removeCandidate(board, BOXES[0].cells, 3, [cellAt(0, 0), cellAt(0, 1)]);
    removeCandidate(board, ROWS[0].cells, 3, [cellAt(0, 0), cellAt(0, 1)]);
    // Le 3 est aligné dans la boîte ET la ligne : rien à retirer dans aucune des deux.
    expect(findPointing(board)).toBeNull();
    expect(findBoxLineReduction(board)).toBeNull();
  });
});

describe('Sous-ensembles', () => {
  it('paire nue : L3C1 et L3C4 = {2, 7} → 2 et 7 retirés du reste de la ligne 3', () => {
    const board = openBoard();
    board.candidates[cellAt(2, 0)] = maskOf([2, 7]);
    board.candidates[cellAt(2, 3)] = maskOf([2, 7]);
    const step = findNakedSubset(board, 2);
    expect(step).toMatchObject({ technique: 'nakedPair', cells: [18, 21], digits: [2, 7], units: [{ type: 'row', index: 2 }] });
    expect(eliminated(step)).toEqual(expected(except(ROWS[2].cells, [18, 21]), [2, 7]));
    expect(explainStep(step).detail).toContain('Dans la ligne 3, les cases L3C1 et L3C4 ne peuvent contenir que 2 et 7');
  });

  it('triplet nu : {1,2}, {2,3}, {1,3} dans la boîte 9', () => {
    const board = openBoard();
    const cells = [cellAt(6, 6), cellAt(7, 7), cellAt(8, 8)];
    [[1, 2], [2, 3], [1, 3]].forEach((digits, i) => { board.candidates[cells[i]] = maskOf(digits); });
    const step = findNakedSubset(board, 3);
    expect(step).toMatchObject({ technique: 'nakedTriple', cells, digits: [1, 2, 3], units: [{ type: 'box', index: 8 }] });
    expect(eliminated(step)).toEqual(expected(except(BOXES[8].cells, cells), [1, 2, 3]));
    expect(explainStep(step).hint).toBe('Regardez la boîte 9 : 3 cases s\'y partagent seulement 3 candidats.');
  });

  it('paire cachée : dans la colonne 2, le 4 et le 8 ne vont qu’en L1C2 et L6C2', () => {
    const board = openBoard();
    const cells = [cellAt(0, 1), cellAt(5, 1)];
    removeCandidate(board, COLUMNS[1].cells, 4, cells);
    removeCandidate(board, COLUMNS[1].cells, 8, cells);
    const step = findHiddenSubset(board, 2);
    expect(step).toMatchObject({ technique: 'hiddenPair', cells, digits: [4, 8], units: [{ type: 'column', index: 1 }] });
    expect(eliminated(step)).toEqual(expected(cells, [1, 2, 3, 5, 6, 7, 9]));
    expect(explainStep(step).detail).toContain('les chiffres 4 et 8 ne peuvent aller que dans L1C2 et L6C2');
  });

  it('triplet caché : 1, 2 et 3 limités à trois cases de la ligne 1', () => {
    const board = openBoard();
    const cells = [cellAt(0, 0), cellAt(0, 4), cellAt(0, 8)];
    [1, 2, 3].forEach((value) => removeCandidate(board, ROWS[0].cells, value, cells));
    const step = findHiddenSubset(board, 3);
    expect(step).toMatchObject({ technique: 'hiddenTriple', cells, digits: [1, 2, 3] });
    expect(eliminated(step)).toEqual(expected(cells, [4, 5, 6, 7, 8, 9]));
  });

  it('ne signalent pas un sous-ensemble sans élimination possible', () => {
    const board = openBoard();
    board.candidates[cellAt(2, 0)] = maskOf([2, 7]);
    board.candidates[cellAt(2, 3)] = maskOf([2, 7]);
    removeCandidate(board, ROWS[2].cells, 2, [18, 21]);
    removeCandidate(board, ROWS[2].cells, 7, [18, 21]);
    expect(findNakedSubset(board, 2)).toBeNull();
    expect(findHiddenSubset(openBoard(), 2)).toBeNull();
  });
});

describe('Poissons et ailes', () => {
  it('X-Wing : le 5 limité aux colonnes 3 et 8 sur les lignes 2 et 7', () => {
    const board = openBoard();
    const corners = [cellAt(1, 2), cellAt(1, 7), cellAt(6, 2), cellAt(6, 7)];
    removeCandidate(board, ROWS[1].cells, 5, corners);
    removeCandidate(board, ROWS[6].cells, 5, corners);
    const step = findFish(board, 2);
    expect(step).toMatchObject({ technique: 'xWing', cells: corners, digits: [5] });
    expect(step.units).toEqual([
      { type: 'row', index: 1 }, { type: 'row', index: 6 },
      { type: 'column', index: 2 }, { type: 'column', index: 7 },
    ]);
    const targets = except([...COLUMNS[2].cells, ...COLUMNS[7].cells], corners);
    expect(eliminated(step)).toEqual(expected(targets, [5]));
    const text = explainStep(step);
    expect(text.hint).toBe('Regardez les places du 5 dans les lignes 2 et 7.');
    expect(text.detail).toContain('Dans les lignes 2 et 7, le 5 n\'est possible que dans les colonnes 3 et 8');
    expect(text.detail).toContain('(X-Wing)');
  });

  it('X-Wing en colonnes : les rôles des lignes et des colonnes s’échangent', () => {
    const board = openBoard();
    const corners = [cellAt(0, 0), cellAt(0, 4), cellAt(3, 0), cellAt(3, 4)];
    removeCandidate(board, COLUMNS[0].cells, 9, corners);
    removeCandidate(board, COLUMNS[4].cells, 9, corners);
    const step = findFish(board, 2);
    expect(step.units.slice(0, 2)).toEqual([{ type: 'column', index: 0 }, { type: 'column', index: 4 }]);
    expect(eliminated(step)).toEqual(expected(except([...ROWS[0].cells, ...ROWS[3].cells], corners), [9]));
  });

  it('Swordfish : le 9 sur les lignes 1, 5 et 9 limité aux colonnes 2, 6 et 9', () => {
    const board = openBoard();
    const pattern = [cellAt(0, 1), cellAt(0, 5), cellAt(4, 5), cellAt(4, 8), cellAt(8, 1), cellAt(8, 8)];
    [0, 4, 8].forEach((row) => removeCandidate(board, ROWS[row].cells, 9, pattern));
    const step = findFish(board, 3);
    expect(step).toMatchObject({ technique: 'swordfish', cells: pattern, digits: [9] });
    const columns = [...COLUMNS[1].cells, ...COLUMNS[5].cells, ...COLUMNS[8].cells];
    expect(eliminated(step)).toEqual(expected(except(columns, [...ROWS[0].cells, ...ROWS[4].cells, ...ROWS[8].cells]), [9]));
    expect(explainStep(step).detail).toContain('les colonnes 2, 6 et 9');
  });

  it('XY-Wing : pivot {2,7}, pinces {2,5} et {7,5} → le 5 quitte les cases qui voient les deux pinces', () => {
    const board = openBoard();
    const [pivot, first, second] = [cellAt(3, 3), cellAt(3, 8), cellAt(5, 4)];
    board.candidates[pivot] = maskOf([2, 7]);
    board.candidates[first] = maskOf([2, 5]);
    board.candidates[second] = maskOf([5, 7]);
    const step = findXYWing(board);
    expect(step).toMatchObject({ technique: 'xyWing', cells: [pivot, first, second], digits: [2, 7, 5] });
    expect(eliminated(step)).toEqual(expected([cellAt(3, 4), cellAt(3, 5), cellAt(5, 6), cellAt(5, 7), cellAt(5, 8)], [5]));
    expect(explainStep(step).detail).toBe(
      'Le pivot L4C4 vaut 2 ou 7. S\'il vaut 2, L4C9 vaut 5 ; s\'il vaut 7, L6C5 vaut 5. '
      + 'L\'une des deux pinces contient donc le 5 : une case qui voit les deux pinces ne peut pas être 5, '
      + 'donc on retire le 5 de L4C5, L4C6, L6C7, L6C8 et L6C9 (XY-Wing).',
    );
  });

  it('XY-Wing : refuse deux pinces qui partagent le même chiffre du pivot', () => {
    const board = openBoard();
    board.candidates[cellAt(3, 3)] = maskOf([2, 7]);
    board.candidates[cellAt(3, 8)] = maskOf([2, 5]);
    board.candidates[cellAt(5, 4)] = maskOf([2, 5]);
    expect(findXYWing(board)).toBeNull();
    expect(findFish(openBoard(), 2)).toBeNull();
  });
});

describe('Catalogue et textes', () => {
  it('ordonne les techniques de la plus simple à la plus difficile', () => {
    const ranks = TECHNIQUES.map((technique) => technique.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(TECHNIQUES.map((technique) => technique.id)).toEqual(expect.arrayContaining(['xWing', 'swordfish', 'xyWing']));
    expect(() => techniqueById('magie')).toThrow('Technique inconnue');
  });

  it('formate les listes et les éliminations en français', () => {
    expect(listText([])).toBe('');
    expect(listText([4])).toBe('4');
    expect(listText([2, 5, 7])).toBe('2, 5 et 7');
    expect(eliminationsText([{ cell: 0, value: 7 }, { cell: 1, value: 2 }, { cell: 0, value: 2 }]))
      .toBe('le 2 de L1C2 et L1C1 ; le 7 de L1C1');
  });
});
