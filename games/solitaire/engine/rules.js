/**
 * Règles du Klondike sur un « plateau » (sans score ni joueur).
 *
 * Ces fonctions pures sont partagées par le moteur et par l'IA : le moteur y
 * ajoute score et fin de partie, le solveur les explore. Une seule source de
 * vérité évite qu'un indice propose un coup que le moteur refuserait.
 *
 * Identifiants de piles : `'waste'` (défausse), `'tableau-0'` à `'tableau-6'`,
 * `'foundation-0'` à `'foundation-3'` (enseignes dans l'ordre de `SUITS`).
 * Le talon n'est jamais une source de `move` : il se manipule par `draw`
 * (piocher) et `recycle` (retourner la défausse quand le talon est vide).
 *
 * Une carte inconnue (`null`) n'apparaît que dans un plateau reconstruit depuis
 * la vue du joueur ; seul l'appelant qui la crée sait s'arrêter avant de la lire.
 *
 * @module games/solitaire/engine/rules
 */

import { KING, canFound, canStack, cardInfo } from './cards.js';

/** Nombre de colonnes du tableau. */
export const COLUMN_COUNT = 7;

/** Nombre de fondations. */
export const FOUNDATION_COUNT = 4;

/** Identifiant de la défausse. */
export const WASTE = 'waste';

/**
 * @typedef {Object} Column
 * @property {(string|null)[]} down - Cartes face cachée, la dernière est sur le dessus
 * @property {(string|null)[]} up - Cartes face visible, la dernière est accessible
 *
 * @typedef {Object} Board
 * @property {1|3} drawCount - Cartes retournées à chaque pioche
 * @property {Column[]} tableau - Sept colonnes
 * @property {(string|null)[]} stock - Talon face cachée, la dernière carte est piochée en premier
 * @property {(string|null)[]} waste - Défausse face visible, la dernière est jouable
 * @property {string[][]} foundations - Quatre fondations, de l'as vers le roi
 *
 * @typedef {{type: 'draw'}} DrawAction
 * @typedef {{type: 'recycle'}} RecycleAction
 * @typedef {{type: 'move', from: string, to: string, count: number}} MoveAction
 * @typedef {DrawAction|RecycleAction|MoveAction} SolitaireAction
 *
 * @typedef {Object} MoveOutcome
 * @property {Board} board - Nouveau plateau
 * @property {string|null} [flipped] - Carte retournée dans le tableau (`null` si inconnue)
 * @property {(string|null)[]} [drawn] - Cartes piochées, dans l'ordre où elles arrivent
 */

/**
 * @param {number} index - Indice de colonne
 * @returns {string}
 */
export function tableauId(index) {
  return `tableau-${index}`;
}

/**
 * @param {number} index - Indice de fondation
 * @returns {string}
 */
export function foundationId(index) {
  return `foundation-${index}`;
}

const PILE_PATTERN = /^(tableau|foundation)-(\d)$/;

/**
 * Décode un identifiant de pile source ou destination.
 * @param {unknown} id - Identifiant reçu dans une action
 * @returns {{zone: 'waste'|'tableau'|'foundation', index: number}|null}
 */
export function parsePile(id) {
  if (id === WASTE) {
    return { zone: 'waste', index: 0 };
  }
  const match = typeof id === 'string' ? PILE_PATTERN.exec(id) : null;
  if (!match) {
    return null;
  }
  const index = Number(match[2]);
  const size = match[1] === 'tableau' ? COLUMN_COUNT : FOUNDATION_COUNT;
  return index < size ? { zone: match[1], index } : null;
}

/**
 * Cartes qu'une source peut céder, ou `null` si la quantité est impossible.
 * Les cartes visibles d'une colonne forment toujours une séquence valide :
 * seules des séquences valides peuvent y être posées.
 * @param {Board} board
 * @param {{zone: string, index: number}} pile
 * @param {number} count
 * @returns {(string|null)[]|null}
 */
function takeableCards(board, pile, count) {
  if (pile.zone === 'tableau') {
    const { up } = board.tableau[pile.index];
    return count <= up.length ? up.slice(up.length - count) : null;
  }
  const cards = pile.zone === 'waste' ? board.waste : board.foundations[pile.index];
  return count === 1 && cards.length > 0 ? [cards[cards.length - 1]] : null;
}

