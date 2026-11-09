/**
 * Bot Minimax — recherche négamax alpha-bêta avec approfondissement itératif
 * et table de transposition (voir ai/search.js et le README du jeu).
 *
 * Le budget se compte en nœuds, pas en millisecondes : le bot joue exactement
 * le même coup sur toutes les machines. Entre coups équivalents, le RNG fourni
 * départage, ce qui varie les parties sans sacrifier la reproductibilité.
 * @see docs/guides/create-bot.md
 */

import { analyzeView } from '../ai/advisor.js';
import { DEFAULT_BUDGET } from '../ai/search.js';

export class MinimaxBot {
  name = 'Minimax';
  description = 'Négamax alpha-bêta, approfondissement itératif et table de transposition';
  difficulty = 'expert';

  /**
   * @param {import('../ai/search.js').SearchBudget} [budget] - Profondeur et nœuds maximum
   */
  constructor(budget = DEFAULT_BUDGET) {
    this.budget = budget;
  }

  /**
   * Choisit le coup et renvoie l'analyse qui l'a justifié (évaluation, indice).
   * @param {import('../engine.js').Puissance4State} view - Vue du joueur au trait
   * @param {Array<{ type: 'drop', column: number }>} validActions - Colonnes jouables
   * @param {{ pick: <T>(items: T[]) => T }} rng - Générateur aléatoire déterministe
   * @returns {{ action: { type: 'drop', column: number }, analysis: import('../ai/advisor.js').Analysis }}
   */
  chooseWithAnalysis(view, validActions, rng) {
    const analysis = analyzeView(view, this.budget);
    const best = validActions.filter((action) => analysis.bestMoves.includes(action.column));
    return { action: rng.pick(best.length > 0 ? best : validActions), analysis };
  }

  /**
   * Interface Bot du lab.
   * @param {import('../engine.js').Puissance4State} view - Vue du joueur au trait
   * @param {Array<{ type: 'drop', column: number }>} validActions - Colonnes jouables
   * @param {{ pick: <T>(items: T[]) => T }} rng - Générateur aléatoire déterministe
   * @returns {{ type: 'drop', column: number }}
   */
  chooseAction(view, validActions, rng) {
    return this.chooseWithAnalysis(view, validActions, rng).action;
  }
}

export default MinimaxBot;
