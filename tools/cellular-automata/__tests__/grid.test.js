/**
 * Tests de la grille Life torique et de l'historique 1D.
 */

import {
  centeredRow,
  clearGrid,
  computeElementaryHistory,
  createElementaryHistory,
  createLifeGrid,
  getCell,
  lineCells,
  MAX_AGE,
  placePattern,
  randomizeGrid,
  randomRow,
  restoreGrid,
  setCell,
  snapshotGrid,
  stepElementaryHistory,
  stepLife,
  TRAIL_DECAY,
  TRAIL_START,
  wrap,
} from '../src/grid.js';
import { lifeRuleTable, parseLifeRule } from '../src/rules.js';
import { parseRle } from '../src/patterns.js';

const CONWAY = lifeRuleTable({ birth: [3], survive: [2, 3] });

/** Liste triée des cellules vivantes « x,y ». */
function aliveCells(grid) {
  const cells = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.cells[y * grid.width + x]) {
        cells.push(`${x},${y}`);
      }
    }
  }
  return cells.sort();
}

/** Pose des cellules à partir de coordonnées absolues. */
function seed(grid, cells) {
  for (const [x, y] of cells) {
    setCell(grid, x, y, 1);
  }
}

/** Décale une liste de cellules sur le tore. */
function shifted(cells, dx, dy, grid) {
  return cells.map(([x, y]) => `${wrap(x + dx, grid.width)},${wrap(y + dy, grid.height)}`).sort();
}

describe('grille torique', () => {
  it('replie les coordonnées négatives et hors cadre', () => {
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(10, 10)).toBe(0);
    expect(wrap(-21, 10)).toBe(9);
    const grid = createLifeGrid(4, 3);
    setCell(grid, -1, -1, 1);
    expect(getCell(grid, 3, 2)).toBe(1);
    expect(getCell(grid, 7, 5)).toBe(1);
  });

  it('tient la population à jour et signale les changements', () => {
    const grid = createLifeGrid(5, 5);
    expect(setCell(grid, 1, 1, 1)).toBe(true);
    expect(setCell(grid, 1, 1, 1)).toBe(false);
    expect(grid.population).toBe(1);
    expect(setCell(grid, 1, 1, 0)).toBe(true);
    expect(grid.population).toBe(0);
    // Une cellule effacée laisse une traînée.
    expect(grid.trail[6]).toBe(TRAIL_START);
  });
});

describe('Life B3/S23', () => {
  it('le clignotant oscille avec une période 2', () => {
    const grid = createLifeGrid(5, 5);
    seed(grid, [[1, 2], [2, 2], [3, 2]]);
    stepLife(grid, CONWAY);
    expect(aliveCells(grid)).toEqual(['2,1', '2,2', '2,3']);
    stepLife(grid, CONWAY);
    expect(aliveCells(grid)).toEqual(['1,2', '2,2', '3,2']);
    expect(grid.generation).toBe(2);
    expect(grid.population).toBe(3);
  });

  it('le bloc est stable et ses cellules vieillissent', () => {
    const grid = createLifeGrid(4, 4);
    seed(grid, [[1, 1], [2, 1], [1, 2], [2, 2]]);
    for (let g = 0; g < 5; g++) {
      stepLife(grid, CONWAY);
    }
    expect(aliveCells(grid)).toEqual(['1,1', '1,2', '2,1', '2,2']);
    expect(grid.ages[1 * 4 + 1]).toBe(6);
  });

  it('le planeur se décale de (1, 1) toutes les 4 générations', () => {
    const grid = createLifeGrid(10, 10);
    const glider = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
    seed(grid, glider);
    for (let g = 0; g < 4; g++) {
      stepLife(grid, CONWAY);
    }
    expect(aliveCells(grid)).toEqual(shifted(glider, 1, 1, grid));
  });

  it('le planeur traverse le bord torique et revient à son point de départ', () => {
    // Sur un tore 8×8, il faut 8 périodes de 4 générations pour un tour complet.
    const grid = createLifeGrid(8, 8);
    const glider = [[6, 5], [7, 6], [5, 7], [6, 7], [7, 7]];
    seed(grid, glider);
    stepLife(grid, CONWAY);
    stepLife(grid, CONWAY);
    stepLife(grid, CONWAY);
    stepLife(grid, CONWAY);
    // Après une période, une partie du planeur est passée de l'autre côté.
    expect(aliveCells(grid)).toEqual(shifted(glider, 1, 1, grid));
    expect(aliveCells(grid)).toContain('0,0');
    for (let g = 0; g < 28; g++) {
      stepLife(grid, CONWAY);
    }
    expect(aliveCells(grid)).toEqual(shifted(glider, 0, 0, grid));
  });

  it('les voisins traversent les bords (naissance dans un coin)', () => {
    // Trois cellules aux trois autres coins entourent le coin (0, 0).
    const grid = createLifeGrid(6, 6);
    seed(grid, [[5, 0], [0, 5], [5, 5]]);
    stepLife(grid, CONWAY);
    expect(getCell(grid, 0, 0)).toBe(1);
  });

  it('HighLife B36/S23 diffère de Conway avec 6 voisins', () => {
    const table = lifeRuleTable(/** @type {any} */ (parseLifeRule('B36/S23').rule));
    const grid = createLifeGrid(7, 7);
    // Six cellules autour de (3, 3) : naissance en HighLife seulement.
    seed(grid, [[2, 2], [3, 2], [4, 2], [2, 4], [3, 4], [4, 4]]);
    stepLife(grid, table);
    expect(getCell(grid, 3, 3)).toBe(1);
    const conway = createLifeGrid(7, 7);
    seed(conway, [[2, 2], [3, 2], [4, 2], [2, 4], [3, 4], [4, 4]]);
    stepLife(conway, CONWAY);
    expect(getCell(conway, 3, 3)).toBe(0);
  });

  it('la traînée apparaît à la mort puis s’estompe', () => {
    const grid = createLifeGrid(5, 5);
    setCell(grid, 2, 2, 1);
    stepLife(grid, CONWAY);
    const i = 2 * 5 + 2;
    expect(grid.trail[i]).toBe(TRAIL_START);
    stepLife(grid, CONWAY);
    expect(grid.trail[i]).toBe(TRAIL_START - TRAIL_DECAY);
    for (let g = 0; g < 20; g++) {
      stepLife(grid, CONWAY);
    }
    expect(grid.trail[i]).toBe(0);
  });

  it('l’âge sature sans déborder', () => {
    const grid = createLifeGrid(4, 4);
    seed(grid, [[1, 1], [2, 1], [1, 2], [2, 2]]);
    grid.ages[5] = MAX_AGE;
    stepLife(grid, CONWAY);
    expect(grid.ages[5]).toBe(MAX_AGE);
  });
});

