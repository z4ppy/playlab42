/**
 * Rendu de la grille : 81 boutons créés une seule fois, puis mis à jour.
 *
 * Garder les mêmes nœuds d'un rendu à l'autre préserve le focus clavier et évite
 * de faire relire toute la grille aux lecteurs d'écran. Ce module ne calcule
 * aucune règle : il affiche la vue du moteur et des décorations fournies par le
 * contrôleur (sélection, conflits, indice).
 */

import { CELL_COUNT, DIGITS, boxOf, columnOf, digitBit, digitsOf, rowOf } from '../engine/grid.js';
import { listText } from '../engine/explain.js';

/**
 * @typedef {Object} BoardDecorations
 * @property {number | null} selected Case sélectionnée.
 * @property {boolean} highlight Surligner ligne, colonne, boîte et chiffres identiques.
 * @property {Set<number>} conflicts Cases en conflit (vide si l'option est désactivée).
 * @property {Set<number>} hintFocus Région à examiner (premier temps de l'indice).
 * @property {Set<number>} hintPattern Cases du motif (second temps).
 * @property {Set<number>} hintTargets Cases où l'indice pose ou retire un chiffre.
 * @property {Set<number>} aiCells Cases modifiées par le dernier coup de l'IA.
 */

/**
 * Description lue par les lecteurs d'écran.
 * Exemples : « Ligne 3, colonne 5, vide, notes 2 et 7 » ; « Ligne 1, colonne 1, 5, donné ».
 * @param {{givens: number[], values: number[], notes: number[], errorCells: number[]}} view
 * @param {number} cell
 * @param {{conflict?: boolean}} [flags]
 * @returns {string}
 */
export function describeCell(view, cell, { conflict = false } = {}) {
  const parts = [`Ligne ${rowOf(cell) + 1}, colonne ${columnOf(cell) + 1}`];
  const value = view.values[cell];
  if (view.givens[cell] !== 0) {
    parts.push(`${value}, donné`);
  } else if (value !== 0) {
    parts.push(String(value));
  } else {
    parts.push('vide');
    const notes = digitsOf(view.notes[cell]);
    if (notes.length > 0) {
      parts.push(`${notes.length > 1 ? 'notes' : 'note'} ${listText(notes)}`);
    }
  }
  if (conflict) {
    parts.push('en conflit');
  }
  if (view.errorCells.includes(cell)) {
    parts.push('erreur signalée');
  }
  return parts.join(', ');
}

/** Case d'une grille vide : un chiffre, ou une mini-grille 3 × 3 de notes. */
function createCell(cell) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.dataset.cell = String(cell);
  button.dataset.row = String(rowOf(cell));
  button.dataset.col = String(columnOf(cell));
  button.tabIndex = cell === 0 ? 0 : -1;
  const value = document.createElement('span');
  value.className = 'cell-value';
  value.setAttribute('aria-hidden', 'true');
  const notes = document.createElement('span');
  notes.className = 'cell-notes';
  notes.setAttribute('aria-hidden', 'true');
  for (const digit of DIGITS) {
    const note = document.createElement('span');
    note.dataset.note = String(digit);
    notes.append(note);
  }
  button.append(value, notes);
  return button;
}

/** Les cases « reliées » à la sélection : même ligne, colonne ou boîte. */
function isRelated(cell, selected) {
  return selected !== null && cell !== selected && (rowOf(cell) === rowOf(selected)
    || columnOf(cell) === columnOf(selected) || boxOf(cell) === boxOf(selected));
}

function stateClasses(view, cell, decorations) {
  const { selected, highlight, conflicts } = decorations;
  const selectedValue = selected === null ? 0 : view.values[selected];
  return {
    'is-given': view.givens[cell] !== 0,
    'is-user': view.givens[cell] === 0 && view.values[cell] !== 0,
    'is-selected': cell === selected,
    'is-related': highlight && isRelated(cell, selected),
    'is-same-digit': highlight && selectedValue !== 0 && view.values[cell] === selectedValue,
    'is-conflict': conflicts.has(cell),
    'is-error': view.errorCells.includes(cell),
  };
}

function decorationClasses(cell, decorations) {
  return {
    'is-hint-focus': decorations.hintFocus.has(cell),
    'is-hint-pattern': decorations.hintPattern.has(cell),
    'is-hint-target': decorations.hintTargets.has(cell),
    'is-ai-move': decorations.aiCells.has(cell),
  };
}

function updateCell(button, view, cell, decorations) {
  const value = view.values[cell];
  button.querySelector('.cell-value').textContent = value === 0 ? '' : String(value);
  for (const note of button.querySelectorAll('[data-note]')) {
    const digit = Number(note.dataset.note);
    note.textContent = value === 0 && view.notes[cell] & digitBit(digit) ? String(digit) : '';
  }
  const classes = { ...stateClasses(view, cell, decorations), ...decorationClasses(cell, decorations) };
  for (const [name, active] of Object.entries(classes)) {
    button.classList.toggle(name, active);
  }
  button.setAttribute('aria-label', describeCell(view, cell, { conflict: decorations.conflicts.has(cell) }));
  button.setAttribute('aria-current', cell === decorations.selected ? 'true' : 'false');
}

/**
 * Construit la grille dans `root`.
 * @param {HTMLElement} root Conteneur (vidé).
 * @param {(cell: number) => void} onSelect Appelé quand une case est activée (clic, Entrée, Espace).
 * @returns {{cells: HTMLButtonElement[], render: (view: object, decorations: BoardDecorations) => void}}
 */
export function createBoardView(root, onSelect) {
  const cells = Array.from({ length: CELL_COUNT }, (_, cell) => createCell(cell));
  root.replaceChildren(...cells);
  // La sélection suit aussi le focus clavier (flèches gérées par board-navigation.js).
  root.addEventListener('focusin', (event) => {
    const cell = cells.indexOf(event.target);
    if (cell >= 0) {
      onSelect(cell);
    }
  });
  root.addEventListener('click', (event) => {
    const cell = cells.indexOf(event.target.closest('.cell'));
    if (cell >= 0) {
      onSelect(cell);
    }
  });
  return {
    cells,
    render(view, decorations) {
      cells.forEach((button, cell) => updateCell(button, view, cell, decorations));
    },
  };
}

/**
 * Nombre de chiffres encore à poser pour chaque valeur (9 exemplaires par grille).
 * @param {number[]} values
 * @returns {Record<number, number>}
 */
export function remainingCounts(values) {
  return Object.fromEntries(DIGITS.map((digit) => [digit, Math.max(0, 9 - values.filter((value) => value === digit).length)]));
}
