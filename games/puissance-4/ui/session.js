/**
 * Session de jeu côté client, sans DOM : historique des états, tour de l'IA
 * et annulation. Testable sous Node comme le moteur.
 *
 * L'historique garde chaque état et l'état du RNG des bots qui l'accompagne :
 * annuler revient exactement en arrière, et rejouer redonne les mêmes coups.
 */

import { Puissance4Engine } from '../engine.js';

/** Identifiants des joueurs : le premier joue Rouge, le second Jaune. */
export const PLAYER_IDS = Object.freeze(['rouge', 'jaune']);

/** Identifiant du joueur d'une couleur. */
const idOf = (color) => (color === 'yellow' ? PLAYER_IDS[1] : PLAYER_IDS[0]);

/**
 * @typedef {Object} SessionSettings
 * @property {'ai' | 'duo'} mode - Contre l'IA ou à deux sur le même appareil
 * @property {'red' | 'yellow'} humanColor - Couleur de l'humain (mode IA)
 * @property {'red' | 'yellow'} firstColor - Couleur qui commence
 * @property {string} level - Niveau de l'IA (voir bots/levels.js)
 * @property {number} seed - Graine de la partie et du RNG des bots
 */

export class GameSession {
  /** @type {{ state: import('../engine.js').Puissance4State, rngState: number }[]} */
  #history = [];

  /**
   * @param {Puissance4Engine} [engine] - Moteur de règles
   */
  constructor(engine = new Puissance4Engine()) {
    this.engine = engine;
    /** @type {SessionSettings | null} */
    this.settings = null;
    /** @type {string | null} */
    this.aiPlayerId = null;
  }

  /**
   * Démarre une partie.
   * @param {SessionSettings} settings - Réglages validés par l'interface
   */
  start(settings) {
    this.settings = { ...settings };
    this.aiPlayerId = settings.mode === 'ai' ? idOf(settings.humanColor === 'red' ? 'yellow' : 'red') : null;
    const state = this.engine.init({ seed: settings.seed, playerIds: [...PLAYER_IDS], firstPlayerId: idOf(settings.firstColor) });
    this.#history = [{ state, rngState: settings.seed >>> 0 }];
  }

  /** @returns {import('../engine.js').Puissance4State} État courant */
  get state() {
    return this.#history.at(-1).state;
  }

  /** @returns {number} État du RNG des bots */
  get rngState() {
    return this.#history.at(-1).rngState;
  }

  /** @returns {Record<string, string>} Nom affiché de chaque joueur */
  get names() {
    if (this.aiPlayerId === null) {
      return { [PLAYER_IDS[0]]: 'Rouge', [PLAYER_IDS[1]]: 'Jaune' };
    }
    const label = (id) => (id === this.aiPlayerId ? 'l’IA' : 'vous');
    return { [PLAYER_IDS[0]]: `Rouge (${label(PLAYER_IDS[0])})`, [PLAYER_IDS[1]]: `Jaune (${label(PLAYER_IDS[1])})` };
  }

  /** @returns {boolean} Est-ce à l'IA de jouer ? */
  isAiTurn() {
    return this.aiPlayerId !== null && !this.state.gameOver && this.state.currentPlayerId === this.aiPlayerId;
  }

  /**
   * Un humain peut-il jouer cette colonne maintenant ?
   * @param {number} column - Colonne (0 à 6)
   * @returns {boolean}
   */
  canHumanPlay(column) {
    return !this.isAiTurn() && this.engine.isValidAction(this.state, { type: 'drop', column }, this.state.currentPlayerId);
  }

  /**
   * Joue pour le joueur au trait (humain ou IA).
   * @param {number} column - Colonne (0 à 6)
   * @param {number} [rngState] - Nouvel état du RNG après un coup de bot
   * @returns {import('../engine.js').Move} Le coup joué
   * @throws {Error} Si le coup est invalide (voir le moteur)
   */
  play(column, rngState = this.rngState) {
    const { state } = this;
    const next = this.engine.applyAction(state, { type: 'drop', column }, state.currentPlayerId);
    this.#history.push({ state: next, rngState });
    return next.moves.at(-1);
  }

  /** @returns {boolean} Un retour en arrière est-il possible ? */
  canUndo() {
    return this.#undoTarget() >= 0;
  }

  /**
   * Annule le dernier coup humain. Contre l'IA, on revient au dernier état où
   * l'humain avait le trait : cela retire aussi la réponse de l'IA.
   * @returns {boolean} Vrai si quelque chose a été annulé
   */
  undo() {
    const target = this.#undoTarget();
    if (target < 0) {
      return false;
    }
    this.#history.length = target + 1;
    return true;
  }

  /** @returns {number} Index de l'état à retrouver, ou -1 */
  #undoTarget() {
    for (let index = this.#history.length - 2; index >= 0; index--) {
      if (this.#history[index].state.currentPlayerId !== this.aiPlayerId) {
        return index;
      }
    }
    return -1;
  }
}
