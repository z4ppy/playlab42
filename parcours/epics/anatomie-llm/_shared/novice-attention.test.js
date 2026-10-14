import { readFileSync } from 'node:fs';
import { chapters, chapterTerms } from './chapters.js';
import { tokenize, forward, loadWeights } from './model.js';
import { attention, matmul } from './tensor.js';
import { novicePrompt, projectRow, attentionRow, toyAttention, lucioleAttention, cacheFrame } from './novice-attention.js';

const model = JSON.parse(readFileSync(new URL('../assets/model.json', import.meta.url), 'utf8'));
const weights = loadWeights(model);

test('le petit exemple calcule projections, scores, masque, somme et sortie sans valeurs cachées', () => {
  const trace = toyAttention();
  expect(trace.q).toEqual([[1, 0], [0, 1], [1, 1]]);
  expect(trace.k).toEqual([[1, 1], [0, 1], [1, 2]]);
  expect(trace.v).toEqual([[1, 0], [0, 2], [1, 2]]);
  expect(trace.products).toEqual([[0, 1], [0, 1], [0, 2]]);
  expect(trace.dots).toEqual([1, 1, 2]);
  expect(trace.scores).toEqual([1 / Math.sqrt(2), 1 / Math.sqrt(2), 2 / Math.sqrt(2)]);
  expect(trace.masked[2]).toBe(-Infinity);
  expect(trace.probabilities).toEqual([0.5, 0.5, 0]);
  expect(trace.contributions).toEqual([[0.5, 0], [0, 1], [0, 0]]);
  expect(trace.mixture).toEqual([0.5, 1]);
  expect(trace.concatenated).toEqual([0.5, 1, 0.5, 0.5]);
  expect(trace.output).toEqual([0.75, 1.25]);
});

test('modifier une entrée ou une tête change le calcul, pas les matrices', () => {
  const baseline = toyAttention();
  const changed = toyAttention(1, 0, 1);
  const otherHead = toyAttention(1, 1);
  expect(changed.matrices).toEqual(baseline.matrices);
  expect(changed.q[1]).not.toEqual(baseline.q[1]);
  expect(changed.mixture).not.toEqual(baseline.mixture);
  expect(otherHead.q).not.toEqual(baseline.q);
  expect(otherHead.mixture).not.toEqual(baseline.mixture);
  expect(toyAttention()).toEqual(baseline);
});

