/**
 * Indice pédagogique en deux temps.
 *
 * 1er appui : on montre OÙ regarder et le nom de la technique, sans la réponse.
 * 2e appui : on donne le raisonnement complet et la case concernée ;
 *            le joueur peut alors appliquer le coup.
 * Tout changement de la grille invalide l'indice (le contrôleur appelle reset()).
 */

import { adviseNextMove } from '../engine/advisor.js';

/**
 * @typedef {{stage: 0 | 1 | 2, advice: import('../engine/advisor.js').Advice | null}} HintState
 */

/**
 * @param {(view: object) => import('../engine/advisor.js').Advice | null} [advise]
 */
export function createHintCoach(advise = adviseNextMove) {
  /** @type {HintState} */
  let current = { stage: 0, advice: null };
  return {
    /**
     * Avance d'un temps : aucun indice → premier temps → second temps.
     * @param {object} view Vue du joueur.
     * @returns {HintState}
     */
    next(view) {
      if (current.stage === 0) {
        const advice = advise(view);
        current = { stage: advice ? 1 : 0, advice };
      } else {
        current = { ...current, stage: 2 };
      }
      return current;
    },
    /** @returns {HintState} */
    state: () => current,
    reset() {
      current = { stage: 0, advice: null };
    },
  };
}

/**
 * Cases à mettre en évidence pour l'étape courante de l'indice.
 * @param {HintState} hint
 * @returns {{hintFocus: Set<number>, hintPattern: Set<number>, hintTargets: Set<number>}}
 */
export function hintDecorations({ stage, advice }) {
  const empty = { hintFocus: new Set(), hintPattern: new Set(), hintTargets: new Set() };
  if (!advice || stage === 0) {
    return empty;
  }
  if (stage === 1) {
    return { ...empty, hintFocus: new Set(advice.focusCells) };
  }
  const eliminated = advice.steps.flatMap((step) => step.eliminations.map(({ cell }) => cell));
  // La région reste visible au second temps : elle aide à suivre le raisonnement.
  return {
    hintFocus: new Set(advice.focusCells),
    hintPattern: new Set(advice.steps.flatMap((step) => step.cells)),
    hintTargets: new Set([advice.action.cell, ...eliminated]),
  };
}

/**
 * Texte affiché pour l'étape courante.
 * @param {HintState} hint
 * @returns {string}
 */
export function hintText({ stage, advice }) {
  if (!advice) {
    return 'Aucun indice : la grille est terminée.';
  }
  return stage === 1 ? `Indice (${advice.technique}) : ${advice.hint}` : advice.detail;
}
