/**
 * Session de jeu côté client, sans DOM : état courant, annuler/refaire.
 *
 * L'annulation vit ici et non dans le moteur : chaque état est un objet JSON
 * immuable, garder la pile des états précédents suffit pour revenir en
 * arrière sans limite. Le moteur reste une simple fonction de transition.
 *
 * @module games/solitaire/ui/session
 */

import { SolitaireEngine } from '../engine.js';
import { viewKey } from '../ai/planner.js';

export class GameSession {
  #engine;
  #playerId;
  #past = [];
  #future = [];
  /** @type {import('../engine.js').SolitaireState|null} */
  #state = null;

  /**
   * @param {{engine?: SolitaireEngine, playerId?: string}} [options]
   */
  constructor({ engine = new SolitaireEngine(), playerId = 'joueur' } = {}) {
    this.#engine = engine;
    this.#playerId = playerId;
  }

  /**
   * Distribue une nouvelle donne et vide l'historique.
   * @param {{seed: number, drawCount: 1|3, winnableOnly?: boolean}} deal
   * @returns {import('../engine.js').SolitaireState}
   */
  start({ seed, drawCount, winnableOnly = false }) {
    this.#state = this.#engine.init({ seed, playerIds: [this.#playerId], options: { drawCount, winnableOnly } });
    this.#past = [];
    this.#future = [];
    return this.#state;
  }

  /** État complet (cartes cachées comprises) : réservé au moteur et au rendu des compteurs. */
  get state() {
    return this.#state;
  }

  /** Vue du joueur : la seule source du rendu et de l'IA. */
  get view() {
    return this.#engine.getPlayerView(this.#state, this.#playerId);
  }

  /** Nombre d'actions jouées depuis la donne (annulations déduites). */
  get depth() {
    return this.#past.length;
  }

  /**
   * @param {import('../engine/rules.js').SolitaireAction} action
   * @returns {boolean}
   */
  canPlay(action) {
    return this.#engine.isValidAction(this.#state, action, this.#playerId);
  }

  /** @returns {import('../engine/rules.js').SolitaireAction[]} */
  validActions() {
    return this.#engine.getValidActions(this.#state, this.#playerId);
  }

  /**
   * Joue une action légale ; une nouvelle action efface les états « refaire ».
   * @param {import('../engine/rules.js').SolitaireAction} action
   * @returns {boolean} Faux si l'action est refusée (l'état ne change pas)
   */
  play(action) {
    if (!this.canPlay(action)) {
      return false;
    }
    this.#past.push(this.#state);
    this.#future = [];
    this.#state = this.#engine.applyAction(this.#state, action, this.#playerId);
    return true;
  }

  /** @returns {boolean} Vrai si un état a été restauré */
  undo() {
    if (!this.#past.length) {
      return false;
    }
    this.#future.push(this.#state);
    this.#state = this.#past.pop();
    return true;
  }

  /** @returns {boolean} Vrai si un état annulé a été rejoué */
  redo() {
    if (!this.#future.length) {
      return false;
    }
    this.#past.push(this.#state);
    this.#state = this.#future.pop();
    return true;
  }

  get canUndo() {
    return this.#past.length > 0;
  }

  get canRedo() {
    return this.#future.length > 0;
  }

  /**
   * Positions déjà jouées, telles que le joueur les a vues : l'indice évite
   * ainsi de conseiller un retour en arrière.
   * @returns {Set<string>}
   */
  historyKeys() {
    return new Set([...this.#past, this.#state]
      .map(state => viewKey(this.#engine.getPlayerView(state, this.#playerId))));
  }
}
