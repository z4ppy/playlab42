/**
 * Interface de l'outil « Reconnaissance de chiffres ».
 *
 * Orchestration uniquement : le calcul vit dans preprocess.js (pur),
 * model.js (inférence pure) et weights-loader.js (lecture des poids).
 */
import { onThemeChange } from '../../../lib/theme.js';
import { DrawingPad } from './drawing-pad.js';
import { MNIST_SIZE, alphaToInk, toMnist } from './preprocess.js';
import { countParameters, forward, rankClasses } from './model.js';
import { loadModel } from './weights-loader.js';
import { describeConfidence, formatPercent, parseCssColor, valuesToRgba } from './visuals.js';

/** @typedef {import('./model.js').DigitModel} DigitModel */
/** @typedef {import('./model.js').ForwardResult} ForwardResult */
/** @typedef {import('./preprocess.js').MnistResult} MnistResult */

const byId = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const canvasById = (/** @type {string} */ id) => /** @type {HTMLCanvasElement} */ (byId(id));

const els = {
  pad: canvasById('pad'),
  hint: byId('padHint'),
  box: byId('padBox'),
  com: byId('padCom'),
  clear: /** @type {HTMLButtonElement} */ (byId('clearBtn')),
  sample: /** @type {HTMLButtonElement} */ (byId('sampleBtn')),
  seen28: canvasById('seen28'),
  topDigit: byId('topDigit'),
  topLabel: byId('topLabel'),
  topDetail: byId('topDetail'),
  live: byId('liveVerdict'),
  result: byId('topLabel').closest('.result') ?? document.body,
  bars: byId('bars'),
  stageScaled: canvasById('stageScaled'),
  scaledCaption: byId('scaledCaption'),
  stageSeen: canvasById('stageSeen'),
  seenCom: byId('seenCom'),
  conv1Maps: byId('conv1Maps'),
  conv2Maps: byId('conv2Maps'),
  hiddenGrid: canvasById('hiddenGrid'),
  factParams: byId('factParams'),
  factSize: byId('factSize'),
  factAccuracy: byId('factAccuracy'),
  factTime: byId('factTime'),
};

const state = {
  /** @type {DigitModel|null} */
  model: null,
  /** @type {Array<{label: number, pixels: Uint8Array}>} */
  samples: [],
  sampleIndex: 0,
  /** Étiquette réelle quand le dessin vient d'un exemple MNIST. */
  sampleLabel: /** @type {number|null} */ (null),
  framePending: false,
  /** Une annonce au lecteur d'écran est attendue après le prochain calcul. */
  announcePending: false,
  /** Dernier calcul, réutilisé pour redessiner après un changement de thème. */
  last: /** @type {{prep: MnistResult, acts: ForwardResult|null}|null} */ (null),
};

/** Couleurs courantes du thème, relues à chaque changement. */
function themeColors() {
  const style = getComputedStyle(document.documentElement);
  const color = (/** @type {string} */ name) => parseCssColor(style.getPropertyValue(name));
  return {
    ink: style.getPropertyValue('--color-text').trim() || '#000',
    background: color('--color-bg'),
    text: color('--color-text'),
    accent: color('--color-accent'),
    info: color('--color-info'),
  };
}

let colors = themeColors();

const pad = new DrawingPad(els.pad, {
  color: colors.ink,
  onChange: () => {
    state.sampleLabel = null;
    schedule();
  },
  // Une seule annonce par trait, pas une par image pendant le tracé.
  onStrokeEnd: () => announceSoon(),
});

/* ------------------------------------------------------------------ */
/* Construction des éléments répétés                                  */
/* ------------------------------------------------------------------ */

/**
 * Crée un canvas pixelisé de taille interne donnée.
 * @param {number} size
 * @param {string} label
 * @returns {HTMLCanvasElement}
 */
function pixelCanvas(size, label) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.className = 'pixelated';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  return canvas;
}

