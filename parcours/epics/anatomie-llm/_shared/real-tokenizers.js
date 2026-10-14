import { el, button, panel, tokens, showError, select, textField, range, metric } from './dom.js';
import { lexicalPieces, decode } from './model.js';
import { learnMerges, bpeTokens } from './tokenization.js';

export const tokenizerDefinitions = [
  { id: 'gpt2', name: 'GPT-2 · BPE sur octets', model: 'openai-community/gpt2', revision: '607a30d783dfa663caf39e06633721c8d4cfcd7e',
    note: 'Vocabulaire de GPT-2. Ġ représente un espace ; certains caractères internes représentent des octets, pas des lettres du texte original. Le texte peut être reconstruit exactement.' },
  { id: 'bert', name: 'BERT uncased · WordPiece', model: 'google-bert/bert-base-uncased', revision: '86b5e0934494bd15c9632b12f734a8a67f723594',
    note: 'BERT anglais : minuscules et suppression des accents. ## continue un mot ; [UNK] signale une unité inconnue. La reconstruction peut perdre de l’information.' },
  { id: 't5', name: 'T5 small · Unigram', model: 'google-t5/t5-small', revision: 'df1b051c49625cf57a3d0d8d3863ed4d13564fe4',
    note: 'Vocabulaire de T5 : ▁ marque une frontière de mot. Normalisation des espaces et de certains caractères ; <unk> signale une unité inconnue. Le texte reconstruit peut différer.' },
];

const loaded = new Map();

function loadTokenizer(id) {
  if (!loaded.has(id)) {
    const pending = Promise.all([
      import('../../../../assets/vendor/tokenizers/tokenizers.js'),
      ...['tokenizer.json', 'tokenizer_config.json'].map(async file => {
        const response = await fetch(new URL(`../assets/tokenizers/${id}/${file}`, import.meta.url));
        if (!response.ok) { throw new Error(`Définition ${id} indisponible (HTTP ${response.status}).`); }
        return response.json();
      }),
    ]).then(([{ Tokenizer }, definition, config]) => new Tokenizer(definition, config));
    loaded.set(id, pending);
    pending.catch(() => loaded.delete(id));
  }
  return loaded.get(id);
}

/** Comparaison indépendante des embeddings et des identifiants de Luciole. */
export function tokenizerComparison(readText) {
  const root = el('section', 'tokenizer-comparison');
  const grid = el('div', 'tokenizer-cards');
  const instances = new Map();
  const contents = new Map();
  const loadButton = button('Charger les 3 vrais tokeniseurs', async () => {
    loadButton.disabled = true;
    loadButton.textContent = 'Tokeniseurs locaux sélectionnés';
    await Promise.all(tokenizerDefinitions.map(definition => load(definition)));
  });
  root.append(el('h3', '', 'Même texte, trois vrais découpages'),
    el('p', 'microcopy', 'Calcul dans votre navigateur, avec les vocabulaires originaux. Aucun marqueur spécial n’est ajouté automatiquement. Les identifiants appartiennent à chaque modèle : ils ne sont pas compatibles avec les poids de Luciole.'),
    loadButton, grid);

  function render(definition) {
    const tokenizer = instances.get(definition.id);
    if (!tokenizer) { return; }
    const target = contents.get(definition.id);
    try {
      const input = readText();
      const encoded = tokenizer.encode(input, { add_special_tokens: false });
      const decoded = encoded.ids.length
        ? tokenizer.decode(encoded.ids, { skip_special_tokens: false, clean_up_tokenization_spaces: false })
        : '';
      const pieces = tokens(encoded.ids.map(id => tokenizer.id_to_token(id)), encoded.ids);
      pieces.tabIndex = 0;
      pieces.setAttribute('role', 'region');
      pieces.setAttribute('aria-label', `Pièces et identifiants : ${definition.name}`);
      target.replaceChildren(el('p', 'token-count', `${encoded.ids.length} tokens`),
        el('p', 'microcopy', definition.note),
        pieces,
        el('p', 'microcopy', decoded === input ? 'Reconstruction identique au texte saisi.' : 'Reconstruction différente : observez la normalisation ou les unités inconnues.'));
      const reconstruction = el('details');
      reconstruction.append(el('summary', '', 'Voir le texte reconstruit'), el('pre', 'serialized', decoded || '(texte vide)'));
      target.append(reconstruction);
      target.dataset.ready = 'true';
    } catch (error) {
      delete target.dataset.ready;
      target.replaceChildren();
      showError(target, error);
    }
  }
  async function load(definition) {
    const target = contents.get(definition.id);
    target.replaceChildren(el('p', 'microcopy', 'Chargement du vocabulaire local…'));
    try {
      instances.set(definition.id, await loadTokenizer(definition.id));
      render(definition);
    } catch (error) {
      target.replaceChildren();
      showError(target, error);
      target.append(button(`Réessayer ${definition.id}`, () => load(definition)));
    }
  }
  for (const definition of tokenizerDefinitions) {
    const card = panel(definition.name);
    card.dataset.tokenizer = definition.id;
    const content = el('div');
    contents.set(definition.id, content);
    content.append(el('p', 'microcopy', 'Le vocabulaire sera chargé depuis ce site, sans envoyer votre texte.'));
    card.append(content);
    grid.append(card);
  }
  return { root, update: () => tokenizerDefinitions.forEach(render) };
}

