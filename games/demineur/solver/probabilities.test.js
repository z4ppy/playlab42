/**
 * Tests des probabilités exactes : petits cas calculés à la main, puis comparaison
 * avec une énumération brute de toutes les grilles compatibles.
 */
import { computeProbabilities, convolve, countComponent, logChoose, splitComponents } from './probabilities.js';
import { readBoard } from './board-reader.js';
import { analyze } from './solver.js';
import { deduce } from './deductions.js';
import { drawView } from '../__tests__/boards.js';
import { adjacentMineCounts } from '../engine/grid.js';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { MinesweeperEngine } from '../engine.js';

const risks = (drawing, options) => computeProbabilities(readBoard(drawView(drawing, options).view), new Map(), options);

describe('outils combinatoires', () => {
  it('calcule ln C(n, k) et refuse les k impossibles', () => {
    expect(Math.exp(logChoose(5, 2))).toBeCloseTo(10, 10);
    expect(Math.exp(logChoose(480, 0))).toBeCloseTo(1, 10);
    expect(logChoose(3, 4)).toBe(-Infinity);
    expect(logChoose(3, -1)).toBe(-Infinity);
  });

  it('convolue des distributions de nombres de mines', () => {
    expect(convolve([])).toEqual([1]);
    expect(convolve([[0, 2], [1, 1]])).toEqual([0, 2, 2]);
  });

  it('sépare les chiffres indépendants en composantes', () => {
    const make = cells => ({ cells, need: 1 });
    const components = splitComponents([make([1, 2]), make([5, 6]), make([2, 3])]);
    expect(components.map(component => component.cells)).toEqual([[1, 2, 3], [5, 6]]);
  });

  it('compte les configurations par nombre de mines', () => {
    // a + b = 1 et b + c = 1 : soit b seule (1 mine), soit a et c (2 mines).
    const component = { cells: [0, 1, 2], constraints: [{ cells: [0, 1], need: 1 }, { cells: [1, 2], need: 1 }] };
    const count = countComponent(component, { nodes: 0, budget: 1000 });
    expect(count.counts).toEqual([0, 1, 1]);
    expect(count.cellMines).toEqual([[0, 0, 0], [0, 1, 0], [1, 0, 1]]);
    expect(countComponent(component, { nodes: 0, budget: 3 })).toBeNull();
  });
});

describe('probabilités sur petits cas vérifiables', () => {
  it('pondère chaque configuration par le nombre de façons de remplir l\'intérieur', () => {
    // Frontière : b seule (1 mine) ou a et c (2 mines) ; intérieur de 3 cases, 2 mines au total.
    // Poids : C(3, 1) = 3 pour « b », C(3, 0) = 1 pour « a et c » → P(b) = 3/4, P(a) = P(c) = 1/4,
    // et l'intérieur reçoit en moyenne 3/4 de mine sur 3 cases → 1/4 chacune.
    const { probabilities, exact, certain } = risks('. o * o . . * .');
    expect(exact).toBe(true);
    expect(certain).toEqual([]);
    const expected = [0.25, null, 0.75, null, 0.25, 0.25, 0.25, 0.25];
    probabilities.forEach((value, index) => {
      if (expected[index] === null) { expect(value).toBeNull(); } else { expect(value).toBeCloseTo(expected[index], 12); }
    });
  });

  it('donne la densité moyenne sans aucun chiffre', () => {
    const { probabilities } = risks('. . .\n. * .');
    probabilities.forEach(value => expect(value).toBeCloseTo(1 / 6, 12));
  });

  it('combine deux composantes indépendantes avec le nombre total de mines', () => {
    // Deux « 1 » isolés aux extrémités, 2 mines au total : chacun garde la sienne, le centre est sûr.
    const { probabilities, certain } = risks('* o . . . o *');
    expect(probabilities[0]).toBeCloseTo(0.5, 12);
    expect(probabilities[3]).toBe(0);
    expect(certain).toEqual([expect.objectContaining({ interior: true, result: 'safe', cells: [3], usesCount: true })]);
  });

  it('fixe à 0 ou 1 les cases déjà déduites', () => {
    const { view } = drawView('* o .\no o .');
    const board = readBoard(view);
    const { known } = deduce(board);
    expect(computeProbabilities(board, known).probabilities).toEqual([1, null, 0, null, null, 0]);
  });

  it('se replie sur une estimation au-delà du budget, sans certitude', () => {
    const report = risks('. o * o . . * .', { nodeBudget: 1 });
    expect(report.exact).toBe(false);
    expect(report.certain).toEqual([]);
    expect(report.probabilities[0]).toBeCloseTo(0.5, 12);
    expect(report.probabilities[5]).toBeCloseTo(1 / 6, 12);
  });

  it('se replie aussi sur une vue incohérente plutôt que de diviser par zéro', () => {
    const { view } = drawView('. o *');
    const impossible = { ...view, cells: ['hidden', 3, 'hidden'] };
    const tooFewMines = { ...view, mineCount: 0 };
    for (const broken of [impossible, tooFewMines]) {
      const report = computeProbabilities(readBoard(broken), new Map());
      expect(report.exact).toBe(false);
      expect(report.probabilities.every(value => value === null || (value >= 0 && value <= 1))).toBe(true);
    }
  });

  it('détecte des mines intérieures certaines', () => {
    // Le « 1 » a sa mine en frontière ; il reste 2 mines pour les 2 cases intérieures.
    const interior = risks('* o . * *');
    expect(interior.certain).toContainEqual(expect.objectContaining({ interior: true, result: 'mine', cells: [3, 4] }));
  });
});

