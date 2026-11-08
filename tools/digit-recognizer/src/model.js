/**
 * Inférence pure du petit réseau convolutif (CNN) qui reconnaît les chiffres.
 *
 * Aucun DOM, aucun réseau : uniquement des Float32Array. Le même code sert au
 * navigateur, aux tests et au script d'entraînement (évaluation finale), ce
 * qui garantit que la précision publiée est celle du code réellement exécuté.
 *
 * Architecture (entrée 1×28×28, valeurs 0 = fond, 1 = encre) :
 *   conv1 8 filtres 5×5 → ReLU → max-pool 2×2   → 8×12×12
 *   conv2 16 filtres 3×3 → ReLU → max-pool 2×2  → 16×5×5 = 400
 *   dense 400 → 64 → ReLU
 *   dense 64 → 10 → softmax
 *
 * Conventions de stockage (row-major) :
 *   - conv : poids [sortie][entrée][ky][kx] ;
 *   - dense : poids [sortie][entrée] ;
 *   - cartes d'activation : [canal][y][x].
 */

/**
 * @typedef {object} ConvLayer
 * @property {Float32Array} weights - Noyaux [out][in][k][k].
 * @property {Float32Array} bias - Un biais par canal de sortie.
 * @property {number} inChannels
 * @property {number} outChannels
 * @property {number} kernel - Côté du noyau carré.
 */

/**
 * @typedef {object} DenseLayer
 * @property {Float32Array} weights - Matrice [outputs][inputs].
 * @property {Float32Array} bias
 * @property {number} inputs
 * @property {number} outputs
 */

/**
 * @typedef {object} DigitModel
 * @property {ConvLayer} conv1
 * @property {ConvLayer} conv2
 * @property {DenseLayer} dense1
 * @property {DenseLayer} dense2
 */

/**
 * @typedef {object} FeatureMaps
 * @property {Float32Array} data - Valeurs [canal][y][x].
 * @property {number} channels
 * @property {number} size - Côté de chaque carte carrée.
 */

/**
 * @typedef {object} ForwardResult
 * @property {FeatureMaps} conv1 - Cartes après conv1 + ReLU (8×24×24).
 * @property {FeatureMaps} pool1 - Après max-pool (8×12×12).
 * @property {FeatureMaps} conv2 - Après conv2 + ReLU (16×10×10).
 * @property {FeatureMaps} pool2 - Après max-pool (16×5×5).
 * @property {Float32Array} hidden - 64 neurones cachés après ReLU.
 * @property {Float32Array} logits - 10 scores bruts avant softmax.
 * @property {Float32Array} probabilities - Softmax des logits (somme 1).
 */

/** Côté de l'image d'entrée attendue par le modèle. */
export const INPUT_SIZE = 28;

/** Nombre de classes (chiffres 0 à 9). */
export const CLASS_COUNT = 10;

/**
 * Convolution 2D « valid » (sans remplissage, pas de 1), suivie de ReLU.
 * Sortie de côté `size - kernel + 1`.
 * @param {Float32Array} input - Cartes [in][size][size].
 * @param {number} size - Côté des cartes d'entrée.
 * @param {ConvLayer} layer
 * @returns {FeatureMaps}
 */
export function conv2dRelu(input, size, layer) {
  const { weights, bias, inChannels, outChannels, kernel } = layer;
  const outSize = size - kernel + 1;
  const out = new Float32Array(outChannels * outSize * outSize);
  for (let o = 0; o < outChannels; o++) {
    for (let y = 0; y < outSize; y++) {
      for (let x = 0; x < outSize; x++) {
        let sum = bias[o];
        for (let c = 0; c < inChannels; c++) {
          sum += correlate(input, (c * size + y) * size + x, size, weights, (o * inChannels + c) * kernel * kernel, kernel);
        }
        // ReLU : seules les réponses positives d'un filtre sont conservées.
        out[(o * outSize + y) * outSize + x] = sum > 0 ? sum : 0;
      }
    }
  }
  return { data: out, channels: outChannels, size: outSize };
}

/**
 * Produit scalaire entre une fenêtre k×k de l'entrée et un noyau.
 * @param {Float32Array} input
 * @param {number} origin - Index du coin haut-gauche de la fenêtre.
 * @param {number} stride - Largeur d'une ligne de l'entrée.
 * @param {Float32Array} weights
 * @param {number} offset - Index du premier poids du noyau.
 * @param {number} kernel
 * @returns {number}
 */
