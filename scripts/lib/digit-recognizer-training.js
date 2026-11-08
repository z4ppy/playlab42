/**
 * Briques pures de l'entraînement du CNN « Reconnaissance de chiffres ».
 *
 * La passe avant est celle de l'outil (tools/digit-recognizer/src/model.js) :
 * seule la rétropropagation est écrite ici. Aucune dépendance externe, aucune
 * entrée/sortie : le script train-digit-recognizer.js orchestre les fichiers.
 */
import { forward, softmax } from '../../tools/digit-recognizer/src/model.js';
import { EXPECTED_LAYERS, expectedSizes, layerShape } from '../../tools/digit-recognizer/src/weights-loader.js';

/** @typedef {import('../../tools/digit-recognizer/src/model.js').DigitModel} DigitModel */
/** @typedef {import('../../tools/digit-recognizer/src/model.js').FeatureMaps} FeatureMaps */

export const LAYER_NAMES = /** @type {Array<keyof DigitModel>} */ (Object.keys(EXPECTED_LAYERS));
const SIDE = 28;
const PIXELS = SIDE * SIDE;

/**
 * Décode un fichier IDX (format des fichiers MNIST : en-tête big-endian).
 * @param {Uint8Array} bytes - Contenu décompressé.
 * @returns {{dims: number[], data: Uint8Array}}
 */
export function parseIdx(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, false);
  // 0x08 = octets non signés ; l'octet de poids faible donne le nombre de dimensions.
  if ((magic >>> 8) !== 0x08) {
    throw new Error(`Fichier IDX inattendu (magic 0x${magic.toString(16)}).`);
  }
  const dims = Array.from({ length: magic & 0xff }, (_, i) => view.getUint32(4 + i * 4, false));
  const offset = 4 + dims.length * 4;
  const expected = dims.reduce((product, dim) => product * dim, 1);
  if (bytes.length - offset !== expected) {
    throw new Error(`Fichier IDX tronqué : ${bytes.length - offset} octets pour ${expected} attendus.`);
  }
  return { dims, data: bytes.subarray(offset) };
}

/**
 * Convertit l'image n°index (octets 0..255) en Float32Array dans [0, 1].
 * @param {Uint8Array} images
 * @param {number} index
 * @returns {Float32Array}
 */
export function imageAt(images, index) {
  const out = new Float32Array(PIXELS);
  for (let i = 0; i < PIXELS; i++) {
    out[i] = images[index * PIXELS + i] / 255;
  }
  return out;
}

/**
 * Initialisation « He » (variance 2/entrées), adaptée à ReLU.
 * @param {{random: () => number}} rng
 * @returns {DigitModel}
 */
export function initModel(rng) {
  /** @type {Record<string, any>} */
  const model = {};
  for (const name of LAYER_NAMES) {
    const spec = EXPECTED_LAYERS[name];
    const sizes = expectedSizes(spec);
    const fanIn = sizes.weights / sizes.bias;
    const scale = Math.sqrt(2 / fanIn);
    const weights = new Float32Array(sizes.weights);
    for (let i = 0; i < weights.length; i++) {
      weights[i] = gaussian(rng) * scale;
    }
    model[name] = { ...layerShape(spec), weights, bias: new Float32Array(sizes.bias) };
  }
  return /** @type {DigitModel} */ (model);
}

/**
 * Tirage gaussien centré réduit (Box-Muller).
 * @param {{random: () => number}} rng
 * @returns {number}
 */
export function gaussian(rng) {
  const u = Math.max(rng.random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.random());
}

/**
 * Tampons de gradients de même forme que le modèle, remis à zéro.
 * @param {DigitModel} model
 * @returns {Record<string, {weights: Float32Array, bias: Float32Array}>}
 */
export function zeroGradients(model) {
  return Object.fromEntries(LAYER_NAMES.map(name => [name, {
    weights: new Float32Array(model[name].weights.length),
    bias: new Float32Array(model[name].bias.length),
  }]));
}

