/**
 * Déductions logiques certaines, de la plus simple à la plus subtile.
 *
 * 1. **Chiffre seul** : un chiffre qui touche déjà toutes ses mines libère ses
 *    autres voisines ; un chiffre qui n'a plus que N voisines possibles pour
 *    N mines les condamne toutes.
 * 2. **Paire de chiffres** : deux chiffres qui partagent des voisines bornent
 *    le nombre de mines de la zone commune, ce qui fixe parfois leurs zones
 *    propres (motifs « 1-1 », « 1-2 », inclusion d'ensembles...).
 * 3. **Compte global** : quand toutes les mines sont localisées, le reste est
 *    sûr ; quand il reste autant de mines que de cases, tout est miné.
 *
 * Chaque déduction devient une étape (`Step`) qui garde de quoi l'expliquer.
 * On revient toujours à la technique la plus simple dès qu'elle progresse :
 * les explications restent ainsi les plus courtes possibles.
 */
import { reduceConstraint } from './board-reader.js';

/**
 * @typedef {import('./board-reader.js').BoardKnowledge} BoardKnowledge
 * @typedef {import('./board-reader.js').ReducedConstraint} ReducedConstraint
 *
 * @typedef {Object} Step
 * @property {'safe'|'mine'} result - Nature des cases déduites.
 * @property {number[]} cells - Cases déduites.
 * @property {'simple'|'pair'|'count'|'enumeration'} technique - Technique employée.
 * @property {number[]} uses - Cases déjà déduites qui ont servi au raisonnement.
 * @property {ReducedConstraint} [self] - Chiffre qui conclut (simple, paire).
 * @property {ReducedConstraint} [other] - Chiffre partenaire (paire).
 * @property {number} [bound] - Borne de mines dans la zone partagée (paire).
 * @property {number} [remaining] - Mines restantes (compte global, énumération).
 * @property {number} [solutions] - Configurations examinées (énumération).
 * @property {boolean} [usesCount] - Le compte global de mines a été nécessaire (énumération).
 */

/**
 * Enregistre une étape et ses conclusions.
 * @param {Map<number, 'safe'|'mine'>} known - Déductions (modifiées).
 * @param {Step[]} steps - Journal (modifié).
 * @param {Step} step - Nouvelle étape.
 */
export function recordStep(known, steps, step) {
  for (const cell of step.cells) { known.set(cell, step.result); }
  steps.push(step);
}

/**
 * Règle du chiffre seul sur une contrainte réduite.
 * @param {ReducedConstraint} reduced - Contrainte sans les cases déjà déduites.
 * @returns {Step|null}
 */
function simpleStep(reduced) {
  if (reduced.cells.length === 0) { return null; }
  const base = { technique: 'simple', cells: reduced.cells, uses: reduced.uses, self: reduced };
  if (reduced.need === 0) { return { ...base, result: 'safe' }; }
  if (reduced.need === reduced.cells.length) { return { ...base, result: 'mine' }; }
  return null;
}

/**
 * Applique la règle du chiffre seul à tous les chiffres, en une passe.
 * @param {BoardKnowledge} board - Contraintes.
 * @param {Map<number, 'safe'|'mine'>} known - Déductions (complétées).
 * @param {Step[]} steps - Journal (complété).
 * @returns {boolean} Au moins une déduction nouvelle.
 */
function applySimpleRule(board, known, steps) {
  let progressed = false;
  for (const constraint of board.constraints) {
    const step = simpleStep(reduceConstraint(constraint, known));
    if (step) {
      recordStep(known, steps, step);
      progressed = true;
    }
  }
  return progressed;
}

/**
 * Conclusion éventuelle pour la zone propre d'un chiffre `self` comparé à `other`.
 * Si `x` est le nombre de mines de la zone partagée, `self` en a `need - x`
 * dans sa zone propre ; les bornes de `x` suffisent parfois à trancher.
 * @param {ReducedConstraint} self - Chiffre dont on examine la zone propre.
 * @param {ReducedConstraint} other - Chiffre partenaire.
 * @param {number[]} own - Zone propre de `self`.
 * @param {{min: number, max: number}} shared - Bornes des mines partagées.
 * @returns {Step|null}
 */
