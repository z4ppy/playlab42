/**
 * Bot Hasard : ouvre une case fermée au hasard (jamais une case drapée).
 * C'est la référence la plus faible, utile pour mesurer l'apport du solveur.
 * @see docs/guides/create-bot.md
 */
export class RandomBot {
  name = 'Hasard';
  description = 'Ouvre une case fermée au hasard';
  difficulty = 'easy';

  /**
   * @param {object} _view - Vue joueur (inutile : le bot ne raisonne pas).
   * @param {Array<{type: string, index: number}>} validActions - Actions valides du moteur.
   * @param {{pick: <T>(items: T[]) => T}} rng - Générateur seedé fourni par la page.
   * @returns {{type: string, index: number}} Action choisie.
   */
  chooseAction(_view, validActions, rng) {
    const reveals = validActions.filter(action => action.type === 'reveal');
    return rng.pick(reveals.length > 0 ? reveals : validActions);
  }
}

export default RandomBot;
