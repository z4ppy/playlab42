import { readFileSync, writeFileSync } from 'node:fs';
import { test as playlabTest, expect, activate } from './fixtures.js';
import { test as baseTest } from '@playwright/test';

/*
 * Caracterisation des styles calcules des quatre pages de jeu qui partagent des
 * regles CSS. Le golden est produit avant refactoring, puis rejoue apres : seules
 * les declarations effectives comptent, pas l'emplacement des regles.
 * Regeneration volontaire : UPDATE_DEDUP_GAME_STYLES=1 (mode serie, un seul worker).
 */
const GOLDEN_URL = new URL('./fixtures/dedup-game-styles.golden.json', import.meta.url);
const UPDATE = process.env.UPDATE_DEDUP_GAME_STYLES === '1';

const PROPERTIES = [
  'display', 'position', 'z-index', 'visibility', 'box-sizing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset',
  'background-color', 'background-image', 'color', 'opacity', 'transform', 'filter', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'list-style-type',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-items', 'align-self', 'justify-content', 'row-gap', 'column-gap', 'grid-template-columns',
  'cursor', 'pointer-events', 'overflow-x', 'overflow-y',
  'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay',
  'animation-name', 'animation-duration', 'content',
];

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 500, height: 800 },
  mobile: { width: 375, height: 667 },
};

// Systeme : preference navigateur sans data-theme ; theme-* : attribut explicite contre la preference.
const SCHEMES = {
  'system-dark': { colorScheme: 'dark' },
  'system-light': { colorScheme: 'light' },
  'theme-dark': { colorScheme: 'light', theme: 'dark' },
  'theme-light': { colorScheme: 'dark', theme: 'light' },
};

// Les schemas ne changent que les variables de couleur, les largeurs que les media queries.
const INITIAL_MATRIX = [
  ['system-dark', 'desktop'], ['system-light', 'desktop'], ['theme-dark', 'desktop'], ['theme-light', 'desktop'],
  ['system-dark', 'tablet'], ['system-dark', 'mobile'], ['theme-light', 'mobile'],
];

