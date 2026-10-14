import { SeededRandom } from '../../../../lib/seeded-random.js';
import { loadWeights, tokenize, forward, decode, logitLens } from './model.js';
import { softmax, distribution, sample } from './math.js';
import { embeddingAtlas } from './embedding-atlas.js';
import { trainingReplay, evaluationReport } from './training-history.js';
import { lucioleTokenizer } from './luciole-tokenizer.js';
import { el, button, select, range, textField, metric, panel, bars, tokens, vector, topTokens, showError } from './dom.js';

export const examples = [
  'la capitale de la france est',
  'la capitale de la belgique est',
  'la capitale du japon est',
  'le chat',
  'le modèle',
  'the capital of france is',
  'les chats près du jardin',
  'la boîte rouge contient un chat . la boîte bleue contient un livre . dans la boîte rouge il y a un',
];
let resource;

export function getModel() {
  if (!resource) {
    resource = fetch(new URL('../assets/model.json', import.meta.url)).then(async response => {
      if (!response.ok) { throw new Error(`Poids indisponibles (HTTP ${response.status}). Rechargez le paquet local puis réessayez.`); }
      const model = await response.json();
      return { model, weights: loadWeights(model) };
    }).catch(error => {
      resource = null;
      throw error;
    });
  }
  return resource;
}

function prediction(text, data) {
  const ids = tokenize(text, data.model.vocabulary);
  return { ids, ...forward(ids, data.weights, data.model.config) };
}

