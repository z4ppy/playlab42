import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';
import { withOriginalStyles } from './original-styles.js';

const fixtureUrl = new URL('./fixtures/dedup-shared-styles.json', import.meta.url);
const epicId = 'hello-playlab42';

const properties = [
  'color', 'background-color', 'background-image', 'border-top-width', 'border-top-style',
  'border-top-color', 'border-right-width', 'border-right-style', 'border-bottom-width',
  'border-bottom-style', 'border-left-width', 'border-left-style', 'border-top-left-radius',
  'border-bottom-right-radius', 'font-size', 'font-weight', 'cursor', 'text-align',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'min-height', 'width',
  'display', 'align-items', 'column-gap', 'transition-property', 'transition-duration',
  'transition-timing-function', 'outline-style', 'box-shadow',
];

const tokens = [
  '--color-bg', '--color-bg-secondary', '--color-bg-card', '--color-bg-hover', '--color-text',
  '--color-text-muted', '--color-text-inverse', '--color-accent', '--color-accent-hover',
  '--color-accent-light', '--color-success', '--color-success-light', '--color-error',
  '--color-error-light', '--color-warning', '--color-info', '--color-border', '--color-shadow',
  '--color-syntax-string', '--color-syntax-number', '--color-syntax-boolean',
  '--color-syntax-null', '--color-syntax-key',
];

const themes = {
  'data-theme dark, preference light': { attribute: 'dark', scheme: 'light' },
  'data-theme light, preference dark': { attribute: 'light', scheme: 'dark' },
  'sans data-theme, preference dark': { attribute: null, scheme: 'dark' },
  'sans data-theme, preference light': { attribute: null, scheme: 'light' },
};

const homeTargets = {
  settings: '#btn-settings',
  searchInput: '.search-bar input',
  back: '#btn-back',
  fullscreen: '#btn-fullscreen',
  sound: '#btn-sound',
  closeSettings: '#btn-close-settings',
  pseudoInput: '#input-pseudo',
};
const viewerTargets = {
  menuToggle: '.pv-menu-toggle >> nth=0',
  menuItem: '.pv-menu-slide:not(.current):not(.visited) .pv-menu-item >> nth=0',
  currentItem: '.pv-menu-slide.current .pv-menu-item',
};

async function setTheme(page, { attribute, scheme }) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.evaluate(value => {
    const root = document.documentElement;
    if (value === null) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', value);
    }
  }, attribute);
}

async function readCurrent(page, selectors, pseudo = null) {
  const result = {};
  for (const [name, selector] of Object.entries(selectors)) {
    // Une transition en cours donne des valeurs intermediaires : attendre deux lectures identiques.
    let previous = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await page.locator(selector).evaluate((element, { properties, pseudo }) => {
        const style = getComputedStyle(element, pseudo);
        return Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
      }, { properties, pseudo });
      result[name] = current;
      if (previous && JSON.stringify(previous) === JSON.stringify(current)) {
        break;
      }
      previous = current;
      await page.waitForTimeout(80);
    }
  }
  return result;
}

function readTokensCurrent(page) {
  return page.evaluate(names => {
    const style = getComputedStyle(document.documentElement);
    return {
      colorScheme: style.colorScheme,
      ...Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()])),
    };
  }, tokens);
}

// Meme DOM, meme etat d'interaction : lecture sous les CSS refactorees puis sous celles du main de depart.
async function both(page, read) {
  return { current: await read(), original: await withOriginalStyles(page, read) };
}

function readStyles(page, selectors, pseudo = null) {
  return both(page, () => readCurrent(page, selectors, pseudo));
}

function readTokens(page) {
  return both(page, () => readTokensCurrent(page));
}

async function perElement(page, selectors, interact, cleanup) {
  const result = { current: {}, original: {} };
  for (const [name, selector] of Object.entries(selectors)) {
    await interact(page.locator(selector));
    const pair = await readStyles(page, { [name]: selector });
    result.current[name] = pair.current[name];
    result.original[name] = pair.original[name];
  }
  await cleanup();
  return result;
}

function hoverStyles(page, selectors) {
  return perElement(page, selectors, locator => locator.hover(), () => page.mouse.move(0, 0));
}

function focusStyles(page, selectors) {
  return perElement(page, selectors, locator => locator.focus(),
    () => page.locator(':focus').evaluate(element => element.blur()));
}

const viewports = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };
const motions = { 'mouvement normal': 'no-preference', 'mouvement reduit': 'reduce' };

