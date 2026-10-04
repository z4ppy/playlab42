/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as engineModule from './engine.ts';
import { SeededRandom } from '../../lib/seeded-random.js';
import { createPlacementControls } from './placement-controls.js';
import { createRackButton } from './rack-button.js';
import { observeDialog } from '../dialog-accessibility.js';
import { renderTriominoBoard } from './ui/board-view.js';
import { boardViewBox, triangleCenter, triangleCorners, trianglePoints } from './ui/board-geometry.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/render-corpus.json', import.meta.url));
const PAGE = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
const GAMES = [42, 7, 123].flatMap((seed) => ['standard', 'kids'].map((mode) => ({ seed, mode })));
const TURNS = 10;
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// Seuls le thème et le bot (absent des parties de hot-seat) sont remplacés ; moteur, contrôles et rendu restent ceux de la page.
const modules = {
  './dist/engine.js': engineModule,
  '../../lib/seeded-random.js': { SeededRandom },
  './bots/dist/greedy.js': { GreedyBot: class {} }, // aucun bot dans ces parties : le dist TypeScript n'est pas construit en test
  '../../lib/theme.js': { initTheme: () => {} },
  './placement-controls.js': { createPlacementControls },
  '../dialog-accessibility.js': { observeDialog },
  './rack-button.js': { createRackButton },
  './ui/board-view.js': { renderTriominoBoard },
};

// Le script réel s'exécute dans la fenêtre jsdom, isolé dans une fonction par montage.
function execute(code, imported) {
  window.__modules = imported;
  const script = document.createElement('script');
  script.textContent = `(() => {'use strict';${code}\n})();`;
  document.body.append(script);
  script.remove();
  delete window.__modules;
}

function runInlineScript(extra) {
  const script = PAGE.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const code = script.replace(/^\s*import\s+(.+?)\s+from\s+'(.+?)';?\s*$/gm, (_, bindings, specifier) => `const ${bindings} = __modules['${specifier}'];`);
  execute(code, { ...modules, ...extra });
}

function mountPage(extra) {
  document.body.innerHTML = PAGE.match(/<body[^>]*>([\s\S]*?)<script type="module">/)[1];
  runInlineScript(extra);
}

