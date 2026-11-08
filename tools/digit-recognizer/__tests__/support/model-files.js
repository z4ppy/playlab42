/**
 * Accès aux fichiers du modèle versionnés, pour les tests Node.
 */
import { readFileSync } from 'node:fs';
import { decodeWeights } from '../../src/weights-loader.js';

const modelDir = new URL('../../model/', import.meta.url);

/** @returns {any} Manifeste model.json décodé. */
export function readManifest() {
  return JSON.parse(readFileSync(new URL('model.json', modelDir), 'utf8'));
}

/** @returns {ArrayBuffer} Copie autonome du contenu de weights.bin. */
export function readWeightsBuffer() {
  const bytes = readFileSync(new URL('weights.bin', modelDir));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** @returns {import('../../src/model.js').DigitModel} */
export function readModel() {
  return decodeWeights(readManifest(), readWeightsBuffer());
}

/**
 * Images réelles du jeu de test MNIST (CC BY-SA 3.0) embarquées dans le dépôt.
 * @returns {Array<{index: number, label: number, pixels: Uint8Array, image: Float32Array}>}
 */
export function readSamples() {
  const json = JSON.parse(readFileSync(new URL('mnist-samples.json', modelDir), 'utf8'));
  return json.samples.map((/** @type {{index: number, label: number, pixels: string}} */ sample) => {
    const pixels = new Uint8Array(Buffer.from(sample.pixels, 'base64'));
    return { index: sample.index, label: sample.label, pixels, image: Float32Array.from(pixels, v => v / 255) };
  });
}
