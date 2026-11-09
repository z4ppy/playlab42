/**
 * Bot Random — joue une colonne légale au hasard.
 * Le hasard vient du générateur fourni : même graine, mêmes coups.
 * @see docs/guides/create-bot.md
 */

export class RandomBot {
  name = 'Random';
  description = 'Joue une colonne au hasard';
  difficulty = 'easy';

  /**
   * @param {object} _view - Vue du jeu (inutile pour ce bot)
   * @param {Array<{ type: 'drop', column: number }>} validActions - Colonnes jouables
   * @param {{ pick: <T>(items: T[]) => T }} rng - Générateur aléatoire déterministe
   * @returns {{ type: 'drop', column: number }}
   */
  chooseAction(_view, validActions, rng) {
    return rng.pick(validActions);
  }
}

export default RandomBot;
