/**
 * Liens automatiques étendus de GFM : `www.exemple.org`, `https://…` et
 * adresses électroniques écrits sans chevrons, détectés dans le texte brut
 * après l'analyse en ligne (jamais à l'intérieur d'un lien ou d'un code).
 *
 * @module parser/autolink
 */

import { Node } from './ast.js';

/** Candidat : URL ou www, précédé d'un début de texte, d'un blanc ou de `*_~(`. */
const reCandidate = /(?<=^|[\s*_~(])(?:(?:https?:\/\/|www\.)[\p{L}\p{N}_-][^\s<]*|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/giu;
/** Ponctuation finale exclue du lien (GFM). */
const reTrailingPunct = /[?!.,:*_~'"]$/;
/** Fin qui ressemble à une entité (`&hl;`) : exclue du lien (GFM). */
const reTrailingEntity = /&[A-Za-z0-9]+;$/;
/** Adresse électronique (sans schéma ni « www. »). */
const reEmailOnly = /^(?!https?:\/\/|www\.)[^@]*@/i;

/**
 * Retire la ponctuation finale et les parenthèses fermantes non appariées.
 * @param {string} url
 * @returns {string}
 */
export function trimAutolink(url) {
  let result = url;
  for (;;) {
    if (reTrailingPunct.test(result)) {
      result = result.slice(0, -1);
    } else if (reTrailingEntity.test(result)) {
      result = result.replace(reTrailingEntity, '');
    } else if (result.endsWith(')') && count(result, '(') < count(result, ')')) {
      result = result.slice(0, -1);
    } else {
      return result;
    }
  }
}

/**
 * @param {string} text
 * @param {string} char
 * @returns {number}
 */
function count(text, char) {
  return text.split(char).length - 1;
}

/**
 * Destination d'un lien automatique étendu.
 * @param {string} found
 * @returns {string}
 */
function destinationOf(found) {
  if (reEmailOnly.test(found)) {
    return `mailto:${found}`;
  }
  return /^www\./i.test(found) ? `http://${found}` : found;
}

/**
 * Texte du lien retenu pour un candidat, ou null s'il n'en forme pas un.
 * @param {string} raw
 * @returns {string|null}
 */
function acceptCandidate(raw) {
  // Une adresse finissant par « - » ou « _ » n'est pas un lien (seul un
  // point final est toléré, et il reste hors du lien).
  if (reEmailOnly.test(raw) && /[-_]$/.test(raw)) {
    return null;
  }
  const found = trimAutolink(raw);
  // Une adresse doit finir par une lettre ou un chiffre.
  return found.includes('@') && !/[\p{L}\p{N}]$/u.test(found) ? null : found;
}

/**
 * Découpe un nœud texte autour des liens automatiques qu'il contient.
 * @param {Node} node
 */
function linkifyNode(node) {
  const literal = node.literal;
  // Filtre rapide : sans « : », « www. » ni « @ », aucun lien possible.
  if (!/[:@]|www\./i.test(literal)) {
    return;
  }
  /** @type {Node[]} */
  const parts = [];
  let last = 0;
  for (const match of literal.matchAll(reCandidate)) {
    const found = acceptCandidate(match[0]);
    if (found === null) {
      continue;
    }
    if (match.index > last) {
      parts.push(new Node('text', { literal: literal.slice(last, match.index) }));
    }
    const link = new Node('link', { destination: destinationOf(found), title: '' });
    link.appendChild(new Node('text', { literal: found }));
    parts.push(link);
    last = match.index + found.length;
  }
  if (parts.length === 0) {
    return;
  }
  if (last < literal.length) {
    parts.push(new Node('text', { literal: literal.slice(last) }));
  }
  let anchor = node;
  for (const part of parts) {
    anchor.insertAfter(part);
    anchor = part;
  }
  node.unlink();
}

/**
 * Applique les liens automatiques étendus aux textes d'un conteneur.
 * @param {Node} parent
 */
export function linkifyText(parent) {
  for (const child of parent.childList()) {
    if (child.type === 'text') {
      linkifyNode(child);
    } else if (child.type !== 'link' && child.type !== 'image' && child.firstChild) {
      linkifyText(child);
    }
  }
}
