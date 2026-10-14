import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Tensor, matmul, add, relu, rmsnorm, attention, crossEntropy, gather } from './tensor.js';
import { loadWeights, lexicalPieces, tokenize, forward, decode } from './model.js';
import { evaluateExamples } from './evaluation.js';
import { createCorpus } from '../../../../scripts/llm-anatomy-corpus.js';
import { softmax, distribution, histogram, kvBytes, roofline, rotatePair, sample } from './math.js';
import { learnMerges, bpeTokens } from './tokenization.js';
import { SeededRandom } from '../../../../lib/seeded-random.js';

const model = JSON.parse(readFileSync(new URL('../assets/model.json', import.meta.url), 'utf8'));
const weights = loadWeights(model);

function checkGradient(values, rows, cols, loss, tolerance = 5) {
  const parameter = new Tensor(values, rows, cols, true);
  loss(parameter).backward();
  values.forEach((value, i) => {
    const plus = [...values];
    const minus = [...values];
    plus[i] = value + 1e-5;
    minus[i] = value - 1e-5;
    const numeric = (loss(new Tensor(plus, rows, cols)).data[0] - loss(new Tensor(minus, rows, cols)).data[0]) / 2e-5;
    expect(parameter.grad[i]).toBeCloseTo(numeric, tolerance);
  });
}

describe('Moteur matriciel et gradients', () => {
  test('produit matriciel connu, addition et collecte répétée', () => {
    const a = new Tensor([1, 2, 3, 4], 2, 2);
    const b = new Tensor([5, 6, 7, 8], 2, 2);
    expect(matmul(a, b).toRows()).toEqual([[19, 22], [43, 50]]);
    expect(add(a, b).toRows()).toEqual([[6, 8], [10, 12]]);
    expect(gather(a, [1, 1, 0]).toRows()).toEqual([[3, 4], [3, 4], [1, 2]]);
  });
  test('gradients du produit, RMSNorm, ReLU et perte par différences finies', () => {
    const b = new Tensor([0.2, -0.4, 0.7, 0.1], 2, 2);
    checkGradient([0.3, -0.7, 0.5, 0.8], 2, 2, x => crossEntropy(matmul(x, b), [1, 0]));
    checkGradient([0.3, -0.7, 0.5, 0.8], 2, 2, x => crossEntropy(rmsnorm(x), [1, 0]));
    checkGradient([0.3, -0.7, 0.5, 0.8], 2, 2, x => crossEntropy(relu(x), [1, 0]));
    checkGradient([0.3, -0.7, 0.5, 0.8], 2, 2, x => crossEntropy(add(x, x), [1, 0]));
  });
  test('le gradient de gather cumule les indices répétés', () => {
    checkGradient([0.3, -0.7, 0.5, 0.8], 2, 2, x => crossEntropy(gather(x, [0, 0, 1]), [1, 0, 0]));
  });
  test.each(['q', 'k', 'v'])('le gradient de l’attention %s est exact', key => {
    const values = [0.2, 0.3, -0.4, 0.7, 0.8, -0.2, 0.1, 0.5, 0.3, 0.1, 0.6, -0.5];
    checkGradient(values, 3, 4, parameter => {
      const inputs = Object.fromEntries(['q', 'k', 'v'].map(name => [name, name === key ? parameter : new Tensor(values.map(v => v * 0.7), 3, 4)]));
      return crossEntropy(attention(inputs.q, inputs.k, inputs.v, 2).result, [0, 1, 2]);
    });
  });
  test('les opérations rejettent les formes impossibles', () => {
    expect(() => new Tensor([1], 2, 2)).toThrow();
    expect(() => matmul(new Tensor([1], 1, 1), new Tensor([1, 2], 2, 1))).toThrow();
    expect(() => gather(new Tensor([1], 1, 1), [2])).toThrow();
    expect(() => new Tensor([1], 1, 1).backward()).toThrow();
  });
});

