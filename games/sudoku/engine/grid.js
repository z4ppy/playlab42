/**
 * Géométrie et représentation d'une grille de Sudoku 9 × 9.
 *
 * Conventions partagées par le moteur, les solveurs et l'interface :
 * - une grille est un tableau de 81 entiers, lu ligne par ligne ; 0 = case vide ;
 * - une case est désignée par son index 0..80 (ligne = index / 9, colonne = index % 9) ;
 * - un ensemble de chiffres (candidats, notes) est un masque de 9 bits :
 *   le bit (v - 1) vaut 1 si le chiffre v est présent. Exemple : {2, 7} = 0b001000010.
 *
 * Les masques rendent les opérations d'ensemble triviales (union `|`,
 * intersection `&`, retrait `& ~`) et restent sérialisables en JSON.
 */

export const SIZE = 9;
export const CELL_COUNT = SIZE * SIZE;
export const DIGITS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
/** Masque contenant les neuf chiffres. */
export const ALL_DIGITS = 0x1ff;

/** @typedef {'row' | 'column' | 'box'} UnitType */
/** @typedef {{type: UnitType, index: number, cells: number[]}} Unit */

export const rowOf = (cell) => Math.floor(cell / SIZE);
export const columnOf = (cell) => cell % SIZE;
export const boxOf = (cell) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(columnOf(cell) / 3);
export const cellAt = (row, column) => row * SIZE + column;

/** Bit du chiffre `value` (1..9) dans un masque. */
export const digitBit = (value) => 1 << (value - 1);

/**
 * Nombre de chiffres d'un masque (popcount sur 9 bits).
 * @param {number} mask
 * @returns {number}
 */
export function countDigits(mask) {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) {
    count++;
  }
  return count;
}

/**
 * Chiffres d'un masque, par ordre croissant.
 * @param {number} mask
 * @returns {number[]}
 */
export function digitsOf(mask) {
  return DIGITS.filter((value) => mask & digitBit(value));
}

/**
 * Masque formé d'une liste de chiffres.
 * @param {number[]} values
 * @returns {number}
 */
export function maskOf(values) {
  return values.reduce((mask, value) => mask | digitBit(value), 0);
}

/** Seul chiffre d'un masque à un bit (singleton). */
export const singleDigit = (mask) => 31 - Math.clz32(mask) + 1;

function buildUnits() {
  const units = [];
  for (let index = 0; index < SIZE; index++) {
    units.push({ type: 'row', index, cells: DIGITS.map((_, column) => cellAt(index, column)) });
  }
  for (let index = 0; index < SIZE; index++) {
    units.push({ type: 'column', index, cells: DIGITS.map((_, row) => cellAt(row, index)) });
  }
  for (let index = 0; index < SIZE; index++) {
    const top = Math.floor(index / 3) * 3;
    const left = (index % 3) * 3;
    units.push({ type: 'box', index, cells: DIGITS.map((_, k) => cellAt(top + Math.floor(k / 3), left + (k % 3))) });
  }
  return units.map((unit) => Object.freeze({ ...unit, cells: Object.freeze(unit.cells) }));
}

/** Les 27 unités : 9 lignes (0..8), 9 colonnes (9..17), 9 boîtes (18..26). */
export const UNITS = Object.freeze(buildUnits());
export const ROWS = UNITS.slice(0, 9);
export const COLUMNS = UNITS.slice(9, 18);
export const BOXES = UNITS.slice(18, 27);

const UNIT_OFFSETS = { row: 0, column: 9, box: 18 };

/**
 * Cases d'une unité désignée par sa référence JSON `{type, index}`.
 * @param {{type: UnitType, index: number}} ref
 * @returns {readonly number[]}
 */
export const unitCells = (ref) => UNITS[UNIT_OFFSETS[ref.type] + ref.index].cells;

/** Pour chaque case, ses trois unités : [ligne, colonne, boîte]. */
export const CELL_UNITS = Object.freeze(Array.from({ length: CELL_COUNT }, (_, cell) => Object.freeze([
  ROWS[rowOf(cell)], COLUMNS[columnOf(cell)], BOXES[boxOf(cell)],
])));