// Elements rendus par du JS ou par un etat, instancies sans jouer pour couvrir chaque regle.
const GAMES = {
  checkers: {
    path: '/games/checkers/index.html',
    ready: '#board button',
    probes: `
      <div class="game-container"><div class="info-panel"><div class="status player-turn">Tour</div></div>
        <div class="board">
          <button class="square dark"></button><button class="square light"></button>
          <button class="square dark selected"></button><button class="square light possible-move"></button>
          <button class="square dark possible-move"><div class="piece white king"></div></button>
          <button class="square dark"><div class="piece black"></div></button>
        </div>
        <div class="controls">
          <button class="btn">A</button><button class="btn btn-primary">B</button>
          <button class="btn btn-secondary">C</button><button class="btn btn-secondary" disabled>D</button>
        </div>
      </div>`,
    targets: ['#new-game', '#white-player', '#board button.dark'],
    play: async page => {
      await page.locator('#white-player').selectOption('human');
      await page.locator('#black-player').selectOption('human');
      await activate(page.locator('#new-game'));
      await activate(page.locator('[data-row="3"][data-col="0"]'));
    },
    playTargets: ['#new-game', '.square.selected', '.piece'],
  },
  tictactoe: {
    path: '/games/tictactoe/index.html',
    ready: '#btn-start',
    probes: `
      <div class="config-screen hidden"><div class="config-group"><label>L</label><select><option>o</option></select></div>
        <button class="btn">Jouer</button></div>
      <div class="game-screen active"><div class="status win"><span class="turn">X</span></div>
        <div class="status draw">Nul</div><div class="status">Tour</div>
        <div class="board">
          <button class="cell X taken"></button><button class="cell O taken"></button>
          <button class="cell winning"></button><button class="cell"></button><button class="cell game-over"></button>
        </div>
        <div class="controls"><button class="btn-secondary">Menu</button></div>
        <div class="scores"><div class="score"><div>Vous</div><div class="score-value">1</div></div></div>
      </div>`,
    targets: ['#btn-start', '#opponent'],
    play: async page => {
      await page.locator('#opponent').selectOption('human');
      await page.locator('#first-player').selectOption('human');
      await activate(page.locator('#btn-start'));
      for (const index of [0, 3, 1, 4, 2]) {
        await activate(page.locator(`.cell[data-index="${index}"]`));
      }
      await expect(page.locator('.cell.winning')).toHaveCount(3);
    },
    playTargets: ['.cell[data-index="5"]', '.cell.taken', '.cell.winning', '#btn-restart', '#btn-menu'],
  },
  mastermind: {
    path: '/games/mastermind/index.html',
    ready: '#reset-btn',
    probes: `
      <div class="container"><h1>T</h1><p class="subtitle">s</p>
        <div class="attempt-row"><div class="attempt-number">1</div>
          <div class="pegs-container">
            <button class="peg R"></button><button class="peg B"></button><button class="peg G"></button>
            <button class="peg Y"></button><button class="peg O"></button><button class="peg V"></button>
            <button class="peg"><span>?</span></button>
          </div>
          <div class="feedback-container"><div class="feedback-peg black"></div><div class="feedback-peg white"></div><div class="feedback-peg"></div></div>
        </div>
        <div class="color-palette"><button class="color-button R"><span>R</span></button><button class="color-button V"><span>Vi</span></button></div>
        <div class="controls"><button class="btn-primary">V</button><button class="btn-primary" disabled>V</button><button class="btn-secondary">N</button></div>
        <div class="game-over victory"><h2>Gagne</h2><div class="secret-code-reveal"><button class="peg R"></button></div></div>
        <div class="game-over defeat"><h2>Perdu</h2></div>
        <div class="legend"><div class="legend-title">L</div><div class="legend-item"><div class="legend-symbol black"></div><span>x</span></div>
          <div class="legend-item"><div class="legend-symbol white"></div><span>y</span></div></div>
      </div>`,
    targets: ['.color-button.R', '#current-pegs .peg', '#reset-btn', '#submit-btn'],
    play: async page => {
      for (const color of ['R', 'B', 'G', 'Y']) {
        await activate(page.locator(`.color-button.${color}`));
      }
      await activate(page.locator('#submit-btn'));
      await activate(page.locator('.color-button.V'));
    },
    playTargets: ['.color-button.R', '#current-pegs .peg', '#submit-btn', '#reset-btn'],
  },
  triomino: {
    path: '/games/triomino/index.html',
    ready: '#start-btn',
    probes: `
      <div class="screen active" id="setup-screen"><h2>S</h2>
        <div class="field"><label>L</label><select><option>o</option></select><input></div>
        <button class="btn-primary">P</button><button class="btn-secondary">S</button></div>
      <div class="status-bar"><div class="status-item"><div class="status-label">T</div><div class="status-value">1</div></div></div>
      <div id="scores-bar"><div class="score-card active"><div class="player-name">A</div><div class="player-score">3</div></div>
        <div class="score-card"><div class="player-name">B</div><div class="player-score">0</div></div></div>
      <div id="side-panel"><h3>T</h3>
        <button class="rack-button" aria-pressed="true">1</button><button class="rack-button">2</button>
        <div id="rack"><div class="rack-tile selected"></div><div class="rack-tile drawn"></div><div class="rack-tile"></div></div>
        <div id="placement-controls"><select><option>o</option></select><button>b</button><button disabled>d</button></div>
        <div id="actions">
          <button class="btn-action btn-draw">D</button><button class="btn-action btn-pass" disabled>P</button>
          <button class="btn-action btn-quit">Q</button><a class="btn-action btn-rules" href="#">R</a>
        </div></div>
      <div id="bonus-notif" class="show"><div class="bonus-emoji">x</div><div class="bonus-text">B</div><div class="bonus-pts">+5</div></div>
      <div id="end-screen" class="screen active"><h2>F</h2>
        <ul class="podium"><li><span class="rank">1</span>a</li><li>b</li><li>c</li><li>d</li></ul></div>
      <div id="confirm-overlay" class="show"><div id="confirm-dialog"><p>?</p>
        <div class="confirm-buttons"><button class="btn-confirm-yes">O</button><button class="btn-confirm-no">N</button></div></div></div>`,
    targets: ['#start-btn', '#btn-rules-setup', '#back-btn', '#seed-input', '#num-players'],
    play: async page => {
      await page.locator('#num-players').selectOption('1');
      await page.locator('#bot-count').selectOption('0');
      await page.locator('#seed-input').fill('42');
      await activate(page.locator('#start-btn'));
      await activate(page.locator('.rack-button').first());
    },
    playTargets: ['.rack-button', '#btn-draw', '#btn-pass', '#btn-quit', '.btn-rules', '#rotate-tile'],
    finale: async page => {
      await activate(page.locator('#btn-quit'));
      await expect(page.locator('#confirm-dialog')).toBeVisible();
    },
    finaleTargets: ['#confirm-dialog .btn-confirm-yes', '#confirm-dialog .btn-confirm-no'],
  },
};

