import { readFileSync } from 'node:fs';
import { test, expect, activate } from './fixtures.js';
import { withOriginalStyles } from './original-styles.js';

/*
 * Caractérisation des styles calculés de Diese & Mat avant/après la
 * consolidation de style.css.
 *
 * Source : le vrai jeu (index.html, JavaScript réel, feuilles theme.css/ui.css).
 * Les panneaux mémo, clavier, synthé, métronome et accordeur sont le balisage réel
 * de index.html ; menu, exercice de note, exercice de rythme, progression et
 * réglages sont produits par l'orchestration réelle de App.
 *
 * Deux sortes d'états sont posés dans la page, jamais simulés hors du DOM réel :
 *  - états d'interaction réels (survol, focus, appui) ;
 *  - classes d'état que le JavaScript ajoute à un élément réel (tuner, métronome,
 *    clavier...), plus le balisage exact de l'historique de l'accordeur.
 * Le balisage inerte (fixture) ne couvre que les sélecteurs que le JavaScript
 * n'émet plus aujourd'hui (onglets de type, sections typées, préréglages).
 *
 * Deux contrats :
 *  - chaque mesure est lue sur le même DOM avec les CSS actuelles puis avec les CSS
 *    d'origine (withOriginalStyles) : toutes les propriétés, géométrie comprise,
 *    doivent être identiques, sans dépendre des polices de l'OS ;
 *  - le golden initial, immuable, fixe les éléments, états et propriétés attendus
 *    sans figer les valeurs résolues ni les états implicites du pointeur entre OS.
 *    Toutes les valeurs sont vérifiées exactement contre les CSS d'origine.
 */

const GOLDEN = new URL('./fixtures/dedup-music-styles-golden.json', import.meta.url);
const GAME = '/games/diese-et-mat/index.html';

const PROPERTIES = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-items', 'align-self', 'justify-content', 'gap', 'order',
  'grid-template-columns', 'grid-column-start', 'grid-column-end',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'box-sizing',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'overflow-x', 'overflow-y', 'visibility', 'opacity',
  'color', 'background-color', 'background-image', 'accent-color',
  'border-top-width', 'border-top-style', 'border-top-color',
  'border-right-width', 'border-right-style', 'border-right-color',
  'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
  'border-left-width', 'border-left-style', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'white-space',
  'cursor', 'pointer-events', 'user-select', 'appearance', 'filter',
  'transform', 'transition-property', 'transition-duration', 'transition-timing-function',
  'animation-name', 'animation-duration', 'animation-iteration-count',
  'content',
];

// Pseudo-éléments portés par la feuille : [sélecteur de l'hôte, pseudo].
const PSEUDOS = [
  ['.piano-keyboard', '::after'],
  ['.synth-slider-row input[type="range"]', '::-webkit-slider-thumb'],
];

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  laptop: { width: 1100, height: 800 },
  tablet: { width: 700, height: 900 },
  mobile: { width: 375, height: 700 },
};

// theme : valeur forcée dans data-theme ('system' laisse le thème suivre l'OS émulé).
const SCENARIOS = [
  { name: 'desktop-dark', viewport: 'desktop', theme: 'dark' },
  { name: 'desktop-light', viewport: 'desktop', theme: 'light' },
  { name: 'laptop-dark', viewport: 'laptop', theme: 'dark' },
  { name: 'tablet-dark', viewport: 'tablet', theme: 'dark' },
  { name: 'mobile-dark', viewport: 'mobile', theme: 'dark' },
  { name: 'mobile-light', viewport: 'mobile', theme: 'light' },
  { name: 'desktop-system-os-light', viewport: 'desktop', theme: 'system', os: 'light' },
  { name: 'mobile-system-os-dark', viewport: 'mobile', theme: 'system', os: 'dark' },
];

