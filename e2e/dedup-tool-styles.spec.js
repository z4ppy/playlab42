import fs from 'node:fs';
import { test, expect, activate } from './fixtures.js';
import { withOriginalStyles } from './original-styles.js';

/**
 * Caractérisation des styles calculés des outils Relativity Lab, JSON Formatter
 * et Mes données locales : le refactoring des feuilles de style ne doit changer
 * aucune propriété calculée. Les mesures courantes sont comparées exactement à la
 * même capture rejouée avec les CSS d'origine (même navigateur, OS et DOM), donc
 * sans dépendre des métriques de polices. La référence figée
 * e2e/fixtures/dedup-tool-styles-golden.json, immuable, contraint les éléments,
 * propriétés et états. Toutes les valeurs sont vérifiées contre les CSS d'origine.
 */
const GOLDEN_URL = new URL('./fixtures/dedup-tool-styles-golden.json', import.meta.url);

// Propriétés géométriques et typographiques déclarées par les blocs concernés.
const LAYOUT_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
  'align-items', 'justify-content', 'row-gap', 'column-gap',
  'overflow-x', 'overflow-y', 'overscroll-behavior-x', 'transform',
  'grid-template-columns', 'grid-template-rows',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-transform', 'text-align', 'white-space', 'word-break', 'cursor', 'pointer-events',
  'user-select', 'touch-action', 'resize', 'opacity', 'backdrop-filter',
  'transition-property', 'transition-duration', 'animation-name', 'animation-duration',
  'outline-style', 'outline-width', 'outline-offset',
];
// Propriétés dépendantes de la palette claire, sombre ou système.
const COLOR_PROPS = [
  'color', 'background-color', 'background-image', 'box-shadow', 'outline-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
];
const THEMES = ['light', 'dark', 'system'];
const PREFERENCES = ['light', 'dark'];
const STATE_THEMES = ['light', 'dark'];

const STATE_TEMPLATES = {
  hover: ['hover'],
  active: ['hover', 'active'],
  focus: ['focus', 'focus-visible'],
};

