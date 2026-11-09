/**
 * Rendu de la grille : un bouton natif par case, mis à jour seulement s'il change.
 *
 * Sur un écran en portrait, une grille plus large que haute (Expert, 30 × 16)
 * est affichée **pivotée** (16 × 30) : on garde des cases assez grandes pour le
 * doigt. Le moteur n'en sait rien : la disposition traduit seulement les indices
 * du moteur en positions à l'écran, et les coordonnées annoncées ou écrites dans
 * les explications sont celles que le joueur voit.
 */
import { toCoords } from '../engine/grid.js';
import { formatPercent } from '../solver/explanations.js';

/**
 * @typedef {Object} BoardLayout
 * @property {number} columns - Colonnes affichées.
 * @property {number} rows - Lignes affichées.
 * @property {boolean} transposed - Grille pivotée d'un quart de tour (lignes ↔ colonnes).
 * @property {(position: number) => number} indexAt - Indice moteur de la n-ième case à l'écran.
 * @property {(index: number) => {column: number, row: number}} screenOf - Position affichée (à partir de 0).
 * @property {(index: number) => string} label - Coordonnées affichées « (colonne, ligne) ».
 */

/**
 * Disposition d'une grille à l'écran.
 * @param {number} width - Colonnes du moteur.
 * @param {number} height - Lignes du moteur.
 * @param {boolean} transposed - Afficher la grille pivotée.
 * @returns {BoardLayout}
 */
export function boardLayout(width, height, transposed) {
  const columns = transposed ? height : width;
  const screenOf = index => {
    const { x, y } = toCoords(index, width);
    return transposed ? { column: y, row: x } : { column: x, row: y };
  };
  return {
    columns, rows: transposed ? width : height, transposed, screenOf,
    indexAt: position => {
      const column = position % columns;
      const row = Math.floor(position / columns);
      return transposed ? column * width + row : row * width + column;
    },
    label: index => {
      const { column, row } = screenOf(index);
      return `(${column + 1}, ${row + 1})`;
    },
  };
}

/** Description vocale de chaque contenu de case. */
const SPOKEN = {
  hidden: 'fermée', flag: 'drapeau', mine: 'mine', exploded: 'mine explosée', 'wrong-flag': 'drapeau erroné',
};

/**
 * @param {number|string} cell - Contenu visible.
 * @returns {string} Description pour les lecteurs d'écran.
 */
export function describeCell(cell) {
  if (cell === 0) { return 'vide'; }
  if (typeof cell === 'number') { return `${cell} ${cell > 1 ? 'mines voisines' : 'mine voisine'}`; }
  return SPOKEN[cell];
}

/**
 * Classe CSS d'une case.
 * @param {number|string} cell - Contenu visible.
 * @returns {string}
 */
function cellClass(cell) {
  return typeof cell === 'number' ? `cell open n${cell}` : `cell ${cell}`;
}

/**
 * Crée les boutons d'une grille dans l'ordre d'affichage.
 * @param {Document} document - Document hôte.
 * @param {BoardLayout} layout - Disposition.
 * @returns {{element: HTMLElement, buttons: HTMLButtonElement[]}} Grille et boutons par indice moteur.
 */
export function createBoard(document, layout) {
  const element = document.createElement('div');
  element.className = 'board';
  element.id = 'board';
  element.setAttribute('role', 'group');
  element.style.setProperty('--columns', String(layout.columns));
  element.style.setProperty('--rows', String(layout.rows));
  const buttons = [];
  for (let position = 0; position < layout.columns * layout.rows; position++) {
    const index = layout.indexAt(position);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.index = String(index);
    button.tabIndex = position === 0 ? 0 : -1;
    // Damier discret sur les cases fermées : on compte plus facilement les colonnes.
    button.dataset.shade = String((position % layout.columns + Math.floor(position / layout.columns)) % 2);
    buttons[index] = button;
    element.append(button);
  }
  return { element, buttons };
}

