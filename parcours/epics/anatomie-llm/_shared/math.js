import { SeededRandom } from '../../../../lib/seeded-random.js';

export function softmax(logits, temperature = 1) {
  if (!logits.length || logits.some(v => !Number.isFinite(v)) || !Number.isFinite(temperature) || temperature < 0) {
    throw new RangeError('Logits finis et température positive ou nulle requis.');
  }
  const max = Math.max(...logits);
  if (temperature === 0) { return logits.map((_, i) => Number(i === logits.indexOf(max))); }
  const exp = logits.map(v => Math.exp((v - max) / temperature));
  const sum = exp.reduce((s, v) => s + v, 0);
  return exp.map(v => v / sum);
}

/** Ordre explicite : température, top-k, min-p, top-p, puis renormalisation. */
export function distribution(logits, temperature = 1, topP = 1, minP = 0, topK = logits.length) {
  if (!Number.isFinite(topP) || topP <= 0 || topP > 1 || !Number.isFinite(minP) || minP < 0 || minP > 1) {
    throw new RangeError('top-p doit être dans ]0,1] et min-p dans [0,1].');
  }
  const probabilities = softmax(logits, temperature);
  if (!Number.isInteger(topK) || topK < 1 || topK > logits.length) {
    throw new RangeError('top-k doit être un entier entre 1 et la taille du vocabulaire.');
  }
  const peak = Math.max(...probabilities);
  const eligible = probabilities.map((p, id) => ({ p, id }))
    .filter(({ p }) => p > 0).sort((a, b) => b.p - a.p || a.id - b.id)
    .slice(0, topK).filter(({ p }) => p >= peak * minP);
  const total = eligible.reduce((s, item) => s + item.p, 0);
  const kept = Array(logits.length).fill(0);
  let cumulative = 0;
  for (const { p, id } of eligible) {
    kept[id] = p;
    cumulative += p;
    if (cumulative >= topP * total) { break; }
  }
  return kept.map(p => p / cumulative);
}

export function sample(probabilities, rng) {
  if (!probabilities.length || probabilities.some(p => !Number.isFinite(p) || p < 0) ||
    Math.abs(probabilities.reduce((s, p) => s + p, 0) - 1) > 1e-8) {
    throw new RangeError('Distribution normalisée requise.');
  }
  const draw = rng.random();
  let sum = 0;
  for (let i = 0; i < probabilities.length; i++) {
    sum += probabilities[i];
    if (draw < sum) { return i; }
  }
  return probabilities.findLastIndex(p => p > 0);
}

export function histogram(probabilities, count = 100, seed = 42) {
  if (!Number.isInteger(count) || count < 1 || count > 10000) { throw new RangeError('Nombre de tirages invalide.'); }
  const rng = new SeededRandom(seed);
  const bins = probabilities.map(() => 0);
  for (let i = 0; i < count; i++) { bins[sample(probabilities, rng)]++; }
  return bins;
}

export function kvBytes({ layers, kvHeads, headDim, tokens, batch, bytes }) {
  const values = [layers, kvHeads, headDim, tokens, batch, bytes];
  if (values.some(v => !Number.isFinite(v) || v <= 0)) { throw new RangeError('Dimensions du cache strictement positives requises.'); }
  return 2 * layers * kvHeads * headDim * tokens * batch * bytes;
}

export function roofline({ parameters, batch, weightBytes, bandwidth, flops }) {
  if ([parameters, batch, weightBytes, bandwidth, flops].some(v => !Number.isFinite(v) || v <= 0)) {
    throw new RangeError('Paramètres matériels strictement positifs requis.');
  }
  const operations = 2 * parameters * batch;
  const readBytes = parameters * weightBytes;
  const computeSeconds = operations / flops;
  const memorySeconds = readBytes / bandwidth;
  return { intensity: operations / readBytes, computeSeconds, memorySeconds, seconds: Math.max(computeSeconds, memorySeconds) };
}

export function rotatePair(x, y, position, frequency = 1) {
  const angle = position * frequency;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

/** Rotation orthogonale pour l'atlas ; aucune modification des embeddings. */
export function rotate3D(point, azimuth, elevation) {
  if (point.length !== 3 || [...point, azimuth, elevation].some(v => !Number.isFinite(v))) {
    throw new RangeError('Trois coordonnées et deux angles finis sont requis.');
  }
  const [x, y, z] = point;
  const horizontal = x * Math.cos(azimuth) + z * Math.sin(azimuth);
  const depth = -x * Math.sin(azimuth) + z * Math.cos(azimuth);
  return [horizontal, y * Math.cos(elevation) - depth * Math.sin(elevation),
    y * Math.sin(elevation) + depth * Math.cos(elevation)];
}
