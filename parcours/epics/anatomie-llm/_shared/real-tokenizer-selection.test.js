/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { TextEncoder } from 'node:util';
import { realTokenizerExperience } from './real-tokenizers.js';
import { choicePreferences, mountSelectedExperience } from './experience-selection.js';

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const model = { vocabulary: ['<bos>', '<eos>', 'la', 'capitale', 'de', 'france', 'est'], config: { context: 32 } };
function fakeTokenizer(id) {
  return {
    encode: jest.fn(input => ({ ids: input ? [id === 'gpt2' ? 101 : id === 'bert' ? 202 : 303] : [] })),
    decode: jest.fn(() => 'la capitale de la france'),
    id_to_token: jest.fn(() => `${id}-pièce`),
  };
}
async function setup(options = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const getModel = jest.fn(() => Promise.resolve({ model }));
  const instances = Object.fromEntries(['gpt2', 'bert', 't5'].map(id => [id, fakeTokenizer(id)]));
  const load = jest.fn(id => Promise.resolve(instances[id]));
  const abort = new AbortController();
  const session = await realTokenizerExperience(root, {
    getModel, preferences: choicePreferences(jest.fn()), cases: true, signal: abort.signal, load, ...options,
  });
  await tick();
  return { root, session, getModel, load, instances, abort };
}
async function choose(root, value) {
  const mode = root.querySelector('select');
  mode.value = value;
  mode.dispatchEvent(new Event('change'));
  await tick();
}

beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });

test('un seul sélecteur propose quatre vocabulaires et la comparaison explicite', async () => {
  const { root, session, load } = await setup();
  expect(root.querySelectorAll('select')).toHaveLength(1);
  expect([...root.querySelectorAll('option')].map(option => option.value)).toEqual(['luciole', 'gpt2', 'bert', 't5', 'compare']);
  expect(root.querySelector('label').htmlFor).toBe(root.querySelector('select').id);
  expect(root.querySelectorAll('[data-tokenizer]')).toHaveLength(1);
  expect(root.querySelector('[data-tokenizer]').dataset.tokenizer).toBe('luciole');
  expect(root.textContent).toContain('Ce qui est réellement calculé');
  expect(load).not.toHaveBeenCalled();
  session.destroy();
});

test('la comparaison découpe le même texte sans rendre les identifiants compatibles', async () => {
  const { root, session, instances, load } = await setup();
  const input = root.querySelector('textarea');
  input.value = 'la capitale de la france';
  input.dispatchEvent(new Event('input'));
  await choose(root, 'compare');
  expect(root.querySelectorAll('[data-tokenizer]')).toHaveLength(4);
  expect(load.mock.calls.map(call => call[0])).toEqual(['gpt2', 'bert', 't5']);
  for (const tokenizer of Object.values(instances)) {
    expect(tokenizer.encode).toHaveBeenLastCalledWith(input.value, { add_special_tokens: false });
    expect(tokenizer.decode).toHaveBeenLastCalledWith(expect.any(Array), {
      skip_special_tokens: false, clean_up_tokenization_spaces: false,
    });
  }
  expect(root.querySelector('[data-tokenizer="luciole"]').textContent).toContain('<bos>');
  expect(root.textContent).toContain('Chaque identifiant appartient à son vocabulaire');
  input.value = '';
  input.dispatchEvent(new Event('input'));
  await tick();
  for (const id of ['gpt2', 'bert', 't5']) {
    expect(root.querySelector(`[data-tokenizer="${id}"]`).textContent).toContain('0 tokens');
  }
  expect(JSON.stringify(localStorage.getItem('preferences'))).not.toContain('capitale');
  session.destroy();
});

test('Luciole conserve la normalisation réelle et refuse les mots inconnus sans inventer d’ID', async () => {
  const { root, session } = await setup();
  const input = root.querySelector('textarea');
  input.value = 'LA FRANCE anticonstitutionnellement';
  input.dispatchEvent(new Event('input'));
  await tick();
  const card = root.querySelector('[data-tokenizer="luciole"]');
  expect(card.textContent).toContain('hors vocabulaire → anticonstitutionnellement');
  expect(card.textContent).toContain('id inconnu');
  expect(card.textContent).toContain('id 2');
  expect(card.textContent).toContain('id 5');
  expect(card.textContent).toContain('Reconstruction indisponible');
  session.destroy();
});

test('la sélection BERT reste indépendante du modèle GPT-2', async () => {
  const preferences = choicePreferences(jest.fn());
  preferences.save('model', 'gpt2');
  preferences.save('tokenizer', 'bert');
  const { root, session, getModel, load } = await setup({ preferences });
  expect(root.querySelector('select').value).toBe('bert');
  expect(load).toHaveBeenCalledWith('bert');
  expect(getModel).not.toHaveBeenCalled();
  expect(preferences.read('model', 'luciole')).toBe('gpt2');
  session.destroy();
});

