/**
 * Chargement des poids du réseau depuis le dépôt (aucun service externe).
 *
 * Deux fichiers servis à côté de l'outil :
 *   - `model/model.json` : manifeste (architecture, emplacement de chaque
 *     tenseur, empreinte SHA-256, provenance des données, précision mesurée) ;
 *   - `model/weights.bin` : tous les poids en float32 little-endian, à la suite.
 *
 * Le décodage est pur (ArrayBuffer → Float32Array) et testable sous Node ;
 * seul `loadModel` touche au réseau, via un `fetch` injectable.
 */

/** @typedef {import('./model.js').DigitModel} DigitModel */

/**
 * @typedef {object} TensorSlice
 * @property {number} offset - Index du premier float32 dans weights.bin.
 * @property {number} length - Nombre de float32.
 */

/**
 * @typedef {object} LayerSpec
 * @property {'conv'|'dense'} type
 * @property {TensorSlice} weights
 * @property {TensorSlice} bias
 * @property {number} [inChannels]
 * @property {number} [outChannels]
 * @property {number} [kernel]
 * @property {number} [inputs]
 * @property {number} [outputs]
 */

/**
 * @typedef {object} ModelManifest
 * @property {string} format
 * @property {number} version
 * @property {{file: string, bytes: number, sha256: string, dtype: string}} weights
 * @property {Record<string, LayerSpec>} layers
 * @property {number} parameters
 * @property {Record<string, any>} [dataset]
 * @property {Record<string, any>} [training]
 * @property {Record<string, any>} [evaluation]
 */

export const MANIFEST_FORMAT = 'playlab42-digit-cnn';
export const MANIFEST_VERSION = 1;
const FLOAT_BYTES = 4;

/**
 * @typedef {object} LayerShape
 * @property {'conv'|'dense'} type
 * @property {number} [inChannels]
 * @property {number} [outChannels]
 * @property {number} [kernel]
 * @property {number} [inputs]
 * @property {number} [outputs]
 */

/**
 * Formes attendues : le code d'inférence est écrit pour cette architecture.
 * @type {Readonly<Record<'conv1'|'conv2'|'dense1'|'dense2', LayerShape>>}
 */
export const EXPECTED_LAYERS = Object.freeze({
  conv1: { type: 'conv', inChannels: 1, outChannels: 8, kernel: 5 },
  conv2: { type: 'conv', inChannels: 8, outChannels: 16, kernel: 3 },
  dense1: { type: 'dense', inputs: 400, outputs: 64 },
  dense2: { type: 'dense', inputs: 64, outputs: 10 },
});

/**
 * Nombre de poids attendus pour une couche (hors biais).
 * @param {LayerShape} spec
 * @returns {{weights: number, bias: number}}
 */
export function expectedSizes(spec) {
  if (spec.type === 'conv') {
    const outChannels = Number(spec.outChannels);
    const kernel = Number(spec.kernel);
    return { weights: outChannels * Number(spec.inChannels) * kernel * kernel, bias: outChannels };
  }
  return { weights: Number(spec.outputs) * Number(spec.inputs), bias: Number(spec.outputs) };
}

/**
 * Vérifie qu'un manifeste décrit exactement l'architecture attendue.
 * Lève une erreur explicite plutôt que de produire des prédictions absurdes.
 * @param {any} manifest
 * @returns {ModelManifest}
 */
