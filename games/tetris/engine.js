/**
 * Moteur Tetris déterministe, isomorphe et sérialisable.
 * Les seuls temps utilisés sont les millisecondes explicites des actions tick.
 * L'entrée publique orchestre file, verrouillage et temps ; engine/ sépare
 * géométrie SRS, commandes manuelles et bilan de score, sans changer le JSON.
 */
import { SeededRandom } from '../../lib/seeded-random.js';
import { PIECES, getCells, getDropInterval, getGhostPiece, fits, getSpin, placeAndClear } from './engine/board.js';
import { ACTIONS, validConfig, validCommand, rotate, translate } from './engine/commands.js';
import { recordClear } from './engine/scoring.js';

export { PIECES, getCells, getDropInterval, getGhostPiece };

/**
 * @typedef {'I'|'J'|'L'|'O'|'S'|'T'|'Z'} PieceType
 * @typedef {{type: PieceType, rotation: number, x: number, y: number}} Piece
 * @typedef {{type: string, delta?: number}} TetrisAction
 * @typedef {Object} TetrisState
 * @property {(PieceType|null)[][]} board - Vingt lignes visibles de dix cases.
 * @property {Piece|null} active - Pièce mobile, éventuellement au-dessus de la grille.
 * @property {PieceType[]} queue - File comprenant au moins cinq prochaines pièces.
 * @property {PieceType|null} hold - Réserve.
 * @property {boolean} canHold - Une réserve autorisée par pièce.
 * @property {number} score - Points cumulés.
 * @property {number} lines - Lignes cumulées.
 * @property {number} level - Niveau, une augmentation toutes les dix lignes.
 * @property {number} elapsed - Temps simulé écoulé en millisecondes.
 * @property {'marathon'|'sprint'|'ultra'} mode - Objectif de la partie.
 * @property {boolean} gameOver - Partie terminée.
 * @property {string[]|null} winners - Joueur gagnant ou null en cas de dépassement.
 * @property {number} piecesPlaced - Nombre de pièces verrouillées.
 * @property {number} combo - Série de clears ; -1 avant le premier clear.
 * @property {boolean} backToBack - Série de clears difficiles en cours.
 * @property {{lines:number,label:string,points:number}} lastClear - Dernier verrouillage.
 * @property {string} currentPlayerId - Joueur solo.
 * @property {number} rngState - État 32 bits du générateur.
 * @property {number} gravityElapsed - Temps depuis le dernier pas de gravité.
 * @property {number} lockElapsed - Temps passé posé depuis le dernier reset.
 * @property {number} lockResets - Resets de verrouillage consommés (maximum quinze).
 * @property {{kick:number}|null} lastRotation - Rotation non annulée par un déplacement manuel.
 */

const TYPES = Object.keys(PIECES);
const LOCK_DELAY = 500;
const ULTRA_DURATION = 120000;
// Les pas de requestAnimationFrame peuvent additionner 999,999999999998 ms.
const TIME_EPSILON = 1e-9;

/** @param {TetrisState} state - Copie mutable privée, complétée par sacs entiers. */
function refill(state) {
  if (state.queue.length >= 5) { return; }
  const rng = SeededRandom.fromState(state.rngState);
  state.queue.push(...rng.shuffle([...TYPES]));
  state.rngState = rng.getState() >>> 0;
}

/** @param {TetrisState} state - Copie privée. @param {boolean} victory - Objectif accompli. */
function finish(state, victory) {
  state.gameOver = true;
  state.winners = victory ? [state.currentPlayerId] : null;
  state.active = null;
}

/** @param {TetrisState} state - Copie privée. @param {PieceType} type - Type à faire apparaître. */
function spawn(state, type) {
  state.active = { type, rotation: 0, x: type === 'O' ? 4 : 3, y: -1 };
  state.gravityElapsed = 0;
  state.lockElapsed = 0;
  state.lockResets = 0;
  state.lastRotation = null;
  if (!fits(state, state.active)) { finish(state, false); }
}

/** @param {TetrisState} state - Copie privée, avec cinq aperçus garantis. */
function spawnNext(state) {
  refill(state);
  const type = state.queue.shift();
  refill(state);
  spawn(state, type);
}

/** @param {TetrisState} state - Copie privée, sans écriture de cellule cachée. */
function lock(state) {
  const cells = getCells(state.active);
  if (cells.some(({ y }) => y < 0) || !fits(state, state.active)) {
    finish(state, false);
    return;
  }
  const spin = getSpin(state);
  recordClear(state, spin, placeAndClear(state, cells));
  state.canHold = true;
  if (state.mode === 'sprint' && state.lines >= 40) { finish(state, true); }
  else { spawnNext(state); }
}

/**
 * Avance jusqu'au prochain événement plutôt qu'arrondir par frame.
 * Gravité, contact, verrouillage et limite Ultra restent indépendants du découpage.
 * @param {TetrisState} state - Copie privée.
 * @param {number} delta - Millisecondes à simuler.
 */
