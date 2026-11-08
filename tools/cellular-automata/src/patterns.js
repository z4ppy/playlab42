/**
 * Bibliothèque de motifs et format RLE (Run Length Encoded).
 *
 * Le RLE est le format d'échange standard des motifs de Life (Golly, LifeWiki) :
 * « 3o » = 3 cellules vivantes, « 2b » = 2 mortes, « $ » = fin de ligne,
 * « ! » = fin du motif. Module pur, sans DOM.
 */

/**
 * Motif décodé : cellules vivantes relatives au coin haut-gauche.
 * @typedef {object} Pattern
 * @property {number} width
 * @property {number} height
 * @property {Array<[number, number]>} cells - Coordonnées [x, y] des cellules vivantes
 */

/**
 * Entrée de la bibliothèque.
 * @typedef {object} LibraryPattern
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} rle
 * @property {string} [rule] - Règle pour laquelle le motif a été conçu (B3/S23 sinon)
 */

/** @type {readonly LibraryPattern[]} */
export const PATTERNS = Object.freeze([
  { id: 'glider', name: 'Planeur', category: 'Vaisseaux', rle: 'bo$2bo$3o!' },
  { id: 'lwss', name: 'Vaisseau léger', category: 'Vaisseaux', rle: 'bo2bo$o$o3bo$4o!' },
  { id: 'mwss', name: 'Vaisseau moyen', category: 'Vaisseaux', rle: '3bo$bo3bo$o$o4bo$5o!' },
  { id: 'hwss', name: 'Vaisseau lourd', category: 'Vaisseaux', rle: '3b2o$bo4bo$o$o5bo$6o!' },
  {
    id: 'gosper-gun',
    name: 'Canon de Gosper',
    category: 'Canons',
    rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
  },
  { id: 'blinker', name: 'Clignotant', category: 'Oscillateurs', rle: '3o!' },
  { id: 'toad', name: 'Crapaud', category: 'Oscillateurs', rle: 'b3o$3o!' },
  { id: 'beacon', name: 'Balise', category: 'Oscillateurs', rle: '2o$2o$2b2o$2b2o!' },
  {
    id: 'pulsar',
    name: 'Pulsar',
    category: 'Oscillateurs',
    rle: '2b3o3b3o2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2$2b3o3b3o$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!',
  },
  { id: 'pentadecathlon', name: 'Pentadécathlon', category: 'Oscillateurs', rle: '2bo4bo$2ob4ob2o$2bo4bo!' },
  {
    id: 'kok-galaxy',
    name: 'Galaxie de Kok',
    category: 'Oscillateurs',
    rle: '6ob2o$6ob2o$7b2o$2o5b2o$2o5b2o$2o5b2o$2o$2ob6o$2ob6o!',
  },
  { id: 'block', name: 'Bloc', category: 'Stables', rle: '2o$2o!' },
  { id: 'r-pentomino', name: 'R-pentomino', category: 'Mathusalems', rle: 'b2o$2o$bo!' },
  { id: 'acorn', name: 'Gland', category: 'Mathusalems', rle: 'bo$3bo$2o2b3o!' },
  { id: 'diehard', name: 'Diehard', category: 'Mathusalems', rle: '6bo$2o$bo3b3o!' },
  { id: 'infinite-line', name: 'Croissance infinie', category: 'Mathusalems', rle: '8ob5o3b3o6b7ob5o!' },
  {
    id: 'highlife-replicator',
    name: 'Réplicateur HighLife',
    category: 'Réplicateurs',
    rle: '2b3o$bo2bo$o3bo$o2bo$3o!',
    rule: 'B36/S23',
  },
]);

/**
 * Bornes de décodage : un motif qui les dépasse est refusé avant toute
 * allocation (un permalien piégé « 999999999o! » ne peut pas geler l'onglet).
 * @typedef {object} RleLimits
 * @property {number} [maxWidth] - Largeur maximale (cellules)
 * @property {number} [maxHeight] - Hauteur maximale (cellules)
 */

/**
 * Au-delà de ces dimensions, aucun motif n'a de sens dans l'outil : borne par
 * défaut quand l'appelant n'en fournit pas.
 */
export const MAX_RLE_SIDE = 4096;

/**
 * Applique un caractère RLE de cellule ou de fin de ligne au curseur.
 * @param {{ x: number, y: number, width: number, cells: Array<[number, number]> }} cursor
 * @param {string} tag - « b », « o » ou « $ »
 * @param {number} count
 * @param {{ maxWidth: number, maxHeight: number }} limits
 * @throws {Error} Si une cellule vivante sort des bornes
 */
