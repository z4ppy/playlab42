import { el, button, select, range, panel, vector, bars } from './dom.js';
import { tokenize, forward } from './model.js';
import { novicePrompt, toyAttention, lucioleAttention, cacheFrame } from './novice-attention.js';

const stepNames = ['Projections Q / K / V', 'Produits et scores', 'Masquer le futur', 'Softmax : poids du mélange', 'Somme pondérée des V', 'Réunir les têtes', 'Projection de sortie'];
const list = values => `[${values.map(value => Number.isFinite(value) ? value.toFixed(3) : '−∞').join(' ; ')}]`;

function details(title, ...content) {
  const node = el('details', 'novice-detail');
  node.append(el('summary', '', title), ...content);
  return node;
}

function table(headers, rows, caption) {
  const wrapper = el('div', 'matrix-scroll novice-table');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', caption);
  const node = el('table', 'number-matrix');
  const head = el('thead');
  const heading = el('tr');
  headers.forEach(text => {
    const cell = el('th', '', text);
    cell.scope = 'col';
    heading.append(cell);
  });
  head.append(heading);
  const body = el('tbody');
  rows.forEach(values => {
    const row = el('tr');
    values.forEach((text, i) => {
      const cell = el(i === 0 ? 'th' : 'td', '', String(text));
      if (i === 0) { cell.scope = 'row'; }
      row.append(cell);
    });
    body.append(row);
  });
  node.append(el('caption', '', caption), head, body);
  wrapper.append(node);
  return wrapper;
}

