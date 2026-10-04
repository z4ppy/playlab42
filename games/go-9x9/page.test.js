/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Go9x9Engine } from './engine.js';

const PAGE = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
const SCRIPT = PAGE.match(/<body>[\s\S]*<script type="module">([\s\S]*?)<\/script>/)[1];
const IMPORT = /^\s*import\s+(.+?)\s+from\s+'(.+?)';?\s*$/gm;
const SEED = 1700000000000;
const GREEDY_REPLY = [
  '. . . . . . . . .', '. . . . . . . . .', '. . . . . . . . .',
  '. . . . . O* . . .', '. . . . X . . . .', '. . . . . . . . .',
  '. . . . . . . . .', '. . . . . . . . .', '. . . . . . . . .',
].join('\n');

/** Charge les vrais modules importés par la page, sauf ceux explicitement remplacés. */
async function loadModules(overrides) {
  const loaders = {
    '../../lib/theme.js': () => import('../../lib/theme.js'),
    '../../lib/dom.js': () => import('../../lib/dom.js'),
    '../../lib/seeded-random.js': () => import('../../lib/seeded-random.js'),
    './engine.js': () => import('./engine.js'),
    './bots/random.js': () => import('./bots/random.js'),
    './bots/greedy.js': () => import('./bots/greedy.js'),
    '../board-navigation.js': () => import('../board-navigation.js'),
    './human-controls.js': () => import('./human-controls.js'),
    './board-render.js': () => import('./board-render.js'),
  };
  const modules = {};
  for (const [, , specifier] of SCRIPT.matchAll(IMPORT)) {
    if (!loaders[specifier]) { throw new Error(`Import de page non pris en charge : ${specifier}`); }
    modules[specifier] = overrides[specifier] ?? await loaders[specifier]();
  }
  return modules;
}

function execute(code, modules) {
  window.__modules = modules;
  const script = document.createElement('script');
  script.textContent = `(() => {'use strict';${code}\n})();`;
  document.body.append(script);
  script.remove();
  delete window.__modules;
}

async function mountPage(overrides = {}) {
  document.body.innerHTML = PAGE.match(/<body>([\s\S]*)<script type="module">/)[1];
  const code = SCRIPT.replace(IMPORT, (_, bindings, specifier) => `const ${bindings} = __modules['${specifier}'];`);
  execute(code, await loadModules(overrides));
}

const $ = id => document.getElementById(id);
const cell = (x, y) => document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
const click = (x, y) => cell(x, y).click();
const text = id => $(id).textContent;

/** Représente les pierres et le dernier coup, ligne par ligne. */
function boardText() {
  return Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => {
    const stone = cell(x, y).querySelector('.stone');
    const mark = cell(x, y).classList.contains('last-move') ? '*' : '';
    if (!stone) { return `.${mark}`; }
    return `${stone.classList.contains('black') ? 'X' : 'O'}${mark}`;
  }).join(' ')).join('\n');
}

