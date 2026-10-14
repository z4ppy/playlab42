import { softmax } from './math.js';
import { el, select, range, panel, vector, bars } from './dom.js';
import { attentionLesson } from './novice-experiments.js';

export function numbers(root) {
  const words = ['le', 'chat', 'dort'];
  const rows = [[0.4, -0.2, 0.8], [-0.1, 0.7, 0.3], [0.2, 0.5, -0.6]];
  const selected = select('Token observé', words, 'chat', () => {
    coordinates.forEach((control, i) => {
      control.input.value = rows[words.indexOf(selected.input.value)][i];
      control.output.value = control.input.value;
    });
    render();
  });
  const controls = el('div', 'controls');
  const coordinates = rows[1].map((value, i) => range(`Coordonnée ${i}`, -1, 1, value, 0.1, next => {
    rows[words.indexOf(selected.input.value)][i] = next;
    render();
  }));
  controls.append(selected.root, ...coordinates.map(control => control.root));
  const chart = el('div');
  function render() {
    const grid = el('div', 'instrument-grid');
    const tablePanel = panel('Matrice : trois lignes de trois nombres');
    const table = el('table', 'number-matrix');
    const caption = el('caption', '', 'Valeurs inventées pour apprendre la notation');
    const head = el('thead');
    const headings = el('tr');
    ['Token', '0', '1', '2'].forEach(label => {
      const th = el('th', '', label);
      th.scope = 'col';
      headings.append(th);
    });
    head.append(headings);
    const body = el('tbody');
    rows.forEach((values, i) => {
      const row = el('tr', words[i] === selected.input.value ? 'selected' : '');
      const name = el('th', '', words[i]);
      name.scope = 'row';
      row.append(name, ...values.map(value => el('td', '', value.toFixed(1))));
      body.append(row);
    });
    table.append(caption, head, body);
    tablePanel.append(table);
    const selectedPanel = panel(`Vecteur du token « ${selected.input.value} »`);
    selectedPanel.append(vector(rows[words.indexOf(selected.input.value)]));
    grid.append(tablePanel, selectedPanel);
    chart.replaceChildren(grid);
  }
  root.replaceChildren(controls, chart);
  render();
}

export function heads(root, loadModel) {
  attentionLesson(root, loadModel);
}

export function scores(root) {
  const names = ['A', 'B', 'C'];
  const controls = el('div', 'controls');
  const inputs = [-2, 0, 3].map((value, i) => range(`Score du candidat ${names[i]}`, -5, 5, value, 0.1, render));
  controls.append(...inputs.map(input => input.root));
  const chart = el('div');
  function render() {
    const logits = inputs.map(input => Number(input.input.value));
    const probabilities = softmax(logits);
    const raw = panel('Avant : trois scores quelconques');
    raw.append(vector(logits), el('p', 'microcopy', 'Coordonnées 0, 1 et 2 : scores des candidats A, B et C. Ils peuvent être négatifs.'));
    const normalized = panel('Après softmax : trois probabilités');
    normalized.append(bars(probabilities.map((value, i) => ({ label: names[i], value }))),
      el('p', 'status', `Somme des probabilités : ${probabilities.reduce((sum, value) => sum + value, 0).toFixed(6)}`),
      el('p', 'microcopy', 'Les probabilités totalisent 100 %. Aucun candidat n’a encore été choisi.'));
    const grid = el('div', 'instrument-grid');
    grid.append(raw, normalized);
    chart.replaceChildren(grid);
  }
  root.replaceChildren(controls, chart);
  render();
}