/** Parcours manipulable des mêmes sept opérations, sur exemple puis sur vrais tenseurs. */
export function attentionLesson(root, loadModel) {
  let data = null;
  let observed = null;
  let actual = false;
  let layer = 0;
  let head = 0;
  let query = 1;
  let stage = 0;
  let coordinate = 0;
  let request = 0;
  const controls = el('div', 'controls');
  const chart = el('div', 'novice-lesson');
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  const mode = select('Calcul observé', [
    { label: 'Petit exemple inventé', value: 'toy' },
    { label: `Vraie trace Luciole · ${novicePrompt}`, value: 'luciole' },
  ], 'toy', async () => {
    const current = ++request;
    actual = mode.input.value === 'luciole';
    if (actual) {
      chart.replaceChildren();
      controls.replaceChildren();
      status.textContent = 'Chargement des poids fixes de Luciole…';
      try {
        data = await loadModel();
        if (current !== request) { return; }
        const ids = tokenize(novicePrompt, data.model.vocabulary);
        observed = { ...forward(ids, data.weights, data.model.config), words: ids.map(id => data.model.vocabulary[id]) };
        query = 2;
        layer = 0;
        head = 0;
        status.textContent = 'Trace réelle chargée. Aucun entraînement ; aucun poids modifié.';
      } catch (error) {
        if (current !== request) { return; }
        status.textContent = `Trace indisponible : ${error.message}. Revenez à l’exemple puis sélectionnez Luciole pour réessayer.`;
        chart.replaceChildren();
        return;
      }
    } else {
      query = 1;
      head = 0;
      status.textContent = 'Exemple inventé, distinct de Luciole.';
    }
    rebuildControls();
    render();
  });
  function getTrace() {
    return actual
      ? lucioleAttention(observed, data.weights, data.model.config, observed.words, layer, head, query)
      : toyAttention(query, head, coordinate);
  }
  function rebuildControls() {
    const words = actual ? observed.words : ['le', 'chat', 'dort'];
    const token = select('Token qui consulte les autres', words.map((word, i) => ({ label: `${i} · ${word}`, value: i })), query, () => {
      query = Number(token.input.value);
      render();
    });
    const selectedHead = select('Tête observée', Array.from({ length: actual ? data.model.config.heads : 2 }, (_, i) => ({ label: `Tête ${i + 1}`, value: i })), head, () => {
      head = Number(selectedHead.input.value);
      render();
    });
    controls.replaceChildren(token.root, selectedHead.root);
    if (actual) {
      const block = select('Bloc de Luciole', Array.from({ length: data.model.config.layers }, (_, i) => ({ label: `Bloc ${i + 1}`, value: i })), layer, () => {
        layer = Number(block.input.value);
        render();
      });
      controls.append(block.root);
    } else {
      const input = range('Coordonnée 0 de « chat »', -2, 2, coordinate, 0.5, value => {
        coordinate = value;
        render();
      });
      controls.append(input.root);
    }
    const step = select('Étape du calcul', stepNames.map((name, i) => ({ label: `${i + 1} · ${name}`, value: i })), stage, () => {
      stage = Number(step.input.value);
      render();
    });
    const next = button('Étape suivante', () => {
      stage++;
      rebuildControls();
      render();
    });
    next.disabled = stage === stepNames.length - 1;
    const reset = button('Recommencer les étapes', () => {
      stage = 0;
      query = actual ? 2 : 1;
      head = 0;
      layer = 0;
      coordinate = 0;
      rebuildControls();
      render();
    });
    controls.append(step.root, next, reset);
  }
  function render() {
    const trace = getTrace();
    const current = trace.words[query];
    const content = panel(`${stage + 1} · ${stepNames[stage]}`);
    const q = trace.q[query];
    if (stage === 0) {
      content.append(el('p', '', `Pour « ${current} », on transforme la même liste de nombres trois fois avec trois matrices différentes. Q compare, K est comparé, V apporte les nombres à mélanger. Aucune question en français n’est écrite dans Q.`),
        table(['Token', 'Q', 'K', 'V'], trace.words.map((word, i) => [word, list(trace.q[i]), list(trace.k[i]), list(trace.v[i])]), 'Trois projections de chaque token'),
        details('Facultatif · entrée, matrices et une multiplication',
          el('p', '', `Entrée de « ${current} » : ${list(trace.input[query])}. Dans Luciole, cette entrée est normalisée et dépend du bloc choisi.`),
          el('p', 'formula', `Q[0] = ${trace.input[query].map((value, i) => `${value.toFixed(3)} × ${trace.matrices.q[i][0].toFixed(3)}`).join(' + ')} = ${q[0].toFixed(3)}`),
          ...['q', 'k', 'v'].map(name => table(['Ligne', 'Coefficients'], trace.matrices[name].map((row, i) => [i, list(row)]), `Matrice W${name.toUpperCase()} · coefficients ${actual ? 'appris' : 'inventés'}`))));
    } else if (stage === 1) {
      content.append(el('p', '', `On compare Q de « ${current} » à chaque K : multiplier les coordonnées correspondantes, additionner, puis diviser par √${trace.width}. Un score n’est pas une probabilité.`),
        table(['Clé', 'Somme Q · K', `Score / √${trace.width}`], trace.words.map((word, i) => [word, trace.dots[i].toFixed(3), trace.scores[i].toFixed(3)]), 'Scores avant le masque'),
        details('Facultatif · les produits coordonnée par coordonnée',
          ...trace.words.map((word, i) => el('p', 'formula', `${current} → ${word} : ${trace.products[i].map(value => value.toFixed(3)).join(' + ')} = ${trace.dots[i].toFixed(3)}`))));
    } else if (stage === 2) {
      content.append(el('p', '', `« ${current} » peut consulter sa propre position et celles d’avant, mais pas la suite. Choisissez « chat » : « dort » doit être interdit, même si son score est grand.`),
        table(['Position', 'Score avant', 'Après masque'], trace.words.map((word, i) => [word, trace.scores[i].toFixed(3), i > query ? '× · futur interdit (−∞)' : trace.masked[i].toFixed(3)]), 'Le masque ne met pas un score futur à zéro : il l’exclut'));
    } else if (stage === 3) {
      content.append(el('p', '', 'Softmax convertit les scores autorisés en poids positifs ; leur somme vaut 1. Le futur reçoit exactement 0. Ces poids servent à mélanger V, pas à tirer un prochain mot.'),
        bars(trace.probabilities.map((value, i) => ({ label: trace.words[i], value }))),
        el('p', 'status', `Somme des poids : ${trace.probabilities.reduce((sum, value) => sum + value, 0).toFixed(6)}`),
        details('Facultatif · formule stable',
          el('p', 'formula', 'poidsᵢ = exp(scoreᵢ − maximum autorisé) / somme des exp(scores autorisés − maximum)')));
    } else if (stage === 4) {
      content.append(el('p', '', 'Chaque V est multiplié par son poids. Puis on additionne les contributions, colonne par colonne. Le résultat est une nouvelle liste de nombres.'),
        table(['Token', 'Poids × V', 'Contribution'], trace.words.map((word, i) => [word, `${trace.probabilities[i].toFixed(3)} × ${list(trace.v[i])}`, list(trace.contributions[i])]), 'Somme pondérée des valeurs'),
        el('p', 'formula', `Résultat de la tête : ${list(trace.mixture)}`), vector(trace.mixture));
    } else if (stage === 5) {
      content.append(el('p', '', `${trace.heads} têtes calculent en parallèle leurs propres mélanges. On met les résultats bout à bout, sans les additionner : ${trace.heads} × ${trace.width} = ${trace.concatenated.length} nombres. Une tête n’est pas un petit assistant.`),
        table(['Tête', 'Résultat'], Array.from({ length: trace.heads }, (_, h) => [h + 1, list(trace.concatenated.slice(h * trace.width, (h + 1) * trace.width))]), 'Concaténation des têtes'),
        vector(trace.concatenated));
    } else {
      content.append(el('p', '', `Une dernière matrice ${actual ? 'apprise' : 'inventée ici, apprise dans Luciole'} transforme les nombres réunis. C’est la sortie de l’attention, pas encore un token ni la sortie du MLP. Luciole ajoute cette sortie à l’entrée du sous-bloc : le résidu.`),
        vector(trace.output),
        details('Facultatif · première coordonnée de sortie',
          el('p', 'formula', `${trace.concatenated.map((value, i) => `${value.toFixed(3)} × ${trace.outputMatrix[i][0].toFixed(3)}`).join(' + ')} = ${trace.output[0].toFixed(3)}`)));
    }
    chart.replaceChildren(el('p', 'microcopy', trace.source), content,
      el('p', 'microcopy', 'Les nombres affichés sont arrondis ; les calculs utilisent toutes les coordonnées. Analogie : Q demande, K propose, V apporte. Ce ne sont ni des intentions ni une recherche dans une base de connaissances.'));
    // Les boutons et options restent synchronisés après une sélection directe d'étape.
    const next = [...controls.querySelectorAll('button')].find(node => node.textContent === 'Étape suivante');
    if (next) { next.disabled = stage === stepNames.length - 1; }
  }
  root.replaceChildren(el('p', '', '1. Gardez « chat ». 2. Avancez étape par étape. 3. Changez une coordonnée, une tête ou le token. 4. Comparez ensuite avec les vrais nombres de Luciole.'), mode.root, controls, status, chart);
  rebuildControls();
  render();
}