// Éléments absents du DOM au repos : états et contenus générés à l'exécution.
const RELATIVITY_PROBES = `
  <div class="hud" data-probe="hud">
    <div class="panel-header" data-drag-handle><span class="panel-title">T</span><button class="panel-close">x</button></div>
    <span class="hud-state">Pause</span><span class="hud-state hud-state--running">Marche</span>
    <div class="hud-section"><div class="hud-label">L</div><select class="hud-select"><option>A</option></select></div>
    <div class="hud-divider"></div>
    <div class="hud-my-name">N</div><div class="hud-my-tau">1</div>
    <div class="hud-section hud-row"><div><div class="hud-label">L</div><div class="hud-my-cmb">1</div></div><div><div class="hud-label">L</div><div class="hud-my-mass">2</div></div></div>
    <div class="hud-my-emissions">
      <div class="hud-emission hud-emission--h"><span class="hud-emission-label">H</span><span class="hud-emission-value">1</span></div>
      <div class="hud-emission hud-emission--v"><span class="hud-emission-label">V</span><span class="hud-emission-value">2</span></div>
    </div>
    <div class="hud-received-list">
      <div class="hud-no-received">aucune</div>
      <div class="hud-received-item"><span class="hud-received-name">B</span>
        <span class="hud-received-ticks"><span class="hud-tick hud-tick--h">1</span><span class="hud-tick hud-tick--v">2</span></span>
        <span class="hud-inferred-gamma">γ</span><span class="hud-received-distance">3</span></div>
    </div>
    <div class="hud-observer-meta"><span class="hud-meta-item">m</span></div>
    <div class="hud-help">aide</div>
  </div>
  <div class="observer-view" data-probe="observer">
    <div class="observer-view-header"><span class="observer-view-title">T</span><span class="observer-view-name">N</span></div>
    <div class="observer-view-section"><div class="observer-view-label">L</div><div class="observer-view-tau">1</div></div>
    <div class="observer-view-clocks">
      <div class="ov-clock ov-clock--h"><span class="ov-clock-icon">H</span><span class="ov-clock-value">1</span></div>
      <div class="ov-clock ov-clock--v"><span class="ov-clock-icon">V</span><span class="ov-clock-value">2</span></div>
    </div>
    <div class="observer-view-divider"></div>
    <div class="observer-view-received">
      <div class="ov-received-observer"><span class="ov-received-name">B</span><span class="ov-received-clocks">
        <div class="ov-clock ov-clock--h ov-clock--small"><span class="ov-clock-icon">H</span><span class="ov-clock-value">1</span></div>
        <div class="ov-clock ov-clock--v ov-clock--small"><span class="ov-clock-icon">V</span><span class="ov-clock-value">2</span></div></span></div>
      <div class="ov-received-observer ov-received-observer--empty"><span class="ov-received-name">C</span></div>
      <div class="ov-no-data">rien</div>
    </div>
  </div>
  <div class="motor-panel" data-probe="motor">
    <div class="motor-panel-header"><span class="motor-panel-title">M</span><span class="motor-panel-status">Prêt</span></div>
    <span class="motor-panel-status motor-panel-status--burning">B</span>
    <span class="motor-panel-status motor-panel-status--success">S</span>
    <span class="motor-panel-status motor-panel-status--error">E</span>
    <div class="motor-panel-section"><div class="motor-panel-label">L</div>
      <div class="motor-panel-mass"><span class="motor-mass-value">1</span><span class="motor-mass-unit">kg</span></div>
      <div class="motor-mass-bar"><div class="motor-mass-fill"></div></div></div>
    <div class="motor-panel-section motor-panel-section--small"><div class="motor-direction-controls">
      <div class="motor-direction-row"><label>x</label><input type="range"><span>0</span></div>
      <div class="motor-direction-presets"><button class="motor-preset">↑</button></div></div></div>
    <div class="motor-impulse-controls"><input type="range"><span>1</span></div>
    <div class="motor-impulse-info"><span>a</span><span>b</span></div>
    <div class="motor-thrust-controls">
      <button class="motor-thrust-btn motor-thrust-btn--forward">F</button>
      <button class="motor-thrust-btn motor-thrust-btn--backward">B</button>
      <button class="motor-thrust-btn motor-thrust-btn--fire">X</button>
      <button class="motor-thrust-btn motor-thrust-btn--fire" disabled>D</button>
    </div>
    <div class="motor-history"><div class="motor-history-empty">vide</div>
      <div class="motor-history-item"><span class="motor-history-tau">1</span><span class="motor-history-dv">2</span><span class="motor-history-mass">3</span></div></div>
  </div>
  <div class="doppler-graph" data-probe="doppler">
    <div class="doppler-graph-header"><span class="doppler-graph-title">D</span><select class="doppler-graph-timewindow"><option>5</option></select></div>
    <div class="doppler-graph-legend"><span class="doppler-legend-item doppler-legend--red">r</span>
      <span class="doppler-legend-item doppler-legend--green">g</span><span class="doppler-legend-item doppler-legend--blue">b</span></div>
    <div class="doppler-graph-canvas-wrapper"><canvas class="doppler-graph-canvas"></canvas></div>
  </div>
  <div class="clock-panel" data-probe="clock">
    <div class="panel-header"><span class="panel-title">O</span>
      <div class="oscillo-controls"><select class="oscillo-select"><option>1</option></select></div></div>
    <div class="oscillo-hint">astuce</div>
    <div class="oscillo-canvas-wrapper"><canvas></canvas></div>
    <div class="oscillo-legend"><span class="oscillo-legend-item"><span class="oscillo-legend-color"></span>A</span></div>
  </div>
  <div class="simulation-actions" data-probe="actions">
    <button class="play-button"><span class="play-button-icon">▶</span><span class="play-button-text">Play</span></button>
    <button class="play-button play-button--running"><span class="play-button-icon">⏸</span><span class="play-button-text">Pause</span></button>
    <button class="reset-button">↺ Reset</button>
  </div>
  <div class="loading" data-probe="loading">Chargement</div>
`;

