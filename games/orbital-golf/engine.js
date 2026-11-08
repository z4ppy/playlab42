/**
 * Moteur du golf orbital : déterministe, isomorphe et entièrement JSON.
 *
 * Un coup est résolu d'un bloc par la physique à pas fixe ; l'animation du vol
 * appartient au client, qui rejoue la même simulation pour l'afficher. Le moteur
 * ne lit ni horloge ni aléa global : le trou du jour reçoit sa date du client et
 * les trous générés dérivent leur graine de `seed` et de leur indice.
 *
 * Règles : un trou se termine quand la balle rentre ; une balle sortie, avalée
 * ou perdue en orbite compte le coup et revient au point de tir ; au huitième
 * coup sans succès, le trou est ramassé et compte 9.
 */
import { normalizeHole } from './engine/level.js';
import { INITIATION } from './engine/levels.js';
import { dailySeed, generateHole, holeSeed } from './engine/generator.js';
import { leavesSurface, simulateShot } from './engine/physics.js';
import { MAX_STROKES, PICKUP_SCORE } from './engine/scoring.js';

export { dailySeed };

/**
 * @typedef {'course'|'daily'|'free'} GolfMode
 * @typedef {{x:number, y:number, on:number|null}} Ball
 * @typedef {{type:'shoot', angle:number, power:number}|{type:'nextHole'}|{type:'restartHole'}} GolfAction
 * @typedef {{seed:number, playerIds?:string[], playerId?:string, mode?:GolfMode, date?:string}} GolfConfig
 * @typedef {Object} GolfState
 * @property {GolfMode} mode - Parcours d'initiation, trou du jour ou parcours libre.
 * @property {number} seed - Graine du parcours (trous générés).
 * @property {string|null} date - Date locale du trou du jour, sinon null.
 * @property {string} playerId - Joueur solo.
 * @property {number} holeCount - Nombre de trous du parcours.
 * @property {object[]} course - Trous déjà connus (générés à la demande, une seule fois).
 * @property {number} holeIndex - Trou courant.
 * @property {'aiming'|'holed'|'finished'} status - Visée, trou terminé ou partie finie.
 * @property {Ball} ball - Balle immobile (on : indice de la planète qui la porte).
 * @property {number} levelTime - Horloge du trou ; n'avance que pendant les vols.
 * @property {number[]} strokes - Coups par trou (9 si ramassé).
 * @property {number} restarts - Trous recommencés : un record exige zéro.
 * @property {object|null} lastShot - Dernier coup, suffisant pour rejouer son animation.
 */

const MODES = ['course', 'daily', 'free'];
const SAMPLE_ANGLES = Array.from({ length: 16 }, (_, index) => index * 225);
const SAMPLE_POWERS = [25, 50, 75];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Difficulté croissante du parcours libre ; moyenne pour le trou du jour.
 * @param {GolfMode} mode - Mode.
 * @param {number} index - Indice du trou.
 * @returns {number} Difficulté dans [0, 1].
 */
function difficultyFor(mode, index) {
  return mode === 'daily' ? 0.55 : index / 8;
}

/**
 * @param {GolfState} state - État en construction (copie privée).
 * @param {number} index - Trou à préparer.
 * @returns {object} Trou normalisé, ajouté à `course` s'il est généré.
 */
function holeAt(state, index) {
  if (!state.course[index]) {
    const label = state.mode === 'daily' ? `Trou du jour ${state.date}` : `Libre ${index + 1}`;
    state.course[index] = generateHole(holeSeed(state.seed, index), {
      id: `${state.mode}-${state.seed}-${index}`, name: label, difficulty: difficultyFor(state.mode, index),
    });
  }
  return state.course[index];
}

/** @param {GolfConfig} config - Configuration. @returns {boolean} Configuration exploitable. */
function validConfig(config) {
  if (!config || !Number.isInteger(config.seed)) { return false; }
  const mode = config.mode ?? 'course';
  if (!MODES.includes(mode) || typeof playerOf(config) !== 'string') { return false; }
  if (mode !== 'daily') { return true; }
  return DATE_PATTERN.test(config.date ?? '') && dailySeed(config.date) === config.seed >>> 0;
}

/** @param {GolfConfig} config - Configuration. @returns {string|undefined} Joueur solo. */
function playerOf(config) {
  return config.playerIds?.[0] ?? config.playerId;
}

/**
 * @param {unknown} value - Valeur.
 * @param {number} min - Minimum inclus.
 * @param {number} max - Maximum inclus.
 * @returns {boolean} Entier borné.
 */
const isIntegerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** @param {GolfState} state - État. @returns {object} Trou courant. */
const currentHole = state => state.course[state.holeIndex];

/**
 * Angle et puissance entiers ; depuis une planète, le tir doit quitter la surface.
 * @param {GolfState} state - État en visée.
 * @param {{angle:unknown, power:unknown}} action - Tir proposé.
 * @returns {boolean} Tir jouable.
 */
function isValidShot(state, action) {
  return isIntegerIn(action.angle, 0, 3599) && isIntegerIn(action.power, 1, 100)
    && leavesSurface(currentHole(state), state.ball, action.angle);
}

/** @param {GolfState} state - État. @returns {GolfState} Copie modifiable sans partage des tableaux. */
function copyState(state) {
  return {
    ...state, course: [...state.course], strokes: [...state.strokes],
    ball: { ...state.ball }, lastShot: state.lastShot,
  };
}