async function collect(page, viewportName, reduced) {
  const matrix = {};
  await page.setViewportSize(viewports[viewportName]);
  await page.emulateMedia({ reducedMotion: motions[reduced] });
  for (const [themeName, theme] of Object.entries(themes)) {
    const key = `${viewportName} / ${reduced} / ${themeName}`;
    await page.goto('/');
    await expect(page.locator('#btn-settings')).toBeVisible();
    await setTheme(page, theme);
    const entry = { tokens: await readTokens(page), home: await readStyles(page, homeTargets) };
    entry.placeholder = await readStyles(page, { searchInput: '.search-bar input' }, '::placeholder');
    entry.homeHover = await hoverStyles(page, {
      settings: '#btn-settings', searchInput: '.search-bar input',
    });
    entry.homeFocus = await focusStyles(page, {
      settings: '#btn-settings', searchInput: '.search-bar input',
    });
    await page.locator('#btn-settings').click();
    await expect(page.locator('#btn-close-settings')).toBeVisible();
    entry.settingsHover = await hoverStyles(page, { closeSettings: '#btn-close-settings' });
    entry.settingsFocus = await focusStyles(page, {
      closeSettings: '#btn-close-settings', pseudoInput: '#input-pseudo',
    });
    await page.goto(`/#/parcours/${epicId}/04-creer-outil`);
    await expect(page.locator('.pv-menu-item').first()).toBeAttached();
    await setTheme(page, theme);
    await page.locator('.parcours-viewer').evaluate(element => element.classList.add('menu-open'));
    entry.viewer = await readStyles(page, viewerTargets);
    entry.viewerHover = await hoverStyles(page, viewerTargets);
    entry.viewerFocus = await focusStyles(page, viewerTargets);
    matrix[key] = entry;
  }
  return {
    current: Object.fromEntries(Object.entries(matrix).map(([key, entry]) => [key, side(entry, 'current')])),
    original: Object.fromEntries(Object.entries(matrix).map(([key, entry]) => [key, side(entry, 'original')])),
  };
}

function side(entry, name) {
  return Object.fromEntries(Object.entries(entry).map(([group, pair]) => [group, pair[name]]));
}

const expectedGroups = {
  home: Object.keys(homeTargets),
  placeholder: ['searchInput'],
  homeHover: ['settings', 'searchInput'],
  homeFocus: ['settings', 'searchInput'],
  settingsHover: ['closeSettings'],
  settingsFocus: ['closeSettings', 'pseudoInput'],
  viewer: Object.keys(viewerTargets),
  viewerHover: Object.keys(viewerTargets),
  viewerFocus: Object.keys(viewerTargets),
};

// Interdit un dictionnaire vide ou un selecteur manque : chaque etat mesure existe et porte toutes les proprietes.
function expectComplete(matrix) {
  for (const [key, entry] of Object.entries(matrix)) {
    expect(Object.keys(entry.tokens), key).toHaveLength(tokens.length + 1);
    // Canvas et Three.js lisent ces valeurs via getPropertyValue : elles doivent etre des couleurs litterales.
    for (const name of tokens) {
      expect(entry.tokens[name], `${key} / ${name}`).toMatch(/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,]+\))$/i);
    }
    for (const [group, names] of Object.entries(expectedGroups)) {
      expect(Object.keys(entry[group]), `${key} / ${group}`).toEqual(names);
      for (const name of names) {
        expect(Object.keys(entry[group][name]), `${key} / ${group} / ${name}`).toEqual(properties);
        expect(entry[group][name]['border-top-style'], `${key} / ${group} / ${name}`).not.toBe('');
      }
    }
  }
}

// Les dimensions dependent des polices de l'OS : elles sont comparees seulement a la capture originale du meme navigateur.
function withoutWidth(matrix) {
  return JSON.parse(JSON.stringify(matrix, (name, value) => (name === 'width' ? undefined : value)));
}

for (const viewportName of Object.keys(viewports)) {
  for (const reduced of Object.keys(motions)) {
    test(`styles partages ${viewportName} / ${reduced} : identiques aux CSS originaux, themes, focus et survol`, async ({ page }) => {
      test.setTimeout(240_000);
      const { current, original } = await collect(page, viewportName, reduced);
      const golden = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
      const prefix = `${viewportName} / ${reduced} / `;
      const keys = Object.keys(golden).filter(key => key.startsWith(prefix));
      expect(keys).toHaveLength(Object.keys(themes).length);
      expectComplete(Object.fromEntries(keys.map(key => [key, golden[key]])));
      expectComplete(original);
      expectComplete(current);
      expect(Object.keys(current)).toEqual(keys);
      for (const key of keys) {
        expect(current[key], key).toEqual(original[key]);
        expect(withoutWidth(current[key]), key).toEqual(withoutWidth(golden[key]));
      }
    });
  }
}
