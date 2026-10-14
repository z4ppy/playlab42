import { el, select, range, metric, panel, plot, svgNode, bars } from './dom.js';

const labels = { train: 'Apprentissage', validation: 'Validation', test: 'Test final' };
const families = { agreement: 'Accord est / sont', context: 'Objet dans deux boîtes' };
const percent = value => `${(value * 100).toFixed(1)} %`;

function scrollTable(table, label) {
  const region = el('div', 'matrix-scroll learning-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', label);
  region.append(table);
  return region;
}

export function trainingReplay(model, corpus) {
  const root = panel('Voir Luciole apprendre · historique enregistré');
  root.classList.add('training-replay');
  const history = model.meta.history;
  const examples = new Map(Object.values(corpus.splits).flat().map(e => [e.id, e]));
  const controls = el('div', 'controls');
  const snapshot = range('Instant du préentraînement', 0, history.length - 1, history.length - 1, 1, render);
  const probes = ['train', 'validation'].flatMap(split => Object.entries(history[0][split].tasks).flatMap(([family, task]) =>
    task.cases.slice(0, 4).map((record, i) => ({
      value: record.id, label: `${families[family]} · ${labels[split]} · exemple ${i + 1}`, split, family,
    }))));
  const probe = select('Exemple suivi pendant l’apprentissage', probes,
    probes.find(p => p.split === 'validation' && p.family === 'agreement').value, render);
  controls.append(snapshot.root, probe.root);
  const chart = plot('Pertes enregistrées : apprentissage en rose, validation en ambre. Valeurs exactes disponibles sous le graphique.', 640, 265);
  const summary = el('div', 'metric-row');
  const comparison = el('div', 'instrument-grid');
  const prompt = el('p', 'training-prompt');
  const explanation = el('p', 'microcopy');
  const values = el('details');
  const table = el('table', 'learning-table');
  const head = el('thead');
  const heading = el('tr');
  ['Mises à jour', 'Perte apprentissage', 'Perte validation'].forEach(text => {
    const th = el('th', '', text);
    th.scope = 'col';
    heading.append(th);
  });
  head.append(heading);
  const body = el('tbody');
  history.forEach(point => {
    const row = el('tr');
    [point.step, point.train.loss.toFixed(4), point.validation.loss.toFixed(4)].forEach(value => row.append(el('td', '', String(value))));
    body.append(row);
  });
  table.append(head, body);
  values.append(el('summary', '', 'Lire les valeurs exactes des courbes'), scrollTable(table, 'Valeurs des courbes, tableau défilable'));
  root.append(
    el('p', 'microcopy', 'Ce curseur relit des mesures sauvegardées, il ne lance aucun entraînement. Les exemples du parcours utilisent toujours les poids finaux, quel que soit l’instant choisi ici.'),
    el('p', 'microcopy', 'Deux résultats à distinguer : Luciole a appris l’accord simple « est / sont », mais ne retrouve pas correctement l’objet demandé dans les deux boîtes. Une prédiction incorrecte ci-dessous est une limite du modèle, pas une panne de l’application. Les scores complets et les échecs restent consultables sur sa fiche.'),
    chart,
    el('p', 'training-legend', 'Trait plein rose : apprentissage · pointillés ambre : validation · plus bas = moins d’erreur'),
    controls, summary, prompt, explanation, comparison, values,
    el('p', 'microcopy', `${model.meta.monitoring} La perte est exprimée en nats par token, moyennés par phrase ; ce n’est pas un pourcentage de réussite. Les mots et patrons des deux lots sont partagés, pas les combinaisons réservées.`),
  );
  function predictionPanel(title, record, example) {
    const view = panel(title);
    view.append(
      metric(record.prediction, 'token le plus probable'),
      el('p', 'status', record.prediction === example.target ? 'Prédiction correcte : le token attendu arrive en tête.' : `Prédiction incorrecte du modèle : le token attendu est « ${example.target} ».`),
      bars([{ label: `P(${example.target})`, value: record.targetProbability }]),
      el('p', 'microcopy', `Probabilité du token choisi : ${percent(record.probability)}. Comparaison sans tirage, à température 1.`),
    );
    return view;
  }
  function render() {
    const point = history[Number(snapshot.input.value)];
    snapshot.output.value = point.step.toLocaleString('fr-FR');
    snapshot.input.setAttribute('aria-valuetext', `${point.step} mises à jour des poids`);
    const max = Math.max(...history.flatMap(p => [p.train.loss, p.validation.loss])) * 1.05;
    const x = step => 50 + step / model.meta.steps * 560;
    const y = loss => 215 - loss / max * 180;
    chart.replaceChildren(svgNode('path', { d: 'M50 20V215H615', class: 'axis', fill: 'none' }));
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4;
      chart.append(svgNode('text', { x: 5, y: y(value) + 4 }, value.toFixed(1)));
    }
    for (const split of ['train', 'validation']) {
      chart.append(svgNode('polyline', {
        points: history.map(p => `${x(p.step)},${y(p[split].loss)}`).join(' '),
        class: split === 'train' ? 'curve' : 'curve validation-curve',
      }));
      chart.append(svgNode('circle', {
        cx: x(point.step), cy: y(point[split].loss), r: 5, class: split === 'train' ? 'dot' : 'selected-dot',
      }));
    }
    chart.append(svgNode('line', { x1: x(point.step), x2: x(point.step), y1: 20, y2: 215, class: 'checkpoint-line' }),
      svgNode('text', { x: 50, y: 245 }, '0'),
      svgNode('text', { x: 400, y: 245 }, `${model.meta.steps.toLocaleString('fr-FR')} mises à jour`));
    summary.replaceChildren(
      metric(point.step.toLocaleString('fr-FR'), 'mises à jour'),
      metric(point.train.loss.toFixed(3), 'perte apprentissage'),
      metric(point.validation.loss.toFixed(3), 'perte validation'),
    );
    const selected = probes.find(p => p.value === probe.input.value);
    const example = examples.get(selected.value);
    const before = history[0][selected.split].tasks[selected.family].cases.find(e => e.id === example.id);
    const after = point[selected.split].tasks[selected.family].cases.find(e => e.id === example.id);
    prompt.textContent = `« ${example.prompt} … » → attendu : ${example.target}`;
    explanation.textContent = selected.split === 'train'
      ? 'Exemple du lot utilisé pour ajuster les poids : réussir peut relever de la mémorisation.'
      : 'Combinaison réservée à la validation : jamais utilisée pour ajuster les poids. C’est une recombinaison du même petit univers, pas une question libre.';
    comparison.replaceChildren(predictionPanel('Avant · poids aléatoires', before, example),
      predictionPanel(`Après ${point.step.toLocaleString('fr-FR')} mises à jour`, after, example));
  }
  render();
  return root;
}