function attentionTable(map, vocabulary, ids, selected = ids.length - 1) {
  const wrapper = el('div', 'matrix-scroll');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Matrice d’attention défilable');
  const table = el('table', 'attention-matrix');
  table.style.minWidth = `${Math.max(280, ids.length * 48)}px`;
  table.append(el('caption', '', 'Ligne = requête · colonne = clé · valeurs en % · × = futur masqué'));
  const head = el('tr');
  head.append(el('th', '', 'Q ↓ K →'));
  ids.forEach(id => {
    const th = el('th', '', vocabulary[id]);
    th.scope = 'col';
    th.title = vocabulary[id];
    head.append(th);
  });
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const body = el('tbody');
  map.forEach((row, i) => {
    const tr = el('tr', i === selected ? 'selected' : '');
    const heading = el('th', '', vocabulary[ids[i]]);
    heading.scope = 'row';
    tr.append(heading);
    row.forEach((value, j) => {
      const td = el('td', j > i ? 'masked' : '');
      if (j > i) {
        td.textContent = '×';
      } else {
        const cell = el('div', '', String(Math.round(value * 100)));
        cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(value * 60)}%, var(--paper))`;
        cell.title = `${vocabulary[ids[i]]} → ${vocabulary[ids[j]]} : ${(value * 100).toFixed(2)} %`;
        td.append(cell);
      }
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(body);
  wrapper.append(table);
  return wrapper;
}

async function generation(root, laboratory = false) {
  const data = await getModel();
  const { model, weights } = data;
  let ids = tokenize(examples[0], model.vocabulary);
  let history = [];
  let rng = new SeededRandom(42);
  let stage = 0;
  let ended = false;
  let dirty = false;
  const controls = el('div', 'controls generation-controls');
  const example = select('Prompt d’exemple', examples, examples[0], () => {
    prompt.input.value = example.input.value;
    reset();
  });
  const prompt = textField('Votre prompt (vocabulaire du corpus)', examples[0]);
  const temperature = range('Température', 0, 1.8, laboratory ? 0.7 : 0, 0.1, render);
  const content = el('div');
  const error = el('div');
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  const resultText = el('div', 'generated-text');
  const chain = el('div', 'pipeline');
  const inspectionHelp = el('p', 'microcopy inspection-help', 'Inspectez un même calcul : ces onglets ne génèrent pas de token. Ils montrent les représentations internes, puis leur conversion en probabilités. Les candidats à droite restent donc identiques.');
  const stages = [
    ['Tokens', 'identifiants'], ['Vecteurs', `${model.config.dim} nombres / token`], ['Bloc 1', 'mélanger + transformer'], ['Bloc 2', 'mélanger + transformer'], ['Sortie', 'probabilités'],
  ];
  stages.forEach(([title, detail], i) => {
    const node = button(title, () => { stage = i; render(); });
    node.append(el('small', '', detail));
    chain.append(node);
  });
  const layer = select('Couche inspectée', [{ label: 'Bloc 1', value: 1 }, { label: 'Bloc 2', value: 2 }], 2, render);
  const head = select('Tête inspectée', Array.from({ length: model.config.heads }, (_, value) => ({ label: `Tête ${value + 1}`, value })), 0, render);
  const inspector = el('div');
  const advance = button('+ Un token', () => {
    if (dirty) { return; }
    if (ended || ids.length >= model.config.context) {
      if (!reset() || ids.length >= model.config.context) { return; }
    }
    const pass = forward(ids, weights, model.config);
    const probabilities = distribution(pass.logits.toRows().at(-1), Number(temperature.input.value));
    history.push({ ids: [...ids], seed: rng.getState(), ended });
    const next = sample(probabilities, rng);
    ids.push(next);
    ended = next === model.vocabulary.indexOf('<eos>');
    render();
  }, true);
  const back = button('← Revenir', () => {
    const previous = history.pop();
    if (!previous) { return; }
    ids = previous.ids;
    rng = SeededRandom.fromState(previous.seed);
    ended = previous.ended;
    render();
  });
  function reset() {
    try {
      const nextIds = tokenize(prompt.input.value, model.vocabulary);
      forward(nextIds, weights, model.config);
      ids = nextIds;
      history = [];
      rng = new SeededRandom(42);
      ended = false;
      dirty = false;
      error.replaceChildren();
      render();
      return true;
    } catch (failure) {
      dirty = true;
      advance.disabled = true;
      showError(error, failure);
      status.textContent = 'Prompt refusé. L’affichage conserve le dernier contexte valide, sans nouvelle prédiction.';
      return false;
    }
  }
  function render() {
    // Après EOS, conserver le calcul qui l'a choisi plutôt que prédire au-delà
    // d'une fin de séquence, position absente du corpus d'entraînement.
    const inspectedIds = ended ? ids.slice(0, -1) : ids;
    const pass = forward(inspectedIds, weights, model.config);
    const probabilities = distribution(pass.logits.toRows().at(-1), Number(temperature.input.value));
    const stopped = ended || ids.length >= model.config.context;
    const fullText = decode(ids, model.vocabulary);
    const initialText = decode(history[0]?.ids || ids, model.vocabulary);
    resultText.textContent = initialText;
    if (fullText.length > initialText.length) {
      resultText.append(el('mark', 'generated-continuation', fullText.slice(initialText.length)));
    }
    resultText.dataset.stopped = String(stopped);
    status.textContent = ended ? '<eos> signifie « fin de séquence » : le modèle a terminé. « Nouvelle génération » repart du prompt avec les réglages actuels et la graine 42.' :
      ids.length >= model.config.context ? `Fenêtre de ${model.config.context} tokens atteinte. Recommencez une génération ou appliquez un prompt plus court.` :
        `Contexte : ${ids.length} / ${model.config.context} tokens · Ajouts : ${history.length}`;
    advance.textContent = stopped ? 'Nouvelle génération' : '+ Un token';
    advance.disabled = dirty || Boolean(error.children.length) || (stopped && !history.length);
    if (dirty) { status.textContent = 'Le dernier contexte valide est affiché. Appliquez un prompt accepté avant de générer.'; }
    back.disabled = !history.length;
    [...chain.children].forEach((node, i) => node.setAttribute('aria-pressed', String(i === stage)));
    const tokenIds = tokens(ids.map(id => model.vocabulary[id]), ids);
    const probabilityPanel = panel(ended ? 'Décision de fin · contexte avant <eos>' : 'Le prochain token · candidats les plus probables');
    const initialProbabilities = softmax(pass.logits.toRows().at(-1));
    const initialFavorite = topTokens(initialProbabilities, model.vocabulary, 1)[0];
    probabilityPanel.append(bars(topTokens(probabilities, model.vocabulary)));
    probabilityPanel.append(el('p', 'microcopy initial-confidence', `Avant réglage de la température, le favori « ${initialFavorite.label} » reçoit ${(initialFavorite.value * 100).toFixed(1)} %. Les barres montrent la distribution utilisée pour choisir.`));
    probabilityPanel.append(el('p', 'microcopy', Number(temperature.input.value) === 0
      ? 'À température 0, la règle garde un seul candidat : les 100 % indiquent ce choix forcé, pas une certitude que la réponse est vraie.'
      : 'Probabilités après réglage de la température. Elles guident le tirage du prochain token, sans mesurer la vérité de la réponse.'));
    const initialDetails = el('details', 'initial-probabilities');
    initialDetails.open = root.querySelector('.initial-probabilities')?.open || false;
    initialDetails.append(el('summary', '', 'Comparer avec les probabilités avant réglage'), bars(topTokens(initialProbabilities, model.vocabulary)),
      el('p', 'microcopy', 'Softmax des scores du même passage avant, à température 1 et sans filtre. Ces probabilités ne mesurent pas la vérité des candidats.'));
    probabilityPanel.append(initialDetails);
    if (ended) {
      probabilityPanel.append(el('p', 'microcopy', 'Inspection du contexte qui a produit <eos>. Les réglages permettent de comparer sa distribution ; aucun token n’est ajouté après la fin.'));
    }
    const grid = el('div', 'instrument-grid');
    const inspectedToken = model.vocabulary[inspectedIds.at(-1)];
    const title = stage === 0 ? 'Tokens' : stage === 1 ? `Vecteur initial du token « ${inspectedToken} »` :
      stage === 4 ? `Sortie à partir du token « ${inspectedToken} »` : `Token « ${inspectedToken} » après le bloc ${stage - 1}`;
    const view = panel(title);
    if (ended && stage !== 0) {
      view.append(el('p', 'microcopy', 'Calcul conservé juste avant <eos> : on inspecte le dernier token qui a permis de prédire la fin, pas le marqueur <eos> lui-même.'));
    }
    if (stage === 0) {
      view.append(tokenIds, el('p', 'microcopy', 'Tokenisation lexicale : les mots et la ponctuation sont des unités. <bos> marque le début, <eos> la fin.'));
    } else if (stage === 1) {
      view.append(
        el('p', 'microcopy', `Un vecteur est une liste de nombres. Le modèle possède une table apprise pendant l’entraînement qui associe ${model.config.dim} nombres à chaque token : son embedding.`),
        el('p', 'microcopy', `${inspectedIds.length} tokens × ${model.config.dim} nombres dans ce contexte. Ici, on montre seulement le vecteur du dernier token, « ${inspectedToken} », avant ajout de sa position et avant prise en compte des autres tokens.`),
        vector(pass.traces[0].embedding.toRows().at(-1)),
        el('p', 'microcopy', 'Ces coordonnées n’ont pas chacune un sens simple comme « pays » ou « ponctuation ». C’est leur combinaison que le modèle utilise.'),
      );
    } else if (stage === 4) {
      view.append(el('p', 'microcopy', `Après les deux blocs, les ${model.config.dim} nombres du dernier token sont normalisés puis convertis en un score par token du vocabulaire. Softmax transforme ces scores en probabilités.`),
        bars(topTokens(softmax(pass.logits.toRows().at(-1)), model.vocabulary)), el('p', 'microcopy', 'Distribution brute à température 1. À droite, les réglages de décodage sont appliqués à ces mêmes scores.'));
    } else {
      const operations = el('ol', 'block-operations');
      operations.append(
        el('li', '', `Attention : ${model.config.heads} têtes calculent en parallèle des mélanges d’informations provenant de ce token et des tokens précédents.`),
        el('li', '', 'Transformation : un petit réseau de neurones (MLP) retravaille les nombres obtenus.'),
      );
      view.append(
        el('p', 'microcopy', stage === 2 ? 'Un bloc est une étape de traitement des vecteurs. Le bloc 1 reçoit les embeddings auxquels on a ajouté les positions.' :
          'Le bloc 2 reçoit les vecteurs déjà transformés par le bloc 1. Il répète les mêmes types d’opérations, avec ses propres paramètres appris.'),
        operations,
        el('p', 'microcopy', 'Le résultat de chaque opération est ajouté à son entrée : ce sont les connexions résiduelles.'),
        el('p', 'microcopy', `Contexte utilisé : « ${decode(inspectedIds, model.vocabulary)} ». Le graphique montre les ${model.config.dim} nombres du dernier token après ce bloc : ils dépendent maintenant aussi du contexte.`),
        vector(pass.traces[stage - 1].state.toRows().at(-1)),
      );
    }
    grid.append(view, probabilityPanel);
    content.replaceChildren(grid);
    if (laboratory) {
      inspector.replaceChildren(attentionTable(pass.traces[Number(layer.input.value)].attention[Number(head.input.value)], model.vocabulary, inspectedIds));
    }
  }
  controls.append(example.root, temperature.root);
  const buttons = el('div', 'button-row');
  buttons.append(advance, back, button('Réinitialiser', reset));
  root.replaceChildren(controls);
  if (laboratory) {
    const promptControls = el('div', 'controls');
    promptControls.append(prompt.root, button('Appliquer le prompt', reset));
    prompt.input.addEventListener('input', () => {
      dirty = true;
      advance.disabled = true;
      status.textContent = 'Prompt modifié : appliquez-le avant de générer.';
    });
    root.append(promptControls);
  }
  root.append(error, buttons, resultText, el('p', 'microcopy', 'Les tokens ajoutés sont surlignés. « Revenir » annule le dernier ajout.'), status, chain, inspectionHelp, content);
  if (laboratory) {
    const inspectControls = el('div', 'controls');
    inspectControls.append(layer.root, head.root);
    const details = el('details');
    details.open = true;
    details.append(el('summary', '', 'Ouvrir la matrice d’attention du même calcul'), inspectControls, inspector);
    const vocab = el('details');
    vocab.append(el('summary', '', 'Vocabulaire accepté et fiche du modèle'),
      el('p', 'microcopy', `${model.meta.parameters.toLocaleString('fr-FR')} paramètres · ${model.config.layers} blocs · dimension ${model.config.dim} · ${model.meta.counts.train} phrases d’apprentissage · aucun service distant`),
      el('p', 'vocabulary', model.vocabulary.filter(t => !t.startsWith('<')).join(' · ')));
    root.append(details, vocab);
  }
  root.append(el('p', 'microcopy', 'Inférence réelle de Luciole · modèle miniature entraîné, non généraliste · poids fixes · aucune API.'));
  render();
}

async function attentionExperiment(root) {
  const data = await getModel();
  const chart = el('div');
  const rowOutput = el('div');
  const controls = el('div', 'controls');
  const example = select('Contexte', examples, examples[0], () => { row.input.value = 0; row.output.value = '0'; render(); });
  const layer = select('Couche', [{ label: 'Bloc 1', value: 1 }, { label: 'Bloc 2', value: 2 }], 1, render);
  const head = select('Tête', Array.from({ length: data.model.config.heads }, (_, value) => ({ label: `Tête ${value + 1}`, value })), 0, render);
  const row = range('Position requête', 0, 6, 0, 1, render);
  function render() {
    const pass = prediction(example.input.value, data);
    row.input.max = pass.ids.length - 1;
    const position = Math.min(Number(row.input.value), pass.ids.length - 1);
    const map = pass.traces[Number(layer.input.value)].attention[Number(head.input.value)];
    chart.replaceChildren(attentionTable(map, data.model.vocabulary, pass.ids, position));
    rowOutput.replaceChildren(el('p', 'microcopy', `Requête : ${data.model.vocabulary[pass.ids[position]]} · somme de la ligne = ${map[position].reduce((s, p) => s + p, 0).toFixed(6)}`),
      bars(map[position].map((value, i) => ({ label: `${i} · ${data.model.vocabulary[pass.ids[i]]}`, value }))));
  }
  controls.append(example.root, layer.root, head.root, row.root);
  root.replaceChildren(controls, chart, rowOutput);
  render();
}

async function embeddings(root) {
  const { model, weights } = await getModel();
  const vocabulary = model.vocabulary.filter(t => !t.startsWith('<'));
  const controls = el('div', 'controls');
  const first = select('Premier token', vocabulary, 'paris', render);
  const second = select('Comparer avec', vocabulary, 'france', render);
  const chart = el('div');
  const rows = weights.token.toRows();
  const atlas = embeddingAtlas(rows, model.vocabulary, () => [first.input.value, second.input.value]);
  function render() {
    const a = rows[model.vocabulary.indexOf(first.input.value)];
    const b = rows[model.vocabulary.indexOf(second.input.value)];
    const cosine = a.reduce((sum, v, i) => sum + v * b[i], 0) /
      Math.sqrt(a.reduce((sum, v) => sum + v * v, 0) * b.reduce((sum, v) => sum + v * v, 0));
    const grid = el('div', 'instrument-grid');
    grid.classList.add('embedding-comparison');
    const dimensions = panel(`Les ${model.config.dim} nombres de chaque token`);
    dimensions.append(el('p', '', first.input.value), vector(a), el('p', '', second.input.value), vector(b),
      metric(cosine.toFixed(3), 'similarité cosinus'));
    const nearest = rows.map((v, id) => ({
      label: model.vocabulary[id],
      value: v.reduce((s, n, i) => s + n * a[i], 0) / Math.sqrt(v.reduce((s, n) => s + n * n, 0) * a.reduce((s, n) => s + n * n, 0)),
    })).filter(item => item.label !== first.input.value).sort((x, y) => y.value - x.value).slice(0, 4);
    dimensions.append(el('p', 'microcopy', `Voisins dans les ${model.config.dim} dimensions : ${nearest.map(n => `${n.label} (${n.value.toFixed(2)})`).join(' · ')}`));
    atlas.update();
    grid.append(dimensions, atlas.root);
    chart.replaceChildren(grid);
  }
  controls.append(first.root, second.root);
  root.replaceChildren(controls, chart);
  render();
}

async function lens(root) {
  const data = await getModel();
  const controls = el('div', 'controls');
  const example = select('Contexte', examples, 'le chat', render);
  const depth = range('Profondeur · 0 = entrée', 0, 2, 0, 1, render);
  const chart = el('div');
  function render() {
    const pass = prediction(example.input.value, data);
    const probabilities = softmax(logitLens(pass.traces[Number(depth.input.value)].state, data.weights));
    const visible = topTokens(probabilities, data.model.vocabulary);
    chart.replaceChildren(bars(visible),
      el('p', 'microcopy', `Les candidats affichés couvrent ${(visible.reduce((sum, item) => sum + item.value, 0) * 100).toFixed(1)} % de la distribution ; le reste se répartit sur les autres tokens. Aucun tirage ni filtre : température 1 à chaque profondeur.`),
      el('p', 'microcopy', 'Probabilités calculées avec la même normalisation finale et la même projection de sortie à chaque profondeur. « le chat » laisse plusieurs suites visibles ; la capitale de la France permet de comparer avec un cas où un candidat domine.'));
  }
  controls.append(example.root, depth.root);
  root.replaceChildren(controls, chart);
  render();
}

async function training(root) {
  const { model } = await getModel();
  const { corpus } = await learningResources();
  const phases = [
    ['Préentraînement', 'Luciole : prédiction du token suivant sur le corpus publié, rétropropagation et Adam. Les poids changent.'],
    ['Ajustement supervisé', 'Exemples d’instructions et réponses choisies. Étape possible pour un assistant, non réalisée pour Luciole.'],
    ['Préférences / récompenses', 'Optimisation selon des préférences ou des critères vérifiables. Plusieurs méthodes existent ; non réalisé pour Luciole.'],
    ['Évaluation', 'Combinaisons réservées et scores sur deux tâches synthétiques. La perte d’apprentissage seule ne suffit pas ; les tests ne prouvent pas une compréhension générale.'],
    ['Inférence', 'Poids fixés, nouveau contexte, calcul et décodage. C’est le mode du laboratoire.'],
  ];
  const phaseControls = el('div', 'button-row');
  const phaseText = el('p', 'status', phases[0][1]);
  phaseText.setAttribute('role', 'status');
  phases.forEach(([title, text], i) => {
    const node = button(title, () => {
      phaseText.textContent = text;
      [...phaseControls.children].forEach(child => child.setAttribute('aria-pressed', String(child === node)));
    });
    node.setAttribute('aria-pressed', String(i === 0));
    phaseControls.append(node);
  });
  root.replaceChildren(phaseControls, phaseText, trainingReplay(model, corpus));
}

async function learningResources() {
  const [corpus, evaluation, tatoeba] = await Promise.all(['corpus', 'evaluation', 'tatoeba'].map(async name => {
    const response = await fetch(new URL(`../assets/${name}.json`, import.meta.url));
    if (!response.ok) { throw new Error(`Ressource ${name} indisponible (HTTP ${response.status}).`); }
    return response.json();
  }));
  return { corpus, evaluation, tatoeba };
}

async function modelCard(root) {
  const { model } = await getModel();
  const { corpus, evaluation, tatoeba } = await learningResources();
  const summary = el('div', 'metric-row');
  summary.append(metric(model.meta.parameters.toLocaleString('fr-FR'), 'paramètres appris'),
    metric(String(corpus.splits.train.length), 'phrases d’apprentissage'),
    metric(model.meta.steps.toLocaleString('fr-FR'), 'mises à jour des poids'));
  const architecture = el('p', 'microcopy', `${model.config.layers} blocs · ${model.config.heads} têtes par bloc · ${model.config.dim} nombres par token · ${model.config.context} tokens de contexte · ${model.vocabulary.length} identifiants dans le vocabulaire, marqueurs compris.`);
  const samples = panel('Un corpus mixte, trois lots séparés');
  samples.append(el('p', 'microcopy', `${corpus.splits.train.length} phrases d’apprentissage · ${corpus.splits.validation.length} de validation · ${corpus.splits.test.length} de test final. ${corpus.meta.splitRule}`),
    el('p', 'microcopy', 'Les 32 phrases initiales sont conservées. Des patrons originaux produisent les accords et les exercices de boîtes. Tatoeba ajoute 40 phrases naturelles sous CC0 : 16 françaises, 16 anglaises et 8 espagnoles. Ce petit échantillon n’est ni un corpus de traduction aligné ni un test de maîtrise des trois langues.'));
  const all = el('details');
  all.append(el('summary', '', 'Voir des extraits des trois lots'));
  const splitLabels = { train: 'Apprentissage', validation: 'Validation', test: 'Test final' };
  const familyLabels = { original: 'phrase originale', natural: 'Tatoeba CC0', agreement: 'accord simple', context: 'deux boîtes' };
  for (const [split, examples] of Object.entries(corpus.splits)) {
    all.append(el('h4', '', `${splitLabels[split]} · ${examples.length} phrases`));
    const list = el('ul');
    for (const family of ['original', 'natural', 'agreement', 'context']) {
      examples.filter(e => e.family === family).slice(0, 2).forEach(example => list.append(el('li', '', `${example.text} (${familyLabels[family]})`)));
    }
    all.append(list);
  }
  samples.append(all);
  const natural = el('details');
  natural.append(el('summary', '', 'Lire les 40 phrases Tatoeba et leurs sources'));
  const list = el('ol');
  tatoeba.sentences.forEach(sentence => {
    const item = el('li', '', `${sentence.language} · ${sentence.text} `);
    const link = el('a', '', `Tatoeba #${sentence.id} · CC0`);
    link.href = sentence.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    list.append(item);
  });
  natural.append(list, el('p', 'microcopy', tatoeba.meta.attribution));
  samples.append(natural);
  const measurement = el('p', 'microcopy', `Perte finale sur le lot complet d’apprentissage : ${model.meta.trainingLoss.toFixed(4)} nats par token, moyennée par phrase. Les courbes suivent des sous-ensembles fixes ; leurs dernières valeurs peuvent donc différer de cette mesure.`);
  const training = el('p', 'microcopy', 'À chaque mise à jour, une phrase est choisie dans le lot d’apprentissage. Le modèle prédit les tokens suivants, puis son erreur sert à ajuster les poids. Ce préentraînement a déjà été effectué avant publication. Ici, vous observez son histoire : ni les curseurs ni vos prompts ne réentraînent le réseau.');
  const settings = el('details');
  settings.append(el('summary', '', 'Réglages pour reproduire l’entraînement'),
    el('p', 'microcopy', `${model.meta.optimizer}. Graine : ${model.meta.seed}. ${model.meta.sampling} Adam est la règle de mise à jour ; le clipping limite chaque composante du gradient à ±1. Les mots du vocabulaire viennent uniquement de l’apprentissage. Les lots réservés ne servent jamais à calculer un gradient.`));
  const links = el('p', 'microcopy');
  [['corpus.json', 'Corpus et lots'], ['tatoeba.json', 'Sources CC0 et empreintes'], ['model.json', 'Poids et historique'], ['evaluation.json', 'Résultats complets']].forEach(([file, label]) => {
    const link = el('a', '', label);
    link.href = new URL(`../assets/${file}`, import.meta.url).href;
    links.append(link, document.createTextNode(' · '));
  });
  root.replaceChildren(summary, architecture, training, trainingReplay(model, corpus),
    evaluationReport(evaluation, corpus), samples, lucioleTokenizer(model, corpus), settings, measurement, links);
}

export const modelExperiments = {
  modelCard,
  generation,
  laboratory: root => generation(root, true),
  attention: attentionExperiment,
  embeddings,
  lens,
  training,
};
