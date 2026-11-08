/**
 * Grilles d'automates cellulaires : Life 2D torique et historique 1D.
 *
 * Module pur, sans DOM. Les états sont stockés dans des tableaux typés plats
 * (indice = y · largeur + x) pour rester fluide jusqu'à 256×256 cellules.
 */

import { stepElementary } from './rules.js';

/** Âge maximal mémorisé (saturation du Uint16Array). */
export const MAX_AGE = 0xffff;

/** Intensité initiale de la traînée laissée par une cellule morte. */
export const TRAIL_START = 255;

/** Décroissance de la traînée par génération (environ 10 générations visibles). */
export const TRAIL_DECAY = 24;

/**
 * Grille 2D torique avec âge des cellules vivantes et traînée des mortes.
 * @typedef {object} LifeGrid
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} cells - 1 si vivante
 * @property {Uint16Array} ages - Générations consécutives en vie (0 si morte)
 * @property {Uint8Array} trail - Intensité de la traînée (0 = aucune)
 * @property {number} generation - Nombre de pas depuis l'origine
 * @property {number} population - Nombre de cellules vivantes
 * @property {Uint8Array} next - Tampon interne de la génération suivante
 * @property {Int32Array} left - Colonne voisine à gauche (repli torique)
 * @property {Int32Array} right - Colonne voisine à droite (repli torique)
 */

/**
 * Crée une grille vide.
 * @param {number} width
 * @param {number} height
 * @returns {LifeGrid}
 */
export function createLifeGrid(width, height) {
  const size = width * height;
  const left = new Int32Array(width);
  const right = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    left[x] = (x + width - 1) % width;
    right[x] = (x + 1) % width;
  }
  return {
    width,
    height,
    cells: new Uint8Array(size),
    ages: new Uint16Array(size),
    trail: new Uint8Array(size),
    generation: 0,
    population: 0,
    next: new Uint8Array(size),
    left,
    right,
  };
}

/**
 * Ramène une coordonnée dans [0, taille[ (repli torique, y compris négatif).
 * @param {number} value
 * @param {number} size
 * @returns {number}
 */
export function wrap(value, size) {
  return ((value % size) + size) % size;
}

/**
 * Lit une cellule (coordonnées repliées sur le tore).
 * @param {LifeGrid} grid
 * @param {number} x
 * @param {number} y
 * @returns {number} 0 ou 1
 */
export function getCell(grid, x, y) {
  return grid.cells[wrap(y, grid.height) * grid.width + wrap(x, grid.width)];
}

/**
 * Écrit une cellule (coordonnées repliées sur le tore) et tient la population à jour.
 * @param {LifeGrid} grid
 * @param {number} x
 * @param {number} y
 * @param {number} value - 0 ou 1
 * @returns {boolean} true si la cellule a changé
 */
export function setCell(grid, x, y, value) {
  const i = wrap(y, grid.height) * grid.width + wrap(x, grid.width);
  const alive = value ? 1 : 0;
  if (grid.cells[i] === alive) {
    return false;
  }
  grid.cells[i] = alive;
  grid.ages[i] = alive;
  grid.trail[i] = alive ? 0 : TRAIL_START;
  grid.population += alive ? 1 : -1;
  return true;
}

/**
 * Vide la grille et remet le compteur de générations à zéro.
 * @param {LifeGrid} grid
 */
export function clearGrid(grid) {
  grid.cells.fill(0);
  grid.ages.fill(0);
  grid.trail.fill(0);
  grid.population = 0;
  grid.generation = 0;
}

/**
 * Remplit la grille au hasard avec la densité demandée.
 * @param {LifeGrid} grid
 * @param {number} density - Probabilité de vie de chaque cellule (0-1)
 * @param {() => number} [random] - Source de hasard dans [0, 1[ (injectable pour les tests)
 */
export function randomizeGrid(grid, density, random = Math.random) {
  clearGrid(grid);
  let population = 0;
  for (let i = 0; i < grid.cells.length; i++) {
    if (random() < density) {
      grid.cells[i] = 1;
      grid.ages[i] = 1;
      population++;
    }
  }
  grid.population = population;
}

/**
 * Avance la grille d'une génération selon une table de transition
 * (`table[vivante * 9 + voisins]`, voir lifeRuleTable). Les bords sont
 * toriques : la cellule à droite du bord droit est la première de la ligne.
 * @param {LifeGrid} grid - Modifiée en place
 * @param {Uint8Array} table - 18 entrées
 */
export function stepLife(grid, table) {
  const { width, height, cells, next, left, right } = grid;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const up = ((y + height - 1) % height) * width;
    const down = ((y + 1) % height) * width;
    for (let x = 0; x < width; x++) {
      const l = left[x];
      const r = right[x];
      const neighbours =
        cells[up + l] + cells[up + x] + cells[up + r] +
        cells[row + l] + cells[row + r] +
        cells[down + l] + cells[down + x] + cells[down + r];
      next[row + x] = table[cells[row + x] * 9 + neighbours];
    }
  }
  commitGeneration(grid);
}

/**
 * Recopie la génération calculée et met à jour âges, traînées et population.
 * @param {LifeGrid} grid
 */
function commitGeneration(grid) {
  const { cells, next, ages, trail } = grid;
  let population = 0;
  for (let i = 0; i < cells.length; i++) {
    if (next[i]) {
      ages[i] = cells[i] ? Math.min(ages[i] + 1, MAX_AGE) : 1;
      trail[i] = 0;
      population++;
    } else {
      // Une cellule qui meurt laisse une traînée qui s'estompe ensuite.
      trail[i] = cells[i] ? TRAIL_START : Math.max(trail[i] - TRAIL_DECAY, 0);
      ages[i] = 0;
    }
  }
  cells.set(next);
  grid.population = population;
  grid.generation++;
}

