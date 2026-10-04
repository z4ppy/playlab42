/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CheckersEngine } from './engine.js';
import { createBoardNavigation } from '../board-navigation.js';
import { renderCheckersBoard } from './ui/board-view.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/render-corpus.json', import.meta.url));
const PAGE = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
const WALK_SEEDS = [14, 7, 5];
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// Seule la frontière du portail est remplacée : moteur, navigation et rendu restent ceux de la page.
const gameKit = { init: jest.fn(), saveScore: jest.fn() };
const modules = {
  './engine.js': { CheckersEngine },
  '../../lib/theme.js': { initTheme: () => {} },
  '../../lib/gamekit.js': { default: gameKit },
  '../board-navigation.js': { createBoardNavigation },
  './ui/board-view.js': { renderCheckersBoard },
};

function importedModules(extra = {}) {
  return { ...modules, ...extra };
}

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
  const code = script.replace(/^\s*import\s+(.+?)\s+from\s+'(.+?)';?\s*$/gm, (_, bindings, specifier) => {
    const source = `__modules['${specifier}']`;
    return bindings.startsWith('{') ? `const ${bindings} = ${source};` : `const ${bindings} = ${source}.default;`;
  });
  execute(code, importedModules(extra));
}

async function flush() {
  for (let turn = 0; turn < 20; turn++) {
    await Promise.resolve();
  }
}

async function mountPage(extra) {
  document.body.innerHTML = PAGE.match(/<body>([\s\S]*?)<script type="module">/)[1];
  runInlineScript(extra);
  await flush();
}

const square = (row, col) => document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
const click = ({ row, col }) => square(row, col).click();
const text = (id) => document.getElementById(id).textContent;

function focusKey() {
  const { activeElement } = document;
  return activeElement.dataset?.row ? `${activeElement.dataset.row},${activeElement.dataset.col}` : activeElement.id || activeElement.tagName;
}

function pageSnapshot() {
  return {
    board: document.getElementById('board').outerHTML,
    page: JSON.stringify([
      document.getElementById('board').outerHTML,
      document.getElementById('status').outerHTML,
      text('move-message'),
      document.getElementById('start-game').outerHTML,
      focusKey(),
    ]),
  };
}

// Même partie déterministe pour la page réelle et pour le rendu public extrait.
function walkGame(seed, driver) {
  const engine = new CheckersEngine();
  let state = engine.init({ seed, playerIds: ['player1', 'player2'] });
  const snapshots = [];
  for (let ply = 0; state.status === 'playing'; ply++) {
    const player = state.playerIds[state.currentPlayer];
    const actions = engine.getValidActions(state, player);
    const chosen = actions[(seed * 7 + ply * 3) % actions.length];
    const moves = actions.filter((m) => m.from.row === chosen.from.row && m.from.col === chosen.from.col);
    snapshots.push(driver.select(state, chosen, moves));
    const applied = moves.find((m) => m.to.row === chosen.to.row && m.to.col === chosen.to.col);
    state = engine.applyAction(state, applied, player);
    snapshots.push(driver.move(state, chosen));
  }
  return { snapshots, final: state };
}

const pageDriver = {
  select: (state, chosen) => { click(chosen.from); return pageSnapshot(); },
  move: (state, chosen) => { click(chosen.to); return pageSnapshot(); },
};

async function startHumanGame() {
  await mountPage();
  document.getElementById('black-player').value = 'human';
  document.getElementById('new-game').click();
}

function readFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