describe('Page Go 9x9 : rendu et interactions', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(SEED);
    await mountPage();
  });
  afterEach(() => jest.useRealTimers());

  it('construit un plateau accessible de 81 intersections avec cinq hoshis', () => {
    const cells = document.querySelectorAll('.cell');
    expect(cells).toHaveLength(81);
    const hoshis = [...document.querySelectorAll('.cell.hoshi')].map(item => `${item.dataset.x},${item.dataset.y}`);
    expect(hoshis).toEqual(['2,2', '6,2', '4,4', '2,6', '6,6'].sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number);
      const [bx, by] = b.split(',').map(Number);
      return ay - by || ax - bx;
    }));
    expect(cell(0, 0).getAttribute('aria-label')).toBe('Ligne 1, colonne 1, vide');
    expect(cell(8, 8).getAttribute('aria-label')).toBe('Ligne 9, colonne 9, vide');
    expect(cell(3, 5).getAttribute('aria-disabled')).toBe('false');
    expect(cell(3, 5).innerHTML).toBe('');
  });

  it('présente le tour humain contre le bot, sans captures ni score', () => {
    expect(text('status')).toBe('À vous (Noir)');
    expect($('btn-pass').disabled).toBe(false);
    expect($('btn-resign').disabled).toBe(false);
    expect([text('captures-black'), text('captures-white'), text('score-black'), text('score-white')]).toEqual(['0', '0', '-', '-']);
  });

  it('pose la pierre noire, marque le dernier coup, bloque pendant le tour du bot puis rend la main', () => {
    click(4, 4);
    expect(cell(4, 4).querySelector('.stone.black')).not.toBeNull();
    expect(cell(4, 4).classList.contains('last-move')).toBe(true);
    expect(cell(4, 4).getAttribute('aria-label')).toBe('Ligne 5, colonne 5, pierre noire, dernier coup');
    expect(cell(4, 4).getAttribute('aria-disabled')).toBe('true');
    expect(cell(4, 3).getAttribute('aria-disabled')).toBe('true');
    expect(text('status')).toBe('Le bot joue (Blanc)');
    expect($('btn-pass').disabled).toBe(true);
    expect($('btn-resign').disabled).toBe(true);
    jest.advanceTimersByTime(150);
    expect(document.querySelectorAll('.stone.white')).toHaveLength(1);
    expect(document.querySelectorAll('.last-move')).toHaveLength(1);
    expect(cell(4, 4).classList.contains('last-move')).toBe(false);
    expect(text('status')).toBe('À vous (Noir)');
    expect($('btn-pass').disabled).toBe(false);
  });

  it('rejoue exactement la réponse tactique historique pour une graine fixée', () => {
    click(4, 4);
    jest.advanceTimersByTime(150);
    expect(boardText()).toBe(GREEDY_REPLY);
  });

  it('le bot aléatoire reste jouable depuis le menu et le reset repart d\'un plateau vide', () => {
    $('bot-select').value = 'random';
    $('btn-start').click();
    click(0, 0);
    jest.advanceTimersByTime(150);
    expect(document.querySelectorAll('.stone')).toHaveLength(2);
    $('btn-reset').click();
    expect(document.querySelectorAll('.stone')).toHaveLength(0);
    expect(text('status')).toBe('À vous (Noir)');
  });

  it('refuse un placement illégal avec un message visible sans changer le plateau', () => {
    $('bot-select').value = 'human';
    $('btn-start').click();
    click(2, 2);
    const before = boardText();
    click(2, 2);
    expect(text('status')).toBe('Placement interdit : intersection occupée, ko ou suicide. Choisissez une autre intersection.');
    expect(boardText()).toBe(before);
  });

  it('en hot-seat annonce chaque joueur, alterne les couleurs et supprime les pierres capturées', () => {
    $('bot-select').value = 'human';
    $('btn-start').click();
    expect(text('status')).toBe('Au tour du joueur Noir');
    click(1, 0);
    expect(text('status')).toBe('Au tour du joueur Blanc');
    click(0, 0);
    expect(cell(0, 0).querySelector('.stone.white')).not.toBeNull();
    expect(cell(0, 0).getAttribute('aria-label')).toBe('Ligne 1, colonne 1, pierre blanche, dernier coup');
    click(0, 1);
    expect(cell(0, 0).querySelector('.stone')).toBeNull();
    expect(cell(0, 0).getAttribute('aria-label')).toBe('Ligne 1, colonne 1, vide');
    expect(text('captures-black')).toBe('1');
    expect(text('captures-white')).toBe('0');
    expect($('btn-pass').disabled).toBe(false);
  });

  it('une passe efface le dernier coup ; deux passes ouvrent la revue avant confirmation', () => {
    $('bot-select').value = 'human';
    $('btn-start').click();
    click(4, 4);
    $('btn-pass').click();
    expect(document.querySelectorAll('.last-move')).toHaveLength(0);
    $('btn-pass').click();
    expect(text('status')).toContain('Comptage');
    expect([text('score-black'), text('score-white')]).toEqual(['-', '-']);
    expect($('btn-confirm-score').hidden).toBe(false);
    expect(cell(4, 4).getAttribute('aria-disabled')).toBe('false');
    $('btn-confirm-score').click();
    expect(text('status')).toBe('Victoire Noir');
    expect([text('score-black'), text('score-white')]).toEqual(['81.0', '6.5']);
    expect($('btn-pass').disabled).toBe(true);
    expect($('btn-resign').disabled).toBe(true);
    expect(cell(1, 1).getAttribute('aria-disabled')).toBe('true');
  });

  it('marque un groupe au clavier, refuse une case vide et reprend sans effacer les pierres', () => {
    $('bot-select').value = 'human';
    $('btn-start').click();
    click(4, 4);
    $('btn-pass').click();
    $('btn-pass').click();
    click(0, 0);
    expect(text('status')).toContain('Sélectionnez une pierre');
    click(4, 4);
    expect(cell(4, 4).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.stone.dead')).toHaveLength(1);
    $('btn-resume-play').click();
    expect(text('status')).toBe('Au tour du joueur Blanc');
    expect(document.querySelectorAll('.stone.dead')).toHaveLength(0);
    expect(document.querySelectorAll('.stone.black')).toHaveLength(1);
    expect($('btn-resume-play').hidden).toBe(true);
    click(3, 4);
    expect(document.querySelectorAll('.stone.white')).toHaveLength(1);
  });

  it('la résignation de Noir donne Blanc vainqueur sans score', () => {
    $('btn-resign').click();
    expect(text('status')).toBe('Victoire Blanc');
    expect(text('score-black')).toBe('-');
  });

  it('suspend le bot et laisse l’humain revoir les groupes avant de reprendre le tour du bot', async () => {
    let calls = 0;
    class PassingBot {
      onGameStart() {}
      chooseAction() { calls++; return { type: 'pass' }; }
    }
    await mountPage({ './bots/greedy.js': { GreedyBot: PassingBot } });
    click(4, 4);
    jest.advanceTimersByTime(150);
    $('btn-pass').click();
    expect(text('status')).toContain('Comptage');
    expect(cell(4, 4).getAttribute('aria-disabled')).toBe('false');
    jest.advanceTimersByTime(2000);
    expect(calls).toBe(1);
    click(4, 4);
    expect(document.querySelectorAll('.stone.dead')).toHaveLength(1);
    expect(text('score-black')).toBe('-');
    $('btn-resume-play').click();
    expect(text('status')).toBe('Le bot joue (Blanc)');
    jest.advanceTimersByTime(150);
    expect(calls).toBe(2);
    expect(text('status')).toBe('À vous (Noir)');
    expect(document.querySelectorAll('.stone.dead')).toHaveLength(0);
  });

  it('la résignation de Blanc en hot-seat donne la victoire à Noir', () => {
    $('bot-select').value = 'human';
    $('btn-start').click();
    click(4, 4);
    $('btn-resign').click();
    expect(text('status')).toBe('Victoire Noir');
  });
});