/** Pour chaque case, ses 20 « pairs » : les cases qui partagent une unité avec elle. */
export const PEERS = Object.freeze(CELL_UNITS.map((units, cell) => {
  const peers = new Set(units.flatMap((unit) => unit.cells));
  peers.delete(cell);
  return Object.freeze([...peers].sort((a, b) => a - b));
}));

/** Vrai si deux cases distinctes partagent une ligne, une colonne ou une boîte. */
export const seesEachOther = (a, b) => a !== b
  && (rowOf(a) === rowOf(b) || columnOf(a) === columnOf(b) || boxOf(a) === boxOf(b));

/**
 * Vérifie qu'une valeur est une grille de 81 chiffres 0..9.
 * @param {unknown} values
 * @returns {boolean}
 */
export function isGridArray(values) {
  return Array.isArray(values) && values.length === CELL_COUNT
    && Array.from(values).every((value) => Number.isInteger(value) && value >= 0 && value <= SIZE);
}

/**
 * Lit une grille textuelle de 81 caractères : chiffres 1..9, et `0` ou `.` pour une case vide.
 * Les espaces et retours à la ligne sont ignorés pour permettre une écriture lisible.
 * @param {string} text
 * @returns {number[]}
 * @throws {Error} Si le texte ne décrit pas 81 cases.
 */
export function parseGrid(text) {
  const compact = String(text).replace(/\s+/g, '');
  if (!/^[0-9.]{81}$/.test(compact)) {
    throw new Error('Une grille doit contenir exactement 81 caractères parmi 0-9 et « . ».');
  }
  return [...compact].map((char) => (char === '.' ? 0 : Number(char)));
}

/**
 * Écrit une grille sur 81 caractères (`.` pour une case vide).
 * @param {number[]} values
 * @returns {string}
 */
export function formatGrid(values) {
  return values.map((value) => (value === 0 ? '.' : String(value))).join('');
}

/**
 * Candidats de chaque case vide : chiffres absents de sa ligne, sa colonne et sa boîte.
 * Une case remplie reçoit le masque 0.
 * @param {number[]} values
 * @returns {number[]}
 */
export function computeCandidates(values) {
  return values.map((value, cell) => {
    if (value !== 0) {
      return 0;
    }
    let used = 0;
    for (const peer of PEERS[cell]) {
      if (values[peer]) {
        used |= digitBit(values[peer]);
      }
    }
    return ALL_DIGITS & ~used;
  });
}

/**
 * Cases remplies dont le chiffre apparaît deux fois dans une même unité.
 * @param {number[]} values
 * @returns {number[]} Index triés, sans doublon.
 */
export function findConflicts(values) {
  const conflicts = new Set();
  for (const unit of UNITS) {
    const seen = new Map();
    for (const cell of unit.cells) {
      const value = values[cell];
      if (!value) {
        continue;
      }
      if (seen.has(value)) {
        conflicts.add(cell).add(seen.get(value));
      } else {
        seen.set(value, cell);
      }
    }
  }
  return [...conflicts].sort((a, b) => a - b);
}

/** Nom compact d'une case : « L5C2 » pour ligne 5, colonne 2 (numérotation humaine). */
export const cellName = (cell) => `L${rowOf(cell) + 1}C${columnOf(cell) + 1}`;

/** Nom développé, lisible par une synthèse vocale : « ligne 5, colonne 2 ». */
export const cellLongName = (cell) => `ligne ${rowOf(cell) + 1}, colonne ${columnOf(cell) + 1}`;

const UNIT_NOUNS = { row: 'la ligne', column: 'la colonne', box: 'la boîte' };

/**
 * Désignation d'une unité avec article : « la ligne 3 », « la boîte 4 ».
 * @param {{type: UnitType, index: number}} unit
 * @returns {string}
 */
export const unitName = (unit) => `${UNIT_NOUNS[unit.type]} ${unit.index + 1}`;

/**
 * Énumère les combinaisons de `size` éléments d'une liste, dans l'ordre lexicographique.
 * Utilisé par les techniques à sous-ensembles (paires, triplets, poissons).
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {Generator<T[]>}
 */
export function* combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (size - prefix.length); i++) {
    yield* combinations(items, size, i + 1, [...prefix, items[i]]);
  }
}
