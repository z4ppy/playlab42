/**
 * Calcul complet d'un dessin : réécriture puis tortue — logique pure,
 * exécutée dans un worker (ou en repli sur le fil principal).
 */

import {
  expand,
  estimateLengths,
  isParametric,
  normalizeSymbols,
  LSystemLimitError,
  ExpressionError,
  MAX_SYMBOLS,
} from './lsystem.js';
import { interpret } from './turtle.js';

/** Aucun segment fini : tous les paramètres ont débordé (∞ ou NaN). */
export class NonFiniteError extends Error {
  /**
   * @param {string} symbol - Symbole fautif (F, G…)
   * @param {number} skipped - Symboles ignorés
   */
  constructor(symbol, skipped) {
    super(nonFiniteMessage(symbol, skipped, true));
    this.name = 'NonFiniteError';
  }
}

/**
 * Message lisible pour des symboles ignorés car non finis.
 * @param {string} symbol - Symbole fautif
 * @param {number} skipped - Symboles ignorés
 * @param {boolean} [all] - Vrai si aucun segment n'a pu être tracé
 * @returns {string}
 */
export function nonFiniteMessage(symbol, skipped, all = false) {
  const head = `Paramètre non fini (∞ ou NaN) dans ${symbol || 'F'}(…)`;
  const count = skipped.toLocaleString('fr-FR');
  const plural = skipped > 1 ? 's' : '';
  const ignored = `${count} symbole${plural} ignoré${plural}`;
  const tail = all ? `aucun segment ne peut être tracé (${ignored}).` : `${ignored}, le dessin est incomplet.`;
  return `${head} : ${tail} Vérifiez les expressions des règles (débordement, division par zéro).`;
}

/** Longueur de l'extrait de chaîne renvoyé pour affichage. */
export const PREVIEW_LENGTH = 240;

/**
 * @typedef {object} ComputeParams
 * @property {string} axiom
 * @property {import('./lsystem.js').RuleDefinition[]} rules
 * @property {number} iterations
 * @property {number} angle
 * @property {number} step
 * @property {number} heading
 * @property {number} seed
 * @property {number} [maxSymbols]
 */

/**
 * Extrait lisible du début de la chaîne.
 * @param {string|{ s: string, p: number[] }[]} result - Chaîne développée
 * @returns {string}
 */
export function previewOf(result) {
  if (typeof result === 'string') {
    return result.slice(0, PREVIEW_LENGTH);
  }
  let text = '';
  for (const module of result) {
    const args = module.p.length > 0 ? `(${module.p.map((v) => Math.round(v * 100) / 100).join(',')})` : '';
    text += module.s + args;
    if (text.length >= PREVIEW_LENGTH) {
      break;
    }
  }
  return text.slice(0, PREVIEW_LENGTH);
}

/**
 * Vérifie d'avance, par majoration, que le calcul restera sous la limite.
 * @param {ComputeParams} params - Paramètres
 * @param {number} limit - Limite de symboles
 * @throws {LSystemLimitError} Si l'estimation dépasse déjà la limite
 */
function checkEstimate(params, limit) {
  const estimates = estimateLengths(params, params.iterations);
  const over = estimates.findIndex((length) => length > limit);
  // Seul un système déterministe a une estimation exacte ; pour les autres,
  // on laisse la réécriture réelle trancher (elle s'arrête au dépassement).
  const predecessors = params.rules.map((rule) => normalizeSymbols(rule.predecessor)).filter(Boolean);
  const deterministic = new Set(predecessors).size === predecessors.length && !isParametric(params);
  if (over !== -1 && deterministic) {
    throw new LSystemLimitError(estimates[over], limit, over);
  }
}

/**
 * Développe et interprète un L-système.
 * @param {ComputeParams} params - Paramètres
 * @returns {import('./turtle.js').Drawing & { length: number, preview: string, parametric: boolean, elapsed: number }}
 */
export function computeDrawing(params) {
  const started = Date.now();
  const limit = params.maxSymbols ?? MAX_SYMBOLS;
  checkEstimate(params, limit);
  const expansion = expand(params, params.iterations, { seed: params.seed, maxLength: limit });
  const drawing = interpret(expansion.result, {
    angle: params.angle,
    step: params.step,
    heading: params.heading,
  });
  if (drawing.count === 0 && drawing.nonFinite > 0) {
    throw new NonFiniteError(drawing.nonFiniteSymbol, drawing.nonFinite);
  }
  return {
    ...drawing,
    length: expansion.length,
    preview: previewOf(expansion.result),
    parametric: expansion.parametric,
    elapsed: Date.now() - started,
  };
}

/**
 * Convertit une erreur en message sérialisable (postMessage).
 * @param {unknown} error - Erreur levée
 * @returns {{ code: 'limit'|'syntax'|'nonfinite'|'internal', message: string, safeIterations?: number, limit?: number, field?: import('./lsystem.js').ErrorField }}
 */
export function describeError(error) {
  if (error instanceof LSystemLimitError) {
    // L'itération précédente tenait sous la limite (exact en déterministe,
    // vrai pour cette graine en stochastique).
    const safeIterations = Math.max(0, error.iteration - 1);
    return { code: 'limit', message: error.message, safeIterations, limit: error.limit };
  }
  if (error instanceof ExpressionError) {
    // Champ fautif (axiome ou partie d'une règle) quand il est connu.
    return error.field ? { code: 'syntax', message: error.message, field: { ...error.field } } : { code: 'syntax', message: error.message };
  }
  if (error instanceof NonFiniteError) {
    return { code: 'nonfinite', message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: 'internal', message };
}
