/**
 * Outils partagés par l'analyse des blocs et des éléments en ligne.
 * @module parser/common
 */

import { ENTITY_SOURCE, decodeEntity } from './entities.js';

/** Caractères de ponctuation ASCII qu'une barre oblique inverse peut échapper. */
export const ESCAPABLE = '[!"#$%&\'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]';

/** Teste si un caractère est échappable. */
export const reEscapable = new RegExp(`^${ESCAPABLE}$`);

const reEntityOrEscapedChar = new RegExp(`\\\\${ESCAPABLE}|${ENTITY_SOURCE}`, 'g');

/**
 * Retire les échappements et décode les entités (destinations, titres,
 * chaînes d'information des blocs de code).
 * @param {string} text
 * @returns {string}
 */
export function unescapeString(text) {
  return text.replace(reEntityOrEscapedChar, (match) => {
    if (match[0] === '\\') {
      return match.slice(1);
    }
    return decodeEntity(match) ?? match;
  });
}

/**
 * Normalise une étiquette de référence (`[Foo  Bar]` ≡ `[foo bar]`).
 * Le passage minuscule puis majuscule approche le « case folding » Unicode
 * (ß et ẞ donnent tous deux « SS »).
 * @param {string} label - Étiquette avec ses crochets.
 * @returns {string}
 */
export function normalizeReference(label) {
  return label.slice(1, -1).trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase();
}

/**
 * Indique si le caractère est une espace ou une tabulation.
 * @param {string} char
 * @returns {boolean}
 */
export function isSpaceOrTab(char) {
  return char === ' ' || char === '\t';
}
