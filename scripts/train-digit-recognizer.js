/**
 * Entraînement reproductible du CNN de l'outil « Reconnaissance de chiffres ».
 *
 * Hors build et hors navigateur. Dans Docker, depuis la racine du dépôt :
 *   node scripts/train-digit-recognizer.js --download            # télécharge MNIST dans tmp/mnist
 *   node scripts/train-digit-recognizer.js --data <dossier>      # MNIST déjà présent (.gz)
 *
 * Données : MNIST (Yann LeCun, Corinna Cortes, Christopher J.C. Burges),
 * licence CC BY-SA 3.0. Les quatre archives sont vérifiées par SHA-256 avant
 * usage. Le jeu de test (10 000 images) ne sert qu'à la mesure finale : la
 * surveillance pendant l'entraînement utilise 5 000 images retenues du jeu
 * d'entraînement.
 *
 * Sorties (versionnées) :
 *   tools/digit-recognizer/model/weights.bin       poids float32 little-endian
 *   tools/digit-recognizer/model/model.json        manifeste, provenance, précision
 *   tools/digit-recognizer/model/mnist-samples.json  20 images de test réelles
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { SeededRandom } from '../lib/seeded-random.js';
import { MANIFEST_FORMAT, MANIFEST_VERSION } from '../tools/digit-recognizer/src/weights-loader.js';
import {
  augment, backprop, createAdam, evaluate, imageAt, initModel, parseIdx, serializeModel, zeroGradients,
} from './lib/digit-recognizer-training.js';

const ROOT = new URL('../', import.meta.url).pathname;
const OUTPUT = join(ROOT, 'tools/digit-recognizer/model');

/** Miroir public utilisé par torchvision (les URLs historiques de yann.lecun.com ne répondent plus). */
const MIRROR = 'https://ossci-datasets.s3.amazonaws.com/mnist/';

/** Empreintes des archives officielles (leurs MD5 sont aussi ceux publiés par torchvision). */
const FILES = {
  trainImages: { name: 'train-images-idx3-ubyte.gz', sha256: '440fcabf73cc546fa21475e81ea370265605f56be210a4024d2ca8f203523609' },
  trainLabels: { name: 'train-labels-idx1-ubyte.gz', sha256: '3552534a0a558bbed6aed32b30c495cca23d567ec52cac8be1a0730e8010255c' },
  testImages: { name: 't10k-images-idx3-ubyte.gz', sha256: '8d422c7b0a1c1c79245a5bcf07fe86e33eeafee792b84584aec276f5a2dbc4e6' },
  testLabels: { name: 't10k-labels-idx1-ubyte.gz', sha256: 'f7ae60f92e00ec6debd23a6088c31dbd2371eca3ffa0defaefb259924204aec6' },
};

/** Hyperparamètres : toute modification change les poids, d'où leur trace dans model.json. */
const CONFIG = {
  seed: 42,
  epochs: 12,
  batchSize: 32,
  learningRate: 0.002,
  finalLearningRate: 0.00005,
  validationSize: 5000,
  augmentation: { rotation: 0.21, scale: 0.12, shear: 0.15, shift: 2.5 },
  augmentationProbability: 0.85,
};

const { values: args } = parseArgs({
  options: {
    data: { type: 'string', default: join(ROOT, 'tmp/mnist') },
    download: { type: 'boolean', default: false },
    epochs: { type: 'string' },
  },
});
const config = { ...CONFIG, epochs: args.epochs ? Number(args.epochs) : CONFIG.epochs };

/**
 * Lit (et au besoin télécharge) une archive MNIST, en vérifiant son empreinte.
 * @param {{name: string, sha256: string}} file
 * @returns {Promise<Uint8Array>}
 */
async function readMnistFile(file) {
  const path = join(args.data, file.name);
  if (!existsSync(path)) {
    if (!args.download) {
      throw new Error(`${path} absent : relancer avec --download ou --data <dossier>.`);
    }
    mkdirSync(args.data, { recursive: true });
    const response = await fetch(`${MIRROR}${file.name}`);
    if (!response.ok) { throw new Error(`Téléchargement impossible : ${file.name} (HTTP ${response.status}).`); }
    writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
  }
  const compressed = readFileSync(path);
  const digest = createHash('sha256').update(compressed).digest('hex');
  if (digest !== file.sha256) {
    throw new Error(`Empreinte inattendue pour ${file.name} : ${digest}.`);
  }
  return parseIdx(new Uint8Array(gunzipSync(compressed))).data;
}

/**
 * Taux d'apprentissage à décroissance cosinus, de lr initial à lr final.
 * @param {number} progress - Avancement dans [0, 1].
 * @returns {number}
 */