export function validateManifest(manifest) {
  if (!manifest || manifest.format !== MANIFEST_FORMAT || manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Manifeste inconnu : format ${MANIFEST_FORMAT} v${MANIFEST_VERSION} attendu.`);
  }
  if (manifest.weights?.dtype !== 'float32') {
    throw new Error('Seuls les poids float32 sont pris en charge.');
  }
  let total = 0;
  for (const [name, expected] of Object.entries(EXPECTED_LAYERS)) {
    total += validateLayer(name, manifest.layers?.[name], expected, manifest.weights.bytes);
  }
  if (total !== manifest.parameters || total * FLOAT_BYTES !== manifest.weights.bytes) {
    throw new Error(`Nombre de paramètres incohérent : ${total} décrits, ${manifest.parameters} annoncés.`);
  }
  return manifest;
}

/**
 * @param {string} name
 * @param {LayerSpec | undefined} spec
 * @param {Record<string, string|number>} expected
 * @param {number} bytes - Taille annoncée de weights.bin.
 * @returns {number} Nombre de paramètres de la couche.
 */
function validateLayer(name, spec, expected, bytes) {
  if (!spec) {
    throw new Error(`Couche ${name} absente du manifeste.`);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (spec[/** @type {keyof LayerSpec} */ (key)] !== value) {
      throw new Error(`Couche ${name} : ${key} vaut ${spec[/** @type {keyof LayerSpec} */ (key)]}, ${value} attendu.`);
    }
  }
  const sizes = expectedSizes(spec);
  checkSlice(`${name}.weights`, spec.weights, sizes.weights, bytes);
  checkSlice(`${name}.bias`, spec.bias, sizes.bias, bytes);
  return sizes.weights + sizes.bias;
}

/**
 * @param {string} label
 * @param {TensorSlice | undefined} slice
 * @param {number} length
 * @param {number} bytes
 */
function checkSlice(label, slice, length, bytes) {
  const valid = slice && Number.isInteger(slice.offset) && slice.offset >= 0 &&
    slice.length === length && (slice.offset + slice.length) * FLOAT_BYTES <= bytes;
  if (!valid) {
    throw new Error(`Tenseur ${label} mal décrit (${length} valeurs attendues).`);
  }
}

/**
 * Lit un tenseur float32 little-endian, quel que soit l'ordre d'octets de la
 * machine (DataView rend la lecture explicite et portable).
 * @param {DataView} view
 * @param {TensorSlice} slice
 * @returns {Float32Array}
 */
function readTensor(view, slice) {
  const out = new Float32Array(slice.length);
  for (let i = 0; i < slice.length; i++) {
    out[i] = view.getFloat32((slice.offset + i) * FLOAT_BYTES, true);
    if (!Number.isFinite(out[i])) {
      throw new Error('Poids non fini (NaN ou infini) dans weights.bin.');
    }
  }
  return out;
}

/**
 * Dimensions d'une couche (sans type ni emplacements des tenseurs).
 * @param {LayerShape} spec
 * @returns {Record<string, number>}
 */
export function layerShape(spec) {
  return Object.fromEntries(['inChannels', 'outChannels', 'kernel', 'inputs', 'outputs']
    .filter(key => key in spec)
    .map(key => [key, Number(spec[/** @type {keyof LayerShape} */ (key)])]));
}

/**
 * Construit le modèle à partir du manifeste et du contenu binaire.
 * @param {any} manifest - Manifeste JSON déjà décodé.
 * @param {ArrayBuffer} buffer - Contenu de weights.bin.
 * @returns {DigitModel}
 */
export function decodeWeights(manifest, buffer) {
  const checked = validateManifest(manifest);
  if (buffer.byteLength !== checked.weights.bytes) {
    throw new Error(`weights.bin fait ${buffer.byteLength} octets, ${checked.weights.bytes} attendus.`);
  }
  const view = new DataView(buffer);
  /** @type {Record<string, any>} */
  const model = {};
  for (const [name, spec] of Object.entries(checked.layers)) {
    if (!(name in EXPECTED_LAYERS)) {
      continue;
    }
    model[name] = { ...layerShape(spec), weights: readTensor(view, spec.weights), bias: readTensor(view, spec.bias) };
  }
  return /** @type {DigitModel} */ (model);
}

/**
 * Empreinte SHA-256 hexadécimale (Web Crypto, disponible dans Node et dans les
 * navigateurs en contexte sécurisé : HTTPS ou localhost).
 * @param {ArrayBuffer} buffer
 * @param {SubtleCrypto} subtle
 * @returns {Promise<string>}
 */
export async function sha256Hex(buffer, subtle) {
  const digest = await subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Télécharge (depuis le même site) puis décode le modèle.
 * L'empreinte est vérifiée quand Web Crypto est disponible ; hors contexte
 * sécurisé (HTTP distant), seule la taille est contrôlée.
 * @param {object} [options]
 * @param {URL|string} [options.manifestUrl] - URL de model.json.
 * @param {typeof fetch} [options.fetchImpl]
 * @param {SubtleCrypto|null} [options.subtle] - null : pas de vérification d’empreinte.
 * @returns {Promise<{model: DigitModel, manifest: ModelManifest, verified: boolean}>}
 */
export async function loadModel({
  manifestUrl = new URL('../model/model.json', import.meta.url),
  fetchImpl = globalThis.fetch,
  subtle = globalThis.crypto?.subtle,
} = {}) {
  const manifest = validateManifest(await (await fetchOk(fetchImpl, manifestUrl)).json());
  const weightsUrl = new URL(manifest.weights.file, manifestUrl);
  const buffer = await (await fetchOk(fetchImpl, weightsUrl)).arrayBuffer();
  const model = decodeWeights(manifest, buffer);
  if (!subtle) {
    return { model, manifest, verified: false };
  }
  const digest = await sha256Hex(buffer, subtle);
  if (digest !== manifest.weights.sha256) {
    throw new Error('Empreinte SHA-256 de weights.bin incorrecte : fichier altéré ou incomplet.');
  }
  return { model, manifest, verified: true };
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {URL|string} url
 * @returns {Promise<Response>}
 */
async function fetchOk(fetchImpl, url) {
  const response = await fetchImpl(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Chargement impossible de ${url} (HTTP ${response.status}).`);
  }
  return response;
}
