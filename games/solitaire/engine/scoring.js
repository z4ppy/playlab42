/**
 * Barème « standard » des solitaires sur ordinateur, sans bonus de temps :
 * le temps appartient au client, le moteur reste indépendant de l'horloge.
 *
 * | Coup                          | Points |
 * |-------------------------------|--------|
 * | Défausse → tableau            | +5     |
 * | Vers une fondation            | +10    |
 * | Carte cachée retournée        | +5     |
 * | Fondation → tableau           | −15    |
 * | Recyclage (pioche 1 / 3)      | −100 / −20 |
 *
 * Le score ne descend jamais sous zéro.
 *
 * @module games/solitaire/engine/scoring
 */

import { parsePile } from './rules.js';

export const POINTS = Object.freeze({
  wasteToTableau: 5,
  toFoundation: 10,
  reveal: 5,
  foundationToTableau: -15,
  recycle: Object.freeze({ 1: -100, 3: -20 }),
});

/** Points d'un déplacement `move`, selon ses piles d'origine et d'arrivée. */
function transferPoints(action) {
  const from = parsePile(action.from).zone;
  const to = parsePile(action.to).zone;
  if (to === 'foundation') {
    return POINTS.toFoundation;
  }
  if (from === 'waste') {
    return POINTS.wasteToTableau;
  }
  return from === 'foundation' ? POINTS.foundationToTableau : 0;
}

/**
 * Nouveau score après une action déjà appliquée.
 * @param {number} score - Score avant l'action
 * @param {import('./rules.js').SolitaireAction} action
 * @param {import('./rules.js').MoveOutcome} outcome - Résultat de `applyMove`
 * @param {1|3} drawCount
 * @returns {number}
 */
export function nextScore(score, action, outcome, drawCount) {
  let delta = 0;
  if (action.type === 'recycle') {
    delta = POINTS.recycle[drawCount];
  } else if (action.type === 'move') {
    delta = transferPoints(action) + ('flipped' in outcome ? POINTS.reveal : 0);
  }
  return Math.max(0, score + delta);
}
