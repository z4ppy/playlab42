import { lexicalPieces, decode } from './model.js';
import { el, panel, textField, button, tokens } from './dom.js';

export function lucioleTokenizer(model, corpus) {
  const root = panel('Le tokenizer exact de Luciole · lexical, pas BPE');
  root.classList.add('luciole-tokenizer');
  const natural = corpus.splits.train.filter(e => e.family === 'natural');
  const input = textField('Texte pour le tokenizer de Luciole', natural[0].text, true);
  const presets = el('div', 'button-row');
  for (const [code, label] of [['fra', 'Français CC0'], ['eng', 'Anglais CC0'], ['spa', 'Espagnol CC0']]) {
    const example = natural.find(e => e.language === code);
    presets.append(button(label, () => { input.input.value = example.text; render(); }));
  }
  presets.append(button('Tester un mot inconnu', () => { input.input.value = 'anticonstitutionnellement'; render(); }));
  const normalized = el('p', 'microcopy');
  const pieces = el('div');
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  const reconstruction = el('p', 'microcopy');
  const vocabulary = el('details');
  vocabulary.append(el('summary', '', `Voir les ${model.vocabulary.length} entrées du vocabulaire`),
    el('p', 'vocabulary', model.vocabulary.map((word, id) => `${id} : ${word}`).join(' · ')));
  const steps = el('ol', 'tokenizer-recipe');
  [
    'Normaliser en Unicode NFC et passer en minuscules. Les accents restent présents : « été » et « ete » restent différents.',
    'Regrouper les lettres et chiffres contigus. Chaque signe de ponctuation devient une pièce séparée : une apostrophe ou un trait d’union coupe le mot. Les espaces ne reçoivent pas d’identifiant.',
    'Chercher chaque pièce dans le vocabulaire construit uniquement à partir du lot d’apprentissage. Les identifiants sont des numéros de lignes, pas des significations.',
    'Ajouter <bos> (id 0) au début. <eos> (id 1) sert de cible de fin à l’entraînement et peut être généré ensuite ; il n’est pas ajouté au prompt.',
  ].forEach(text => steps.append(el('li', '', text)));
  root.append(
    el('p', 'microcopy', 'Même fonction de découpage que pendant le préentraînement et dans le laboratoire. Aucun apprentissage de sous-mots, aucune fusion BPE, aucun remplacement automatique par <unk>.'),
    steps, input.root, presets, normalized, pieces, status, reconstruction, vocabulary,
    el('p', 'microcopy', 'Limite assumée : voir trois langues pendant l’apprentissage ne rend pas ce vocabulaire universel. Un mot nouveau est refusé, même si toutes ses lettres sont connues. Le BPE pédagogique et les trois tokeniseurs publics du parcours sont des expériences distinctes.'),
  );
  function render() {
    const words = lexicalPieces(input.input.value);
    const ids = [0, ...words.map(word => model.vocabulary.indexOf(word))];
    const unknown = [...new Set(words.filter(word => !model.vocabulary.includes(word)))];
    normalized.textContent = `Texte normalisé : ${input.input.value.normalize('NFC').toLocaleLowerCase('fr') || '(vide)'}`;
    pieces.replaceChildren(tokens(['<bos>', ...words], ids.map(id => id < 0 ? 'inconnu' : id)));
    const invalid = unknown.length > 0 || ids.length > model.config.context;
    status.className = invalid ? 'error' : 'status';
    status.textContent = unknown.length
      ? `Inférence refusée : hors vocabulaire → ${unknown.join(', ')}. Aucun identifiant de remplacement n’est inventé.`
      : ids.length > model.config.context
        ? `Inférence refusée : ${ids.length} tokens, au-delà des ${model.config.context} positions disponibles.`
        : `${ids.length} tokens, début compris · identifiants acceptés par Luciole.`;
    reconstruction.textContent = unknown.length
      ? 'La reconstruction est indisponible tant que des pièces sont inconnues.'
      : `Reconstruction de lecture : « ${decode(ids, model.vocabulary)} ». Casse et espacements d’origine ne sont pas conservés ; ce tokenizer n’est pas réversible.`;
  }
  input.input.addEventListener('input', render);
  render();
  return root;
}
