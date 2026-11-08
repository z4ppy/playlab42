/**
 * Ancres de titres et table des matières.
 *
 * Les ancres suivent la convention de GitHub : minuscules, ponctuation
 * retirée, espaces remplacées par des tirets, suffixe `-1`, `-2`… en cas de
 * doublon. Elles ne dépendent que du texte des titres et de leur ordre : un
 * lien `#mon-titre` reste valide tant que le titre ne change pas.
 *
 * @module toc
 */

import { inlineText } from './parser/ast.js';

/**
 * Ancre de base d'un texte (sans gestion des doublons).
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Générateur d'ancres uniques pour un document. */
export class Slugger {
  constructor() {
    /** @type {Map<string, number>} */
    this.seen = new Map();
  }

  /**
   * Ancre unique pour un texte.
   * @param {string} text
   * @returns {string}
   */
  slug(text) {
    const base = slugify(text) || 'section';
    let candidate = base;
    // Même algorithme que GitHub : « a », « a-1 », « a-2 »… sans collision
    // avec un titre dont le texte serait lui-même « a-1 ».
    while (this.seen.has(candidate)) {
      const count = this.seen.get(base) + 1;
      this.seen.set(base, count);
      candidate = `${base}-${count}`;
    }
    this.seen.set(candidate, 0);
    return candidate;
  }
}

/**
 * @typedef {object} TocEntry
 * @property {number} level - Niveau du titre (1 à 6).
 * @property {string} text - Texte brut du titre.
 * @property {string} id - Ancre (sans préfixe).
 * @property {number} line - Ligne source du titre.
 */

/**
 * Liste à plat des titres du document, dans l'ordre, avec leurs ancres.
 * Les titres imbriqués (citation, liste) sont inclus, comme sur GitHub.
 * @param {import('./parser/ast.js').MdNode} doc
 * @returns {TocEntry[]}
 */
export function buildToc(doc) {
  const slugger = new Slugger();
  /** @type {TocEntry[]} */
  const entries = [];
  const visit = (node) => {
    if (node.type === 'heading') {
      const text = inlineText(node.children).trim();
      entries.push({ level: node.level ?? 1, text, id: slugger.slug(text), line: node.line ?? 1 });
      return;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(doc);
  return entries;
}

/**
 * @typedef {TocEntry & { children: TocTree[] }} TocTree
 */

/**
 * Imbrique les entrées selon leur niveau (un saut de niveau reste toléré).
 * @param {TocEntry[]} entries
 * @returns {TocTree[]}
 */
export function nestToc(entries) {
  /** @type {TocTree[]} */
  const roots = [];
  /** @type {TocTree[]} */
  const stack = [];
  for (const entry of entries) {
    const node = { ...entry, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
      stack.pop();
    }
    (stack.length > 0 ? stack[stack.length - 1].children : roots).push(node);
    stack.push(node);
  }
  return roots;
}