function startGame({ seed, mode, players = '2' }) {
  mountPage();
  document.getElementById('num-players').value = players;
  document.getElementById('bot-count').value = '0';
  document.getElementById('game-mode').value = mode;
  document.getElementById('seed-input').value = String(seed);
  document.getElementById('start-btn').click();
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const boardSvg = () => document.getElementById('board-svg');

function focusKey() {
  const { activeElement } = document;
  return activeElement.dataset?.tileId ? `tile ${activeElement.dataset.tileId}` : activeElement.id || activeElement.tagName;
}

function snapshot() {
  const target = $('#placement-target');
  return {
    board: boardSvg().outerHTML,
    page: JSON.stringify([
      boardSvg().outerHTML,
      document.getElementById('rack').outerHTML,
      document.getElementById('rack-title').textContent,
      document.getElementById('scores-bar').innerHTML,
      document.getElementById('hint').textContent,
      $('#placement-controls').innerHTML,
      target.value,
      target.disabled,
      $('#rotate-tile').disabled,
      $('#place-tile').disabled,
      $('#btn-draw').disabled,
      $('#btn-pass').disabled,
      ['turn-display', 'current-player-display', 'draw-pile-display', 'draws-display'].map((id) => document.getElementById(id).textContent),
      $('#bonus-notif').className,
      $$('.screen').map((screen) => screen.className),
      focusKey(),
    ]),
  };
}

// Choisit la première tuile jouable à partir d'un décalage déterministe, ou pioche puis passe.
function playTurn(turn, seed, shots) {
  shots.push(snapshot());
  const count = $$('.rack-button').length;
  const hovered = $('.rack-button .rack-tile');
  hovered.dispatchEvent(new MouseEvent('mouseenter'));
  shots.push(snapshot());
  hovered.dispatchEvent(new MouseEvent('mouseleave'));
  for (let i = 0; i < count; i++) {
    $$('.rack-button')[(seed + turn * 3 + i) % count].click();
    shots.push(snapshot());
    if (!$('#placement-target').disabled) {
      placeSelected(turn, shots);
      return;
    }
  }
  const action = $('#btn-draw').disabled ? $('#btn-pass') : $('#btn-draw');
  action.click();
  shots.push(snapshot());
}

function placeSelected(turn, shots) {
  if (!$('#rotate-tile').disabled) {
    $('#rotate-tile').click();
    shots.push(snapshot());
  }
  if (turn % 2 === 0) {
    $('#place-tile').click();
  } else {
    const zones = $$('#board-svg polygon[aria-hidden="true"]');
    zones[(turn * 7) % zones.length].dispatchEvent(new MouseEvent('click'));
  }
  shots.push(snapshot());
}

function playGame({ seed, mode }) {
  startGame({ seed, mode });
  const shots = [];
  for (let turn = 0; turn < TURNS && $('#game-screen').classList.contains('active'); turn++) {
    playTurn(turn, seed, shots);
  }
  return shots;
}

const placedTiles = () => $$('#board-svg g[role="img"]');

describe('Rendu du plateau de la page Triomino', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('affiche un plateau vide avec ses filtres et sans zone de dépôt avant sélection', () => {
    startGame({ seed: 42, mode: 'standard' });
    const svg = boardSvg();
    expect([...svg.children].map((child) => child.tagName)).toEqual(['defs']);
    expect([...svg.querySelectorAll('filter')].map((filter) => filter.id)).toEqual(['shadow', 'last-tile-glow']);
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 480');
    expect($$('.rack-button')).toHaveLength(9);
    expect($('#hint').textContent).toContain('Sélectionnez une tuile avec Entrée ou Espace');
    expect($('#rack-title').textContent).toBe('Ma réglette (9 tuiles)');
  });

  test('propose les destinations légales, ajuste le viewBox et sélectionne les sommets exacts', () => {
    startGame({ seed: 42, mode: 'standard' });
    const tileId = $$('.rack-button').find((button) => new Set(button.textContent.match(/\d/g)).size > 1).dataset.tileId;
    $(`.rack-button[data-tile-id="${tileId}"]`).click();
    const zones = $$('#board-svg polygon');
    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0].getAttribute('aria-hidden')).toBe('true');
    expect(zones[0].getAttribute('stroke-dasharray')).toBe('4 3');
    expect(zones[0].style.cursor).toBe('pointer');
    expect(zones[0].getAttribute('fill')).toBe('rgba(249,115,22,0.18)');
    expect(boardSvg().getAttribute('viewBox')).not.toBe('0 0 600 480');
    expect(Number(boardSvg().getAttribute('viewBox').split(' ')[2])).toBeGreaterThanOrEqual(120);
    expect($('#hint').textContent).toMatch(/^✅ \d+ placement\(s\) disponible\(s\)/);
    expect($(`.rack-button[data-tile-id="${tileId}"]`).getAttribute('aria-pressed')).toBe('true');
  });

  test('pose par le bouton puis par une zone, marque la dernière tuile et conserve le focus', () => {
    startGame({ seed: 42, mode: 'standard' });
    const opener = $('#current-player-display').textContent;
    $$('.rack-button').find((button) => new Set(button.textContent.match(/\d/g)).size > 1).click();
    const label = $('#placement-target option:checked').textContent.split('sommets ')[1];
    $('#place-tile').click();
    const first = placedTiles();
    expect(first).toHaveLength(1);
    expect(first[0].getAttribute('aria-label')).toMatch(new RegExp(`^Tuile ${label}, colonne -?\\d+, ligne -?\\d+, (UP|DOWN), dernière tuile posée$`));
    expect(first[0].getAttribute('filter')).toBe('url(#last-tile-glow)');
    expect(first[0].firstElementChild.getAttribute('fill')).toBe('#fed7aa');
    expect(first[0].firstElementChild.getAttribute('stroke-width')).toBe('3');
    expect(first[0].querySelectorAll('text')).toHaveLength(3);
    expect(first[0].firstElementChild.hasAttribute('filter')).toBe(false);
    expect($('#current-player-display').textContent).not.toBe(opener);
    expect(focusKey()).toMatch(/^tile /);

    let guard = 0;
    while (placedTiles().length < 2 && guard++ < 9) {
      $$('.rack-button')[guard % $$('.rack-button').length].click();
      const zones = $$('#board-svg polygon[aria-hidden="true"]');
      if (zones.length) { zones[0].dispatchEvent(new MouseEvent('click')); }
    }
    const [older, newest] = placedTiles();
    expect(older.hasAttribute('filter')).toBe(false);
    expect(older.firstElementChild.getAttribute('filter')).toBe('url(#shadow)');
    expect(older.getAttribute('aria-label')).not.toContain('dernière');
    expect(newest.getAttribute('aria-label')).toContain('dernière tuile posée');
    expect(boardSvg().lastElementChild).toBe(newest);
  });

  test('conserve des empreintes DOM identiques sur les parties de référence standard et enfants', () => {
    const recorded = {};
    for (const game of GAMES) {
      const shots = playGame(game);
      recorded[`${game.mode}-${game.seed}`] = { board: shots.map((s) => sha(s.board)), page: shots.map((s) => sha(s.page)) };
    }
    if (process.env.RENDER_CORPUS_RECORD) {
      writeFileSync(FIXTURE, `${JSON.stringify(recorded)}\n`);
    }
    expect(recorded).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    const total = Object.values(recorded).reduce((sum, game) => sum + game.board.length, 0);
    expect(total).toBeGreaterThan(150);
  });

  test('le corpus contient survol, rotation, zones, dernière tuile et plusieurs tuiles posées', () => {
    const shots = playGame({ seed: 123, mode: 'standard' });
    const boards = shots.map((shot) => shot.board);
    expect(boards.some((html) => html.includes('stroke-dasharray'))).toBe(true);
    expect(boards.some((html) => (html.match(/role="img"/g) ?? []).length >= 3)).toBe(true);
    expect(boards.some((html) => html.includes('last-tile-glow)"'))).toBe(true);
    expect(new Set(boards).size).toBeGreaterThan(10);
  });
});