/**
 * Une pile accepte-t-elle ces cartes ? La défausse ne reçoit jamais de carte.
 * @param {Board} board
 * @param {{zone: string, index: number}} pile
 * @param {string[]} cards - Cartes déplacées, la première est la plus basse posée
 * @returns {boolean}
 */
function canReceive(board, pile, cards) {
  if (pile.zone === 'foundation') {
    return cards.length === 1 && canFound(cards[0], pile.index, board.foundations[pile.index]);
  }
  if (pile.zone !== 'tableau') {
    return false;
  }
  const column = board.tableau[pile.index];
  // Une colonne n'a jamais de cartes cachées sans carte visible : le moteur retourne la suivante.
  return column.up.length > 0 ? canStack(cards[0], column.up[column.up.length - 1])
    : column.down.length === 0 && canStack(cards[0], undefined);
}

/**
 * Vérifie un déplacement `move` déjà bien formé (types contrôlés par le moteur).
 * @param {Board} board
 * @param {MoveAction} move
 * @returns {boolean}
 */
function isLegalTransfer(board, move) {
  const from = parsePile(move.from);
  const to = parsePile(move.to);
  if (!from || !to || move.from === move.to || !Number.isInteger(move.count) || move.count < 1) {
    return false;
  }
  const cards = takeableCards(board, from, move.count);
  return cards !== null && canReceive(board, to, cards);
}

/**
 * Indique si une action respecte les règles sur ce plateau.
 * @param {Board} board
 * @param {SolitaireAction} action - Objet déjà vérifié par le moteur
 * @returns {boolean}
 */
export function isLegalMove(board, action) {
  switch (action.type) {
    case 'draw':
      return board.stock.length > 0;
    case 'recycle':
      return board.stock.length === 0 && board.waste.length > 0;
    case 'move':
      return isLegalTransfer(board, action);
    default:
      return false;
  }
}

/**
 * Sources d'une seule carte : défausse puis haut de chaque colonne.
 * @param {Board} board
 * @returns {{from: string, card: string}[]}
 */
function singleCardSources(board) {
  const sources = board.waste.length ? [{ from: WASTE, card: board.waste[board.waste.length - 1] }] : [];
  board.tableau.forEach((column, index) => {
    if (column.up.length) {
      sources.push({ from: tableauId(index), card: column.up[column.up.length - 1] });
    }
  });
  return sources;
}

/** Coups vers les fondations : la fondation visée est celle de l'enseigne. */
function foundationMoves(board) {
  return singleCardSources(board)
    .map(({ from, card }) => ({ type: 'move', from, to: foundationId(cardInfo(card).suitIndex), count: 1 }))
    .filter(move => isLegalTransfer(board, move));
}

/**
 * Chaque carte visible peut emmener la séquence posée sur elle : on teste sa
 * pose sur chaque autre colonne. Une colonne non vide n'accepte qu'un rang
 * précis, donc au plus une longueur par couple de colonnes convient.
 */
function tableauToTableauMoves(board) {
  const moves = [];
  board.tableau.forEach((source, from) => {
    source.up.forEach((card, position) => {
      const count = source.up.length - position;
      for (let to = 0; to < COLUMN_COUNT; to++) {
        if (to !== from && canReceive(board, { zone: 'tableau', index: to }, [card])) {
          moves.push({ type: 'move', from: tableauId(from), to: tableauId(to), count });
        }
      }
    });
  });
  return moves;
}

/** Coups d'une carte isolée (défausse ou fondation) vers le tableau. */
function singleToTableauMoves(board, from, cards) {
  if (!cards.length) {
    return [];
  }
  const card = cards[cards.length - 1];
  const moves = [];
  for (let to = 0; to < COLUMN_COUNT; to++) {
    if (canReceive(board, { zone: 'tableau', index: to }, [card])) {
      moves.push({ type: 'move', from, to: tableauId(to), count: 1 });
    }
  }
  return moves;
}

/**
 * Toutes les actions légales, dans un ordre stable : fondations, tableau,
 * défausse vers tableau, retour de fondation, puis pioche ou recyclage.
 * @param {Board} board
 * @returns {SolitaireAction[]}
 */