const RELATIVITY_ROOTS = [
  ['html', false], ['body', false], ['.app-container', false], ['#canvas-container', false],
  ['#panels', false], ['.simulation-actions:not([data-probe])', false],
  ['#hud', true], ['#clock-panel', true], ['#observer-view', true], ['#motor-panel', true],
  ['#doppler-graph', true], ['#play-button', true], ['#reset-button', false],
  ['.lil-gui.root', false], ['.lil-gui .title', false], ['#probe-panels', true],
];
const RELATIVITY_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'court', width: 1280, height: 640 },
  { name: 'tablette', width: 1000, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const RELATIVITY_STATES = [
  ['#play-button', 'active'], ['#play-button', 'focus'], ['#reset-button', 'hover'], ['#reset-button', 'focus'],
  ['#motor-forward', 'hover'], ['#motor-forward', 'active'], ['#motor-forward', 'focus'],
  ['#motor-backward', 'hover'], ['#motor-fire', 'hover'], ['#motor-fire', 'focus'],
  ['.motor-preset', 'hover'], ['.panel-close', 'hover'], ['.hud-select', 'hover'], ['.hud-select', 'focus'],
  ['.doppler-graph-timewindow', 'hover'], ['.oscillo-select', 'hover'], ['[data-drag-handle]', 'active'],
  ['[data-probe="motor"] .motor-thrust-btn--fire', 'hover'], ['[data-probe="motor"] .motor-preset', 'hover'],
  ['[data-probe="hud"] .hud-select', 'focus'], ['[data-probe="hud"] .panel-close', 'hover'],
  ['[data-probe="hud"] [data-drag-handle]', 'active'], ['[data-probe="doppler"] .doppler-graph-timewindow', 'hover'],
  ['[data-probe="clock"] .oscillo-select', 'hover'], ['[data-probe="actions"] .play-button', 'active'],
  ['[data-probe="actions"] .play-button--running', 'active'], ['[data-probe="actions"] .reset-button', 'hover'],
];

const JSON_ROOTS = [
  ['html', false], ['body', false], ['header', true], ['main', true], ['footer', true], ['#copy-status', false],
];
const JSON_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablette', width: 700, height: 800 },
  { name: 'mobile', width: 390, height: 800 },
];
const JSON_STATES = [
  ['#btn-format', 'hover'], ['#btn-format', 'active'], ['#btn-format', 'focus'],
  ['#btn-minify', 'hover'], ['#btn-minify', 'active'], ['#btn-minify', 'focus'],
  ['#btn-copy', 'hover'], ['#input', 'focus'], ['#output', 'focus'], ['.kbd', 'hover'],
];

const LOCAL_ROOTS = [
  ['html', false], ['body', false], ['main', true],
];
const LOCAL_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 800 },
  { name: 'etroit', width: 320, height: 640 },
];
const LOCAL_STATES = [
  ['#export', 'hover'], ['#export', 'active'], ['#export', 'focus'], ['#import', 'hover'],
  ['#import', 'focus'], ['#backup-file', 'hover'], ['#backup-file', 'focus'],
];

function readGolden() {
  return JSON.parse(fs.readFileSync(GOLDEN_URL, 'utf8'));
}

const RUNTIME_PROPS = [...LAYOUT_PROPS.filter(name => !/^(width|height|min-|max-|grid|top|right|bottom|left)/.test(name)), ...COLOR_PROPS];

function valueShape(text) {
  const parts = text.split('|');
  const names = [LAYOUT_PROPS, [...LAYOUT_PROPS, ...COLOR_PROPS], RUNTIME_PROPS, COLOR_PROPS].find(list => list.length === parts.length);
  expect(names, `Valeur de style inattendue : ${text.slice(0, 40)}`).toBeDefined();
  return names;
}

function expandVariants(variants) {
  const [[, base]] = Object.entries(variants);
  return Object.fromEntries(Object.entries(variants).map(([name, values]) => [name, { ...base, ...values }]));
}

