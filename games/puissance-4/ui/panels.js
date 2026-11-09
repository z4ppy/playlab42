/**
 * Panneaux secondaires : barre d'évaluation de l'IA et historique des coups.
 */

import { COLOR_NAMES, describeMove, evaluationText } from './text.js';

/**
 * @typedef {{ meter: HTMLElement, label: HTMLElement }} EvaluationElements
 */

/**
 * Règle la jauge (role="meter") : part de Rouge en pourcentage et légende.
 * @param {EvaluationElements} elements - Jauge et légende
 * @param {number} redShare - Part de Rouge, de 0 à 100
 * @param {string} text - Légende lisible, aussi utilisée comme aria-valuetext
 */
function setMeter({ meter, label }, redShare, text) {
  meter.classList.remove('is-pending');
  meter.style.setProperty('--red-share', `${redShare}%`);
  meter.setAttribute('aria-valuenow', String(redShare));
  meter.setAttribute('aria-valuetext', text);
  label.textContent = text;
}

/**
 * Affiche l'avantage de Rouge selon l'analyse de l'IA.
 * @param {EvaluationElements} elements - Jauge et légende
 * @param {import('../ai/advisor.js').Analysis | null} analysis - Analyse, ou null pendant le calcul
 * @param {'red' | 'yellow'} colorToMove - Couleur au trait lors de l'analyse
 */
export function renderEvaluation(elements, analysis, colorToMove) {
  if (analysis === null) {
    // On garde la dernière jauge, simplement atténuée, pour éviter un saut visuel.
    elements.meter.classList.add('is-pending');
    elements.label.textContent = 'Analyse en cours…';
    return;
  }
  setMeter(elements, Math.round((analysis.advantage + 1) * 50), evaluationText(analysis, colorToMove));
}

/**
 * Jauge figée en fin de partie : tout pour le gagnant, moitié-moitié en cas de nul.
 * @param {EvaluationElements} elements - Jauge et légende
 * @param {import('../engine.js').Puissance4State} state - État final
 */
export function renderFinalEvaluation(elements, state) {
  const winnerColor = state.winners ? state.colors[state.winners[0]] : null;
  if (winnerColor === null) {
    setMeter(elements, 50, 'Partie nulle.');
    return;
  }
  setMeter(elements, winnerColor === 'red' ? 100 : 0, `Partie gagnée par ${COLOR_NAMES[winnerColor]}.`);
}

/**
 * Liste numérotée des coups, du premier au dernier.
 * @param {HTMLOListElement} list - Liste à remplir
 * @param {import('../engine.js').Puissance4State} state - État courant
 * @param {Record<string, string>} names - Nom de chaque joueur
 */
export function renderHistory(list, state, names) {
  const items = state.moves.map((move) => {
    const item = document.createElement('li');
    item.className = `p4-history-item p4-history-item--${state.colors[move.playerId]}`;
    item.textContent = describeMove(names, move);
    return item;
  });
  list.replaceChildren(...items);
  // Faire défiler la liste elle-même, jamais la page (sinon saut sur mobile).
  list.scrollTop = list.scrollHeight;
}