const readGolden = () => JSON.parse(readFileSync(GOLDEN_URL, 'utf8'));
const collected = {};

async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => null))));
}

async function applyScheme(page, scheme) {
  const { colorScheme, theme } = SCHEMES[scheme];
  await page.emulateMedia({ colorScheme });
  await page.evaluate(value => {
    if (value) { document.documentElement.setAttribute('data-theme', value); }
    else { document.documentElement.removeAttribute('data-theme'); }
  }, theme ?? null);
}

// Balayage complet : html, body, tous les descendants et leurs pseudo-elements generes.
function sweep(page, probes) {
  return page.evaluate(({ properties, markup }) => {
    const host = document.createElement('div');
    host.id = 'style-probes';
    host.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px';
    host.innerHTML = markup;
    document.body.append(host);
    const read = (element, pseudo) => {
      const computed = getComputedStyle(element, pseudo);
      return properties.map(property => computed.getPropertyValue(property));
    };
    const rows = [];
    [document.documentElement, ...document.body.querySelectorAll('*')].forEach((element, index) => {
      if (element.tagName === 'SCRIPT') { return; }
      const key = `${index}:${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].map(name => `.${name}`).join('')}`;
      rows.push([key, read(element)]);
      for (const pseudo of ['::before', '::after']) {
        const content = getComputedStyle(element, pseudo).content;
        if (content !== 'none' && content !== 'normal') { rows.push([`${key}${pseudo}`, read(element, pseudo)]); }
      }
    });
    host.remove();
    return rows;
  }, { properties: PROPERTIES, markup: probes });
}

function record(name, rows) {
  collected[name] = rows;
}

