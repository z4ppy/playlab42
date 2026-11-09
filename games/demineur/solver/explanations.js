/**
 * Rédaction en français des raisonnements du solveur.
 *
 * Les coordonnées passent par une fonction `label(index)` fournie par
 * l'appelant : la page peut ainsi afficher la grille pivotée sur téléphone
 * tout en gardant des explications qui correspondent à ce que voit le joueur.
 */
import { toCoords } from '../engine/grid.js';

/**
 * @typedef {import('./deductions.js').Step} Step
 * @typedef {(index: number) => string} CellLabel
 */

/**
 * Étiquette par défaut : « (colonne, ligne) », en partant de 1.
 * @param {number} width - Nombre de colonnes.
 * @returns {CellLabel}
 */
export function defaultLabel(width) {
  return index => {
    const { x, y } = toCoords(index, width);
    return `(${x + 1}, ${y + 1})`;
  };
}

/**
 * Accorde un nom au nombre.
 * @param {number} count - Quantité.
 * @param {string} singular - Forme singulière.
 * @param {string} [pluralForm] - Forme plurielle (par défaut : singulier + « s »).
 * @returns {string} « 1 mine », « 2 mines »...
 */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/**
 * Désigne un chiffre de la grille : « le 2 en (3, 4) ».
 * @param {{value: number, origin: number}} constraint - Chiffre.
 * @param {CellLabel} label - Étiquettes.
 * @returns {string}
 */
const numberAt = (constraint, label) => `le ${constraint.value} en ${label(constraint.origin)}`;

/**
 * Met une majuscule initiale.
 * @param {string} text - Phrase.
 * @returns {string}
 */
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Nomme les mines déjà connues d'un chiffre : des drapeaux si le joueur les a toutes posées.
 * @param {number[]} mines - Mines déjà déduites autour du chiffre.
 * @param {ReadonlyArray<unknown>} cells - Vue (pour lire les drapeaux).
 * @returns {string}
 */
function knownMinesText(mines, cells) {
  const flagged = mines.every(cell => cells[cell] === 'flag');
  return flagged ? plural(mines.length, 'drapeau', 'drapeaux') : plural(mines.length, 'mine certaine', 'mines certaines');
}

/**
 * @param {Step} step - Étape « chiffre seul ».
 * @param {ReadonlyArray<unknown>} cells - Vue.
 * @param {CellLabel} label - Étiquettes.
 * @returns {string}
 */
function explainSimple(step, cells, label) {
  const { self } = step;
  const subject = capitalize(numberAt(self, label));
  if (step.result === 'safe' && self.knownMines.length === 0) {
    return `${subject} ne touche aucune mine : ses voisines sont sûres.`;
  }
  if (step.result === 'safe') {
    return `${subject} touche déjà ${knownMinesText(self.knownMines, cells)} : ses autres voisines sont sûres.`;
  }
  const verdict = self.need > 1 ? 'ce sont toutes des mines' : 'c\'est une mine';
  if (self.knownMines.length === 0) {
    return `${subject} n'a ${only(self.cells.length, 'voisine fermée', 'voisines fermées')} : ${verdict}.`;
  }
  return `${subject} touche déjà ${knownMinesText(self.knownMines, cells)} et n'a plus `
    + `${only(self.cells.length, 'voisine possible', 'voisines possibles')} pour ${plural(self.need, 'mine')} : ${verdict}.`;
}

/**
 * Restriction « que N » au féminin : « qu'une voisine », « que 3 voisines ».
 * @param {number} count - Quantité.
 * @param {string} singular - Nom au singulier.
 * @param {string} pluralForm - Nom au pluriel.
 * @returns {string}
 */
function only(count, singular, pluralForm) {
  return count === 1 ? `qu'une ${singular}` : `que ${count} ${pluralForm}`;
}

/**
 * @param {Step} step - Étape « paire de chiffres ».
 * @param {CellLabel} label - Étiquettes.
 * @returns {string}
 */
function explainPair(step, label) {
  const { self, other, bound } = step;
  if (step.result === 'safe') {
    return `${capitalize(numberAt(other, label))} place au moins ${plural(bound, 'mine')} parmi les cases `
      + `qu'il partage avec ${numberAt(self, label)} : cela suffit à ce dernier, ses autres voisines sont sûres.`;
  }
  return `${capitalize(numberAt(self, label))} attend encore ${plural(self.need, 'mine')}, mais au plus ${bound} `
    + `${bound > 1 ? 'peuvent' : 'peut'} se trouver parmi les cases qu'il partage avec ${numberAt(other, label)} : `
    + `${step.cells.length > 1 ? `ses ${step.cells.length} autres voisines sont des mines` : 'son autre voisine est une mine'}.`;
}

/**
 * @param {Step} step - Étape « compte global ».
 * @returns {string}
 */
function explainCount(step) {
  if (step.result === 'safe') {
    return 'Toutes les mines sont localisées : les cases fermées restantes sont sûres.';
  }
  if (step.remaining === 1) { return 'Il ne reste qu\'une mine et une seule case fermée : elle est minée.'; }
  return `Il reste ${step.remaining} mines pour autant de cases fermées : elles sont toutes minées.`;
}

/**
 * @param {Step} step - Étape « énumération ».
 * @param {CellLabel} label - Étiquettes.
 * @returns {string}
 */
function explainEnumeration(step, label) {
  const safe = step.result === 'safe';
  const counted = step.usesCount ? ' et avec le nombre de mines restantes' : '';
  const conclusion = step.interior
    ? `les cases éloignées des chiffres ${safe ? 'ne sont jamais minées' : 'sont toutes minées'}`
    : `la case ${label(step.cells[0])} ${safe ? 'n\'est jamais une mine' : 'est toujours une mine'}`;
  const scope = step.solutions === 1 ? 'Dans la seule configuration compatible'
    : `Sur les ${step.solutions} configurations compatibles`;
  return `${scope} avec les chiffres${counted}, ${conclusion}.`;
}

/**
 * Explique une étape de déduction.
 * @param {Step} step - Étape du solveur.
 * @param {ReadonlyArray<unknown>} cells - Vue (drapeaux).
 * @param {CellLabel} label - Étiquettes.
 * @returns {string}
 */
export function explainStep(step, cells, label) {
  switch (step.technique) {
    case 'simple': return explainSimple(step, cells, label);
    case 'pair': return explainPair(step, label);
    case 'count': return explainCount(step);
    default: return explainEnumeration(step, label);
  }
}

/**
 * Formate une probabilité en pourcentage lisible (« 12 % », « < 1 % »).
 * @param {number} probability - Valeur entre 0 et 1.
 * @returns {string}
 */
export function formatPercent(probability) {
  const percent = probability * 100;
  if (percent > 0 && percent < 1) { return '< 1 %'; }
  if (percent < 100 && percent > 99) { return '> 99 %'; }
  return `${Math.round(percent)} %`;
}