/**
 * Copie indépendante de l'état d'une grille (pour annuler ou revenir à l'origine).
 * @param {LifeGrid} grid
 * @returns {{ cells: Uint8Array, ages: Uint16Array, generation: number, population: number }}
 */
export function snapshotGrid(grid) {
  return {
    cells: grid.cells.slice(),
    ages: grid.ages.slice(),
    generation: grid.generation,
    population: grid.population,
  };
}

/**
 * Restaure un instantané pris sur une grille de même taille ; efface la traînée.
 * @param {LifeGrid} grid
 * @param {ReturnType<typeof snapshotGrid>} snapshot
 */
export function restoreGrid(grid, snapshot) {
  grid.cells.set(snapshot.cells);
  grid.ages.set(snapshot.ages);
  grid.trail.fill(0);
  grid.generation = snapshot.generation;
  grid.population = snapshot.population;
}

/**
 * Pose une liste de cellules vivantes, centrée sur (cx, cy), avec repli torique.
 * @param {LifeGrid} grid
 * @param {{ width: number, height: number, cells: Array<[number, number]> }} pattern
 * @param {number} cx
 * @param {number} cy
 */
export function placePattern(grid, pattern, cx, cy) {
  const originX = cx - Math.floor(pattern.width / 2);
  const originY = cy - Math.floor(pattern.height / 2);
  for (const [x, y] of pattern.cells) {
    setCell(grid, originX + x, originY + y, 1);
  }
}

/**
 * Cellules traversées par un segment (algorithme de Bresenham) : un tracé
 * rapide au doigt reste continu même si les événements sont espacés.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<[number, number]>}
 */
export function lineCells(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) {
      return points;
    }
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x += sx; }
    if (e2 <= dx) { error += dx; y += sy; }
  }
}

/**
 * Historique défilant d'un automate élémentaire : les `rows` dernières
 * générations, avec l'âge de chaque cellule (générations consécutives en vie).
 * @typedef {object} ElementaryHistory
 * @property {number} width
 * @property {number} rows - Hauteur de la fenêtre visible
 * @property {Uint8Array} initial - Ligne de départ
 * @property {Uint8Array} current - Dernière ligne calculée
 * @property {Uint16Array} ages - Fenêtre visible (rows × width), 0 = morte
 * @property {number} filled - Lignes déjà remplies dans la fenêtre
 * @property {number} generation - Indice de la dernière ligne calculée
 * @property {Uint8Array} scratch - Tampon de calcul
 */

/**
 * Crée un historique positionné sur la génération 0.
 * @param {Uint8Array} initial - Ligne de départ
 * @param {number} visibleRows - Nombre de lignes visibles (au moins 2)
 * @returns {ElementaryHistory}
 */
export function createElementaryHistory(initial, visibleRows) {
  const width = initial.length;
  const rows = Math.max(2, Math.floor(visibleRows));
  const history = {
    width,
    rows,
    initial: initial.slice(),
    current: initial.slice(),
    ages: new Uint16Array(width * rows),
    filled: 1,
    generation: 0,
    scratch: new Uint8Array(width),
  };
  for (let x = 0; x < width; x++) {
    history.ages[x] = initial[x];
  }
  return history;
}

/**
 * Ajoute la génération suivante en bas ; la fenêtre défile une fois pleine.
 * @param {ElementaryHistory} history - Modifié en place
 * @param {number} rule - Numéro de Wolfram
 */
export function stepElementaryHistory(history, rule) {
  const { width, rows, ages } = history;
  const nextRow = stepElementary(history.current, rule, history.scratch);
  history.scratch = history.current;
  history.current = nextRow;
  if (history.filled === rows) {
    // Défilement : on décale la fenêtre d'une ligne vers le haut.
    ages.copyWithin(0, width);
  } else {
    history.filled++;
  }
  // La ligne précédente est toujours juste au-dessus de la nouvelle.
  const target = (history.filled - 1) * width;
  const source = target - width;
  for (let x = 0; x < width; x++) {
    ages[target + x] = nextRow[x] ? Math.min(ages[source + x] + 1, MAX_AGE) : 0;
  }
  history.generation++;
}

/**
 * Recalcule tout l'historique jusqu'à `generation` (changement de règle ou
 * de ligne de départ) en ne gardant que la fenêtre visible.
 * @param {Uint8Array} initial
 * @param {number} rows
 * @param {number} rule
 * @param {number} generation
 * @returns {ElementaryHistory}
 */
export function computeElementaryHistory(initial, rows, rule, generation) {
  const history = createElementaryHistory(initial, rows);
  for (let g = 0; g < generation; g++) {
    stepElementaryHistory(history, rule);
  }
  return history;
}

/**
 * Ligne de départ classique : une seule cellule vivante au centre.
 * @param {number} width
 * @returns {Uint8Array}
 */
export function centeredRow(width) {
  const row = new Uint8Array(width);
  row[Math.floor(width / 2)] = 1;
  return row;
}

/**
 * Ligne de départ aléatoire.
 * @param {number} width
 * @param {number} density - Probabilité de vie (0-1)
 * @param {() => number} [random]
 * @returns {Uint8Array}
 */
export function randomRow(width, density, random = Math.random) {
  const row = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    row[x] = random() < density ? 1 : 0;
  }
  return row;
}
