/**
 * Bot Solveur : joue le meilleur coup du solveur logique et probabiliste.
 *
 * Il ne lit que la vue joueur (`getPlayerView`) : chiffres ouverts et drapeaux,
 * jamais les mines. Ordre de préférence : corriger un drapeau prouvé faux,
 * ouvrir une case sûre, marquer une mine certaine, puis parier sur la case la
 * moins risquée (départage seedé entre cases à égalité).
 * @see games/demineur/solver/solver.js
 */
import { adviseMove } from '../solver/solver.js';

export class SolverBot {
  name = 'Solveur';
  description = 'Déductions logiques, puis la case la moins risquée';
  difficulty = 'expert';

  /**
   * Décide d'un coup et garde son explication (utilisée par « Regarder l'IA jouer »).
   * @param {import('../engine.js').MinesweeperView} view - Vue joueur.
   * @param {{pick: <T>(items: T[]) => T}} rng - Générateur seedé.
   * @param {{label?: (index: number) => string}} [options] - Étiquettes des cases.
   * @returns {import('../solver/solver.js').Advice} Coup et raisonnement.
   */
  decide(view, rng, { label } = {}) {
    return adviseMove(view, { label, pick: cells => rng.pick(cells) });
  }

  /**
   * @param {import('../engine.js').MinesweeperView} view - Vue joueur.
   * @param {Array<{type: string, index: number}>} validActions - Actions valides du moteur.
   * @param {{pick: <T>(items: T[]) => T}} rng - Générateur seedé.
   * @returns {{type: string, index: number}} Action choisie parmi `validActions`.
   * @throws {Error} Si le conseil ne figure pas parmi les actions valides (défaut du solveur).
   */
  chooseAction(view, validActions, rng) {
    const { action } = this.decide(view, rng);
    const chosen = validActions.find(candidate => candidate.type === action.type && candidate.index === action.index);
    if (!chosen) { throw new Error(`Coup du solveur refusé par le moteur : ${action.type} ${action.index}.`); }
    return chosen;
  }
}

export default SolverBot;
