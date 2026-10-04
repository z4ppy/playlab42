import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

const fixtureUrl = new URL('./fixtures/dedup-shared-styles.json', import.meta.url);
const capture = process.env.DEDUP_SHARED_STYLES_CAPTURE === '1';
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

async function readStyles(page, selectors, pseudo = null) {
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

function readTokens(page) {
  return page.evaluate(names => {
    const style = getComputedStyle(document.documentElement);
    return {
      colorScheme: style.colorScheme,
      ...Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()])),
    };
  }, tokens);
}

async function hoverStyles(page, selectors) {
  const result = {};
  for (const [name, selector] of Object.entries(selectors)) {
    await page.locator(selector).hover();
    result[name] = (await readStyles(page, { [name]: selector }))[name];
  }
  await page.mouse.move(0, 0);
  return result;
}

async function focusStyles(page, selectors) {
  const result = {};
  for (const [name, selector] of Object.entries(selectors)) {
    await page.locator(selector).focus();
    result[name] = (await readStyles(page, { [name]: selector }))[name];
  }
  await page.locator(':focus').evaluate(element => element.blur());
  return result;
}

async function collect(page) {
  const matrix = {};
  const viewports = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const [reduced, motion] of [['mouvement normal', 'no-preference'], ['mouvement reduit', 'reduce']]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: motion });
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
    }
  }
  return matrix;
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

test('styles partages : declarations calculees stables entre themes, viewports, focus et mouvement reduit', async ({ page }) => {
  test.setTimeout(240_000);
  const matrix = await collect(page);
  if (capture) {
    writeFileSync(fixtureUrl, `${JSON.stringify(matrix, null, 2)}\n`);
    return;
  }
  const expected = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
  expectComplete(expected);
  expectComplete(matrix);
  expect(Object.keys(matrix)).toEqual(Object.keys(expected));
  for (const key of Object.keys(expected)) {
    expect(matrix[key], key).toEqual(expected[key]);
  }
});
