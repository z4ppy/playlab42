/**
 * Moteur Sudoku — isomorphe, pur et déterministe.
 *
 * Le moteur ne connaît ni le DOM, ni le stockage, ni l'horloge : le chronomètre,
 * les indices affichés et l'animation de l'IA appartiennent au client.
 * L'état est 100 % JSON. Le seul aléa (la génération de la grille) passe par
 * `SeededRandom`, dont l'état final est conservé dans `rngState`.
 *
 * Partie solo : un unique joueur pose des chiffres, des notes, annule ou refait.
 * La partie est gagnée quand la grille est entièrement remplie avec la solution.
 *
 * @see lib/types/game-engine.ts
 */

import { SeededRandom } from '../../lib/seeded-random.js';
import { ALL_DIGITS, CELL_COUNT, DIGITS, PEERS, computeCandidates, digitBit, isGridArray, parseGrid } from './engine/grid.js';
import { countSolutions, solveExact } from './engine/exact-solver.js';
import { isLevelId, ratePuzzle } from './engine/difficulty.js';
import { generatePuzzle } from './engine/generator.js';

/**
 * @typedef {import('./engine/difficulty.js').LevelId} LevelId
 *
 * @typedef {Object} SudokuConfig
 * @property {number} seed Entier 0..4294967295 : avec le niveau, il identifie la grille.
 * @property {[string]} playerIds Un seul joueur.
 * @property {LevelId} [difficulty='medium'] Niveau demandé.
 * @property {string} [puzzle] Grille imposée (81 caractères, `.` ou `0` = vide) : remplace la génération.
 *
 * @typedef {{value: number, notes: number}} CellContent Chiffre (0 = vide) et masque de notes.
 * @typedef {{cell: number, before: CellContent, after: CellContent}} CellChange
 *
 * @typedef {Object} SudokuState
 * @property {1} version Version du format d'état.
 * @property {string} playerId
 * @property {number} seed
 * @property {LevelId} requestedLevel Niveau demandé.
 * @property {LevelId} level Niveau mesuré par le solveur humain.
 * @property {boolean} custom Vrai pour une grille imposée par la configuration.
 * @property {number[]} givens Chiffres donnés (0 = case à remplir).
 * @property {number[]} solution Solution unique (secrète : absente de la vue).
 * @property {number[]} values Chiffres actuels, données comprises.
 * @property {number[]} notes Masques de notes (crayon) par case.
 * @property {{undo: CellChange[][], redo: CellChange[][]}} history Changements annulables.
 * @property {number[]} errorCells Cases signalées fausses par la dernière vérification.
 * @property {number} checks Nombre de vérifications demandées.
 * @property {number} moves Nombre de changements de grille (annuler/refaire compris).
 * @property {number} rngState État du générateur après la génération.
 * @property {boolean} gameOver
 * @property {string[] | null} winners
 *
 * @typedef {{type: 'place', cell: number, value: number}
 *   | {type: 'erase', cell: number}
 *   | {type: 'note', cell: number, value: number}
 *   | {type: 'fillNotes'} | {type: 'check'} | {type: 'restart'}
 *   | {type: 'undo'} | {type: 'redo'}} SudokuAction
 *
 * @typedef {Omit<SudokuState, 'solution' | 'history' | 'rngState'> & {canUndo: boolean, canRedo: boolean}} SudokuView
 */

const DEFAULT_LEVEL = 'medium';

const isCellIndex = (cell) => Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT;
const isDigit = (value) => Number.isInteger(value) && value >= 1 && value <= 9;
const isEditable = (state, cell) => isCellIndex(cell) && state.givens[cell] === 0;
/** Seed sur 32 bits non signés, comme l'état de SeededRandom. */
export const isSeed = (seed) => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff;

/** Validation de configuration : une erreur explicite plutôt qu'une partie bancale. */
function readConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration Sudoku manquante.');
  }
  const { seed, playerIds, difficulty = DEFAULT_LEVEL, puzzle } = config;
  if (!isSeed(seed)) {
    throw new Error('La seed doit être un entier entre 0 et 4294967295.');
  }
  if (!Array.isArray(playerIds) || playerIds.length !== 1 || typeof playerIds[0] !== 'string') {
    throw new Error('Le Sudoku se joue seul : playerIds doit contenir exactement un identifiant.');
  }
  if (!isLevelId(difficulty)) {
    throw new Error(`Niveau inconnu : ${difficulty}.`);
  }
  return { seed, playerId: playerIds[0], difficulty, puzzle };
}

/** Grille imposée : vérifiée (solution unique) et classée par le solveur humain. */
function loadPuzzle(text) {
  const givens = parseGrid(text);
  if (countSolutions(givens, 2) !== 1) {
    throw new Error('La grille imposée doit avoir exactement une solution.');
  }
  return { givens, solution: solveExact(givens), level: ratePuzzle(givens).level };
}