/**
 * Gradient d'une couche dense ; accumule dW, db et renvoie dEntrée.
 * @param {import('../../tools/digit-recognizer/src/model.js').DenseLayer} layer
 * @param {{weights: Float32Array, bias: Float32Array}} grad
 * @param {Float32Array} input
 * @param {Float32Array} dOut
 * @returns {Float32Array}
 */
function denseBackward(layer, grad, input, dOut) {
  const { weights, inputs, outputs } = layer;
  const dIn = new Float32Array(inputs);
  for (let o = 0; o < outputs; o++) {
    const g = dOut[o];
    if (g === 0) { continue; }
    grad.bias[o] += g;
    const row = o * inputs;
    for (let i = 0; i < inputs; i++) {
      grad.weights[row + i] += g * input[i];
      dIn[i] += g * weights[row + i];
    }
  }
  return dIn;
}

/**
 * Renvoie le gradient du max-pool vers la carte d'origine, en ne laissant
 * passer que la position gagnante de chaque bloc 2×2 (et seulement si la
 * ReLU était active, c'est-à-dire valeur > 0).
 * @param {FeatureMaps} maps - Activations avant pooling (après ReLU).
 * @param {Float32Array} dPooled
 * @returns {Float32Array}
 */
function maxPoolBackward(maps, dPooled) {
  const { data, channels, size } = maps;
  const half = size >> 1;
  const dMaps = new Float32Array(data.length);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const g = dPooled[(c * half + y) * half + x];
        const i = (c * size + 2 * y) * size + 2 * x;
        const winner = argmaxOf4(data, i, size);
        if (g !== 0 && data[winner] > 0) {
          dMaps[winner] = g;
        }
      }
    }
  }
  return dMaps;
}

/**
 * @param {Float32Array} data
 * @param {number} i - Coin haut-gauche du bloc.
 * @param {number} size
 * @returns {number} Index du maximum (le premier en cas d'égalité, comme Math.max).
 */
function argmaxOf4(data, i, size) {
  let best = i;
  for (const j of [i + 1, i + size, i + size + 1]) {
    if (data[j] > data[best]) { best = j; }
  }
  return best;
}

/**
 * Gradient d'une convolution valid ; accumule dW, db et, si demandé, dEntrée.
 * `dOut` doit déjà intégrer le masque ReLU.
 * @param {import('../../tools/digit-recognizer/src/model.js').ConvLayer} layer
 * @param {{weights: Float32Array, bias: Float32Array}} grad
 * @param {Float32Array} input
 * @param {number} size - Côté de l'entrée.
 * @param {Float32Array} dOut
 * @param {boolean} needInput
 * @returns {Float32Array|null}
 */
function convBackward(layer, grad, input, size, dOut, needInput) {
  const { weights, inChannels, outChannels, kernel } = layer;
  const outSize = size - kernel + 1;
  const dIn = needInput ? new Float32Array(input.length) : null;
  for (let o = 0; o < outChannels; o++) {
    for (let y = 0; y < outSize; y++) {
      for (let x = 0; x < outSize; x++) {
        const g = dOut[(o * outSize + y) * outSize + x];
        if (g === 0) { continue; }
        grad.bias[o] += g;
        for (let c = 0; c < inChannels; c++) {
          accumulateWindow({ input, dIn, weights, gradWeights: grad.weights, g, kernel, size,
            origin: (c * size + y) * size + x, offset: (o * inChannels + c) * kernel * kernel });
        }
      }
    }
  }
  return dIn;
}

/**
 * Accumule la contribution d'une position de sortie sur une fenêtre k×k.
 * @param {{input: Float32Array, dIn: Float32Array|null, weights: Float32Array, gradWeights: Float32Array,
 *   g: number, kernel: number, size: number, origin: number, offset: number}} window
 */