const FIXTURE_HTML = `
<div id="dedup-fixture">
  <div class="synth-section-typed active"><div class="synth-section-header">
    <span class="synth-section-title">Actif</span><span class="synth-section-badge">ON</span></div>
    <div class="synth-section-content"><p class="synth-info-text">Info</p></div></div>
  <div class="synth-section-typed"><div class="synth-section-header">
    <span class="synth-section-title">Inactif</span><span class="synth-section-badge">OFF</span></div>
    <div class="synth-section-content">Corps</div></div>
  <div class="synth-section-typed inactive">Masqué</div>
  <div class="synth-type-tabs">
    <button class="synth-type-tab active"><span class="tab-icon">A</span><span class="tab-label">Poly</span></button>
    <button class="synth-type-tab"><span class="tab-icon">B</span><span class="tab-label">FM</span></button>
  </div>
  <div class="synth-type-info">Description</div>
  <div class="synth-presets">
    <button class="synth-preset-btn active">Un</button><button class="synth-preset-btn">Deux</button>
  </div>
  <div class="synth-test"><button class="synth-test-btn">Test</button></div>
</div>`;

// Balisage exact de TunerController._updateHistoryDisplay.
const TUNER_HISTORY_HTML = ['in-tune', 'flat', 'sharp'].map(status => `
  <div class="tuner-history-note ${status}">
    <span class="note-name">La</span><span class="note-octave">4</span><span class="note-cents">+3</span>
  </div>`).join('');

const settle = page => page.evaluate(async () => {
  const animations = document.getAnimations();
  await Promise.all(animations.map(animation => {
    if (animation.effect.getComputedTiming().endTime === Infinity) {
      animation.pause();
      animation.currentTime = 0;
      return null;
    }
    return animation.finished.catch(() => null);
  }));
});

// Mesures lues avec les CSS d'origine sur le même DOM, alimentées par snapshot().
let originals = null;

// Retourne {clé -> propriétés} pour la racine et ses descendants (premier élément par clé).
async function snapshot(page, rootSelector, label, maxDepth = Infinity) {
  const current = await readSnapshot(page, rootSelector, label, maxDepth);
  Object.assign(originals, await withOriginalStyles(page, () => readSnapshot(page, rootSelector, label, maxDepth)));
  return current;
}

function readSnapshot(page, rootSelector, label, maxDepth) {
  return page.evaluate(({ rootSelector: root, label: prefix, properties, pseudos, depthLimit }) => {
    const result = {};
    const read = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return properties.map(name => style.getPropertyValue(name));
    };
    const keyOf = element => {
      const id = element.id ? `#${element.id}` : '';
      const classes = typeof element.className === 'string' && element.className
        ? `.${element.className.trim().split(/\s+/).join('.')}` : '';
      const type = element.matches('input') ? `[${element.type}]` : '';
      return `${prefix}|${element.tagName.toLowerCase()}${type}${id}${classes}`;
    };
    const rootElement = document.querySelector(root);
    if (!rootElement) { throw new Error(`Racine absente : ${root}`); }
    const depthOf = element => {
      let depth = 0;
      for (let node = element; node !== rootElement; node = node.parentElement) { depth += 1; }
      return depth;
    };
    for (const element of [rootElement, ...rootElement.querySelectorAll('*')]) {
      if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(element.tagName) || depthOf(element) > depthLimit) { continue; }
      const key = keyOf(element);
      if (!(key in result)) { result[key] = read(element); }
      for (const [selector, pseudo] of pseudos) {
        if (element.matches(selector) && !(`${key}${pseudo}` in result)) {
          result[`${key}${pseudo}`] = read(element, pseudo);
        }
      }
    }
    return result;
  }, { rootSelector, label, properties: PROPERTIES, pseudos: PSEUDOS, depthLimit: maxDepth });
}

// Applique des mutations réelles (classes, attributs, HTML), mesure puis restaure.
async function variant(page, rootSelector, label, mutations) {
  await page.evaluate(items => {
    window.__dedupRestore = [];
    for (const { selector, add = [], remove = [], disabled, html, append, index = 0 } of items) {
      const element = document.querySelectorAll(selector)[index];
      if (!element) { throw new Error(`Élément absent : ${selector}`); }
      const saved = { element, className: element.className, disabled: element.disabled, html: element.innerHTML };
      element.classList.add(...add);
      element.classList.remove(...remove);
      if (disabled !== undefined) { element.disabled = disabled; }
      if (html !== undefined) { element.innerHTML = html; saved.restoreHtml = true; }
      if (append !== undefined) {
        const holder = document.createElement('div');
        holder.innerHTML = append;
        saved.appended = [...holder.children];
        element.append(...saved.appended);
      }
      window.__dedupRestore.push(saved);
    }
  }, mutations);
  await settle(page);
  const result = await snapshot(page, rootSelector, label);
  await page.evaluate(() => {
    for (const saved of window.__dedupRestore.reverse()) {
      saved.element.className = saved.className;
      saved.element.disabled = saved.disabled;
      saved.appended?.forEach(node => node.remove());
      if (saved.restoreHtml) { saved.element.innerHTML = saved.html; }
    }
  });
  return result;
}

