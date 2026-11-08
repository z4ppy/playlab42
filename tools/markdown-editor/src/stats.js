/**
 * Statistiques d'un document : mots, caractères, temps de lecture.
 *
 * Les mots sont comptés sur le texte rendu (AST) : la syntaxe Markdown et les
 * adresses de liens ne sont pas des mots. Les caractères sont ceux de la
 * source, comptés en points de code (un émoji compte pour un).
 *
 * @module stats
 */

/** Vitesse de lecture silencieuse moyenne retenue (mots par minute). */
export const WORDS_PER_MINUTE = 230;

const reWord = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/**
 * Texte lisible d'un nœud et de ses descendants (cellules de tableau comprises).
 * @param {import('./parser/ast.js').MdNode} node
 * @returns {string}
 */
export function plainText(node) {
  if (node.type === 'table') {
    return [node.head, ...node.rows].flat().map((cell) => cell.map(plainText).join('')).join(' ');
  }
  if (node.type === 'softbreak' || node.type === 'linebreak') {
    return ' ';
  }
  if (node.literal !== undefined) {
    return node.literal;
  }
  const separator = node.type === 'document' || node.type === 'list' || node.type === 'item' || node.type === 'blockquote' ? '\n' : '';
  return (node.children ?? []).map(plainText).join(separator);
}

/**
 * Nombre de mots d'un texte.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  return text.match(reWord)?.length ?? 0;
}

/**
 * @typedef {object} DocumentStats
 * @property {number} words
 * @property {number} characters - Caractères de la source.
 * @property {number} lines - Lignes de la source.
 * @property {number} readingMinutes - Arrondi, au moins 1 dès qu'il y a un mot.
 */

/**
 * @param {string} source - Texte Markdown.
 * @param {import('./parser/ast.js').MdNode} doc - Son AST.
 * @returns {DocumentStats}
 */
export function computeStats(source, doc) {
  const words = countWords(plainText(doc));
  return {
    words,
    characters: Array.from(source).length,
    lines: source === '' ? 0 : source.split('\n').length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}

/**
 * Libellé court en français : « 1 234 mots · 5 678 caractères · 6 min ».
 * @param {DocumentStats} stats
 * @returns {string}
 */
export function formatStats(stats) {
  const number = (value) => value.toLocaleString('fr-FR');
  const plural = (value, word) => `${number(value)} ${word}${value > 1 ? 's' : ''}`;
  const reading = stats.readingMinutes === 0 ? '0 min' : `${stats.readingMinutes} min de lecture`;
  return `${plural(stats.words, 'mot')} · ${plural(stats.characters, 'caractère')} · ${reading}`;
}
