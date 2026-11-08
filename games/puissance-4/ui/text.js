/**
 * Textes de l'interface, en fonctions pures : statut, annonces, libellés
 * accessibles, évaluation et indice. Aucun accès au DOM.
 */

import { ROWS } from '../engine/board.js';

/** Nom français de chaque couleur. */
export const COLOR_NAMES = Object.freeze({ red: 'Rouge', yellow: 'Jaune' });

/**
 * « Rouge (vous) joue en colonne 4. »
 * @param {Record<string, string>} names - Nom de chaque joueur
 * @param {import('../engine.js').Move} move - Coup joué
 * @returns {string}
 */
export function describeMove(names, move) {
  return `${names[move.playerId]} joue en colonne ${move.col + 1}.`;
}

/**
 * Statut de la partie : à qui le tour, fin, réflexion de l'IA ou pause.
 * @param {import('../engine.js').Puissance4State} state - État courant
 * @param {Record<string, string>} names - Nom de chaque joueur
 * @param {{ thinking?: boolean, paused?: boolean }} [flags] - Situation du client
 * @returns {string}
 */
export function statusText(state, names, { thinking = false, paused = false } = {}) {
  if (state.gameOver) {
    return state.winners ? `${names[state.winners[0]]} gagne avec quatre jetons alignés !` : 'Match nul : la grille est pleine.';
  }
  if (paused) {
    return 'Partie en pause.';
  }
  return thinking ? 'L’IA réfléchit…' : `À ${names[state.currentPlayerId]} de jouer.`;
}

/**
 * Libellé accessible d'une colonne : numéro, remplissage et alignement gagnant.
 * @param {import('../engine.js').Puissance4State} state - État courant
 * @param {number} col - Colonne (0 à 6)
 * @returns {string}
 */
export function columnLabel(state, col) {
  const discs = state.board.map((line) => line[col]).filter((cell) => cell !== null);
  const free = ROWS - discs.length;
  const content = discs.length === 0 ? 'vide'
    : `de bas en haut : ${discs.reverse().map((color) => COLOR_NAMES[color].toLowerCase()).join(', ')}`;
  const room = free === 0 ? 'pleine' : `${free} case${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`;
  const winning = state.winningLine?.some((cell) => cell.col === col) ? ', alignement gagnant' : '';
  return `Colonne ${col + 1}, ${content}, ${room}${winning}`;
}

/**
 * Texte de la barre d'évaluation, du point de vue des couleurs.
 * @param {import('../ai/advisor.js').Analysis} analysis - Analyse de la position
 * @param {'red' | 'yellow'} colorToMove - Couleur au trait lors de l'analyse
 * @returns {string}
 */
export function evaluationText(analysis, colorToMove) {
  if (analysis.forced) {
    const winner = analysis.forced.winner === 'self' ? colorToMove : otherColor(colorToMove);
    const moves = analysis.forced.inMoves;
    return `${COLOR_NAMES[winner]} gagne de force en ${moves} coup${moves > 1 ? 's' : ''}.`;
  }
  if (analysis.solved) {
    return 'Nul assuré avec un jeu parfait.';
  }
  const strength = Math.abs(analysis.advantage);
  if (strength < 0.15) {
    return 'Position équilibrée.';
  }
  const leader = analysis.advantage > 0 ? 'Rouge' : 'Jaune';
  return `${strength < 0.5 ? 'Léger avantage' : 'Net avantage'} ${leader}.`;
}

/**
 * « Indice : colonne 3. Bloque la menace adverse en colonne 3. »
 * @param {import('../ai/advisor.js').Analysis} analysis - Analyse de la position
 * @returns {string}
 */
export function hintText(analysis) {
  return `Indice : colonne ${analysis.column + 1}. ${analysis.reason.text}`;
}

/**
 * @param {'red' | 'yellow'} color - Couleur
 * @returns {'red' | 'yellow'} L'autre couleur
 */
export function otherColor(color) {
  return color === 'red' ? 'yellow' : 'red';
}