async function loadGame(page, scenario) {
  await page.setViewportSize(VIEWPORTS[scenario.viewport]);
  await page.emulateMedia({ colorScheme: scenario.os || 'dark', reducedMotion: 'no-preference' });
  await page.goto(GAME);
  await expect(page.locator('.exercise-card').first()).toBeVisible();
  await page.evaluate(theme => {
    if (theme === 'system') { document.documentElement.removeAttribute('data-theme'); } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, scenario.theme);
  await settle(page);
}

// Une interaction réelle sur le premier élément visible, puis le style de ce sous-arbre.
async function probe(page, label, selector, action) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  if (action === 'hover') { await target.hover(); }
  if (action === 'focus') { await target.focus(); }
  if (action === 'press') {
    await target.hover();
    await page.mouse.down();
  }
  await settle(page);
  const result = await snapshot(page, selector, `${label}:${action}`);
  if (action === 'press') {
    // L'appui est mesuré ; le clic de relâchement est bloqué pour ne pas fermer ou naviguer.
    await page.evaluate(() => window.addEventListener('click', event => event.stopImmediatePropagation(), { capture: true, once: true }));
    await page.mouse.up();
  }
  if (action === 'focus') { await target.blur(); }
  await page.mouse.move(0, 0);
  await settle(page);
  return result;
}

async function openPanel(page, name) {
  await activate(page.locator(`#btn-${name}`));
  await expect(page.locator(`#${name}-overlay`)).toHaveClass(/visible/);
  await settle(page);
}

async function closePanel(page, name) {
  await page.locator(`#${name}-close`).click();
  await expect(page.locator(`#${name}-overlay`)).not.toHaveClass(/visible/);
  await settle(page);
}

