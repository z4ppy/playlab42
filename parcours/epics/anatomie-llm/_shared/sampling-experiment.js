import { SeededRandom } from '../../../../lib/seeded-random.js';
import { distribution, softmax, sample } from './math.js';
import { el, button, select, range, panel, bars } from './dom.js';

// Choix fictifs : les libellés ne sont pas les tokens d'un tokenizer réel.
export const samplingLabels = ['un gâteau', 'une glace', 'un fruit', 'un café', 'autre chose'];
export const samplingScenarios = [
  { id: 'plausible', label: 'Plusieurs choix plausibles', probabilities: [0.4, 0.3, 0.2, 0.08, 0.02] },
  { id: 'dominant', label: 'Un favori dominant', probabilities: [0.97, 0.015, 0.008, 0.005, 0.002] },
  { id: 'equal', label: 'Égalité entre les choix', probabilities: [0.2, 0.2, 0.2, 0.2, 0.2] },
];

/** Même décodage que le modèle, avec des entrées choisies pour rendre les effets lisibles. */
export function sampling(root) {
  let rng;
  let counts;
  let total;
  let latest;
  let probabilities;
  const controls = el('div', 'controls');
  const scenario = select('Situation de départ', samplingScenarios.map(s => ({ value: s.id, label: s.label })), 'plausible', render);
  const temperature = range('Température', 0, 2, 1, 0.1, render);
  const topK = range('Top-k · nombre maximal de candidats', 1, 5, 5, 1, render);
  const topP = range('Top-p', 0.05, 1, 1, 0.05, render);
  const minP = range('Min-p', 0, 1, 0, 0.05, render);
  const chart = el('div', 'sampling-distributions instrument-grid');
  const filtering = el('details', 'sampling-filtering');
  const summary = el('p', 'sampling-summary');
  const guidance = el('p', 'microcopy');
  const observed = panel('3 · Observer les tirages');
  const result = el('p', 'status');
  result.setAttribute('role', 'status');
  const frequencies = el('div', 'sampling-frequencies');
  const actions = el('div', 'button-row');
  const items = (values, display) => samplingLabels.map((label, i) => ({
    label, value: values[i], ...(display ? { display: display(i) } : {}),
  }));

  function showDraws() {
    result.textContent = total ? `${total} tirage${total > 1 ? 's' : ''} cumulé${total > 1 ? 's' : ''} · dernier choix : ${samplingLabels[latest]}.` : 'Aucun tirage pour ces réglages. Commencez par un seul, puis ajoutez-en 100.';
    frequencies.replaceChildren(...(total ? [bars(items(counts.map(n => n / total), i => `${counts[i]} / ${total}`))] : []));
  }
  function resetDraws() {
    rng = new SeededRandom(42);
    counts = samplingLabels.map(() => 0);
    total = 0;
    latest = undefined;
    showDraws();
  }
  function draw(count) {
    for (let i = 0; i < count; i++) {
      latest = sample(probabilities, rng);
      counts[latest]++;
      total++;
    }
    showDraws();
  }
  function render() {
    const base = samplingScenarios.find(s => s.id === scenario.input.value).probabilities;
    // log(p) fournit des scores dont softmax à T=1 restitue la distribution choisie.
    const logits = base.map(Math.log);
    const t = Number(temperature.input.value);
    const k = Number(topK.input.value);
    const p = Number(topP.input.value);
    const minimum = Number(minP.input.value);
    const tempered = softmax(logits, t);
    probabilities = distribution(logits, t, p, minimum, k);
    const before = panel('1 · Avant réglages · probabilités inventées');
    before.dataset.distribution = 'initial';
    before.append(bars(items(base)));
    const after = panel('2 · Distribution utilisée pour tirer');
    after.dataset.distribution = 'final';
    after.append(bars(items(probabilities)));
    chart.replaceChildren(before, after);
    const retained = probabilities.filter(value => value > 0).length;
    summary.textContent = `${retained} candidat${retained > 1 ? 's' : ''} retenu${retained > 1 ? 's' : ''} · somme après réglages : ${(probabilities.reduce((a, b) => a + b, 0) * 100).toFixed(1)} %.`;
    guidance.textContent = t === 0
      ? 'À température 0, on choisit directement le maximum : 100 % après réglage ne signifie pas 100 % au départ. En cas d’égalité, cette expérience prend le premier candidat dans l’ordre affiché.'
      : scenario.input.value === 'equal'
        ? 'Des scores égaux restent égaux quand la température varie. Les filtres peuvent néanmoins retirer des candidats ; les égalités sont départagées dans l’ordre affiché.'
        : 'Changer un réglage conserve les probabilités initiales et remet les tirages à zéro avec la graine 42. Les candidats exclus restent visibles à 0 %.';
    const ranked = tempered.map((value, i) => ({ value, i })).sort((a, b) => b.value - a.value || a.i - b.i);
    const ranks = ranked.map(item => item.i);
    const peak = Math.max(...tempered);
    const table = el('table', 'reading-table');
    table.append(el('caption', '', 'De la température aux filtres : pourquoi chaque candidat est conservé ou retiré'));
    const header = el('tr');
    for (const name of ['Candidat', 'Après température', 'Décision des filtres']) {
      const th = el('th', '', name); th.scope = 'col'; header.append(th);
    }
    const thead = el('thead'); thead.append(header); table.append(thead);
    const tbody = el('tbody');
    samplingLabels.forEach((label, i) => {
      const reason = tempered[i] === 0 ? 'Écarté à température 0'
        : ranks.indexOf(i) >= k ? 'Écarté par top-k'
          : tempered[i] < peak * minimum ? 'Écarté par min-p'
            : probabilities[i] === 0 ? 'Écarté par top-p' : 'Conservé, puis renormalisé';
      const row = el('tr');
      const th = el('th', '', label); th.scope = 'row';
      row.append(th, el('td', '', `${(tempered[i] * 100).toFixed(2)} %`), el('td', '', reason));
      tbody.append(row);
    });
    table.append(tbody);
    const scroll = el('div', 'reading-table-wrap');
    scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Détail des filtres'); scroll.append(table);
    // Conserver l'ouverture du détail pendant les changements de réglages.
    filtering.replaceChildren(el('summary', '', 'Voir le détail des filtres'), scroll);
    resetDraws();
  }
  controls.append(scenario.root, temperature.root, topK.root, topP.root, minP.root);
  actions.append(button('Tirer une fois', () => draw(1), true), button('Ajouter 100 tirages', () => draw(100)), button('Recommencer les tirages', resetDraws));
  observed.append(actions, result, frequencies, el('p', 'microcopy', 'Chaque tirage repart de la même distribution : on ne complète pas la phrase. Les fréquences peuvent différer des probabilités. La graine 42 rend la suite reproductible.'));
  root.classList.add('sampling-lesson');
  root.replaceChildren(el('p', '', '« Pour le dessert, je prendrai… » · cinq choix fictifs, pas les tokens d’un modèle réel. Aucun modèle n’est chargé.'),
    controls, el('p', 'microcopy', 'Ordre appliqué : température → top-k → min-p → top-p → renormalisation → tirage. Top-p porte sur la masse restante après les deux premiers filtres.'),
    chart, summary, guidance, filtering, observed);
  render();
}