/** Animation conceptuelle du cache ; l'API réelle ne fait que relire des passages sans cache. */
export function cacheWalkthrough(root, loadModel) {
  let step = 0;
  let request = 0;
  const controls = el('div', 'button-row');
  const chart = el('div', 'novice-lesson');
  const actual = el('div');
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  const next = button('Passer à t', () => {
    step++;
    request++;
    actual.replaceChildren();
    status.textContent = '';
    render();
  });
  const reset = button('Revenir au prefill', () => {
    step = 0;
    request++;
    actual.replaceChildren();
    status.textContent = '';
    render();
  });
  const inspect = button('Vérifier K/V dans Luciole (sans cache)', async () => {
    const current = ++request;
    const inspectedStep = step;
    actual.replaceChildren();
    status.textContent = 'Lecture des poids fixes et des passages avant…';
    try {
      const data = await loadModel();
      if (current !== request) { return; }
      const frame = cacheFrame(inspectedStep);
      const ids = frame.words.map(word => data.model.vocabulary.indexOf(word));
      const result = forward(ids, data.weights, data.model.config);
      const previous = inspectedStep === 0 ? null : forward(ids.slice(0, -1), data.weights, data.model.config);
      actual.replaceChildren(table(['Bloc', 'K du dernier token · tête 1', 'V · tête 1', 'Passé identique ?'],
        result.traces.slice(1).map((trace, i) => {
          const width = data.model.config.dim / data.model.config.heads;
          const unchanged = !previous || ['k', 'v'].every(name => previous.traces[i + 1][name].data.every((value, j) =>
            Math.abs(value - trace[name].data[j]) < 1e-10));
          return [i + 1, list(trace.k.toRows().at(-1).slice(0, width)), list(trace.v.toRows().at(-1).slice(0, width)),
            previous ? (unchanged ? 'Oui · mêmes K et V dans toutes les têtes' : 'Non') : 'Premier passage'];
        }), 'Vraies projections K/V, recalculées sans cache'),
      el('p', 'microcopy', 'Les deux passages recalculent tout : cette vérification n’implémente aucun cache. Elle montre seulement pourquoi les anciennes projections causales pourraient être réutilisées.'));
      status.textContent = 'Trace réelle lue. Aucun poids modifié, aucun cache créé.';
    } catch (error) {
      if (current === request) { status.textContent = `Lecture impossible : ${error.message}. Cliquez pour réessayer.`; }
    }
  });
  function render() {
    const frame = cacheFrame(step);
    const content = panel(frame.phase);
    content.append(el('p', '', 'Animation conceptuelle, pas une mesure de vitesse. Luciole n’a pas de KV cache : il recalcule le contexte. La suite « dort . » est imposée pour le dessin, pas annoncée comme une prédiction.'),
      table(['Position', 'Token', 'Avec cache · dans chaque bloc'], frame.words.map((word, i) =>
        [i, word, i < frame.reused ? 'K / V réutilisés' : 'K / V calculés, puis stockés']), 'État conceptuel du cache'),
      table(['Stratégie', 'Positions projetées K/V × 2 blocs', 'Positions K/V stockées × 2 blocs'],
        [['Sans cache (Luciole)', frame.without, '0 dans un cache'], ['Avec cache (conceptuel)', frame.with, frame.total]], 'Comparaison à ce pas, pas du coût total du modèle'),
      el('p', '', step === 0 ? 'Prefill : traiter <bos> le chat et conserver ses K/V par bloc. La sortie de chat permet déjà de choisir dort. Les K/V de dort seront calculés au pas suivant.' : `Token traité : « ${frame.words.at(-1)} ». Ses nouveaux Q/K/V servent à calculer la prédiction suivante. Son Q consulte les K du passé et du présent, puis les V sont mélangés avec de nouveaux poids d’attention.`),
      el('p', 'microcopy', 'Le cache contient K et V par position, par tête K/V et par couche. Pas les connaissances, pas les poids du modèle, pas les poids d’attention. Il est lié à ce contexte ; changer le début exige de recalculer la suite.'));
    chart.replaceChildren(content);
    next.textContent = step === 0 ? 'Passer à t' : 'Passer à t + 1';
    next.disabled = step === 2;
  }
  controls.append(next, reset, inspect);
  root.replaceChildren(el('p', '', 'Cliquez « Passer à t », puis « Passer à t + 1 ». Repérez ce qui est réutilisé et ce qui est nouveau.'), controls, chart, status, actual);
  render();
}