async function capture(page, scenario) {
  const out = {};
  originals = {};
  const add = part => Object.assign(out, part);
  await loadGame(page, scenario);

  // Menu complet, panneaux fermés, bannière audio masquée puis affichée.
  add(await snapshot(page, '.app-container', 'menu'));
  // Panneaux fermés : fond, popup et en-tête suffisent, le contenu est mesuré ouvert.
  for (const name of ['memo', 'piano', 'synth', 'metronome', 'tuner']) {
    add(await snapshot(page, `#${name}-overlay`, `${name}:closed`, 2));
  }
  add(await variant(page, '.audio-banner', 'menu:banner', [{ selector: '.audio-banner', remove: ['hidden'] }]));
  add(await variant(page, '.exercises-grid', 'menu:locked', [{ selector: '.exercise-card', add: ['locked'], index: 1 }]));
  add(await variant(page, '.exercises-grid', 'menu:extras', [
    { selector: '.exercises-grid', append: '<div class="no-results">Aucun résultat</div>' },
    { selector: '.exercise-card-meta', append: '<div class="exercise-card-progress">80%</div>' },
  ]));
  add(await variant(page, '.filters-bar', 'menu:filter-active', [{ selector: '.filter-btn', add: ['active'], index: 1 }]));
  for (const [label, selector, action] of [
    ['btn-icon', '.btn-icon', 'hover'],
    ['btn-icon', '.btn-icon', 'focus'],
    ['filter-btn', '.filter-btn:not(.active)', 'hover'],
    ['exercise-card', '.exercise-card:not(.locked)', 'hover'],
    ['exercise-card', '.exercise-card:not(.locked)', 'focus'],
    ['toggle', '.toggle-label', 'hover'],
  ]) { add(await probe(page, label, selector, action)); }

  // Mémo.
  await openPanel(page, 'memo');
  add(await snapshot(page, '#memo-overlay', 'memo:open'));
  for (const action of ['hover', 'focus']) { add(await probe(page, 'memo-close', '#memo-close', action)); }
  await closePanel(page, 'memo');

  // Clavier.
  await openPanel(page, 'piano');
  add(await snapshot(page, '#piano-overlay', 'piano:open'));
  add(await variant(page, '.piano-keyboard', 'piano:keys', [
    { selector: '.piano-key-white', add: ['active'] },
    { selector: '.piano-key-black', add: ['active'], index: 0 },
  ]));
  add(await variant(page, '.piano-fx', 'piano:fx', [
    { selector: '.piano-fx-slider', disabled: true },
  ]));
  for (const [label, selector, action] of [
    ['piano-close', '#piano-close', 'hover'],
    ['piano-select', '.piano-select', 'hover'],
    ['piano-select', '.piano-select', 'focus'],
    ['piano-octave', '.piano-octave-btn', 'hover'],
    ['piano-octave', '.piano-octave-btn', 'press'],
    ['piano-white', '.piano-key-white', 'hover'],
    ['piano-black', '.piano-key-black', 'hover'],
    ['piano-fx', '.piano-fx-toggle', 'hover'],
    ['piano-fx', '.piano-fx-slider', 'focus'],
  ]) { add(await probe(page, label, selector, action)); }
  await closePanel(page, 'piano');

  // Synthétiseur : chaque type réel affiche ses contrôles typés.
  await openPanel(page, 'synth');
  const types = ['poly', 'fm', 'pluck', 'membrane', 'metal', 'noise'];
  for (const type of types) {
    await page.locator('#synth-type-select').selectOption(type);
    await settle(page);
    add(await snapshot(page, type === 'poly' ? '#synth-overlay' : '.synth-content', `synth:${type}`));
  }
  await page.locator('#synth-type-select').selectOption('poly');
  add(await variant(page, '.synth-effects', 'synth:effects', [
    { selector: '.synth-effect', add: ['active'], index: 1 },
  ]));
  await page.locator('#synth-reverb-enabled').check();
  add(await snapshot(page, '.synth-effects', 'synth:reverb-checked'));
  await page.locator('#synth-reverb-enabled').uncheck();
  for (const [label, selector, action] of [
    ['synth-close', '#synth-close', 'hover'],
    ['synth-select', '#synth-preset-select', 'hover'],
    ['synth-select', '#synth-preset-select', 'focus'],
    ['synth-test', '#synth-test-btn', 'hover'],
    ['synth-test', '#synth-test-btn', 'press'],
    ['synth-osc', '.synth-osc-btn:not([aria-pressed="true"])', 'hover'],
    ['synth-slider', '#synth-attack', 'hover'],
    ['synth-slider', '#synth-attack', 'focus'],
    ['synth-checkbox', '.synth-checkbox', 'hover'],
  ]) { add(await probe(page, label, selector, action)); }
  add(await variant(page, '.synth-content', 'synth:fixture', [{ selector: '.synth-content', append: FIXTURE_HTML }]));
  await closePanel(page, 'synth');

  // Métronome.
  await openPanel(page, 'metronome');
  add(await snapshot(page, '#metronome-overlay', 'metronome:open'));
  add(await variant(page, '.metronome-content', 'metronome:states', [
    { selector: '.metronome-beat', add: ['active'], index: 0 },
    { selector: '.metronome-beat', add: ['active', 'downbeat'], index: 1 },
    { selector: '.metronome-play-btn', add: ['playing'] },
  ]));
  for (const [label, selector, action] of [
    ['metronome-close', '#metronome-close', 'hover'],
    ['metronome-tempo', '.metronome-tempo-btn', 'hover'],
    ['metronome-tempo', '.metronome-tempo-btn', 'focus'],
    ['metronome-play', '.metronome-play-btn', 'hover'],
    ['metronome-select', '#metronome-time-signature', 'focus'],
  ]) { add(await probe(page, label, selector, action)); }
  await closePanel(page, 'metronome');

  // Accordeur.
  await openPanel(page, 'tuner');
  add(await snapshot(page, '#tuner-overlay', 'tuner:open'));
  for (const status of ['in-tune', 'flat', 'sharp']) {
    add(await variant(page, '.tuner-note', `tuner:note-${status}`, [{ selector: '.tuner-note', add: [status] }]));
  }
  for (const status of ['error', 'active']) {
    add(await variant(page, '.tuner-status', `tuner:status-${status}`, [{ selector: '.tuner-status', add: [status] }]));
  }
  add(await variant(page, '.tuner-content', 'tuner:states', [
    { selector: '.tuner-btn', add: ['active'] },
    { selector: '.tuner-live-dot', add: ['active'] },
    { selector: '.tuner-history', html: TUNER_HISTORY_HTML },
  ]));
  add(await variant(page, '.tuner-live-indicator', 'tuner:detecting', [{ selector: '.tuner-live-dot', add: ['detecting'] }]));
  for (const [label, selector, action] of [
    ['tuner-close', '#tuner-close', 'hover'],
    ['tuner-btn', '.tuner-btn', 'hover'],
    ['tuner-btn', '.tuner-btn', 'focus'],
  ]) { add(await probe(page, label, selector, action)); }
  await closePanel(page, 'tuner');

  // Progression et réglages.
  await activate(page.locator('#btn-progress'));
  await expect(page.locator('#progress-view')).toBeVisible();
  add(await snapshot(page, '#progress-view', 'progress'));
  for (const action of ['hover', 'press']) { add(await probe(page, 'back-progress', '#btn-back-progress', action)); }
  await activate(page.locator('#btn-back-progress'));
  await activate(page.locator('#btn-settings'));
  await expect(page.locator('#settings-view')).toBeVisible();
  add(await snapshot(page, '#settings-view', 'settings'));
  add(await probe(page, 'back-settings', '#btn-back-settings', 'hover'));

  // Exercice de note : question réelle, puis retour de réponse.
  await loadGame(page, scenario);
  await activate(page.locator('.exercise-card:not(.locked)').first());
  await expect(page.locator('#exercise-view')).toBeVisible();
  await expect(page.locator('#note-buttons button').first()).toBeVisible();
  await settle(page);
  add(await snapshot(page, '#exercise-view', 'exercise-note'));
  await page.locator('#note-buttons button').first().click();
  await expect(page.locator('#feedback-container *').first()).toBeVisible();
  await settle(page);
  add(await snapshot(page, '#exercise-view', 'exercise-note:feedback'));

  // Exercice de rythme : balisage réel de RhythmController.
  await loadGame(page, scenario);
  await activate(page.locator('.exercise-card', { hasText: 'Rythme - Basique' }));
  await expect(page.locator('.rhythm-tap-zone')).toBeVisible();
  await settle(page);
  add(await snapshot(page, '#exercise-view', 'exercise-rhythm'));
  add(await variant(page, '.rhythm-container', 'exercise-rhythm:states', [
    { selector: '.rhythm-beat', add: ['active'], index: 0 },
    { selector: '.rhythm-beat', add: ['hit'], index: 1 },
    { selector: '.rhythm-beat', add: ['miss'], index: 2 },
    { selector: '.rhythm-tap-zone', add: ['pressed'] },
  ]));
  add(await probe(page, 'tap-zone', '.rhythm-tap-zone', 'hover'));
  add(await probe(page, 'tap-zone', '.rhythm-tap-zone', 'press'));
  return out;
}