describe('Page Go 9x9 : issues de partie exceptionnelles', () => {
  afterEach(() => jest.useRealTimers());

  async function mountEnded(patch) {
    jest.useFakeTimers();
    class EndedEngine extends Go9x9Engine {
      init(config) { return { ...super.init(config), gameOver: true, ...patch }; }
    }
    await mountPage({ './engine.js': { Go9x9Engine: EndedEngine } });
  }

  it('annonce une égalité', async () => {
    await mountEnded({ winners: null, scores: { black: 4.5, white: 4.5 } });
    expect(text('status')).toBe('Partie terminée : égalité');
    expect(text('score-black')).toBe('4.5');
  });

  it('annonce une fin neutre pour un vainqueur inconnu', async () => {
    await mountEnded({ winners: ['inconnu'], captures: null });
    expect(text('status')).toBe('Partie terminée');
    expect([text('captures-black'), text('captures-white'), text('score-white')]).toEqual(['0', '0', '-']);
  });

  it('le dernier coup affiche le libellé de pose sur la bonne intersection seulement', async () => {
    await mountEnded({ winners: [], lastMove: { type: 'place', x: 3, y: 2 } });
    expect(document.querySelectorAll('.last-move')).toHaveLength(1);
    expect(cell(3, 2).getAttribute('aria-label')).toBe('Ligne 3, colonne 4, vide, dernier coup');
    expect(text('status')).toBe('Partie terminée');
  });
});
