/**
 * Construction de l'aperçu dans le DOM à partir de l'arbre d'éléments de
 * `render-html.js`, sans jamais passer par `innerHTML`.
 *
 * Défense en profondeur : seules les balises et attributs de la liste
 * blanche sont créés ; le texte passe par des nœuds texte. Pour rester
 * fluide sur un long document, les blocs de premier niveau inchangés sont
 * réutilisés d'un rendu à l'autre (seuls leurs numéros de ligne sont décalés).
 *
 * @module ui/dom-render
 */

import { toHtml } from '../render-html.js';

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre',
  'code', 'span', 'em', 'strong', 'del', 'a', 'img', 'br', 'hr', 'input', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const ALLOWED_ATTRS = new Set([
  'href', 'title', 'src', 'alt', 'class', 'id', 'start', 'align', 'type', 'checked',
  'disabled', 'data-line', 'data-task-line', 'data-task-offset', 'aria-label',
]);
const LINE_ATTRS = ['data-line', 'data-task-line'];

/**
 * Crée le nœud DOM d'un élément de l'arbre.
 * @param {Document} doc
 * @param {import('../render-html.js').HNode} node
 * @returns {Node}
 */
export function buildNode(doc, node) {
  if ('text' in node) {
    return doc.createTextNode(node.text);
  }
  if (!ALLOWED_TAGS.has(node.tag)) {
    throw new Error(`Balise non autorisée dans l'aperçu : ${node.tag}`);
  }
  const element = doc.createElement(node.tag);
  for (const [name, value] of Object.entries(node.attrs)) {
    if (ALLOWED_ATTRS.has(name)) {
      element.setAttribute(name, value);
    }
  }
  for (const child of node.children) {
    element.append(buildNode(doc, child));
  }
  return element;
}

/**
 * Décale les numéros de ligne d'un bloc réutilisé.
 * @param {Element} element
 * @param {number} delta
 */
function shiftLines(element, delta) {
  const targets = [element, ...element.querySelectorAll('[data-line], [data-task-line]')];
  for (const target of targets) {
    for (const name of LINE_ATTRS) {
      const value = target.getAttribute(name);
      if (value !== null) {
        target.setAttribute(name, String(Number(value) + delta));
      }
    }
  }
}

/**
 * @typedef {object} RenderedBlock
 * @property {string} key - HTML du bloc sans numéros de ligne.
 * @property {Node} node
 * @property {number} line
 */

/** Rendu incrémental des blocs de premier niveau dans un conteneur. */
export class PreviewRenderer {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    /** @type {RenderedBlock[]} */
    this.blocks = [];
  }

  /**
   * Met l'aperçu à jour.
   * @param {import('../render-html.js').HNode[]} tree
   * @returns {{ reused: number, created: number }}
   */
  render(tree) {
    /** @type {Map<string, RenderedBlock[]>} */
    const pool = new Map();
    for (const block of this.blocks) {
      const list = pool.get(block.key) ?? [];
      list.push(block);
      pool.set(block.key, list);
    }
    let reused = 0;
    const next = tree.map((hnode) => {
      const key = toHtml([hnode], { skipLines: true });
      const line = 'attrs' in hnode ? Number(hnode.attrs['data-line'] ?? 0) : 0;
      const previous = pool.get(key)?.shift();
      if (previous) {
        reused += 1;
        if (previous.line !== line && previous.node instanceof Element) {
          shiftLines(previous.node, line - previous.line);
        }
        return { key, line, node: previous.node };
      }
      return { key, line, node: buildNode(this.container.ownerDocument, hnode) };
    });
    this.reconcile(next);
    return { reused, created: next.length - reused };
  }

  /**
   * Place les nœuds dans l'ordre voulu en ne déplaçant que le nécessaire.
   * @param {RenderedBlock[]} next
   */
  reconcile(next) {
    const keep = new Set(next.map((block) => block.node));
    for (const block of this.blocks) {
      if (!keep.has(block.node)) {
        block.node.parentNode?.removeChild(block.node);
      }
    }
    let cursor = this.container.firstChild;
    for (const block of next) {
      if (block.node === cursor) {
        cursor = cursor.nextSibling;
      } else {
        this.container.insertBefore(block.node, cursor);
      }
    }
    this.blocks = next;
  }

  /** Vide l'aperçu. */
  clear() {
    this.container.replaceChildren();
    this.blocks = [];
  }
}
