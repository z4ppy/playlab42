/**
 * Commandes d'édition pures : chaque commande reçoit l'état de la zone de
 * saisie `{ text, start, end }` et renvoie le nouvel état, sans toucher au
 * DOM. L'interface applique ensuite la différence (ce qui préserve
 * l'historique d'annulation du navigateur).
 *
 * @module editor-commands
 */

/**
 * @typedef {object} EditorState
 * @property {string} text - Contenu complet.
 * @property {number} start - Début de la sélection.
 * @property {number} end - Fin de la sélection (égale à start : simple curseur).
 */

/** Marqueur de liste en début de ligne : indentation, puce ou numéro, case. */
const reListItem = /^([ \t]*)([-*+]|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/;
const reQuote = /^([ \t]*>[ \t]?)+/;

/**
 * @typedef {object} ListLine
 * @property {number} indent - Largeur de l'indentation (tabulation = 4).
 * @property {string} indentText - Indentation brute.
 * @property {string} marker - Puce ou numéro avec son délimiteur.
 * @property {number|null} number - Numéro d'une liste ordonnée.
 * @property {string} delimiter - « . » ou « ) » (listes ordonnées).
 * @property {boolean} task - L'élément porte une case à cocher.
 * @property {number} prefixLength - Longueur du préfixe complet (contenu après).
 * @property {number} contentOffset - Colonne où commence le contenu.
 */

/**
 * Analyse une ligne d'élément de liste.
 * @param {string} line
 * @returns {ListLine|null}
 */
export function parseListLine(line) {
  const match = reListItem.exec(line);
  if (!match) {
    return null;
  }
  const indent = columnWidth(match[1]);
  return {
    indent,
    indentText: match[1],
    marker: match[2],
    number: match[3] ? Number.parseInt(match[3], 10) : null,
    delimiter: match[4] ?? '',
    task: Boolean(match[6]),
    prefixLength: match[0].length,
    contentOffset: indent + match[2].length + match[5].length,
  };
}

/**
 * Largeur d'une indentation (tabulations sur 4 colonnes).
 * @param {string} whitespace
 * @returns {number}
 */
function columnWidth(whitespace) {
  let width = 0;
  for (const char of whitespace) {
    width += char === '\t' ? 4 - (width % 4) : 1;
  }
  return width;
}

/**
 * Bornes des lignes touchées par la sélection. Une sélection qui se termine
 * au tout début d'une ligne n'inclut pas cette dernière ligne.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {{ from: number, to: number }} Début de la première ligne, fin de la dernière.
 */
export function lineRange(text, start, end) {
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const newline = text.indexOf('\n', last);
  return { from, to: newline === -1 ? text.length : newline };
}

/**
 * Remplace un intervalle et renvoie le nouvel état.
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @param {string} insert
 * @param {number} start - Nouvelle sélection.
 * @param {number} end
 * @returns {EditorState}
 */
function replace(text, from, to, insert, start, end) {
  return { text: text.slice(0, from) + insert + text.slice(to), start, end };
}

/**
 * Longueur de la suite de `char` qui se termine juste avant `index`
 * (`direction` -1) ou qui commence à `index` (`direction` 1).
 * @param {string} text
 * @param {number} index
 * @param {-1|1} direction
 * @param {string} char
 * @returns {number}
 */
function runLength(text, index, direction, char) {
  let length = 0;
  let cursor = direction < 0 ? index - 1 : index;
  while (cursor >= 0 && cursor < text.length && text[cursor] === char) {
    length += 1;
    cursor += direction;
  }
  return length;
}

/**
 * Le marqueur est-il présent à cet endroit ? Pour un marqueur d'un seul
 * caractère (`*` de l'italique), une suite paire est un autre marqueur
 * (`**` du gras) : seule une suite impaire (`*`, `***`) en contient un.
 * @param {string} text
 * @param {number} index
 * @param {-1|1} direction
 * @param {string} marker
 * @returns {boolean}
 */
function hasMarker(text, index, direction, marker) {
  const found = direction < 0 ? text.slice(index - marker.length, index) : text.slice(index, index + marker.length);
  return found === marker && (marker.length > 1 || runLength(text, index, direction, marker) % 2 === 1);
}

/**
 * Entoure ou libère la sélection d'un marqueur (`**`, `*`, `` ` ``, `~~`).
 * Les espaces en bord de sélection restent à l'extérieur, car `** gras **`
 * ne serait pas reconnu comme emphase.
 * @param {EditorState} state
 * @param {string} marker
 * @param {string} placeholder - Texte inséré et sélectionné si rien n'est sélectionné.
 * @returns {EditorState}
 */
export function toggleWrap(state, marker, placeholder) {
  const { text } = state;
  const size = marker.length;
  const raw = text.slice(state.start, state.end);
  const start = state.start + (raw.length - raw.trimStart().length);
  const end = Math.max(start, state.end - (raw.length - raw.trimEnd().length));
  const selected = text.slice(start, end);
  if (hasMarker(text, start, -1, marker) && hasMarker(text, end, 1, marker)) {
    return replace(text, start - size, end + size, selected, start - size, end - size);
  }
  if (selected.length >= 2 * size && hasMarker(selected, 0, 1, marker) && hasMarker(selected, selected.length, -1, marker)) {
    const inner = selected.slice(size, -size);
    return replace(text, start, end, inner, start, start + inner.length);
  }
  const content = selected || placeholder;
  return replace(text, start, end, marker + content + marker, start + size, start + size + content.length);
}

/**
 * Applique une transformation à chaque ligne touchée par la sélection, en
 * conservant la sélection sur le bloc transformé.
 * @param {EditorState} state
 * @param {(lines: string[]) => string[]} transform
 * @returns {EditorState}
 */
function mapLines(state, transform) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const changed = transform(lines);
  const block = changed.join('\n');
  if (state.start === state.end && lines.length === 1) {
    // Curseur seul : il suit le décalage introduit en début de ligne.
    const delta = block.length - lines[0].length;
    const caret = Math.max(from, state.start + delta);
    return replace(state.text, from, to, block, caret, caret);
  }
  return replace(state.text, from, to, block, from, from + block.length);
}

