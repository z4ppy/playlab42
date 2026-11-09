/**
 * Conseiller : décide du prochain coup à partir de la SEULE vue du joueur.
 *
 * Utilisé par le bouton « Indice » et par le bot « Logique ». Ordre de priorité :
 * 1. conflit visible (deux chiffres identiques se voient) → effacer ;
 * 2. erreur cachée (chiffre qui contredit la solution) → effacer ;
 * 3. chaîne de déductions humaines jusqu'à la prochaine pose → poser ;
 * 4. aucune technique connue ne s'applique → pose issue du solveur exact.
 *
 * La vue ne contient pas la solution. Pour repérer une erreur cachée, le conseiller
 * recalcule la solution unique à partir des chiffres DONNÉS, information publique :
 * il fait le travail lui-même au lieu de lire un secret du moteur.
 */

import { cellLongName, cellName, findConflicts, unitCells } from './grid.js';
import { solveExact } from './exact-solver.js';
import { explainStep } from './explain.js';
import { findPlacementChain } from './human-solver.js';

/**
 * @typedef {Object} Advice
 * @property {'conflict' | 'mistake' | 'logic' | 'search'} kind
 * @property {{type: 'place', cell: number, value: number} | {type: 'erase', cell: number}} action
 * @property {string} hint Premier temps de l'indice : où regarder.
 * @property {string} detail Second temps : raisonnement complet.
 * @property {string} technique Nom de la technique décisive (affiché pendant la résolution par l'IA).
 * @property {number[]} focusCells Cases à mettre en évidence au premier temps.
 * @property {import('./techniques/shared.js').Step[]} steps Déductions humaines (vide hors `logic`).
 */

const isUserCell = (view, cell) => view.givens[cell] === 0 && view.values[cell] !== 0;

/**
 * Première case remplie par le joueur dont le chiffre diffère de la solution.
 * @param {{givens: number[], values: number[]}} view
 * @param {number[]} solution Solution recalculée depuis les données.
 * @returns {number} Index de la case, ou -1.
 */
export function findMistake(view, solution) {
  return view.values.findIndex((value, cell) => isUserCell(view, cell) && value !== solution[cell]);
}

function adviseConflict(view, conflicts) {
  const cell = conflicts.find((candidate) => isUserCell(view, candidate));
  return {
    kind: 'conflict',
    action: { type: 'erase', cell },
    hint: 'Deux chiffres identiques se voient dans une même ligne, colonne ou boîte.',
    detail: `Le ${view.values[cell]} en ${cellLongName(cell)} entre en conflit avec un chiffre identique : effacez-le.`,
    technique: 'Correction d’un conflit',
    focusCells: conflicts,
    steps: [],
  };
}

function adviseMistake(view, cell) {
  return {
    kind: 'mistake',
    action: { type: 'erase', cell },
    hint: 'Une erreur s’est glissée dans la grille : utilisez « Vérifier » ou relisez vos derniers chiffres.',
    detail: `Le ${view.values[cell]} en ${cellLongName(cell)} contredit la solution unique de la grille : effacez-le.`,
    technique: 'Correction d’une erreur',
    focusCells: [],
    steps: [],
  };
}

/**
 * Zone à montrer au premier temps de l'indice : la région à examiner, sans la réponse.
 * Pour un poisson, les lignes de base ; pour un XY-Wing ou un singleton nu, les cases du motif.
 */
export function focusOf(step) {
  if (step.units.length === 0) {
    return [...step.cells];
  }
  const regions = step.technique === 'xWing' || step.technique === 'swordfish'
    ? step.units.slice(0, step.units.length / 2)
    : step.units.slice(0, 1);
  return [...new Set(regions.flatMap(unitCells))].sort((a, b) => a - b);
}

function adviseLogic(steps) {
  const explanations = steps.map(explainStep);
  const decisive = explanations[0];
  const placement = steps.at(-1).placements[0];
  const conclusion = steps.length > 1
    ? ` On peut alors poser le ${placement.value} en ${cellLongName(placement.cell)}.`
    : '';
  return {
    kind: 'logic',
    action: { type: 'place', cell: placement.cell, value: placement.value },
    hint: decisive.hint,
    detail: explanations
      .map(({ detail }, index) => (index === 0 ? detail : `Ensuite, ${detail[0].toLowerCase()}${detail.slice(1)}`))
      .join(' ') + conclusion,
    technique: explanations.map((explanation) => explanation.name)
      .filter((name, index, names) => names.indexOf(name) === index).join(' → '),
    focusCells: focusOf(steps[0]),
    steps,
  };
}

function adviseSearch(view, solution) {
  const cell = view.values.findIndex((value) => value === 0);
  return {
    kind: 'search',
    action: { type: 'place', cell, value: solution[cell] },
    hint: 'Aucune des techniques de ce solveur ne s’applique ici.',
    detail: `Sans déduction connue, le solveur exact (retour sur trace) donne le ${solution[cell]} en ${cellName(cell)}.`,
    technique: 'Retour sur trace',
    focusCells: [cell],
    steps: [],
  };
}

/**
 * Prochain coup conseillé, ou null si la grille est terminée.
 * @param {import('../engine.js').SudokuView} view
 * @returns {Advice | null}
 */
export function adviseNextMove(view) {
  if (view.gameOver) {
    return null;
  }
  const conflicts = findConflicts(view.values);
  if (conflicts.some((cell) => isUserCell(view, cell))) {
    return adviseConflict(view, conflicts);
  }
  const solution = solveExact(view.givens);
  const mistake = findMistake(view, solution);
  if (mistake !== -1) {
    return adviseMistake(view, mistake);
  }
  if (!view.values.includes(0)) {
    return null;
  }
  const chain = findPlacementChain(view.values);
  return chain.status === 'placement' ? adviseLogic(chain.steps) : adviseSearch(view, solution);
}