function normalizeForGolden(value) {
  if (typeof value === 'string') { return valueShape(value); }
  if (value.layout && value.colors) {
    const expanded = { ...value, layout: expandVariants(value.layout), colors: expandVariants(value.colors) };
    return Object.fromEntries(Object.entries(expanded).map(([key, inner]) => [key, normalizeForGolden(inner)]));
  }
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, normalizeForGolden(inner)]));
}

// Chaque élément et état mesuré doit exister explicitement : jamais de dictionnaire vide ni de sélecteur manqué.
const REQUIRED = {
  relativity: ['#hud[0]', '#clock-panel[0]', '#observer-view[0]', '#motor-panel[0]', '#doppler-graph[0]', '#play-button[0]',
    '#reset-button[0]', '#probe-panels[0]>0div.hud', '#probe-panels[0]>2div.motor-panel', '#probe-panels[0]>4div.clock-panel'],
  'json-formatter': ['header[0]', 'main[0]', 'footer[0]', 'header[0]>1div.actions>2button.primary#btn-format', 'main[0]>0div.panel>0div.panel-header'],
  'local-data': ['main[0]', 'main[0]>3section'],
};

function expectCoverage(name, actual) {
  const groups = name === 'relativity' ? [actual] : name === 'sans-javascript' ? [] : Object.values(actual).filter(value => value.layout);
  for (const group of groups) {
    const base = Object.values(group.layout)[0];
    const colorBase = Object.values(group.colors)[0];
    expect(Object.keys(base).length, `${name}: layout vide`).toBeGreaterThan(5);
    expect(Object.keys(colorBase).length, `${name}: couleurs vides`).toBeGreaterThan(5);
    for (const key of REQUIRED[name] ?? []) {
      expect(Object.keys(base).some(candidate => candidate.startsWith(key)), `${name}: ${key} absent`).toBe(true);
    }
    expect(Object.keys(group.states).length, `${name}: états manquants`).toBeGreaterThan(5);
  }
  if (name === 'json-formatter') {
    expect(Object.keys(actual.copie_desactivee)).toHaveLength(STATE_THEMES.length);
  }
  if (name === 'relativity') {
    expect(Object.keys(actual.states)).toHaveLength(RELATIVITY_STATES.length * STATE_THEMES.length);
  }
  if (name === 'sans-javascript') {
    expect(Object.keys(actual)).toHaveLength(8);
    for (const values of Object.values(actual)) {
      expect(Object.keys(values).length).toBeGreaterThan(5);
    }
  }
}

function checkGolden(name, actual) {
  expectCoverage(name, actual);
  const golden = readGolden();
  expect(golden.meta, 'Références absentes').toEqual({ layoutProps: LAYOUT_PROPS, colorProps: COLOR_PROPS });
  expect(normalizeForGolden(actual)).toEqual(normalizeForGolden(golden.pages[name]));
}

// Même capture sous les CSS d'origine puis sous les CSS courants, dans le même navigateur et DOM.
async function paired(page, label, measure) {
  const current = await measure();
  const original = await withOriginalStyles(page, measure);
  expect(current, `${label} : styles calculés courants et d'origine`).toEqual(original);
  return current;
}

// Les transitions de thème et d'état doivent être terminées avant lecture.
async function settle(page) {
  await page.evaluate(() => {
    // La lecture forcée du style démarre les transitions ; on les amène à leur valeur finale.
    getComputedStyle(document.documentElement).color;
    for (const animation of document.getAnimations()) {
      if (animation.effect.getComputedTiming().iterations === Infinity) {
        animation.cancel();
      } else {
        animation.finish();
      }
    }
  });
}

// Les gestionnaires de redimensionnement des canvas finissent après l'évènement : on attend un état stable.
async function capture(page, roots, props) {
  let previous = await captureOnce(page, roots, props);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.waitForTimeout(100);
    const current = await captureOnce(page, roots, props);
    if (JSON.stringify(current) === JSON.stringify(previous)) { return current; }
    previous = current;
  }
  throw new Error('Styles calcules instables');
}

