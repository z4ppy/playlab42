/**
 * Tests de l'inférence pure : couches élémentaires, softmax et prédictions
 * sur de vraies images du jeu de test MNIST embarquées dans le dépôt.
 */
import {
  CLASS_COUNT, conv2dRelu, countParameters, dense, forward, maxPool2, predict, rankClasses, softmax,
} from '../src/model.js';
import { readManifest, readModel, readSamples } from './support/model-files.js';

describe('softmax', () => {
  test('donne des probabilités positives de somme 1 dans l\'ordre des logits', () => {
    const p = softmax([1, 2, 3]);
    expect(p[0] + p[1] + p[2]).toBeCloseTo(1, 6);
    expect(p[2]).toBeGreaterThan(p[1]);
    expect(p[1]).toBeGreaterThan(p[0]);
    // exp(1)/(exp(1)+exp(2)+exp(3)) ≈ 0,0900
    expect(p[0]).toBeCloseTo(0.09003, 4);
  });

  test('reste stable pour de très grands logits (pas de NaN)', () => {
    const p = softmax([1000, 1001, 999]);
    expect(Array.from(p).every(Number.isFinite)).toBe(true);
    expect(p[1]).toBeCloseTo(0.66524, 4);
  });

  test('est invariante par ajout d\'une constante', () => {
    const a = softmax([0.5, -1, 2]);
    const b = softmax([10.5, 9, 12]);
    a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 6));
  });
});

describe('couches élémentaires', () => {
  test('conv2dRelu : corrélation valid + biais, puis ReLU', () => {
    // Entrée 3×3, noyau 2×2 de 1 : chaque sortie = somme d'un bloc 2×2.
    const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const layer = { weights: new Float32Array([1, 1, 1, 1]), bias: new Float32Array([-14]), inChannels: 1, outChannels: 1, kernel: 2 };
    const out = conv2dRelu(input, 3, layer);
    expect(out.size).toBe(2);
    // Sommes 12, 16, 24, 28 moins 14 : la ReLU met la première à 0.
    expect(Array.from(out.data)).toEqual([0, 2, 10, 14]);
  });

  test('maxPool2 garde le maximum de chaque bloc 2×2 et divise le côté par deux', () => {
    const maps = { data: new Float32Array([1, 5, 2, 0, 3, 4, 8, 1, 0, 0, 1, 1, 9, 0, 1, 7]), channels: 1, size: 4 };
    const out = maxPool2(maps);
    expect(out.size).toBe(2);
    expect(Array.from(out.data)).toEqual([5, 8, 9, 7]);
  });

  test('dense calcule W·x + b, avec ReLU optionnelle', () => {
    const layer = { weights: new Float32Array([1, 2, -3, -1]), bias: new Float32Array([0.5, 0]), inputs: 2, outputs: 2 };
    expect(Array.from(dense(new Float32Array([1, 1]), layer, false))).toEqual([3.5, -4]);
    expect(Array.from(dense(new Float32Array([1, 1]), layer, true))).toEqual([3.5, 0]);
  });

  test('rankClasses trie par probabilité décroissante, à égalité par chiffre', () => {
    expect(rankClasses([0.1, 0.5, 0.1, 0.3])).toEqual([1, 3, 0, 2]);
  });
});

describe('modèle entraîné', () => {
  const model = readModel();
  const samples = readSamples();

  test('a la taille annoncée par le manifeste', () => {
    expect(countParameters(model)).toBe(readManifest().parameters);
    expect(countParameters(model)).toBe(27690);
  });

  test('expose toutes les activations intermédiaires avec les bonnes formes', () => {
    const acts = forward(model, samples[0].image);
    expect([acts.conv1.channels, acts.conv1.size]).toEqual([8, 24]);
    expect([acts.pool1.channels, acts.pool1.size]).toEqual([8, 12]);
    expect([acts.conv2.channels, acts.conv2.size]).toEqual([16, 10]);
    expect([acts.pool2.channels, acts.pool2.size]).toEqual([16, 5]);
    expect(acts.hidden).toHaveLength(64);
    expect(acts.logits).toHaveLength(CLASS_COUNT);
    expect(Array.from(acts.hidden).every(v => v >= 0)).toBe(true);
  });

  test('refuse une image qui n\'a pas 784 pixels', () => {
    expect(() => forward(model, new Float32Array(100))).toThrow(RangeError);
  });

  test('contient deux exemples réels de chaque chiffre', () => {
    expect(samples).toHaveLength(20);
    expect(samples.map(s => s.label).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
  });

  test.each(readSamples().map(s => [s.index, s.label, s]))(
    'l\'image de test MNIST n°%i est reconnue comme un %i',
    (_index, label, sample) => {
      const result = predict(model, sample.image);
      expect(result.digit).toBe(label);
      expect(result.confidence).toBeGreaterThan(0.5);
    },
  );

  test('une image vide ne fait pas planter le réseau et donne une distribution valide', () => {
    const { probabilities } = predict(model, new Float32Array(784));
    expect(Array.from(probabilities).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
  });
});