async function captureStates(page, targets) {
  const rows = [];
  const read = locator => locator.evaluate((element, properties) => {
    const computed = getComputedStyle(element);
    return properties.map(property => computed.getPropertyValue(property));
  }, PROPERTIES);
  for (const selector of targets) {
    const locator = page.locator(selector).first();
    if (!(await locator.count())) { continue; }
    await settle(page);
    rows.push([`${selector} repos`, await read(locator)]);
    if (await locator.isEnabled() && await locator.isVisible()) {
      await locator.focus();
      await settle(page);
      rows.push([`${selector} focus`, await read(locator)]);
      await locator.evaluate(element => element.blur());
    }
    if (await locator.isVisible()) {
      const nativeControl = await locator.evaluate(element => ['SELECT', 'INPUT'].includes(element.tagName));
      await locator.hover();
      await settle(page);
      rows.push([`${selector} survol`, await read(locator)]);
      if (!nativeControl) {
        await page.mouse.down();
        await settle(page);
        rows.push([`${selector} actif`, await read(locator)]);
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      await page.mouse.move(0, 0);
      await settle(page);
    }
  }
  return rows;
}

function compare(name, rows) {
  const golden = readGolden();
  const expected = golden.scenarios[name];
  expect(expected, `Scenario absent du golden : ${name}`).toBeTruthy();
  const decode = index => Object.fromEntries(golden.properties.map((property, position) => [property, golden.values[golden.styles[index][position]]]));
  const actual = Object.fromEntries(rows.map(([key, values]) => [key, Object.fromEntries(PROPERTIES.map((property, position) => [property, values[position]]))]));
  expect(Object.keys(actual), `Elements de ${name}`).toEqual(Object.keys(expected));
  const differences = [];
  for (const [key, index] of Object.entries(expected)) {
    const wanted = decode(index);
    for (const property of PROPERTIES) {
      if (wanted[property] !== actual[key][property]) {
        differences.push(`${key} { ${property}: ${actual[key][property]} } attendu ${wanted[property]}`);
      }
    }
  }
  expect(differences.slice(0, 20), `Styles calcules de ${name} (${differences.length} ecarts)`).toEqual([]);
}

function check(name, rows) {
  if (UPDATE) { record(name, rows); } else { compare(name, rows); }
}

function serialize() {
  const styles = [];
  const values = [];
  const valueIndex = new Map();
  const lookup = new Map();
  const scenarios = {};
  const encode = value => {
    if (!valueIndex.has(value)) { valueIndex.set(value, values.length); values.push(value); }
    return valueIndex.get(value);
  };
  for (const [name, rows] of Object.entries(collected).sort(([a], [b]) => a.localeCompare(b))) {
    scenarios[name] = {};
    for (const [key, rowValues] of rows) {
      const signature = JSON.stringify(rowValues);
      if (!lookup.has(signature)) { lookup.set(signature, styles.length); styles.push(rowValues.map(encode)); }
      scenarios[name][key] = lookup.get(signature);
    }
  }
  return `${JSON.stringify({ properties: PROPERTIES, values, styles, scenarios }, null, 0).replace(/\],\[/g, '],\n[')}\n`;
}

playlabTest.describe('Styles calcules des pages de jeu', () => {
  playlabTest.describe.configure({ mode: 'serial' });
  playlabTest.afterAll(() => {
    if (UPDATE) { writeFileSync(GOLDEN_URL, serialize()); }
  });

  for (const [game, config] of Object.entries(GAMES)) {
    for (const [scheme, viewport] of INITIAL_MATRIX) {
      playlabTest(`${game} : etat initial, ${scheme}, ${viewport}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport]);
        await page.goto(config.path);
        await expect(page.locator(config.ready).first()).toBeVisible();
        await applyScheme(page, scheme);
        await settle(page);
        check(`${game}/initial/${scheme}/${viewport}`, await sweep(page, config.probes));
      });
    }

    playlabTest(`${game} : mouvement reduit`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
      await page.goto(config.path);
      await expect(page.locator(config.ready).first()).toBeVisible();
      await settle(page);
      check(`${game}/initial/reduced-motion/desktop`, await sweep(page, config.probes));
    });

    for (const [scheme, viewport] of [['system-dark', 'desktop'], ['theme-light', 'mobile']]) {
      playlabTest(`${game} : survol, focus, actif et desactive, ${scheme}, ${viewport}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport]);
        await page.goto(config.path);
        await expect(page.locator(config.ready).first()).toBeVisible();
        await applyScheme(page, scheme);
        check(`${game}/etats/${scheme}/${viewport}`, await captureStates(page, config.targets));
      });

      playlabTest(`${game} : partie en cours, ${scheme}, ${viewport}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport]);
        await page.goto(config.path);
        await expect(page.locator(config.ready).first()).toBeVisible();
        await applyScheme(page, scheme);
        await config.play(page);
        await page.mouse.move(0, 0);
        await settle(page);
        const rows = await sweep(page, '');
        rows.push(...await captureStates(page, config.playTargets));
        check(`${game}/partie/${scheme}/${viewport}`, rows);
        if (config.finale) {
          await config.finale(page);
          await page.mouse.move(0, 0);
          await settle(page);
          const finale = await sweep(page, '');
          finale.push(...await captureStates(page, config.finaleTargets));
          check(`${game}/finale/${scheme}/${viewport}`, finale);
        }
      });
    }
  }
});

baseTest.describe('Styles calcules sans JavaScript', () => {
  baseTest.describe.configure({ mode: 'serial' });
  baseTest.use({ javaScriptEnabled: false, serviceWorkers: 'block' });
  baseTest.afterAll(() => {
    if (UPDATE) { writeFileSync(GOLDEN_URL, serialize()); }
  });

  for (const [game, config] of Object.entries(GAMES)) {
    for (const [scheme, viewport] of [['system-dark', 'desktop'], ['system-light', 'mobile']]) {
      baseTest(`${game} : page statique, ${scheme}, ${viewport}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport]);
        await page.emulateMedia({ colorScheme: SCHEMES[scheme].colorScheme });
        await page.goto(config.path);
        await expect(page.locator('h1').first()).toBeVisible();
        check(`${game}/sans-js/${scheme}/${viewport}`, await sweep(page, ''));
      });
    }
  }
});