export function evaluationReport(report, corpus) {
  const root = panel('Généraliser un peu · sans extrapoler les résultats');
  root.classList.add('evaluation-report');
  root.append(el('p', 'microcopy', 'Le test final est resté hors de l’apprentissage et du suivi des courbes. Score = token attendu classé premier parmi tout le vocabulaire ; les prompts identiques ne sont comptés qu’une fois. Ce n’est pas un score de conversation, ni de génération de phrases complètes.'));
  for (const [family, title] of Object.entries(families)) {
    const section = panel(title);
    const table = el('table', 'learning-table');
    const caption = el('caption', '', family === 'agreement'
      ? 'Nouveaux couples sujet/lieu. Référence simple : toujours répondre « est ».'
      : 'Nouvelles paires d’objets, y compris en ordre inversé. Référence simple : répéter le dernier objet cité.');
    const head = el('thead');
    const headings = el('tr');
    ['Lot', 'Luciole', 'Référence simple'].forEach(text => {
      const th = el('th', '', text);
      th.scope = 'col';
      headings.append(th);
    });
    head.append(headings);
    const body = el('tbody');
    for (const split of ['train', 'validation', 'test']) {
      const task = report.splits[split].tasks[family];
      const row = el('tr');
      row.append(el('th', '', labels[split]),
        el('td', '', `${task.correct} / ${task.total} · ${percent(task.correct / task.total)}`),
        el('td', '', percent(task.baselineCorrect / task.total)));
      row.firstElementChild.scope = 'row';
      body.append(row);
    }
    table.append(caption, head, body);
    section.append(scrollTable(table, `${title} : scores, tableau défilable`));
    root.append(section);
  }
  const examples = new Map(corpus.splits.test.map(e => [e.id, e]));
  const records = Object.values(report.splits.test.tasks).flatMap(t => t.cases);
  const controls = el('div', 'controls');
  const filter = select('Résultats du test à explorer', [
    { value: 'all', label: 'Tous les cas' }, { value: 'wrong', label: 'Échecs uniquement' }, { value: 'right', label: 'Réussites uniquement' },
  ], 'all', populate);
  const choice = select('Cas inédit du test final', [], '', render);
  const detail = el('div', 'evaluation-case');
  controls.append(filter.root, choice.root);
  root.append(controls, detail,
    el('p', 'microcopy', 'Limites : patrons synthétiques courts, vocabulaire fermé, une seule graine. Les accords peuvent être résolus grâce à « le / les » ; les boîtes restent un exercice de restitution. Une réussite ne prouve ni maîtrise de la grammaire générale ni compréhension humaine.'),
    el('p', 'microcopy', report.method));
  function populate() {
    const selected = records.filter(record => {
      const correct = record.prediction === examples.get(record.id).target;
      return filter.input.value === 'all' || (filter.input.value === 'right' ? correct : !correct);
    });
    choice.input.replaceChildren(...selected.map((record, i) => {
      const option = el('option', '', `${i + 1} · ${families[examples.get(record.id).family]} · ${record.id}`);
      option.value = record.id;
      return option;
    }));
    choice.input.disabled = !selected.length;
    render();
  }
  function render() {
    const record = records.find(r => r.id === choice.input.value);
    if (!record) {
      detail.replaceChildren(el('p', 'status', 'Aucun cas dans ce filtre. Cela ne garantit rien au-delà de ce test fini.'));
      return;
    }
    const example = examples.get(record.id);
    detail.replaceChildren(
      el('p', 'training-prompt', `« ${example.prompt} … »`),
      el('p', 'status', `Attendu : ${example.target} · Luciole : ${record.prediction} · ${record.prediction === example.target ? 'Réussi' : 'Échec'}`),
      bars([{ label: `P(${example.target})`, value: record.targetProbability }]),
      el('p', 'microcopy', `Référence simple : ${example.baseline}. Cas ${example.id} ; paire réservée ${example.group}.`),
    );
  }
  populate();
  return root;
}
