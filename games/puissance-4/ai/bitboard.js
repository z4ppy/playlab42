/**
 * Bitboards de Puissance 4 : la grille entière tient dans deux nombres.
 *
 * Disposition (celle du solveur de Pascal Pons) : chaque colonne occupe
 * 7 bits, du bas vers le haut, dont un bit sentinelle au-dessus des 6 cases.
 *
 *     .  .  .  .  .  .  .     ← ligne sentinelle (toujours vide)
 *     5 12 19 26 33 40 47
 *     4 11 18 25 32 39 46
 *     3 10 17 24 31 38 45
 *     2  9 16 23 30 37 44
 *     1  8 15 22 29 36 43
 *     0  7 14 21 28 35 42     ← bas de la grille
 *
 * Une position est décrite par `current` (jetons du joueur au trait) et `mask`
 * (tous les jetons). Les jetons adverses valent `current ^ mask`. La sentinelle
 * empêche un alignement de « déborder » d'une colonne sur la suivante.
 *
 * Pourquoi des Number et pas des BigInt ? 49 bits dépassent les opérateurs
 * binaires 32 bits de JavaScript, mais un Number représente exactement tout
 * entier jusqu'à 2^53. On découpe donc ET/OU/OU exclusif en deux mots de 32 bits
 * et on réalise les décalages par multiplication/division par une puissance de 2
 * (toujours exactes). Mesuré : environ deux fois plus rapide que BigInt.
 */

import { COLUMNS, ROWS } from '../engine/board.js';

/** Hauteur d'une colonne en bits, sentinelle comprise. */
export const COLUMN_BITS = ROWS + 1;

/** Nombre de cases de la grille. */
export const CELLS = COLUMNS * ROWS;

// Copies locales : dans un contexte `vm` (celui de Jest), chaque lecture d’un
// global comme `Math` passe par un intercepteur lent — ici, des millions de fois.
const { floor, imul } = Math;

const WORD = 2 ** 32;
const POWERS = Array.from({ length: 64 }, (_, exponent) => 2 ** exponent);

/** Poids fort (bits 32 et au-delà) d'un bitboard. */
const high = (value) => floor(value / WORD);

/**
 * ET binaire sur 64 bits (les bits au-delà sont ignorés).
 * @param {number} a - Bitboard
 * @param {number} b - Bitboard
 * @returns {number}
 */
export const and = (a, b) => ((high(a) & high(b)) >>> 0) * WORD + ((a & b) >>> 0);

/**
 * OU binaire sur 64 bits.
 * @param {number} a - Bitboard
 * @param {number} b - Bitboard
 * @returns {number}
 */
export const or = (a, b) => ((high(a) | high(b)) >>> 0) * WORD + ((a | b) >>> 0);

/**
 * OU exclusif sur 64 bits.
 * @param {number} a - Bitboard
 * @param {number} b - Bitboard
 * @returns {number}
 */
export const xor = (a, b) => ((high(a) ^ high(b)) >>> 0) * WORD + ((a ^ b) >>> 0);

/**
 * Bits de `a` absents de `b` (a ET NON b).
 * @param {number} a - Bitboard
 * @param {number} b - Bitboard
 * @returns {number}
 */
export const andNot = (a, b) => ((high(a) & ~high(b)) >>> 0) * WORD + ((a & ~b) >>> 0);

/**
 * Décalage à gauche (vers les bits de poids fort).
 * @param {number} value - Bitboard
 * @param {number} shift - Nombre de bits
 * @returns {number}
 */
export const shiftLeft = (value, shift) => value * POWERS[shift];

/**
 * Décalage à droite (vers les bits de poids faible).
 * @param {number} value - Bitboard
 * @param {number} shift - Nombre de bits
 * @returns {number}
 */
export const shiftRight = (value, shift) => floor(value / POWERS[shift]);

/**
 * Nombre de bits à 1 d'un mot de 32 bits (méthode SWAR classique).
 * @param {number} word - Entier 32 bits
 * @returns {number}
 */
