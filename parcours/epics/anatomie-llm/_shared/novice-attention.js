import { softmax } from './math.js';
import { rmsnorm } from './tensor.js';

export const novicePrompt = 'le chat dort';

/** Produit vecteur × matrice, sans modifier les nombres d'entrée. */
export function projectRow(row, matrix) {
  if (row.length !== matrix.length || !matrix.length || !matrix[0].length ||
    matrix.some(values => values.length !== matrix[0].length)) {
    throw new RangeError('Dimensions de projection incompatibles.');
  }
  return matrix[0].map((_, column) => row.reduce((sum, value, i) => sum + value * matrix[i][column], 0));
}

/** Décompose une ligne d'attention causale ; les scores futurs restent inspectables. */
export function attentionRow(q, k, v, query) {
  if (!Number.isInteger(query) || query < 0 || query >= q.length || q.length !== k.length ||
    q.length !== v.length || !q[0]?.length ||
    [...q, ...k, ...v].some(row => row.length !== q[0].length)) {
    throw new RangeError('Ligne d’attention incompatible.');
  }
  const width = q[0].length;
  const products = k.map(key => key.map((value, d) => value * q[query][d]));
  const dots = products.map(row => row.reduce((sum, value) => sum + value, 0));
  const scores = dots.map(value => value / Math.sqrt(width));
  const masked = scores.map((value, i) => i > query ? -Infinity : value);
  const allowed = softmax(scores.slice(0, query + 1));
  const probabilities = scores.map((_, i) => i > query ? 0 : allowed[i]);
  const contributions = v.map((row, i) => row.map(value => value * probabilities[i]));
  const mixture = v[0].map((_, d) => contributions.reduce((sum, row) => sum + row[d], 0));
  return { q, k, v, query, width, products, dots, scores, masked, probabilities, contributions, mixture };
}

const toyMatrices = [
  { q: [[1, 0], [0, 1]], k: [[1, 1], [0, 1]], v: [[1, 0], [0, 2]] },
  { q: [[0, 1], [1, 0]], k: [[1, 0], [1, 1]], v: [[0, 1], [1, 0]] },
];

/** Exemple inventé à deux têtes ; aucune valeur n'est attribuée à Luciole. */
export function toyAttention(query = 1, head = 0, chatCoordinate = 0) {
  if (!Number.isInteger(head) || head < 0 || head >= toyMatrices.length || !Number.isFinite(chatCoordinate)) {
    throw new RangeError('Réglage de la tête inventée invalide.');
  }
  const input = [[1, 0], [chatCoordinate, 1], [1, 1]];
  const rows = toyMatrices.map(matrices => attentionRow(
    input.map(row => projectRow(row, matrices.q)),
    input.map(row => projectRow(row, matrices.k)),
    input.map(row => projectRow(row, matrices.v)), query));
  const concatenated = rows.flatMap(row => row.mixture);
  const outputMatrix = [[1, 0], [0, 1], [0.5, 0], [0, 0.5]];
  return {
    ...rows[head], words: ['le', 'chat', 'dort'], input, matrices: toyMatrices[head],
    head, heads: 2, concatenated, outputMatrix, output: projectRow(concatenated, outputMatrix),
    source: 'Exemple inventé : deux nombres par token, deux têtes. Les matrices sont choisies à la main, pas apprises.',
  };
}

/** Lecture seule des véritables tenseurs du passage avant de Luciole. */
export function lucioleAttention(result, weights, config, words, layer = 0, head = 0, query = 2) {
  if (!Number.isInteger(layer) || layer < 0 || layer >= config.layers ||
    !Number.isInteger(head) || head < 0 || head >= config.heads) {
    throw new RangeError('Bloc ou tête de Luciole invalide.');
  }
  const trace = result.traces[layer + 1];
  const width = config.dim / config.heads;
  const slice = (rows, h) => rows.map(row => row.slice(h * width, (h + 1) * width));
  const q = trace.q.toRows();
  const k = trace.k.toRows();
  const v = trace.v.toRows();
  const rows = Array.from({ length: config.heads }, (_, h) =>
    attentionRow(slice(q, h), slice(k, h), slice(v, h), query));
  const concatenated = rows.flatMap(row => row.mixture);
  const outputMatrix = weights[`${layer}.o`].toRows();
  return {
    ...rows[head], words, head, heads: config.heads,
    input: rmsnorm(result.traces[layer].state).toRows(),
    matrices: Object.fromEntries(['q', 'k', 'v'].map(name =>
      [name, slice(weights[`${layer}.${name}`].toRows(), head)])),
    concatenated, outputMatrix, output: projectRow(concatenated, outputMatrix),
    source: 'Vrais Q/K/V de Luciole, poids finaux fixes. Les scores sont reconstruits à partir de ces tenseurs ; ceux du futur servent seulement à expliquer le masque et ne sont jamais utilisés par Luciole. Entrée après RMSNorm ; positions apprises déjà ajoutées, sans RoPE.',
  };
}

/** Comptage conceptuel des positions dont on calcule K/V, pas du coût total. */
export function cacheFrame(step = 0, promptTokens = ['<bos>', 'le', 'chat'], continuation = ['dort', '.'], layers = 2) {
  if (!Number.isInteger(step) || step < 0 || step > continuation.length ||
    !promptTokens.length || !Number.isInteger(layers) || layers < 1) {
    throw new RangeError('Étape de cache invalide.');
  }
  const words = [...promptTokens, ...continuation.slice(0, step)];
  const reused = step === 0 ? 0 : words.length - 1;
  return {
    words, reused, fresh: words.length - reused,
    without: words.length * layers, with: (words.length - reused) * layers,
    total: words.length * layers, phase: step === 0 ? 'Prefill' : `Décodage · ${step === 1 ? 't' : 't + 1'}`,
  };
}
