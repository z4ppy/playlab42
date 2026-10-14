import { Tensor, add, matmul, gather, relu, rmsnorm, attention } from './tensor.js';

/** Tokenizer lexical volontairement fermé, distinct des BPE de production. */
export function lexicalPieces(text) {
  return text.normalize('NFC').toLocaleLowerCase('fr').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
}

export function tokenize(text, vocabulary) {
  const words = lexicalPieces(text);
  const ids = words.map(word => vocabulary.indexOf(word));
  const unknown = words.filter((_, i) => ids[i] < 0);
  if (unknown.length) { throw new Error(`Hors vocabulaire : ${[...new Set(unknown)].join(', ')}. Utilisez un exemple ou les mots du corpus.`); }
  return [vocabulary.indexOf('<bos>'), ...ids];
}

/** Vérifie les poids avant toute inférence ; aucun remplacement implicite. */
export function loadWeights(model, train = false) {
  const c = model.config;
  if (!c || !Number.isInteger(c.dim) || c.dim < 2 || c.dim > 128 ||
    !Number.isInteger(c.layers) || c.layers < 1 || c.layers > 8 ||
    !Number.isInteger(c.heads) || c.heads < 1 || c.dim % c.heads ||
    !Number.isInteger(c.context) || c.context < 2 || c.context > 128 ||
    !Array.isArray(model.vocabulary) || model.vocabulary.length < 3 ||
    !model.vocabulary.includes('<bos>') || !model.vocabulary.includes('<eos>')) {
    throw new Error('Configuration du mini-modèle invalide.');
  }
  const shapes = { token: [model.vocabulary.length, c.dim], position: [c.context, c.dim], output: [c.dim, model.vocabulary.length] };
  for (let i = 0; i < c.layers; i++) {
    for (const name of ['q', 'k', 'v', 'o']) { shapes[`${i}.${name}`] = [c.dim, c.dim]; }
    shapes[`${i}.up`] = [c.dim, c.dim * 2];
    shapes[`${i}.down`] = [c.dim * 2, c.dim];
  }
  return Object.fromEntries(Object.entries(shapes).map(([name, [rows, cols]]) => {
    const data = model.weights?.[name];
    if (!Array.isArray(data) || data.length !== rows * cols || data.some(v => !Number.isFinite(v))) {
      throw new Error(`Poids invalides : ${name}.`);
    }
    return [name, new Tensor(data, rows, cols, train)];
  }));
}

/** Inférence exacte : chaque trace correspond aux tenseurs utilisés pour prédire. */
export function forward(ids, weights, config) {
  if (!ids.length || ids.length > config.context) {
    throw new RangeError(`Le mini-modèle accepte de 1 à ${config.context} tokens, début compris.`);
  }
  const embedding = gather(weights.token, ids);
  let x = add(embedding, gather(weights.position, ids.map((_, i) => i)));
  const traces = [{ state: x, embedding }];
  for (let i = 0; i < config.layers; i++) {
    const normalized = rmsnorm(x);
    const q = matmul(normalized, weights[`${i}.q`]);
    const k = matmul(normalized, weights[`${i}.k`]);
    const v = matmul(normalized, weights[`${i}.v`]);
    const attended = attention(q, k, v, config.heads);
    const residual = add(x, matmul(attended.result, weights[`${i}.o`]));
    const hidden = relu(matmul(rmsnorm(residual), weights[`${i}.up`]));
    x = add(residual, matmul(hidden, weights[`${i}.down`]));
    traces.push({ state: x, attention: attended.maps, q, k, v, hidden });
  }
  return { logits: matmul(rmsnorm(x), weights.output), traces };
}

export function logitLens(state, weights) {
  return matmul(rmsnorm(state), weights.output).toRows().at(-1);
}

export function decode(ids, vocabulary) {
  return ids.map(id => vocabulary[id]).filter(t => t !== '<bos>' && t !== '<eos>')
    .join(' ').replace(/\s+([.,!?;:])/g, '$1');
}