describe('Luciole réellement entraîné', () => {
  test('la provenance correspond au corpus livré', () => {
    const source = readFileSync(new URL('../assets/corpus.json', import.meta.url));
    expect(model.meta.corpusSha256).toBe(createHash('sha256').update(source).digest('hex'));
    expect(model.meta.history.at(-1).train.loss).toBeLessThan(model.meta.history[0].train.loss);
    expect(model.meta.history.at(-1).validation.loss).toBeLessThan(model.meta.history[0].validation.loss);
    expect(model.meta.trainingLoss).toBeLessThan(0.6);
    expect(Object.values(weights).reduce((s, p) => s + p.data.length, 0)).toBe(model.meta.parameters);
  });
  test.each([
    ['la capitale de la france est', 'paris'],
    ['la capitale de la belgique est', 'bruxelles'],
    ['la capitale du japon est', 'tokyo'],
  ])('retrouve le token appris pour %s', (prompt, target) => {
    const result = forward(tokenize(prompt, model.vocabulary), weights, model.config);
    const logits = result.logits.toRows().at(-1);
    expect(model.vocabulary[logits.indexOf(Math.max(...logits))]).toBe(target);
  });
  test('le futur ne modifie aucune sortie passée, pour chaque bloc et tête', () => {
    const prefix = tokenize('la capitale', model.vocabulary);
    const full = [...prefix, ...tokenize('de la france', model.vocabulary).slice(1)];
    const a = forward(prefix, weights, model.config);
    const b = forward(full, weights, model.config);
    expect(b.logits.toRows().slice(0, prefix.length)).toEqual(a.logits.toRows());
    b.traces.slice(1).forEach(trace => trace.attention.forEach(map => map.forEach((row, i) => {
      expect(row.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 12);
      expect(row.slice(i + 1).every(p => p === 0)).toBe(true);
    })));
  });
  test('inférence reproductible, sans gradient ni mutation des poids', () => {
    const ids = tokenize('le chat', model.vocabulary);
    const before = Array.from(weights.token.data);
    const a = forward(ids, weights, model.config);
    expect(a.logits.grad).toBeNull();
    expect(a.logits.toRows()).toEqual(forward(ids, weights, model.config).logits.toRows());
    expect(Array.from(weights.token.data)).toEqual(before);
  });
  test('signale mots inconnus, fenêtre dépassée et poids invalides', () => {
    expect(() => tokenize('inconnu <script>', model.vocabulary)).toThrow('Hors vocabulaire');
    expect(() => forward(Array(model.config.context + 1).fill(0), weights, model.config)).toThrow(String(model.config.context));
    expect(() => loadWeights({ ...model, weights: {} })).toThrow('Poids invalides');
    expect(decode([0, model.vocabulary.indexOf('paris'), model.vocabulary.indexOf('.'), 1], model.vocabulary)).toBe('paris.');
  });
  test('tokenizer NFC lexical partagé : casse, accents, apostrophes et marqueurs', () => {
    expect(lexicalPieces("L'homme 42 !")).toEqual(['l', "'", 'homme', '42', '!']);
    expect(lexicalPieces('E\u0301TÉ')).toEqual(['été']);
    expect(lexicalPieces('foo-bar 👩‍💻')).toEqual(['foo', '-', 'bar', '👩', '\u200d', '💻']);
    expect(tokenize('LA CAPITALE', model.vocabulary)).toEqual(tokenize('la capitale', model.vocabulary));
    expect(tokenize('', model.vocabulary)).toEqual([0]);
    expect(model.vocabulary.slice(0, 2)).toEqual(['<bos>', '<eos>']);
  });
  test('corpus reproductible, licences et groupes réservés sans fuite', () => {
    const corpus = JSON.parse(readFileSync(new URL('../assets/corpus.json', import.meta.url)));
    const source = readFileSync(new URL('../assets/tatoeba.json', import.meta.url));
    const tatoeba = JSON.parse(source);
    expect(createCorpus(tatoeba)).toEqual(corpus);
    expect(model.meta.tatoebaSha256).toBe(createHash('sha256').update(source).digest('hex'));
    expect(tatoeba.meta.license).toBe('CC0-1.0');
    expect(tatoeba.sentences).toHaveLength(40);
    expect([...new Set(tatoeba.sentences.map(e => e.language))]).toEqual(['fra', 'eng', 'spa']);
    const membership = new Map();
    const texts = new Set();
    for (const [split, examples] of Object.entries(corpus.splits)) {
      expect(examples).toHaveLength(model.meta.counts[split]);
      for (const example of examples) {
        expect(texts.has(example.text)).toBe(false);
        texts.add(example.text);
        expect(tokenize(example.text, model.vocabulary).length).toBeLessThanOrEqual(model.config.context);
        if (example.group) {
          if (membership.has(example.group)) { expect(membership.get(example.group)).toBe(split); }
          membership.set(example.group, split);
        }
        if (example.family === 'natural') {
          expect(split).toBe('train');
          expect(example.license).toBe('CC0-1.0');
        }
      }
    }
    expect(model.vocabulary).toEqual(['<bos>', '<eos>', ...new Set(corpus.splits.train.flatMap(e => lexicalPieces(e.text)))]);
    expect(model.meta.parameters).toBeGreaterThan(7072);
    expect(model.meta.parameters).toBeLessThan(50000);
  });
  test('les résultats publiés correspondent aux poids finaux, échecs compris', () => {
    const source = readFileSync(new URL('../assets/model.json', import.meta.url));
    const report = JSON.parse(readFileSync(new URL('../assets/evaluation.json', import.meta.url)));
    const corpus = JSON.parse(readFileSync(new URL('../assets/corpus.json', import.meta.url)));
    expect(report.modelSha256).toBe(createHash('sha256').update(source).digest('hex'));
    expect(evaluateExamples(model, weights, corpus.splits.test)).toEqual(report.splits.test);
    expect(report.splits.test.tasks.agreement.correct).toBeGreaterThan(report.splits.test.tasks.agreement.baselineCorrect);
    expect(report.splits.test.tasks.context.correct).toBeLessThan(report.splits.test.tasks.context.total);
    expect(report.splits.test.tasks.agreement.total).toBe(16);
    expect(report.splits.test.tasks.context.total).toBe(216);
    const testIds = new Set(corpus.splits.test.map(e => e.id));
    expect(model.meta.history.map(h => h.step)).toEqual(Array.from({ length: 13 }, (_, i) => i * 1000));
    for (const point of model.meta.history) {
      for (const split of ['train', 'validation']) {
        expect(point[split].count).toBe(64);
        for (const task of Object.values(point[split].tasks)) {
          task.cases.forEach(record => expect(testIds.has(record.id)).toBe(false));
        }
      }
    }
  }, 30000);
});

