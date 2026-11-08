/**
 * Solveur Klondike à information complète.
 *
 * Recherche en profondeur d'abord (DFS) :
 * 1. un coup sûr vers une fondation (`findSafeMove`) est imposé, sans branche ;
 * 2. sinon les coups sont essayés du plus prometteur au moins prometteur
 *    (`orderMoves`) : fondations, découverte de cartes cachées, défausse… ;
 * 3. chaque position visitée est mémorisée par sa clé canonique
 *    (`hashBoard`) : une position déjà vue n'est jamais réexplorée, ce qui
 *    coupe les va-et-vient et les tours de talon sans effet ;
 * 4. un budget de nœuds (déterministe) et une échéance optionnelle (pour le
 *    navigateur) bornent la recherche.
 *
 * Le résultat est honnête :
 * - `winnable` : une suite de coups gagnante, rejouable dans le moteur ;
 * - `impossible` : toutes les positions atteignables ont été explorées ;
 * - `unknown` : le budget a été épuisé avant de conclure.
 *
 * Ce solveur exige un plateau sans carte inconnue : il sert au moteur pour
 * choisir des donnes gagnables (une décision du jeu, pas d'un joueur). Les
 * indices du joueur passent par `planner.js`, qui ne raisonne que sur la vue.
 *
 * @module games/solitaire/ai/solver
 */

import { applyMove, isWon, listMoves } from '../engine/rules.js';
import { PROMISING_RANK, findSafeMove, rankMove } from './heuristics.js';
import { hashBoard, isFullyKnown } from './position.js';
import { talonSequences } from './talon.js';

/** Budget par défaut : quelques dixièmes de seconde sur une machine courante. */
export const DEFAULT_MAX_NODES = 50000;

/**
 * @typedef {Object} SolveOptions
 * @property {number} [maxNodes] - Nombre maximal de positions développées
 * @property {number} [deadline] - Instant limite, comparé à `now()`
 * @property {() => number} [now] - Horloge injectée (aucune horloge lue par défaut)
 * @property {boolean} [exhaustive=true] - `false` ignore les simples réarrangements
 *   du tableau et les retours de fondation : bien plus rapide pour trouver une
 *   solution, mais une recherche épuisée ne prouve plus rien (résultat `unknown`).
 *
 * @typedef {Object} SolveResult
 * @property {'winnable'|'impossible'|'unknown'} status
 * @property {import('../engine/rules.js').SolitaireAction[]} [moves] - Suite gagnante
 * @property {number} nodes - Positions développées
 */

/** Chaque pioche préalable retarde un peu une séquence du talon dans l'ordre d'essai. */
const DRAW_ORDER_COST = 5;

/**
 * Coups à essayer depuis une position, chacun sous forme de séquence d'actions :
 * le coup sûr seul, ou bien les coups directs et les séquences du talon,
 * triés du plus prometteur au moins prometteur.
 * @param {import('../engine/rules.js').Board} board
 * @param {boolean} [exhaustive=true] - Garder aussi les coups peu prometteurs
 * @returns {import('../engine/rules.js').SolitaireAction[][]}
 */
export function candidateMoves(board, exhaustive = true) {
  const direct = listMoves(board).filter(move => move.type === 'move');
  const safe = findSafeMove(board, direct);
  if (safe) {
    return [[safe]];
  }
  const ranked = [...direct.map(move => [move]), ...talonSequences(board)].map(sequence => ({
    sequence,
    // Le dernier coup d'une séquence est celui qui compte ; chaque pioche le retarde un peu.
    rank: rankMove(board, sequence[sequence.length - 1]),
    order: rankMove(board, sequence[sequence.length - 1]) - DRAW_ORDER_COST * (sequence.length - 1),
  }));
  return ranked
    .filter(entry => exhaustive || entry.rank >= PROMISING_RANK)
    // Tri stable : à rang égal, l'ordre canonique des règles est conservé.
    .sort((a, b) => b.order - a.order)
    .map(entry => entry.sequence);
}

/** Applique une séquence d'actions déjà légales. */
function applySequence(board, sequence) {
  return sequence.reduce((current, action) => applyMove(current, action).board, board);
}

/**
 * Prépare le développement de la position au sommet de la pile.
 * @returns {'won'|'seen'|'budget'|'expanded'}
 */
function expand(frame, search) {
  if (isWon(frame.board)) {
    return 'won';
  }
  const key = hashBoard(frame.board);
  if (search.seen.has(key)) {
    return 'seen';
  }
  if (search.nodes >= search.maxNodes || search.now() > search.deadline) {
    return 'budget';
  }
  search.seen.add(key);
  search.nodes++;
  frame.moves = candidateMoves(frame.board, search.exhaustive);
  return 'expanded';
}

/**
 * Cherche une suite de coups gagnante.
 * @param {import('../engine/rules.js').Board} board - Plateau entièrement connu
 * @param {SolveOptions} [options]
 * @returns {SolveResult}
 * @throws {Error} Si le plateau contient une carte inconnue
 */
export function solve(board, options = {}) {
  if (!isFullyKnown(board)) {
    throw new Error('Le solveur complet exige un plateau sans carte inconnue.');
  }
  const search = {
    maxNodes: DEFAULT_MAX_NODES, deadline: Infinity, now: () => 0, exhaustive: true, ...options, seen: new Set(), nodes: 0,
  };
  const path = [];
  // Pile explicite plutôt que récursion : une partie peut dépasser 200 coups
  // (chaque pioche en est un) et la profondeur ne doit pas dépendre de la pile JS.
  const stack = [{ board, moves: null, next: 0 }];
  while (stack.length) {
    const frame = stack[stack.length - 1];
    const status = frame.moves === null ? expand(frame, search) : 'expanded';
    if (status === 'won') {
      return { status: 'winnable', moves: path.flat(), nodes: search.nodes };
    }
    if (status === 'budget') {
      return { status: 'unknown', nodes: search.nodes };
    }
    if (status === 'seen' || frame.next >= frame.moves.length) {
      // Retour arrière : on abandonne la position et le coup qui y menait.
      stack.pop();
      path.pop();
      continue;
    }
    const sequence = frame.moves[frame.next++];
    path.push(sequence);
    stack.push({ board: applySequence(frame.board, sequence), moves: null, next: 0 });
  }
  // Une recherche élaguée qui échoue ne prouve pas l'impossibilité.
  return { status: search.exhaustive ? 'impossible' : 'unknown', nodes: search.nodes };
}
