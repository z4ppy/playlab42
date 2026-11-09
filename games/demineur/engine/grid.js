/**
 * Géométrie du démineur : niveaux, indices et voisinages.
 *
 * Une case est repérée par un indice unique `index = y * width + x`
 * (x = colonne, y = ligne, origine en haut à gauche). Ce format reste
 * sérialisable et sert aussi bien au moteur qu'au solveur et à la vue.
 */

/**
 * @typedef {Object} Level
 * @property {string} id - Identifiant stable (clé de configuration et de record).
 * @property {string} label - Nom affiché.
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mines - Nombre de mines.
 */

/** Les trois niveaux historiques du démineur de Windows. */
export const LEVELS = Object.freeze({
  beginner: Object.freeze({ id: 'beginner', label: 'Débutant', width: 9, height: 9, mines: 10 }),
  intermediate: Object.freeze({ id: 'intermediate', label: 'Intermédiaire', width: 16, height: 16, mines: 40 }),
  expert: Object.freeze({ id: 'expert', label: 'Expert', width: 30, height: 16, mines: 99 }),
});

// Les tables de voisins sont recalculées des milliers de fois par le solveur :
// on les mémorise par dimensions. Le cache ne dépend que de (width, height),
// il ne rend donc pas les fonctions impures.
const neighborCache = new Map();

/**
 * Calcule les voisins (jusqu'à huit) d'une case, dans l'ordre de lecture.
 * @param {number} index - Indice de la case.
 * @param {number} width - Nombre de colonnes.
 * @param {number} height - Nombre de lignes.
 * @returns {number[]} Indices voisins.
 */
function computeNeighbors(index, width, height) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && nx < width && ny >= 0 && ny < height) {
        result.push(ny * width + nx);
      }
    }
  }
  return result;
}

/**
 * Retourne la table des voisins de chaque case (tableaux gelés, partagés).
 * @param {number} width - Nombre de colonnes.
 * @param {number} height - Nombre de lignes.
 * @returns {ReadonlyArray<ReadonlyArray<number>>} `table[index]` liste les voisins.
 */
export function neighborTable(width, height) {
  const key = `${width}x${height}`;
  if (!neighborCache.has(key)) {
    const table = Array.from({ length: width * height }, (_, index) => Object.freeze(computeNeighbors(index, width, height)));
    neighborCache.set(key, Object.freeze(table));
  }
  return neighborCache.get(key);
}

/**
 * Convertit un indice en coordonnées.
 * @param {number} index - Indice de la case.
 * @param {number} width - Nombre de colonnes.
 * @returns {{x: number, y: number}} Colonne et ligne, à partir de 0.
 */
export function toCoords(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

/**
 * Compte, pour chaque case, les mines parmi ses voisines.
 * @param {number} width - Nombre de colonnes.
 * @param {number} height - Nombre de lignes.
 * @param {Iterable<number>} mines - Indices des mines.
 * @returns {number[]} Nombre de mines voisines par case (une mine compte aussi ses voisines).
 */
export function adjacentMineCounts(width, height, mines) {
  const table = neighborTable(width, height);
  const counts = new Array(width * height).fill(0);
  for (const mine of mines) {
    for (const neighbor of table[mine]) { counts[neighbor] += 1; }
  }
  return counts;
}