test('un chargement tardif ne réaffiche pas le tokenizer précédent', async () => {
  let resolve;
  const delayed = new Promise(yes => { resolve = yes; });
  const { root, session } = await setup({ load: id => id === 'gpt2' ? delayed : Promise.resolve(fakeTokenizer(id)) });
  await choose(root, 'gpt2');
  await choose(root, 'bert');
  resolve(fakeTokenizer('gpt2'));
  await tick();
  expect(root.querySelectorAll('[data-tokenizer]')).toHaveLength(1);
  expect(root.querySelector('[data-tokenizer]').dataset.tokenizer).toBe('bert');
  expect(root.textContent).not.toContain('gpt2-pièce');
  session.destroy();
});

test('une définition indisponible est visible et peut être rechargée', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const load = jest.fn().mockRejectedValueOnce(new Error('Définition T5 indisponible'))
    .mockResolvedValueOnce(fakeTokenizer('t5'));
  const { root, session } = await setup({ load });
  await choose(root, 't5');
  expect(root.querySelector('[role="alert"]').textContent).toBe('Définition T5 indisponible');
  [...root.querySelectorAll('button')].find(node => node.textContent === 'Réessayer t5').click();
  await tick();
  expect(root.querySelector('[data-tokenizer="t5"]').textContent).toContain('t5-pièce');
  expect(root.querySelector('[role="alert"]')).toBeNull();
  session.destroy();
  consoleError.mockRestore();
});

test('une annulation empêche le rendu des résultats différés', async () => {
  let resolve;
  const delayed = new Promise(yes => { resolve = yes; });
  const { root, session, abort } = await setup({ load: () => delayed });
  await choose(root, 'gpt2');
  abort.abort();
  resolve(fakeTokenizer('gpt2'));
  await tick();
  expect(root.textContent).not.toContain('gpt2-pièce');
  session.destroy();
});

test('le BPE inventé reste séparé des quatre vrais tokenizers et conserve ses réglages', async () => {
  const previousFetch = globalThis.fetch;
  const previousEncoder = globalThis.TextEncoder;
  globalThis.TextEncoder = TextEncoder;
  globalThis.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ splits: { train: [{ family: 'original', text: 'la capitale de la france' }] } }),
  }));
  try {
    const { root, session } = await setup({ cases: false });
    expect(root.querySelectorAll('select')).toHaveLength(1);
    expect(root.textContent).toContain('Exemple pédagogique · caractères, octets et fusions BPE');
    const count = root.querySelector('input[type="range"]');
    count.value = '0';
    count.dispatchEvent(new Event('input'));
    expect(root.textContent).toContain('points de code Unicode');
    expect(root.textContent).toContain('octets UTF-8');
    await choose(root, 't5');
    expect(count.value).toBe('0');
    expect(root.textContent).toContain('BPE pédagogique · pas GPT-2');
    session.destroy();
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.TextEncoder = previousEncoder;
  }
});

test('le reset du chapitre restaure texte et BPE, conserve le tokenizer choisi et son focus', async () => {
  const previousFetch = globalThis.fetch;
  const previousEncoder = globalThis.TextEncoder;
  globalThis.TextEncoder = TextEncoder;
  globalThis.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ splits: { train: [{ family: 'original', text: 'la capitale de la france' }] } }),
  }));
  const root = document.createElement('div');
  document.body.append(root);
  const session = mountSelectedExperience(root, {
    experiment: 'tokenizer',
    mountTokenizers: (target, { preferences, signal }) => realTokenizerExperience(target, {
      preferences, signal, getModel: () => Promise.resolve({ model }), load: id => Promise.resolve(fakeTokenizer(id)),
    }),
  });
  try {
    await tick(); await tick();
    await choose(root, 'bert');
    root.querySelector('textarea').value = 'Texte personnel différent';
    root.querySelector('textarea').dispatchEvent(new Event('input'));
    const count = root.querySelector('input[type="range"]');
    count.value = '0';
    count.dispatchEvent(new Event('input'));
    [...root.querySelectorAll('button')].find(node => node.textContent === 'Réinitialiser l’expérience').click();
    await tick(); await tick();
    expect(root.querySelector('textarea').value).toBe('la capitale de la france');
    expect(root.querySelector('select').value).toBe('bert');
    const restoredCount = root.querySelector('input[type="range"]');
    expect(restoredCount.value).toBe(restoredCount.max);
    expect(Number(restoredCount.value)).toBeGreaterThan(0);
    expect(document.activeElement).toBe(root.querySelector('select'));
  } finally {
    session.destroy();
    globalThis.fetch = previousFetch;
    globalThis.TextEncoder = previousEncoder;
  }
});
