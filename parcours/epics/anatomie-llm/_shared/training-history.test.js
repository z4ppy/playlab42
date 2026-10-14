/** @jest-environment jsdom */
import { readFileSync } from 'node:fs';
import { trainingReplay, evaluationReport } from './training-history.js';
import { lucioleTokenizer } from './luciole-tokenizer.js';

const read = name => JSON.parse(readFileSync(new URL(`../assets/${name}.json`, import.meta.url)));
const model = read('model');
const corpus = read('corpus');
const evaluation = read('evaluation');

test('la relecture affiche les mesures de l’instant choisi, sans modifier les poids', () => {
  const before = JSON.stringify(model);
  const root = trainingReplay(model, corpus);
  document.body.replaceChildren(root);
  const slider = root.querySelector('input[type="range"]');
  expect(root.querySelector('select').value).toMatch(/^accord-/);
  expect(root.querySelector('.training-prompt').textContent).toContain('attendu : est');
  expect(root.querySelector('.instrument-grid').textContent).toContain('Prédiction correcte');
  expect(root.textContent).toContain('pas une panne de l’application');
  expect(root.textContent).toContain('12 000');
  slider.value = '0';
  slider.dispatchEvent(new Event('input'));
  expect(slider.getAttribute('aria-valuetext')).toBe('0 mises à jour des poids');
  expect(root.querySelector('.metric-row strong').textContent).toBe('0');
  expect(root.querySelectorAll('.instrument-grid .metric strong')[0].textContent)
    .toBe(root.querySelectorAll('.instrument-grid .metric strong')[1].textContent);
  slider.value = '6';
  slider.dispatchEvent(new Event('input'));
  expect(root.querySelectorAll('.metric-row strong')[1].textContent).toBe(model.meta.history[6].train.loss.toFixed(3));
  expect(JSON.stringify(model)).toBe(before);
});

test('les échecs restent consultables et proviennent du lot réservé', () => {
  const root = evaluationReport(evaluation, corpus);
  document.body.replaceChildren(root);
  const [filter, choice] = root.querySelectorAll('select');
  filter.value = 'wrong';
  filter.dispatchEvent(new Event('change'));
  expect(choice.disabled).toBe(false);
  expect(root.querySelector('.evaluation-case').textContent).toContain('Échec');
  expect(corpus.splits.test.some(e => e.id === choice.value)).toBe(true);
  filter.value = 'right';
  filter.dispatchEvent(new Event('change'));
  expect(root.querySelector('.evaluation-case').textContent).toContain('Réussi');
});

test('le tokenizer montre ses vrais IDs et refuse un mot hors vocabulaire', () => {
  const root = lucioleTokenizer(model, corpus);
  document.body.replaceChildren(root);
  const input = root.querySelector('textarea');
  input.value = 'LA capitale';
  input.dispatchEvent(new Event('input'));
  expect([...root.querySelectorAll('.token small')].map(e => e.textContent))
    .toEqual(['id 0', `id ${model.vocabulary.indexOf('la')}`, `id ${model.vocabulary.indexOf('capitale')}`]);
  input.value = 'anticonstitutionnellement';
  input.dispatchEvent(new Event('input'));
  expect(root.querySelector('[role="status"]').textContent).toContain('Inférence refusée');
  expect(root.querySelector('.token:last-child small').textContent).toBe('id inconnu');
  for (const language of ['fra', 'eng', 'spa']) {
    input.value = corpus.splits.train.find(e => e.language === language).text;
    input.dispatchEvent(new Event('input'));
    expect(root.querySelector('[role="status"]').textContent).toContain('identifiants acceptés');
  }
});
