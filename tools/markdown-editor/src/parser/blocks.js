/**
 * Première passe : structure de blocs (CommonMark + tableaux GFM).
 *
 * Le document est lu ligne par ligne. Pour chaque ligne :
 *  1. on parcourt les blocs ouverts du plus externe au plus interne et on
 *     vérifie que la ligne les « continue » (marqueur `>`, indentation…) ;
 *  2. on cherche de nouveaux débuts de blocs (titre, liste, clôture…) ;
 *  3. le reste de la ligne est ajouté au bloc feuille courant, ou poursuit
 *     paresseusement un paragraphe (continuation « lazy »).
 * Le contenu textuel est conservé brut ; les éléments en ligne sont analysés
 * ensuite par `parser/index.js`.
 *
 * @module parser/blocks
 */

import { Node } from './ast.js';
import { isSpaceOrTab, unescapeString } from './common.js';
import { InlineParser } from './inline.js';
import { parseDelimiterRow, splitTableRow } from './table.js';

const CODE_INDENT = 4;
/**
 * Profondeur maximale de conteneurs imbriqués (citations, listes). Au-delà,
 * les marqueurs restent du texte : protège la pile d'appels et garde un coût
 * linéaire face à une entrée pathologique (5 000 « > » d'affilée).
 */
export const MAX_NESTING = 64;
const reMaybeSpecial = /^[#`~*+_=<>0-9|:-]/;
const reATXHeadingMarker = /^#{1,6}(?:[ \t]+|$)/;
const reCodeFence = /^`{3,}(?!.*`)|^~{3,}/;
const reClosingCodeFence = /^(?:`{3,}|~{3,})(?=[ \t]*$)/;
const reSetextHeadingLine = /^(?:=+|-+)[ \t]*$/;
const reThematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;
const reBulletListMarker = /^[*+-]/;
const reOrderedListMarker = /^(\d{1,9})([.)])/;
const reLineEnding = /\r\n|\n|\r/;

/** Résultats d'une tentative de continuation. */
const MATCHED = 0;
const NOT_MATCHED = 1;
const LINE_CONSUMED = 2;

/** Résultats d'une tentative de début de bloc. */
const NO_START = 0;
const CONTAINER_START = 1;
const LEAF_START = 2;

/**
 * @typedef {object} ListData
 * @property {'bullet'|'ordered'} type
 * @property {string} [bulletChar]
 * @property {number} [start]
 * @property {string} [delimiter]
 * @property {number} markerOffset
 * @property {number} padding
 */

/**
 * Comportement d'un type de bloc.
 * @typedef {object} BlockSpec
 * @property {(parser: BlockParser, block: Node) => number} continue
 * @property {(parser: BlockParser, block: Node) => void} finalize
 * @property {(type: string) => boolean} canContain
 * @property {boolean} acceptsLines - Le bloc reçoit des lignes de texte.
 */

const notContainer = () => false;
const noFinalize = () => {};
const containsBlocks = (type) => type !== 'item';

/**
 * Une liste se termine-t-elle par une ligne vide avant le bloc suivant ?
 * @param {Node} block
 * @returns {boolean}
 */
function endsWithBlankLine(block) {
  return block.next !== null && block.endLine !== block.next.line - 1;
}

/** @type {Record<string, BlockSpec>} */
const BLOCKS = {
  document: { continue: () => MATCHED, finalize: noFinalize, canContain: containsBlocks, acceptsLines: false },
  list: { continue: () => MATCHED, finalize: finalizeList, canContain: (type) => type === 'item', acceptsLines: false },
  blockquote: { continue: continueBlockquote, finalize: noFinalize, canContain: containsBlocks, acceptsLines: false },
  item: { continue: continueItem, finalize: finalizeItem, canContain: containsBlocks, acceptsLines: false },
  heading: { continue: () => NOT_MATCHED, finalize: noFinalize, canContain: notContainer, acceptsLines: false },
  thematic_break: { continue: () => NOT_MATCHED, finalize: noFinalize, canContain: notContainer, acceptsLines: false },
  code_block: { continue: continueCode, finalize: finalizeCode, canContain: notContainer, acceptsLines: true },
  paragraph: { continue: continueUnlessBlank, finalize: finalizeParagraph, canContain: notContainer, acceptsLines: true },
  table: { continue: continueUnlessBlank, finalize: finalizeTable, canContain: notContainer, acceptsLines: true },
};

/**
 * @param {BlockParser} parser
 * @returns {number}
 */
function continueUnlessBlank(parser) {
  return parser.blank ? NOT_MATCHED : MATCHED;
}

/**
 * Une citation continue si la ligne commence par `>` (indentation < 4).
 * @param {BlockParser} parser
 * @returns {number}
 */
function continueBlockquote(parser) {
  if (parser.indented || parser.currentLine.charAt(parser.nextNonspace) !== '>') {
    return NOT_MATCHED;
  }
  parser.advanceNextNonspace();
  parser.advanceOffset(1, false);
  if (isSpaceOrTab(parser.currentLine.charAt(parser.offset))) {
    parser.advanceOffset(1, true);
  }
  return MATCHED;
}

/**
 * Un élément de liste continue si la ligne est indentée au-delà du marqueur
 * (ou vide, sauf si l'élément est encore vide : une seule ligne vide suffit
 * alors à le fermer).
 * @param {BlockParser} parser
 * @param {Node} item
 * @returns {number}
 */
function continueItem(parser, item) {
  const { markerOffset, padding } = item.listData;
  if (parser.blank) {
    if (item.firstChild === null) {
      return NOT_MATCHED;
    }
    parser.advanceNextNonspace();
  } else if (parser.indent >= markerOffset + padding) {
    parser.advanceOffset(markerOffset + padding, true);
  } else {
    return NOT_MATCHED;
  }
  return MATCHED;
}

/**
 * Bloc de code clôturé (jusqu'à la clôture) ou indenté (4 espaces).
 * @param {BlockParser} parser
 * @param {Node} block
 * @returns {number}
 */
function continueCode(parser, block) {
  if (block.isFenced) {
    return continueFencedCode(parser, block);
  }
  if (parser.indent >= CODE_INDENT) {
    parser.advanceOffset(CODE_INDENT, true);
  } else if (parser.blank) {
    parser.advanceNextNonspace();
  } else {
    return NOT_MATCHED;
  }
  return MATCHED;
}

/**
 * @param {BlockParser} parser
 * @param {Node} block
 * @returns {number}
 */
function continueFencedCode(parser, block) {
  const line = parser.currentLine;
  const fence = parser.indent <= 3 && line.charAt(parser.nextNonspace) === block.fenceChar
    ? reClosingCodeFence.exec(line.slice(parser.nextNonspace)) : null;
  if (fence && fence[0].length >= block.fenceLength) {
    parser.finalize(block, parser.lineNumber);
    return LINE_CONSUMED;
  }
  // Retire au plus l'indentation de la clôture ouvrante.
  for (let i = block.fenceOffset; i > 0 && isSpaceOrTab(line.charAt(parser.offset)); i--) {
    parser.advanceOffset(1, true);
  }
  return MATCHED;
}

/**
 * Sépare la chaîne d'information du contenu d'un bloc de code.
 * @param {BlockParser} _parser
 * @param {Node} block
 */
function finalizeCode(_parser, block) {
  if (block.isFenced) {
    const content = block.stringContent;
    const newline = content.indexOf('\n');
    block.info = unescapeString(content.slice(0, newline).trim());
    block.literal = content.slice(newline + 1);
  } else {
    block.info = '';
    block.literal = block.stringContent.replace(/(\n[ \t]*)+$/, '\n');
  }
}

/**
 * Extrait les définitions de liens en tête de paragraphe ; un paragraphe
 * qui ne contenait que des définitions disparaît.
 * @param {BlockParser} parser
 * @param {Node} block
 */
function finalizeParagraph(parser, block) {
  const content = parser.extractReferences(block.stringContent);
  if (content !== block.stringContent) {
    // Des définitions de liens ont été retirées en tête : le texte restant
    // commence plus bas, à une colonne inconnue (préfixes des conteneurs).
    const removed = block.stringContent.slice(0, block.stringContent.length - content.length);
    block.sourceLine = block.line + (removed.match(/\n/g)?.length ?? 0);
    block.sourceOffset = undefined;
  }
  block.stringContent = content;
  if (block.stringContent.trim() === '') {
    block.unlink();
  }
}

/**
 * Découpe les lignes accumulées d'un tableau en cellules.
 * @param {BlockParser} _parser
 * @param {Node} block
 */
function finalizeTable(_parser, block) {
  const lines = block.stringContent.split('\n').filter((line) => line.trim() !== '');
  block.rows = lines.map((line) => fitCells(splitTableRow(line), block.aligns.length));
}

/**
 * Ajuste le nombre de cellules d'une ligne à celui de l'en-tête (GFM).
 * @param {string[]} cells
 * @param {number} size
 * @returns {string[]}
 */
function fitCells(cells, size) {
  const fitted = cells.slice(0, size);
  while (fitted.length < size) {
    fitted.push('');
  }
  return fitted;
}

/**
 * Fin d'un élément : il s'achève avec son dernier enfant.
 * @param {BlockParser} _parser
 * @param {Node} item
 */
function finalizeItem(_parser, item) {
  item.endLine = item.lastChild ? item.lastChild.endLine : item.line;
}

/**
 * Une liste est « lâche » si une ligne vide sépare deux éléments ou deux
 * blocs directs d'un même élément.
 * @param {BlockParser} _parser
 * @param {Node} list
 */
function finalizeList(_parser, list) {
  list.tight = !list.childList().some((item) => (
    endsWithBlankLine(item) || item.childList().some(endsWithBlankLine)
  ));
  list.endLine = list.lastChild ? list.lastChild.endLine : list.line;
}

/**
 * Compatibilité de deux marqueurs (même type de puce ou de délimiteur).
 * @param {ListData} a
 * @param {ListData} b
 * @returns {boolean}
 */
function listsMatch(a, b) {
  return a.type === b.type && a.delimiter === b.delimiter && a.bulletChar === b.bulletChar;
}

/**
 * Lit un marqueur de liste et calcule la largeur de contenu (« padding »).
 * @param {BlockParser} parser
 * @param {Node} container
 * @returns {ListData|null}
 */
function parseListMarker(parser, container) {
  if (parser.indent >= CODE_INDENT) {
    return null;
  }
  const rest = parser.currentLine.slice(parser.nextNonspace);
  const data = readMarker(rest, container);
  if (!data) {
    return null;
  }
  const markerLength = data.markerLength;
  const after = rest.charAt(markerLength);
  if (after !== '' && !isSpaceOrTab(after)) {
    return null;
  }
  // Un élément vide ne peut pas interrompre un paragraphe.
  if (container.type === 'paragraph' && rest.slice(markerLength).trim() === '') {
    return null;
  }
  const listData = { ...data, markerOffset: parser.indent, padding: 0 };
  parser.advanceNextNonspace();
  parser.advanceOffset(markerLength, true);
  listData.padding = markerLength + measureSpacesAfterMarker(parser);
  delete listData.markerLength;
  return listData;
}

/**
 * @param {string} rest - Ligne à partir du premier caractère non blanc.
 * @param {Node} container
 * @returns {(Omit<ListData, 'markerOffset'|'padding'> & { markerLength: number })|null}
 */
function readMarker(rest, container) {
  const bullet = reBulletListMarker.exec(rest);
  if (bullet) {
    return { type: 'bullet', bulletChar: bullet[0], markerLength: 1 };
  }
  const ordered = reOrderedListMarker.exec(rest);
  // Seule une liste commençant à 1 peut interrompre un paragraphe.
  if (ordered && (container.type !== 'paragraph' || ordered[1] === '1')) {
    return { type: 'ordered', start: Number.parseInt(ordered[1], 10), delimiter: ordered[2], markerLength: ordered[0].length };
  }
  return null;
}

/**
 * Consomme les espaces après le marqueur : de 1 à 4 ; au-delà (code indenté
 * dans l'élément) ou pour un élément vide, un seul espace compte.
 * @param {BlockParser} parser
 * @returns {number} Espaces comptés dans la largeur du contenu.
 */
function measureSpacesAfterMarker(parser) {
  const startColumn = parser.column;
  const startOffset = parser.offset;
  while (parser.column - startColumn < 5 && isSpaceOrTab(parser.currentLine.charAt(parser.offset))) {
    parser.advanceOffset(1, true);
  }
  const spaces = parser.column - startColumn;
  const blankItem = parser.offset >= parser.currentLine.length;
  if (spaces >= 5 || spaces < 1 || blankItem) {
    parser.column = startColumn;
    parser.offset = startOffset;
    parser.partiallyConsumedTab = false;
    if (isSpaceOrTab(parser.currentLine.charAt(parser.offset))) {
      parser.advanceOffset(1, true);
    }
    return 1;
  }
  return spaces;
}

/** Débuts de blocs, testés dans l'ordre de priorité de la spécification. */
const BLOCK_STARTS = [
  function blockquoteStart(parser) {
    if (parser.indented || parser.tooDeep() || parser.currentLine.charAt(parser.nextNonspace) !== '>') {
      return NO_START;
    }
    parser.advanceNextNonspace();
    parser.advanceOffset(1, false);
    if (isSpaceOrTab(parser.currentLine.charAt(parser.offset))) {
      parser.advanceOffset(1, true);
    }
    parser.closeUnmatchedBlocks();
    parser.addChild('blockquote');
    return CONTAINER_START;
  },

  function atxHeadingStart(parser) {
    const match = parser.indented ? null : reATXHeadingMarker.exec(parser.currentLine.slice(parser.nextNonspace));
    if (!match) {
      return NO_START;
    }
    parser.advanceNextNonspace();
    parser.advanceOffset(match[0].length, false);
    parser.closeUnmatchedBlocks();
    const heading = parser.addChild('heading');
    heading.level = match[0].trim().length;
    // Retire la séquence fermante facultative « ### ».
    heading.stringContent = parser.currentLine.slice(parser.offset)
      .replace(/^[ \t]*#+[ \t]*$/, '').replace(/[ \t]+#+[ \t]*$/, '');
    parser.advanceOffset(parser.currentLine.length - parser.offset, false);
    return LEAF_START;
  },

  function fencedCodeStart(parser) {
    const match = parser.indented ? null : reCodeFence.exec(parser.currentLine.slice(parser.nextNonspace));
    if (!match) {
      return NO_START;
    }
    parser.closeUnmatchedBlocks();
    const block = parser.addChild('code_block');
    Object.assign(block, { isFenced: true, fenceLength: match[0].length, fenceChar: match[0][0], fenceOffset: parser.indent });
    parser.advanceNextNonspace();
    parser.advanceOffset(match[0].length, false);
    return LEAF_START;
  },

  function tableStart(parser, container) {
    if (parser.indented || container.type !== 'paragraph') {
      return NO_START;
    }
    const aligns = parseDelimiterRow(parser.currentLine.slice(parser.nextNonspace));
    if (!aligns) {
      return NO_START;
    }
    const lines = container.stringContent.replace(/\n$/, '').split('\n');
    const header = splitTableRow(lines[lines.length - 1]);
    if (header.length !== aligns.length) {
      return NO_START;
    }
    parser.closeUnmatchedBlocks();
    parser.startTable(container, lines, { aligns, head: header });
    return LEAF_START;
  },

  function setextHeadingStart(parser, container) {
    const match = parser.indented || container.type !== 'paragraph'
      ? null : reSetextHeadingLine.exec(parser.currentLine.slice(parser.nextNonspace));
    if (!match) {
      return NO_START;
    }
    parser.closeUnmatchedBlocks();
    const content = parser.extractReferences(container.stringContent);
    container.stringContent = content;
    if (content.trim() === '') {
      return NO_START;
    }
    const heading = new Node('heading', { level: match[0][0] === '=' ? 1 : 2, stringContent: content, line: container.line, open: true });
    container.insertAfter(heading);
    container.unlink();
    parser.tip = heading;
    parser.advanceOffset(parser.currentLine.length - parser.offset, false);
    return LEAF_START;
  },

  function thematicBreakStart(parser) {
    if (parser.indented || !reThematicBreak.test(parser.currentLine.slice(parser.nextNonspace))) {
      return NO_START;
    }
    parser.closeUnmatchedBlocks();
    parser.addChild('thematic_break');
    parser.advanceOffset(parser.currentLine.length - parser.offset, false);
    return LEAF_START;
  },

  function listItemStart(parser, container) {
    const data = parser.tooDeep() ? null : parseListMarker(parser, container);
    if (!data) {
      return NO_START;
    }
    parser.closeUnmatchedBlocks();
    if (parser.tip.type !== 'list' || !listsMatch(container.listData, data)) {
      const list = parser.addChild('list');
      list.listData = data;
    }
    const item = parser.addChild('item');
    item.listData = data;
    return CONTAINER_START;
  },

  function indentedCodeStart(parser) {
    if (!parser.indented || parser.tip.type === 'paragraph' || parser.blank) {
      return NO_START;
    }
    parser.advanceOffset(CODE_INDENT, true);
    parser.closeUnmatchedBlocks();
    parser.addChild('code_block');
    return LEAF_START;
  },
];

/** Analyseur de blocs : produit l'arbre chaîné et les définitions de liens. */
export class BlockParser {
  constructor() {
    this.doc = new Node('document', { line: 1, open: true });
    /** @type {Node} */ this.tip = this.doc;
    /** @type {Node} */ this.oldtip = this.doc;
    /** @type {Node} */ this.lastMatchedContainer = this.doc;
    /** @type {Map<string, import('./inline.js').LinkReference>} */
    this.refmap = new Map();
    this.referenceParser = new InlineParser(this.refmap);
    this.currentLine = '';
    this.lineNumber = 0;
    this.offset = 0;
    this.column = 0;
    this.nextNonspace = 0;
    this.nextNonspaceColumn = 0;
    this.indent = 0;
    this.indented = false;
    this.blank = false;
    this.partiallyConsumedTab = false;
    this.allClosed = true;
  }

  /**
   * Analyse un document complet.
   * @param {string} input
   * @returns {{ doc: Node, refmap: Map<string, import('./inline.js').LinkReference> }}
   */
  parse(input) {
    const lines = input.split(reLineEnding);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    for (const line of lines) {
      this.incorporateLine(line);
    }
    while (this.tip) {
      this.finalize(this.tip, lines.length);
    }
    return { doc: this.doc, refmap: this.refmap };
  }

  /** Calcule la position du prochain caractère non blanc (tabulations = 4). */
  findNextNonspace() {
    const line = this.currentLine;
    let i = this.offset;
    let cols = this.column;
    while (isSpaceOrTab(line.charAt(i))) {
      cols += line[i] === ' ' ? 1 : 4 - (cols % 4);
      i += 1;
    }
    this.blank = i >= line.length;
    this.nextNonspace = i;
    this.nextNonspaceColumn = cols;
    this.indent = cols - this.column;
    this.indented = this.indent >= CODE_INDENT;
  }

  advanceNextNonspace() {
    this.offset = this.nextNonspace;
    this.column = this.nextNonspaceColumn;
    this.partiallyConsumedTab = false;
  }

  /**
   * Avance de `count` caractères, ou de `count` colonnes si `columns` (une
   * tabulation peut alors n'être que partiellement consommée).
   * @param {number} count
   * @param {boolean} columns
   */
  advanceOffset(count, columns) {
    let remaining = count;
    while (remaining > 0 && this.offset < this.currentLine.length) {
      if (this.currentLine[this.offset] === '\t') {
        remaining -= this.advanceTab(remaining, columns);
      } else {
        this.partiallyConsumedTab = false;
        this.offset += 1;
        this.column += 1;
        remaining -= 1;
      }
    }
  }

  /**
   * @param {number} remaining
   * @param {boolean} columns
   * @returns {number} Unités consommées.
   */
  advanceTab(remaining, columns) {
    const toTab = 4 - (this.column % 4);
    if (!columns) {
      this.partiallyConsumedTab = false;
      this.column += toTab;
      this.offset += 1;
      return 1;
    }
    this.partiallyConsumedTab = toTab > remaining;
    const advance = Math.min(toTab, remaining);
    this.column += advance;
    this.offset += this.partiallyConsumedTab ? 0 : 1;
    return advance;
  }

  /**
   * Ajoute la fin de la ligne courante au bloc feuille ouvert.
   */
  addLine() {
    if (this.partiallyConsumedTab) {
      // Une tabulation à moitié consommée laisse des espaces de contenu.
      this.offset += 1;
      this.tip.stringContent += ' '.repeat(4 - (this.column % 4));
    }
    if (this.tip.type === 'paragraph' && this.tip.stringContent === '') {
      // Position du premier caractère du paragraphe dans sa ligne source :
      // l'aperçu s'en sert pour cocher une tâche sans deviner les marqueurs.
      this.tip.sourceOffset = this.offset;
    }
    this.tip.stringContent += `${this.currentLine.slice(this.offset)}\n`;
  }

  /**
   * Crée un bloc enfant, en fermant les blocs qui ne peuvent pas le contenir.
   * @param {string} type
   * @returns {Node}
   */
  addChild(type) {
    while (!BLOCKS[this.tip.type].canContain(type)) {
      this.finalize(this.tip, this.lineNumber - 1);
    }
    const node = new Node(type, { line: this.lineNumber, open: true, stringContent: '', depth: (this.tip.depth ?? 0) + 1 });
    this.tip.appendChild(node);
    this.tip = node;
    return node;
  }

  /** @returns {boolean} La limite d'imbrication est atteinte au point courant. */
  tooDeep() {
    return (this.tip.depth ?? 0) >= MAX_NESTING;
  }

  /** Ferme les blocs ouverts que la ligne courante n'a pas continués. */
  closeUnmatchedBlocks() {
    if (this.allClosed) {
      return;
    }
    while (this.oldtip !== this.lastMatchedContainer) {
      const parent = this.oldtip.parent;
      this.finalize(this.oldtip, this.lineNumber - 1);
      this.oldtip = parent;
    }
    this.allClosed = true;
  }

  /**
   * Ferme un bloc et rend la main à son parent.
   * @param {Node} block
   * @param {number} lineNumber - Dernière ligne du bloc.
   */
  finalize(block, lineNumber) {
    const parent = block.parent;
    block.open = false;
    block.endLine = Math.max(block.line, lineNumber);
    BLOCKS[block.type].finalize(this, block);
    this.tip = parent;
  }

  /**
   * Retire les définitions de liens en tête d'un texte et les enregistre.
   * @param {string} content
   * @returns {string} Texte restant.
   */
  extractReferences(content) {
    let rest = content;
    while (rest.startsWith('[')) {
      const consumed = this.referenceParser.parseReference(rest);
      if (consumed === 0) {
        break;
      }
      rest = rest.slice(consumed);
    }
    return rest;
  }

  /**
   * Transforme la dernière ligne d'un paragraphe en en-tête de tableau.
   * @param {Node} paragraph
   * @param {string[]} lines - Lignes du paragraphe.
   * @param {{ aligns: Array<'left'|'center'|'right'|null>, head: string[] }} table
   */
  startTable(paragraph, lines, table) {
    const node = new Node('table', { line: this.lineNumber - 1, open: true, stringContent: '', ...table });
    paragraph.insertAfter(node);
    if (lines.length > 1) {
      paragraph.stringContent = `${lines.slice(0, -1).join('\n')}\n`;
      this.finalize(paragraph, this.lineNumber - 2);
    } else {
      paragraph.unlink();
    }
    this.tip = node;
    this.advanceOffset(this.currentLine.length - this.offset, false);
  }

  /**
   * Intègre une ligne au document.
   * @param {string} rawLine
   */
  incorporateLine(rawLine) {
    this.lineNumber += 1;
    this.currentLine = rawLine.includes('\0') ? rawLine.replace(/\0/g, '�') : rawLine;
    this.offset = 0;
    this.column = 0;
    this.blank = false;
    this.partiallyConsumedTab = false;
    this.oldtip = this.tip;
    const container = this.matchOpenBlocks();
    if (container === null) {
      return;
    }
    this.allClosed = container === this.oldtip;
    this.lastMatchedContainer = container;
    this.addText(this.openNewBlocks(container));
  }

  /**
   * Étape 1 : descend dans les blocs ouverts tant que la ligne les continue.
   * @returns {Node|null} Dernier bloc continué, ou null si la ligne est consommée.
   */
  matchOpenBlocks() {
    let container = this.doc;
    while (container.lastChild && container.lastChild.open) {
      const child = container.lastChild;
      this.findNextNonspace();
      const result = BLOCKS[child.type].continue(this, child);
      if (result === LINE_CONSUMED) {
        return null;
      }
      if (result === NOT_MATCHED) {
        break;
      }
      container = child;
    }
    return container;
  }

  /**
   * Étape 2 : ouvre les nouveaux blocs annoncés par la ligne.
   * @param {Node} matched
   * @returns {Node} Bloc qui recevra le texte.
   */
  openNewBlocks(matched) {
    let container = matched;
    let matchedLeaf = BLOCKS[container.type].acceptsLines && container.type !== 'paragraph' && container.type !== 'table';
    while (!matchedLeaf) {
      this.findNextNonspace();
      if (!this.indented && !reMaybeSpecial.test(this.currentLine.slice(this.nextNonspace))) {
        this.advanceNextNonspace();
        break;
      }
      const result = this.tryBlockStarts(container);
      if (result === NO_START) {
        this.advanceNextNonspace();
        break;
      }
      container = this.tip;
      matchedLeaf = result === LEAF_START;
    }
    return container;
  }

  /**
   * @param {Node} container
   * @returns {number}
   */
  tryBlockStarts(container) {
    for (const start of BLOCK_STARTS) {
      const result = start(this, container);
      if (result !== NO_START) {
        return result;
      }
    }
    return NO_START;
  }

  /**
   * Étape 3 : ajoute le texte restant (paragraphe paresseux, feuille ou
   * nouveau paragraphe).
   * @param {Node} container
   */
  addText(container) {
    if (!this.allClosed && !this.blank && this.tip.type === 'paragraph') {
      this.addLine();
      return;
    }
    this.closeUnmatchedBlocks();
    if (BLOCKS[container.type].acceptsLines) {
      this.addLine();
    } else if (this.offset < this.currentLine.length && !this.blank) {
      this.addChild('paragraph');
      this.advanceNextNonspace();
      this.addLine();
    }
  }
}
