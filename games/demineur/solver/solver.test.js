/**
 * Tests du solveur : une grille dessinée par technique, puis le conseil et ses explications.
 * Les grilles sont dessinées avec `drawView` (voir __tests__/boards.js).
 */
import { analyze, adviseMove, findSafeCells } from './solver.js';
import { readBoard } from './board-reader.js';
import { comparePair, deduce } from './deductions.js';
import { defaultLabel, explainStep, formatPercent, plural } from './explanations.js';
import { drawView } from '../__tests__/boards.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';

/**
 * @param {string} drawing - Grille dessinée.
 * @param {object} [options] - Options de `drawView`.
 * @returns {{view: object, steps: object[], text: string[]}} Étapes et explications.
 */
function solve(drawing, options) {
  const { view } = drawView(drawing, options);
  const { steps } = deduce(readBoard(view));
  return { view, steps, text: steps.map(step => explainStep(step, view.cells, defaultLabel(view.width))) };
}

const summary = steps => steps.map(({ technique, result, cells }) => ({ technique, result, cells }));

describe('lecture de la vue', () => {
  it('ne garde que les chiffres qui touchent une case fermée', () => {
    const { view } = drawView(`
      * o .
      o o .`);
    const board = readBoard(view);
    expect(board.unknown).toEqual([0, 2, 5]);
    expect(board.constraints.map(({ origin, value, cells }) => ({ origin, value, cells }))).toEqual([
      { origin: 1, value: 1, cells: [0, 2, 5] },
      { origin: 3, value: 1, cells: [0] },
      { origin: 4, value: 1, cells: [0, 2, 5] },
    ]);
    expect(board.constraintsByCell.get(0)).toEqual([0, 1, 2]);
  });
});

describe('déductions : chiffre seul', () => {
  it('un chiffre sans autre voisine possible désigne une mine, puis libère les voisines d\'un autre', () => {
    const { steps, text } = solve(`
      * o .
      o o .`);
    expect(summary(steps)).toEqual([
      { technique: 'simple', result: 'mine', cells: [0] },
      { technique: 'simple', result: 'safe', cells: [2, 5] },
    ]);
    expect(text).toEqual([
      'Le 1 en (1, 2) n\'a qu\'une voisine fermée : c\'est une mine.',
      'Le 1 en (2, 2) touche déjà 1 mine certaine : ses autres voisines sont sûres.',
    ]);
  });

  it('parle de drapeaux quand le joueur les a posés, sans pour autant les croire', () => {
    const { steps, text } = solve(`
      F o .
      o o .`);
    expect(steps[0]).toMatchObject({ result: 'mine', cells: [0] });
    expect(text[1]).toBe('Le 1 en (2, 2) touche déjà 1 drapeau : ses autres voisines sont sûres.');
  });

  it('rédige les cas à plusieurs mines et le « 0 »', () => {
    expect(solve('* o *').text).toEqual(['Le 2 en (2, 1) n\'a que 2 voisines fermées : ce sont toutes des mines.']);
    // Le 3 en (3, 1) connaît déjà une mine et n'a plus que deux voisines pour les deux autres.
    const { text } = solve(`
      o * o *
      * o . *`);
    expect(text).toContain('Le 3 en (3, 1) touche déjà 1 mine certaine et n\'a plus que 2 voisines possibles pour 2 mines : ce sont toutes des mines.');
    expect(solve(`
      . o .
      . . .`, { mineCount: 1 }).text[0]).toBe('Le 0 en (2, 1) ne touche aucune mine : ses voisines sont sûres.');
  });
});