function captureOnce(page, roots, props) {
  return page.evaluate(({ roots: targets, props: names }) => {
    const out = {};
    const label = element => `${element.tagName.toLowerCase()}${[...element.classList].map(name => `.${name}`).join('')}${element.id ? `#${element.id}` : ''}`;
    const walk = (element, key, deep) => {
      const style = getComputedStyle(element);
      out[key] = names.map(name => style.getPropertyValue(name)).join('|');
      if (deep) {
        [...element.children].forEach((child, index) => walk(child, `${key}>${index}${label(child)}`, true));
      }
    };
    for (const [selector, deep] of targets) {
      document.querySelectorAll(selector).forEach((element, index) => walk(element, `${selector}[${index}]`, deep));
    }
    return out;
  }, { roots, props });
}

async function setTheme(page, theme, preference) {
  await page.emulateMedia({ colorScheme: preference });
  await page.evaluate(value => {
    if (value === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', value);
    }
  }, theme);
  await settle(page);
}

async function resetTheme(page) {
  await setTheme(page, 'system', 'dark');
}

async function captureLayout(page, roots, viewports) {
  const layout = {};
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settle(page);
    layout[viewport.name] = await capture(page, roots, LAYOUT_PROPS);
  }
  await page.setViewportSize({ width: viewports[0].width, height: viewports[0].height });
  await settle(page);
  return layout;
}

async function captureColors(page, roots) {
  const colors = {};
  for (const preference of PREFERENCES) {
    for (const theme of THEMES) {
      await setTheme(page, theme, preference);
      colors[`${theme}/${preference}`] = await capture(page, roots, COLOR_PROPS);
    }
  }
  await resetTheme(page);
  return colors;
}

// Hover, focus et active sont forcés via CDP : aucun survol réel ne dépend de la superposition des panneaux.
async function captureStates(page, targets) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const states = {};
  for (const theme of STATE_THEMES) {
    await setTheme(page, theme, theme);
    for (const [selector, kind] of targets) {
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      expect(nodeId, `Cible ${selector} introuvable`).toBeGreaterThan(0);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: STATE_TEMPLATES[kind] });
      await settle(page);
      const values = await page.evaluate(({ selector: target, props }) => {
        const style = getComputedStyle(document.querySelector(target));
        return props.map(name => style.getPropertyValue(name)).join('|');
      }, { selector, props: [...LAYOUT_PROPS, ...COLOR_PROPS] });
      states[`${theme}:${kind}:${selector}`] = values;
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
  }
  await resetTheme(page);
  await cdp.detach();
  return states;
}

// La première variante est complète ; les autres ne listent que leurs écarts.
function withDifferences(variants) {
  const [[baseName, base], ...others] = Object.entries(variants);
  const result = { [baseName]: base };
  for (const [name, values] of others) {
    result[name] = Object.fromEntries(Object.entries(values).filter(([key, value]) => base[key] !== value));
  }
  return result;
}

async function snapshot(page, { roots, viewports, states }) {
  const layout = withDifferences(await captureLayout(page, roots, viewports));
  const colors = withDifferences(await captureColors(page, roots));
  return { layout, colors, states: await captureStates(page, states) };
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test('Relativity: styles calcules des panneaux, etats generes, themes et responsive', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#canvas-container canvas')).toBeVisible();
  await expect(page.locator('#motor-forward')).toBeVisible();
  await page.evaluate(html => {
    const host = document.createElement('section');
    host.className = 'panels';
    host.id = 'probe-panels';
    host.inert = true;
    host.innerHTML = html;
    document.querySelector('.app-container').append(host);
  }, RELATIVITY_PROBES);
  const options = { roots: RELATIVITY_ROOTS, viewports: RELATIVITY_VIEWPORTS, states: RELATIVITY_STATES };
  const result = await paired(page, 'Relativity', () => snapshot(page, options));
  // Etat reel d'execution : lecture lancee puis moteur declenche.
  await activate(page.locator('#play-button'));
  await expect(page.locator('#play-button')).toHaveClass(/play-button--running/);
  await activate(page.locator('#motor-fire'));
  await expect(page.locator('.motor-history-item').first()).toBeVisible();
  await settle(page);
  result.runtime = await paired(page, 'Relativity en lecture', () =>
    capture(page, [['#play-button', true], ['#hud .hud-state', false]], RUNTIME_PROPS));
  expect(Object.keys(result.runtime).length).toBeGreaterThan(2);
  checkGolden('relativity', result);
});

