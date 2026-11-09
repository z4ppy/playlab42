/**
 * Bot Greedy — ne regarde qu'un coup à l'avance, sans recherche :
 * 1. gagne s'il le peut ;
 * 2. sinon bloque une victoire adverse immédiate ;
 * 3. sinon évite de jouer sous une case gagnante adverse ;
 * 4. et, à priorité égale, préfère la colonne la plus centrale.
 * Les colonnes aussi centrales l'une que l'autre sont départagées par le RNG.
 * @see docs/guides/create-bot.md
 */

import { and, andNot, columnMask, positionFromView, readTactics } from '../ai/bitboard.js';

/**
 * Garde les actions les plus proches du centre puis en tire une.
 * @param {Array<{ type: 'drop', column: number }>} actions - Candidates (non vide)
 * @param {{ pick: <T>(items: T[]) => T }} rng - Générateur aléatoire
 * @returns {{ type: 'drop', column: number }}
 */
function pickCentral(actions, rng) {
  const distance = (action) => Math.abs(action.column - 3);
  const closest = Math.min(...actions.map(distance));
  return rng.pick(actions.filter((action) => distance(action) === closest));
}

export class GreedyBot {
  name = 'Greedy';
  description = 'Gagne si possible, bloque sinon, préfère le centre';
  difficulty = 'medium';

  /**
   * @param {import('../engine.js').Puissance4State} view - Vue du joueur au trait
   * @param {Array<{ type: 'drop', column: number }>} validActions - Colonnes jouables
   * @param {{ pick: <T>(items: T[]) => T }} rng - Générateur aléatoire déterministe
   * @returns {{ type: 'drop', column: number }}
   */
  chooseAction(view, validActions, rng) {
    const tactics = readTactics(positionFromView(view));
    const priorities = [tactics.wins, tactics.threats, andNot(tactics.playable, tactics.unsafe)];
    for (const cells of priorities) {
      const candidates = validActions.filter((action) => and(cells, columnMask(action.column)) !== 0);
      if (candidates.length > 0) {
        return pickCentral(candidates, rng);
      }
    }
    return pickCentral(validActions, rng);
  }
}

export default GreedyBot;
