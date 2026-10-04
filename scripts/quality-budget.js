import { readFileSync } from 'node:fs';
import path from 'node:path';

export const BUDGET_FORMAT_VERSION = 1;
export const defaultBudgetFile = path.join(import.meta.dirname, 'quality-budgets.json');

const ADVISORY_SCOPES = ['pedagogy', 'tests'];
const DUPLICATION_KEYS = ['maxClones', 'maxDuplicatedLines', 'maxDuplicatedTokens'];

/** Échec d'un budget : le rapport mesuré reste joint pour le diagnostic. */
export class QualityBudgetError extends Error {
  constructor(violations, report) {
    super(`Budget qualité dépassé :\n${violations.map(violation => `- ${violation.message}`).join('\n')}`);
    this.name = 'QualityBudgetError';
    this.violations = violations;
    this.report = report;
  }
}

function fail(message) {
  throw new Error(`Budget qualité invalide : ${message}`);
}

function requireObject(value, name, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name} doit être un objet`);
  }
  const actual = Object.keys(value).sort().join(',');
  if (actual !== [...keys].sort().join(',')) {
    fail(`${name} doit contenir exactement : ${keys.join(', ')} (reçu : ${actual || 'aucune clé'})`);
  }
  return value;
}

function requireCount(value, name, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail(`${name} doit être un entier >= ${minimum} (reçu : ${JSON.stringify(value)})`);
  }
  return value;
}

/**
 * Valide la forme exacte d'un budget ; toute clé inconnue, absente ou mal typée échoue.
 * @param {unknown} raw - Contenu JSON déjà décodé.
 * @returns {{formatVersion: number, production: {cyclomatic: {maxPerFunction: number}, cognitive: {maxPerFunction: number}, duplication: {maxClones: number, maxDuplicatedLines: number, maxDuplicatedTokens: number}}, advisory: string[]}}
 */
export function parseBudget(raw) {
  const budget = requireObject(raw, 'budget', ['formatVersion', 'production', 'advisory']);
  if (budget.formatVersion !== BUDGET_FORMAT_VERSION) {
    fail(`formatVersion ${JSON.stringify(budget.formatVersion)} non supporté (attendu : ${BUDGET_FORMAT_VERSION})`);
  }
  const production = requireObject(budget.production, 'production', ['cyclomatic', 'cognitive', 'duplication']);
  for (const metric of ['cyclomatic', 'cognitive']) {
    const section = requireObject(production[metric], `production.${metric}`, ['maxPerFunction']);
    requireCount(section.maxPerFunction, `production.${metric}.maxPerFunction`, 1);
  }
  const duplication = requireObject(production.duplication, 'production.duplication', DUPLICATION_KEYS);
  for (const key of DUPLICATION_KEYS) {
    requireCount(duplication[key], `production.duplication.${key}`, 0);
  }
  if (!Array.isArray(budget.advisory) || budget.advisory.join(',') !== ADVISORY_SCOPES.join(',')) {
    fail(`advisory doit valoir exactement ${JSON.stringify(ADVISORY_SCOPES)}`);
  }
  return budget;
}

/**
 * Charge et valide un budget versionné ; aucune valeur par défaut n'est inventée.
 * @param {string} [file] - Fichier JSON du budget.
 */
export function loadBudget(file = defaultBudgetFile) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file} illisible (${error.message})`);
  }
  return parseBudget(raw);
}

function functionViolation(metric, label, functions, limit) {
  const over = functions.filter(fn => fn.value > limit);
  if (!over.length) {
    return [];
  }
  const worst = over[0];
  return [{
    metric, limit, actual: over.length,
    message: `${label} : ${over.length} fonction(s) de production > ${limit} (maximum mesuré ${worst.value} : ${worst.file}:${worst.line})`,
  }];
}

function countViolation(metric, label, actual, limit) {
  return actual > limit ? [{ metric, limit, actual, message: `${label} : ${actual} > ${limit}` }] : [];
}

/**
 * Compare la production mesurée au budget ; pédagogie et tests restent consultatifs.
 * Les fonctions arrivent triées par complexité décroissante.
 * @param {{cyclomatic: {value: number}[], cognitive: {value: number}[], duplication: {totals: object}}} production
 * @param {ReturnType<typeof parseBudget>} budget
 */
export function evaluateBudget(production, budget) {
  const limits = budget.production;
  const totals = production.duplication.totals;
  const violations = [
    ...functionViolation('cyclomatic', 'complexité cyclomatique', production.cyclomatic, limits.cyclomatic.maxPerFunction),
    ...functionViolation('cognitive', 'complexité cognitive', production.cognitive, limits.cognitive.maxPerFunction),
    ...countViolation('duplication.clones', 'clones de production', totals.clones, limits.duplication.maxClones),
    ...countViolation('duplication.duplicatedLines', 'lignes dupliquées de production', totals.duplicatedLines, limits.duplication.maxDuplicatedLines),
    ...countViolation('duplication.duplicatedTokens', 'tokens dupliqués de production', totals.duplicatedTokens, limits.duplication.maxDuplicatedTokens),
  ];
  return { formatVersion: budget.formatVersion, limits, advisory: budget.advisory, status: violations.length ? 'failed' : 'passed', violations };
}
