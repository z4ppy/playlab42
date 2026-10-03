/**
 * Bot Greedy - Choisit le placement qui maximise le score immédiat
 * @see openspec/specs/bot/spec.md
 */

import { detectBonus } from '../../dist/engine.js';
import type { PlayerView, TriominoAction, PlaceAction, TriominoConfig } from '../../dist/engine.js';

/** Interface minimale du générateur aléatoire */
interface Rng {
  pick<T>(array: T[]): T;
}

export class GreedyBot {
  name = 'Greedy';
  description = 'Maximise le score à chaque coup';
  difficulty = 'medium';

  /**
   * Choisit l'action qui rapporte le plus de points immédiatement.
   * Si aucun placement n'est possible, pioche ou passe.
   * @throws Si aucune action valide n'est fournie.
   */
  chooseAction(
    view: PlayerView,
    validActions: TriominoAction[],
    rng: Rng,
  ): TriominoAction {
    const placements = validActions.filter((a): a is PlaceAction => a.type === 'PLACE');

    if (placements.length === 0) {
      // Piocher si possible, sinon passer
      const draw = validActions.find((a) => a.type === 'DRAW');
      if (draw) return draw;
      const pass = validActions.find((a) => a.type === 'PASS');
      if (pass) return pass;
      throw new Error('Aucune action valide');
    }

    // Évaluer chaque placement et choisir le meilleur
    let bestActions: PlaceAction[] = [];
    let bestScore = -Infinity;

    for (const action of placements) {
      const score = this.#evalPlacement(view, action);
      if (score > bestScore) {
        bestScore = score;
        bestActions = [action];
      } else if (score === bestScore) {
        bestActions.push(action);
      }
    }

    // En cas d'ex-aequo, choisir au hasard parmi les meilleurs
    return rng.pick(bestActions);
  }

  /**
   * Évalue le score d'un placement selon le mode de jeu.
   */
  #evalPlacement(view: PlayerView, action: PlaceAction): number {
    const tile = view.myRack.find((t) => t.id === action.triominoId);
    if (!tile) return 0;

    const config: TriominoConfig = view.config;

    // Simuler le plateau avec cette tuile
    const simulatedBoard = {
      ...view.board,
      [`${action.position.col},${action.position.row},${action.position.orientation}`]: {
        triomino: tile,
        position: action.position,
        placed: action.placed,
      },
    };

    const bonus = detectBonus(simulatedBoard, action.position);

    if (config.mode === 'kids') return 0;

    if (config.mode === 'simplified') {
      let pts = 1;
      if (bonus?.type === 'bridge') pts += 1;
      else if (bonus?.type === 'hexagon') pts += 1;
      else if (bonus?.type === 'double-hexagon') pts += 2;
      return pts;
    }

    // Mode standard
    const base = tile.values[0] + tile.values[1] + tile.values[2];
    return base + (bonus ? bonus.points : 0);
  }
}

export default GreedyBot;
