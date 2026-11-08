/**
 * Rendu de l'AST Markdown.
 *
 * Le rendu passe par un arbre d'éléments intermédiaire (`HNode`) au lieu de
 * concaténer du HTML : chaque texte y est une feuille `{ text }`, échappée au
 * moment de la sérialisation (`toHtml`) ou posée avec `textContent` par
 * l'aperçu (`ui/dom-render.js`). Les seules balises et attributs produits sont
 * ceux de ce module ; aucun HTML provenant du document n'est jamais
 * interprété, et chaque URL passe par `sanitize-url.js`.
 *
 * @module render-html
 */

import { inlineText } from './parser/ast.js';
import { parse } from './parser/index.js';
import { sanitizeUrl } from './sanitize-url.js';
import { highlight } from './highlight.js';
import { Slugger } from './toc.js';

/**
 * @typedef {object} HElement
 * @property {string} tag
 * @property {Record<string, string>} attrs
 * @property {HNode[]} children
 * @property {boolean} [block] - Saut de ligne après la balise fermante.
 * @property {boolean} [container] - Saut de ligne après la balise ouvrante.
 * @property {boolean} [trail] - Saut de ligne après l'élément seulement (<br>).
 */
/** @typedef {HElement | { text: string }} HNode */

/**
 * @typedef {object} RenderOptions
 * @property {boolean} [sourceLines=false] - Ajoute `data-line` aux blocs.
 * @property {boolean} [headingIds=true] - Ajoute une ancre `id` aux titres.
 * @property {string} [idPrefix=''] - Préfixe des ancres (évite les collisions avec la page).
 * @property {boolean} [interactiveTasks=false] - Cases à cocher actives (aperçu).
 * @property {boolean} [tableWrapper=true] - Enveloppe défilante autour des tableaux.
 * @property {boolean} [highlightCode=true] - Coloration syntaxique.
 */

/** Attributs de position source, omis des clés de comparaison de blocs. */
const LINE_ATTRIBUTES = new Set(['data-line', 'data-task-line']);

/** Balises vides (sans contenu ni balise fermante). */
export const VOID_TAGS = new Set(['br', 'hr', 'img', 'input']);

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {HNode[]} [children]
 * @param {{ block?: boolean, container?: boolean, trail?: boolean }} [layout]
 * @returns {HElement}
 */
function h(tag, attrs = {}, children = [], layout = {}) {
  return { tag, attrs, children, ...layout };
}

/** Longueur maximale du nom accessible d'une case à cocher. */
const TASK_LABEL_MAX = 120;

/**
 * Texte brut d'une tâche (premier paragraphe), pour nommer sa case.
 * @param {import('./parser/ast.js').MdNode} item
 * @returns {string}
 */
export function taskLabel(item) {
  const first = item.children?.[0];
  const text = first?.type === 'paragraph' ? inlineText(first.children).replace(/\s+/g, ' ').trim() : '';
  if (text === '') {
    return 'Tâche sans texte';
  }
  return text.length > TASK_LABEL_MAX ? `${text.slice(0, TASK_LABEL_MAX - 1)}…` : text;
}

/** @type {Record<string, string>} */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * Échappe un texte pour le HTML (contenu et valeurs d'attributs entre guillemets).
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);
}

/** Rendu d'un document : état partagé (options, ancres). */
class TreeRenderer {
  /** @param {RenderOptions} options */
  constructor(options) {
    this.options = {
      sourceLines: false, headingIds: true, idPrefix: '', interactiveTasks: false,
      tableWrapper: true, highlightCode: true, ...options,
    };
    this.slugger = new Slugger();
  }

  /**
   * Attributs communs d'un bloc (ligne source).
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {Record<string, string>}
   */
  lineAttrs(node) {
    return this.options.sourceLines && node.line ? { 'data-line': String(node.line) } : {};
  }

