/**
 * Probabilités exactes par énumération des configurations de la frontière.
 *
 * La **frontière** regroupe les cases fermées qui touchent un chiffre ; les
 * autres cases fermées forment l'**intérieur**, sur lequel aucun chiffre ne
 * renseigne. On découpe la frontière en composantes indépendantes (des cases
 * reliées par des chiffres communs), puis on énumère par retour arrière toutes
 * les façons d'y placer des mines en respectant chaque chiffre.
 *
 * Une configuration de la frontière qui utilise k mines laisse R - k mines
 * dans l'intérieur de I cases : elle représente C(I, R - k) grilles complètes.
 * C'est ce poids qui fait intervenir le nombre de mines restantes.
 *
 * Garde-fou : l'énumération est exponentielle dans le pire cas. Au-delà de
 * `nodeBudget` nœuds explorés, on se replie sur une estimation locale (ratio
 * mines/cases du chiffre le plus contraignant, densité moyenne à l'intérieur),
 * marquée `exact: false`, et aucune certitude n'en est tirée.
 */
import { reduceConstraint } from './board-reader.js';

/** Budget par défaut : une fraction de seconde sur un téléphone. */
export const DEFAULT_NODE_BUDGET = 200_000;

/**
 * @typedef {import('./board-reader.js').BoardKnowledge} BoardKnowledge
 * @typedef {import('./board-reader.js').ReducedConstraint} ReducedConstraint
 * @typedef {import('./deductions.js').Step} Step
 *
 * @typedef {Object} Component
 * @property {number[]} cells - Cases de frontière de la composante.
 * @property {ReducedConstraint[]} constraints - Chiffres qui les relient.
 *
 * @typedef {Object} ComponentCount
 * @property {number[]} cells - Cases de la composante.
 * @property {number[]} counts - `counts[k]` : configurations à k mines.
 * @property {number[][]} cellMines - `cellMines[k][i]` : parmi elles, celles où la case i est minée.
 *
 * @typedef {Object} ProbabilityReport
 * @property {(number|null)[]} probabilities - Risque de mine par case (null pour une case ouverte).
 * @property {boolean} exact - false si le garde-fou d'énumération a été atteint.
 * @property {Step[]} certain - Cases prouvées sûres ou minées par l'énumération.
 */

const logFactorials = [0];

/**
 * @param {number} n - Entier positif.
 * @returns {number} ln(n!), mémorisé.
 */
function logFactorial(n) {
  for (let i = logFactorials.length; i <= n; i++) { logFactorials.push(logFactorials[i - 1] + Math.log(i)); }
  return logFactorials[n];
}

/**
 * @param {number} n - Taille de l'ensemble.
 * @param {number} k - Taille du sous-ensemble.
 * @returns {number} ln C(n, k), ou -Infinity si k est hors de [0, n].
 */