/** Le même texte pour quatre vocabulaires incompatibles, sans inférence de modèle. */
export async function realTokenizerExperience(root, { getModel, preferences, signal, cases = false, load = loadTokenizer }) {
  const text = textField('Texte à découper', cases
    ? 'Bonjour, le paiement a échoué deux fois. Peux-tu expliquer cette erreur et proposer une réponse au client ?'
    : 'la capitale de la france', true);
  const definitions = [{ id: 'luciole', name: 'Luciole · lexical' }, ...tokenizerDefinitions];
  const grid = el('div', 'tokenizer-cards');
  const mode = select('Tokenizer à observer ou comparer', [
    ...definitions.map(definition => ({ value: definition.id, label: definition.name })),
    { value: 'compare', label: 'Comparer les quatre tokenizers' },
  ], preferences.read('tokenizer', 'luciole'), () => {
    preferences.save('tokenizer', mode.input.value);
    render();
    mode.input.focus();
  });
  const toolbar = el('div', 'experience-choice');
  toolbar.append(mode.root);
  const help = el('details', 'calculation-note');
  help.append(el('summary', '', 'Ce qui est réellement calculé'),
    el('p', 'microcopy', 'Découpage du texte saisi avec les quatre définitions réelles, chargées localement à la sélection. Luciole ajoute <bos> comme à l’inférence ; GPT-2, BERT et T5 sont comparés sans ajout automatique de marqueurs spéciaux. Chaque identifiant appartient à son vocabulaire : aucun n’est injecté dans un autre modèle. Aucun poids GPT-2, BERT ou T5 n’est chargé, aucun texte n’est envoyé ni enregistré.'),
    el('p', 'microcopy', 'Limites : Luciole refuse les pièces hors vocabulaire, BERT normalise casse et accents, T5 peut normaliser les espaces ou produire <unk>. La taille de ces découpages n’est pas un benchmark de génération.'));
  const presets = el('div', 'button-row');
  [
    ['Français', 'la capitale de la france'], ['Anglais', 'the capital of france'],
    ['Accents et emojis', 'ÉTÉ, naïve, cœur, déjà vu 👩‍💻 🇫🇷'],
    ['Code JavaScript', 'const prixTTC = prixHT * 1.20;'],
    ['Message JSON', '{"role":"user","content":"Résume ce document."}'],
    ['Tester un mot inconnu', 'anticonstitutionnellement'],
  ].forEach(([label, value]) => presets.append(button(label, () => { text.input.value = value; render(); })));
  root.classList.add('real-tokenizer-choice');
  root.replaceChildren(toolbar, help, text.root, presets, grid);
  let disposed = false;
  let version = 0;
  let pedagogicalRender = () => {};
  const instances = new Map();
  let luciole;

  function renderLuciole(target, input, model) {
    const words = lexicalPieces(input);
    const ids = [0, ...words.map(word => model.vocabulary.indexOf(word))];
    const unknown = [...new Set(words.filter(word => !model.vocabulary.includes(word)))];
    target.append(el('p', 'token-count', `${ids.length} tokens (début compris)`),
      el('p', 'microcopy', 'NFC, minuscules, mots et ponctuation séparés ; espaces sans identifiant. <bos> ajouté, pas <eos>. Découpage identique à Luciole, pas BPE.'),
      tokens(['<bos>', ...words], ids.map(id => id < 0 ? 'inconnu' : id)));
    const status = el('p', unknown.length || ids.length > model.config.context ? 'error' : 'status', unknown.length
      ? `Inférence Luciole refusée : hors vocabulaire → ${unknown.join(', ')}. Aucun identifiant de remplacement n’est inventé.`
      : ids.length > model.config.context
        ? `Inférence Luciole refusée : ${ids.length} tokens dépassent le contexte de ${model.config.context}.`
        : 'Identifiants acceptés par Luciole. Aucune génération n’est exécutée ici.');
    status.setAttribute('role', 'status');
    target.append(status, el('p', 'microcopy', unknown.length
      ? 'Reconstruction indisponible pour les pièces inconnues.'
      : `Reconstruction de lecture : « ${decode(ids, model.vocabulary)} ». Casse et espacements d’origine ne sont pas conservés.`));
    const vocabulary = el('details');
    vocabulary.append(el('summary', '', `Voir les ${model.vocabulary.length} entrées du vocabulaire`),
      el('p', 'vocabulary', model.vocabulary.map((word, id) => `${id} : ${word}`).join(' · ')));
    target.append(vocabulary);
  }

  async function renderCard(definition, target, input, ticket) {
    try {
      if (definition.id === 'luciole') {
        luciole ||= await getModel();
        if (disposed || signal?.aborted || ticket !== version) { return; }
        target.replaceChildren();
        renderLuciole(target, input, luciole.model);
      } else {
        if (!instances.has(definition.id)) { instances.set(definition.id, await load(definition.id)); }
        if (disposed || signal?.aborted || ticket !== version) { return; }
        const tokenizer = instances.get(definition.id);
        const encoded = tokenizer.encode(input, { add_special_tokens: false });
        const decoded = encoded.ids.length
          ? tokenizer.decode(encoded.ids, { skip_special_tokens: false, clean_up_tokenization_spaces: false }) : '';
        const pieces = tokens(encoded.ids.map(id => tokenizer.id_to_token(id)), encoded.ids);
        pieces.tabIndex = 0;
        pieces.setAttribute('role', 'region');
        pieces.setAttribute('aria-label', `Pièces et identifiants : ${definition.name}`);
        target.replaceChildren(el('p', 'token-count', `${encoded.ids.length} tokens`),
          el('p', 'microcopy', definition.note), pieces,
          el('p', 'microcopy', decoded === input ? 'Reconstruction identique au texte saisi.' : 'Reconstruction différente : normalisation ou unités inconnues.'));
        const reconstruction = el('details');
        reconstruction.append(el('summary', '', 'Voir le texte reconstruit'), el('pre', 'serialized', decoded || '(texte vide)'));
        target.append(reconstruction);
      }
      target.dataset.ready = 'true';
    } catch (error) {
      if (disposed || signal?.aborted || ticket !== version) { return; }
      showError(target, error);
      target.append(button(`Réessayer ${definition.id}`, () => { render(); mode.input.focus(); }));
    }
  }
  function render() {
    if (disposed || signal?.aborted) { return; }
    const ticket = ++version;
    grid.replaceChildren();
    const input = text.input.value;
    const selected = mode.input.value;
    for (const definition of definitions.filter(item => selected === 'compare' || selected === item.id)) {
      const card = panel(definition.name);
      card.dataset.tokenizer = definition.id;
      const target = el('div');
      target.append(el('p', 'loading-note', 'Chargement du vocabulaire local…'));
      card.append(target);
      grid.append(card);
      renderCard(definition, target, input, ticket);
    }
    pedagogicalRender();
  }
  text.input.addEventListener('input', render);
  const destroy = () => {
    disposed = true;
    version++;
    text.input.removeEventListener('input', render);
    signal?.removeEventListener('abort', destroy);
  };
  signal?.addEventListener('abort', destroy, { once: true });
  render();

  if (!cases) {
    const section = el('section', 'instrument');
    section.append(el('h3', '', 'Exemple pédagogique · caractères, octets et fusions BPE'),
      el('p', 'microcopy', 'Comparaison indépendante du tokenizer sélectionné. Fusions apprises sur les 32 phrases initiales ; aucun identifiant de modèle ni poids appris n’est utilisé.'));
    const chart = el('div');
    root.append(section);
    try {
      const response = await fetch(new URL('../assets/corpus.json', import.meta.url), { signal });
      if (!response.ok) { throw new Error(`Corpus pédagogique indisponible (HTTP ${response.status}).`); }
      const corpus = await response.json();
      if (disposed || signal?.aborted) { return { destroy }; }
      const merges = learnMerges(corpus.splits.train.filter(item => item.family === 'original').map(item => item.text).join('\n'), 48);
      const count = range('Fusions BPE pédagogiques appliquées', 0, merges.length, merges.length, 1, () => pedagogicalRender());
      pedagogicalRender = () => {
        const input = text.input.value;
        const characters = Array.from(input);
        const bytes = [...new TextEncoder().encode(input)];
        const bpe = bpeTokens(input, merges.slice(0, Number(count.input.value)));
        const metrics = el('div', 'metric-row');
        metrics.append(metric(String(characters.length), 'points de code Unicode'), metric(String(bytes.length), 'octets UTF-8'),
          metric(String(bpe.length), 'tokens BPE pédagogique'));
        const charactersPanel = panel('Caractères Unicode');
        charactersPanel.append(tokens(characters), el('p', 'microcopy', 'Un caractère perçu peut combiner plusieurs points de code.'));
        const bpePanel = panel('BPE pédagogique · pas GPT-2');
        bpePanel.append(tokens(bpe), el('p', 'microcopy', '· représente un espace. Découpage réversible, sans conversion en minuscules.'));
        const panels = el('div', 'instrument-grid');
        panels.append(charactersPanel, bpePanel);
        chart.replaceChildren(metrics, panels);
      };
      section.append(count.root, chart);
      pedagogicalRender();
    } catch (error) {
      if (!disposed && !signal?.aborted) {
        const feedback = el('div');
        showError(feedback, error);
        section.append(feedback, button('Réessayer le corpus pédagogique', () => {
          destroy();
          realTokenizerExperience(root, { getModel, preferences, signal, cases, load });
        }));
      }
    }
  }
  return { destroy };
}