/** @type {Array<{fill: HTMLElement, pct: HTMLElement, item: HTMLElement}>} */
const barEls = Array.from({ length: 10 }, (_, digit) => {
  const item = document.createElement('li');
  item.className = 'bar';
  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('span');
  fill.className = 'bar-fill';
  track.append(fill);
  const label = document.createElement('span');
  label.className = 'bar-digit';
  label.textContent = String(digit);
  const pct = document.createElement('span');
  pct.className = 'bar-pct';
  pct.textContent = '–';
  item.append(track, label, pct);
  els.bars.append(item);
  return { fill, pct, item };
});

const conv1Els = Array.from({ length: 8 }, (_, i) => {
  const figure = document.createElement('figure');
  const pair = document.createElement('div');
  pair.className = 'kernel-pair';
  const kernel = pixelCanvas(5, `Filtre ${i + 1}, 5 × 5 poids`);
  const map = pixelCanvas(24, `Activation du filtre ${i + 1}`);
  pair.append(kernel, map);
  const caption = document.createElement('figcaption');
  caption.textContent = `filtre ${i + 1}`;
  figure.append(pair, caption);
  els.conv1Maps.append(figure);
  return { kernel, map };
});

const conv2Els = Array.from({ length: 16 }, (_, i) => {
  const figure = document.createElement('figure');
  const map = pixelCanvas(10, `Carte ${i + 1} de la seconde convolution`);
  const caption = document.createElement('figcaption');
  caption.textContent = String(i + 1);
  figure.append(map, caption);
  els.conv2Maps.append(figure);
  return map;
});

/* ------------------------------------------------------------------ */
/* Rendu                                                              */
/* ------------------------------------------------------------------ */

/**
 * Peint des valeurs dans un canvas de même taille interne.
 * @param {HTMLCanvasElement} canvas
 * @param {ArrayLike<number>} values
 * @param {{offset?: number, palette: import('./visuals.js').Palette, scale?: number}} options
 */
function paint(canvas, values, { offset = 0, palette, scale }) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const count = canvas.width * canvas.height;
  const image = ctx.createImageData(canvas.width, canvas.height);
  image.data.set(valuesToRgba(values, { offset, count, palette, scale }));
  ctx.putImageData(image, 0, 0);
}

/** Palettes dérivées du thème : encre sur fond, ou activations en couleur d'accent. */
function palettes() {
  return {
    ink: { background: colors.background, positive: colors.text },
    activation: { background: colors.background, positive: colors.accent },
    signed: { background: colors.background, positive: colors.accent, negative: colors.info },
  };
}

/**
 * Positionne un repère en pourcentage dans son conteneur.
 * @param {HTMLElement} el
 * @param {{x: number, y: number}|null} point - Coordonnées de centre de pixel.
 * @param {number} size - Côté du repère d'origine.
 */
function placeMarker(el, point, size) {
  el.hidden = !point;
  if (point) {
    el.style.left = `${((point.x + 0.5) / size) * 100}%`;
    el.style.top = `${((point.y + 0.5) / size) * 100}%`;
  }
}

/** @param {MnistResult} prep */
function renderPreprocessing(prep) {
  const { ink } = palettes();
  paint(els.seen28, prep.image, { palette: ink, scale: 1 });
  paint(els.stageSeen, prep.image, { palette: ink, scale: 1 });
  placeMarker(els.seenCom, prep.centerOfMass, MNIST_SIZE);
  renderScaled(prep);
  renderBox(prep);
}

/**
 * Affiche le chiffre réduit dans une grille 20×20 (centré dans la grille).
 * @param {MnistResult} prep
 */
function renderScaled(prep) {
  const grid = new Float32Array(400);
  const { width, height } = prep.scaledSize;
  if (prep.scaled) {
    const left = Math.floor((20 - width) / 2);
    const top = Math.floor((20 - height) / 2);
    for (let y = 0; y < height; y++) {
      grid.set(prep.scaled.subarray(y * width, (y + 1) * width), (top + y) * 20 + left);
    }
  }
  paint(els.stageScaled, grid, { palette: palettes().ink, scale: 1 });
  els.scaledCaption.textContent = prep.empty ? 'recadré, ≤ 20×20' : `recadré, ${width}×${height}`;
}

