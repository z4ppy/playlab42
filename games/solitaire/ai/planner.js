/**
 * Indices et décisions de l'IA à partir de la seule vue du joueur.
 *
 * La vue cache les cartes face cachée et le talon : on ne peut donc pas
 * « résoudre » la partie. Le planificateur cherche à la place, en profondeur
 * limitée, la meilleure suite de coups qui n'utilise que des cartes visibles :
 * - les pioches sont exclues des plans (la carte piochée est inconnue) ;
 * - un coup qui retourne une carte cachée termine un plan : la suite dépend
 *   d'une carte que personne ne connaît encore ;
 * - chaque position est évaluée par `evaluate` (cartes cachées, fondations,
 *   colonnes vides, réserve), diminuée d'un petit coût par coup ;
 * - les positions déjà vues dans la recherche, ou déjà jouées dans la partie
 *   (`history`), sont écartées : pas de va-et-vient.
 *
 * Si aucun plan n'améliore la position, l'indice devient « piocher » ou
 * « recycler » tant que le talon peut encore montrer du nouveau, sinon
 * « bloqué » : la vue dit honnêtement qu'aucun coup utile n'existe.
 *
 * @module games/solitaire/ai/planner
 */

import { applyMove, isWon, listMoves } from '../engine/rules.js';
import { evaluate, orderMoves } from './heuristics.js';
import { boardFromView, hashBoard } from './position.js';
import { FINAL_TEXT, explainPlan, explainTalon } from './explain.js';

/** Budget par défaut d'un indice : instantané dans un navigateur. */
export const HINT_DEFAULTS = Object.freeze({ maxNodes: 3000, maxDepth: 6 });

/** Coût d'un coup supplémentaire dans un plan : à valeur égale, le plus court gagne. */
const STEP_COST = 1;

/**
 * @typedef {Object} Hint
 * @property {'move'|'draw'|'recycle'|'blocked'|'won'} kind
 * @property {import('../engine/rules.js').SolitaireAction|null} action - Coup conseillé
 * @property {import('../engine/rules.js').SolitaireAction[]} plan - Plan complet (premier coup = `action`)
 * @property {string} explanation - Phrase française pour le joueur
 * @property {string} [goal] - Effet du plan (`reveal`, `foundation`, `empty`, `waste`, `improve`)
 * @property {number} nodes - Positions examinées
 *
 * @typedef {Object} HintOptions
 * @property {number} [maxNodes] - Budget de positions
 * @property {number} [maxDepth] - Longueur maximale d'un plan
 * @property {Set<string>} [history] - Clés `hashBoard` des positions déjà jouées
 * @property {number} [deadline] - Instant limite, comparé à `now()`
 * @property {() => number} [now] - Horloge injectée
 */

/** Coups utilisables dans un plan : tout sauf la pioche et le recyclage. */
function plannableMoves(board) {
  return orderMoves(board, listMoves(board).filter(move => move.type === 'move'));
}

/** Retient le plan s'il bat le meilleur connu (à égalité, le premier trouvé reste). */
function consider(search, plan, board, value) {
  if (value > search.best.value) {
    search.best = { plan, board, value };
  }
}

/** Le budget est-il épuisé ? */
function outOfBudget(search) {
  return search.nodes >= search.maxNodes || search.now() > search.deadline;
}

/**
 * Explore les plans depuis `board` (récursion bornée par `maxDepth`).
 * `depthSeen` garde la profondeur minimale de chaque position : une position
 * revue plus profondément n'apporte rien, revue plus tôt elle est réexplorée.
 */
function explore(search, board, path) {
  for (const move of plannableMoves(board)) {
    if (search.done || outOfBudget(search)) {
      return;
    }
    search.nodes++;
    visit(search, applyMove(board, move), [...path, move]);
  }
}

/** Évalue la position atteinte par `plan`, puis la prolonge si c'est utile. */
function visit(search, outcome, plan) {
  if (isWon(outcome.board)) {
    search.best = { plan, board: outcome.board, value: Infinity };
    search.done = true;
    return;
  }
  const key = hashBoard(outcome.board);
  if (search.history.has(key) || (search.depthSeen.get(key) ?? Infinity) <= plan.length) {
    return;
  }
  search.depthSeen.set(key, plan.length);
  consider(search, plan, outcome.board, evaluate(outcome.board) - STEP_COST * plan.length);
  // Une carte retournée inconnue arrête le plan : la suite dépend d'elle.
  const revealsUnknown = 'flipped' in outcome && outcome.flipped === null;
  if (!revealsUnknown && plan.length < search.maxDepth) {
    explore(search, outcome.board, plan);
  }
}

/** Indice sans déplacement : pioche, recyclage ou blocage. */
function talonHint(view, board, nodes) {
  // Un tour de talon complet sans aucun coup se répéterait à l'identique.
  if (view.stockCount > 0 && view.stalePasses === 0) {
    const action = { type: 'draw' };
    return { kind: 'draw', action, plan: [action], explanation: explainTalon(board, action), nodes };
  }
  if (view.stockCount === 0 && view.waste.length > 0 && view.passMoves > 0) {
    const action = { type: 'recycle' };
    return { kind: 'recycle', action, plan: [action], explanation: explainTalon(board, action), nodes };
  }
  return { kind: 'blocked', action: null, plan: [], explanation: FINAL_TEXT.blocked, nodes };
}

/**
 * Meilleur coup selon la vue du joueur, avec son explication.
 * @param {import('../engine.js').SolitaireView} view - Vue `getPlayerView`
 * @param {HintOptions} [options]
 * @returns {Hint}
 */
export function findHint(view, options = {}) {
  const board = boardFromView(view);
  if (isWon(board)) {
    return { kind: 'won', action: null, plan: [], explanation: FINAL_TEXT.won, nodes: 0 };
  }
  const search = {
    ...HINT_DEFAULTS, deadline: Infinity, now: () => 0, history: new Set(), ...options,
    nodes: 0, done: false, depthSeen: new Map([[hashBoard(board), 0]]),
    best: { plan: [], board, value: evaluate(board) },
  };
  explore(search, board, []);
  const { plan } = search.best;
  if (!plan.length) {
    return talonHint(view, board, search.nodes);
  }
  const { text, goal } = explainPlan(board, plan, search.best.board);
  return { kind: 'move', action: plan[0], plan, explanation: text, goal, nodes: search.nodes };
}

/**
 * Clé de position d'une vue, pour l'historique `history` d'un indice.
 * @param {import('../engine.js').SolitaireView} view
 * @returns {string}
 */
export function viewKey(view) {
  return hashBoard(boardFromView(view));
}