describe('Rendu du damier de la page Dames', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    gameKit.saveScore.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('affiche la position initiale : 100 boutons ordonnés, 20 pions par camp, damier alterné', async () => {
    await mountPage();
    const squares = [...document.querySelectorAll('#board > button.square')];
    expect(squares).toHaveLength(100);
    expect(squares.map((s) => `${s.dataset.row},${s.dataset.col}`).slice(0, 3)).toEqual(['0,0', '0,1', '0,2']);
    expect(squares[0].className).toBe('square light');
    expect(squares[1].className).toBe('square dark');
    expect(squares[1].firstElementChild.className).toBe('piece white');
    expect(document.querySelectorAll('.piece.white')).toHaveLength(20);
    expect(document.querySelectorAll('.piece.black')).toHaveLength(20);
    expect(document.querySelectorAll('.piece.king, .selected, .possible-move')).toHaveLength(0);
    expect(squares[1].getAttribute('aria-label')).toBe('Ligne 1, colonne 2, pion blanc, joueur actif');
    expect(squares[0].getAttribute('aria-label')).toBe('Ligne 1, colonne 1, vide');
    expect(squares[0].type).toBe('button');
    expect(text('status')).toBe('Tour du joueur Blanc');
  });

  test('ne laisse jouer que les pièces actives et empêche le tour du bot', async () => {
    await mountPage();
    expect(square(3, 0).getAttribute('aria-disabled')).toBe('false');
    expect(square(6, 1).getAttribute('aria-disabled')).toBe('true');
    expect(square(4, 1).getAttribute('aria-disabled')).toBe('true');
    click({ row: 3, col: 0 });
    click({ row: 4, col: 1 });
    expect(text('status')).toBe('Tour du joueur Noir');
    expect(document.querySelectorAll('[aria-disabled="false"]')).toHaveLength(0);
    click({ row: 6, col: 1 });
    expect(document.querySelectorAll('.selected')).toHaveLength(0);
  });

  test('sélectionne un pion puis joue une destination légale en conservant le focus', async () => {
    await startHumanGame();
    square(3, 0).focus();
    click({ row: 3, col: 0 });
    expect(square(3, 0).classList.contains('selected')).toBe(true);
    expect(square(3, 0).getAttribute('aria-pressed')).toBe('true');
    expect(square(4, 1).className).toBe('square dark possible-move');
    expect(square(4, 1).getAttribute('aria-label')).toBe('Ligne 5, colonne 2, vide, destination autorisée');
    expect(square(4, 1).getAttribute('aria-disabled')).toBe('false');
    expect(text('move-message')).toBe('Pion sélectionné, ligne 4, colonne 1. 1 destination(s) autorisée(s).');
    expect(focusKey()).toBe('3,0');
    click({ row: 4, col: 1 });
    expect(square(4, 1).firstElementChild.className).toBe('piece white');
    expect(square(3, 0).children).toHaveLength(0);
    expect(text('move-message')).toBe('Déplacement vers la ligne 5, colonne 2.');
    expect(text('status')).toBe('Tour du joueur Noir');
    expect(document.querySelectorAll('.selected, .possible-move')).toHaveLength(0);
    expect(focusKey()).toBe('3,0');
  });

  test('refuse une destination non autorisée sans changer la position', async () => {
    await startHumanGame();
    click({ row: 3, col: 0 });
    const before = document.getElementById('board').outerHTML;
    click({ row: 5, col: 0 });
    expect(text('move-message')).toBe('Destination non autorisée. Choisissez une case indiquée ou un autre pion.');
    expect(document.getElementById('board').outerHTML).toBe(before);
    click({ row: 6, col: 1 });
    expect(document.getElementById('board').outerHTML).toBe(before);
  });

  test('déplace le point d’arrêt Tab avec les flèches du plateau rendu', async () => {
    await startHumanGame();
    expect(document.querySelectorAll('.square[tabindex="0"]')).toHaveLength(1);
    square(0, 0).focus();
    square(0, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(focusKey()).toBe('1,0');
    expect(document.querySelector('.square[tabindex="0"]')).toBe(square(1, 0));
  });

  test('conserve des empreintes DOM identiques sur les parties complètes de référence', async () => {
    const recorded = {};
    for (const seed of WALK_SEEDS) {
      await startHumanGame();
      const { snapshots, final } = walkGame(seed, pageDriver);
      expect(final.status).toBe('won');
      recorded[seed] = {
        board: snapshots.map((s) => sha(s.board)),
        page: snapshots.map((s) => sha(s.page)),
      };
    }
    if (process.env.RENDER_CORPUS_RECORD) {
      writeFileSync(FIXTURE, `${JSON.stringify(recorded)}\n`);
    }
    expect(recorded).toEqual(readFixture());
    const total = Object.values(recorded).reduce((sum, walk) => sum + walk.board.length, 0);
    expect(total).toBeGreaterThan(250);
  });

  test('rend les dames promues et les prises du corpus', async () => {
    await startHumanGame();
    const { snapshots } = walkGame(14, pageDriver);
    const pieces = (snapshot) => (snapshot.board.match(/class="piece /g) ?? []).length;
    const kings = snapshots.filter((s) => /class="piece (white|black) king"/.test(s.board));
    expect(kings.length).toBeGreaterThan(0);
    expect(pieces(snapshots[0]) - pieces(snapshots.at(-1))).toBeGreaterThan(10);
    expect(snapshots.some((s, i) => i > 0 && pieces(snapshots[i - 1]) - pieces(s) > 1)).toBe(true);
  });

  test('annonce la victoire humaine et désactive le plateau terminé', async () => {
    await startHumanGame();
    const { final } = walkGame(14, pageDriver);
    expect(final.winner).toBeDefined();
    expect(text('status')).toMatch(/^🏆 Victoire du joueur (Blanc|Noir)!$/);
    expect(document.getElementById('status').style.color).toBe('var(--color-success, green)');
    expect(gameKit.saveScore).toHaveBeenCalledWith(1);
    expect(document.querySelectorAll('[aria-disabled="false"]')).toHaveLength(0);
  });
});

describe('Rendu public du damier extrait', () => {
  const engine = new CheckersEngine();
  const initial = engine.init({ seed: 1, playerIds: ['player1', 'player2'] });
  const baseView = { state: initial, selected: null, moves: [], humanTurn: true };
  let boardEl;
  let navigation;

  beforeEach(() => {
    document.body.innerHTML = PAGE.match(/<body>([\s\S]*?)<script type="module">/)[1];
    boardEl = document.getElementById('board');
    navigation = createBoardNavigation(boardEl, 10);
  });

  const draw = (view, onSquareClick = () => {}) => {
    navigation.beforeRender();
    renderCheckersBoard(boardEl, view, onSquareClick);
    navigation.afterRender();
  };

  test('reproduit exactement les empreintes de la page d’origine sur les parties de référence', () => {
    const fixture = readFixture();
    const driver = {
      select: (state, chosen, moves) => {
        draw({ state, selected: chosen.from, moves, humanTurn: true });
        return sha(boardEl.outerHTML);
      },
      move: (state) => {
        draw({ state, selected: null, moves: [], humanTurn: true });
        return sha(boardEl.outerHTML);
      },
    };
    for (const seed of WALK_SEEDS) {
      expect(walkGame(seed, driver).snapshots).toEqual(fixture[seed].board);
    }
  });

  test('construit chaque case dans l’ordre avec classes, étiquettes et états accessibles', () => {
    draw(baseView);
    const squares = [...boardEl.children];
    expect(squares).toHaveLength(100);
    expect(squares.map((s) => s.tagName)).toEqual(Array(100).fill('BUTTON'));
    expect(squares[11].dataset).toMatchObject({ row: '1', col: '1' });
    expect(squares[11].className).toBe('square light');
    expect(squares[10].className).toBe('square dark');
    expect(squares[10].getAttribute('aria-label')).toBe('Ligne 2, colonne 1, pion blanc, joueur actif');
    expect(squares[61].getAttribute('aria-label')).toBe('Ligne 7, colonne 2, pion noir');
    expect(squares[40].getAttribute('aria-label')).toBe('Ligne 5, colonne 1, vide');
    expect(squares[61].getAttribute('aria-disabled')).toBe('true');
    expect(squares[40].getAttribute('aria-disabled')).toBe('true');
    expect(squares[10].getAttribute('aria-disabled')).toBe('false');
  });

  test('marque dame, sélection et destinations avec les coups fournis sans les recalculer', () => {
    const state = JSON.parse(JSON.stringify(initial));
    state.board[4][1] = { type: 'king', player: 1 };
    const moves = [{ to: { row: 4, col: 1 } }, { to: { row: 5, col: 3 } }];
    draw({ state, selected: { row: 3, col: 0 }, moves, humanTurn: true });
    const at = (row, col) => boardEl.children[row * 10 + col];
    expect(at(4, 1).firstElementChild.className).toBe('piece black king');
    expect(at(4, 1).className).toBe('square dark possible-move');
    expect(at(4, 1).getAttribute('aria-label')).toBe('Ligne 5, colonne 2, dame noir, destination autorisée');
    expect(at(4, 1).getAttribute('aria-disabled')).toBe('false');
    expect(at(5, 3).className).toBe('square light possible-move');
    expect(at(3, 0).className).toBe('square dark selected');
    expect(at(3, 0).getAttribute('aria-pressed')).toBe('true');
    expect(boardEl.querySelectorAll('.selected, .possible-move')).toHaveLength(3);
  });

  test('désactive toutes les cases hors de la partie en cours ou du tour humain', () => {
    draw({ ...baseView, humanTurn: false });
    expect(boardEl.querySelectorAll('[aria-disabled="false"]')).toHaveLength(0);
    draw({ ...baseView, state: { ...initial, status: 'won' } });
    expect(boardEl.querySelectorAll('[aria-disabled="false"]')).toHaveLength(0);
    draw(baseView);
    expect(boardEl.querySelectorAll('[aria-disabled="false"]').length).toBeGreaterThan(0);
  });

  test('délègue chaque clic à la réaction avec ses coordonnées et remplace l’ancien contenu', () => {
    const onSquareClick = jest.fn();
    draw(baseView, onSquareClick);
    draw(baseView, onSquareClick);
    expect(boardEl.children).toHaveLength(100);
    boardEl.children[34].click();
    expect(onSquareClick).toHaveBeenCalledTimes(1);
    expect(onSquareClick).toHaveBeenCalledWith(3, 4);
  });

  test('restaure le focus sur la case active après un nouveau rendu', () => {
    draw(baseView);
    boardEl.children[22].focus();
    draw(baseView);
    expect(document.activeElement).toBe(boardEl.children[22]);
    expect(boardEl.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });
});