/**
 * Retire tout marqueur de liste d'une ligne (indentation conservée).
 * @param {string} line
 * @returns {string}
 */
function stripListMarker(line) {
  const item = parseListLine(line);
  return item ? item.indentText + line.slice(item.prefixLength) : line;
}

/**
 * La ligne est-elle un élément de liste vérifiant `predicate` ?
 * @param {string} line
 * @param {(item: ListLine) => boolean} predicate
 * @returns {boolean}
 */
function isItem(line, predicate) {
  const item = parseListLine(line);
  return item !== null && predicate(item);
}

/** Préfixes de lignes proposés par la barre d'outils. */
const LINE_KINDS = {
  quote: {
    has: (line) => reQuote.test(line),
    remove: (line) => line.replace(/^([ \t]*)>[ \t]?/, '$1'),
    add: (line) => `> ${line}`,
  },
  bullet: {
    has: (line) => isItem(line, (item) => item.number === null && !item.task),
    remove: stripListMarker,
    add: (line) => withMarker(line, '- '),
  },
  task: {
    has: (line) => isItem(line, (item) => item.task),
    remove: stripListMarker,
    add: (line) => withMarker(line, '- [ ] '),
  },
  ordered: {
    has: (line) => isItem(line, (item) => item.number !== null),
    remove: stripListMarker,
    add: (line, index) => withMarker(line, `${index + 1}. `),
  },
};

/**
 * Remplace le marqueur éventuel d'une ligne par un nouveau marqueur.
 * @param {string} line
 * @param {string} marker
 * @returns {string}
 */
function withMarker(line, marker) {
  const stripped = stripListMarker(line);
  const indent = /^[ \t]*/.exec(stripped)[0];
  return indent + marker + stripped.slice(indent.length);
}

/**
 * Ajoute ou retire un préfixe de ligne : citation, puce, tâche ou numéro.
 * Si toutes les lignes non vides l'ont déjà, il est retiré ; sinon il est
 * posé partout (en remplaçant un autre type de marqueur de liste).
 * @param {EditorState} state
 * @param {'quote'|'bullet'|'task'|'ordered'} kind
 * @returns {EditorState}
 */
export function toggleLinePrefix(state, kind) {
  const spec = LINE_KINDS[kind];
  return mapLines(state, (lines) => {
    const filled = lines.filter((line) => line.trim() !== '');
    const allHave = filled.length > 0 && filled.every((line) => spec.has(line));
    let index = 0;
    return lines.map((line) => {
      if (line.trim() === '' && lines.length > 1) {
        return line;
      }
      return allHave ? spec.remove(line) : spec.add(line, index++);
    });
  });
}

/**
 * Fait tourner le niveau de titre de la ligne courante : aucun → # → ## → ### → aucun.
 * @param {EditorState} state
 * @returns {EditorState}
 */
