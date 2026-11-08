/**
 * Tests du chargement des poids : manifeste, intégrité, décodage et fetch.
 */
import { webcrypto } from 'node:crypto';
import { decodeWeights, loadModel, sha256Hex, validateManifest } from '../src/weights-loader.js';
import { readManifest, readWeightsBuffer } from './support/model-files.js';

const subtle = /** @type {SubtleCrypto} */ (webcrypto.subtle);

/** Copie profonde modifiable du manifeste versionné. */
const manifestCopy = () => structuredClone(readManifest());

/**
 * Faux fetch servant le manifeste et les poids depuis la mémoire.
 * @param {Record<string, {ok?: boolean, status?: number, json?: any, buffer?: ArrayBuffer}>} routes
 */
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push({ url: String(url), init });
    const name = String(url).split('/').pop();
    const route = routes[name] ?? { ok: false, status: 404 };
    return Promise.resolve({
      ok: route.ok ?? true,
      status: route.status ?? 200,
      json: () => Promise.resolve(route.json),
      arrayBuffer: () => Promise.resolve(route.buffer),
    });
  };
  return { fetchImpl, calls };
}

describe('fichiers versionnés', () => {
  test('weights.bin correspond à l\'empreinte SHA-256 et à la taille du manifeste', async () => {
    const manifest = readManifest();
    const buffer = readWeightsBuffer();
    expect(buffer.byteLength).toBe(manifest.weights.bytes);
    expect(await sha256Hex(buffer, subtle)).toBe(manifest.weights.sha256);
    // Moins de 1 Mo : chargement rapide même sur mobile.
    expect(buffer.byteLength).toBeLessThan(1024 * 1024);
  });

  test('documente la source, la licence du jeu de données et la précision mesurée', () => {
    const { dataset, evaluation, training } = readManifest();
    expect(dataset.name).toBe('MNIST');
    expect(dataset.license).toBe('CC BY-SA 3.0');
    expect(dataset.authors).toMatch(/LeCun/);
    expect(dataset.authors).toMatch(/Cortes/);
    expect(dataset.files).toHaveLength(4);
    expect(training.script).toBe('scripts/train-digit-recognizer.js');
    expect(evaluation.total).toBe(10000);
    expect(evaluation.testAccuracy).toBeGreaterThanOrEqual(0.97);
    expect(evaluation.correct / evaluation.total).toBeCloseTo(evaluation.testAccuracy, 5);
  });
});

describe('validateManifest', () => {
  test('accepte le manifeste versionné', () => {
    expect(() => validateManifest(readManifest())).not.toThrow();
  });

  test.each([
    ['un format inconnu', (/** @type {any} */ m) => { m.format = 'autre'; }, /format/],
    ['un type de poids non géré', (/** @type {any} */ m) => { m.weights.dtype = 'int8'; }, /float32/],
    ['une couche absente', (/** @type {any} */ m) => { delete m.layers.conv2; }, /conv2 absente/],
    ['une forme différente', (/** @type {any} */ m) => { m.layers.conv1.kernel = 3; }, /kernel/],
    ['un tenseur hors du fichier', (/** @type {any} */ m) => { m.layers.dense2.bias.offset = 1e9; }, /dense2.bias/],
    ['un total incohérent', (/** @type {any} */ m) => { m.parameters += 1; }, /incohérent/],
  ])('refuse %s', (_label, mutate, message) => {
    const manifest = manifestCopy();
    mutate(manifest);
    expect(() => validateManifest(manifest)).toThrow(message);
  });
});

describe('decodeWeights', () => {
  test('lit chaque tenseur en float32 little-endian à son offset', () => {
    const manifest = readManifest();
    const buffer = readWeightsBuffer();
    const model = decodeWeights(manifest, buffer);
    const view = new DataView(buffer);
    const { offset } = manifest.layers.dense1.bias;
    expect(model.dense1.bias[3]).toBe(view.getFloat32((offset + 3) * 4, true));
    expect(model.conv1.weights).toHaveLength(200);
    expect(model.dense2.outputs).toBe(10);
  });

  test('refuse un fichier tronqué', () => {
    expect(() => decodeWeights(readManifest(), readWeightsBuffer().slice(0, 100))).toThrow(/octets/);
  });

  test('refuse un poids NaN', () => {
    const buffer = readWeightsBuffer();
    new DataView(buffer).setFloat32(0, Number.NaN, true);
    expect(() => decodeWeights(readManifest(), buffer)).toThrow(/NaN/);
  });
});

describe('loadModel', () => {
  const manifestUrl = 'https://exemple.test/tools/digit-recognizer/model/model.json';

  test('charge depuis le même site et vérifie l\'empreinte', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'model.json': { json: readManifest() },
      'weights.bin': { buffer: readWeightsBuffer() },
    });
    const { model, verified } = await loadModel({ manifestUrl, fetchImpl: /** @type {any} */ (fetchImpl), subtle });
    expect(verified).toBe(true);
    expect(model.conv2.outChannels).toBe(16);
    expect(calls.map(c => c.url)).toEqual([manifestUrl, manifestUrl.replace('model.json', 'weights.bin')]);
    expect(calls.every(c => c.init.credentials === 'same-origin')).toBe(true);
  });

  test('sans Web Crypto (HTTP distant), charge sans vérifier l\'empreinte', async () => {
    const { fetchImpl } = fakeFetch({
      'model.json': { json: readManifest() },
      'weights.bin': { buffer: readWeightsBuffer() },
    });
    const { verified } = await loadModel({ manifestUrl, fetchImpl: /** @type {any} */ (fetchImpl), subtle: null });
    expect(verified).toBe(false);
  });

  test('signale un fichier altéré', async () => {
    const buffer = readWeightsBuffer();
    new DataView(buffer).setFloat32(8, 0.123, true);
    const { fetchImpl } = fakeFetch({ 'model.json': { json: readManifest() }, 'weights.bin': { buffer } });
    await expect(loadModel({ manifestUrl, fetchImpl: /** @type {any} */ (fetchImpl), subtle })).rejects.toThrow(/SHA-256/);
  });

  test('signale une erreur HTTP avec l\'URL concernée', async () => {
    const { fetchImpl } = fakeFetch({ 'model.json': { json: readManifest() } });
    await expect(loadModel({ manifestUrl, fetchImpl: /** @type {any} */ (fetchImpl), subtle })).rejects.toThrow(/weights\.bin \(HTTP 404\)/);
  });
});