export function logChoose(n, k) {
  if (k < 0 || k > n) { return -Infinity; }
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * Regroupe les chiffres qui partagent des cases (parcours en largeur).
 * @param {ReducedConstraint[]} constraints - Contraintes réduites non vides.
 * @returns {Component[]}
 */
export function splitComponents(constraints) {
  const byCell = new Map();
  constraints.forEach((constraint, id) => constraint.cells.forEach(cell => {
    if (!byCell.has(cell)) { byCell.set(cell, []); }
    byCell.get(cell).push(id);
  }));
  const seen = new Set();
  const components = [];
  for (let start = 0; start < constraints.length; start++) {
    if (seen.has(start)) { continue; }
    const ids = [start];
    seen.add(start);
    for (let head = 0; head < ids.length; head++) {
      for (const cell of constraints[ids[head]].cells) {
        for (const id of byCell.get(cell)) {
          if (!seen.has(id)) { seen.add(id); ids.push(id); }
        }
      }
    }
    // Ordre des cases = ordre de découverte : les voisines se suivent, l'élagage est précoce.
    const cells = [...new Set(ids.flatMap(id => constraints[id].cells))];
    components.push({ cells, constraints: ids.map(id => constraints[id]) });
  }
  return components;
}

/**
 * Énumère les configurations d'une composante par retour arrière avec élagage.
 * @param {Component} component - Cases et chiffres.
 * @param {{nodes: number, budget: number}} effort - Compteur partagé (modifié).
 * @returns {ComponentCount|null} null si le budget est épuisé.
 */
export function countComponent(component, effort) {
  const { cells, constraints } = component;
  const position = new Map(cells.map((cell, i) => [cell, i]));
  const touching = cells.map(() => []);
  constraints.forEach((constraint, id) => constraint.cells.forEach(cell => touching[position.get(cell)].push(id)));
  const placed = constraints.map(() => 0);
  const free = constraints.map(constraint => constraint.cells.length);
  const assignment = new Array(cells.length).fill(0);
  const result = { cells, counts: [], cellMines: [] };

  const fits = id => placed[id] <= constraints[id].need && placed[id] + free[id] >= constraints[id].need;
  const assign = (i, value, delta) => touching[i].forEach(id => { free[id] -= delta; placed[id] += value * delta; });
  const record = mines => {
    result.counts[mines] = (result.counts[mines] ?? 0) + 1;
    result.cellMines[mines] ??= new Array(cells.length).fill(0);
    assignment.forEach((value, i) => { result.cellMines[mines][i] += value; });
  };
  const visit = (i, mines) => {
    if (++effort.nodes > effort.budget) { return false; }
    if (i === cells.length) { record(mines); return true; }
    for (const value of [0, 1]) {
      assignment[i] = value;
      assign(i, value, 1);
      const ok = !touching[i].every(fits) || visit(i + 1, mines + value);
      assign(i, value, -1);
      if (!ok) { return false; }
    }
    assignment[i] = 0;
    return true;
  };
  return visit(0, 0) ? densify(result) : null;
}

/**
 * Remplace les trous (k impossibles) par des zéros pour simplifier les calculs.
 * @param {ComponentCount} result - Comptes bruts (modifiés).
 * @returns {ComponentCount}
 */
function densify(result) {
  for (let k = 0; k < result.counts.length; k++) {
    result.counts[k] ??= 0;
    result.cellMines[k] ??= new Array(result.cells.length).fill(0);
  }
  return result;
}

/**
 * Produit de convolution de distributions « nombre de configurations par nombre de mines ».
 * @param {number[][]} distributions - Une distribution par composante.
 * @returns {number[]} Distribution du total.
 */
export function convolve(distributions) {
  return distributions.reduce((total, counts) => {
    const next = new Array(total.length + counts.length - 1).fill(0);
    total.forEach((a, i) => counts.forEach((b, j) => { next[i + j] += a * b; }));
    return next;
  }, [1]);
}

/**
 * Probabilités et certitudes exactes à partir des comptes de chaque composante.
 * @param {ComponentCount[]} counted - Composantes énumérées.
 * @param {{remaining: number, interior: number[]}} rest - Mines restantes et cases intérieures.
 * @returns {{risk: Map<number, number>, certain: Step[]}|null} null si aucune grille n'est compatible.
 */
function combine(counted, rest) {
  const { remaining } = rest;
  const size = rest.interior.length;
  const total = convolve(counted.map(component => component.counts));
  const logWeight = total.map((_, k) => logChoose(size, remaining - k));
  const top = Math.max(...logWeight);
  // weight[k] ∝ C(I, R - k), mis à l'échelle pour rester dans les flottants.
  const weight = logWeight.map(value => (value === -Infinity ? 0 : Math.exp(value - top)));
  const feasible = total.map((count, k) => count > 0 && weight[k] > 0);
  const norm = total.reduce((sum, count, k) => sum + count * weight[k], 0);
  // Vue incohérente (fabriquée à la main) : aucune grille ne la respecte.
  if (!(norm > 0)) { return null; }
  const risk = new Map();
  const certain = [];
  counted.forEach((component, c) => {
    const others = convolve(counted.filter((_, d) => d !== c).map(item => item.counts));
    const context = { others, weight, feasible, norm, remaining };
    component.cells.forEach((cell, i) => {
      risk.set(cell, cellRisk(component, i, context));
      const step = certainty(component, i, context);
      if (step) { certain.push(step); }
    });
  });
  addInterior(rest, { total, weight, norm, feasible }, risk, certain);
  return { risk, certain };
}

/**
 * Risque d'une case de frontière : somme pondérée des configurations où elle est minée.
 * @param {ComponentCount} component - Composante de la case.
 * @param {number} i - Position dans la composante.
 * @param {{others: number[], weight: number[], norm: number}} context - Autres composantes et poids.
 * @returns {number}
 */
function cellRisk(component, i, context) {
  let mined = 0;
  component.cellMines.forEach((row, k) => {
    context.others.forEach((count, j) => { mined += row[i] * count * context.weight[k + j]; });
  });
  return mined / context.norm;
}

/**
 * Nombres de mines k de la composante compatibles avec le reste de la grille.
 * @param {ComponentCount} component - Composante.
 * @param {{others: number[], feasible: boolean[]}} context - Autres composantes.
 * @param {boolean} withCount - Tenir compte du nombre total de mines.
 * @returns {number[]}
 */
function possibleMineCounts(component, context, withCount) {
  return component.counts.map((_, k) => k).filter(k => component.counts[k] > 0
    && (!withCount || context.others.some((count, j) => count > 0 && context.feasible[k + j])));
}

/**
 * Une case est certaine si elle a la même nature dans toutes les configurations possibles.
 * On calcule exactement (entiers), sans dépendre des poids flottants.
 * @param {ComponentCount} component - Composante.
 * @param {number} i - Position de la case.
 * @param {{others: number[], feasible: boolean[], remaining: number}} context - Contexte global.
 * @returns {Step|null}
 */
function certainty(component, i, context) {
  const verdict = withCount => {
    const ks = possibleMineCounts(component, context, withCount);
    if (ks.every(k => component.cellMines[k][i] === 0)) { return 'safe'; }
    return ks.every(k => component.cellMines[k][i] === component.counts[k]) ? 'mine' : null;
  };
  const result = verdict(true);
  if (!result) { return null; }
  const solutions = possibleMineCounts(component, context, true).reduce((sum, k) => sum + component.counts[k], 0);
  return {
    technique: 'enumeration', result, cells: [component.cells[i]], uses: [],
    solutions, remaining: context.remaining, usesCount: verdict(false) !== result,
  };
}

/**
 * Risque et certitude des cases intérieures : elles se partagent les mines restantes.
 * @param {{remaining: number, interior: number[]}} rest - Intérieur.
 * @param {{total: number[], weight: number[], norm: number, feasible: boolean[]}} weights - Distribution.
 * @param {Map<number, number>} risk - Risques (complétés).
 * @param {Step[]} certain - Certitudes (complétées).
 */
function addInterior(rest, weights, risk, certain) {
  const size = rest.interior.length;
  if (size === 0) { return; }
  const expected = weights.total.reduce((sum, count, k) => sum + count * weights.weight[k] * (rest.remaining - k), 0);
  rest.interior.forEach(cell => risk.set(cell, expected / weights.norm / size));
  const left = weights.total.map((_, k) => k).filter(k => weights.feasible[k]).map(k => rest.remaining - k);
  const result = left.every(mines => mines === 0) ? 'safe' : left.every(mines => mines === size) ? 'mine' : null;
  if (result) {
    certain.push({
      technique: 'enumeration', result, cells: rest.interior, uses: [], interior: true,
      solutions: weights.total.reduce((sum, count, k) => sum + (weights.feasible[k] ? count : 0), 0),
      remaining: rest.remaining, usesCount: true,
    });
  }
}

/**
 * Repli quand l'énumération dépasse son budget : estimation locale, non certifiée.
 * @param {ReducedConstraint[]} constraints - Contraintes réduites.
 * @param {{remaining: number, interior: number[]}} rest - Intérieur.
 * @returns {Map<number, number>} Risques estimés.
 */
function estimate(constraints, rest) {
  const risk = new Map();
  for (const constraint of constraints) {
    const ratio = Math.min(1, Math.max(0, constraint.need / constraint.cells.length));
    constraint.cells.forEach(cell => risk.set(cell, Math.max(risk.get(cell) ?? 0, ratio)));
  }
  const frontierMines = [...risk.values()].reduce((sum, value) => sum + value, 0);
  // Sans intérieur, la densité n'est jamais lue : la division par zéro reste sans effet.
  const density = Math.min(1, Math.max(0, (rest.remaining - frontierMines) / rest.interior.length));
  rest.interior.forEach(cell => risk.set(cell, density));
  return risk;
}

/**
 * Calcule le risque de chaque case fermée non encore déduite.
 * @param {BoardKnowledge} board - Connaissances de la vue.
 * @param {ReadonlyMap<number, 'safe'|'mine'>} known - Déductions déjà établies (0 ou 1).
 * @param {{nodeBudget?: number}} [options] - Garde-fou d'énumération.
 * @returns {ProbabilityReport}
 */
export function computeProbabilities(board, known, { nodeBudget = DEFAULT_NODE_BUDGET } = {}) {
  const constraints = board.constraints.map(constraint => reduceConstraint(constraint, known))
    .filter(constraint => constraint.cells.length > 0);
  const frontier = new Set(constraints.flatMap(constraint => constraint.cells));
  const undecided = board.unknown.filter(cell => !known.has(cell));
  const minesFound = [...known.values()].filter(fact => fact === 'mine').length;
  const rest = { remaining: board.mineCount - minesFound, interior: undecided.filter(cell => !frontier.has(cell)) };
  const effort = { nodes: 0, budget: nodeBudget };
  const counted = [];
  const fallback = () => report(board, known, estimate(constraints, rest), { exact: false, certain: [] });
  for (const component of splitComponents(constraints)) {
    const count = countComponent(component, effort);
    if (!count) { return fallback(); }
    counted.push(count);
  }
  const combined = combine(counted, rest);
  return combined ? report(board, known, combined.risk, { exact: true, certain: combined.certain }) : fallback();
}

/**
 * Assemble la carte des risques, case par case.
 * @param {BoardKnowledge} board - Vue.
 * @param {ReadonlyMap<number, 'safe'|'mine'>} known - Déductions.
 * @param {Map<number, number>} risk - Risques calculés.
 * @param {{exact: boolean, certain: Step[]}} meta - Exactitude et certitudes.
 * @returns {ProbabilityReport}
 */
function report(board, known, risk, meta) {
  const probabilities = board.cells.map(() => null);
  board.unknown.forEach(cell => {
    const fact = known.get(cell);
    probabilities[cell] = fact === undefined ? risk.get(cell) : Number(fact === 'mine');
  });
  return { probabilities, ...meta };
}