export function cycleHeading(state) {
  return mapLines(state, (lines) => lines.map((line) => {
    const match = /^(#{1,6})[ \t]+/.exec(line);
    const body = match ? line.slice(match[0].length) : line;
    const level = match ? match[1].length : 0;
    return level >= 3 ? body : `${'#'.repeat(level + 1)} ${body}`;
  }));
}

/**
 * Insère un lien. Une URL sélectionnée devient la destination ; sinon le
 * texte sélectionné devient l'intitulé et l'adresse à saisir est sélectionnée.
 * @param {EditorState} state
 * @returns {EditorState}
 */
export function insertLink(state) {
  const { text, start, end } = state;
  const selected = text.slice(start, end);
  if (/^(?:https?:\/\/|mailto:|www\.)\S+$/i.test(selected)) {
    const label = 'texte du lien';
    return replace(text, start, end, `[${label}](${selected})`, start + 1, start + 1 + label.length);
  }
  const label = selected || 'texte du lien';
  const url = 'https://';
  const insert = `[${label}](${url})`;
  const urlStart = start + label.length + 3;
  return replace(text, start, end, insert, urlStart, urlStart + url.length);
}

/**
 * Code : en ligne pour une sélection d'une ligne, bloc clôturé sinon.
 * @param {EditorState} state
 * @returns {EditorState}
 */
export function insertCode(state) {
  const { text, start, end } = state;
  const selected = text.slice(start, end);
  const { from, to } = lineRange(text, start, end);
  const emptyLine = start === end && text.slice(from, to).trim() === '';
  if (!selected.includes('\n') && !emptyLine) {
    return toggleWrap(state, '`', 'code');
  }
  const body = selected.replace(/\n$/, '') || 'code';
  const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const insert = `${before}\`\`\`\n${body}\n\`\`\`\n`;
  const bodyStart = start + before.length + 4;
  return replace(text, start, end, insert, bodyStart, bodyStart + body.length);
}

/**
 * Insère un tableau modèle sur ses propres lignes, entouré de lignes vides.
 * @param {EditorState} state
 * @returns {EditorState}
 */
export function insertTable(state) {
  const { text, end } = state;
  const lineStart = text.lastIndexOf('\n', end - 1) + 1;
  const { to } = lineRange(text, end, end);
  const emptyLine = text.slice(lineStart, to).trim() === '';
  // Sur une ligne vide, le tableau la remplace ; sinon il suit la ligne.
  const at = emptyLine ? lineStart : to;
  const removeTo = emptyLine ? to : at;
  const header = 'Colonne 1';
  const table = `| ${header} | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |`;
  const before = blankBefore(text.slice(0, at));
  const after = blankAfter(text.slice(removeTo));
  const select = at + before.length + 2;
  return replace(text, at, removeTo, before + table + after, select, select + header.length);
}

/**
 * Sauts de ligne à ajouter pour qu'une ligne vide précède un bloc inséré.
 * @param {string} head - Texte avant le point d'insertion.
 * @returns {string}
 */
function blankBefore(head) {
  if (head === '' || head.endsWith('\n\n')) {
    return '';
  }
  return head.endsWith('\n') ? '\n' : '\n\n';
}

/**
 * Sauts de ligne à ajouter pour qu'une ligne vide suive un bloc inséré.
 * @param {string} tail - Texte après le point d'insertion.
 * @returns {string}
 */
function blankAfter(tail) {
  return tail === '' || tail.startsWith('\n') ? '\n' : '\n\n';
}

/**
 * La sélection touche-t-elle un élément de liste ? (Tab indente alors la
 * liste au lieu de déplacer le focus.)
 * @param {EditorState} state
 * @returns {boolean}
 */
export function selectionTouchesList(state) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  return state.text.slice(from, to).split('\n').some((line) => parseListLine(line) !== null);
}

/**
 * Lignes d'élément de liste qui précèdent la position, de la plus proche à la plus lointaine.
 * @param {string} text
 * @param {number} before - Début de la première ligne concernée.
 * @returns {ListLine[]}
 */
function previousItems(text, before) {
  return text.slice(0, before).split('\n').reverse()
    .map(parseListLine)
    .filter((item) => item !== null);
}

/**
 * Indente (Tab) ou désindente (Maj+Tab) les lignes de la sélection pour
 * imbriquer les éléments de liste : la largeur suit le contenu de l'élément
 * parent (2 colonnes après « - », 3 après « 1. »).
 * @param {EditorState} state
 * @param {1|-1} direction
 * @returns {EditorState}
 */
