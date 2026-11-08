/**
 * Recherche du meilleur coup : négamax, élagage alpha-bêta, approfondissement
 * itératif et table de transposition, sur des bitboards.
 *
 * Convention de score (toujours du point de vue du joueur au trait) :
 * - victoire : WIN_SCORE - n, où n est le nombre de jetons posés quand le jeton
 *   gagnant tombe. Gagner plus tôt vaut donc plus ; perdre plus tard coûte moins.
 *   Ce score « absolu » ne dépend pas de la profondeur de recherche, ce qui
 *   permet de le ranger tel quel dans la table de transposition ;
 * - nul par grille pleine : 0 ;
 * - position non résolue à l'horizon : heuristique bornée bien en deçà des
 *   scores de victoire (voir `evaluate`).
 *
 * La recherche est limitée par un budget de nœuds et non par l'horloge : à
 * position et budget égaux, le résultat est identique sur toutes les machines,
 * ce qui rend les bots reproductibles et les tests stables.
 */

import {
  CELLS,
  CENTER_MASK,
  CENTER_ORDER,
  EVEN_ROWS_MASK,
  ODD_ROWS_MASK,
  and,
  andNot,
  columnMask,
  columnsOf,
  moveBit,
  or,
  playableMask,
  popCount,
  shiftRight,
  winningCells,
  xor,
} from './bitboard.js';
import { EXACT, LOWER, TranspositionTable, UPPER } from './transposition-table.js';

// Copies locales des globaux utilisés à chaque nœud (voir bitboard.js).
const { max, min } = Math;
const INFINITY = Number.POSITIVE_INFINITY;

/** Base des scores de victoire. */
export const WIN_SCORE = 10000;

/** Budget par défaut : moins d’une seconde sur un portable récent (≈ 1,5 million de nœuds par seconde mesurés sous Node). */
export const DEFAULT_BUDGET = Object.freeze({ maxDepth: CELLS, maxNodes: 800_000 });

/** Poids de l'heuristique (voir `evaluate`). */
export const WEIGHTS = Object.freeze({ threat: 10, parity: 6, center: 3 });

/** En deçà de cette profondeur restante, le tri coûte plus qu'il ne rapporte. */
const ORDERING_DEPTH = 3;

/**
 * Score d'une victoire obtenue au jeton numéro `stones`.
 * @param {number} stones - Jetons sur la grille après le coup gagnant
 * @returns {number}
 */
export const winScore = (stones) => WIN_SCORE - stones;

/**
 * Indique si un score correspond à une issue forcée (victoire ou défaite).
 * @param {number} score - Score de recherche
 * @returns {boolean}
 */
export const isDecisive = (score) => Math.abs(score) > WIN_SCORE - 2 * CELLS;

/**
 * Évaluation statique d'une position non terminale, pour le joueur au trait.
 *
 * - menaces : cases vides qui compléteraient un alignement de quatre ;
 * - parité : une menace vaut plus sur les lignes que la fin de partie
 *   (zugzwang) permet d'occuper — lignes impaires pour le premier joueur,
 *   paires pour le second ;
 * - centre : la colonne centrale participe au plus grand nombre d'alignements.
 *
 * @param {number} current - Jetons du joueur au trait
 * @param {number} mask - Tous les jetons
 * @param {number} moves - Nombre de jetons posés
 * @param {number} ownCells - Nos cases gagnantes (déjà calculées par l'appelant)
 * @param {number} opponentCells - Cases gagnantes adverses
 * @returns {number} Score borné (|score| < 1000)
 */
export function evaluate(current, mask, moves, ownCells, opponentCells) {
  const firstPlayerToMove = moves % 2 === 0;
  const ownRows = firstPlayerToMove ? ODD_ROWS_MASK : EVEN_ROWS_MASK;
  const opponentRows = firstPlayerToMove ? EVEN_ROWS_MASK : ODD_ROWS_MASK;
  const opponent = xor(current, mask);
  return WEIGHTS.threat * (popCount(ownCells) - popCount(opponentCells))
    + WEIGHTS.parity * (popCount(and(ownCells, ownRows)) - popCount(and(opponentCells, opponentRows)))
    + WEIGHTS.center * (popCount(and(current, CENTER_MASK)) - popCount(and(opponent, CENTER_MASK)));
}

