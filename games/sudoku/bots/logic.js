/**
 * Bot « Logique » : joue comme un humain méthodique.
 *
 * Stratégie : demander au conseiller la prochaine déduction (techniques simples
 * d'abord : singletons, intersections, sous-ensembles, X-Wing...). Les éliminations
 * intermédiaires restent internes ; le bot joue la pose de chiffre qu'elles justifient.
 * S'il trouve un chiffre faux (conflit ou contradiction avec la solution recalculée
 * depuis les données), il l'efface d'abord.
 *
 * Il ne lit que la vue du joueur, qui ne contient pas la solution.
 * Faiblesse connue : sur une grille imposée qui dépasse ses techniques, il se replie
 * sur le solveur exact (le conseil est alors marqué `search`).
 */

import { adviseNextMove } from '../engine/advisor.js';
import { pickValidAction } from './shared.js';

export class LogicBot {
  name = 'Logique';
  description = 'Enchaîne des déductions humaines et explique chaque coup';
  difficulty = 'expert';

  /** Dernier conseil suivi, pour afficher la technique à l'écran. @type {import('../engine/advisor.js').Advice | null} */
  lastAdvice = null;

  /**
   * @param {import('../engine.js').SudokuView} view
   * @param {object[]} validActions
   * @returns {object}
   * @throws {Error} Si la grille est déjà terminée.
   */
  chooseAction(view, validActions) {
    const advice = adviseNextMove(view);
    if (!advice) {
      throw new Error('La grille est terminée : aucun coup à jouer.');
    }
    this.lastAdvice = advice;
    return pickValidAction(validActions, advice.action);
  }
}

export default LogicBot;