  /**
   * @param {import('./parser/ast.js').MdNode[]} blocks
   * @param {boolean} [tight]
   * @returns {HNode[]}
   */
  blocks(blocks, tight = false) {
    return blocks.flatMap((block) => this.block(block, tight));
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @param {boolean} tight - Paragraphe d'une liste serrée : pas de <p>.
   * @returns {HNode[]}
   */
  block(node, tight) {
    switch (node.type) {
      case 'paragraph':
        return tight ? this.inlines(node.children) : [h('p', this.lineAttrs(node), this.inlines(node.children), { block: true })];
      case 'heading':
        return [this.heading(node)];
      case 'blockquote':
        return [h('blockquote', this.lineAttrs(node), this.blocks(node.children), { block: true, container: true })];
      case 'list':
        return [this.list(node)];
      case 'code_block':
        return [this.codeBlock(node)];
      case 'thematic_break':
        return [h('hr', this.lineAttrs(node), [], { block: true })];
      case 'table':
        return [this.table(node)];
      default:
        return [];
    }
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  heading(node) {
    const attrs = this.lineAttrs(node);
    if (this.options.headingIds) {
      attrs.id = this.options.idPrefix + this.slugger.slug(inlineText(node.children).trim());
    }
    return h(`h${node.level}`, attrs, this.inlines(node.children), { block: true });
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  list(node) {
    const attrs = this.lineAttrs(node);
    if (node.ordered && node.start !== 1) {
      attrs.start = String(node.start);
    }
    if (node.children.some((item) => item.task !== null)) {
      attrs.class = 'contains-task-list';
    }
    const items = node.children.map((item) => this.item(item, node.tight));
    return h(node.ordered ? 'ol' : 'ul', attrs, items, { block: true, container: true });
  }

  /**
   * @param {import('./parser/ast.js').MdNode} item
   * @param {boolean} tight
   * @returns {HElement}
   */
  item(item, tight) {
    const attrs = this.lineAttrs(item);
    const children = this.blocks(item.children, tight);
    if (item.task !== null && item.task !== undefined) {
      attrs.class = 'task-list-item';
      const checkbox = this.checkbox(item);
      const first = children[0];
      // Case placée dans le premier paragraphe (liste lâche) ou en tête.
      const target = first && 'tag' in first && first.tag === 'p' ? first.children : children;
      target.unshift(checkbox, { text: ' ' });
    }
    return h('li', attrs, children, { block: true });
  }

  /**
   * @param {import('./parser/ast.js').MdNode} item
   * @returns {HElement}
   */
  checkbox(item) {
    const attrs = { type: 'checkbox', class: 'task-list-item-checkbox' };
    if (item.task) {
      attrs.checked = '';
    }
    if (this.options.interactiveTasks) {
      attrs['data-task-line'] = String(item.taskLine ?? item.line);
      if (item.taskOffset !== undefined) {
        attrs['data-task-offset'] = String(item.taskOffset);
      }
      // Nom accessible : le texte de la tâche (l'état est déjà exposé par
      // `checked`) ; sans lui, un lecteur d'écran annonce des cases identiques.
      attrs['aria-label'] = taskLabel(item);
    } else {
      attrs.disabled = '';
    }
    return h('input', attrs);
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  codeBlock(node) {
    const language = (node.info ?? '').split(/\s+/)[0];
    const tokens = this.options.highlightCode && language ? highlight(node.literal, language) : null;
    const children = tokens
      ? tokens.map((token) => (token.type ? h('span', { class: `tok-${token.type}` }, [{ text: token.text }]) : { text: token.text }))
      : [{ text: node.literal }];
    const codeAttrs = language ? { class: `language-${language}` } : {};
    return h('pre', this.lineAttrs(node), [h('code', codeAttrs, children)], { block: true });
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  table(node) {
    const cell = (tag, content, index) => {
      const align = node.aligns[index];
      return h(tag, align ? { align } : {}, this.inlines(content), { block: true });
    };
    const row = (tag, cells) => h('tr', {}, cells.map((content, index) => cell(tag, content, index)), { block: true, container: true });
    const sections = [h('thead', {}, [row('th', node.head)], { block: true, container: true })];
    if (node.rows.length > 0) {
      sections.push(h('tbody', {}, node.rows.map((cells) => row('td', cells)), { block: true, container: true }));
    }
    const table = h('table', this.options.tableWrapper ? {} : this.lineAttrs(node), sections, { block: true, container: true });
    return this.options.tableWrapper
      ? h('div', { class: 'md-table', ...this.lineAttrs(node) }, [table], { block: true, container: true })
      : table;
  }

  /**
   * @param {import('./parser/ast.js').MdNode[]|undefined} nodes
   * @returns {HNode[]}
   */
  inlines(nodes) {
    return (nodes ?? []).map((node) => this.inline(node));
  }

  /**
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HNode}
   */
  inline(node) {
    switch (node.type) {
      case 'text':
        return { text: node.literal };
      case 'softbreak':
        return { text: '\n' };
      case 'linebreak':
        return h('br', {}, [], { trail: true });
      case 'code':
        return h('code', {}, [{ text: node.literal }]);
      case 'emph':
        return h('em', {}, this.inlines(node.children));
      case 'strong':
        return h('strong', {}, this.inlines(node.children));
      case 'del':
        return h('del', {}, this.inlines(node.children));
      case 'link':
        return this.link(node);
      default:
        return this.image(node);
    }
  }

  /**
   * Lien ; une URL refusée donne un simple texte signalé.
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  link(node) {
    const href = sanitizeUrl(node.destination ?? '');
    const children = this.inlines(node.children);
    if (href === null) {
      return h('span', { class: 'md-blocked', title: 'Lien bloqué : adresse non autorisée' }, children);
    }
    const attrs = { href };
    if (node.title) {
      attrs.title = node.title;
    }
    return h('a', attrs, children);
  }

  /**
   * Image ; une URL refusée donne son texte alternatif.
   * @param {import('./parser/ast.js').MdNode} node
   * @returns {HElement}
   */
  image(node) {
    const alt = inlineText(node.children);
    const src = sanitizeUrl(node.destination ?? '', { image: true });
    if (src === null) {
      return h('span', { class: 'md-blocked', title: 'Image bloquée : adresse non autorisée' }, [{ text: alt }]);
    }
    const attrs = { src, alt };
    if (node.title) {
      attrs.title = node.title;
    }
    return h('img', attrs);
  }
}

/**
 * Arbre d'éléments d'un document.
 * @param {import('./parser/ast.js').MdNode} doc
 * @param {RenderOptions} [options]
 * @returns {HNode[]}
 */
export function renderTree(doc, options = {}) {
  return new TreeRenderer(options).blocks(doc.children ?? []);
}

/**
 * @param {HElement} node
 * @param {{ skipLines?: boolean }} options
 * @returns {string}
 */
function serializeAttrs(node, options) {
  let result = '';
  for (const [name, value] of Object.entries(node.attrs)) {
    if (!(options.skipLines && LINE_ATTRIBUTES.has(name))) {
      result += ` ${name}="${escapeHtml(value)}"`;
    }
  }
  return result;
}

/**
 * Sérialise un arbre d'éléments ; tout texte est échappé.
 * @param {HNode[]} nodes
 * @param {{ skipLines?: boolean }} [options] - `skipLines` omet `data-line`
 *   et `data-task-line`
 *   (clé de comparaison de blocs indépendante de leur position).
 * @returns {string}
 */
export function toHtml(nodes, options = {}) {
  const out = [];
  const newline = () => {
    if (out.length > 0 && !out[out.length - 1].endsWith('\n')) {
      out.push('\n');
    }
  };
  const write = (node) => {
    if ('text' in node) {
      out.push(escapeHtml(node.text));
      return;
    }
    if (node.block) {
      newline();
    }
    const attrs = serializeAttrs(node, options);
    if (VOID_TAGS.has(node.tag)) {
      out.push(`<${node.tag}${attrs} />`);
    } else {
      out.push(`<${node.tag}${attrs}>`);
      if (node.container) {
        out.push('\n');
      }
      node.children.forEach(write);
      out.push(`</${node.tag}>`);
    }
    if (node.block || node.trail) {
      out.push('\n');
    }
  };
  nodes.forEach(write);
  return out.join('');
}

/**
 * Markdown (ou AST) → HTML sûr.
 * @param {string|import('./parser/ast.js').MdNode} source
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderHtml(source, options = {}) {
  const doc = typeof source === 'string' ? parse(source) : source;
  return toHtml(renderTree(doc, options));
}
