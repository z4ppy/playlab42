/**
 * Formulaire de l'éditeur : affichage de l'état et lecture des saisies.
 *
 * Les règles sont des lignes construites avec createElement (jamais
 * d'innerHTML) : leur contenu vient de l'utilisateur ou d'un lien partagé.
 */

import { PRESETS } from './presets.js';
import { clampField, MAX_RULES, MAX_TEXT_LENGTH } from './hash-state.js';

/** Champs dont la modification rend la grammaire « personnalisée ». */
export const GRAMMAR_FIELDS = new Set(['axiom', 'rules', 'angle', 'step', 'heading']);

/**
 * Remplit le sélecteur de préréglages, groupés par famille.
 * @param {HTMLSelectElement} select - Sélecteur
 */
export function populatePresets(select) {
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Personnalisé';
  select.append(custom);
  const groups = new Map();
  for (const preset of PRESETS) {
    if (!groups.has(preset.group)) {
      const group = document.createElement('optgroup');
      group.label = preset.group;
      groups.set(preset.group, group);
      select.append(group);
    }
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    groups.get(preset.group).append(option);
  }
}

/**
 * Crée un champ texte ou nombre d'une ligne de règle.
 * @param {string} className - Classe CSS
 * @param {string} label - Libellé accessible
 * @param {string} value - Valeur
 * @param {object} [extra] - Attributs supplémentaires
 * @returns {HTMLInputElement}
 */
function ruleInput(className, label, value, extra = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = className;
  input.value = value;
  input.setAttribute('aria-label', label);
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  Object.assign(input, extra);
  return input;
}

/**
 * Construit la ligne d'une règle.
 * @param {{ predecessor: string, successor: string, probability: string }} rule - Règle
 * @param {number} index - Indice
 * @returns {HTMLLIElement}
 */
function ruleRow(rule, index) {
  const row = document.createElement('li');
  row.className = 'rule';
  row.dataset.index = String(index);
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '→';
  arrow.setAttribute('aria-hidden', 'true');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', `Supprimer la règle ${index + 1}`);
  row.append(
    // Même limite que le lien partagé : rien n'est tronqué en silence.
    ruleInput('mono predecessor', `Règle ${index + 1} : symbole remplacé`, rule.predecessor, { maxLength: MAX_TEXT_LENGTH }),
    arrow,
    ruleInput('mono successor', `Règle ${index + 1} : remplacement`, rule.successor, { maxLength: MAX_TEXT_LENGTH }),
    ruleInput('probability', `Règle ${index + 1} : probabilité (optionnelle)`, rule.probability, { inputMode: 'decimal', placeholder: '1', maxLength: MAX_TEXT_LENGTH }),
    remove,
  );
  return row;
}

/**
 * Réaffiche la liste des règles.
 * @param {HTMLElement} list - Conteneur <ul>
 * @param {{ predecessor: string, successor: string, probability: string }[]} rules - Règles
 */
export function renderRules(list, rules) {
  list.replaceChildren(...rules.map(ruleRow));
  markParametric(list, rules);
}

/**
 * Élargit la colonne « symbole » quand une règle est paramétrée.
 * @param {HTMLElement} list - Conteneur des règles
 * @param {{ predecessor: string }[]} rules - Règles
 */
export function markParametric(list, rules) {
  const parametric = rules.some((rule) => rule.predecessor.includes('(') || rule.predecessor.length > 2);
  list.closest('.rules-block')?.classList.toggle('is-parametric', parametric);
}

/**
 * Lit les règles depuis la liste.
 * @param {HTMLElement} list - Conteneur
 * @returns {{ predecessor: string, successor: string, probability: string }[]}
 */
export function readRules(list) {
  return [...list.querySelectorAll('.rule')].map((row) => ({
    predecessor: row.querySelector('.predecessor').value,
    successor: row.querySelector('.successor').value,
    probability: row.querySelector('.probability').value,
  }));
}

/**
 * Ajoute une règle vide (dans la limite autorisée).
 * @param {object[]} rules - Règles
 * @returns {object[]}
 */
export function withNewRule(rules) {
  if (rules.length >= MAX_RULES) {
    return rules;
  }
  return [...rules, { predecessor: '', successor: '', probability: '' }];
}

/**
 * Formate un nombre pour un champ (sans zéros superflus).
 * @param {number} value - Valeur
 * @returns {string}
 */
function formatNumber(value) {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Affiche l'état dans le formulaire.
 * @param {Record<string, HTMLElement>} els - Éléments
 * @param {import('./hash-state.js').ToolState} state - État
 */
export function writeForm(els, state) {
  els.preset.value = state.preset;
  els.axiom.value = state.axiom;
  renderRules(els.rules, state.rules);
  els.angle.value = formatNumber(state.angle);
  els.angleRange.value = String(Math.min(180, Math.max(1, Math.abs(state.angle))));
  els.step.value = formatNumber(state.step);
  els.heading.value = formatNumber(state.heading);
  els.seed.value = String(state.seed);
  els.colorMode.value = state.colorMode;
  els.lineWidth.value = String(state.lineWidth);
  els.widthDecay.value = String(state.widthDecay);
  writeAppearanceLabels(els, state);
  els.iterValue.textContent = `n = ${state.iterations}`;
}

/**
 * Met à jour les libellés des curseurs d'apparence.
 * @param {Record<string, HTMLElement>} els - Éléments
 * @param {import('./hash-state.js').ToolState} state - État
 */
export function writeAppearanceLabels(els, state) {
  els.lineWidthValue.textContent = `${formatNumber(state.lineWidth)} px`;
  els.widthDecayValue.textContent = state.widthDecay >= 1 ? 'aucun' : `×${formatNumber(state.widthDecay)} par niveau`;
}

/**
 * Lecteurs des champs numériques : élément → champ d'état.
 * La valeur reste bornée ; une saisie vide ou invalide garde l'ancienne valeur.
 */
export const NUMBER_INPUTS = [
  ['angle', 'angle'],
  ['step', 'step'],
  ['heading', 'heading'],
  ['seed', 'seed'],
  ['lineWidth', 'lineWidth'],
  ['widthDecay', 'widthDecay'],
];

/**
 * Lit un champ numérique.
 * @param {HTMLInputElement} input - Champ
 * @param {string} field - Champ d'état
 * @param {number} previous - Valeur actuelle
 * @returns {number}
 */
export function readNumber(input, field, previous) {
  return clampField(input.value, field, previous);
}