describe('Décodage, BPE et estimations explicites', () => {
  test('softmax stable, température zéro, filtre et somme normalisée', () => {
    expect(softmax([1000, 1000])).toEqual([0.5, 0.5]);
    expect(softmax([1, 3, 2], 0)).toEqual([0, 1, 0]);
    expect(distribution([3, 2, 1], 1, 0.5)).toEqual([1, 0, 0]);
    const p = distribution([3, 2, 1], 1, 1, 0.3);
    expect(p[2]).toBe(0);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(histogram(p)).toEqual(histogram(p));
    expect(histogram(p).reduce((s, n) => s + n, 0)).toBe(100);
    expect(histogram([0, 1, 0])).toEqual([0, 100, 0]);
  });
  test('rejette des paramètres non numériques et distributions invalides', () => {
    expect(() => softmax([Infinity])).toThrow();
    expect(() => distribution([1], 1, 0)).toThrow();
    expect(() => sample([0, 0], new SeededRandom(42))).toThrow();
    expect(() => histogram([1], -1)).toThrow();
    expect(() => kvBytes({})).toThrow();
    expect(() => roofline({})).toThrow();
  });
  test('fusions déterministes et découpage réversible Unicode', () => {
    const merges = learnMerges('la la la le le le', 10);
    expect(merges).toEqual(learnMerges('la la la le le le', 10));
    ['la le', 'éclair 👩‍💻', '', '\n  <script>'].forEach(text => expect(bpeTokens(text, merges).join('')).toBe(text));
    expect(bpeTokens('la la', merges).length).toBeLessThan(Array.from('la la').length);
  });
  test('la rotation commune conserve le produit scalaire', () => {
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    const q = rotatePair(1, 0, 2);
    const k = rotatePair(0.6, 0.8, 5);
    expect(dot(q, k)).toBeCloseTo(dot(rotatePair(1, 0, 9), rotatePair(0.6, 0.8, 12)), 12);
  });
  test('cache et roofline sont vérifiés sur des valeurs connues', () => {
    expect(kvBytes({ layers: 32, kvHeads: 8, headDim: 128, tokens: 4096, batch: 4, bytes: 2 }) / 2 ** 30).toBe(2);
    const result = roofline({ parameters: 8e9, batch: 1, weightBytes: 2, bandwidth: 3e12, flops: 600e12 });
    expect(result.intensity).toBe(1);
    expect(result.memorySeconds).toBeCloseTo(0.0053333333, 9);
    expect(result.seconds).toBe(result.memorySeconds);
  });
});
