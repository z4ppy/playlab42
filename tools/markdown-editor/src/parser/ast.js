/**
 * Arbre de travail du parseur et conversion vers l'AST public.
 *
 * Pendant l'analyse, les nœuds sont chaînés (parent, frère précédent et
 * suivant) : l'algorithme CommonMark déplace sans cesse des suites de nœuds
 * (contenu d'un lien, portée d'une emphase), ce qu'une liste chaînée fait en
 * temps constant. Une fois l'analyse terminée, `toPlain` produit un AST
 * d'objets simples, sans références circulaires, facile à tester et à rendre.
 *
 * @module parser/ast
 */

/**
 * @typedef {object} MdNode
 * @property {string} type - document, heading, paragraph, blockquote, list,
 *   item, code_block, thematic_break, table, text, softbreak, linebreak,
 *   code, emph, strong, del, link, image.
 * @property {MdNode[]} [children] - Enfants (blocs ou éléments en ligne).
 * @property {string} [literal] - Texte brut (text, code, code_block).
 * @property {number} [line] - Première ligne source (1 = première ligne).
 * @property {number} [endLine] - Dernière ligne source du bloc.
 * @property {number} [level] - Niveau d'un titre (1 à 6).
 * @property {string} [info] - Chaîne d'information d'un bloc de code clôturé.
 * @property {boolean} [ordered] - Liste ordonnée.
 * @property {number} [start] - Premier numéro d'une liste ordonnée.
 * @property {boolean} [tight] - Liste « serrée » (paragraphes sans <p>).
 * @property {boolean|null} [task] - État d'une case à cocher GFM, sinon null.
 * @property {number} [taskLine] - Ligne source de la case (`[ ]` peut suivre
 *   la ligne du marqueur de liste).
 * @property {number} [taskOffset] - Indice, dans cette ligne, du caractère
 *   entre crochets (absent si des définitions de liens le précèdent).
 * @property {string} [destination] - URL d'un lien ou d'une image (non filtrée).
 * @property {string} [title] - Titre d'un lien ou d'une image.
 * @property {Array<'left'|'center'|'right'|null>} [aligns] - Alignements d'un tableau.
 * @property {MdNode[][]} [head] - Cellules d'en-tête (contenu en ligne).
 * @property {MdNode[][][]} [rows] - Lignes du corps, cellule par cellule.
 */

/** Champs exposés dans l'AST public (les champs de travail sont omis). */
const PUBLIC_FIELDS = [
  'literal', 'line', 'endLine', 'level', 'info', 'ordered', 'start', 'tight',
  'task', 'taskLine', 'taskOffset', 'destination', 'title', 'aligns', 'head', 'rows',
];

/** Nœud chaîné utilisé pendant l'analyse des blocs et des éléments en ligne. */
export class Node {
  /**
   * @param {string} type - Type du nœud.
   * @param {Record<string, unknown>} [fields] - Champs initiaux.
   */
  constructor(type, fields = {}) {
    this.type = type;
    /** @type {Node|null} */ this.parent = null;
    /** @type {Node|null} */ this.prev = null;
    /** @type {Node|null} */ this.next = null;
    /** @type {Node|null} */ this.firstChild = null;
    /** @type {Node|null} */ this.lastChild = null;
    Object.assign(this, fields);
  }

  /**
   * Ajoute un enfant en dernière position.
   * @param {Node} child
   * @returns {Node} L'enfant ajouté.
   */
  appendChild(child) {
    child.unlink();
    child.parent = this;
    if (this.lastChild) {
      this.lastChild.next = child;
      child.prev = this.lastChild;
    } else {
      this.firstChild = child;
    }
    this.lastChild = child;
    return child;
  }

  /**
   * Insère un frère juste après ce nœud.
   * @param {Node} sibling
   */
  insertAfter(sibling) {
    sibling.unlink();
    sibling.next = this.next;
    if (sibling.next) {
      sibling.next.prev = sibling;
    }
    sibling.prev = this;
    this.next = sibling;
    sibling.parent = this.parent;
    if (this.parent && !sibling.next) {
      this.parent.lastChild = sibling;
    }
  }

  /** Détache le nœud de son parent et de ses frères. */
  unlink() {
    if (this.prev) {
      this.prev.next = this.next;
    } else if (this.parent) {
      this.parent.firstChild = this.next;
    }
    if (this.next) {
      this.next.prev = this.prev;
    } else if (this.parent) {
      this.parent.lastChild = this.prev;
    }
    this.parent = null;
    this.next = null;
    this.prev = null;
  }

  /**
   * Enfants sous forme de tableau (copie, sûre pendant une modification).
   * @returns {Node[]}
   */
  childList() {
    const list = [];
    for (let child = this.firstChild; child; child = child.next) {
      list.push(child);
    }
    return list;
  }
}

/**
 * Convertit un arbre chaîné en AST d'objets simples.
 * @param {Node} node
 * @returns {MdNode}
 */
export function toPlain(node) {
  /** @type {Record<string, unknown>} */
  const plain = { type: node.type };
  for (const key of PUBLIC_FIELDS) {
    if (node[key] !== undefined) {
      plain[key] = node[key];
    }
  }
  if (node.firstChild || CONTAINER_TYPES.has(node.type)) {
    const children = [];
    for (let child = node.firstChild; child; child = child.next) {
      children.push(toPlain(child));
    }
    plain.children = children;
  }
  return /** @type {MdNode} */ (plain);
}

/** Types qui portent toujours un tableau `children`, même vide. */
const CONTAINER_TYPES = new Set([
  'document', 'heading', 'paragraph', 'blockquote', 'list', 'item',
  'emph', 'strong', 'del', 'link', 'image',
]);

/**
 * Texte brut d'une suite d'éléments en ligne (titres, texte alternatif, TOC).
 * @param {MdNode[]|undefined} inlines
 * @returns {string}
 */
export function inlineText(inlines) {
  if (!inlines) {
    return '';
  }
  return inlines.map((node) => {
    if (node.type === 'softbreak' || node.type === 'linebreak') {
      return ' ';
    }
    return node.literal ?? inlineText(node.children);
  }).join('');
}

/**
 * Parcourt l'AST en profondeur (préordre) et appelle `visit` sur chaque nœud.
 * @param {MdNode} node
 * @param {(node: MdNode) => void} visit
 */
export function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
}