test('JSON Formatter: styles calcules vide/valide/invalide, themes et responsive', async ({ page }) => {
  await page.goto('/tools/json-formatter.html');
  await expect(page.locator('#input')).toBeFocused();
  const options = { roots: JSON_ROOTS, viewports: JSON_VIEWPORTS, states: JSON_STATES };
  const result = { vide: await paired(page, 'JSON vide', () => snapshot(page, options)) };
  await page.locator('#input').fill('{"nom":"Ada","age":36,"ok":true,"rien":null,"liste":[1,2.5]}');
  await activate(page.locator('#btn-format'));
  await expect(page.locator('#status')).toHaveClass(/valid/);
  await expect(page.locator('#output .key')).toHaveCount(5);
  await expect(page.locator('#output .boolean, #output .null, #output .string, #output .number').first()).toBeVisible();
  result.valide = await paired(page, 'JSON valide', () => snapshot(page, options));
  await page.locator('#btn-copy').evaluate(button => { button.disabled = true; });
  result.copie_desactivee = await paired(page, 'JSON copie désactivée', () => captureStates(page, [['#btn-copy', 'hover']]));
  await page.locator('#btn-copy').evaluate(button => { button.disabled = false; });
  await page.locator('#input').fill('{"nom": }');
  await activate(page.locator('#btn-format'));
  await expect(page.locator('#status')).toHaveClass(/invalid/);
  await expect(page.locator('#output')).toHaveClass(/error/);
  await expect(page.locator('#input')).toHaveAttribute('aria-invalid', 'true');
  result.invalide = await paired(page, 'JSON invalide', () => snapshot(page, options));
  checkGolden('json-formatter', result);
});

test('Mes donnees locales: styles calcules, erreur de restauration, themes et responsive', async ({ page }) => {
  await page.goto('/tools/local-data/index.html');
  await expect(page.locator('#export')).toBeVisible();
  const options = { roots: LOCAL_ROOTS, viewports: LOCAL_VIEWPORTS, states: LOCAL_STATES };
  const result = { initial: await paired(page, 'Données locales', () => snapshot(page, options)) };
  await activate(page.locator('#import'));
  await expect(page.locator('#status')).not.toHaveText('Aucune opération effectuée.');
  result.erreur = await paired(page, 'Données locales en erreur', () => snapshot(page, options));
  await page.locator('#export').evaluate(button => { button.disabled = true; });
  result.desactive = await paired(page, 'Données locales désactivées', () =>
    capture(page, [['#export', false]], [...LAYOUT_PROPS, ...COLOR_PROPS]));
  checkGolden('local-data', result);
});

test('Sans JavaScript: JSON Formatter et Mes donnees locales gardent leurs styles statiques', async ({ browser, baseURL }) => {
  const result = {};
  for (const [name, path, roots] of [
    ['json-formatter', '/tools/json-formatter.html', JSON_ROOTS],
    ['local-data', '/tools/local-data/index.html', LOCAL_ROOTS],
  ]) {
    for (const preference of PREFERENCES) {
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
        const context = await browser.newContext({ baseURL, javaScriptEnabled: false, colorScheme: preference, viewport });
        const page = await context.newPage();
        await page.goto(path);
        result[`${name}/${preference}/${viewport.width}`] = await paired(page, `${name} sans JavaScript`, () =>
          capture(page, roots, [...LAYOUT_PROPS, ...COLOR_PROPS]));
        await context.close();
      }
    }
  }
  checkGolden('sans-javascript', result);
});
