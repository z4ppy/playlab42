/**
 * Phrases françaises des indices : ce que fait un coup, puis pourquoi.
 *
 * Les colonnes sont numérotées de 1 à 7 pour le joueur (indices 0 à 6 en
 * interne). Les noms de cartes viennent de `cardName` : « le 7 de cœur ».
 *
 * @module games/solitaire/ai/explain
 */

import { cardName } from '../engine/cards.js';
import { foundationCount, parsePile } from '../engine/rules.js';
import { movedCard } from './heuristics.js';

/** Numéro de colonne lisible. */
function columnLabel(index) {
  return `colonne ${index + 1}`;
}

/** Destination d'un coup vers le tableau : sur une carte ou dans une colonne vide. */
function tableauTarget(board, index) {
  const { up } = board.tableau[index];
  return up.length ? `sur ${cardName(up[up.length - 1])} (${columnLabel(index)})` : `dans la ${columnLabel(index)}, vide`;
}

/** Début de phrase selon la pile d'origine. */
function moveSubject(board, move, from) {
  const name = cardName(movedCard(board, move));
  if (from.zone === 'waste') {
    return `Pose ${name} de la défausse`;
  }
  if (from.zone === 'foundation') {
    return `Redescends ${name} de sa fondation`;
  }
  const others = move.count - 1;
  const carried = others ? ` et ${others === 1 ? 'la carte posée' : `les ${others} cartes posées`} dessus` : '';
  return `Déplace ${name} (${columnLabel(from.index)})${carried}`;
}

/**
 * Décrit une action à l'impératif, sans justification.
 * @param {import('../engine/rules.js').Board} board - Plateau avant l'action
 * @param {import('../engine/rules.js').SolitaireAction} action
 * @returns {string}
 */
export function describeAction(board, action) {
  if (action.type === 'draw') {
    const count = Math.min(board.drawCount, board.stock.length);
    return count === 1 ? 'Pioche une carte' : `Pioche ${count} cartes`;
  }
  if (action.type === 'recycle') {
    return 'Retourne la défausse pour reformer le talon';
  }
  const from = parsePile(action.from);
  const to = parsePile(action.to);
  if (to.zone === 'foundation') {
    const origin = from.zone === 'tableau' ? ` (${columnLabel(from.index)})` : from.zone === 'waste' ? ' de la défausse' : '';
    return `Monte ${cardName(movedCard(board, action))}${origin} sur sa fondation`;
  }
  return `${moveSubject(board, action, from)} ${tableauTarget(board, to.index)}`;
}

/** Première colonne dont le nombre de cartes cachées a diminué. */
function revealedColumn(before, after) {
  return before.tableau.findIndex((column, index) => after.tableau[index].down.length < column.down.length);
}

/** Première colonne vidée par le plan. */
function emptiedColumn(before, after) {
  return before.tableau.findIndex((column, index) => {
    const result = after.tableau[index];
    return column.up.length > 0 && !result.up.length && !result.down.length;
  });
}

/** Première colonne vide qui a reçu une carte (forcément un roi, selon les règles). */
function filledColumn(before, after) {
  return before.tableau.findIndex((column, index) => !column.up.length && !column.down.length
    && after.tableau[index].up.length > 0);
}

/**
 * Classe l'effet d'un plan, du plus parlant au plus général.
 * @param {import('../engine/rules.js').Board} before
 * @param {import('../engine/rules.js').Board} after
 * @returns {{goal: 'reveal'|'foundation'|'empty'|'king'|'waste'|'improve', column?: number}}
 */
export function planGoal(before, after) {
  const revealed = revealedColumn(before, after);
  if (revealed >= 0) {
    return { goal: 'reveal', column: revealed };
  }
  if (foundationCount(after) > foundationCount(before)) {
    return { goal: 'foundation' };
  }
  const emptied = emptiedColumn(before, after);
  if (emptied >= 0) {
    return { goal: 'empty', column: emptied };
  }
  const filled = filledColumn(before, after);
  if (filled >= 0) {
    return { goal: 'king', column: filled };
  }
  return { goal: before.waste.length > after.waste.length ? 'waste' : 'improve' };
}

/** Raison d'un plan, introduite par deux-points. */
function planReason({ goal, column }, length) {
  const steps = length > 1 ? `, en ${length} coups` : '';
  switch (goal) {
    case 'reveal':
      return length > 1
        ? `première étape d'un plan en ${length} coups qui libère une carte cachée en ${columnLabel(column)}`
        : `cela libère une carte cachée en ${columnLabel(column)}`;
    case 'foundation':
      return `cela prépare une montée sur les fondations${steps}`;
    case 'empty':
      return `la ${columnLabel(column)} se vide et pourra accueillir un roi${steps}`;
    case 'king':
      return `un roi commence une nouvelle suite en ${columnLabel(column)}${steps}`;
    case 'waste':
      return 'une carte de la défausse entre en jeu';
    default:
      return `la position s'améliore${steps}`;
  }
}

/**
 * Phrase complète d'un indice de déplacement.
 * @param {import('../engine/rules.js').Board} before - Plateau de départ
 * @param {import('../engine/rules.js').SolitaireAction[]} plan - Plan dont le premier coup est conseillé
 * @param {import('../engine/rules.js').Board} after - Plateau en fin de plan
 * @returns {{text: string, goal: string}}
 */
export function explainPlan(before, plan, after) {
  const effect = planGoal(before, after);
  const action = describeAction(before, plan[0]);
  // Une montée directe sur une fondation se suffit à elle-même.
  const selfExplained = effect.goal === 'foundation' && plan.length === 1;
  return { text: selfExplained ? `${action}.` : `${action} : ${planReason(effect, plan.length)}.`, goal: effect.goal };
}

/**
 * Phrase d'un indice de pioche ou de recyclage.
 * @param {import('../engine/rules.js').Board} board
 * @param {import('../engine/rules.js').DrawAction|import('../engine/rules.js').RecycleAction} action
 * @returns {string}
 */
export function explainTalon(board, action) {
  const reason = action.type === 'draw'
    ? 'aucun coup du tableau ne fait progresser la partie pour l’instant'
    : 'des coups ont été joués depuis le dernier tour, le talon peut en offrir d’autres';
  return `${describeAction(board, action)} : ${reason}.`;
}

/** Phrases des indices sans coup à jouer. */
export const FINAL_TEXT = Object.freeze({
  blocked: 'Aucun coup utile : le tableau ne progresse plus et un tour complet du talon n’a rien donné. '
    + 'Annule quelques coups ou lance une nouvelle donne.',
  won: 'La partie est gagnée !',
});
