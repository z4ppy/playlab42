/**
 * Tests des briques d'entraînement du CNN de reconnaissance de chiffres :
 * la rétropropagation est comparée à des différences finies.
 */
import { SeededRandom } from '../../lib/seeded-random.js';
import { decodeWeights, MANIFEST_FORMAT, MANIFEST_VERSION } from '../../tools/digit-recognizer/src/weights-loader.js';
import { forward } from '../../tools/digit-recognizer/src/model.js';
import {
  augment, backprop, initModel, loss, parseIdx, serializeModel, zeroGradients,
} from './digit-recognizer-training.js';

/** Image synthétique déterministe : un trait vertical épais avec un dégradé. */
function syntheticImage() {
  const image = new Float32Array(784);
  for (let y = 5; y < 23; y++) {
    for (let x = 11; x < 17; x++) {
      image[y * 28 + x] = 0.3 + 0.7 * ((x + y) % 3) / 2;
    }
  }
  return image;
}

describe('parseIdx', () => {
  test('décode un en-tête IDX big-endian et ses données', () => {
    // magic 0x00000803 : octets non signés, 3 dimensions (2 × 2 × 1).
    const bytes = new Uint8Array([0, 0, 8, 3, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 9, 8, 7, 6]);
    const { dims, data } = parseIdx(bytes);
    expect(dims).toEqual([2, 2, 1]);
    expect(Array.from(data)).toEqual([9, 8, 7, 6]);
  });

  test('refuse un type inconnu ou un fichier tronqué', () => {
    expect(() => parseIdx(new Uint8Array([0, 0, 9, 1, 0, 0, 0, 1, 5]))).toThrow(/magic/);
    expect(() => parseIdx(new Uint8Array([0, 0, 8, 1, 0, 0, 0, 3, 5]))).toThrow(/tronqué/);
  });
});

describe('backprop', () => {
  const model = initModel(new SeededRandom(7));
  // Biais non nuls : avec des biais à zéro, le fond (encre 0) tombe pile sur
  // le coude de ReLU et la différence finie mesure un gradient unilatéral.
  const biasRng = new SeededRandom(11);
  for (const layer of Object.values(model)) {
    layer.bias.forEach((_, i) => { layer.bias[i] = (biasRng.random() - 0.5) * 0.2; });
  }
  const image = syntheticImage();
  const label = 3;
  const grads = zeroGradients(model);
  backprop(model, grads, image, label);

  // Différence finie centrée : (L(w + h) - L(w - h)) / 2h ≈ dL/dw.
  function numericGradient(tensor, index) {
    const h = 1e-4; // petit pas : les coudes de ReLU et du max-pool restent loin
    const saved = tensor[index];
    tensor[index] = saved + h;
    const plus = loss(model, image, label);
    tensor[index] = saved - h;
    const minus = loss(model, image, label);
    tensor[index] = saved;
    return (plus - minus) / (2 * h);
  }

  test.each([
    ['dense2', 'weights', [0, 17, 300, 639]],
    ['dense2', 'bias', [0, 3, 9]],
    ['dense1', 'weights', [5, 1234, 20000]],
    ['conv2', 'weights', [0, 77, 500, 1100]],
    ['conv2', 'bias', [2, 9]],
    ['conv1', 'weights', [0, 12, 60, 199]],
    ['conv1', 'bias', [0, 5]],
  ])('le gradient analytique de %s.%s correspond aux différences finies', (layer, key, indices) => {
    for (const index of indices) {
      const analytic = grads[layer][key][index];
      const numeric = numericGradient(model[layer][key], index);
      expect(Math.abs(analytic - numeric)).toBeLessThan(3e-3 + 0.05 * Math.abs(numeric));
    }
  });
});

describe('augment', () => {
  test('sans amplitude, l\'image est inchangée', () => {
    const image = syntheticImage();
    const same = augment(image, new SeededRandom(1), { rotation: 0, scale: 0, shear: 0, shift: 0 });
    for (let i = 0; i < image.length; i++) {
      expect(same[i]).toBeCloseTo(image[i], 5);
    }
  });

  test('est déterministe pour une graine donnée et conserve l\'ordre de grandeur de l\'encre', () => {
    const image = syntheticImage();
    const amplitude = { rotation: 0.2, scale: 0.1, shear: 0.1, shift: 2 };
    const a = augment(image, new SeededRandom(5), amplitude);
    const b = augment(image, new SeededRandom(5), amplitude);
    expect(Array.from(a)).toEqual(Array.from(b));
    const ink = (/** @type {Float32Array} */ img) => img.reduce((s, v) => s + v, 0);
    expect(ink(a) / ink(image)).toBeGreaterThan(0.7);
    expect(ink(a) / ink(image)).toBeLessThan(1.3);
  });
});

describe('serializeModel', () => {
  test('produit un binaire relu à l\'identique par le chargeur de l\'outil', () => {
    const model = initModel(new SeededRandom(3));
    const { buffer, layers, parameters } = serializeModel(model);
    const manifest = {
      format: MANIFEST_FORMAT, version: MANIFEST_VERSION, parameters, layers,
      weights: { file: 'weights.bin', bytes: buffer.length, sha256: '', dtype: 'float32' },
    };
    const decoded = decodeWeights(manifest, buffer.buffer);
    const image = syntheticImage();
    expect(Array.from(forward(decoded, image).logits)).toEqual(Array.from(forward(model, image).logits));
  });
});
