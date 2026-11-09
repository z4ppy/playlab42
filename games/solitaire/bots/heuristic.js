/**
 * Bot Heuristique : joue le coup conseillé par le planificateur d'indices.
 *
 * Il ne reçoit que la vue du joueur : les cartes cachées et le talon lui sont
 * inconnus, exactement comme pour un humain. Sa seule mémoire est la liste des
 * positions qu'il a déjà vues pendant la partie, qui lui évite de revenir en
 * arrière (va-et-vient entre deux colonnes).
 *
 * `lastHint` garde l'indice du dernier choix : le client l'affiche pour
 * expliquer chaque coup quand on « regarde l'IA jouer ».
 *
 * @see docs/guides/create-bot.md
 */

import { findHint, viewKey } from '../ai/planner.js';

/** Deux actions désignent-elles le même coup ? */
function sameAction(a, b) {
  return a.type === b.type && a.from === b.from && a.to === b.to && a.count === b.count;
}

export class HeuristicBot {
  name = 'Heuristique';
  description = 'Cherche le meilleur plan visible : fondations, cartes cachées, colonnes vides';
  difficulty = 'hard';

  /** @type {import('../ai/planner.js').Hint|null} */
  lastHint = null;

  #seen = new Set();
  #options;

  /**
   * @param {import('../ai/planner.js').HintOptions} [options] - Budget du planificateur
   */
  constructor(options = {}) {
    this.#options = options;
  }

  /** Une nouvelle partie efface la mémoire des positions. */
  onGameStart() {
    this.#seen = new Set();
    this.lastHint = null;
  }

  /**
   * @param {import('../engine.js').SolitaireView} view - Vue du joueur
   * @param {import('../engine/rules.js').SolitaireAction[]} validActions - Actions légales
   * @param {import('../../../lib/seeded-random.js').SeededRandom} rng - Aléatoire, utilisé seulement si l'IA est bloquée
   * @returns {import('../engine/rules.js').SolitaireAction}
   */
  chooseAction(view, validActions, rng) {
    this.#seen.add(viewKey(view));
    this.lastHint = findHint(view, { ...this.#options, history: this.#seen });
    const advised = this.lastHint.action;
    const match = advised && validActions.find(action => sameAction(action, advised));
    // Le contrat impose de rendre une action : bloqué, le bot pioche ou joue au hasard.
    return match ?? validActions.find(action => action.type !== 'move') ?? rng.pick(validActions);
  }
}

export default HeuristicBot;
