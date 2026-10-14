import { tokenize, forward } from './model.js';
import { crossEntropy } from './tensor.js';
import { softmax } from './math.js';

/** Le score porte sur un seul token cible, pas sur toute une réponse générée. */
export function evaluateExamples(model, weights, examples) {
  let loss = 0;
  const tasks = {};
  const scored = new Set();
  for (const example of examples) {
    const ids = [...tokenize(example.text, model.vocabulary), model.vocabulary.indexOf('<eos>')];
    const pass = forward(ids.slice(0, -1), weights, model.config);
    loss += crossEntropy(pass.logits, ids.slice(1)).data[0];
    if (!example.prompt) { continue; }
    if (scored.has(example.prompt)) { continue; }
    scored.add(example.prompt);
    const prefix = tokenize(example.prompt, model.vocabulary);
    const target = model.vocabulary.indexOf(example.target);
    if (target < 0 || ids[prefix.length] !== target ||
      !prefix.every((id, i) => ids[i] === id)) {
      throw new Error(`Cible ou préfixe incohérent : ${example.id}`);
    }
    const probabilities = softmax(pass.logits.toRows()[prefix.length - 1]);
    const best = probabilities.indexOf(Math.max(...probabilities));
    const task = tasks[example.family] ??= { correct: 0, total: 0, baselineCorrect: 0, cases: [] };
    task.total++;
    task.correct += Number(best === target);
    task.baselineCorrect += Number(example.baseline === example.target);
    task.cases.push({
      id: example.id, prediction: model.vocabulary[best],
      probability: probabilities[best], targetProbability: probabilities[target],
    });
  }
  if (!examples.length || !Number.isFinite(loss)) { throw new Error('Évaluation vide ou non finie.'); }
  return { loss: loss / examples.length, count: examples.length, tasks };
}
