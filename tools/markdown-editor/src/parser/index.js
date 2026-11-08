/**
 * Point d'entrée du parseur Markdown : blocs, puis éléments en ligne, puis
 * conversion vers l'AST public décrit dans `parser/ast.js`.
 *
 * @module parser
 */

import { Node, toPlain } from './ast.js';
import { BlockParser } from './blocks.js';
import { InlineParser } from './inline.js';

/** Case à cocher GFM en tête du premier paragraphe d'un élément. */
const reTaskMarker = /^\[([ xX])\][ \t]+(?=\S)/;

/**
 * Détecte et retire le marqueur `[ ]` / `[x]` d'un élément de liste.
 * @param {Node} item
 */
function detectTask(item) {
  item.task = null;
  const first = item.firstChild;
  if (!first || first.type !== 'paragraph') {
    return;
  }
  const match = reTaskMarker.exec(first.stringContent);
  if (match) {
    item.task = match[1] !== ' ';
    first.stringContent = first.stringContent.slice(match[0].length);
    // Emplacement exact du caractère entre crochets (ligne, indice dans la ligne).
    item.taskLine = first.sourceLine ?? first.line;
    if (first.sourceOffset !== undefined) {
      item.taskOffset = first.sourceOffset + 1;
    }
  }
}

/**
 * Analyse les cellules d'un tableau.
 * @param {InlineParser} inline
 * @param {string[]} cells
 * @returns {import('./ast.js').MdNode[][]}
 */
function parseCells(inline, cells) {
  return cells.map((cell) => {
    const holder = new Node('cell');
    inline.parse(holder, cell);
    return holder.childList().map(toPlain);
  });
}

/**
 * Seconde passe sur un bloc et ses descendants.
 * @param {Node} block
 * @param {InlineParser} inline
 */
function processInlines(block, inline) {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      inline.parse(block, block.stringContent);
      return;
    case 'table':
      block.head = parseCells(inline, block.head);
      block.rows = block.rows.map((row) => parseCells(inline, row));
      return;
    case 'list':
      block.ordered = block.listData.type === 'ordered';
      block.start = block.listData.start ?? 1;
      break;
    case 'item':
      detectTask(block);
      break;
    default:
      break;
  }
  for (const child of block.childList()) {
    processInlines(child, inline);
  }
}

/**
 * Analyse un document Markdown.
 * @param {string} markdown
 * @returns {import('./ast.js').MdNode} Nœud `document`.
 */
export function parse(markdown) {
  const { doc, refmap } = new BlockParser().parse(String(markdown ?? ''));
  processInlines(doc, new InlineParser(refmap));
  return toPlain(doc);
}