describe('Rendu public du plateau extrait', () => {
  const engine = new engineModule.TriominoEngine();
  const svgBoard = () => {
    document.body.innerHTML = '<svg id="board-svg" viewBox="0 0 600 480"></svg>';
    return boardSvg();
  };

  function playedState(placements) {
    let state = engine.init({ mode: 'standard', playerIds: ['Joueur 1', 'Joueur 2'], seed: 42 });
    const last = [];
    for (let i = 0; i < placements; i++) {
      const player = state.players[state.currentPlayerIndex].id;
      const place = engine.getLegalActions(state, player).find((action) => action.type === 'PLACE');
      state = engine.applyAction(state, place, player);
      last.push(place);
    }
    return { state, last };
  }

  const keyOf = ({ pos }) => `${pos.col},${pos.row},${pos.orientation}`;

  // Placements légaux d'une tuile du joueur actif, de préférence avec plusieurs rotations.
  const legalFor = (state) => {
    const player = state.players[state.currentPlayerIndex].id;
    const places = engine.getLegalActions(state, player).filter((action) => action.type === 'PLACE');
    const byTile = Map.groupBy(places, (action) => action.triominoId);
    const tiles = [...byTile.values()].map((actions) => actions.map((action) => ({ pos: action.position, placed: action.placed })));
    return tiles.find((legal) => new Set(legal.map(keyOf)).size < legal.length) ?? tiles[0];
  };

  test('calcule les coins, points et centres des triangles pointe en haut et en bas', () => {
    const height = 60 * Math.sqrt(3) / 2;
    expect(triangleCorners({ col: 0, row: 0, orientation: 'UP' })).toEqual([[30, 0], [0, height], [60, height]]);
    expect(triangleCorners({ col: 0, row: 0, orientation: 'DOWN' })).toEqual([[60, height], [30, 0], [90, 0]]);
    expect(triangleCorners({ col: 1, row: 1, orientation: 'UP' })[0]).toEqual([90, 2 * height]);
    expect(trianglePoints({ col: 0, row: 0, orientation: 'UP' })).toBe(`30,0 0,${height} 60,${height}`);
    const [cx, cy] = triangleCenter({ col: 0, row: 0, orientation: 'UP' });
    expect(cx).toBe(30);
    expect(cy).toBeCloseTo(height * 2 / 3, 10);
  });

  test('englobe les positions avec une marge d’un côté et ignore une liste vide', () => {
    expect(boardViewBox([])).toBeNull();
    const height = 60 * Math.sqrt(3) / 2;
    expect(boardViewBox([{ col: 0, row: 0, orientation: 'UP' }])).toBe(`-60 -60 180 ${height + 120}`);
    const wide = boardViewBox([{ col: 0, row: 0, orientation: 'UP' }, { col: 3, row: 0, orientation: 'UP' }]).split(' ').map(Number);
    expect(wide[0]).toBe(-60);
    expect(wide[2]).toBe(60 + 180 + 120);
  });

  test('vide le plateau, garde le viewBox sans position et ne dessine que les défs', () => {
    const svg = svgBoard();
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
    renderTriominoBoard(svg, { board: {}, legalPositions: [], selectedPlacement: null, lastPlacedKey: null }, jest.fn());
    expect([...svg.children].map((child) => child.tagName)).toEqual(['defs']);
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 480');
  });

  test('dessine les tuiles du moteur dans l’ordre des clés avec seule la dernière mise en évidence', () => {
    const { state, last } = playedState(3);
    const svg = svgBoard();
    const lastKey = Object.keys(state.board).at(-1);
    renderTriominoBoard(svg, { board: state.board, legalPositions: [], selectedPlacement: null, lastPlacedKey: lastKey }, jest.fn());
    const tiles = [...svg.querySelectorAll('g[role="img"]')];
    expect(tiles).toHaveLength(3);
    expect(tiles.map((tile) => tile.querySelectorAll('text').length)).toEqual([3, 3, 3]);
    expect(tiles.filter((tile) => tile.hasAttribute('filter'))).toEqual([tiles[2]]);
    expect(tiles[2].getAttribute('aria-label')).toMatch(/, dernière tuile posée$/);
    expect(tiles[0].getAttribute('aria-label')).toBe(`Tuile ${last[0].placed.join(', ')}, colonne ${last[0].position.col}, ligne ${last[0].position.row}, ${last[0].position.orientation}`);
    expect([...tiles[2].querySelectorAll('text')].map((text) => text.textContent)).toEqual(Object.values(state.board).at(-1).placed.map(String));
    expect(tiles[2].firstElementChild.getAttribute('fill')).toBe('#fed7aa');
    expect(tiles[0].firstElementChild.getAttribute('fill')).toBe('#fffff0');
    expect(tiles[0].firstElementChild.getAttribute('filter')).toBe('url(#shadow)');
    expect(svg.getAttribute('viewBox')).not.toBe('0 0 600 480');
  });

  test('délègue le clic de zone avec la rotation choisie sur un plateau vide', () => {
    const { state } = playedState(0);
    const legal = legalFor(state);
    const rotationKey = keyOf(legal.find((entry) => legal.filter((other) => keyOf(other) === keyOf(entry)).length > 1));
    const rotations = legal.filter((entry) => keyOf(entry) === rotationKey);
    expect(rotations.length).toBeGreaterThan(1);
    const svg = svgBoard();
    const onPlace = jest.fn();
    renderTriominoBoard(svg, { board: state.board, legalPositions: legal, selectedPlacement: rotations[1], lastPlacedKey: null }, onPlace);
    const distinct = new Set(legal.map(keyOf));
    const zones = [...svg.querySelectorAll(':scope > polygon')];
    expect(zones).toHaveLength(distinct.size);
    expect(zones[0].getAttribute('stroke-dasharray')).toBe('4 3');
    expect(zones[0].getAttribute('aria-hidden')).toBe('true');
    const chosenZone = zones[[...distinct].indexOf(rotationKey)];
    chosenZone.dispatchEvent(new MouseEvent('click'));
    expect(onPlace).toHaveBeenCalledWith(rotations[1].pos, rotations[1].placed);
  });

  test('place les zones avant les tuiles et garde la première rotation sans placement choisi', () => {
    const { state } = playedState(1);
    const legal = legalFor(state);
    const svg = svgBoard();
    const onPlace = jest.fn();
    renderTriominoBoard(svg, { board: state.board, legalPositions: legal, selectedPlacement: null, lastPlacedKey: null }, onPlace);
    const children = [...svg.children].map((child) => child.tagName);
    expect(children.lastIndexOf('polygon')).toBeLessThan(children.indexOf('g'));
    svg.querySelector(':scope > polygon').dispatchEvent(new MouseEvent('click'));
    expect(onPlace).toHaveBeenCalledWith(legal[0].pos, legal[0].placed);
  });
});