/**
 * Coups qui ne perdent pas immédiatement. Si l'adversaire menace une case
 * jouable, il faut la bloquer ; deux menaces jouables sont imparables.
 * On écarte aussi les coups placés juste sous une case gagnante adverse.
 * @param {number} playable - Cases jouables
 * @param {number} opponentCells - Cases gagnantes adverses
 * @returns {number} Bitboard des coups sûrs (0 si la défaite est inévitable)
 */
export function safeMoves(playable, opponentCells) {
  const forced = and(playable, opponentCells);
  if (forced !== 0 && popCount(forced) > 1) {
    return 0;
  }
  return andNot(forced !== 0 ? forced : playable, shiftRight(opponentCells, 1));
}

/**
 * Type de borne à mémoriser pour un score obtenu dans la fenêtre [alpha, beta].
 * @param {number} score - Meilleur score trouvé
 * @param {number} alpha - Borne basse initiale
 * @param {number} beta - Borne haute
 * @returns {number}
 */
function boundFlag(score, alpha, beta) {
  if (score <= alpha) {
    return UPPER;
  }
  return score >= beta ? LOWER : EXACT;
}

/**
 * Insertion stable par rang décroissant (7 coups au plus : plus rapide qu'un tri).
 * À rang égal, l'ordre d'arrivée — du centre vers les bords — est conservé.
 * @param {number[]} columns - Colonnes déjà triées (modifié en place)
 * @param {number[]} ranks - Rangs correspondants (modifié en place)
 * @param {number} col - Colonne à insérer
 * @param {number} rank - Son rang
 */
function insertByRank(columns, ranks, col, rank) {
  let index = columns.length;
  while (index > 0 && ranks[index - 1] < rank) {
    columns[index] = columns[index - 1];
    ranks[index] = ranks[index - 1];
    index--;
  }
  columns[index] = col;
  ranks[index] = rank;
}

/**
 * @typedef {import('./bitboard.js').BitPosition} BitPosition
 * @typedef {{ maxDepth?: number, maxNodes?: number }} SearchBudget
 *
 * @typedef {Object} SearchResult
 * @property {number[]} bestMoves - Colonnes à égalité de meilleur score
 * @property {number} score - Meilleur score (point de vue du joueur au trait)
 * @property {Record<number, number>} scores - Score par colonne examinée (exact pour les meilleures, majorant sinon)
 * @property {number} depth - Profondeur de la dernière itération complète
 * @property {number} nodes - Nœuds visités au total
 * @property {boolean} solved - Vrai si le score est une issue prouvée (victoire, défaite ou nul en fin de grille)
 */

/**
 * Moteur de recherche réutilisable ; sa table est vidée à chaque analyse.
 */
export class Search {
  /**
   * @param {TranspositionTable} [table] - Table de transposition à utiliser
   */
  constructor(table = new TranspositionTable()) {
    this.table = table;
    this.nodes = 0;
    this.maxNodes = Infinity;
    this.limited = false;
    this.aborted = false;
  }

  /**
   * Approfondissement itératif : profondeur 1, puis 2, 3… tant que le budget
   * le permet. Chaque itération réutilise la table et commence par le meilleur
   * coup précédent, ce qui rend les itérations suivantes bien moins coûteuses.
   * @param {BitPosition} position - Position à analyser (au moins un coup jouable)
   * @param {SearchBudget} [budget] - Profondeur et nœuds maximum
   * @returns {SearchResult}
   */
  run(position, budget = DEFAULT_BUDGET) {
    const { maxDepth = DEFAULT_BUDGET.maxDepth, maxNodes = DEFAULT_BUDGET.maxNodes } = budget;
    this.table.clear();
    Object.assign(this, { nodes: 0, maxNodes, limited: false, aborted: false });
    const result = this.#immediateWin(position) ?? this.#deepen(position, Math.max(1, maxDepth));
    return { ...result, nodes: this.nodes };
  }