function correlate(input, origin, stride, weights, offset, kernel) {
  let sum = 0;
  for (let ky = 0; ky < kernel; ky++) {
    const row = origin + ky * stride;
    const kRow = offset + ky * kernel;
    for (let kx = 0; kx < kernel; kx++) {
      sum += input[row + kx] * weights[kRow + kx];
    }
  }
  return sum;
}

/**
 * Max-pooling 2×2 de pas 2 : garde la réponse la plus forte de chaque bloc,
 * ce qui divise la résolution par deux et tolère de petits décalages.
 * @param {FeatureMaps} maps - Cartes de côté pair.
 * @returns {FeatureMaps}
 */
export function maxPool2(maps) {
  const { data, channels, size } = maps;
  const half = size >> 1;
  const out = new Float32Array(channels * half * half);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const i = (c * size + 2 * y) * size + 2 * x;
        out[(c * half + y) * half + x] = Math.max(data[i], data[i + 1], data[i + size], data[i + size + 1]);
      }
    }
  }
  return { data: out, channels, size: half };
}

/**
 * Couche entièrement connectée : y = W·x + b, avec ReLU optionnelle.
 * @param {Float32Array} input
 * @param {DenseLayer} layer
 * @param {boolean} relu
 * @returns {Float32Array}
 */
export function dense(input, layer, relu) {
  const { weights, bias, inputs, outputs } = layer;
  const out = new Float32Array(outputs);
  for (let o = 0; o < outputs; o++) {
    let sum = bias[o];
    const row = o * inputs;
    for (let i = 0; i < inputs; i++) {
      sum += weights[row + i] * input[i];
    }
    out[o] = relu && sum < 0 ? 0 : sum;
  }
  return out;
}

/**
 * Softmax numériquement stable : on retranche le maximum avant l'exponentielle
 * pour éviter un dépassement (exp(1000) = Infinity) sans changer le résultat.
 * @param {ArrayLike<number>} logits
 * @returns {Float32Array} Probabilités positives de somme 1.
 */
export function softmax(logits) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    max = Math.max(max, logits[i]);
  }
  const out = new Float32Array(logits.length);
  let total = 0;
  for (let i = 0; i < logits.length; i++) {
    const value = Math.exp(logits[i] - max);
    out[i] = value;
    total += value;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] /= total;
  }
  return out;
}

/**
 * Passe avant complète en conservant chaque activation intermédiaire, pour
 * pouvoir les afficher (pédagogie) ou les réutiliser (rétropropagation).
 * @param {DigitModel} model
 * @param {Float32Array} image - 784 valeurs dans [0, 1], ligne par ligne.
 * @returns {ForwardResult}
 */
export function forward(model, image) {
  if (image.length !== INPUT_SIZE * INPUT_SIZE) {
    throw new RangeError(`Image attendue de ${INPUT_SIZE * INPUT_SIZE} pixels, reçu ${image.length}.`);
  }
  const conv1 = conv2dRelu(image, INPUT_SIZE, model.conv1);
  const pool1 = maxPool2(conv1);
  const conv2 = conv2dRelu(pool1.data, pool1.size, model.conv2);
  const pool2 = maxPool2(conv2);
  const hidden = dense(pool2.data, model.dense1, true);
  const logits = dense(hidden, model.dense2, false);
  return { conv1, pool1, conv2, pool2, hidden, logits, probabilities: softmax(logits) };
}

/**
 * Indices des classes triés par probabilité décroissante.
 * @param {ArrayLike<number>} probabilities
 * @returns {number[]}
 */
export function rankClasses(probabilities) {
  return Array.from(probabilities, (_, digit) => digit)
    .sort((a, b) => probabilities[b] - probabilities[a] || a - b);
}

/**
 * Raccourci : chiffre le plus probable et sa probabilité.
 * @param {DigitModel} model
 * @param {Float32Array} image
 * @returns {{digit: number, confidence: number, probabilities: Float32Array}}
 */
export function predict(model, image) {
  const { probabilities } = forward(model, image);
  const [digit] = rankClasses(probabilities);
  return { digit, confidence: probabilities[digit], probabilities };
}

/**
 * Nombre total de paramètres appris (poids + biais).
 * @param {DigitModel} model
 * @returns {number}
 */
export function countParameters(model) {
  return [model.conv1, model.conv2, model.dense1, model.dense2]
    .reduce((sum, layer) => sum + layer.weights.length + layer.bias.length, 0);
}
