let controlId = 0;

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) { node.className = className; }
  if (text !== '') { node.textContent = text; }
  return node;
}

export function button(text, action, primary = false) {
  const node = el('button', primary ? 'primary' : '', text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function field(labelText) {
  const root = el('div', 'control');
  const label = el('label', '', labelText);
  label.htmlFor = `instrument-${++controlId}`;
  root.append(label);
  return { root, label, id: label.htmlFor };
}

export function select(labelText, options, value, change) {
  const { root, label, id } = field(labelText);
  const input = el('select');
  input.id = id;
  options.forEach(option => {
    const item = el('option', '', typeof option === 'string' ? option : option.label);
    item.value = typeof option === 'string' ? option : String(option.value);
    input.append(item);
  });
  input.value = String(value);
  input.addEventListener('change', change);
  root.append(input);
  return { root, label, input };
}

export function range(labelText, min, max, value, step, change) {
  const { root, label, id } = field(labelText);
  const input = el('input');
  input.type = 'range';
  input.id = id;
  input.setAttribute('aria-label', labelText);
  // Le navigateur arrondit immédiatement la valeur au pas courant (1 par
  // défaut). Définir le pas avant la valeur évite par exemple 1 → 0,05.
  Object.assign(input, { min, max, step, value });
  const output = el('output', '', input.value);
  output.htmlFor = id;
  output.setAttribute('aria-hidden', 'true');
  label.append(output);
  input.addEventListener('input', () => { output.value = input.value; change(Number(input.value)); });
  root.append(input);
  return { root, input, output };
}

export function textField(labelText, value, multiline = false) {
  const { root, id } = field(labelText);
  const input = el(multiline ? 'textarea' : 'input');
  if (!multiline) { input.type = 'text'; }
  input.id = id;
  input.value = value;
  input.maxLength = 500;
  root.append(input);
  return { root, input };
}

export function metric(value, label) {
  const root = el('div', 'metric');
  root.append(el('strong', '', value), el('span', 'metric-label', label));
  return root;
}

export function panel(title) {
  const root = el('section', 'instrument');
  root.append(el('h3', 'instrument-title', title));
  return root;
}

export function bars(items, max = 1) {
  const root = el('div', 'bar-chart');
  root.setAttribute('role', 'list');
  items.forEach(({ label, value, display }) => {
    const row = el('div', 'bar-row');
    row.setAttribute('role', 'listitem');
    const name = el('span', 'bar-label', label);
    name.title = label;
    const track = el('div', 'bar-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.min(100, Math.max(0, value / max * 100))}%`;
    track.append(fill);
    row.append(name, track, el('span', 'bar-value', display ?? `${(value * 100).toFixed(1)} %`));
    root.append(row);
  });
  return root;
}

export function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  if (text !== undefined) { node.textContent = text; }
  return node;
}

export function plot(label, width = 500, height = 240) {
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, class: 'plot', role: 'img', 'aria-label': label });
  return svg;
}

export function tokens(texts, ids = []) {
  const root = el('div', 'token-stream');
  texts.forEach((text, i) => {
    const token = el('span', 'token', text.replaceAll(' ', '·').replaceAll('\n', '↵'));
    if (ids[i] !== undefined) { token.append(el('small', '', `id ${ids[i]}`)); }
    root.append(token);
  });
  return root;
}

export function vector(values) {
  const figure = el('figure', 'vector-figure');
  const root = el('div', 'vector');
  root.style.gridTemplateColumns = `repeat(${values.length}, minmax(0, 1fr))`;
  root.style.minWidth = `${values.length * 14}px`;
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', `Coordonnées : ${values.map(v => v.toFixed(2)).join(', ')}`);
  const max = Math.max(...values.map(Math.abs), 0.01);
  const numbers = el('details', 'vector-values');
  const list = el('dl');
  values.forEach((v, i) => {
    const coordinate = el('span', 'vector-coordinate');
    const bar = el('span', v < 0 ? 'vector-bar negative' : 'vector-bar');
    bar.style.height = `${Math.abs(v) / max * 40}px`;
    coordinate.title = `Coordonnée ${i} : ${v.toFixed(4)}`;
    coordinate.append(bar, el('small', '', String(i)));
    root.append(coordinate);
    const entry = el('div');
    entry.append(el('dt', '', `Coordonnée ${i}`), el('dd', '', v.toFixed(4)));
    list.append(entry);
  });
  numbers.append(el('summary', '', `Lire les ${values.length} valeurs`), list);
  const scroll = el('div', 'vector-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Coordonnées du vecteur, défilement horizontal si nécessaire');
  scroll.append(root);
  figure.append(scroll, el('figcaption', 'microcopy', 'Une barre = un nombre, pas une probabilité. Au-dessus de zéro : positif (rose) ; en dessous : négatif (ambre). Échelle ajustée à chaque graphique.'), numbers);
  return figure;
}

export function topTokens(probabilities, vocabulary, count = 6) {
  return probabilities.map((value, i) => ({ label: vocabulary[i], value }))
    .sort((a, b) => b.value - a.value).slice(0, count);
}

export function showError(root, error) {
  const message = el('p', 'error', error instanceof Error ? error.message : String(error));
  message.setAttribute('role', 'alert');
  root.replaceChildren(message);
  console.error('[anatomie-llm]', error);
}
