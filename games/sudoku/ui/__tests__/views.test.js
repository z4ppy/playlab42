/** @jest-environment jsdom */
import { describe, expect, it, jest } from '@jest/globals';
import { createBoardView, describeCell, remainingCounts } from '../board-view.js';
import { createPadView, describeDigit } from '../pad-view.js';
import { maskOf } from '../../engine/grid.js';

const emptyDecorations = () => ({
  selected: null, highlight: true, conflicts: new Set(), hintFocus: new Set(),
  hintPattern: new Set(), hintTargets: new Set(), aiCells: new Set(),
});

function sampleView() {
  const givens = new Array(81).fill(0);
  givens[0] = 5;
  const values = [...givens];
  values[1] = 5;
  values[2] = 4;
  const notes = new Array(81).fill(0);
  notes[22] = maskOf([2, 7]);
  notes[23] = maskOf([3]);
  return { givens, values, notes, errorCells: [2] };
}

describe('Description vocale des cases', () => {
  it('lit une case vide avec ses notes, une donnée, un chiffre en conflit ou faux', () => {
    const view = sampleView();
    expect(describeCell(view, 22)).toBe('Ligne 3, colonne 5, vide, notes 2 et 7');
    expect(describeCell(view, 23)).toBe('Ligne 3, colonne 6, vide, note 3');
    expect(describeCell(view, 40)).toBe('Ligne 5, colonne 5, vide');
    expect(describeCell(view, 0)).toBe('Ligne 1, colonne 1, 5, donné');
    expect(describeCell(view, 1, { conflict: true })).toBe('Ligne 1, colonne 2, 5, en conflit');
    expect(describeCell(view, 2)).toBe('Ligne 1, colonne 3, 4, erreur signalée');
  });

  it('compte les chiffres restants', () => {
    const counts = remainingCounts(sampleView().values);
    expect(counts[5]).toBe(7);
    expect(counts[4]).toBe(8);
    expect(counts[1]).toBe(9);
    expect(remainingCounts(new Array(81).fill(1))[1]).toBe(0);
  });
});

describe('Vue de la grille', () => {
  it('crée 81 boutons stables et applique les décorations', () => {
    const root = document.createElement('div');
    const onSelect = jest.fn();
    const board = createBoardView(root, onSelect);
    expect(root.querySelectorAll('button.cell')).toHaveLength(81);
    expect(board.cells[0].tabIndex).toBe(0);
    const view = sampleView();
    board.render(view, {
      ...emptyDecorations(), selected: 1, conflicts: new Set([0, 1]),
      hintFocus: new Set([30]), hintPattern: new Set([31]), hintTargets: new Set([32]), aiCells: new Set([2]),
    });
    const first = board.cells[0];
    expect(first.classList.contains('is-given')).toBe(true);
    expect(first.classList.contains('is-same-digit')).toBe(true);
    expect(first.classList.contains('is-related')).toBe(true);
    expect(board.cells[1].classList.contains('is-selected')).toBe(true);
    expect(board.cells[1].getAttribute('aria-current')).toBe('true');
    expect(board.cells[1].classList.contains('is-user')).toBe(true);
    expect(board.cells[2].classList.contains('is-error')).toBe(true);
    expect(board.cells[2].classList.contains('is-ai-move')).toBe(true);
    expect(board.cells[80].classList.contains('is-related')).toBe(false);
    expect(['is-hint-focus', 'is-hint-pattern', 'is-hint-target'].map((name, i) => board.cells[30 + i].classList.contains(name)))
      .toEqual([true, true, true]);
    expect(board.cells[22].querySelector('[data-note="7"]').textContent).toBe('7');
    expect(board.cells[22].querySelector('[data-note="3"]').textContent).toBe('');
    expect(first.querySelector('.cell-value').textContent).toBe('5');
    // Le même nœud est réutilisé d'un rendu à l'autre.
    board.render(view, emptyDecorations());
    expect(root.querySelectorAll('button.cell')[0]).toBe(first);
    expect(first.classList.contains('is-related')).toBe(false);
  });

  it('signale la case activée au clic et au focus', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const onSelect = jest.fn();
    const board = createBoardView(root, onSelect);
    board.cells[40].querySelector('.cell-value').click();
    expect(onSelect).toHaveBeenLastCalledWith(40);
    board.cells[7].focus();
    expect(onSelect).toHaveBeenLastCalledWith(7);
    root.dispatchEvent(new Event('click', { bubbles: true }));
    root.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(2);
    root.remove();
  });
});

describe('Pavé numérique', () => {
  it('affiche les restes, le mode notes et transmet le chiffre', () => {
    const root = document.createElement('div');
    const onDigit = jest.fn();
    const pad = createPadView(root, onDigit);
    const counts = { 1: 0, 2: 1, 3: 3, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };
    pad.render(counts, { notesMode: false, disabled: false });
    expect(pad.buttons[0].getAttribute('aria-label')).toBe('Chiffre 1, tous posés');
    expect(pad.buttons[0].classList.contains('is-complete')).toBe(true);
    expect(pad.buttons[1].getAttribute('aria-label')).toBe('Chiffre 2, 1 restant');
    expect(pad.buttons[2].querySelector('.pad-count').textContent).toBe('3');
    pad.buttons[2].querySelector('.pad-value').click();
    expect(onDigit).toHaveBeenCalledWith(3);
    pad.render(counts, { notesMode: true, disabled: true });
    expect(root.classList.contains('is-notes')).toBe(true);
    expect(pad.buttons[2].disabled).toBe(true);
    pad.buttons[2].click();
    root.click();
    expect(onDigit).toHaveBeenCalledTimes(1);
    expect(describeDigit(4, 2, true)).toBe('Note 4, 2 restants');
  });
});