describe('déductions : paire de chiffres', () => {
  it('motif 1-1 contre un bord : la zone propre du second chiffre est sûre', () => {
    const { steps, text } = solve(`
      * . .
      o o .`);
    expect(summary(steps)).toEqual([{ technique: 'pair', result: 'safe', cells: [2, 5] }]);
    expect(text[0]).toBe('Le 1 en (1, 2) place au moins 1 mine parmi les cases qu\'il partage avec le 1 en (2, 2) : '
      + 'cela suffit à ce dernier, ses autres voisines sont sûres.');
  });

  it('motif 1-2-1 : la paire trouve une mine, le chiffre seul termine', () => {
    const { steps, text } = solve(`
      * . *
      o o o`);
    expect(summary(steps)).toEqual([
      { technique: 'pair', result: 'mine', cells: [2] },
      { technique: 'simple', result: 'safe', cells: [1] },
      { technique: 'simple', result: 'mine', cells: [0] },
    ]);
    expect(text[0]).toBe('Le 2 en (2, 2) attend encore 2 mines, mais au plus 1 peut se trouver parmi les cases '
      + 'qu\'il partage avec le 1 en (1, 2) : son autre voisine est une mine.');
  });

  it('accorde la borne et la zone propre au pluriel', () => {
    const a = { origin: 0, value: 2, cells: [1, 2, 3], need: 2, knownMines: [], uses: [] };
    const b = { origin: 9, value: 4, cells: [1, 2, 3, 4, 5], need: 4, knownMines: [], uses: [] };
    const step = comparePair(a, b);
    expect(step).toMatchObject({ result: 'mine', cells: [4, 5], bound: 2 });
    expect(explainStep(step, [], defaultLabel(9))).toContain('au plus 2 peuvent se trouver');
    expect(explainStep(step, [], defaultLabel(9))).toContain('ses 2 autres voisines sont des mines');
  });

  it('ne conclut rien sans case partagée, sur des zones identiques ou incohérentes', () => {
    const make = (cells, need) => ({ origin: 0, value: need, cells, need, knownMines: [], uses: [] });
    expect(comparePair(make([1, 2], 1), make([3, 4], 1))).toBeNull();
    expect(comparePair(make([1, 2], 1), make([1, 2], 1))).toBeNull();
    expect(comparePair(make([1], 0), make([1, 2], 2))).toBeNull();
  });
});

describe('déductions : compte global', () => {
  it('libère le reste quand toutes les mines sont localisées', () => {
    const { steps, text } = solve('o * .');
    expect(summary(steps)).toEqual([
      { technique: 'simple', result: 'mine', cells: [1] },
      { technique: 'count', result: 'safe', cells: [2] },
    ]);
    expect(text[1]).toBe('Toutes les mines sont localisées : les cases fermées restantes sont sûres.');
  });

  it('condamne le reste quand il y a autant de mines que de cases', () => {
    expect(solve('o * *').text[1]).toBe('Il ne reste qu\'une mine et une seule case fermée : elle est minée.');
    expect(solve('o * * *', { mineCount: 3 }).text[1]).toBe('Il reste 2 mines pour autant de cases fermées : elles sont toutes minées.');
  });
});

describe('analyse complète', () => {
  it('ajoute les certitudes de l\'énumération et rédige leur justification', () => {
    const { view } = drawView('. o * o .');
    const analysis = analyze(view);
    expect(summary(analysis.steps)).toEqual([
      { technique: 'enumeration', result: 'safe', cells: [0] },
      { technique: 'enumeration', result: 'mine', cells: [2] },
      { technique: 'enumeration', result: 'safe', cells: [4] },
    ]);
    expect(analysis.exact).toBe(true);
    expect(analysis.probabilities).toEqual([0, null, 1, null, 0]);
    expect(explainStep(analysis.steps[0], view.cells, defaultLabel(5))).toBe(
      'Dans la seule configuration compatible avec les chiffres et avec le nombre de mines restantes, la case (1, 1) n\'est jamais une mine.');
  });

  it('explique l\'énumération des cases intérieures et des mines', () => {
    const { view } = drawView('* o . .');
    const [step] = analyze(view).steps;
    expect(explainStep(step, view.cells, defaultLabel(4))).toBe('Sur les 2 configurations compatibles avec les chiffres '
      + 'et avec le nombre de mines restantes, les cases éloignées des chiffres ne sont jamais minées.');
    const mined = { ...step, result: 'mine', usesCount: false };
    expect(explainStep(mined, view.cells, defaultLabel(4))).toBe(
      'Sur les 2 configurations compatibles avec les chiffres, les cases éloignées des chiffres sont toutes minées.');
    expect(explainStep({ ...mined, interior: false, cells: [2] }, view.cells, defaultLabel(4))).toContain('la case (3, 1) est toujours une mine');
  });

  it('trouve les cases sûres sans énumérer quand la logique simple suffit', () => {
    expect(findSafeCells(drawView('* o .\no o .').view)).toEqual([2, 5]);
    expect(findSafeCells(drawView('. o * o .').view)).toEqual([0, 4]);
    expect(findSafeCells(drawView('. o *').view)).toEqual([]);
  });
});