describe('édition de la grille', () => {
  it('remplit au hasard selon la densité et compte la population', () => {
    const grid = createLifeGrid(10, 10);
    let n = 0;
    // Source déterministe : une cellule sur quatre est sous la densité.
    randomizeGrid(grid, 0.3, () => ((n++ % 4) === 0 ? 0.1 : 0.9));
    expect(grid.population).toBe(25);
    expect(grid.generation).toBe(0);
  });

  it('efface tout et remet la génération à zéro', () => {
    const grid = createLifeGrid(4, 4);
    seed(grid, [[0, 0], [1, 1]]);
    stepLife(grid, CONWAY);
    clearGrid(grid);
    expect(grid.population).toBe(0);
    expect(grid.generation).toBe(0);
    expect(aliveCells(grid)).toEqual([]);
  });

  it('pose un motif centré avec repli torique', () => {
    const grid = createLifeGrid(6, 6);
    placePattern(grid, parseRle('3o!'), 0, 0);
    expect(aliveCells(grid)).toEqual(['0,0', '1,0', '5,0']);
  });

  it('restaure un instantané', () => {
    const grid = createLifeGrid(5, 5);
    seed(grid, [[1, 2], [2, 2], [3, 2]]);
    const snapshot = snapshotGrid(grid);
    stepLife(grid, CONWAY);
    restoreGrid(grid, snapshot);
    expect(aliveCells(grid)).toEqual(['1,2', '2,2', '3,2']);
    expect(grid.generation).toBe(0);
    expect(grid.population).toBe(3);
  });

  it('trace des segments continus (Bresenham)', () => {
    expect(lineCells(0, 0, 3, 0)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(lineCells(0, 0, 2, 2)).toEqual([[0, 0], [1, 1], [2, 2]]);
    expect(lineCells(2, 1, 2, 1)).toEqual([[2, 1]]);
    expect(lineCells(3, 0, 0, 1)).toHaveLength(4);
  });
});

describe('historique 1D', () => {
  it('ligne centrée et ligne aléatoire', () => {
    expect(Array.from(centeredRow(5))).toEqual([0, 0, 1, 0, 0]);
    let n = 0;
    expect(Array.from(randomRow(4, 0.5, () => (n++ % 2 ? 0.9 : 0.1)))).toEqual([1, 0, 1, 0]);
  });

  it('remplit la fenêtre ligne par ligne puis défile', () => {
    const history = createElementaryHistory(centeredRow(7), 3);
    stepElementaryHistory(history, 90);
    expect(history.filled).toBe(2);
    stepElementaryHistory(history, 90);
    expect(history.filled).toBe(3);
    stepElementaryHistory(history, 90);
    expect(history.filled).toBe(3);
    expect(history.generation).toBe(3);
    // Règle 90 sur un anneau de 7 : 0001000 → 0010100 → 0100010 → 1010101
    // (les extrémités se voient). La fenêtre de 3 lignes montre les générations 1 à 3.
    const rowsSeen = [0, 7, 14].map((start) =>
      Array.from(history.ages.subarray(start, start + 7)).map((age) => (age ? 1 : 0)).join(''));
    expect(rowsSeen).toEqual(['0010100', '0100010', '1010101']);
  });

  it('mesure l’âge comme le nombre de générations consécutives en vie', () => {
    // Règle 204 = identité : la cellule centrale vit indéfiniment.
    const history = computeElementaryHistory(centeredRow(5), 2, 204, 10);
    expect(history.ages[5 + 2]).toBe(11);
    expect(history.ages[2]).toBe(10);
  });

  it('recalcul complet identique à des pas successifs', () => {
    const steps = createElementaryHistory(centeredRow(31), 8);
    for (let g = 0; g < 20; g++) {
      stepElementaryHistory(steps, 30);
    }
    const computed = computeElementaryHistory(centeredRow(31), 8, 30, 20);
    expect(Array.from(computed.ages)).toEqual(Array.from(steps.ages));
    expect(Array.from(computed.current)).toEqual(Array.from(steps.current));
  });

  it('impose au moins deux lignes visibles', () => {
    expect(createElementaryHistory(centeredRow(3), 1).rows).toBe(2);
  });
});