const contentAt = (state, cell) => ({ value: state.values[cell], notes: state.notes[cell] });
const sameContent = (a, b) => a.value === b.value && a.notes === b.notes;

/**
 * Transforme des contenus cibles en changements, en ignorant les cases inchangées.
 * @param {SudokuState} state
 * @param {Map<number, CellContent>} targets
 * @returns {CellChange[]}
 */
function diff(state, targets) {
  return [...targets.entries()]
    .map(([cell, after]) => ({ cell, before: contentAt(state, cell), after }))
    .filter(({ before, after }) => !sameContent(before, after))
    .sort((a, b) => a.cell - b.cell);
}

/** Copie l'état en appliquant un côté (`before` ou `after`) d'un changement. */
function withContents(state, change, side) {
  const values = [...state.values];
  const notes = [...state.notes];
  for (const entry of change) {
    values[entry.cell] = entry[side].value;
    notes[entry.cell] = entry[side].notes;
  }
  const touched = new Set(change.map(({ cell }) => cell));
  const isSolved = values.every((value, cell) => value === state.solution[cell]);
  return {
    ...state,
    values,
    notes,
    // Une case modifiée n'est plus « vérifiée » : son marquage d'erreur disparaît.
    errorCells: state.errorCells.filter((cell) => !touched.has(cell)),
    moves: state.moves + 1,
    gameOver: isSolved,
    winners: isSolved ? [state.playerId] : null,
  };
}

/** Applique un nouveau changement et l'empile pour « annuler » (vide « refaire »). */
function commit(state, change) {
  const next = withContents(state, change, 'after');
  return { ...next, history: { undo: [...state.history.undo, change], redo: [] } };
}

/** Poser un chiffre efface les notes de la case et ce chiffre des notes de ses pairs. */
function placementTargets(state, cell, value) {
  const targets = new Map([[cell, { value, notes: 0 }]]);
  for (const peer of PEERS[cell]) {
    if (state.notes[peer] & digitBit(value)) {
      targets.set(peer, { value: state.values[peer], notes: state.notes[peer] & ~digitBit(value) });
    }
  }
  return targets;
}

/** Notes automatiques : chaque case vide reçoit exactement ses candidats actuels. */
function fillNotesTargets(state) {
  const candidates = computeCandidates(state.values);
  const targets = new Map();
  state.values.forEach((value, cell) => {
    if (value === 0) {
      targets.set(cell, { value: 0, notes: candidates[cell] });
    }
  });
  return targets;
}

function restartTargets(state) {
  const targets = new Map();
  state.givens.forEach((given, cell) => {
    if (given === 0) {
      targets.set(cell, { value: 0, notes: 0 });
    }
  });
  return targets;
}

/** Valide le contenu d'une action, l'état et le joueur étant déjà vérifiés. */
const VALIDATORS = {
  place: (state, { cell, value }) => isEditable(state, cell) && isDigit(value) && state.values[cell] !== value,
  erase: (state, { cell }) => isEditable(state, cell) && (state.values[cell] !== 0 || state.notes[cell] !== 0),
  note: (state, { cell, value }) => isEditable(state, cell) && isDigit(value) && state.values[cell] === 0,
  fillNotes: (state) => diff(state, fillNotesTargets(state)).length > 0,
  check: (state) => state.values.some((value, cell) => value !== 0 && state.givens[cell] === 0),
  restart: (state) => diff(state, restartTargets(state)).length > 0,
  undo: (state) => state.history.undo.length > 0,
  redo: (state) => state.history.redo.length > 0,
};

/** Calcule le nouvel état ; l'action est supposée valide. */
const REDUCERS = {
  place: (state, { cell, value }) => commit(state, diff(state, placementTargets(state, cell, value))),
  erase: (state, { cell }) => commit(state, diff(state, new Map([[cell, { value: 0, notes: 0 }]]))),
  note: (state, { cell, value }) => commit(state, diff(state, new Map([[cell, { value: 0, notes: state.notes[cell] ^ digitBit(value) }]]))),
  fillNotes: (state) => commit(state, diff(state, fillNotesTargets(state))),
  restart: (state) => commit(state, diff(state, restartTargets(state))),
  check: (state) => ({
    ...state,
    checks: state.checks + 1,
    errorCells: state.values.flatMap((value, cell) => (
      value !== 0 && state.givens[cell] === 0 && value !== state.solution[cell] ? [cell] : []
    )),
  }),
  undo(state) {
    const change = state.history.undo.at(-1);
    const next = withContents(state, change, 'before');
    return { ...next, history: { undo: state.history.undo.slice(0, -1), redo: [...state.history.redo, change] } };
  },
  redo(state) {
    const change = state.history.redo.at(-1);
    const next = withContents(state, change, 'after');
    return { ...next, history: { undo: [...state.history.undo, change], redo: state.history.redo.slice(0, -1) } };
  },
};

/**
 * Moteur de Sudoku conforme au contrat GameEngine du lab.
 */