/**
 * @typedef {Object} RenderExtras
 * @property {(number|null)[]|null} risks - Probabilités à superposer (null : masquées).
 * @property {number|null} hint - Case conseillée.
 * @property {number[]} sources - Chiffres qui justifient le conseil.
 * @property {number|null} origin - Case jouée : point de départ de l'animation en cascade.
 */

/**
 * Délai d'apparition d'une case ouverte, proportionnel à sa distance au clic.
 * @param {BoardLayout} layout - Disposition.
 * @param {number} index - Case ouverte.
 * @param {number|null} origin - Case jouée.
 * @returns {string} Délai CSS.
 */
function cascadeDelay(layout, index, origin) {
  if (origin === null) { return '0ms'; }
  const a = layout.screenOf(index);
  const b = layout.screenOf(origin);
  return `${Math.min(480, 18 * Math.max(Math.abs(a.column - b.column), Math.abs(a.row - b.row)))}ms`;
}

/**
 * Met à jour une case si son contenu, son risque ou sa mise en évidence ont changé.
 * @param {HTMLButtonElement} button - Bouton de la case.
 * @param {{cell: number|string, risk: number|null|undefined, hint: boolean, source: boolean, label: string}} look - Aspect voulu.
 * @param {string} delay - Délai d'animation si la case vient de s'ouvrir.
 */
function paintCell(button, look, delay) {
  const risk = look.risk === null || look.risk === undefined ? '' : formatPercent(look.risk);
  const key = `${look.cell}|${risk}|${look.hint}|${look.source}`;
  if (button.dataset.key === key) { return; }
  button.className = cellClasses(button, look, risk);
  button.style.setProperty('--delay', delay);
  button.style.setProperty('--risk', risk ? String(look.risk) : '0');
  button.dataset.risk = risk.replace(' %', '');
  button.textContent = look.cell > 0 ? String(look.cell) : '';
  button.setAttribute('aria-label', spokenLabel(look, risk));
  button.dataset.key = key;
}

/**
 * Classes d'une case. Une case qui passe de fermée à chiffre s'anime (sauf au tout premier rendu).
 * @param {HTMLButtonElement} button - Bouton dans son état précédent.
 * @param {{cell: number|string, hint: boolean, source: boolean}} look - Aspect voulu.
 * @param {string} risk - Risque formaté, ou chaîne vide.
 * @returns {string}
 */
function cellClasses(button, look, risk) {
  const opening = typeof look.cell === 'number' && !button.classList.contains('open') && Boolean(button.dataset.key);
  return [cellClass(look.cell), risk && 'risk', look.hint && 'hint', look.source && 'source', opening && 'reveal']
    .filter(Boolean).join(' ');
}

/**
 * Nom accessible complet d'une case : position, contenu, risque et conseil.
 * @param {{cell: number|string, hint: boolean, label: string}} look - Aspect voulu.
 * @param {string} risk - Risque formaté, ou chaîne vide.
 * @returns {string}
 */
function spokenLabel(look, risk) {
  const parts = [`${look.label} : ${describeCell(look.cell)}`];
  if (risk) { parts.push(`risque ${risk}`); }
  if (look.hint) { parts.push('conseillée'); }
  return parts.join(', ');
}

/**
 * Applique une vue joueur aux boutons.
 * @param {HTMLButtonElement[]} buttons - Boutons par indice moteur.
 * @param {BoardLayout} layout - Disposition.
 * @param {{cells: Array<number|string>}} view - Vue joueur.
 * @param {RenderExtras} extras - Probabilités, conseil et origine de la cascade.
 */
export function renderBoard(buttons, layout, view, extras) {
  const sources = new Set(extras.sources);
  view.cells.forEach((cell, index) => {
    const risk = extras.risks && typeof cell !== 'number' ? extras.risks[index] : null;
    paintCell(buttons[index], {
      cell, risk, hint: extras.hint === index, source: sources.has(index), label: layout.label(index),
    }, cascadeDelay(layout, index, extras.origin));
  });
}
