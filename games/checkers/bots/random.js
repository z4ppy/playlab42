/**
 * Bot Random - Joue au hasard
 * @see openspec/specs/bot/spec.md
 */

export class RandomBot {
  name = 'Random';
  description = 'Joue des coups aléatoires';
  difficulty = 'easy';

  /**
   * Choisit une action au hasard parmi les actions valides
   * @param {object} _view - Vue du jeu (non utilisée)
   * @param {Array} validActions - Actions valides
   * @param {object} rng - Générateur aléatoire
   * @returns {object} Action choisie
   */
  chooseAction(_view, validActions, rng) {
    return rng.pick(validActions);
  }
}

export default RandomBot;