function pairConclusion(self, other, own, shared) {
  if (own.length === 0) { return null; }
  const base = { technique: 'pair', cells: own, uses: [...self.uses, ...other.uses], self, other };
  if (self.need - shared.min === 0) { return { ...base, result: 'safe', bound: shared.min }; }
  if (self.need - shared.max === own.length) { return { ...base, result: 'mine', bound: shared.max }; }
  return null;
}

/**
 * Compare deux chiffres voisins.
 * @param {ReducedConstraint} a - Premier chiffre.
 * @param {ReducedConstraint} b - Second chiffre.
 * @returns {Step|null}
 */
export function comparePair(a, b) {
  const inB = new Set(b.cells);
  const sharedCells = a.cells.filter(cell => inB.has(cell));
  if (sharedCells.length === 0) { return null; }
  const inShared = new Set(sharedCells);
  const ownA = a.cells.filter(cell => !inShared.has(cell));
  const ownB = b.cells.filter(cell => !inShared.has(cell));
  const shared = {
    min: Math.max(0, a.need - ownA.length, b.need - ownB.length),
    max: Math.min(sharedCells.length, a.need, b.need),
  };
  // min > max signalerait une vue incohérente : on ne conclut rien.
  if (shared.min > shared.max) { return null; }
  return pairConclusion(a, b, ownA, shared) ?? pairConclusion(b, a, ownB, shared);
}

/**
 * Indices des contraintes qui partagent au moins une case avec la contrainte `index`.
 * @param {BoardKnowledge} board - Contraintes.
 * @param {number} index - Contrainte de départ.
 * @returns {number[]} Partenaires d'indice supérieur (chaque paire n'est vue qu'une fois).
 */
function partnersOf(board, index) {
  const partners = new Set();
  for (const cell of board.constraints[index].cells) {
    for (const other of board.constraintsByCell.get(cell)) {
      if (other > index) { partners.add(other); }
    }
  }
  return [...partners].sort((a, b) => a - b);
}

/**
 * Cherche la première paire de chiffres concluante.
 * @param {BoardKnowledge} board - Contraintes.
 * @param {Map<number, 'safe'|'mine'>} known - Déductions (complétées).
 * @param {Step[]} steps - Journal (complété).
 * @returns {boolean} Une déduction nouvelle.
 */
function applyPairRule(board, known, steps) {
  const reduced = board.constraints.map(constraint => reduceConstraint(constraint, known));
  for (let index = 0; index < reduced.length; index++) {
    if (reduced[index].cells.length === 0) { continue; }
    for (const partner of partnersOf(board, index)) {
      const step = comparePair(reduced[index], reduced[partner]);
      if (step) {
        recordStep(known, steps, step);
        return true;
      }
    }
  }
  return false;
}

/**
 * Règle du compte global de mines.
 * @param {BoardKnowledge} board - Cases inconnues et nombre de mines.
 * @param {Map<number, 'safe'|'mine'>} known - Déductions (complétées).
 * @param {Step[]} steps - Journal (complété).
 * @returns {boolean} Une déduction nouvelle.
 */
function applyCountRule(board, known, steps) {
  const undecided = board.unknown.filter(cell => !known.has(cell));
  if (undecided.length === 0) { return false; }
  const minesFound = [...known.values()].filter(fact => fact === 'mine').length;
  const remaining = board.mineCount - minesFound;
  const result = remaining === 0 ? 'safe' : remaining === undecided.length ? 'mine' : null;
  if (!result) { return false; }
  const uses = [...known.keys()].filter(cell => known.get(cell) === 'mine');
  recordStep(known, steps, { technique: 'count', result, cells: undecided, uses, remaining });
  return true;
}

/**
 * Enchaîne les règles jusqu'à ce qu'aucune ne progresse.
 * @param {BoardKnowledge} board - Connaissances de la vue.
 * @returns {{known: Map<number, 'safe'|'mine'>, steps: Step[]}} Déductions et leur journal ordonné.
 */
export function deduce(board) {
  const known = new Map();
  const steps = [];
  const rules = [applySimpleRule, applyPairRule, applyCountRule];
  // Après chaque progrès, on repart de la règle la plus simple.
  while (rules.some(rule => rule(board, known, steps))) { /* point fixe */ }
  return { known, steps };
}