export function indentLines(state, direction) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const first = lines.map(parseListLine).find((item) => item !== null);
  const indent = first ? first.indent : columnWidth(/^[ \t]*/.exec(lines[0])[0]);
  const previous = previousItems(state.text, from);
  let target;
  if (direction > 0) {
    const sibling = previous.find((item) => item.indent <= indent);
    target = sibling && sibling.indent === indent ? sibling.contentOffset : indent + 2;
  } else {
    const parent = previous.find((item) => item.indent < indent);
    target = parent ? parent.indent : Math.max(0, indent - 2);
  }
  const delta = target - indent;
  const shifted = lines.map((line) => shiftLine(line, delta));
  const block = shifted.join('\n');
  const caretShift = shifted[0].length - lines[0].length;
  if (state.start === state.end) {
    const caret = Math.max(from, state.start + caretShift);
    return replace(state.text, from, to, block, caret, caret);
  }
  return replace(state.text, from, to, block, from, from + block.length);
}

/**
 * Décale une ligne de `delta` colonnes (tabulations converties en espaces).
 * @param {string} line
 * @param {number} delta
 * @returns {string}
 */
function shiftLine(line, delta) {
  if (line.trim() === '') {
    return line;
  }
  const leading = /^[ \t]*/.exec(line)[0];
  const width = Math.max(0, columnWidth(leading) + delta);
  return ' '.repeat(width) + line.slice(leading.length);
}

/**
 * Marqueur de l'élément suivant (numéro incrémenté, case décochée).
 * @param {ListLine} item
 * @returns {string}
 */
function nextMarker(item) {
  const marker = item.number === null ? item.marker : `${item.number + 1}${item.delimiter}`;
  return `${item.indentText}${marker} ${item.task ? '[ ] ' : ''}`;
}

/**
 * Entrée dans une liste ou une citation : poursuit la structure sur la ligne
 * suivante ; sur un élément vide, retire le marqueur et sort de la liste.
 * @param {EditorState} state
 * @returns {EditorState|null} null si Entrée garde son comportement normal.
 */
export function continueBlock(state) {
  const { text, start, end } = state;
  if (start !== end) {
    return null;
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = lineRange(text, start, start).to;
  const line = text.slice(lineStart, lineEnd);
  const item = parseListLine(line);
  const quote = item ? null : reQuote.exec(line);
  const prefixLength = item ? item.prefixLength : quote ? quote[0].length : 0;
  if (prefixLength === 0 || start - lineStart < prefixLength) {
    return null;
  }
  if (line.slice(prefixLength).trim() === '') {
    // Élément vide : on sort de la liste (ou de la citation) en laissant une
    // ligne vide, pour que la suite ne prolonge pas le dernier élément.
    return replace(text, lineStart, lineEnd, '\n', lineStart + 1, lineStart + 1);
  }
  const prefix = item ? nextMarker(item) : quote[0];
  const caret = start + 1 + prefix.length;
  return replace(text, start, end, `\n${prefix}`, caret, caret);
}

/**
 * Marqueur de tâche en tête de ligne, après d'éventuels marqueurs de citation
 * et de liste (`- - [ ] a`, `1. - [ ] a`) ou seul (`[ ]` sous `-`).
 */
const reTaskLine = /^((?:[ \t]*(?:>[ \t]?|(?:[-*+]|\d{1,9}[.)])[ \t]+))*[ \t]*\[)([ xX])\]/;

/**
 * Coche ou décoche la tâche de la ligne indiquée (case cliquée dans l'aperçu).
 * @param {string} text
 * @param {number} lineNumber - Ligne source (1 = première).
 * @param {number} [offset] - Indice, dans la ligne, du caractère entre
 *   crochets (fourni par l'AST) ; à défaut, la ligne est analysée.
 * @returns {string|null} Nouveau texte, ou null si la ligne n'est pas une tâche.
 */
export function toggleTaskAtLine(text, lineNumber, offset) {
  const lines = text.split('\n');
  const index = lineNumber - 1;
  const line = lines[index] ?? '';
  const at = offset === undefined ? (reTaskLine.exec(line)?.[1].length ?? -1)
    : (offset >= 1 && /^\[[ xX]\]$/.test(line.slice(offset - 1, offset + 2)) ? offset : -1);
  if (at < 0) {
    return null;
  }
  const next = line[at] === ' ' ? 'x' : ' ';
  lines[index] = line.slice(0, at) + next + line.slice(at + 1);
  return lines.join('\n');
}

/**
 * Plus petite modification transformant `before` en `after` (préfixe et
 * suffixe communs retirés), pour l'appliquer sans perdre l'historique.
 * @param {string} before
 * @param {string} after
 * @returns {{ from: number, to: number, insert: string }} Intervalle de `before` à remplacer.
 */
export function diffText(before, after) {
  let prefix = 0;
  const max = Math.min(before.length, after.length);
  while (prefix < max && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (suffix < max - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
    suffix += 1;
  }
  return { from: prefix, to: before.length - suffix, insert: after.slice(prefix, after.length - suffix) };
}