/**
 * Probabilités par force brute : toutes les grilles compatibles, équiprobables.
 * @param {{width: number, height: number, mineCount: number, cells: Array}} view - Vue.
 * @returns {(number|null)[]}
 */
function bruteForce(view) {
  const unknown = view.cells.flatMap((cell, index) => (typeof cell === 'number' ? [] : [index]));
  const hits = new Array(view.cells.length).fill(0);
  let total = 0;
  const choose = (start, chosen) => {
    if (chosen.length === view.mineCount) {
      const counts = adjacentMineCounts(view.width, view.height, chosen);
      if (view.cells.every((cell, index) => typeof cell !== 'number' || counts[index] === cell)) {
        total += 1;
        chosen.forEach(index => { hits[index] += 1; });
      }
      return;
    }
    for (let i = start; i < unknown.length; i++) { choose(i + 1, [...chosen, unknown[i]]); }
  };
  choose(0, []);
  return view.cells.map((cell, index) => (typeof cell === 'number' ? null : hits[index] / total));
}

/**
 * Position aléatoire cohérente : mines tirées, une partie des cases sûres ouvertes.
 * @param {SeededRandom} rng - Générateur.
 * @returns {object} Vue.
 */
function randomPosition(rng) {
  const width = rng.int(3, 6);
  const height = rng.int(2, 4);
  const cells = width * height;
  const mines = rng.shuffle(Array.from({ length: cells }, (_, index) => index)).slice(0, rng.int(1, Math.floor(cells / 3)));
  const counts = adjacentMineCounts(width, height, mines);
  const view = Array.from({ length: cells }, (_, index) => (!mines.includes(index) && rng.chance(0.5) ? counts[index] : 'hidden'));
  return { width, height, mineCount: mines.length, cells: view, mines };
}

describe('comparaison avec la force brute', () => {
  it('coïncide avec l\'énumération de toutes les grilles compatibles, et les certitudes sont vraies', () => {
    const rng = new SeededRandom(2024);
    for (let trial = 0; trial < 150; trial++) {
      const position = randomPosition(rng);
      const analysis = analyze(position);
      const expected = bruteForce(position);
      expect(analysis.exact).toBe(true);
      analysis.probabilities.forEach((value, index) => {
        if (expected[index] === null) { expect(value).toBeNull(); } else { expect(value).toBeCloseTo(expected[index], 9); }
      });
      for (const step of analysis.steps) {
        step.cells.forEach(cell => expect(position.mines.includes(cell)).toBe(step.result === 'mine'));
        step.cells.forEach(cell => expect(expected[cell]).toBe(step.result === 'mine' ? 1 : 0));
      }
    }
  });

  it('conserve le nombre de mines sur une vraie partie Expert', () => {
    const engine = new MinesweeperEngine();
    const state = engine.applyAction(engine.init({ seed: 5, level: 'expert', noGuess: false, playerIds: ['p'] }), { type: 'reveal', index: 200 }, 'p');
    const { probabilities, exact } = analyze(engine.getPlayerView(state, 'p'));
    const sum = probabilities.reduce((total, value) => total + (value ?? 0), 0);
    expect(exact).toBe(true);
    expect(sum).toBeCloseTo(99, 6);
  });
});
