import { rotate3D } from './math.js';
import { el, select, range, panel, plot, svgNode, button } from './dom.js';

export function embeddingAtlas(rows, vocabulary, selectedTokens) {
  const root = panel('Atlas 3D · trois coordonnées réelles');
  root.classList.add('embedding-atlas');
  const controls = el('div', 'controls');
  controls.classList.add('atlas-axes');
  const options = rows[0].map((_, i) => ({ label: `n° ${i}`, value: i }));
  const axes = ['X', 'Y', 'Z'].map((axis, i) => select(`Axe ${axis}`, options, i, render));
  controls.append(...axes.map(axis => axis.root));
  const azimuth = range('Rotation horizontale (°)', -180, 180, 35, 1, render);
  const elevation = range('Rotation verticale (°)', -85, 85, 20, 1, render);
  const zoom = range('Zoom', 0.5, 2, 1, 0.1, render);
  const orientation = el('div', 'controls');
  orientation.append(azimuth.root, elevation.root, zoom.root);
  const svg = plot('Projection 3D des embeddings de Luciole.', 500, 360);
  svg.classList.add('embedding-plot');
  const coordinates = el('p', 'microcopy atlas-coordinates');
  const neighbors = el('p', 'microcopy');
  const reset = button('Réinitialiser la vue 3D', () => {
    axes.forEach((axis, i) => { axis.input.value = i; });
    [[azimuth, 35], [elevation, 20], [zoom, 1]].forEach(([control, value]) => {
      control.input.value = value;
      control.output.value = value;
    });
    render();
  });
  root.append(el('p', 'microcopy', `Choisissez trois coordonnées distinctes, numérotées de 0 à ${rows[0].length - 1}.`), controls, svg, coordinates, orientation, reset,
    el('p', 'microcopy', `Glissez sur le nuage ou utilisez les curseurs au clavier. Chaque point est un token. Rose : premier token ; ambre : second. Les axes montrent 3 coordonnées sur ${rows[0].length}, pas des concepts nommés ni une carte complète du sens.`),
    neighbors);
  let drag;
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) { return; }
    drag = { x: event.clientX, y: event.clientY, azimuth: Number(azimuth.input.value), elevation: Number(elevation.input.value) };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) { return; }
    azimuth.input.value = Math.max(-180, Math.min(180, drag.azimuth + (event.clientX - drag.x) / 2));
    elevation.input.value = Math.max(-85, Math.min(85, drag.elevation - (event.clientY - drag.y) / 2));
    azimuth.output.value = azimuth.input.value;
    elevation.output.value = elevation.input.value;
    render();
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointercancel', () => { drag = null; });
  svg.addEventListener('lostpointercapture', () => { drag = null; });

  function render() {
    const indices = axes.map(axis => Number(axis.input.value));
    axes.forEach((axis, i) => [...axis.input.options].forEach(option => {
      option.disabled = indices.some((index, j) => i !== j && index === Number(option.value));
    }));
    const [first, second] = selectedTokens();
    const maximum = Math.max(...rows.flatMap(row => indices.map(i => Math.abs(row[i]))), 0.01);
    const scale = 100 * Number(zoom.input.value) / maximum;
    const project = point => {
      const [x, y, depth] = rotate3D(point, Number(azimuth.input.value) * Math.PI / 180, Number(elevation.input.value) * Math.PI / 180);
      return { x: 250 + x * scale, y: 180 - y * scale, depth };
    };
    svg.replaceChildren();
    indices.forEach((dimension, i) => {
      const a = [0, 0, 0], b = [0, 0, 0];
      a[i] = -maximum;
      b[i] = maximum;
      const from = project(a), to = project(b);
      svg.append(svgNode('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'axis' }),
        svgNode('text', { x: Math.max(15, Math.min(440, to.x + 6)), y: Math.max(18, Math.min(345, to.y - 6)) }, `${'XYZ'[i]} · ${dimension}`));
    });
    const points = rows.map((row, id) => ({ id, ...project(indices.map(i => row[i])) })).sort((a, b) => a.depth - b.depth);
    const labels = [];
    for (const point of points) {
      const name = vocabulary[point.id];
      const selected = name === first || name === second;
      const circle = svgNode('circle', { cx: point.x, cy: point.y, r: selected ? 6 : 2.5, class: name === second ? 'selected-dot' : 'dot', opacity: selected ? 1 : 0.45, 'data-token': name });
      circle.append(svgNode('title', {}, `${name} : ${indices.map(i => `${i}=${rows[point.id][i].toFixed(4)}`).join(', ')}`));
      svg.append(circle);
      if (selected) {
        labels.push(svgNode('text', { x: Math.max(12, Math.min(point.x + 9, 440)), y: Math.max(18, Math.min(point.y + (name === first ? 18 : -10), 345)), class: 'atlas-label' }, name));
      }
    }
    svg.append(...labels);
    coordinates.textContent = [first, second].map(name => {
      const row = rows[vocabulary.indexOf(name)];
      return `${name} : (${indices.map(i => row[i].toFixed(3)).join(' ; ')})`;
    }).join(' · ');
    svg.setAttribute('aria-label', `Embeddings, axes ${indices.join(', ')}. ${coordinates.textContent}`);
    neighbors.textContent = `La similarité cosinus à gauche utilise toujours les ${rows[0].length} nombres. Changer les axes ou tourner la vue ne la modifie pas. Deux points proches à l’écran peuvent être éloignés dans les dimensions cachées.`;
  }
  render();
  return { root, update: render };
}
