/**
 * Bot « Retour sur trace » : la force brute, pour comparer avec la logique.
 *
 * Stratégie : résoudre la grille des chiffres DONNÉS avec le solveur exact (essais
 * et retours en arrière, sans raisonnement), puis remplir les cases dans l'ordre de
 * lecture, ligne par ligne. Un chiffre du joueur qui contredit cette solution est
 * effacé d'abord. Le bot ne lit que la vue : la solution, il la recalcule.
 *
 * `lastAdvice.nodes` donne le nombre de nœuds explorés par la recherche : c'est
 * le coût de la méthode, qui ne produit aucune explication réutilisable par un humain.
 */

import { cellName } from '../engine/grid.js';
import { findSolution } from '../engine/exact-solver.js';
import { findMistake } from '../engine/advisor.js';
import { pickValidAction } from './shared.js';

export class BacktrackingBot {
  name = 'Retour sur trace';
  description = 'Résout par essais et retours en arrière, case après case';
  difficulty = 'expert';

  /** Dernière décision, avec le coût de la recherche. */
  lastAdvice = null;

  /**
   * @param {import('../engine.js').SudokuView} view
   * @param {object[]} validActions
   * @returns {object}
   * @throws {Error} Si la grille est terminée ou sans solution.
   */
  chooseAction(view, validActions) {
    const { solution, nodes } = findSolution(view.givens);
    const mistake = solution ? findMistake(view, solution) : -1;
    const empty = view.values.indexOf(0);
    if (!solution || (mistake === -1 && empty === -1)) {
      throw new Error('Aucun coup à jouer : grille terminée ou sans solution.');
    }
    const decision = mistake === -1
      ? { type: 'place', cell: empty, value: solution[empty] }
      : { type: 'erase', cell: mistake };
    this.lastAdvice = {
      kind: decision.type === 'place' ? 'search' : 'mistake',
      action: decision,
      technique: 'Retour sur trace',
      detail: decision.type === 'place'
        ? `Solution trouvée par essais-erreurs (${nodes} nœuds explorés) : ${decision.value} en ${cellName(empty)}.`
        : `Le chiffre en ${cellName(mistake)} contredit la solution : il est effacé.`,
      nodes,
    };
    return pickValidAction(validActions, decision);
  }
}

export default BacktrackingBot;