function learningRateAt(progress) {
  const { learningRate, finalLearningRate } = config;
  return finalLearningRate + (learningRate - finalLearningRate) * 0.5 * (1 + Math.cos(Math.PI * progress));
}

/**
 * Une époque : mélange déterministe, mini-lots, augmentation aléatoire.
 * @returns {{loss: number, accuracy: number}}
 */
function trainEpoch({ model, optimizer, rng, images, labels, indices, epoch }) {
  const order = rng.shuffle([...indices]);
  const batches = Math.ceil(order.length / config.batchSize);
  let totalLoss = 0;
  let correct = 0;
  for (let b = 0; b < batches; b++) {
    const grads = zeroGradients(model);
    const batch = order.slice(b * config.batchSize, (b + 1) * config.batchSize);
    for (const index of batch) {
      const raw = imageAt(images, index);
      const image = rng.random() < config.augmentationProbability ? augment(raw, rng, config.augmentation) : raw;
      const result = backprop(model, grads, image, labels[index]);
      totalLoss += result.loss;
      if (result.correct) { correct++; }
    }
    optimizer(grads, batch.length, learningRateAt((epoch + b / batches) / config.epochs));
  }
  return { loss: totalLoss / order.length, accuracy: correct / order.length };
}

/**
 * Deux premières images de chaque chiffre du jeu de test, pour les tests
 * unitaires et le bouton « Exemple » de l'outil.
 * @returns {Array<{index: number, label: number, pixels: string}>}
 */
function pickSamples(images, labels) {
  const samples = [];
  const counts = new Array(10).fill(0);
  for (let i = 0; i < labels.length && samples.length < 20; i++) {
    if (counts[labels[i]] < 2) {
      counts[labels[i]]++;
      samples.push({ index: i, label: labels[i], pixels: Buffer.from(images.subarray(i * 784, (i + 1) * 784)).toString('base64') });
    }
  }
  return samples.sort((a, b) => a.label - b.label || a.index - b.index);
}

const DATASET = {
  name: 'MNIST',
  authors: 'Yann LeCun, Corinna Cortes, Christopher J.C. Burges',
  homepage: 'https://yann.lecun.com/exdb/mnist/',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  mirror: MIRROR,
  files: Object.values(FILES),
};

async function main() {
  const [trainImages, trainLabels, testImages, testLabels] = await Promise.all(
    [FILES.trainImages, FILES.trainLabels, FILES.testImages, FILES.testLabels].map(readMnistFile));
  const rng = new SeededRandom(config.seed);
  const model = initModel(rng);
  const optimizer = createAdam(model);
  const all = rng.shuffle(Array.from(trainLabels, (_, i) => i));
  const validation = all.slice(0, config.validationSize);
  const train = all.slice(config.validationSize);
  const history = [];
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    const started = Date.now();
    const stats = trainEpoch({ model, optimizer, rng, images: trainImages, labels: trainLabels, indices: train, epoch });
    const valid = evaluate(model, trainImages, trainLabels, validation);
    history.push({ epoch: epoch + 1, loss: round(stats.loss), trainAccuracy: round(stats.accuracy), validationAccuracy: round(valid.accuracy) });
    console.log(`Époque ${epoch + 1}/${config.epochs} : perte ${stats.loss.toFixed(4)}, validation ${(valid.accuracy * 100).toFixed(2)} % (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
  // Mesure finale unique sur le jeu de test, avec le code d'inférence de l'outil.
  const test = evaluate(model, testImages, testLabels);
  console.log(`Jeu de test : ${test.correct}/${test.total} = ${(test.accuracy * 100).toFixed(2)} %`);
  const { buffer, layers, parameters } = serializeModel(model);
  const manifest = {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    description: 'CNN 2 convolutions + 2 couches denses entraîné sur MNIST par scripts/train-digit-recognizer.js',
    weights: { file: 'weights.bin', bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), dtype: 'float32', endianness: 'little' },
    parameters,
    layers,
    dataset: DATASET,
    training: { script: 'scripts/train-digit-recognizer.js', ...config, trainSize: train.length, optimizer: 'Adam', history },
    evaluation: { split: 'test (t10k)', testAccuracy: round(test.accuracy), correct: test.correct, total: test.total, confusion: test.confusion },
  };
  mkdirSync(OUTPUT, { recursive: true });
  writeFileSync(join(OUTPUT, 'weights.bin'), buffer);
  writeFileSync(join(OUTPUT, 'model.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const samples = { source: 'MNIST t10k (jeu de test)', license: DATASET.license, authors: DATASET.authors, format: 'uint8 28×28 en base64, 0 = fond', samples: pickSamples(testImages, testLabels) };
  writeFileSync(join(OUTPUT, 'mnist-samples.json'), `${JSON.stringify(samples, null, 2)}\n`);
}

/** @param {number} value */
function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

await main();
