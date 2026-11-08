/**
 * L-systèmes — point d'entrée de l'interface.
 *
 * Flux : saisie → état → (worker) réécriture + tortue → styles → canvas.
 * L'état complet vit dans le fragment d'URL ; la vue (zoom, déplacement)
 * et l'animation sont locales.
 */

import { getEffectiveTheme, toggleTheme } from '../../../lib/theme.js';
import { DEFAULT_PRESET_ID, findPreset } from './presets.js';
import { stateFromPreset, stateToHash, hashToState } from './hash-state.js';
import { MAX_ITERATIONS } from './lsystem.js';
import { buildStyleIndex } from './style.js';
import { fitView, panBy, zoomAt, pinchView, zoomLimits } from './view.js';
import { Renderer } from './renderer.js';
import { ComputeClient } from './compute-client.js';
import { attachGestures, KEY_ACTIONS } from './gestures.js';
import { populatePresets, writeForm, readRules, renderRules, withNewRule, markParametric, writeAppearanceLabels, NUMBER_INPUTS, readNumber, GRAMMAR_FIELDS } from './form.js';
import { exportPng, exportSvg, copyLink } from './export.js';
import { nonFiniteMessage } from './compute.js';

const $ = (id) => document.getElementById(id);

const els = {
  preset: $('preset'),
  themeToggle: $('theme-toggle'),
  stage: $('stage'),
  canvas: /** @type {HTMLCanvasElement} */ ($('canvas')),
  status: $('status'),
  busy: $('busy'),
  alert: $('alert'),
  alertText: $('alert-text'),
  alertAction: $('alert-action'),
  zoomIn: $('zoom-in'),
  zoomOut: $('zoom-out'),
  recenter: $('recenter'),
  panel: $('panel'),
  iterDown: $('iter-down'),
  iterUp: $('iter-up'),
  iterValue: $('iter-value'),
  replay: $('replay'),
  toggleEditor: $('toggle-editor'),
  presetNote: $('preset-note'),
  axiom: $('axiom'),
  rules: $('rules'),
  addRule: $('add-rule'),
  angle: $('angle'),
  angleRange: $('angle-range'),
  step: $('step'),
  heading: $('heading'),
  seed: $('seed'),
  reseed: $('reseed'),
  colorMode: $('color-mode'),
  lineWidth: $('line-width'),
  lineWidthValue: $('line-width-value'),
  widthDecay: $('width-decay'),
  widthDecayValue: $('width-decay-value'),
  animate: $('animate'),
  motionHint: $('motion-hint'),
  exportPng: $('export-png'),
  exportSvg: $('export-svg'),
  copyLink: $('copy-link'),
  preview: $('preview'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const renderer = new Renderer(els.canvas);
const client = new ComputeClient();

/** État partagé de l'application (un seul objet, pas de framework). */
const app = {
  state: hashToState(location.hash) ?? stateFromPreset(DEFAULT_PRESET_ID),
  drawing: null,
  styleIndex: null,
  view: { scale: 1, tx: 0, ty: 0 },
  fitted: { scale: 1, tx: 0, ty: 0 },
  /** Vrai tant que l'utilisateur n'a ni zoomé ni déplacé : on recadre automatiquement. */
  autoView: true,
  animation: null,
  pendingFrame: 0,
  fullRenderTimer: 0,
  computeTimer: 0,
  hashTimer: 0,
  messageTimer: 0,
  lastStats: '',
};

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

function pixelRatio() {
  // Plafonné à 2 : au-delà, la mémoire du canvas explose sans gain visible.
  return Math.min(window.devicePixelRatio || 1, 2);
}

function scaleInfo() {
  return { pixelRatio: pixelRatio(), zoomRatio: app.view.scale / app.fitted.scale };
}

function refit() {
  app.fitted = fitView(app.drawing?.bounds ?? null, els.canvas.width, els.canvas.height, 20 * pixelRatio());
  if (app.autoView) {
    app.view = { ...app.fitted };
  }
}

function renderFull() {
  cancelAnimationFrame(app.pendingFrame);
  app.pendingFrame = 0;
  renderer.renderFull(app.view, scaleInfo());
}

/**
 * Rendu après un geste : direct si le dessin est léger, sinon aperçu
 * instantané puis vrai rendu quand le geste se calme.
 */
function renderInteractive() {
  if (app.pendingFrame) {
    return;
  }
  app.pendingFrame = requestAnimationFrame(() => {
    app.pendingFrame = 0;
    if (renderer.lastFullMs < 24 || !renderer.renderPreview(app.view)) {
      renderer.renderFull(app.view, scaleInfo());
      return;
    }
    clearTimeout(app.fullRenderTimer);
    app.fullRenderTimer = setTimeout(renderFull, 160);
  });
}

function resizeCanvas() {
  const ratio = pixelRatio();
  const width = Math.max(1, Math.round(els.stage.clientWidth * ratio));
  const height = Math.max(1, Math.round(els.stage.clientHeight * ratio));
  if (width === els.canvas.width && height === els.canvas.height) {
    return;
  }
  // Vue manuelle : on garde le même point au centre.
  const dx = (width - els.canvas.width) / 2;
  const dy = (height - els.canvas.height) / 2;
  els.canvas.width = width;
  els.canvas.height = height;
  if (!app.autoView) {
    app.view = panBy(app.view, dx, dy);
  }
  refit();
  stopAnimation();
  renderFull();
}

// ---------------------------------------------------------------------------
// Animation de croissance
// ---------------------------------------------------------------------------

function shouldAnimate() {
  return els.animate.checked && !reducedMotion.matches && app.drawing && app.drawing.count > 1;
}

function stopAnimation() {
  if (!app.animation) {
    return false;
  }
  cancelAnimationFrame(app.animation.frame);
  app.animation = null;
  return true;
}

function animationStep(now) {
  const anim = app.animation;
  if (!anim) {
    return;
  }
  // L'horodatage de requestAnimationFrame peut précéder performance.now() au
  // lancement : l'origine est donc fixée à la première image.
  anim.start ??= now;
  const progress = Math.min(1, Math.max(0, (now - anim.start) / anim.duration));
  const target = Math.floor(progress * app.drawing.count);
  renderer.renderRange(app.view, scaleInfo(), anim.drawn, target);
  anim.drawn = target;
  if (progress >= 1) {
    app.animation = null;
    renderFull();
    return;
  }
  anim.frame = requestAnimationFrame(animationStep);
}

function playGrowth() {
  stopAnimation();
  if (!shouldAnimate()) {
    renderFull();
    return;
  }
  renderer.clear();
  const duration = Math.min(3500, Math.max(900, 600 + app.drawing.count * 1.5));
  app.animation = { start: null, duration, drawn: 0, frame: 0 };
  app.animation.frame = requestAnimationFrame(animationStep);
}

/** Toute interaction termine l'animation : on affiche le dessin entier. */
function finishAnimation() {
  if (stopAnimation()) {
    renderFull();
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function formatCount(value) {
  return value.toLocaleString('fr-FR');
}

function showStats() {
  const d = app.drawing;
  if (!d) {
    els.status.textContent = '';
    return;
  }
  app.lastStats = `${formatCount(d.count)} segments · ${formatCount(d.length)} symboles · ${d.elapsed} ms`;
  els.status.textContent = app.lastStats;
}

/**
 * Message bref dans la barre d'état (export, copie…), puis retour aux stats.
 * @param {string} text - Message
 */
function flashMessage(text) {
  els.status.textContent = text;
  clearTimeout(app.messageTimer);
  app.messageTimer = setTimeout(() => {
    els.status.textContent = app.lastStats;
  }, 3500);
}

/**
 * Affiche une alerte non bloquante (jamais d'alert() natif).
 * @param {string} text - Message
 * @param {{ label: string, run: () => void }|null} [action] - Bouton facultatif
 */
function showAlert(text, action = null) {
  els.alertText.textContent = text;
  els.alertAction.hidden = !action;
  els.alertAction.textContent = action ? action.label : '';
  els.alertAction.onclick = action ? action.run : null;
  els.alert.hidden = false;
}

function hideAlert() {
  els.alert.hidden = true;
}

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

function computeParams() {
  const { axiom, rules, iterations, angle, step, heading, seed } = app.state;
  return { axiom, rules, iterations, angle, step, heading, seed };
}

function restyle() {
  if (!app.drawing) {
    return;
  }
  app.styleIndex = buildStyleIndex(app.drawing, {
    colorMode: app.state.colorMode,
    lineWidth: app.state.lineWidth,
    widthDecay: app.state.widthDecay,
    theme: getEffectiveTheme(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || undefined,
  });
  renderer.setDrawing(app.drawing, app.styleIndex);
}

function describeLimit(error) {
  const n = error.safeIterations;
  return {
    text: `Trop de symboles : au-delà de ${formatCount(error.limit)}, le dessin figerait la page.${app.drawing ? ' Le dernier dessin valide reste affiché.' : ''}`,
    action: { label: `Revenir à n = ${n}`, run: () => setIterations(n) },
  };
}

/**
 * Champ de saisie désigné par une erreur de syntaxe.
 * @param {import('./lsystem.js').ErrorField|undefined} field - Champ fautif
 * @returns {HTMLInputElement|null}
 */
function fieldInput(field) {
  if (!field) {
    return null;
  }
  if (field.kind === 'axiom') {
    return els.axiom;
  }
  return els.rules.querySelector(`.rule[data-index="${field.index}"] .${field.part}`);
}

/** Retire les marques d'erreur (aria-invalid) posées sur les champs. */
function clearInvalid() {
  for (const input of els.panel.querySelectorAll('[aria-invalid="true"]')) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

/**
 * Relie le champ fautif au message d'erreur (visuel et lecteur d'écran).
 * @param {import('./lsystem.js').ErrorField|undefined} field - Champ fautif
 */
function markInvalid(field) {
  clearInvalid();
  const input = fieldInput(field);
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'alert-text');
  }
}

function handleFailure(error) {
  markInvalid(error.code === 'syntax' ? error.field : undefined);
  if (error.code === 'limit') {
    const { text, action } = describeLimit(error);
    showAlert(text, action);
    return;
  }
  if (error.code === 'nonfinite') {
    showAlert(`${error.message}${app.drawing ? ' Le dernier dessin valide reste affiché.' : ''}`);
    return;
  }
  showAlert(error.code === 'syntax' ? `Grammaire invalide : ${error.message}` : `Erreur : ${error.message}`);
}

function handleSuccess(result, { animate }) {
  hideAlert();
  clearInvalid();
  app.drawing = result;
  restyle();
  refit();
  showStats();
  els.preview.textContent = result.preview + (result.length > result.preview.length ? '…' : '');
  if (result.count === 0) {
    renderFull();
    showAlert('Rien à dessiner : aucun F ou G dans la chaîne obtenue.');
    return;
  }
  if (result.nonFinite > 0) {
    // Dessin partiel : on le montre, mais on dit pourquoi des segments manquent.
    showAlert(nonFiniteMessage(result.nonFiniteSymbol, result.nonFinite));
  }
  if (animate) {
    playGrowth();
  } else {
    stopAnimation();
    renderFull();
  }
}

/**
 * Lance le calcul du dessin.
 * @param {{ animate?: boolean, refit?: boolean }} [options] - Animation, recadrage
 */
async function recompute({ animate = true, refit: resetView = true } = {}) {
  clearTimeout(app.computeTimer);
  if (resetView) {
    app.autoView = true;
  }
  const busyTimer = setTimeout(() => { els.busy.hidden = false; }, 120);
  let outcome = await client.run(computeParams());
  if (outcome.retry) {
    outcome = await client.run(computeParams());
  }
  if (outcome.cancelled) {
    clearTimeout(busyTimer);
    return;
  }
  clearTimeout(busyTimer);
  els.busy.hidden = true;
  if (outcome.ok) {
    handleSuccess(outcome.result, { animate });
  } else {
    handleFailure(outcome.error);
  }
}

/** Recalcul différé pendant la frappe. */
function recomputeSoon() {
  clearTimeout(app.computeTimer);
  app.computeTimer = setTimeout(() => recompute({ animate: false, refit: true }), 260);
}

// ---------------------------------------------------------------------------
// État ⇄ formulaire ⇄ URL
// ---------------------------------------------------------------------------

function saveHash() {
  clearTimeout(app.hashTimer);
  app.hashTimer = setTimeout(() => {
    history.replaceState(null, '', `#${stateToHash(app.state)}`);
  }, 200);
}

function showPresetNote() {
  const preset = findPreset(app.state.preset);
  els.presetNote.textContent = preset ? preset.note : 'Grammaire personnalisée : modifiez l’axiome et les règles, le dessin suit.';
}

/**
 * Applique une modification de l'état.
 * @param {Partial<import('./hash-state.js').ToolState>} patch - Champs modifiés
 */
function updateState(patch) {
  const touchesGrammar = Object.keys(patch).some((key) => GRAMMAR_FIELDS.has(key));
  app.state = { ...app.state, ...patch };
  if (touchesGrammar && app.state.preset !== 'custom') {
    app.state.preset = 'custom';
    els.preset.value = 'custom';
    showPresetNote();
  }
  saveHash();
}

function loadState(state) {
  app.state = state;
  writeForm(els, state);
  showPresetNote();
  saveHash();
  recompute({ animate: true, refit: true });
}

function setIterations(n) {
  const iterations = Math.min(MAX_ITERATIONS, Math.max(0, n));
  updateState({ iterations });
  els.iterValue.textContent = `n = ${iterations}`;
  recompute({ animate: true, refit: true });
}

// ---------------------------------------------------------------------------
// Branchements
// ---------------------------------------------------------------------------

function bindGrammar() {
  els.axiom.addEventListener('input', () => {
    updateState({ axiom: els.axiom.value });
    recomputeSoon();
  });
  els.rules.addEventListener('input', () => {
    updateState({ rules: readRules(els.rules) });
    markParametric(els.rules, app.state.rules);
    recomputeSoon();
  });
  els.rules.addEventListener('click', (event) => {
    const button = event.target.closest('.remove');
    if (!button) {
      return;
    }
    const index = Number(button.closest('.rule').dataset.index);
    const rules = app.state.rules.filter((_, i) => i !== index);
    updateState({ rules });
    renderRules(els.rules, rules);
    // La liste est reconstruite : sans cela, le focus retomberait sur <body>.
    const removes = els.rules.querySelectorAll('.remove');
    const next = removes[Math.min(index, removes.length - 1)];
    (next ?? els.addRule).focus();
    recomputeSoon();
  });
  els.addRule.addEventListener('click', () => {
    const rules = withNewRule(app.state.rules);
    updateState({ rules });
    renderRules(els.rules, rules);
    els.rules.querySelector('.rule:last-child .predecessor')?.focus();
  });
}

function bindNumbers() {
  const grammarDriven = new Set(['angle', 'step', 'heading', 'seed']);
  for (const [key, field] of NUMBER_INPUTS) {
    els[key].addEventListener('input', () => {
      const value = readNumber(els[key], field, app.state[field]);
      updateState({ [field]: value });
      if (field === 'angle') {
        els.angleRange.value = String(Math.min(180, Math.max(1, Math.abs(value))));
      }
      if (grammarDriven.has(field)) {
        recomputeSoon();
        return;
      }
      writeAppearanceLabels(els, app.state);
      restyle();
      renderFull();
    });
  }
  els.angleRange.addEventListener('input', () => {
    els.angle.value = els.angleRange.value;
    updateState({ angle: Number(els.angleRange.value) });
    recomputeSoon();
  });
  els.reseed.addEventListener('click', () => {
    const seed = Math.floor(Math.random() * 999999);
    els.seed.value = String(seed);
    updateState({ seed });
    recompute({ animate: true, refit: true });
  });
}

function bindAppearance() {
  els.colorMode.addEventListener('change', () => {
    updateState({ colorMode: els.colorMode.value });
    restyle();
    renderFull();
  });
  els.animate.addEventListener('change', () => {
    if (!els.animate.checked) {
      finishAnimation();
    }
  });
  const syncMotion = () => {
    els.animate.disabled = reducedMotion.matches;
    els.animate.checked = !reducedMotion.matches;
    els.motionHint.hidden = !reducedMotion.matches;
  };
  syncMotion();
  reducedMotion.addEventListener('change', syncMotion);
  window.addEventListener('themechange', () => {
    // La couleur d'accent CSS change après l'attribut data-theme : on attend une frame.
    requestAnimationFrame(() => {
      restyle();
      finishAnimation();
      renderFull();
    });
  });
  els.themeToggle.addEventListener('click', () => toggleTheme());
}

function bindToolbar() {
  els.preset.addEventListener('change', () => {
    if (els.preset.value !== 'custom') {
      loadState(stateFromPreset(els.preset.value));
    }
  });
  els.iterDown.addEventListener('click', () => setIterations(app.state.iterations - 1));
  els.iterUp.addEventListener('click', () => setIterations(app.state.iterations + 1));
  els.replay.addEventListener('click', () => {
    if (!app.drawing) {
      return;
    }
    if (reducedMotion.matches || !els.animate.checked) {
      flashMessage('Animation désactivée : dessin affiché en entier.');
    }
    playGrowth();
  });
  els.toggleEditor.addEventListener('click', () => setEditorOpen(!els.panel.classList.contains('is-open')));
  els.exportPng.addEventListener('click', () => runExport(() => exportPng(app, els)));
  els.exportSvg.addEventListener('click', () => runExport(() => exportSvg(app, els)));
  els.copyLink.addEventListener('click', () => runExport(() => copyLink(`#${stateToHash(app.state)}`)));
}

/**
 * Exécute un export et rapporte le résultat sans boîte de dialogue bloquante.
 * @param {() => Promise<string>|string} task - Export
 */
async function runExport(task) {
  try {
    flashMessage(await task());
  } catch (error) {
    showAlert(error instanceof Error ? error.message : String(error));
  }
}

function setEditorOpen(open) {
  els.panel.classList.toggle('is-open', open);
  els.toggleEditor.setAttribute('aria-expanded', String(open));
  els.toggleEditor.textContent = open ? '▾ Réduire' : '✎ Éditer';
}

function zoomFromCenter(factor) {
  finishAnimation();
  app.autoView = false;
  app.view = zoomAt(app.view, factor, els.canvas.width / 2, els.canvas.height / 2, zoomLimits(app.fitted));
  renderInteractive();
}

function recenter() {
  finishAnimation();
  app.autoView = true;
  refit();
  renderFull();
}

function bindView() {
  attachGestures(els.canvas, {
    onStart: finishAnimation,
    onPan: (dx, dy) => {
      app.autoView = false;
      app.view = panBy(app.view, dx, dy);
      renderInteractive();
    },
    onPinch: (before, after) => {
      app.autoView = false;
      app.view = pinchView(app.view, before, after, zoomLimits(app.fitted));
      renderInteractive();
    },
    onZoom: (factor, x, y) => {
      app.autoView = false;
      app.view = zoomAt(app.view, factor, x, y, zoomLimits(app.fitted));
      renderInteractive();
    },
    onEnd: () => renderInteractive(),
  });
  els.canvas.addEventListener('keydown', (event) => {
    const action = KEY_ACTIONS[event.key];
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.recenter) {
      recenter();
    } else if (action.zoom) {
      zoomFromCenter(action.zoom);
    } else {
      finishAnimation();
      app.autoView = false;
      app.view = panBy(app.view, action.pan[0] * pixelRatio(), action.pan[1] * pixelRatio());
      renderInteractive();
    }
  });
  els.zoomIn.addEventListener('click', () => zoomFromCenter(1.5));
  els.zoomOut.addEventListener('click', () => zoomFromCenter(1 / 1.5));
  els.recenter.addEventListener('click', recenter);
  new ResizeObserver(resizeCanvas).observe(els.stage);
  window.addEventListener('hashchange', () => {
    const state = hashToState(location.hash);
    if (state && stateToHash(state) !== stateToHash(app.state)) {
      loadState(state);
    }
  });
}

function init() {
  populatePresets(els.preset);
  bindGrammar();
  bindNumbers();
  bindAppearance();
  bindToolbar();
  bindView();
  // Tablette en portrait : assez de hauteur pour ouvrir l'éditeur d'emblée.
  setEditorOpen(window.innerHeight >= 900);
  resizeCanvas();
  loadState(app.state);
}

init();
