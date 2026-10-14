/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { loadWeights } from './model.js';
import { attentionLesson, cacheWalkthrough } from './novice-experiments.js';
import { conceptExperiments } from './concept-experiments.js';

const model = JSON.parse(readFileSync(new URL('../assets/model.json', import.meta.url), 'utf8'));
const data = { model, weights: loadWeights(model) };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function field(root, label) {
  const node = [...root.querySelectorAll('label')].find(item => item.textContent.startsWith(label));
  return root.querySelector(`#${node.htmlFor}`);
}

function choose(root, label, value) {
  const input = field(root, label);
  input.value = String(value);
  input.dispatchEvent(new Event('change'));
}

function click(root, text) {
  [...root.querySelectorAll('button')].find(node => node.textContent === text).click();
}

test('sept étapes clavier, masque visible, somme, têtes, sortie et recommencement', () => {
  const root = document.createElement('div');
  const loader = jest.fn();
  attentionLesson(root, loader);
  expect(root.textContent).toContain('1 · Projections Q / K / V');
  expect(root.querySelectorAll('details').length).toBeGreaterThan(0);
  expect(loader).not.toHaveBeenCalled();
  const token = field(root, 'Token qui consulte');
  expect(token.value).toBe('1');
  for (const stage of [1, 2, 3, 4, 5, 6]) {
    click(root, 'Étape suivante');
    expect(field(root, 'Étape du calcul').value).toBe(String(stage));
    expect(field(root, 'Token qui consulte').value).toBe('1');
    if (stage === 2) { expect(root.textContent).toContain('× · futur interdit (−∞)'); }
    if (stage === 3) { expect(root.textContent).toContain('Somme des poids : 1.000000'); }
    if (stage === 4) { expect(root.textContent).toContain('Résultat de la tête : [0.500 ; 1.000]'); }
  }
  expect(root.querySelector('[role="img"]').getAttribute('aria-label')).toContain('0.75, 1.25');
  expect([...root.querySelectorAll('button')].find(node => node.textContent === 'Étape suivante').disabled).toBe(true);
  choose(root, 'Étape du calcul', 0);
  expect([...root.querySelectorAll('button')].find(node => node.textContent === 'Étape suivante').disabled).toBe(false);
  choose(root, 'Token qui consulte', 2);
  click(root, 'Recommencer les étapes');
  expect(field(root, 'Token qui consulte').value).toBe('1');
  expect(field(root, 'Étape du calcul').value).toBe('0');
});

test('modifier une coordonnée change les calculs affichés sans entraîner', () => {
  const root = document.createElement('div');
  attentionLesson(root, jest.fn());
  choose(root, 'Étape du calcul', 4);
  const baseline = root.querySelector('[role="img"]').getAttribute('aria-label');
  const input = field(root, 'Coordonnée 0');
  input.value = '1';
  input.dispatchEvent(new Event('input'));
  expect(root.querySelector('[role="img"]').getAttribute('aria-label')).not.toBe(baseline);
  choose(root, 'Tête observée', 1);
  expect(field(root, 'Tête observée').value).toBe('1');
});

test('la trace réelle se charge uniquement sur demande et expose BOS, blocs et quatre têtes', async () => {
  const root = document.createElement('div');
  const loader = jest.fn().mockResolvedValue(data);
  attentionLesson(root, loader);
  expect(loader).not.toHaveBeenCalled();
  choose(root, 'Calcul observé', 'luciole');
  await tick();
  expect(loader).toHaveBeenCalledTimes(1);
  expect(root.textContent).toContain('Vrais Q/K/V de Luciole');
  expect(field(root, 'Token qui consulte').options[0].textContent).toBe('0 · <bos>');
  expect(field(root, 'Tête observée').options).toHaveLength(4);
  expect(field(root, 'Bloc de Luciole').options).toHaveLength(2);
  choose(root, 'Bloc de Luciole', 1);
  choose(root, 'Tête observée', 3);
  choose(root, 'Étape du calcul', 6);
  expect(root.querySelectorAll('.vector-coordinate')).toHaveLength(32);
  expect(root.textContent).toContain('positions apprises');
  choose(root, 'Calcul observé', 'toy');
  expect(root.textContent).toContain('Exemple inventé');
  expect(root.querySelectorAll('.vector-coordinate')).toHaveLength(2);
});

