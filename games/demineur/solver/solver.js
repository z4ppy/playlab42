/**
 * Point d'entrée du solveur : analyse d'une vue et conseil du meilleur coup.
 *
 * Tout part de la vue joueur (`getPlayerView`) : le solveur ne voit jamais
 * les mines cachées. Il sert à trois usages :
 * - l'indice et le bot « Solveur » (`adviseMove`) ;
 * - la superposition des probabilités (`analyze`) ;
 * - la génération sans hasard (`findSafeCells`, via `playthrough.js`).
 */
import { readBoard } from './board-reader.js';
import { deduce } from './deductions.js';
import { computeProbabilities } from './probabilities.js';
import { defaultLabel, explainStep, formatPercent, plural } from './explanations.js';

/**
 * @typedef {import('./board-reader.js').SolverInput} SolverInput
 * @typedef {import('./deductions.js').Step} Step
 * @typedef {import('./explanations.js').CellLabel} CellLabel
 *
 * @typedef {SolverInput & {status?: string}} AdvisorView
 *
 * @typedef {Object} Analysis
 * @property {Map<number, 'safe'|'mine'>} known - Déductions logiques (hors énumération).
 * @property {Step[]} steps - Toutes les certitudes, dans l'ordre du raisonnement.
 * @property {(number|null)[]} probabilities - Risque de mine par case (null si ouverte).
 * @property {boolean} exact - false si l'énumération a dû se replier sur une estimation.
 *
 * @typedef {Object} Advice
 * @property {'start'|'fix-flag'|'safe'|'flag'|'guess'} kind - Nature du conseil.
 * @property {{type: 'reveal'|'toggleFlag', index: number}} action - Coup recommandé.
 * @property {number} index - Case concernée.
 * @property {string} reason - Explication principale.
 * @property {string[]} because - Déductions préalables, si elles ne sont pas visibles.
 * @property {number|null} probability - Risque de mine de la case (pour un pari).
 * @property {number[]} candidates - Cases aussi bonnes que `index` (paris à égalité).
 * @property {Step|null} step - Étape logique justifiant le coup.
 */

/** Écart en dessous duquel deux risques sont considérés égaux. */
const TIE = 1e-9;
/** Nombre maximum de déductions préalables rappelées dans un conseil. */
const MAX_BECAUSE = 3;

/**
 * Analyse complète : déductions puis probabilités exactes.
 * @param {SolverInput} view - Vue joueur.
 * @param {{nodeBudget?: number}} [options] - Garde-fou d'énumération.
 * @returns {Analysis}
 */
export function analyze(view, options = {}) {
  const board = readBoard(view);
  const { known, steps } = deduce(board);
  const enumeration = computeProbabilities(board, known, options);
  return { known, steps: [...steps, ...enumeration.certain], probabilities: enumeration.probabilities, exact: enumeration.exact };
}

/**
 * Cases prouvées sûres, sans calcul de probabilité si la logique simple suffit.
 * @param {SolverInput} view - Vue (réelle ou simulée).
 * @param {{nodeBudget?: number}} [options] - Garde-fou d'énumération.
 * @returns {number[]} Cases sûres, dans l'ordre du raisonnement.
 */
export function findSafeCells(view, options = {}) {
  const board = readBoard(view);
  const { known, steps } = deduce(board);
  const safe = steps.filter(step => step.result === 'safe').flatMap(step => step.cells);
  if (safe.length > 0) { return safe; }
  return computeProbabilities(board, known, options).certain
    .filter(step => step.result === 'safe').flatMap(step => step.cells);
}

/**
 * Construit un conseil.
 * @param {Partial<Advice> & {kind: Advice['kind'], index: number, type: 'reveal'|'toggleFlag'}} fields - Contenu.
 * @returns {Advice}
 */
function advice({ kind, index, type, reason, because = [], probability = null, candidates = [index], step = null }) {
  return { kind, action: { type, index }, index, reason, because, probability, candidates, step };
}

/**
 * Premier coup : aucune information, mais le moteur garantit une ouverture.
 * @param {AdvisorView} view - Vue avant le premier clic.
 * @param {CellLabel} label - Étiquettes.
 * @returns {Advice}
 */
function startAdvice(view, label) {
  const index = Math.floor(view.height / 2) * view.width + Math.floor(view.width / 2);
  return advice({
    kind: 'start', index, type: 'reveal', probability: 0,
    reason: 'Premier coup sans risque : la grille est créée après votre clic, qui ouvre toujours une zone. '
      + `Le centre ${label(index)} laisse la cascade s'étendre dans toutes les directions.`,
  });
}

/**
 * Déductions préalables qui ont servi à une étape, quand le joueur ne les voit pas encore.
 * Un drapeau posé est considéré comme visible : on ne réexplique pas sa présence.
 * @param {Step} step - Étape à justifier.
 * @param {{steps: Step[], view: AdvisorView, label: CellLabel}} context - Journal et vue.
 * @returns {string[]}
 */
function reasonsBehind(step, context) {
  const producers = new Set();
  const visit = current => current.uses.forEach(cell => {
    if (context.view.cells[cell] === 'flag') { return; }
    const producer = context.steps.find(candidate => candidate.cells.includes(cell));
    if (producer && !producers.has(producer)) {
      producers.add(producer);
      visit(producer);
    }
  });
  visit(step);
  return context.steps.filter(candidate => producers.has(candidate)).slice(0, MAX_BECAUSE)
    .map(candidate => explainStep(candidate, context.view.cells, context.label));
}