/**
 * Boîte englobante et centre de masse superposés au dessin.
 * @param {MnistResult} prep
 */
function renderBox(prep) {
  const size = els.pad.width;
  els.box.hidden = !prep.box;
  if (prep.box) {
    Object.assign(els.box.style, {
      left: `${(prep.box.x / size) * 100}%`,
      top: `${(prep.box.y / size) * 100}%`,
      width: `${(prep.box.width / size) * 100}%`,
      height: `${(prep.box.height / size) * 100}%`,
    });
  }
  // Centre de masse ramené dans le repère du dessin : utile pour voir pourquoi le chiffre bouge.
  const com = prep.box && prep.centerOfMass ? {
    x: prep.box.x + ((prep.centerOfMass.x - prep.shift.x + 0.5) / prep.scaledSize.width) * prep.box.width - 0.5,
    y: prep.box.y + ((prep.centerOfMass.y - prep.shift.y + 0.5) / prep.scaledSize.height) * prep.box.height - 0.5,
  } : null;
  placeMarker(els.com, com, size);
}

/**
 * @param {ForwardResult|null} acts
 * @param {boolean} tooSmall - Tracé présent mais trop petit pour être lu.
 */
function renderPrediction(acts, tooSmall) {
  const probabilities = acts?.probabilities ?? new Float32Array(10);
  const ranking = rankClasses(probabilities);
  barEls.forEach(({ fill, pct, item }, digit) => {
    fill.style.height = `${probabilities[digit] * 100}%`;
    // Nombre seul : « 100 % » déborderait d'une colonne étroite ; l'unité est rappelée sous les barres.
    pct.textContent = acts ? String(Math.round(probabilities[digit] * 100)) : '–';
    item.classList.toggle('is-top', Boolean(acts) && digit === ranking[0]);
    item.setAttribute('aria-label', acts ? `${digit} : ${formatPercent(probabilities[digit])}` : `${digit}`);
  });
  renderVerdict(acts ? probabilities : null, ranking, tooSmall);
}

/**
 * @param {Float32Array|null} probabilities
 * @param {number[]} ranking
 * @param {boolean} tooSmall
 */
function renderVerdict(probabilities, ranking, tooSmall) {
  if (tooSmall) {
    els.topDigit.textContent = '?';
    els.topLabel.textContent = 'Tracé trop petit';
    els.topDetail.textContent = 'Dessinez un chiffre plus grand dans la zone.';
    return;
  }
  if (!probabilities) {
    els.topDigit.textContent = '?';
    els.topLabel.textContent = 'Dessinez un chiffre';
    els.topDetail.textContent = 'La prédiction se met à jour pendant le tracé.';
    return;
  }
  const digit = ranking[0];
  els.topDigit.textContent = String(digit);
  els.topLabel.textContent = `C’est un ${digit} à ${formatPercent(probabilities[digit])}`;
  const truth = state.sampleLabel === null ? '' : ` Étiquette MNIST : ${state.sampleLabel}.`;
  els.topDetail.textContent = `${describeConfidence(probabilities, ranking)}${truth}`;
}

/** @param {ForwardResult|null} acts */
function renderActivations(acts) {
  const model = /** @type {DigitModel} */ (state.model);
  const { activation, signed } = palettes();
  const zeros = new Float32Array(24 * 24 * 16);
  conv1Els.forEach(({ kernel, map }, i) => {
    paint(kernel, model.conv1.weights, { offset: i * 25, palette: signed });
    paint(map, acts?.conv1.data ?? zeros, { offset: i * 576, palette: activation });
  });
  conv2Els.forEach((map, i) => {
    paint(map, acts?.conv2.data ?? zeros, { offset: i * 100, palette: activation });
  });
  paint(els.hiddenGrid, acts?.hidden ?? zeros, { palette: activation });
}