test('une erreur de chargement réelle ne laisse aucune prédiction inventée et permet de réessayer', async () => {
  const root = document.createElement('div');
  const loader = jest.fn().mockRejectedValueOnce(new Error('Poids absents')).mockResolvedValue(data);
  attentionLesson(root, loader);
  choose(root, 'Calcul observé', 'luciole');
  await tick();
  expect(root.textContent).toContain('Trace indisponible : Poids absents');
  expect(root.querySelectorAll('.novice-lesson table')).toHaveLength(0);
  choose(root, 'Calcul observé', 'toy');
  choose(root, 'Calcul observé', 'luciole');
  await tick();
  expect(root.textContent).toContain('Vrais Q/K/V de Luciole');
});

test('changer de mode pendant le chargement ignore la réponse devenue obsolète', async () => {
  const root = document.createElement('div');
  let finish;
  attentionLesson(root, () => new Promise(resolve => { finish = resolve; }));
  choose(root, 'Calcul observé', 'luciole');
  choose(root, 'Calcul observé', 'toy');
  finish(data);
  await tick();
  expect(field(root, 'Calcul observé').value).toBe('toy');
  expect(root.textContent).toContain('Exemple inventé');
  expect(root.textContent).not.toContain('Vrais Q/K/V');
});

test('la trace cache est conceptuelle ; sa vérification lit les vrais K/V sans stocker de cache', async () => {
  const root = document.createElement('div');
  const loader = jest.fn().mockResolvedValue(data);
  cacheWalkthrough(root, loader);
  expect(loader).not.toHaveBeenCalled();
  expect(root.textContent).toContain('Animation conceptuelle');
  expect(root.textContent).toContain('Sans cache (Luciole)6');
  click(root, 'Passer à t');
  expect(root.textContent).toContain('Décodage · t');
  expect(root.textContent).toContain('Avec cache (conceptuel)28');
  expect(root.textContent).toContain('K / V réutilisés');
  click(root, 'Vérifier K/V dans Luciole (sans cache)');
  await tick();
  expect(loader).toHaveBeenCalledTimes(1);
  expect(root.textContent).toContain('Vraies projections K/V');
  expect(root.textContent).toContain('Oui · mêmes K et V');
  expect(root.textContent).toContain('aucun cache créé');
  click(root, 'Passer à t + 1');
  expect(root.textContent).toContain('Décodage · t + 1');
  expect(root.textContent).toContain('Avec cache (conceptuel)210');
  expect(root.textContent).not.toContain('Vraies projections K/V');
  expect([...root.querySelectorAll('button')].find(node => node.textContent === 'Passer à t + 1').disabled).toBe(true);
  click(root, 'Revenir au prefill');
  expect(root.textContent).toContain('Prefill');
});

test('la vérification cache affiche une erreur visible et réessayable', async () => {
  const root = document.createElement('div');
  cacheWalkthrough(root, () => Promise.reject(new Error('Poids absents')));
  click(root, 'Vérifier K/V dans Luciole (sans cache)');
  await tick();
  expect(root.textContent).toContain('Lecture impossible : Poids absents');
  expect(root.textContent).not.toContain('Vraies projections K/V');
});

test('les estimateurs de mémoire restent disponibles mais optionnels après le cache', () => {
  const root = document.createElement('div');
  conceptExperiments.memory(root);
  const estimate = root.querySelector('details');
  expect(estimate.open).toBe(false);
  expect(estimate.querySelector('summary').textContent).toContain('Facultatif');
  expect(root.textContent).toContain('Luciole n’a pas de KV cache');
  expect(root.querySelectorAll('input[type="range"]')).toHaveLength(2);
});
