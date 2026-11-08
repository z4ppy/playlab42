/**
 * Conseiller : transforme une recherche en indice compréhensible et en
 * évaluation affichable (barre « qui gagne ? »).
 *
 * L'explication est choisie par une liste ordonnée de règles : la première
 * qui s'applique au coup conseillé l'emporte. Chaque règle reste une petite
 * fonction lisible, facile à tester et à compléter.
 */

import {
  and,
  columnMask,
  columnsOf,
  playColumn,
  playableMask,
  popCount,
  positionFromView,
  readTactics,
  winningCells,
  xor,
} from './bitboard.js';
import { DEFAULT_BUDGET, WIN_SCORE, isDecisive, searchPosition } from './search.js';

/** Échelle de l'heuristique pour la barre d'évaluation (tanh(score / échelle)). */
const ADVANTAGE_SCALE = 80;

/**
 * @typedef {import('./bitboard.js').BitPosition} BitPosition
 * @typedef {{ winner: 'self' | 'opponent', inMoves: number }} ForcedOutcome
 * @typedef {{ code: string, text: string }} Reason
 *
 * @typedef {Object} Analysis
 * @property {number} column - Colonne conseillée (0 à 6)
 * @property {number[]} bestMoves - Colonnes équivalentes selon la recherche
 * @property {number} score - Score brut, du point de vue du joueur au trait
 * @property {ForcedOutcome | null} forced - Issue forcée trouvée, en coups du gagnant
 * @property {boolean} solved - Issue prouvée (victoire, défaite ou nul certain)
 * @property {number} advantage - Avantage de Rouge entre -1 (Jaune gagne) et 1 (Rouge gagne)
 * @property {Reason} reason - Explication courte du coup conseillé
 * @property {number} depth - Profondeur atteinte
 * @property {number} nodes - Positions examinées
 */

/**
 * Traduit un score décisif en « victoire en N coups » du gagnant.
 * @param {number} score - Score du joueur au trait
 * @param {number} moves - Jetons déjà posés
 * @returns {ForcedOutcome | null}
 */
export function forcedOutcome(score, moves) {
  if (!isDecisive(score)) {
    return null;
  }
  const plies = WIN_SCORE - Math.abs(score) - moves;
  return { winner: score > 0 ? 'self' : 'opponent', inMoves: Math.ceil(plies / 2) };
}

/**
 * Avantage du point de vue de Rouge, borné à [-1, 1].
 * @param {boolean} redToMove - Rouge est-il au trait ?
 * @param {number} score - Score du joueur au trait
 * @returns {number}
 */
export function redAdvantage(redToMove, score) {
  const forRed = redToMove ? score : -score;
  return isDecisive(forRed) ? Math.sign(forRed) : Math.tanh(forRed / ADVANTAGE_SCALE);
}

/**
 * Faits tactiques sur le coup conseillé, partagés par les règles d'explication.
 * @param {BitPosition} position - Position avant le coup
 * @param {number} column - Colonne conseillée
 * @returns {object}
 */
function describeContext(position, column) {
  const tactics = readTactics(position);
  const after = playColumn(position, column);
  // Après le coup, « nous » sommes l'adversaire du nouveau joueur au trait.
  const ourCellsAfter = winningCells(xor(after.current, after.mask), after.mask);
  return {
    column,
    label: column + 1,
    inColumn: (cells) => and(cells, columnMask(column)) !== 0,
    tactics,
    nextWins: popCount(and(playableMask(after.mask), ourCellsAfter)),
    newCells: popCount(ourCellsAfter) - popCount(winningCells(position.current, position.mask)),
  };
}

/** Règles d'explication, par priorité décroissante. */
const REASONS = [
  {
    code: 'win',
    applies: (ctx) => ctx.inColumn(ctx.tactics.wins),
    text: (ctx) => `Gagne tout de suite : quatre jetons alignés en colonne ${ctx.label}.`,
  },
  {
    code: 'block',
    applies: (ctx) => ctx.inColumn(ctx.tactics.threats),
    text: (ctx) => `Bloque la menace adverse en colonne ${ctx.label}.`,
  },
  {
    code: 'double-threat',
    applies: (ctx) => ctx.nextWins >= 2,
    text: () => 'Crée une double menace : l’adversaire ne pourra en bloquer qu’une.',
  },
  {
    code: 'forced-win',
    applies: (ctx) => ctx.forced?.winner === 'self',
    text: (ctx) => `Mène à une victoire forcée en ${ctx.forced.inMoves} coups.`,
  },
  {
    code: 'delay',
    applies: (ctx) => ctx.forced?.winner === 'opponent',
    text: () => 'Position perdue face à une défense parfaite : ce coup résiste le plus longtemps.',
  },
  {
    code: 'avoid-trap',
    applies: (ctx) => ctx.tactics.unsafe !== 0 && !ctx.inColumn(ctx.tactics.unsafe),
    text: (ctx) => `Évite ${formatColumns(columnsOf(ctx.tactics.unsafe))} : y jouer offrirait une case gagnante juste au-dessus.`,
  },
  {
    code: 'threat',
    applies: (ctx) => ctx.newCells > 0,
    text: () => 'Prépare une menace : une case gagnante de plus.',
  },
  {
    code: 'center',
    applies: (ctx) => ctx.column === 3,
    text: () => 'Prend le centre, la colonne qui permet le plus d’alignements.',
  },
  {
    code: 'positional',
    applies: () => true,
    text: (ctx) => `Meilleur équilibre trouvé en regardant ${ctx.depth} coups à l’avance.`,
  },
];

/**
 * « la colonne 2 » ou « les colonnes 2 et 6 ».
 * @param {number[]} columns - Colonnes (0 à 6)
 * @returns {string}
 */
export function formatColumns(columns) {
  const labels = columns.map((col) => col + 1);
  if (labels.length === 1) {
    return `la colonne ${labels[0]}`;
  }
  return `les colonnes ${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;
}

/**
 * Explique en une phrase pourquoi le coup est conseillé.
 * @param {BitPosition} position - Position avant le coup
 * @param {number} column - Colonne conseillée
 * @param {{ forced: ForcedOutcome | null, depth: number }} search - Issue et profondeur de la recherche
 * @returns {Reason}
 */
export function explainMove(position, column, { forced, depth }) {
  const ctx = { ...describeContext(position, column), forced, depth };
  const rule = REASONS.find((candidate) => candidate.applies(ctx));
  return { code: rule.code, text: rule.text(ctx) };
}

/**
 * Analyse complète d'une vue du moteur : meilleur coup, issue, explication.
 * @param {import('../engine.js').Puissance4State} view - Vue du joueur au trait (partie en cours)
 * @param {import('./search.js').SearchBudget} [budget] - Budget de recherche
 * @returns {Analysis}
 */
export function analyzeView(view, budget = DEFAULT_BUDGET) {
  const position = positionFromView(view);
  const result = searchPosition(position, budget);
  const column = result.bestMoves[0];
  const forced = forcedOutcome(result.score, position.moves);
  return {
    column,
    bestMoves: result.bestMoves,
    score: result.score,
    forced,
    solved: result.solved,
    advantage: redAdvantage(view.colors[view.currentPlayerId] === 'red', result.score),
    reason: explainMove(position, column, { forced, depth: result.depth }),
    depth: result.depth,
    nodes: result.nodes,
  };
}