function applyRleTag(cursor, tag, count, limits) {
  if (tag === '$') {
    cursor.y += count;
    cursor.x = 0;
    return;
  }
  if (tag === 'o') {
    // Vérifié avant la boucle : rien n'est alloué pour un compteur démesuré.
    if (cursor.x + count > limits.maxWidth || cursor.y >= limits.maxHeight) {
      throw new Error('Motif RLE trop grand');
    }
    for (let i = 0; i < count; i++) {
      cursor.cells.push([cursor.x + i, cursor.y]);
    }
  }
  cursor.x += count;
  cursor.width = Math.max(cursor.width, cursor.x);
}

/**
 * Décode un motif RLE. Les lignes d'en-tête (« x = 3, y = 3 ») et de
 * commentaire (« # … ») sont ignorées ; « . » et « * » sont tolérés.
 * Les plages mortes et les sauts de ligne ne créent aucune cellule : seules
 * les cellules vivantes sont confrontées aux bornes.
 * @param {string} rle
 * @param {RleLimits} [limits]
 * @returns {Pattern}
 * @throws {Error} Si un caractère inattendu est rencontré ou si le motif dépasse les bornes
 */
export function parseRle(rle, { maxWidth = MAX_RLE_SIDE, maxHeight = MAX_RLE_SIDE } = {}) {
  const body = String(rle)
    .split('\n')
    .filter((line) => !/^\s*(#|x\s*=)/.test(line))
    .join('')
    .replace(/\s+/g, '');
  const cursor = { x: 0, y: 0, width: 0, cells: /** @type {Array<[number, number]>} */ ([]) };
  const tokens = body.split('!')[0].matchAll(/(\d*)(.)/g);
  for (const [, digits, rawTag] of tokens) {
    const tag = { '.': 'b', '*': 'o' }[rawTag] ?? rawTag;
    if (!['b', 'o', '$'].includes(tag)) {
      throw new Error(`Caractère RLE inattendu : « ${rawTag} »`);
    }
    applyRleTag(cursor, tag, digits ? Number(digits) : 1, { maxWidth, maxHeight });
  }
  const height = cursor.cells.reduce((max, [, y]) => Math.max(max, y + 1), 0);
  return { width: cursor.width, height, cells: cursor.cells };
}

/**
 * Écrit une plage RLE (« 3o », « b »…).
 * @param {number} count
 * @param {string} tag
 * @returns {string}
 */
function run(count, tag) {
  return count > 1 ? `${count}${tag}` : tag;
}

/**
 * Encode une ligne en RLE en omettant les cellules mortes finales.
 * @param {Uint8Array} cells
 * @param {number} start - Indice du début de ligne
 * @param {number} width
 * @returns {string}
 */
function encodeRow(cells, start, width) {
  let out = '';
  let x = 0;
  while (x < width) {
    const value = cells[start + x];
    let length = 1;
    while (x + length < width && cells[start + x + length] === value) {
      length++;
    }
    // Une plage morte en fin de ligne est implicite.
    if (value || x + length < width) {
      out += run(length, value ? 'o' : 'b');
    }
    x += length;
  }
  return out;
}

/**
 * Encode une grille (0/1, indice = y · largeur + x) en RLE compact.
 * Les lignes vides consécutives sont regroupées (« 3$ ») et les lignes
 * vides finales omises : une grille vide donne « ! ».
 * @param {Uint8Array} cells
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
export function encodeRle(cells, width, height) {
  let out = '';
  let pendingRows = 0;
  for (let y = 0; y < height; y++) {
    const row = encodeRow(cells, y * width, width);
    if (row === '') {
      pendingRows++;
      continue;
    }
    if (out !== '' || pendingRows > 0) {
      out += run(pendingRows + (out === '' ? 0 : 1), '$');
    }
    out += row;
    pendingRows = 0;
  }
  return `${out}!`;
}

/**
 * Écrit les cellules d'un motif RLE dans une grille plate, sans repli :
 * les cellules hors cadre sont ignorées.
 * @param {string} rle
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function rleToCells(rle, width, height) {
  const cells = new Uint8Array(width * height);
  for (const [x, y] of parseRle(rle).cells) {
    if (x < width && y < height) {
      cells[y * width + x] = 1;
    }
  }
  return cells;
}

/**
 * Tourne un motif d'un quart de tour dans le sens horaire.
 * (x, y) → (hauteur − 1 − y, x)
 * @param {Pattern} pattern
 * @returns {Pattern}
 */
export function rotatePattern(pattern) {
  return {
    width: pattern.height,
    height: pattern.width,
    cells: pattern.cells.map(([x, y]) => [pattern.height - 1 - y, x]),
  };
}

/**
 * Retrouve un motif de la bibliothèque.
 * @param {string} id
 * @returns {LibraryPattern|undefined}
 */
export function findPattern(id) {
  return PATTERNS.find((p) => p.id === id);
}