function popCount32(word) {
  let v = word - ((word >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

/**
 * Nombre de bits à 1 d'un bitboard.
 * @param {number} value - Bitboard
 * @returns {number}
 */
export const popCount = (value) => popCount32(value >>> 0) + popCount32(high(value) >>> 0);

/** Bit de la case du bas de la colonne. */
export const bottomBit = (col) => POWERS[col * COLUMN_BITS];

/** Bit de la case du haut (6e case) de la colonne. */
export const topBit = (col) => POWERS[col * COLUMN_BITS + ROWS - 1];

/** Les 6 cases jouables d'une colonne. */
export const columnMask = (col) => (POWERS[ROWS] - 1) * POWERS[col * COLUMN_BITS];

/** Case du bas de chaque colonne. */
export const BOTTOM_MASK = Array.from({ length: COLUMNS }, (_, col) => bottomBit(col))
  .reduce((sum, bit) => sum + bit, 0);

/** Toutes les cases jouables (sans la ligne sentinelle). */
export const BOARD_MASK = BOTTOM_MASK * (POWERS[ROWS] - 1);

/**
 * Cases des lignes impaires en comptant depuis le bas (1re, 3e et 5e ligne).
 * Théorie de Victor Allis : le premier joueur profite des menaces sur ces
 * lignes, le second des menaces sur les lignes paires.
 */
export const ODD_ROWS_MASK = BOTTOM_MASK * (1 + POWERS[2] + POWERS[4]);

/** Cases des lignes paires (2e, 4e et 6e ligne depuis le bas). */
export const EVEN_ROWS_MASK = BOARD_MASK - ODD_ROWS_MASK;

/** Colonne centrale, la plus riche en alignements possibles. */
export const CENTER_MASK = columnMask(Math.floor(COLUMNS / 2));

/** Ordre d'exploration par défaut : du centre vers les bords. */
export const CENTER_ORDER = Object.freeze(
  Array.from({ length: COLUMNS }, (_, col) => col)
    .sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) || a - b),
);

/**
 * @typedef {Object} BitPosition
 * @property {number} current - Jetons du joueur au trait
 * @property {number} mask - Tous les jetons posés
 * @property {number} moves - Nombre de jetons posés
 */

/**
 * Convertit la vue JSON du moteur en bitboards, du point de vue du joueur au trait.
 * @param {{ board: (string|null)[][], colors: Record<string, string>, currentPlayerId: string }} view - Vue du moteur
 * @returns {BitPosition}
 */
export function positionFromView(view) {
  const ownColor = view.colors[view.currentPlayerId];
  let current = 0;
  let mask = 0;
  let moves = 0;
  view.board.forEach((line, row) => line.forEach((cell, col) => {
    if (cell === null) {
      return;
    }
    const bit = POWERS[col * COLUMN_BITS + (ROWS - 1 - row)];
    mask += bit;
    moves++;
    if (cell === ownColor) {
      current += bit;
    }
  }));
  return { current, mask, moves };
}

/**
 * Indique si la colonne a encore une case libre.
 * @param {number} mask - Tous les jetons
 * @param {number} col - Colonne
 * @returns {boolean}
 */
export const canPlay = (mask, col) => and(mask, topBit(col)) === 0;

/**
 * Bit de la case où tomberait un jeton dans la colonne. L'addition fait
 * « monter » la retenue jusqu'à la première case vide de la colonne.
 * @param {number} mask - Tous les jetons
 * @param {number} col - Colonne jouable
 * @returns {number}
 */
export const moveBit = (mask, col) => and(mask + bottomBit(col), columnMask(col));

/**
 * Cases jouables immédiatement (une par colonne non pleine).
 * @param {number} mask - Tous les jetons
 * @returns {number}
 */
export const playableMask = (mask) => and(mask + BOTTOM_MASK, BOARD_MASK);

/**
 * Position après un coup, du point de vue du nouveau joueur au trait.
 * @param {BitPosition} position - Position avant le coup
 * @param {number} col - Colonne jouable
 * @returns {BitPosition}
 */
export function playColumn({ current, mask, moves }, col) {
  return { current: xor(current, mask), mask: or(mask, moveBit(mask, col)), moves: moves + 1 };
}

/** Pas horizontal (7) et diagonaux (6 et 8) dans la disposition des bits. */
const LINE_STEPS = Object.freeze([COLUMN_BITS, COLUMN_BITS - 1, COLUMN_BITS + 1]);

/** Cases de la grille dans le mot de poids fort (bits 32 à 48). */
const BOARD_HIGH = high(BOARD_MASK);

/** Cases de la grille dans le mot de poids faible (bits 0 à 31), sentinelles exclues. */
const BOARD_LOW = BOARD_MASK % WORD | 0;

/**
 * Mot de poids fort de (hi:lo) << shift, pour 0 < shift < 32.
 * @param {number} hi - Mot de poids fort
 * @param {number} lo - Mot de poids faible
 * @param {number} shift - Décalage
 * @returns {number}
 */
const hiLeft = (hi, lo, shift) => (hi << shift) | (lo >>> (32 - shift));

/**
 * Mot de poids faible de (hi:lo) >> shift, pour 0 < shift < 32.
 * @param {number} hi - Mot de poids fort
 * @param {number} lo - Mot de poids faible
 * @param {number} shift - Décalage
 * @returns {number}
 */
const loRight = (hi, lo, shift) => (lo >>> shift) | (hi << (32 - shift));

/**
 * Cases vides qui compléteraient un alignement de quatre pour `stones`.
 * Pour chaque direction (pas 1 = vertical, 7 = horizontal, 6 et 8 = diagonales),
 * on cherche les trous dont les voisins forment « XXX_ », « XX_X », « X_XX » ou « _XXX ».
 * @param {number} stones - Jetons d'un joueur
 * @param {number} mask - Tous les jetons (les cases occupées sont exclues du résultat)
 * @returns {number} Bitboard des cases gagnantes (jouables ou non)
 */
export function winningCells(stones, mask) {
  // C'est la fonction la plus appelée de l'IA : elle travaille directement sur
  // les deux mots de 32 bits (lo = bits 0-31, hi = bits 32-48) avec les
  // opérateurs natifs, sans passer par les aides génériques plus lentes.
  const lo = stones >>> 0;
  const hi = high(stones);
  // Vertical : seul « XXX_ » est possible, le trou étant au-dessus.
  let cellsLo = (lo << 1) & (lo << 2) & (lo << 3);
  let cellsHi = hiLeft(hi, lo, 1) & hiLeft(hi, lo, 2) & hiLeft(hi, lo, 3);
  for (const step of LINE_STEPS) {
    // Voisins décalés de 1, 2 et 3 pas de chaque côté du trou.
    const left1Lo = lo << step, left2Lo = lo << (2 * step), left3Lo = lo << (3 * step);
    const left1Hi = hiLeft(hi, lo, step), left2Hi = hiLeft(hi, lo, 2 * step), left3Hi = hiLeft(hi, lo, 3 * step);
    const right1Lo = loRight(hi, lo, step), right2Lo = loRight(hi, lo, 2 * step), right3Lo = loRight(hi, lo, 3 * step);
    const right1Hi = hi >>> step, right2Hi = hi >>> (2 * step), right3Hi = hi >>> (3 * step);
    // « XX? » d'un côté, complété par un troisième jeton de part ou d'autre.
    cellsLo |= (left1Lo & left2Lo & (left3Lo | right1Lo)) | (right1Lo & right2Lo & (right3Lo | left1Lo));
    cellsHi |= (left1Hi & left2Hi & (left3Hi | right1Hi)) | (right1Hi & right2Hi & (right3Hi | left1Hi));
  }
  const cells = ((cellsHi & BOARD_HIGH) >>> 0) * WORD + ((cellsLo & BOARD_LOW) >>> 0);
  return andNot(cells, mask);
}

/**
 * Indique si un ensemble de jetons contient déjà un alignement de quatre.
 * @param {number} stones - Jetons d'un joueur
 * @returns {boolean}
 */
export function hasAlignment(stones) {
  for (const step of [1, COLUMN_BITS, COLUMN_BITS - 1, COLUMN_BITS + 1]) {
    const pairs = and(stones, shiftRight(stones, step));
    if (and(pairs, shiftRight(pairs, 2 * step)) !== 0) {
      return true;
    }
  }
  return false;
}

/**
 * Colonnes d'un bitboard de cases (au plus une case par colonne compte).
 * @param {number} cells - Bitboard
 * @returns {number[]} Colonnes concernées, de gauche à droite
 */
export function columnsOf(cells) {
  const columns = [];
  for (let col = 0; col < COLUMNS; col++) {
    if (and(cells, columnMask(col)) !== 0) {
      columns.push(col);
    }
  }
  return columns;
}

/**
 * Lecture tactique immédiate d'une position, partagée par les bots et l'indice.
 * @param {BitPosition} position - Position (joueur au trait = « nous »)
 * @returns {{ playable: number, wins: number, threats: number, unsafe: number }}
 *   wins : nos coups gagnants immédiats ; threats : cases où l'adversaire
 *   gagnerait au prochain coup ; unsafe : nos coups qui offriraient une case
 *   gagnante juste au-dessus à l'adversaire.
 */
export function readTactics({ current, mask }) {
  const playable = playableMask(mask);
  const opponentCells = winningCells(xor(current, mask), mask);
  return {
    playable,
    wins: and(playable, winningCells(current, mask)),
    threats: and(playable, opponentCells),
    unsafe: and(playable, shiftRight(opponentCells, 1)),
  };
}