export function listMoves(board) {
  const moves = [
    ...foundationMoves(board),
    ...tableauToTableauMoves(board),
    ...singleToTableauMoves(board, WASTE, board.waste),
  ];
  board.foundations.forEach((foundation, index) => {
    moves.push(...singleToTableauMoves(board, foundationId(index), foundation));
  });
  if (board.stock.length) {
    moves.push({ type: 'draw' });
  } else if (board.waste.length) {
    moves.push({ type: 'recycle' });
  }
  return moves;
}

/** Pioche : jusqu'à `drawCount` cartes passent du talon à la défausse, une par une. */
function applyDraw(board) {
  const count = Math.min(board.drawCount, board.stock.length);
  const drawn = board.stock.slice(board.stock.length - count).reverse();
  return {
    board: { ...board, stock: board.stock.slice(0, board.stock.length - count), waste: [...board.waste, ...drawn] },
    drawn,
  };
}

/** Recyclage : la défausse retournée redevient le talon, dans le même ordre de pioche. */
function applyRecycle(board) {
  return { board: { ...board, stock: [...board.waste].reverse(), waste: [] } };
}

/**
 * Retourne la carte du dessus d'une colonne restée sans carte visible.
 * @param {Column} column
 * @returns {{column: Column, flipped?: string|null}}
 */
function revealTop(column) {
  if (column.up.length || !column.down.length) {
    return { column };
  }
  const flipped = column.down[column.down.length - 1];
  return { column: { down: column.down.slice(0, -1), up: [flipped] }, flipped };
}

/** Retire `count` cartes d'une source ; la colonne vidée retourne sa carte cachée. */
function removeCards(board, pile, count) {
  if (pile.zone === 'waste') {
    return { board: { ...board, waste: board.waste.slice(0, -1) } };
  }
  if (pile.zone === 'foundation') {
    const foundations = [...board.foundations];
    foundations[pile.index] = foundations[pile.index].slice(0, -1);
    return { board: { ...board, foundations } };
  }
  const tableau = [...board.tableau];
  const column = tableau[pile.index];
  const revealed = revealTop({ down: column.down, up: column.up.slice(0, column.up.length - count) });
  tableau[pile.index] = revealed.column;
  // `in` plutôt qu'un test de valeur : une carte retournée inconnue vaut `null`.
  return 'flipped' in revealed ? { board: { ...board, tableau }, flipped: revealed.flipped } : { board: { ...board, tableau } };
}

/** Ajoute des cartes à une destination (fondation ou colonne). */
function addCards(board, pile, cards) {
  if (pile.zone === 'foundation') {
    const foundations = [...board.foundations];
    foundations[pile.index] = [...foundations[pile.index], ...cards];
    return { ...board, foundations };
  }
  const tableau = [...board.tableau];
  const column = tableau[pile.index];
  tableau[pile.index] = { down: column.down, up: [...column.up, ...cards] };
  return { ...board, tableau };
}

/**
 * Applique une action légale sans muter le plateau reçu. Les piles non
 * touchées sont partagées (copie structurelle) : c'est sûr car rien ne les mute
 * et cela rend l'exploration du solveur bien plus rapide qu'une copie profonde.
 * @param {Board} board
 * @param {SolitaireAction} action - Action dont la légalité a été vérifiée
 * @returns {MoveOutcome}
 */
export function applyMove(board, action) {
  if (action.type === 'draw') {
    return applyDraw(board);
  }
  if (action.type === 'recycle') {
    return applyRecycle(board);
  }
  const from = parsePile(action.from);
  const cards = takeableCards(board, from, action.count);
  const removed = removeCards(board, from, action.count);
  const outcome = { board: addCards(removed.board, parsePile(action.to), cards) };
  if ('flipped' in removed) {
    outcome.flipped = removed.flipped;
  }
  return outcome;
}

/**
 * La partie est gagnée quand les quatre fondations montent jusqu'au roi.
 * @param {Board} board
 * @returns {boolean}
 */
export function isWon(board) {
  return board.foundations.every(foundation => foundation.length === KING);
}

/**
 * Nombre total de cartes encore face cachée dans le tableau.
 * @param {Board} board
 * @returns {number}
 */
export function hiddenCount(board) {
  return board.tableau.reduce((total, column) => total + column.down.length, 0);
}

/**
 * Nombre de cartes posées sur les fondations.
 * @param {Board} board
 * @returns {number}
 */
export function foundationCount(board) {
  return board.foundations.reduce((total, foundation) => total + foundation.length, 0);
}
