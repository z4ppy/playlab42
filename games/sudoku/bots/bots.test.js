import { describe, expect, it } from '@jest/globals';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { SudokuEngine } from '../engine.js';
import { adviseNextMove, findMistake, focusOf } from '../engine/advisor.js';
import { CLASSIC, INKALA, classicSolution } from '../engine/__tests__/fixtures.js';
import { LogicBot } from './logic.js';
import { BacktrackingBot } from './backtracking.js';
import { pickValidAction } from './shared.js';

const engine = new SudokuEngine();
const PLAYER = 'joueur';
const SOLUTION = classicSolution();
const classic = () => engine.init({ seed: 1, playerIds: [PLAYER], puzzle: CLASSIC });
const viewOf = (state) => engine.getPlayerView(state, PLAYER);
const play = (state, action) => engine.applyAction(state, action, PLAYER);

/** Fait jouer un bot jusqu'à la fin et retourne l'état final et ses conseils. */
function runBot(bot, state, limit = 200) {
  const advices = [];
  for (let turn = 0; turn < limit && !engine.isGameOver(state); turn++) {
    const action = bot.chooseAction(viewOf(state), engine.getValidActions(state, PLAYER), new SeededRandom(turn));
    advices.push(bot.lastAdvice);
    state = play(state, action);
  }
  return { state, advices };
}

describe('Conseiller (indice et bot logique)', () => {
  it('propose une pose justifiée par une déduction expliquée en deux temps', () => {
    const advice = adviseNextMove(viewOf(classic()));
    expect(advice.kind).toBe('logic');
    expect(advice.action.type).toBe('place');
    expect(SOLUTION[advice.action.cell]).toBe(advice.action.value);
    expect(advice.hint).toMatch(/^Regardez/);
    expect(advice.detail).toContain('(Singleton caché)');
    expect(advice.technique).toBe('Singleton caché');
    // Le premier temps montre une région entière, pas seulement la case réponse.
    expect(advice.focusCells.length).toBeGreaterThan(1);
  });

  it('signale d’abord un conflit visible, puis une erreur cachée', () => {
    const conflict = play(classic(), { type: 'place', cell: 2, value: 5 });
    expect(adviseNextMove(viewOf(conflict))).toMatchObject({ kind: 'conflict', action: { type: 'erase', cell: 2 } });
    const mistake = play(classic(), { type: 'place', cell: 2, value: 1 });
    const advice = adviseNextMove(viewOf(mistake));
    expect(advice).toMatchObject({ kind: 'mistake', action: { type: 'erase', cell: 2 } });
    expect(advice.detail).toContain('ligne 1, colonne 3');
    expect(findMistake(viewOf(mistake), SOLUTION)).toBe(2);
  });

  it('se replie sur le solveur exact quand aucune technique ne s’applique', () => {
    const state = engine.init({ seed: 1, playerIds: [PLAYER], puzzle: INKALA });
    const advice = adviseNextMove(viewOf(state));
    expect(advice.kind).toBe('search');
    expect(advice.action).toEqual({ type: 'place', cell: 1, value: state.solution[1] });
  });

  it('montre au premier temps la région à examiner, sans la réponse', () => {
    const xWing = {
      technique: 'xWing', cells: [11, 16, 56, 61],
      units: [{ type: 'row', index: 1 }, { type: 'row', index: 6 }, { type: 'column', index: 2 }, { type: 'column', index: 7 }],
    };
    expect(focusOf(xWing)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 54, 55, 56, 57, 58, 59, 60, 61, 62]);
    expect(focusOf({ technique: 'xyWing', cells: [30, 35, 49], units: [] })).toEqual([30, 35, 49]);
    expect(focusOf({ technique: 'hiddenSingle', cells: [37], units: [{ type: 'box', index: 3 }] }))
      .toEqual([27, 28, 29, 36, 37, 38, 45, 46, 47]);
  });

  it('ne conseille rien sur une grille terminée', () => {
    const { state } = runBot(new BacktrackingBot(), classic());
    expect(adviseNextMove(viewOf(state))).toBeNull();
    expect(adviseNextMove({ ...viewOf(state), gameOver: false })).toBeNull();
  });

  it('explique une chaîne d’éliminations avant la pose', () => {
    const state = engine.init({ seed: 42, playerIds: [PLAYER], difficulty: 'expert' });
    const { advices } = runBot(new LogicBot(), state);
    const chained = advices.find((advice) => advice.steps.length > 1);
    expect(chained.detail).toContain('Ensuite, ');
    expect(chained.detail).toMatch(/On peut alors poser le \d en ligne \d, colonne \d\.$/);
    expect(chained.technique).toContain(' → ');
    expect(advices.some((advice) => /X-Wing|XY-Wing|Swordfish/.test(advice.technique))).toBe(true);
  });
});

describe.each([
  ['Logique', () => new LogicBot()],
  ['Retour sur trace', () => new BacktrackingBot()],
])('Bot %s', (name, createBot) => {
  it('déclare son nom et sa stratégie', () => {
    const bot = createBot();
    expect(bot.name).toBe(name);
    expect(bot.description).toEqual(expect.any(String));
    expect(bot.difficulty).toBe('expert');
  });

  it('résout une grille générée en ne jouant que des coups valides', () => {
    const initial = engine.init({ seed: 9, playerIds: [PLAYER], difficulty: 'hard' });
    const { state } = runBot(createBot(), initial);
    expect(engine.isGameOver(state)).toBe(true);
    expect(engine.getWinners(state)).toEqual([PLAYER]);
  });

  it('corrige une erreur du joueur avant de continuer', () => {
    const wrong = play(classic(), { type: 'place', cell: 2, value: 1 });
    const bot = createBot();
    expect(bot.chooseAction(viewOf(wrong), engine.getValidActions(wrong, PLAYER))).toEqual({ type: 'erase', cell: 2 });
    expect(bot.lastAdvice.kind).toBe('mistake');
  });

  it('est déterministe et n’utilise que la vue (sans solution)', () => {
    const state = classic();
    const view = viewOf(state);
    expect(view).not.toHaveProperty('solution');
    const actions = engine.getValidActions(state, PLAYER);
    expect(createBot().chooseAction(view, actions)).toEqual(createBot().chooseAction(view, actions));
  });

  it('refuse de jouer sur une grille terminée', () => {
    const { state } = runBot(createBot(), classic());
    expect(() => createBot().chooseAction(viewOf(state), [])).toThrow();
  });
});

describe('Comparaison des deux IA', () => {
  it('le bot logique explique chaque coup, le retour sur trace mesure son effort', () => {
    const logic = runBot(new LogicBot(), classic());
    const search = runBot(new BacktrackingBot(), classic());
    expect(logic.state.values).toEqual(search.state.values);
    expect(logic.advices.every((advice) => advice.detail.length > 0)).toBe(true);
    expect(search.advices.every((advice) => advice.nodes > 0)).toBe(true);
    expect(search.advices[0].detail).toMatch(/nœuds explorés/);
  });

  it('le retour sur trace refuse une grille sans solution', () => {
    const impossible = new Array(81).fill(0);
    impossible[0] = 1;
    impossible[1] = 1;
    expect(() => new BacktrackingBot().chooseAction({ givens: impossible, values: impossible }, [])).toThrow('sans solution');
  });

  it('pickValidAction refuse une décision hors des actions valides', () => {
    expect(() => pickValidAction([], { type: 'place', cell: 0, value: 1 })).toThrow('hors des actions valides');
  });
});