function tick(state, delta) {
  let remaining = delta;
  while (remaining > 0 && !state.gameOver) {
    const interval = getDropInterval(state.level);
    const grounded = !fits(state, { ...state.active, y: state.active.y + 1 });
    const untilGravity = Math.max(0, interval - state.gravityElapsed);
    const untilLock = grounded ? Math.max(0, LOCK_DELAY - state.lockElapsed) : Infinity;
    const untilEnd = state.mode === 'ultra' ? ULTRA_DURATION - state.elapsed : Infinity;
    const step = Math.min(remaining, untilGravity, untilLock, untilEnd);
    state.elapsed += step;
    state.gravityElapsed += step;
    if (grounded) { state.lockElapsed += step; }
    remaining -= step;
    resolveTimedEvent(state, grounded, interval);
  }
}

function resolveTimedEvent(state, grounded, interval) {
  if (state.mode === 'ultra' && state.elapsed >= ULTRA_DURATION - TIME_EPSILON) {
    state.elapsed = ULTRA_DURATION;
    finish(state, true);
  } else if (grounded && state.lockElapsed >= LOCK_DELAY - TIME_EPSILON) {
    lock(state);
  } else if (state.gravityElapsed >= interval - TIME_EPSILON) {
    state.gravityElapsed = 0;
    const down = { ...state.active, y: state.active.y + 1 };
    if (fits(state, down)) { state.active = down; }
  }
}

function hold(state) {
  const held = state.hold;
  state.hold = state.active.type;
  if (held) { spawn(state, held); } else { spawnNext(state); }
  state.canHold = false;
}

function hardDrop(state) {
  const startY = state.active.y;
  state.active = getGhostPiece(state);
  state.score += (state.active.y - startY) * 2;
  lock(state);
}

/** Moteur solo conforme au contrat GameEngine du dépôt. */
export class TetrisEngine {
  /**
   * @param {{seed:number,playerIds:[string],mode?:'marathon'|'sprint'|'ultra'}} config - Configuration.
   * @returns {TetrisState} État initial complet.
   */
  init(config) {
    if (!validConfig(config)) { throw new Error('Invalid Tetris configuration'); }
    const state = {
      board: Array.from({ length: 20 }, () => Array(10).fill(null)),
      active: null, queue: [], hold: null, canHold: true,
      score: 0, lines: 0, level: 1, elapsed: 0,
      mode: config.mode ?? 'marathon', gameOver: false, winners: null,
      piecesPlaced: 0, combo: -1, backToBack: false,
      lastClear: { lines: 0, label: 'None', points: 0 },
      currentPlayerId: config.playerIds[0], rngState: config.seed >>> 0,
      gravityElapsed: 0, lockElapsed: 0, lockResets: 0, lastRotation: null,
    };
    spawnNext(state);
    return state;
  }

  /**
   * Une collision est une action valide sans effet, contrairement à une mauvaise entrée.
   * @param {TetrisState} state - État.
   * @param {TetrisAction} action - Action.
   * @param {string} playerId - Joueur.
   * @returns {boolean} Action autorisée.
   */
  isValidAction(state, action, playerId) {
    return Boolean(state && !state.gameOver && state.active
      && state.currentPlayerId === playerId && validCommand(action, state.canHold));
  }

  /**
   * Retourne des actions concrètes valides ; tick(0) représente l'action paramétrée.
   * @param {TetrisState} state - État.
   * @param {string} playerId - Joueur.
   * @returns {TetrisAction[]} Actions disponibles.
   */
  getValidActions(state, playerId) {
    return ACTIONS.map(type => type === 'tick' ? { type, delta: 0 } : { type })
      .filter(action => this.isValidAction(state, action, playerId));
  }

  /**
   * Copie les structures modifiées ; aucune entrée, même gelée, n'est mutée.
   * @param {TetrisState} state - État précédent.
   * @param {TetrisAction} action - Action validée.
   * @param {string} playerId - Joueur.
   * @returns {TetrisState} Nouvel état.
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) { throw new Error('Invalid action'); }
    const next = {
      ...state, board: state.board.map(row => [...row]), queue: [...state.queue],
      active: { ...state.active }, lastClear: { ...state.lastClear },
      lastRotation: state.lastRotation ? { ...state.lastRotation } : null,
      winners: state.winners ? [...state.winners] : null,
    };
    const grounded = !fits(next, { ...next.active, y: next.active.y + 1 });
    if (action.type === 'tick') {
      tick(next, action.delta);
    } else if (action.type === 'hold') {
      hold(next);
    } else if (action.type === 'hardDrop') {
      hardDrop(next);
    } else if (action.type === 'rotateCW' || action.type === 'rotateCCW') {
      rotate(next, action.type === 'rotateCW' ? 1 : 3, grounded);
    } else {
      translate(next, action.type, grounded);
    }
    return next;
  }

  /**
   * @param {TetrisState} state - État sans information cachée.
   * @param {string} _playerId - Joueur.
   * @returns {TetrisState} Vue complète.
   */
  getPlayerView(state, _playerId) { return state; }

  /** @param {TetrisState} state - État. @returns {boolean} Partie terminée. */
  isGameOver(state) { return state.gameOver; }

  /** @param {TetrisState} state - État. @returns {string[]|null} Gagnants. */
  getWinners(state) { return state.winners; }

  /** @param {TetrisState} state - État. @returns {string} Joueur actif. */
  getCurrentPlayer(state) { return state.currentPlayerId; }
}

export default TetrisEngine;