function diffEntries(expectedProperties, expected, entries) {
  const differences = [];
  for (const key of new Set([...Object.keys(expected), ...Object.keys(entries)])) {
    if (!(key in entries)) { differences.push(`${key} : élément disparu`); continue; }
    if (!(key in expected)) { differences.push(`${key} : élément nouveau`); continue; }
    expectedProperties.forEach((property, index) => {
      if (expected[key][index] !== entries[key][index]) {
        differences.push(`${key} ${property} : ${expected[key][index]} -> ${entries[key][index]}`);
      }
    });
  }
  return differences;
}

test.describe('Diese & Mat : styles calculés conservés par la consolidation CSS', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name} : composants, panneaux, états et exercices`, async ({ page }) => {
      test.setTimeout(180_000);
      const entries = await capture(page, scenario);
      const original = originals;
      expect(Object.keys(entries).length).toBeGreaterThan(400);

      // Mêmes éléments, mêmes propriétés : CSS d'origine contre CSS actuelles, métriques identiques.
      expect(diffEntries(PROPERTIES, original, entries)).toEqual([]);

      const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
      const expected = golden.scenarios[scenario.name];
      expect(golden.properties).toEqual(PROPERTIES);
      expect(Object.keys(entries).sort()).toEqual(Object.keys(expected).sort());
      for (const values of Object.values(entries)) { expect(values).toHaveLength(PROPERTIES.length); }
    });
  }
});