  /**
   * Boucle d'approfondissement ; s'arrête sur une issue prouvée ou un budget épuisé.
   * @param {BitPosition} position - Position à analyser
   * @param {number} maxDepth - Profondeur maximum demandée (≥ 1)
   * @returns {Omit<SearchResult, 'nodes'>} Résultat de la dernière itération complète
   */
  #deepen(position, maxDepth) {
    const remaining = CELLS - position.moves;
    let completed = null;
    for (let depth = 1; depth <= Math.min(maxDepth, remaining); depth++) {
      // La première itération va toujours au bout : il faut au moins un coup.
      this.limited = depth > 1;
      const iteration = this.#searchRoot(position, depth, completed?.bestMoves[0]);
      if (!iteration) {
        break;
      }
      completed = iteration;
      if (isDecisive(iteration.score) || depth === remaining) {
        return { ...iteration, solved: true };
      }
    }
    return { ...completed, solved: false };
  }

  /**
   * Raccourci : une victoire en un coup ne demande aucune recherche.
   * @param {BitPosition} position - Position à analyser
   * @returns {SearchResult | null}
   */
  #immediateWin({ current, mask, moves }) {
    const wins = and(playableMask(mask), winningCells(current, mask));
    if (wins === 0) {
      return null;
    }
    const bestMoves = CENTER_ORDER.filter((col) => columnsOf(wins).includes(col));
    const score = winScore(moves + 1);
    return { bestMoves, score, scores: Object.fromEntries(bestMoves.map((col) => [col, score])), depth: 1, solved: true };
  }

  /**
   * Itération à la racine : chaque coup est cherché avec une fenêtre qui
   * révèle les égalités (alpha = meilleur - 1), pour que l'appelant puisse
   * départager les coups équivalents avec son propre générateur aléatoire.
   * @param {BitPosition} position - Position racine
   * @param {number} depth - Profondeur de l'itération
   * @param {number | undefined} previousBest - Meilleur coup de l'itération précédente
   * @returns {Omit<SearchResult, 'nodes' | 'solved'> | null} null si le budget est épuisé
   */
  #searchRoot({ current, mask, moves }, depth, previousBest) {
    const playable = playableMask(mask);
    const safe = safeMoves(playable, winningCells(xor(current, mask), mask));
    const candidates = this.#orderMoves(current, mask, safe !== 0 ? safe : playable, previousBest, depth);
    const scores = {};
    let best = -INFINITY;
    for (const col of candidates) {
      // « 0 - x » plutôt que « -x » : évite le zéro négatif (-0) pour un nul.
      const score = 0 - this.#negamax(xor(current, mask), or(mask, moveBit(mask, col)), moves + 1, depth - 1, -INFINITY, 1 - best);
      if (this.aborted) {
        return null;
      }
      scores[col] = score;
      best = max(best, score);
    }
    const bestMoves = candidates.filter((col) => scores[col] === best);
    return { bestMoves, score: best, scores, depth };
  }

  /**
   * Négamax : la valeur d'une position est l'opposé de la meilleure valeur
   * de ses enfants pour l'adversaire. Un seul code sert aux deux joueurs.
   * @param {number} current - Jetons du joueur au trait
   * @param {number} mask - Tous les jetons
   * @param {number} moves - Jetons posés
   * @param {number} depth - Profondeur restante
   * @param {number} alpha - Score minimum déjà garanti au joueur au trait
   * @param {number} beta - Score au-delà duquel l'adversaire évitera cette ligne
   * @returns {number}
   */
  #negamax(current, mask, moves, depth, alpha, beta) {
    this.nodes++;
    if (this.limited && this.nodes > this.maxNodes) {
      this.aborted = true;
      return 0;
    }
    const playable = playableMask(mask);
    const ownCells = winningCells(current, mask);
    if (and(playable, ownCells) !== 0) {
      return winScore(moves + 1);
    }
    const opponentCells = winningCells(xor(current, mask), mask);
    const safe = safeMoves(playable, opponentCells);
    if (safe === 0) {
      return -winScore(moves + 2);
    }
    if (moves >= CELLS - 2) {
      // Coup sûr disponible et plus assez de cases pour un alignement : nul.
      return 0;
    }
    if (depth === 0) {
      return evaluate(current, mask, moves, ownCells, opponentCells);
    }
    return this.#searchChildren(current, mask, moves, depth, alpha, beta, safe);
  }

  /**
   * Explore les coups sûrs avec élagage alpha-bêta, après consultation de la table.
   * @param {number} current - Jetons du joueur au trait
   * @param {number} mask - Tous les jetons
   * @param {number} moves - Jetons posés
   * @param {number} depth - Profondeur restante (≥ 1)
   * @param {number} alpha - Borne basse
   * @param {number} beta - Borne haute
   * @param {number} safe - Coups sûrs (non nul)
   * @returns {number}
   */
  #searchChildren(current, mask, moves, depth, alpha, beta, safe) {
    const key = current + mask;
    const window = this.#narrowWindow(key, moves, depth, alpha, beta);
    if (window.cutoff !== null) {
      return window.cutoff;
    }
    let best = -INFINITY;
    let bestMove = -1;
    let low = window.alpha;
    for (const col of this.#orderMoves(current, mask, safe, window.move, depth)) {
      const score = 0 - this.#negamax(xor(current, mask), or(mask, moveBit(mask, col)), moves + 1, depth - 1, -window.beta, -low);
      if (this.aborted) {
        return 0;
      }
      if (score > best) {
        best = score;
        bestMove = col;
      }
      low = max(low, score);
      if (low >= window.beta) {
        break;
      }
    }
    this.table.set(key, { depth, score: best, flag: boundFlag(best, alpha, window.beta), move: bestMove });
    return best;
  }

  /**
   * Resserre la fenêtre : on ne peut plus gagner avant le jeton `moves + 3`
   * (aucune victoire immédiate), et la table peut déjà connaître une borne.
   * @param {number} key - Clé de la position
   * @param {number} moves - Jetons posés
   * @param {number} depth - Profondeur restante
   * @param {number} alpha - Borne basse
   * @param {number} beta - Borne haute
   * @returns {{ alpha: number, beta: number, move: number, cutoff: number | null }}
   */
  #narrowWindow(key, moves, depth, alpha, beta) {
    const window = { alpha, beta: min(beta, winScore(moves + 3)), move: -1, cutoff: null };
    const entry = this.table.get(key);
    if (entry) {
      window.move = entry.move;
      if (entry.depth >= depth) {
        this.#applyEntry(window, entry);
      }
    }
    if (window.cutoff === null && window.alpha >= window.beta) {
      window.cutoff = window.beta;
    }
    return window;
  }

  /**
   * Applique une entrée de table suffisamment profonde à la fenêtre courante.
   * @param {{ alpha: number, beta: number, cutoff: number | null }} window - Fenêtre modifiée en place
   * @param {import('./transposition-table.js').TableEntry} entry - Entrée de table
   */
  #applyEntry(window, entry) {
    if (entry.flag === EXACT) {
      window.cutoff = entry.score;
    } else if (entry.flag === LOWER) {
      window.alpha = max(window.alpha, entry.score);
    } else {
      window.beta = min(window.beta, entry.score);
    }
  }

  /**
   * Ordonne les coups : meilleur coup connu, puis ceux qui créent le plus de
   * cases gagnantes, puis du centre vers les bords. Un bon ordre fait couper
   * l'alpha-bêta beaucoup plus tôt.
   * @param {number} current - Jetons du joueur au trait
   * @param {number} mask - Tous les jetons
   * @param {number} candidates - Bitboard des coups à ordonner
   * @param {number | undefined} hint - Coup à essayer en premier (table ou itération précédente)
   * @param {number} depth - Profondeur restante
   * @returns {number[]} Colonnes ordonnées
   */
  #orderMoves(current, mask, candidates, hint, depth) {
    const columns = [];
    const ranks = [];
    for (const col of CENTER_ORDER) {
      if (and(candidates, columnMask(col)) === 0) {
        continue;
      }
      const rank = col === hint ? INFINITY
        : depth >= ORDERING_DEPTH ? popCount(winningCells(or(current, moveBit(mask, col)), mask)) : 0;
      insertByRank(columns, ranks, col, rank);
    }
    return columns;
  }
}

/** Instance partagée : la table (≈ 5 Mo) n'est allouée qu'une fois. */
let sharedSearch = null;

/**
 * Analyse une position avec l'instance partagée (table vidée à chaque appel,
 * donc aucun effet d'un appel sur le suivant).
 * @param {BitPosition} position - Position avec au moins un coup jouable
 * @param {SearchBudget} [budget] - Budget de recherche
 * @returns {SearchResult}
 */
export function searchPosition(position, budget) {
  sharedSearch ??= new Search();
  return sharedSearch.run(position, budget);
}