describe('conseil (indice et bot)', () => {
  it('au premier coup, recommande le centre sans risque', () => {
    const view = { width: 9, height: 9, mineCount: 10, status: 'ready', cells: new Array(81).fill('hidden') };
    expect(adviseMove(view)).toMatchObject({ kind: 'start', index: 40, action: { type: 'reveal', index: 40 }, probability: 0 });
    expect(adviseMove(view).reason).toContain('Le centre (5, 5)');
  });

  it('désigne une case sûre et rappelle les déductions préalables invisibles', () => {
    const { view } = drawView('* o .\no o .');
    const hint = adviseMove(freezeInput(view));
    expect(hint).toMatchObject({ kind: 'safe', index: 2, action: { type: 'reveal', index: 2 }, probability: 0 });
    expect(hint.reason).toBe('Le 1 en (2, 2) touche déjà 1 mine certaine : ses autres voisines sont sûres.');
    expect(hint.because).toEqual(['Le 1 en (1, 2) n\'a qu\'une voisine fermée : c\'est une mine.']);
    // Le drapeau rend la mine visible : plus besoin de la justifier.
    expect(adviseMove(drawView('F o .\no o .').view).because).toEqual([]);
  });

  it('signale d\'abord un drapeau prouvé faux', () => {
    const { view } = drawView('f o *\no o .');
    const hint = adviseMove(view);
    expect(hint).toMatchObject({ kind: 'fix-flag', index: 0, action: { type: 'toggleFlag', index: 0 } });
    expect(hint.reason).toMatch(/^Le drapeau en \(1, 1\) est faux\. Le 0 en \(1, 2\)/);
  });

  it('propose de marquer une mine certaine quand aucune case n\'est sûre', () => {
    const hint = adviseMove(drawView('o * *').view);
    expect(hint).toMatchObject({ kind: 'flag', index: 1, action: { type: 'toggleFlag', index: 1 }, probability: 1 });
  });

  it('parie sur la case la moins risquée, avec sa probabilité et les égalités', () => {
    const { view } = drawView('. o * o . . * .');
    const hint = adviseMove(view);
    expect(hint).toMatchObject({ kind: 'guess', index: 0, candidates: [0, 4, 5, 6, 7] });
    expect(hint.probability).toBeCloseTo(0.25, 12);
    expect(hint.reason).toBe('Aucune case n\'est sûre : il faut prendre un risque. La case (1, 1) est la moins risquée, '
      + 'à égalité avec 4 autres cases : 25 % de chances de cacher une mine.');
    expect(adviseMove(view, { pick: cells => cells.at(-1) }).index).toBe(7);
  });

  it('signale une estimation quand l\'énumération dépasse son budget', () => {
    const hint = adviseMove(drawView('. o * o . . * .').view, { nodeBudget: 1 });
    expect(hint.reason).toContain('(estimation : trop de configurations pour un calcul exact)');
    // Repli : 1/2 autour de chaque chiffre, la densité restante (2 - 1,5) / 3 à l'intérieur.
    expect(hint.candidates).toEqual([5, 6, 7]);
    expect(hint.probability).toBeCloseTo(1 / 6, 12);
  });

  it('retire le drapeau le plus douteux quand toutes les cases fermées sont drapées', () => {
    const hint = adviseMove(drawView('F o f').view);
    expect(hint).toMatchObject({ kind: 'fix-flag', action: { type: 'toggleFlag', index: 0 }, probability: 0.5 });
    expect(hint.reason).toBe('Toutes les cases fermées portent un drapeau : il y en a donc un de trop. '
      + 'Le plus douteux est en (1, 1) (50 % de risque) : retirez-le.');
  });

  it('utilise les étiquettes fournies par la page (grille pivotée)', () => {
    const hint = adviseMove(drawView('* o .\no o .').view, { label: index => `«${index}»` });
    expect(hint.reason).toBe('Le 1 en «4» touche déjà 1 mine certaine : ses autres voisines sont sûres.');
  });
});

describe('mise en forme', () => {
  it('accorde et arrondit', () => {
    expect(plural(1, 'mine')).toBe('1 mine');
    expect(plural(3, 'drapeau', 'drapeaux')).toBe('3 drapeaux');
    expect([0, 0.004, 0.25, 0.996, 1].map(formatPercent)).toEqual(['0 %', '< 1 %', '25 %', '> 99 %', '100 %']);
  });
});
