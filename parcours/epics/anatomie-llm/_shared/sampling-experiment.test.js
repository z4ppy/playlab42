/** @jest-environment jsdom */
import { distribution } from './math.js';
import { sampling, samplingScenarios } from './sampling-experiment.js';

const logits = samplingScenarios[0].probabilities.map(Math.log);
const closeTo = (actual, expected) => expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 10));

test('les filtres gardent et renormalisent les candidats attendus, dans leur ordre déclaré', () => {
  closeTo(distribution(logits), [0.4, 0.3, 0.2, 0.08, 0.02]);
  closeTo(distribution(logits, 1, 0.8), [4 / 9, 1 / 3, 2 / 9, 0, 0]);
  closeTo(distribution(logits, 1, 1, 0.25), [4 / 9, 1 / 3, 2 / 9, 0, 0]);
  closeTo(distribution(logits, 1, 1, 0, 2), [4 / 7, 3 / 7, 0, 0, 0]);
  // Top-p porte sur les 70 % restants après top-k : 50 % de 70 % = 35 %.
  closeTo(distribution(logits, 1, 0.5, 0, 2), [1, 0, 0, 0, 0]);
  for (const k of [0, 6, 1.5, NaN]) { expect(() => distribution(logits, 1, 1, 0, k)).toThrow(); }
});

test('la température conserve une égalité et le maximum à zéro est déterministe', () => {
  const equal = samplingScenarios[2].probabilities.map(Math.log);
  for (const t of [0.1, 1, 2]) { closeTo(distribution(equal, t), [0.2, 0.2, 0.2, 0.2, 0.2]); }
  closeTo(distribution(equal, 0), [1, 0, 0, 0, 0]);
  closeTo(distribution(equal, 1, 1, 0, 2), [0.5, 0.5, 0, 0, 0]);
  expect(distribution(logits, 0.5)[0]).toBeGreaterThan(0.4);
  expect(distribution(logits, 2)[0]).toBeLessThan(0.4);
});

function change(root, name, value) {
  const label = [...root.querySelectorAll('label')].find(node => node.textContent.startsWith(name));
  const input = root.querySelector(`#${label.htmlFor}`);
  input.value = String(value);
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
}
function click(root, name) {
  [...root.querySelectorAll('button')].find(node => node.textContent === name).click();
}

test('avant/après restent distincts, les exclusions visibles et les tirages sont reproductibles', () => {
  const root = document.createElement('div');
  sampling(root);
  const values = kind => [...root.querySelectorAll(`[data-distribution="${kind}"] .bar-value`)].map(node => node.textContent);
  const baseline = values('initial');
  expect(values('final')).toEqual(baseline);
  expect(root.querySelector('.sampling-frequencies').textContent).toBe('');
  click(root, 'Tirer une fois');
  expect(root.querySelector('.status').textContent).toContain('1 tirage cumulé');
  click(root, 'Ajouter 100 tirages');
  const observations = root.querySelector('.sampling-frequencies').textContent;
  expect(root.querySelector('.status').textContent).toContain('101 tirages cumulés');
  click(root, 'Recommencer les tirages');
  click(root, 'Tirer une fois');
  click(root, 'Ajouter 100 tirages');
  expect(root.querySelector('.sampling-frequencies').textContent).toBe(observations);
  root.querySelector('.sampling-filtering').open = true;
  change(root, 'Top-k', 2);
  expect(root.querySelector('.sampling-filtering').open).toBe(true);
  expect(values('initial')).toEqual(baseline);
  expect(values('final').slice(2)).toEqual(['0.0 %', '0.0 %', '0.0 %']);
  expect(root.querySelector('.sampling-filtering').textContent).toContain('Écarté par top-k');
  expect(root.querySelector('.status').textContent).toContain('Aucun tirage');
  change(root, 'Température', 0);
  expect(values('final')).toEqual(['100.0 %', '0.0 %', '0.0 %', '0.0 %', '0.0 %']);
  expect(values('initial')).toEqual(baseline);
  change(root, 'Situation', 'equal');
  expect(values('initial')).toEqual(Array(5).fill('20.0 %'));
  expect(root.textContent).toContain('premier candidat');
});