/** Recalcule tout à partir du dessin courant. */
function update() {
  state.framePending = false;
  els.hint.hidden = !pad.isEmpty;
  const prep = toMnist(alphaToInk(pad.pixels()), els.pad.width, els.pad.height);
  let acts = null;
  if (state.model && !prep.empty && !prep.tooSmall) {
    const started = performance.now();
    acts = forward(state.model, prep.image);
    els.factTime.textContent = `${(performance.now() - started).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ms`;
  }
  state.last = { prep, acts };
  render();
  if (state.announcePending) {
    state.announcePending = false;
    announce();
  }
}

/** Recopie le verdict affiché dans la région live (lue une fois par le lecteur d'écran). */
function announce() {
  els.live.textContent = `${els.topLabel.textContent} ${els.topDetail.textContent}`;
}

/** Demande une annonce après le prochain calcul (fin de trait, exemple, effacement). */
function announceSoon() {
  state.announcePending = true;
  schedule();
}

/** Rendu complet depuis le dernier calcul (aussi après changement de thème). */
function render() {
  if (!state.last) { return; }
  renderPreprocessing(state.last.prep);
  if (state.model) {
    renderPrediction(state.last.acts, state.last.prep.tooSmall);
    renderActivations(state.last.acts);
  }
}

/** Regroupe les mises à jour à une par image affichée. */
function schedule() {
  if (!state.framePending) {
    state.framePending = true;
    requestAnimationFrame(update);
  }
}

/* ------------------------------------------------------------------ */
/* Chargement et événements                                           */
/* ------------------------------------------------------------------ */

/** Charge les 20 images MNIST de démonstration (facultatif). */
async function loadSamples() {
  const response = await fetch(new URL('../model/mnist-samples.json', import.meta.url), { credentials: 'same-origin' });
  if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
  const json = await response.json();
  // Ordre d’apparition dans le jeu de test : les chiffres s’y succèdent sans motif.
  const sorted = [...json.samples].sort((a, b) => (a.index - b.index));
  state.samples = sorted.map(sample => ({
    label: sample.label,
    pixels: Uint8Array.from(atob(sample.pixels), char => char.charCodeAt(0)),
  }));
}

function showNextSample() {
  if (!state.samples.length) { return; }
  const sample = state.samples[state.sampleIndex % state.samples.length];
  state.sampleIndex++;
  pad.drawImage28(sample.pixels);
  state.sampleLabel = sample.label;
  announceSoon();
}

/**
 * @param {import('./weights-loader.js').ModelManifest} manifest
 * @param {DigitModel} model
 */
function showFacts(manifest, model) {
  els.factParams.textContent = countParameters(model).toLocaleString('fr-FR');
  els.factSize.textContent = `${Math.round(manifest.weights.bytes / 1024).toLocaleString('fr-FR')} Ko`;
  const accuracy = manifest.evaluation?.testAccuracy;
  els.factAccuracy.textContent = typeof accuracy === 'number' ? formatPercent(accuracy, 2) : 'non mesurée';
}

async function init() {
  els.clear.addEventListener('click', () => {
    pad.clear();
    announceSoon();
  });
  els.sample.addEventListener('click', showNextSample);
  onThemeChange(() => {
    colors = themeColors();
    pad.setColor(colors.ink);
    render();
  });
  update();
  try {
    const { model, manifest } = await loadModel();
    state.model = model;
    showFacts(manifest, model);
    state.announcePending = true;
    update();
  } catch (error) {
    els.topLabel.textContent = 'Modèle indisponible';
    els.result.classList.add('has-error');
    els.topDetail.textContent = error instanceof Error ? error.message : String(error);
    announce();
    return;
  }
  loadSamples().then(() => { els.sample.disabled = false; }, () => { els.sample.hidden = true; });
}

init();