/** @param {GolfState} state - Copie privée : place la balle au départ du trou courant. */
function teeUp(state) {
  const hole = holeAt(state, state.holeIndex);
  state.ball = { x: hole.tee.x, y: hole.tee.y, on: null };
  state.levelTime = 0;
  state.status = 'aiming';
}

/** @param {GolfState} state - Copie privée : trou fini, ou partie finie au dernier trou. */
function closeHole(state) {
  state.status = state.holeIndex === state.holeCount - 1 ? 'finished' : 'holed';
}

/**
 * Applique un tir : la balle avance, s'arrête, rentre ou revient au point de tir.
 * @param {GolfState} state - Copie privée.
 * @param {{angle:number, power:number}} action - Tir validé.
 */
function shoot(state, action) {
  const hole = currentHole(state);
  const from = { ...state.ball };
  const result = simulateShot(hole, from, action.angle, action.power, state.levelTime);
  const strokes = state.strokes[state.holeIndex] + 1;
  state.strokes[state.holeIndex] = strokes;
  state.levelTime += result.duration;
  if (result.outcome === 'holed' || result.outcome === 'rest') {
    state.ball = { x: result.x, y: result.y, on: result.on };
  }
  const pickedUp = result.outcome !== 'holed' && strokes >= MAX_STROKES;
  state.lastShot = {
    angle: action.angle, power: action.power, outcome: result.outcome, from, t0: state.levelTime - result.duration,
    end: { x: result.x, y: result.y }, duration: result.duration, pickedUp,
  };
  if (pickedUp) { state.strokes[state.holeIndex] = PICKUP_SCORE; }
  if (result.outcome === 'holed' || pickedUp) { closeHole(state); }
}

/** Moteur solo conforme au contrat GameEngine du dépôt. */
export class OrbitalGolfEngine {
  /**
   * @param {GolfConfig} config - Graine, joueur, mode et date du trou du jour.
   * @returns {GolfState} État initial (le premier trou généré est déjà résolu).
   */
  init(config) {
    if (!validConfig(config)) { throw new Error('Configuration du golf orbital invalide'); }
    const mode = config.mode ?? 'course';
    const holeCount = mode === 'daily' ? 1 : INITIATION.length;
    const state = {
      mode, seed: config.seed >>> 0, date: mode === 'daily' ? config.date : null, playerId: playerOf(config),
      holeCount, course: mode === 'course' ? INITIATION.map(normalizeHole) : [],
      holeIndex: 0, status: 'aiming', ball: null, levelTime: 0,
      strokes: Array(holeCount).fill(0), restarts: 0, lastShot: null,
    };
    teeUp(state);
    return state;
  }

  /**
   * @param {GolfState} state - État.
   * @param {GolfAction} action - Action.
   * @param {string} playerId - Joueur.
   * @returns {boolean} Action autorisée dans cet état.
   */
  isValidAction(state, action, playerId) {
    if (!state || !action || state.status === 'finished' || playerId !== state.playerId) { return false; }
    if (action.type === 'nextHole') { return state.status === 'holed'; }
    if (state.status !== 'aiming') { return false; }
    if (action.type === 'restartHole') { return state.strokes[state.holeIndex] > 0; }
    return action.type === 'shoot' && isValidShot(state, action);
  }

  /**
   * Échantillon canonique : 16 directions × 3 puissances, filtré par la surface.
   * Les tirs sont paramétrés ; le contrat admet un sous-ensemble concret valide.
   * @param {GolfState} state - État.
   * @param {string} playerId - Joueur.
   * @returns {GolfAction[]} Actions concrètes valides.
   */
  getValidActions(state, playerId) {
    const candidates = [{ type: 'nextHole' }];
    for (const angle of SAMPLE_ANGLES) {
      for (const power of SAMPLE_POWERS) { candidates.push({ type: 'shoot', angle, power }); }
    }
    candidates.push({ type: 'restartHole' });
    return candidates.filter(action => this.isValidAction(state, action, playerId));
  }

  /**
   * @param {GolfState} state - État précédent, jamais modifié.
   * @param {GolfAction} action - Action.
   * @param {string} playerId - Joueur.
   * @returns {GolfState} Nouvel état.
   * @throws {Error} Si l'action est invalide.
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) { throw new Error('Action invalide'); }
    const next = copyState(state);
    if (action.type === 'shoot') {
      shoot(next, action);
    } else if (action.type === 'restartHole') {
      next.strokes[next.holeIndex] = 0;
      next.restarts += 1;
      next.lastShot = null;
      teeUp(next);
    } else {
      next.holeIndex += 1;
      next.lastShot = null;
      teeUp(next);
    }
    return next;
  }

  /**
   * Aucune information cachée : la vue est l'état complet.
   * @param {GolfState} state - État.
   * @param {string} _playerId - Joueur.
   * @returns {GolfState} Vue complète.
   */
  getPlayerView(state, _playerId) { return state; }

  /** @param {GolfState} state - État. @returns {boolean} Parcours terminé. */
  isGameOver(state) { return state.status === 'finished'; }

  /** @param {GolfState} state - État. @returns {string[]|null} Le joueur solo une fois le parcours fini. */
  getWinners(state) { return state.status === 'finished' ? [state.playerId] : null; }

  /** @param {GolfState} state - État. @returns {string} Joueur solo. */
  getCurrentPlayer(state) { return state.playerId; }
}

export default OrbitalGolfEngine;