/**
 * Première étape d'une nature donnée dont une case porte la marque voulue.
 * @param {{steps: Step[], view: AdvisorView}} context - Journal et vue.
 * @param {'safe'|'mine'} result - Nature recherchée.
 * @param {string} mark - Contenu visible attendu ('hidden' ou 'flag').
 * @returns {{step: Step, index: number}|null}
 */
function firstStep(context, result, mark) {
  for (const step of context.steps) {
    const index = step.result === result ? step.cells.find(cell => context.view.cells[cell] === mark) : undefined;
    if (index !== undefined) { return { step, index }; }
  }
  return null;
}

/**
 * Conseil logique (drapeau faux, case sûre, mine à marquer), dans cet ordre de priorité.
 * @param {{steps: Step[], view: AdvisorView, label: CellLabel}} context - Journal et vue.
 * @returns {Advice|null}
 */
function logicalAdvice(context) {
  const rules = [
    { kind: 'fix-flag', result: 'safe', mark: 'flag', type: 'toggleFlag', prefix: index => `Le drapeau en ${context.label(index)} est faux. ` },
    { kind: 'safe', result: 'safe', mark: 'hidden', type: 'reveal', prefix: () => '' },
    { kind: 'flag', result: 'mine', mark: 'hidden', type: 'toggleFlag', prefix: () => '' },
  ];
  for (const rule of rules) {
    const found = firstStep(context, rule.result, rule.mark);
    if (found) {
      const reason = rule.prefix(found.index) + explainStep(found.step, context.view.cells, context.label);
      return advice({
        kind: rule.kind, index: found.index, type: rule.type, step: found.step, reason,
        because: reasonsBehind(found.step, context), probability: Number(rule.result === 'mine'),
      });
    }
  }
  return null;
}

/**
 * Cases de plus faible risque parmi une liste.
 * @param {number[]} pool - Cases candidates (non vide).
 * @param {(number|null)[]} probabilities - Risques.
 * @returns {{lowest: number, candidates: number[]}}
 */
function safestOf(pool, probabilities) {
  const lowest = Math.min(...pool.map(index => probabilities[index]));
  return { lowest, candidates: pool.filter(index => probabilities[index] - lowest < TIE) };
}

/**
 * Pari : la case fermée (sans drapeau) la moins risquée.
 * S'il ne reste que des cases drapées, un drapeau est forcément faux : on retire le plus douteux.
 * @param {{view: AdvisorView, label: CellLabel, pick: (cells: number[]) => number}} context - Vue et départage.
 * @param {{probabilities: (number|null)[], exact: boolean}} risks - Probabilités.
 * @returns {Advice}
 */
function guessAdvice(context, risks) {
  const { view, label } = context;
  const cellsWith = mark => view.cells.map((_, index) => index).filter(index => view.cells[index] === mark);
  const hidden = cellsWith('hidden');
  if (hidden.length === 0) {
    const { lowest, candidates } = safestOf(cellsWith('flag'), risks.probabilities);
    const index = context.pick(candidates);
    return advice({
      kind: 'fix-flag', index, type: 'toggleFlag', probability: lowest, candidates,
      reason: `Toutes les cases fermées portent un drapeau : il y en a donc un de trop. Le plus douteux est en ${label(index)} `
        + `(${formatPercent(lowest)} de risque) : retirez-le.`,
    });
  }
  const { lowest, candidates } = safestOf(hidden, risks.probabilities);
  const index = context.pick(candidates);
  const ties = candidates.length > 1 ? `, à égalité avec ${plural(candidates.length - 1, 'autre case', 'autres cases')}` : '';
  const estimate = risks.exact ? '' : ' (estimation : trop de configurations pour un calcul exact)';
  return advice({
    kind: 'guess', index, type: 'reveal', probability: lowest, candidates,
    reason: `Aucune case n'est sûre : il faut prendre un risque. La case ${label(index)} est la moins risquée${ties} : `
      + `${formatPercent(lowest)} de chances de cacher une mine${estimate}.`,
  });
}

/**
 * Conseille le meilleur coup pour une vue, avec son explication.
 * Priorités : corriger un drapeau prouvé faux, ouvrir une case sûre, marquer une
 * mine certaine, et seulement alors parier sur la case la moins risquée.
 * @param {AdvisorView} view - Vue joueur (`status` 'ready' avant le premier clic).
 * @param {{label?: CellLabel, nodeBudget?: number, pick?: (cells: number[]) => number}} [options] -
 *   Étiquettes, garde-fou d'énumération et départage des paris à égalité (première case par défaut).
 * @returns {Advice}
 */
export function adviseMove(view, { label = defaultLabel(view.width), nodeBudget, pick = cells => cells[0] } = {}) {
  if (view.status === 'ready') { return startAdvice(view, label); }
  const board = readBoard(view);
  const { known, steps } = deduce(board);
  const hasSafe = steps.some(step => step.result === 'safe');
  const risks = hasSafe ? null : computeProbabilities(board, known, { nodeBudget });
  const context = { view, label, pick, steps: risks ? [...steps, ...risks.certain] : steps };
  // Une étape « sûre » a toujours une case fermée ou drapée : logicalAdvice conclut alors seul.
  return logicalAdvice(context) ?? guessAdvice(context, risks);
}