function accumulateWindow({ input, dIn, weights, gradWeights, g, kernel, size, origin, offset }) {
  for (let ky = 0; ky < kernel; ky++) {
    const row = origin + ky * size;
    const kRow = offset + ky * kernel;
    for (let kx = 0; kx < kernel; kx++) {
      gradWeights[kRow + kx] += g * input[row + kx];
      if (dIn) { dIn[row + kx] += g * weights[kRow + kx]; }
    }
  }
}

/**
 * Passe avant + rétropropagation pour un exemple ; accumule les gradients
 * de l'entropie croisée dans `grads`.
 * @param {DigitModel} model
 * @param {Record<string, {weights: Float32Array, bias: Float32Array}>} grads
 * @param {Float32Array} image
 * @param {number} label
 * @returns {{loss: number, correct: boolean}}
 */
export function backprop(model, grads, image, label) {
  const acts = forward(model, image);
  const dLogits = Float32Array.from(acts.probabilities);
  dLogits[label] -= 1; // dérivée de softmax + entropie croisée : p - y
  const dHidden = denseBackward(model.dense2, grads.dense2, acts.hidden, dLogits);
  for (let i = 0; i < dHidden.length; i++) {
    if (acts.hidden[i] <= 0) { dHidden[i] = 0; }
  }
  const dPool2 = denseBackward(model.dense1, grads.dense1, acts.pool2.data, dHidden);
  const dConv2 = maxPoolBackward(acts.conv2, dPool2);
  const dPool1 = /** @type {Float32Array} */ (convBackward(model.conv2, grads.conv2, acts.pool1.data, acts.pool1.size, dConv2, true));
  const dConv1 = maxPoolBackward(acts.conv1, dPool1);
  convBackward(model.conv1, grads.conv1, image, SIDE, dConv1, false);
  const best = acts.probabilities.indexOf(Math.max(...acts.probabilities));
  return { loss: -Math.log(Math.max(acts.probabilities[label], 1e-12)), correct: best === label };
}

/**
 * Perte d'entropie croisée d'un exemple (utile aux tests par différences finies).
 * @param {DigitModel} model
 * @param {Float32Array} image
 * @param {number} label
 * @returns {number}
 */
export function loss(model, image, label) {
  const { logits } = forward(model, image);
  return -Math.log(Math.max(softmax(logits)[label], 1e-12));
}

/**
 * Optimiseur Adam (Kingma & Ba) avec décroissance de poids découplée légère.
 * @param {DigitModel} model
 * @returns {(grads: Record<string, {weights: Float32Array, bias: Float32Array}>, batchSize: number, lr: number) => void}
 */
export function createAdam(model, { beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8, weightDecay = 1e-4 } = {}) {
  const state = LAYER_NAMES.flatMap(name => ['weights', 'bias'].map(key => {
    const params = /** @type {Float32Array} */ (/** @type {any} */ (model[name])[key]);
    return { name, key, params, m: new Float32Array(params.length), v: new Float32Array(params.length) };
  }));
  let step = 0;
  return (grads, batchSize, lr) => {
    step++;
    const c1 = 1 - beta1 ** step;
    const c2 = 1 - beta2 ** step;
    for (const { name, key, params, m, v } of state) {
      const grad = grads[name][/** @type {'weights'|'bias'} */ (key)];
      const decay = key === 'weights' ? weightDecay : 0;
      for (let i = 0; i < params.length; i++) {
        const g = grad[i] / batchSize;
        m[i] = beta1 * m[i] + (1 - beta1) * g;
        v[i] = beta2 * v[i] + (1 - beta2) * g * g;
        params[i] -= lr * ((m[i] / c1) / (Math.sqrt(v[i] / c2) + epsilon) + decay * params[i]);
      }
    }
  };
}

