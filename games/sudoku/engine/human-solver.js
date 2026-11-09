/**
 * Solveur « humain » : il ne devine jamais, il enchaîne des déductions logiques.
 *
 * Il travaille sur un plateau `{values, candidates}` : les chiffres posés et,
 * pour chaque case vide, le masque de ses candidats. À chaque pas, il applique
 * la PREMIÈRE technique du catalogue (la plus simple) qui produit une déduction :
 * poser un chiffre (singletons) ou retirer des candidats (toutes les autres).
 *
 * Propriété utile : chaque déduction est valable pour toute solution de la grille.
 * Si le solveur remplit la grille jusqu'au bout, la solution est donc unique.
 */

import { ALL_DIGITS, CELL_COUNT, PEERS, UNITS, computeCandidates, digitBit } from './grid.js';
import { TECHNIQUES, techniqueById } from './techniques/index.js';

/** Rang maximal : toutes les techniques du catalogue. */
export const MAX_RANK = 4;

/**
 * Plateau de travail mutable, indépendant du tableau reçu.
 * @param {number[]} values
 * @returns {import('./techniques/shared.js').Board}
 */
export function createBoard(values) {
  return { values: [...values], candidates: computeCandidates(values) };
}

/**
 * Applique un pas au plateau (mutation volontaire : le plateau est une copie de travail).
 * @param {import('./techniques/shared.js').Board} board
 * @param {import('./techniques/shared.js').Step} step
 */
export function applyStep(board, step) {
  for (const { cell, value } of step.placements) {
    board.values[cell] = value;
    board.candidates[cell] = 0;
    for (const peer of PEERS[cell]) {
      board.candidates[peer] &= ~digitBit(value);
    }
  }
  for (const { cell, value } of step.eliminations) {
    board.candidates[cell] &= ~digitBit(value);
  }
}

/**
 * Une unité est incohérente si un chiffre y est posé deux fois, ou si un chiffre
 * non posé n'y a plus aucune case candidate. Tout se calcule par masques.
 */
function isUnitBroken(board, unit) {
  let placed = 0;
  let possible = 0;
  for (const cell of unit.cells) {
    const value = board.values[cell];
    if (value === 0) {
      possible |= board.candidates[cell];
    } else if (placed & digitBit(value)) {
      return true;
    } else {
      placed |= digitBit(value);
    }
  }
  return (placed | possible) !== ALL_DIGITS;
}

/**
 * Détecte une grille impossible : doublon, case vide sans candidat, ou chiffre sans place.
 * @param {import('./techniques/shared.js').Board} board
 * @returns {boolean}
 */
export function hasContradiction(board) {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (board.values[cell] === 0 && board.candidates[cell] === 0) {
      return true;
    }
  }
  return UNITS.some((unit) => isUnitBroken(board, unit));
}

/**
 * Prochaine déduction, par la technique la plus simple qui s'applique.
 * @param {import('./techniques/shared.js').Board} board
 * @param {number} [maxRank=MAX_RANK] Ignore les techniques plus difficiles.
 * @returns {import('./techniques/shared.js').Step | null}
 */
export function findNextStep(board, maxRank = MAX_RANK) {
  for (const technique of TECHNIQUES) {
    if (technique.rank > maxRank) {
      break;
    }
    const step = technique.find(board);
    if (step) {
      return step;
    }
  }
  return null;
}

const isFull = (board) => board.values.every((value) => value !== 0);

/**
 * @typedef {Object} LogicalSolution
 * @property {'solved' | 'stuck' | 'contradiction'} status
 * @property {number[]} values Grille atteinte (complète si résolue).
 * @property {import('./techniques/shared.js').Step[]} steps Déductions, dans l'ordre.
 * @property {number} hardestRank Rang de la technique la plus difficile utilisée (0 si aucune).
 */

/**
 * Résout une grille par la seule logique.
 * @param {number[]} values
 * @param {number} [maxRank=MAX_RANK]
 * @returns {LogicalSolution}
 */
export function solveLogically(values, maxRank = MAX_RANK) {
  const board = createBoard(values);
  const steps = [];
  let hardestRank = 0;
  while (!isFull(board)) {
    if (hasContradiction(board)) {
      return { status: 'contradiction', values: board.values, steps, hardestRank };
    }
    const step = findNextStep(board, maxRank);
    if (!step) {
      return { status: 'stuck', values: board.values, steps, hardestRank };
    }
    hardestRank = Math.max(hardestRank, techniqueById(step.technique).rank);
    steps.push(step);
    applyStep(board, step);
  }
  const status = hasContradiction(board) ? 'contradiction' : 'solved';
  return { status, values: board.values, steps, hardestRank };
}

/**
 * Enchaîne les déductions jusqu'à la prochaine pose de chiffre.
 * Les éliminations intermédiaires (paire nue, X-Wing...) sont conservées dans `steps` :
 * elles justifient la pose finale, qui est le dernier pas de la liste.
 * @param {number[]} values Grille cohérente (sans erreur).
 * @returns {{status: 'placement' | 'stuck' | 'contradiction' | 'solved', steps: import('./techniques/shared.js').Step[]}}
 */
export function findPlacementChain(values) {
  const board = createBoard(values);
  const steps = [];
  if (isFull(board)) {
    return { status: 'solved', steps };
  }
  while (!hasContradiction(board)) {
    const step = findNextStep(board);
    if (!step) {
      return { status: 'stuck', steps };
    }
    steps.push(step);
    if (step.placements.length > 0) {
      return { status: 'placement', steps };
    }
    applyStep(board, step);
  }
  return { status: 'contradiction', steps };
}
