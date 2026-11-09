/**
 * Bot Aléatoire : joue un coup légal au hasard (référence de comparaison).
 * @see docs/guides/create-bot.md
 */

export class RandomBot {
  name = 'Aléatoire';
  description = 'Joue un coup légal au hasard';
  difficulty = 'easy';

  /**
   * @param {import('../engine.js').SolitaireView} _view - Vue (non utilisée)
   * @param {import('../engine/rules.js').SolitaireAction[]} validActions - Actions légales
   * @param {import('../../../lib/seeded-random.js').SeededRandom} rng - Aléatoire reproductible
   * @returns {import('../engine/rules.js').SolitaireAction}
   */
  chooseAction(_view, validActions, rng) {
    return rng.pick(validActions);
  }
}

export default RandomBot;