/**
 * Transformation affine aléatoire (rotation, échelle, cisaillement, translation)
 * avec interpolation bilinéaire : elle simule la variété des dessins au doigt.
 * @param {Float32Array} image - 28×28.
 * @param {{random: () => number}} rng
 * @param {{rotation: number, scale: number, shear: number, shift: number}} amplitude
 * @returns {Float32Array}
 */
export function augment(image, rng, amplitude) {
  const spread = (/** @type {number} */ range) => (rng.random() * 2 - 1) * range;
  const angle = spread(amplitude.rotation);
  const scale = 1 + spread(amplitude.scale);
  const shear = spread(amplitude.shear);
  const tx = spread(amplitude.shift);
  const ty = spread(amplitude.shift);
  const cos = Math.cos(angle) / scale;
  const sin = Math.sin(angle) / scale;
  const center = (SIDE - 1) / 2;
  const out = new Float32Array(PIXELS);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      // Transformation inverse : pour chaque pixel cible, où lire dans la source ?
      const dx = x - center - tx;
      const dy = y - center - ty;
      const sx = cos * dx + sin * dy + shear * dy + center;
      const sy = -sin * dx + cos * dy + center;
      out[y * SIDE + x] = bilinear(image, sx, sy);
    }
  }
  return out;
}

/**
 * @param {Float32Array} image
 * @param {number} x
 * @param {number} y
 * @returns {number} Valeur interpolée (0 hors de l'image).
 */
function bilinear(image, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  return pixel(image, x0, y0) * (1 - fx) * (1 - fy) + pixel(image, x0 + 1, y0) * fx * (1 - fy) +
    pixel(image, x0, y0 + 1) * (1 - fx) * fy + pixel(image, x0 + 1, y0 + 1) * fx * fy;
}

/**
 * @param {Float32Array} image
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function pixel(image, x, y) {
  return x < 0 || y < 0 || x >= SIDE || y >= SIDE ? 0 : image[y * SIDE + x];
}

/**
 * Sérialise le modèle : un seul binaire float32 little-endian et la table
 * des emplacements de chaque tenseur (offsets en nombre de float32).
 * @param {DigitModel} model
 * @returns {{buffer: Uint8Array, layers: Record<string, object>, parameters: number}}
 */
export function serializeModel(model) {
  const tensors = LAYER_NAMES.flatMap(name => [model[name].weights, model[name].bias]);
  const parameters = tensors.reduce((sum, tensor) => sum + tensor.length, 0);
  const buffer = new Uint8Array(parameters * 4);
  const view = new DataView(buffer.buffer);
  /** @type {Record<string, object>} */
  const layers = {};
  let offset = 0;
  for (const name of LAYER_NAMES) {
    const slices = {};
    for (const key of /** @type {const} */ (['weights', 'bias'])) {
      const tensor = model[name][key];
      tensor.forEach((value, i) => view.setFloat32((offset + i) * 4, value, true));
      /** @type {Record<string, object>} */ (slices)[key] = { offset, length: tensor.length };
      offset += tensor.length;
    }
    layers[name] = { ...EXPECTED_LAYERS[name], ...slices };
  }
  return { buffer, layers, parameters };
}

/**
 * Précision et matrice de confusion [vrai][prédit] sur un jeu d'images.
 * @param {DigitModel} model
 * @param {Uint8Array} images
 * @param {Uint8Array} labels
 * @param {number[]} [indices] - Sous-ensemble (par défaut : tout).
 * @returns {{accuracy: number, correct: number, total: number, confusion: number[][]}}
 */
export function evaluate(model, images, labels, indices = Array.from(labels, (_, i) => i)) {
  const confusion = Array.from({ length: 10 }, () => new Array(10).fill(0));
  let correct = 0;
  for (const index of indices) {
    const { probabilities } = forward(model, imageAt(images, index));
    const predicted = probabilities.indexOf(Math.max(...probabilities));
    confusion[labels[index]][predicted]++;
    if (predicted === labels[index]) { correct++; }
  }
  return { accuracy: correct / indices.length, correct, total: indices.length, confusion };
}
