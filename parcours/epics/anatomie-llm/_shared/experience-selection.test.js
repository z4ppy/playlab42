/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { choicePreferences, experienceKind, mountSelectedExperience } from './experience-selection.js';

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function click(root, label) {
  [...root.querySelectorAll('button')].find(node => node.textContent === label).click();
}
function setup(experiment, options = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const mounts = {
    mountLocal: jest.fn(target => { target.textContent = 'Résultat Luciole'; }),
    mountTokenizers: jest.fn(target => { target.textContent = 'Quatre vocabulaires'; }),
    ...options,
  };
  const session = mountSelectedExperience(root, { experiment, ...mounts });
  return { root, session, ...mounts };
}

beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });

test('les exemples conceptuels et les traces Luciole sont identifiés sans faux sélecteur', async () => {
  for (const experiment of ['rope', 'moe', 'scores', 'prompt', 'architecture', 'heads', 'memory', 'sampling']) {
    const { root, session } = setup(experiment);
    await tick();
    expect(experienceKind(experiment)).toBe('concept');
    expect(root.querySelector('select')).toBeNull();
    expect(root.textContent).toContain('Exemple pédagogique');
    expect(root.textContent).not.toContain('GPT-2');
    expect(root.textContent).toContain(experiment === 'heads' ? 'passage avant réel'
      : experiment === 'memory' ? 'Aucun cache n’est utilisé' : 'ne proviennent pas de l’exécution d’un modèle');
    session.destroy();
  }
});

test('les vues Luciole ignorent les anciens choix GPT-2', async () => {
  for (const experiment of ['generation', 'laboratory', 'modelCard', 'attention', 'embeddings', 'lens', 'training']) {
    choicePreferences(jest.fn(), undefined, experiment).save('model', 'gpt2');
    const { root, session, mountLocal } = setup(experiment);
    await tick();
    expect(root.querySelector('select, iframe')).toBeNull();
    expect(root.textContent).not.toContain('GPT-2');
    expect(root.textContent).toContain('Calcul actuel : Luciole');
    expect(root.textContent).toContain('Résultat Luciole');
    expect(mountLocal).toHaveBeenCalledTimes(1);
    session.destroy();
  }
});

test('le final propose uniquement le nouvel onglet, quels que soient les anciens choix', async () => {
  for (const model of ['luciole', 'gpt2']) {
    choicePreferences(jest.fn(), undefined, 'transformerExplainer').save('model', model);
    const { root, session, mountLocal, mountTokenizers } = setup('transformerExplainer');
    await tick();
    const link = root.querySelector('a');
    expect(link.textContent).toContain('nouvel onglet');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.href).toContain('/transformer-explainer/public/index.html');
    expect(root.querySelector('iframe, select, button')).toBeNull();
    expect(mountLocal).not.toHaveBeenCalled();
    expect(mountTokenizers).not.toHaveBeenCalled();
    expect(root.dataset.ready).toBe('true');
    session.destroy();
    expect(root.querySelector('a')).toBeNull();
  }
});

test('une réponse locale tardive ne remplace pas une expérience réinitialisée', async () => {
  let resolve;
  const delayed = new Promise(done => { resolve = done; });
  const destroy = jest.fn();
  const local = jest.fn().mockImplementationOnce(target => delayed.then(() => {
    target.textContent = 'Ancienne trace';
    return { destroy };
  })).mockImplementationOnce(target => { target.textContent = 'Nouvelle trace'; });
  const { root, session } = setup('attention', { mountLocal: local });
  click(root, 'Réinitialiser l’expérience');
  resolve();
  await tick();
  expect(root.textContent).toContain('Nouvelle trace');
  expect(root.textContent).not.toContain('Ancienne trace');
  expect(destroy).toHaveBeenCalledTimes(1);
  session.destroy();
});

test('quitter une expérience annule son montage et nettoie le résultat différé', async () => {
  let resolve;
  let signal;
  const delayed = new Promise(done => { resolve = done; });
  const destroy = jest.fn();
  const { root, session } = setup('generation', { mountLocal: (_root, options) => {
    signal = options.signal;
    return delayed;
  } });
  session.destroy();
  expect(signal.aborted).toBe(true);
  resolve({ destroy });
  await tick();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(root.querySelector('.experience-content').children).toHaveLength(0);
  expect(root.dataset.ready).toBeUndefined();
});

test('les erreurs restent visibles et une nouvelle tentative est possible', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const local = jest.fn().mockRejectedValueOnce(new Error('Poids locaux indisponibles'))
    .mockImplementationOnce(target => { target.textContent = 'Chargement réussi'; });
  const { root, session } = setup('attention', { mountLocal: local });
  await tick();
  expect(root.querySelector('[role="alert"]').textContent).toBe('Poids locaux indisponibles');
  click(root, 'Réessayer le chargement');
  await tick();
  expect(root.textContent).toContain('Chargement réussi');
  session.destroy();
  consoleError.mockRestore();
});

test('le tokenizer préserve les autres préférences, y compris les anciennes, sans prompt', () => {
  localStorage.setItem('preferences', JSON.stringify({ sound: false }));
  choicePreferences(jest.fn(), undefined, 'generation').save('model', 'gpt2');
  choicePreferences(jest.fn()).save('tokenizer', 't5');
  expect(JSON.parse(localStorage.getItem('preferences'))).toEqual({
    sound: false, llmChoice: { tokenizer: 't5', models: { generation: 'gpt2' } },
  });
  expect(choicePreferences(jest.fn()).read('tokenizer', 'luciole')).toBe('t5');
});

test('stockage bloqué : préférence du tokenizer utilisable en mémoire et final accessible', async () => {
  const storage = { getItem() { throw new Error('Stockage bloqué'); } };
  const notify = jest.fn();
  const preferences = choicePreferences(notify, storage);
  expect(preferences.read('tokenizer', 'luciole')).toBe('luciole');
  preferences.save('tokenizer', 'bert');
  expect(preferences.read('tokenizer', 'luciole')).toBe('bert');
  expect(notify).toHaveBeenCalled();
  const { root, session } = setup('transformerExplainer', { storage });
  await tick();
  expect(root.querySelector('a').target).toBe('_blank');
  session.destroy();
});

test('préférence inconnue ignorée avec avertissement', () => {
  localStorage.setItem('preferences', JSON.stringify({ llmChoice: { tokenizer: 'inconnu' } }));
  const notify = jest.fn();
  expect(choicePreferences(notify).read('tokenizer', 'luciole')).toBe('luciole');
  expect(notify).toHaveBeenCalledTimes(1);
});

test('la tokenisation ne monte aucun modèle et peut être réinitialisée', async () => {
  const { root, session, mountLocal, mountTokenizers } = setup('tokenizerCases');
  await tick();
  expect(mountTokenizers).toHaveBeenCalledTimes(1);
  expect(mountLocal).not.toHaveBeenCalled();
  click(root, 'Réinitialiser l’expérience');
  await tick();
  expect(mountTokenizers).toHaveBeenCalledTimes(2);
  session.destroy();
});

test('Luciole conserve les explications repliées dans la barre au-dessus du prompt', async () => {
  const { root, session } = setup('generation');
  await tick();
  const note = root.querySelector('.calculation-note');
  expect(note.parentElement).toBe(root.querySelector('.experience-choice'));
  expect(note.open).toBe(false);
  expect(note.textContent).toContain('Calcul actuel : Luciole');
  expect(root.querySelector('select')).toBeNull();
  session.destroy();
});