test('les probabilités excluent exactement le futur même avec un score futur très grand', () => {
  const trace = attentionRow([[1], [2], [3]], [[1], [2], [1000]], [[2], [4], [9000]], 1);
  expect(trace.scores).toEqual([2, 4, 2000]);
  expect(trace.probabilities[2]).toBe(0);
  expect(trace.probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
  expect(trace.mixture[0]).toBeLessThan(4);
  expect(attentionRow([[1], [2]], [[1], [2]], [[5], [9]], 0).mixture).toEqual([5]);
});

test('dimensions et sélections invalides échouent explicitement', () => {
  expect(() => projectRow([1], [[1], [2]])).toThrow(RangeError);
  expect(() => projectRow([1, 2], [[1], [2, 3]])).toThrow(RangeError);
  expect(() => attentionRow([[1]], [[1]], [[1]], 1)).toThrow(RangeError);
  expect(() => attentionRow([[1]], [[1, 2]], [[1]], 0)).toThrow(RangeError);
  expect(() => toyAttention(1, 2)).toThrow(RangeError);
  expect(() => toyAttention(1, 0, NaN)).toThrow(RangeError);
  expect(() => cacheFrame(-1)).toThrow(RangeError);
  expect(() => cacheFrame(3)).toThrow(RangeError);
});

test('toutes les étapes numériques correspondent aux vrais tenseurs de Luciole', () => {
  const ids = tokenize(novicePrompt, model.vocabulary);
  const result = forward(ids, weights, model.config);
  const before = Object.fromEntries(Object.entries(weights).map(([name, tensor]) => [name, [...tensor.data]]));
  for (let layer = 0; layer < model.config.layers; layer++) {
    const trace = result.traces[layer + 1];
    const attended = attention(trace.q, trace.k, trace.v, model.config.heads);
    const projected = matmul(attended.result, weights[`${layer}.o`]).toRows();
    for (let head = 0; head < model.config.heads; head++) {
      for (let query = 0; query < ids.length; query++) {
        const lesson = lucioleAttention(result, weights, model.config, ids.map(id => model.vocabulary[id]), layer, head, query);
        ['q', 'k', 'v'].forEach(name => {
          const calculated = projectRow(lesson.input[query], lesson.matrices[name]);
          calculated.forEach((value, i) => expect(value).toBeCloseTo(lesson[name][query][i], 12));
        });
        lesson.probabilities.forEach((value, i) => expect(value).toBeCloseTo(trace.attention[head][query][i], 12));
        lesson.output.forEach((value, i) => expect(value).toBeCloseTo(projected[query][i], 12));
        expect(lesson.concatenated).toHaveLength(model.config.dim);
        expect(lesson.probabilities.slice(query + 1).every(value => value === 0)).toBe(true);
      }
    }
  }
  Object.entries(weights).forEach(([name, tensor]) => expect([...tensor.data]).toEqual(before[name]));
  expect(() => lucioleAttention(result, weights, model.config, [], 2)).toThrow(RangeError);
  expect(() => lucioleAttention(result, weights, model.config, [], 0, 4)).toThrow(RangeError);
});

test('le cache conceptuel différencie prefill, t et t+1 par couche sans prétendre un gain total', () => {
  expect(cacheFrame(0)).toEqual({
    words: ['<bos>', 'le', 'chat'], reused: 0, fresh: 3, without: 6, with: 6, total: 6, phase: 'Prefill',
  });
  expect(cacheFrame(1)).toEqual({
    words: ['<bos>', 'le', 'chat', 'dort'], reused: 3, fresh: 1, without: 8, with: 2, total: 8, phase: 'Décodage · t',
  });
  expect(cacheFrame(2)).toEqual({
    words: ['<bos>', 'le', 'chat', 'dort', '.'], reused: 4, fresh: 1, without: 10, with: 2, total: 10, phase: 'Décodage · t + 1',
  });
});

test('les vrais K/V causaux passés sont identiques à t et t+1, même sans cache', () => {
  for (const step of [1, 2]) {
    const ids = cacheFrame(step).words.map(word => model.vocabulary.indexOf(word));
    expect(ids.every(id => id >= 0)).toBe(true);
    const past = forward(ids.slice(0, -1), weights, model.config);
    const next = forward(ids, weights, model.config);
    for (let layer = 1; layer <= model.config.layers; layer++) {
      for (const name of ['q', 'k', 'v']) {
        past.traces[layer][name].data.forEach((value, i) => expect(value).toBeCloseTo(next.traces[layer][name].data[i], 12));
      }
    }
  }
});

test('la progression garde les IDs, introduit MLP au début et Q/K/V avant RoPE', () => {
  const lucioleChapters = chapters.filter(chapter => chapter.experiment !== 'transformerExplainer');
  expect(lucioleChapters).toHaveLength(21);
  expect(new Set(chapters.map(chapter => chapter.id)).size).toBe(chapters.length);
  expect(chapters[0].body).toContain('<dfn>MLP</dfn>');
  expect(chapters[0].body).toContain('Multi-Layer Perceptron');
  expect(chapterTerms.generation).toContain('mlp');
  const index = id => chapters.findIndex(chapter => chapter.id === id);
  expect(index('05-transformer')).toBeLessThan(index('06b-tetes'));
  expect(index('06b-tetes')).toBeLessThan(index('07-attention'));
  expect(index('07-attention')).toBeLessThan(index('06-position'));
  expect(chapters.slice(index('05-transformer'), index('08-experts') + 1).every(chapter =>
    chapter.section === 'À l’intérieur du Transformer')).toBe(true);
  expect(index('09b-scores')).toBeLessThan(index('09-logit-lens'));
  const glossary = JSON.parse(readFileSync(new URL('../glossary.json', import.meta.url), 'utf8'));
  Object.values(chapterTerms).flat().forEach(term => expect(glossary.terms[term]?.short).toBeTruthy());
  expect(chapters.find(chapter => chapter.id === '01b-luciole').caveat).toContain('41,7 % contre 50 %');
});
