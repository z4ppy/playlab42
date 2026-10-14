/**
 * Préentraînement éditorial hors build et hors navigateur.
 * Exécuter dans Docker : node scripts/train-llm-anatomy.js
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SeededRandom } from '../lib/seeded-random.js';
import { loadWeights, lexicalPieces, tokenize, forward } from '../parcours/epics/anatomie-llm/_shared/model.js';
import { crossEntropy } from '../parcours/epics/anatomie-llm/_shared/tensor.js';
import { evaluateExamples } from '../parcours/epics/anatomie-llm/_shared/evaluation.js';
import { createCorpus } from './llm-anatomy-corpus.js';

const root = new URL('../parcours/epics/anatomie-llm/assets/', import.meta.url);
const tatoebaText = await readFile(new URL('tatoeba.json', root), 'utf8');
const corpus = createCorpus(JSON.parse(tatoebaText));
const corpusText = `${JSON.stringify(corpus, null, 2)}\n`;
const vocabulary = ['<bos>', '<eos>', ...new Set(corpus.splits.train.flatMap(e => lexicalPieces(e.text)))];
const config = { dim: 32, heads: 4, layers: 2, context: 32 };
const seed = 42;
const steps = 12000;
const rng = new SeededRandom(seed);
const weights = {};
function matrix(name, rows, cols, scale) {
  weights[name] = Array.from({ length: rows * cols }, () => (rng.random() * 2 - 1) * scale);
}
matrix('token', vocabulary.length, config.dim, 0.25);
matrix('position', config.context, config.dim, 0.1);
matrix('output', config.dim, vocabulary.length, 0.2);
for (let i = 0; i < config.layers; i++) {
  for (const name of ['q', 'k', 'v', 'o']) { matrix(`${i}.${name}`, config.dim, config.dim, 0.25); }
  matrix(`${i}.up`, config.dim, config.dim * 2, 0.25);
  matrix(`${i}.down`, config.dim * 2, config.dim, 0.18);
}
const model = { config, vocabulary, weights };
const tensors = loadWeights(model, true);
const parameters = Object.values(tensors);
const moments = parameters.map(p => [new Float64Array(p.data.length), new Float64Array(p.data.length)]);
const families = ['original', 'natural', 'agreement', 'context'];
const groups = families.map(family => corpus.splits.train.filter(e => e.family === family)
  .map(e => [...tokenize(e.text, vocabulary), 1]));
for (const examples of Object.values(corpus.splits)) {
  for (const example of examples) {
    if (tokenize(example.text, vocabulary).length > config.context) {
      throw new Error(`Contexte insuffisant : ${example.id}`);
    }
  }
}
// Sous-ensembles fixes et étalés dans chaque famille ; aucun cas de test ici.
const monitoring = Object.fromEntries(['train', 'validation'].map(split => [split,
  ['agreement', 'context'].flatMap(family => {
    const examples = corpus.splits[split].filter(e => e.family === family);
    const count = Math.min(32, examples.length);
    return Array.from({ length: count }, (_, i) => examples[Math.floor(i * examples.length / count)]);
  }),
]));
const history = [];
function checkpoint(step) {
  const inference = loadWeights({ ...model, weights: Object.fromEntries(Object.entries(tensors).map(([name, t]) => [name, Array.from(t.data)])) });
  const monitored = Object.fromEntries(Object.entries(monitoring).map(([split, examples]) =>
    [split, evaluateExamples(model, inference, examples)]));
  history.push({ step, ...monitored });
  console.log(`Étape ${step}/${steps} : apprentissage ${monitored.train.loss.toFixed(4)}, validation ${monitored.validation.loss.toFixed(4)}`);
}
checkpoint(0);
for (let step = 0; step < steps; step++) {
  // Préserver les exemples historiques, sans les laisser noyés dans les patrons.
  const choice = rng.random();
  const group = groups[choice < 0.15 ? 0 : choice < 0.3 ? 1 : choice < 0.65 ? 2 : 3];
  const sequence = group[rng.int(0, group.length - 1)];
  parameters.forEach(p => p.grad.fill(0));
  const prediction = forward(sequence.slice(0, -1), tensors, config);
  const loss = crossEntropy(prediction.logits, sequence.slice(1));
  loss.backward();
  const rate = 0.0025 * (1 - step / steps * 0.9);
  parameters.forEach((p, index) => {
    const [first, second] = moments[index];
    p.data.forEach((value, i) => {
      const g = Math.max(-1, Math.min(1, p.grad[i]));
      first[i] = 0.9 * first[i] + 0.1 * g;
      second[i] = 0.999 * second[i] + 0.001 * g * g;
      p.data[i] = value - rate * (first[i] / (1 - 0.9 ** (step + 1))) /
        (Math.sqrt(second[i] / (1 - 0.999 ** (step + 1))) + 1e-8);
    });
  });
  if ((step + 1) % 1000 === 0) { checkpoint(step + 1); }
}
model.weights = Object.fromEntries(Object.entries(tensors).map(([name, t]) => [name, Array.from(t.data, v => Number(v.toFixed(7)))]));
const inference = loadWeights(model);
// Le test n'est consulté qu'après les mises à jour, jamais pour choisir un arrêt.
const evaluation = {
  version: 2,
  method: 'Perte moyenne par phrase, en nats/token. Exactitude du token cible au maximum des logits du vocabulaire entier. Test consulté uniquement à la fin ; ni arrêt anticipé ni sélection de checkpoint.',
  splits: Object.fromEntries(Object.entries(corpus.splits).map(([split, examples]) =>
    [split, evaluateExamples(model, inference, examples)])),
};
model.meta = {
  name: 'Luciole · mini-Transformer pédagogique',
  version: 2, date: '2026-10-12', source: 'corpus.json',
  corpusSha256: createHash('sha256').update(corpusText).digest('hex'),
  tatoebaSha256: createHash('sha256').update(tatoebaText).digest('hex'),
  script: 'scripts/train-llm-anatomy.js',
  seed, steps, optimizer: 'Adam, clipping élémentaire ±1, taux 0.0025 → 0.00025',
  sampling: '15 % phrases originales, 15 % Tatoeba, 35 % accords, 35 % boîtes ; uniforme dans chaque famille.',
  parameters: parameters.reduce((s, p) => s + p.data.length, 0),
  counts: Object.fromEntries(Object.entries(corpus.splits).map(([split, examples]) => [split, examples.length])),
  monitoring: 'Courbes : 64 phrases fixes par lot, 32 accords et 32 boîtes, avec le même mélange de tâches. Elles excluent les phrases originales et Tatoeba. Dernière évaluation séparée sur les lots complets.',
  history, trainingLoss: evaluation.splits.train.loss,
  license: 'CC-BY-NC-SA-4.0',
  limitation: corpus.meta.limitations,
};
if (!Number.isFinite(model.meta.trainingLoss) || model.meta.trainingLoss > 1) {
  throw new Error(`Apprentissage insuffisant : ${model.meta.trainingLoss}. Aucun poids publié.`);
}
const modelText = `${JSON.stringify(model)}\n`;
evaluation.modelSha256 = createHash('sha256').update(modelText).digest('hex');
await writeFile(new URL('corpus.json', root), corpusText);
await writeFile(new URL('model.json', root), modelText);
await writeFile(new URL('evaluation.json', root), `${JSON.stringify(evaluation)}\n`);
console.log(JSON.stringify({ parameters: model.meta.parameters, vocabulary: vocabulary.length, counts: model.meta.counts,
  scores: Object.fromEntries(Object.entries(evaluation.splits).map(([split, result]) =>
    [split, Object.fromEntries(Object.entries(result.tasks).map(([task, value]) => [task, `${value.correct}/${value.total}`]))])) }, null, 2));
