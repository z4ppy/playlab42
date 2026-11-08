/**
 * Logique pure des activités du parcours « Histoire des LLM ».
 *
 * Aucune dépendance au DOM : ces fonctions sont testées sous Jest et
 * réutilisées par history.js côté navigateur.
 */

import { SeededRandom } from '../../../../lib/seeded-random.js';

/**
 * Nombre de tokens d'entraînement par paramètre retenu par Chinchilla.
 * Hoffmann et al. (2022) trouvent un optimum proche de 20 tokens par paramètre.
 */
export const CHINCHILLA_TOKENS_PER_PARAM = 20;

/**
 * Coût d'entraînement d'un Transformer dense, approximation de Kaplan et al. (2020).
 * C ≈ 6 · N · D : 2 opérations par paramètre et par token en passe avant,
 * environ 4 en passe arrière.
 *
 * @param {number} params - Nombre de paramètres N (> 0)
 * @param {number} tokens - Nombre de tokens d'entraînement D (> 0)
 * @returns {number} Calcul d'entraînement en FLOP
 */
export function trainingCompute(params, tokens) {
  assertPositive(params, 'params');
  assertPositive(tokens, 'tokens');
  return 6 * params * tokens;
}

/**
 * Taille de modèle et volume de données « compute-optimaux » selon Chinchilla.
 * Avec C = 6·N·D et D = 20·N, on obtient N = √(C / 120) et D = 20·N.
 *
 * @param {number} compute - Budget de calcul en FLOP (> 0)
 * @returns {{ params: number, tokens: number }} Paramètres et tokens optimaux
 */
export function chinchillaOptimum(compute) {
  assertPositive(compute, 'compute');
  const params = Math.sqrt(compute / (6 * CHINCHILLA_TOKENS_PER_PARAM));
  return { params, tokens: CHINCHILLA_TOKENS_PER_PARAM * params };
}

/**
 * Situe un entraînement réel par rapport à la règle des 20 tokens par paramètre.
 * Un ratio très supérieur n'est pas une « erreur » : on entraîne plus longtemps
 * un petit modèle pour qu'il coûte moins cher à utiliser ensuite.
 *
 * @param {number} params - Paramètres du modèle
 * @param {number} tokens - Tokens d'entraînement
 * @returns {{ ratio: number, verdict: 'sous-entraîné' | 'proche de l’optimum' | 'sur-entraîné' }}
 */
export function classifyTraining(params, tokens) {
  assertPositive(params, 'params');
  assertPositive(tokens, 'tokens');
  const ratio = tokens / params;
  // Marge d'un facteur 2 autour de 20 : la règle est un ordre de grandeur, pas une constante exacte.
  if (ratio < CHINCHILLA_TOKENS_PER_PARAM / 2) {
    return { ratio, verdict: 'sous-entraîné' };
  }
  if (ratio > CHINCHILLA_TOKENS_PER_PARAM * 2) {
    return { ratio, verdict: 'sur-entraîné' };
  }
  return { ratio, verdict: 'proche de l’optimum' };
}

/**
 * Formate un grand nombre avec les suffixes français usuels.
 * 70e9 → « 70 Md », 1.4e12 → « 1,4 T » (billion anglais = milliard français).
 *
 * @param {number} value - Valeur positive
 * @returns {string} Valeur lisible
 */
export function formatCount(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Valeur invalide : ${value}`);
  }
  const units = [
    { size: 1e12, suffix: 'T' },
    { size: 1e9, suffix: 'Md' },
    { size: 1e6, suffix: 'M' },
    { size: 1e3, suffix: 'k' },
  ];
  const unit = units.find(u => value >= u.size);
  if (!unit) {
    return formatNumber(value);
  }
  return `${formatNumber(value / unit.size)} ${unit.suffix}`;
}

/**
 * Écrit un nombre de FLOP en notation scientifique lisible : « 3,2 × 10^23 ».
 *
 * @param {number} value - Valeur strictement positive
 * @returns {string}
 */
export function formatFlops(value) {
  assertPositive(value, 'value');
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / 10 ** exponent;
  return `${formatNumber(mantissa)} × 10^${exponent}`;
}

/**
 * Mélange déterministe d'une liste (copie), pour que tous les apprenants
 * reçoivent le même exercice et que les tests soient reproductibles.
 * Garantit que le résultat n'est pas déjà dans l'ordre d'origine.
 *
 * @template T
 * @param {T[]} items - Éléments dans l'ordre correct
 * @param {number} seed - Graine entière
 * @returns {T[]} Nouvelle liste mélangée
 */
export function shuffleForExercise(items, seed) {
  const copy = [...items];
  if (copy.length < 2) {
    return copy;
  }
  const rng = new SeededRandom(seed);
  rng.shuffle(copy);
  if (copy.every((item, index) => item === items[index])) {
    // Un mélange identique rendrait l'exercice trivial : on décale d'un cran.
    copy.push(copy.shift());
  }
  return copy;
}

/**
 * Compare l'ordre proposé à l'ordre attendu.
 *
 * @param {string[]} proposed - Identifiants dans l'ordre choisi par l'apprenant
 * @param {string[]} expected - Identifiants dans l'ordre chronologique
 * @returns {{ correct: number, total: number, solved: boolean, misplaced: string[] }}
 */
export function scoreOrder(proposed, expected) {
  if (proposed.length !== expected.length
    || new Set(proposed).size !== proposed.length
    || !proposed.every(id => expected.includes(id))) {
    throw new Error('La proposition doit contenir exactement les éléments attendus.');
  }
  const misplaced = proposed.filter((id, index) => expected[index] !== id);
  const correct = expected.length - misplaced.length;
  return { correct, total: expected.length, solved: misplaced.length === 0, misplaced };
}

/**
 * Déplace un élément d'une position dans une liste (copie).
 * Utilisé par les boutons « monter » / « descendre », accessibles au clavier.
 *
 * @template T
 * @param {T[]} items - Liste d'origine
 * @param {number} index - Position de l'élément à déplacer
 * @param {-1 | 1} direction - -1 pour monter, 1 pour descendre
 * @returns {T[]} Nouvelle liste (identique si le déplacement sort des bornes)
 */
export function moveItem(items, index, direction) {
  const target = index + direction;
  const copy = [...items];
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) {
    return copy;
  }
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function formatNumber(value) {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
}

function assertPositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} doit être un nombre strictement positif (reçu : ${value}).`);
  }
}