export class SudokuEngine {
  /**
   * Crée une partie. Sans `puzzle`, la grille est générée à partir de la seed et du niveau.
   * @param {SudokuConfig} config
   * @returns {SudokuState}
   * @throws {Error} Configuration invalide.
   */
  init(config) {
    const { seed, playerId, difficulty, puzzle } = readConfig(config);
    const rng = new SeededRandom(seed);
    const grid = puzzle === undefined ? generatePuzzle(rng, difficulty) : loadPuzzle(puzzle);
    return {
      version: 1,
      playerId,
      seed,
      requestedLevel: difficulty,
      level: grid.level,
      custom: puzzle !== undefined,
      givens: grid.givens,
      solution: grid.solution,
      values: [...grid.givens],
      notes: new Array(CELL_COUNT).fill(0),
      history: { undo: [], redo: [] },
      errorCells: [],
      checks: 0,
      moves: 0,
      rngState: rng.getState(),
      gameOver: false,
      winners: null,
    };
  }

  /**
   * @param {SudokuState} state
   * @param {SudokuAction} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return false;
    }
    if (playerId !== state.playerId || state.gameOver || !Object.hasOwn(VALIDATORS, action.type)) {
      return false;
    }
    return VALIDATORS[action.type](state, action);
  }

  /**
   * Applique une action sans modifier l'état reçu.
   * @param {SudokuState} state
   * @param {SudokuAction} action
   * @param {string} playerId
   * @returns {SudokuState}
   * @throws {Error} Action invalide, partie terminée ou mauvais joueur.
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error(`Action Sudoku invalide : ${JSON.stringify(action) ?? String(action)}`);
    }
    return REDUCERS[action.type](state, action);
  }

  /**
   * Sous-ensemble concret et utile des actions valides (le contrat l'autorise pour les
   * entrées paramétrées) : poser un candidat dans une case vide, ou effacer une case
   * remplie par le joueur. Les notes et commandes d'édition restent valides mais ne
   * sont pas énumérées, pour garder une liste courte (au plus 81 × 9 actions).
   * @param {SudokuState} state
   * @param {string} playerId
   * @returns {SudokuAction[]}
   */
  getValidActions(state, playerId) {
    if (playerId !== state.playerId || state.gameOver) {
      return [];
    }
    const candidates = computeCandidates(state.values);
    return state.values.flatMap((value, cell) => {
      if (state.givens[cell] !== 0) {
        return [];
      }
      if (value !== 0) {
        return [{ type: 'erase', cell }];
      }
      return DIGITS
        .filter((digit) => candidates[cell] & digitBit(digit))
        .map((digit) => ({ type: 'place', cell, value: digit }));
    });
  }

  /**
   * Vue du joueur, construite par liste blanche : tout sauf la solution, l'historique
   * détaillé et l'état du RNG. Les bots décident uniquement à partir de cette vue.
   * @param {SudokuState} state
   * @param {string} _playerId Partie solo : la vue est la même pour tous.
   * @returns {SudokuView}
   */
  getPlayerView(state, _playerId) {
    return {
      version: state.version,
      playerId: state.playerId,
      seed: state.seed,
      requestedLevel: state.requestedLevel,
      level: state.level,
      custom: state.custom,
      givens: [...state.givens],
      values: [...state.values],
      notes: [...state.notes],
      errorCells: [...state.errorCells],
      checks: state.checks,
      moves: state.moves,
      canUndo: state.history.undo.length > 0,
      canRedo: state.history.redo.length > 0,
      gameOver: state.gameOver,
      winners: state.winners && [...state.winners],
    };
  }

  /** @param {SudokuState} state @returns {boolean} */
  isGameOver(state) {
    return state.gameOver;
  }

  /** @param {SudokuState} state @returns {string[] | null} */
  getWinners(state) {
    return state.gameOver ? [...state.winners] : null;
  }

  /** @param {SudokuState} state @returns {string | null} */
  getCurrentPlayer(state) {
    return state.gameOver ? null : state.playerId;
  }
}

const isMaskArray = (masks) => Array.isArray(masks) && masks.length === CELL_COUNT
  && masks.every((mask) => Number.isInteger(mask) && mask >= 0 && mask <= ALL_DIGITS);

const hasHistory = (history) => Array.isArray(history?.undo) && Array.isArray(history?.redo);

/**
 * Vrai si une valeur a la forme d'un état de ce moteur : sert à refuser une reprise
 * locale corrompue ou d'un format futur, sans rejouer les règles.
 * @param {unknown} value
 * @returns {value is SudokuState}
 */
export function isSudokuState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) {
    return false;
  }
  const grids = [value.givens, value.solution, value.values].every(isGridArray);
  return grids && isMaskArray(value.notes) && hasHistory(value.history)
    && Array.isArray(value.errorCells) && isLevelId(value.level);
}

export default SudokuEngine;
