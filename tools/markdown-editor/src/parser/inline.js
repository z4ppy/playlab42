/**
 * Seconde passe : analyse des éléments en ligne (CommonMark + GFM).
 *
 * Portage commenté de l'algorithme de référence : on parcourt le texte d'un
 * paragraphe en produisant des nœuds texte ; les délimiteurs `*`, `_` et `~`
 * et les crochets `[`, `![` sont empilés, puis résolus quand un crochet
 * fermant ou la fin du texte est atteint. Le HTML brut n'est pas reconnu :
 * un `<` qui n'ouvre pas un lien automatique reste du texte, échappé au rendu.
 *
 * @module parser/inline
 */

import { Node } from './ast.js';
import { ESCAPABLE, normalizeReference, reEscapable, unescapeString } from './common.js';
import { ENTITY_SOURCE, decodeEntity } from './entities.js';
import { linkifyText } from './autolink.js';

const reEntityHere = new RegExp(ENTITY_SOURCE, 'y');
const reMain = /[^\n`[\]\\!<&*_~]+/y;
const reTicksHere = /`+/y;
const reFinalSpace = / *$/;
const reInitialSpace = / */y;
const reSpnl = /[ \t]*(?:\n[ \t]*)?/y;
const reLinkLabel = /\[(?:[^\\[\]]|\\.){0,1000}\]/ys;
// Le caractère NUL est déjà remplacé par U+FFFD lors de la lecture des lignes.
const reLinkTitle = /"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|\((?:\\[\s\S]|[^\\()])*\)/y;
const reLinkDestinationBraces = /<(?:[^<>\n\\]|\\.)*>/y;
const reSpaceAtEndOfLine = /[ \t]*(?:\n|$)/y;
const reEmailAutolink = /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y;
const reAutolink = /<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\p{Cc} ]*)>/uy;
const reUnicodeWhitespace = /^\s$/u;
const rePunctuation = new RegExp(`^(?:${ESCAPABLE}|[\\p{P}\\p{S}])$`, 'u');

/**
 * Profondeur maximale d'éléments en ligne imbriqués. Au-delà (« ***…*** »
 * sur des milliers de caractères), le contenu est aplati en texte : le rendu,
 * récursif, ne risque pas de dépasser la pile d'appels.
 */
export const MAX_INLINE_DEPTH = 32;

/** Longueur maximale d'une étiquette de lien (999 caractères + crochets). */
const MAX_LABEL = 1001;
/**
 * Imbrication maximale des parenthèses d'une destination brute. La
 * spécification autorise cette limite (au moins 3 niveaux) ; comme cmark, on
 * s'arrête à 32 pour que `[a](` répété ne coûte pas un balayage quadratique.
 */
const MAX_DESTINATION_PARENS = 32;

/**
 * @typedef {object} Delimiter
 * @property {string} cc - Caractère (`*`, `_` ou `~`).
 * @property {number} numdelims - Délimiteurs encore disponibles.
 * @property {number} origdelims - Longueur initiale de la suite.
 * @property {Node} node - Nœud texte qui porte les délimiteurs.
 * @property {boolean} canOpen
 * @property {boolean} canClose
 * @property {Delimiter|null} previous
 * @property {Delimiter|null} next
 */

/**
 * @typedef {object} Bracket
 * @property {Node} node - Nœud texte « [ » ou « ![ ».
 * @property {number} index - Position du « [ » dans le texte.
 * @property {boolean} image
 * @property {boolean} active
 * @property {boolean} bracketAfter - Un autre crochet a été ouvert après.
 * @property {Delimiter|null} previousDelimiter
 * @property {Bracket|null} previous
 */

/** @typedef {{ destination: string, title: string }} LinkReference */

/**
 * Crée un nœud texte.
 * @param {string} literal
 * @returns {Node}
 */
function text(literal) {
  return new Node('text', { literal });
}

/**
 * Caractère avant `pos` en tenant compte des paires de substitution UTF-16.
 * @param {string} subject
 * @param {number} pos
 * @returns {string}
 */
function charBefore(subject, pos) {
  if (pos === 0) {
    return '\n';
  }
  const code = subject.codePointAt(pos - 2);
  return code !== undefined && code > 0xFFFF ? String.fromCodePoint(code) : subject[pos - 1];
}

/**
 * Caractère à `pos` (point de code complet), « \n » en fin de texte.
 * @param {string} subject
 * @param {number} pos
 * @returns {string}
 */
function charAt(subject, pos) {
  const code = subject.codePointAt(pos);
  return code === undefined ? '\n' : String.fromCodePoint(code);
}

/**
 * Règles de « flanquement » d'une suite de délimiteurs (spec, § 6.2).
 * @param {string} cc - Caractère délimiteur.
 * @param {string} before - Caractère précédent.
 * @param {string} after - Caractère suivant.
 * @returns {{ canOpen: boolean, canClose: boolean }}
 */
export function flanking(cc, before, after) {
  const { left, right, beforePunct, afterPunct } = flankingSides(before, after);
  if (cc === '_') {
    // « _ » n'ouvre ni ne ferme à l'intérieur d'un mot.
    return { canOpen: left && (!right || beforePunct), canClose: right && (!left || afterPunct) };
  }
  return { canOpen: left, canClose: right };
}

/**
 * Suite « flanquante » à gauche et/ou à droite.
 * @param {string} before
 * @param {string} after
 * @returns {{ left: boolean, right: boolean, beforePunct: boolean, afterPunct: boolean }}
 */
function flankingSides(before, after) {
  const afterSpace = reUnicodeWhitespace.test(after);
  const afterPunct = rePunctuation.test(after);
  const beforeSpace = reUnicodeWhitespace.test(before);
  const beforePunct = rePunctuation.test(before);
  return {
    left: !afterSpace && (!afterPunct || beforeSpace || beforePunct),
    right: !beforeSpace && (!beforePunct || afterSpace || afterPunct),
    beforePunct,
    afterPunct,
  };
}

/**
 * Cache des suites de backticks : pour chaque longueur, positions de début
 * triées et curseur de lecture. Les recherches se font à `from` croissant :
 * le curseur ne recule jamais, d'où un coût total linéaire (pas de `shift()`,
 * qui recopie le tableau à chaque appel et rendait l'analyse quadratique).
 */
class BacktickIndex {
  /** @param {string} subject */
  constructor(subject) {
    /** @type {Map<number, { positions: number[], cursor: number }>} */
    this.runs = new Map();
    for (const match of subject.matchAll(/`+/g)) {
      const run = this.runs.get(match[0].length) ?? { positions: [], cursor: 0 };
      run.positions.push(match.index);
      this.runs.set(match[0].length, run);
    }
  }

  /**
   * Première suite de même longueur commençant à `from` ou après.
   * @param {number} length
   * @param {number} from
   * @returns {number} Position, ou -1.
   */
  next(length, from) {
    const run = this.runs.get(length);
    if (!run) {
      return -1;
    }
    const { positions } = run;
    while (run.cursor < positions.length && positions[run.cursor] < from) {
      run.cursor += 1;
    }
    return run.cursor < positions.length ? positions[run.cursor] : -1;
  }
}

/** Analyseur des éléments en ligne d'un bloc. */
export class InlineParser {
  /** @param {Map<string, LinkReference>} refmap - Définitions de liens. */
  constructor(refmap) {
    this.refmap = refmap;
    this.subject = '';
    this.pos = 0;
    /** @type {Delimiter|null} */ this.delimiters = null;
    /** @type {Bracket|null} */ this.brackets = null;
    /** @type {BacktickIndex|null} */ this.backticks = null;
  }

  /**
   * Applique une expression ancrée (`y`) à la position courante.
   * @param {RegExp} re
   * @returns {string|null} Texte reconnu (la position avance), sinon null.
   */
  match(re) {
    re.lastIndex = this.pos;
    const found = re.exec(this.subject);
    if (!found) {
      return null;
    }
    this.pos = re.lastIndex;
    return found[0];
  }

  /** @returns {string} Caractère courant, ou '' en fin de texte. */
  peek() {
    return this.subject.charAt(this.pos);
  }

  /**
   * Analyse un texte et ajoute les nœuds produits à `block`.
   * @param {Node} block - Conteneur (paragraphe, titre, cellule).
   * @param {string} content - Texte source, déjà débarrassé des marqueurs de bloc.
   */
  parse(block, content) {
    this.subject = content.trim();
    this.pos = 0;
    this.delimiters = null;
    this.brackets = null;
    this.backticks = null;
    while (this.parseInline(block)) {
      // Chaque appel consomme au moins un caractère.
    }
    this.processEmphasis(null);
    limitDepth(block);
    mergeText(block);
    linkifyText(block);
  }

  /**
   * Consomme un élément en ligne.
   * @param {Node} block
   * @returns {boolean} false en fin de texte.
   */
  parseInline(block) {
    const c = this.peek();
    if (c === '') {
      return false;
    }
    const handler = this.handlers[c] ?? this.parseString;
    if (!handler.call(this, block)) {
      this.pos += 1;
      block.appendChild(text(c));
    }
    return true;
  }

  /**
   * Texte ordinaire jusqu'au prochain caractère spécial.
   * @param {Node} block
   * @returns {boolean}
   */
  parseString(block) {
    const literal = this.match(reMain);
    if (literal === null) {
      return false;
    }
    block.appendChild(text(literal));
    return true;
  }

  /**
   * Fin de ligne : saut dur si deux espaces la précèdent, sinon saut souple.
   * @param {Node} block
   * @returns {boolean}
   */
  parseNewline(block) {
    this.pos += 1;
    const last = block.lastChild;
    if (last && last.type === 'text' && last.literal.endsWith(' ')) {
      const hard = last.literal.endsWith('  ');
      last.literal = last.literal.replace(reFinalSpace, '');
      block.appendChild(new Node(hard ? 'linebreak' : 'softbreak'));
    } else {
      block.appendChild(new Node('softbreak'));
    }
    this.match(reInitialSpace);
    return true;
  }

  /**
   * Barre oblique inverse : saut dur, caractère échappé ou texte littéral.
   * @param {Node} block
   * @returns {boolean}
   */
  parseBackslash(block) {
    this.pos += 1;
    const next = this.peek();
    if (next === '\n') {
      this.pos += 1;
      block.appendChild(new Node('linebreak'));
    } else if (reEscapable.test(next)) {
      this.pos += 1;
      block.appendChild(text(next));
    } else {
      block.appendChild(text('\\'));
    }
    return true;
  }

  /**
   * Code en ligne délimité par une suite de backticks de même longueur.
   * @param {Node} block
   * @returns {boolean}
   */
  parseBackticks(block) {
    const ticks = this.match(reTicksHere);
    this.backticks ??= new BacktickIndex(this.subject);
    const close = this.backticks.next(ticks.length, this.pos);
    if (close < 0) {
      block.appendChild(text(ticks));
      return true;
    }
    let contents = this.subject.slice(this.pos, close).replace(/\n/g, ' ');
    if (/^ .*[^ ].* $/s.test(contents)) {
      contents = contents.slice(1, -1);
    }
    this.pos = close + ticks.length;
    block.appendChild(new Node('code', { literal: contents }));
    return true;
  }

  /**
   * Suite de délimiteurs d'emphase (`*`, `_`) ou de barré (`~`).
   * @param {Node} block
   * @returns {boolean}
   */
  handleDelim(block) {
    const cc = this.peek();
    const start = this.pos;
    while (this.peek() === cc) {
      this.pos += 1;
    }
    const count = this.pos - start;
    const node = block.appendChild(text(this.subject.slice(start, this.pos)));
    const { canOpen, canClose } = flanking(cc, charBefore(this.subject, start), charAt(this.subject, this.pos));
    // GFM : seuls « ~ » et « ~~ » délimitent un barré.
    const usable = (canOpen || canClose) && (cc !== '~' || count <= 2);
    if (usable) {
      this.pushDelimiter({ cc, numdelims: count, origdelims: count, node, canOpen, canClose, previous: this.delimiters, next: null });
    }
    return true;
  }

  /** @param {Delimiter} delimiter */
  pushDelimiter(delimiter) {
    if (delimiter.previous) {
      delimiter.previous.next = delimiter;
    }
    this.delimiters = delimiter;
  }

  /** @param {Delimiter} delimiter */
  removeDelimiter(delimiter) {
    if (delimiter.previous) {
      delimiter.previous.next = delimiter.next;
    }
    if (delimiter.next) {
      delimiter.next.previous = delimiter.previous;
    } else {
      this.delimiters = delimiter.previous;
    }
  }

  /**
   * Résout les emphases au-dessus de `stackBottom` (algorithme § 6.2).
   * @param {Delimiter|null} stackBottom
   */
  processEmphasis(stackBottom) {
    /** @type {Map<string, Delimiter|null>} */
    const openersBottom = new Map();
    let closer = this.delimiters;
    while (closer !== null && closer.previous !== stackBottom) {
      closer = closer.previous;
    }
    while (closer !== null) {
      closer = closer.canClose ? this.resolveCloser(closer, stackBottom, openersBottom) : closer.next;
    }
    while (this.delimiters !== null && this.delimiters !== stackBottom) {
      this.removeDelimiter(this.delimiters);
    }
  }

  /**
   * Cherche l'ouvrant d'un fermant et construit l'emphase correspondante.
   * @param {Delimiter} closer
   * @param {Delimiter|null} stackBottom
   * @param {Map<string, Delimiter|null>} openersBottom
   * @returns {Delimiter|null} Prochain délimiteur à examiner.
   */
  resolveCloser(closer, stackBottom, openersBottom) {
    const key = `${closer.cc}${closer.canOpen ? 'o' : ''}${closer.origdelims % 3}`;
    const bottom = openersBottom.has(key) ? openersBottom.get(key) : stackBottom;
    const opener = findOpener(closer, stackBottom, bottom);
    if (opener) {
      return this.buildEmphasis(opener, closer);
    }
    openersBottom.set(key, closer.previous);
    const next = closer.next;
    if (!closer.canOpen) {
      this.removeDelimiter(closer);
    }
    return next;
  }

  /**
   * Enveloppe les nœuds entre un ouvrant et un fermant appariés.
   * @param {Delimiter} opener
   * @param {Delimiter} closer
   * @returns {Delimiter|null} Prochain délimiteur à examiner.
   */
  buildEmphasis(opener, closer) {
    const strike = closer.cc === '~';
    const used = strike ? closer.numdelims : Math.min(2, opener.numdelims, closer.numdelims);
    opener.numdelims -= used;
    closer.numdelims -= used;
    opener.node.literal = opener.node.literal.slice(0, opener.node.literal.length - used);
    closer.node.literal = closer.node.literal.slice(0, closer.node.literal.length - used);
    const wrapper = new Node(strike ? 'del' : used === 1 ? 'emph' : 'strong');
    let node = opener.node.next;
    while (node && node !== closer.node) {
      const next = node.next;
      wrapper.appendChild(node);
      node = next;
    }
    opener.node.insertAfter(wrapper);
    // Les délimiteurs situés entre les deux ne peuvent plus s'apparier.
    opener.next = closer;
    closer.previous = opener;
    return this.dropExhausted(opener, closer);
  }

  /**
   * Retire ouvrant et fermant épuisés.
   * @param {Delimiter} opener
   * @param {Delimiter} closer
   * @returns {Delimiter|null}
   */
  dropExhausted(opener, closer) {
    if (opener.numdelims === 0) {
      opener.node.unlink();
      this.removeDelimiter(opener);
    }
    if (closer.numdelims === 0) {
      const next = closer.next;
      closer.node.unlink();
      this.removeDelimiter(closer);
      return next;
    }
    return closer;
  }

  /**
   * Crochet ouvrant « [ ».
   * @param {Node} block
   * @returns {boolean}
   */
  parseOpenBracket(block) {
    const index = this.pos;
    this.pos += 1;
    this.addBracket(block.appendChild(text('[')), index, false);
    return true;
  }

  /**
   * « ! » : ouvre une image s'il est suivi de « [ ».
   * @param {Node} block
   * @returns {boolean}
   */
  parseBang(block) {
    this.pos += 1;
    if (this.peek() !== '[') {
      block.appendChild(text('!'));
      return true;
    }
    this.pos += 1;
    this.addBracket(block.appendChild(text('![')), this.pos - 1, true);
    return true;
  }

  /**
   * @param {Node} node
   * @param {number} index
   * @param {boolean} image
   */
  addBracket(node, index, image) {
    if (this.brackets) {
      this.brackets.bracketAfter = true;
    }
    this.brackets = { node, index, image, active: true, bracketAfter: false, previousDelimiter: this.delimiters, previous: this.brackets };
  }

  /**
   * Crochet fermant : tente un lien ou une image en ligne, puis par référence.
   * @param {Node} block
   * @returns {boolean}
   */
  parseCloseBracket(block) {
    this.pos += 1;
    const afterBracket = this.pos;
    const opener = this.brackets;
    if (opener === null || !opener.active) {
      if (opener) {
        this.brackets = opener.previous;
      }
      block.appendChild(text(']'));
      return true;
    }
    const target = this.parseInlineTarget() ?? this.parseReferenceTarget(opener, afterBracket);
    if (!target) {
      this.brackets = opener.previous;
      this.pos = afterBracket;
      block.appendChild(text(']'));
      return true;
    }
    this.buildLink(block, opener, target);
    return true;
  }

  /**
   * Partie « (destination "titre") » d'un lien en ligne.
   * @returns {LinkReference|null}
   */
  parseInlineTarget() {
    const save = this.pos;
    if (this.peek() !== '(') {
      return null;
    }
    this.pos += 1;
    this.match(reSpnl);
    const destination = this.parseLinkDestination();
    if (destination !== null) {
      const beforeTitle = this.pos;
      this.match(reSpnl);
      // Un titre doit être séparé de la destination par un blanc.
      const title = this.pos > beforeTitle ? this.parseLinkTitle() : null;
      this.match(reSpnl);
      if (this.peek() === ')') {
        this.pos += 1;
        return { destination, title: title ?? '' };
      }
    }
    this.pos = save;
    return null;
  }

  /**
   * Lien par référence : complet `[texte][étiquette]`, réduit `[texte][]`
   * ou raccourci `[texte]`.
   * @param {Bracket} opener
   * @param {number} afterBracket
   * @returns {LinkReference|null}
   */
  parseReferenceTarget(opener, afterBracket) {
    const beforeLabel = this.pos;
    const length = this.parseLinkLabel();
    let label = '';
    if (length > 2) {
      label = this.subject.slice(beforeLabel, beforeLabel + length);
    } else if (!opener.bracketAfter) {
      // Lien réduit ou raccourci : l'étiquette est le texte entre crochets.
      label = this.subject.slice(opener.index, afterBracket);
    }
    if (length === 0) {
      this.pos = afterBracket;
    }
    const reference = label ? this.refmap.get(normalizeReference(label)) : undefined;
    return reference ?? null;
  }

  /**
   * Construit le nœud lien ou image avec les nœuds qui suivent l'ouvrant.
   * @param {Node} block
   * @param {Bracket} opener
   * @param {LinkReference} target
   */
  buildLink(block, opener, target) {
    const node = new Node(opener.image ? 'image' : 'link', { destination: target.destination, title: target.title });
    let child = opener.node.next;
    while (child) {
      const next = child.next;
      node.appendChild(child);
      child = next;
    }
    block.appendChild(node);
    this.processEmphasis(opener.previousDelimiter);
    this.brackets = opener.previous;
    opener.node.unlink();
    // Pas de lien dans un lien : les crochets ouvrants antérieurs sont désactivés.
    if (!opener.image) {
      for (let bracket = this.brackets; bracket; bracket = bracket.previous) {
        if (!bracket.image) {
          bracket.active = false;
        }
      }
    }
  }

  /**
   * Étiquette `[...]` : renvoie sa longueur (crochets compris), ou 0.
   * @returns {number}
   */
  parseLinkLabel() {
    const label = this.match(reLinkLabel);
    if (label === null || label.length > MAX_LABEL) {
      return 0;
    }
    return label.length;
  }

  /**
   * Destination de lien, entre chevrons ou brute (parenthèses équilibrées).
   * @returns {string|null} Destination décodée, ou null.
   */
  parseLinkDestination() {
    const braced = this.match(reLinkDestinationBraces);
    if (braced !== null) {
      return unescapeString(braced.slice(1, -1));
    }
    if (this.peek() === '<') {
      return null;
    }
    const start = this.pos;
    const end = scanRawDestination(this.subject, start);
    if (end < 0 || (end === start && this.subject[end] !== ')')) {
      return null;
    }
    this.pos = end;
    return unescapeString(this.subject.slice(start, end));
  }

  /**
   * Titre de lien entre guillemets, apostrophes ou parenthèses.
   * @returns {string|null}
   */
  parseLinkTitle() {
    const title = this.match(reLinkTitle);
    return title === null ? null : unescapeString(title.slice(1, -1));
  }

  /**
   * Lien automatique `<https://…>` ou `<adresse@exemple.org>`.
   * @param {Node} block
   * @returns {boolean}
   */
  parseAutolink(block) {
    const email = this.match(reEmailAutolink);
    const found = email ?? this.match(reAutolink);
    if (!found) {
      return false;
    }
    const address = found.slice(1, -1);
    const link = new Node('link', { destination: email ? `mailto:${address}` : address, title: '' });
    link.appendChild(text(address));
    block.appendChild(link);
    return true;
  }

  /**
   * Référence de caractère (`&copy;`, `&#169;`).
   * @param {Node} block
   * @returns {boolean}
   */
  parseEntity(block) {
    const entity = this.match(reEntityHere);
    if (entity === null) {
      return false;
    }
    const decoded = decodeEntity(entity);
    block.appendChild(text(decoded ?? entity));
    return true;
  }

  /**
   * Tente de lire une définition de référence `[label]: destination "titre"`
   * au début de `content`.
   * @param {string} content
   * @returns {number} Nombre de caractères consommés (0 si aucune définition).
   */
  parseReference(content) {
    this.subject = content;
    this.pos = 0;
    const labelLength = this.parseLinkLabel();
    if (labelLength === 0 || this.peek() !== ':') {
      return 0;
    }
    const label = normalizeReference(content.slice(0, labelLength));
    this.pos += 1;
    this.match(reSpnl);
    const destination = this.parseLinkDestination();
    if (destination === null || label === '') {
      return 0;
    }
    const title = this.parseDefinitionTitle();
    if (title === null) {
      return 0;
    }
    if (!this.refmap.has(label)) {
      this.refmap.set(label, { destination, title });
    }
    return this.pos;
  }

  /**
   * Titre facultatif d'une définition, suivi d'une fin de ligne obligatoire.
   * @returns {string|null} Titre ('' si absent), ou null si la ligne est invalide.
   */
  parseDefinitionTitle() {
    const beforeTitle = this.pos;
    this.match(reSpnl);
    const title = this.pos > beforeTitle ? this.parseLinkTitle() : null;
    if (title !== null && this.match(reSpaceAtEndOfLine) !== null) {
      return title;
    }
    // Sans titre valide, la destination doit terminer la ligne.
    this.pos = beforeTitle;
    return this.match(reSpaceAtEndOfLine) === null ? null : '';
  }
}

/**
 * Gestionnaires par caractère déclencheur ; tout autre caractère passe par
 * parseString. Appelés avec l'instance comme `this`.
 */
InlineParser.prototype.handlers = {
  '\n': InlineParser.prototype.parseNewline,
  '\\': InlineParser.prototype.parseBackslash,
  '`': InlineParser.prototype.parseBackticks,
  '*': InlineParser.prototype.handleDelim,
  _: InlineParser.prototype.handleDelim,
  '~': InlineParser.prototype.handleDelim,
  '[': InlineParser.prototype.parseOpenBracket,
  '!': InlineParser.prototype.parseBang,
  ']': InlineParser.prototype.parseCloseBracket,
  '<': InlineParser.prototype.parseAutolink,
  '&': InlineParser.prototype.parseEntity,
};

/**
 * Remonte la pile pour trouver un ouvrant compatible avec `closer`.
 * @param {Delimiter} closer
 * @param {Delimiter|null} stackBottom
 * @param {Delimiter|null|undefined} bottom - Borne mémorisée pour ce type de fermant.
 * @returns {Delimiter|null}
 */
function findOpener(closer, stackBottom, bottom) {
  for (let opener = closer.previous; opener && opener !== stackBottom && opener !== bottom; opener = opener.previous) {
    if (opener.cc === closer.cc && opener.canOpen && delimitersMatch(opener, closer)) {
      return opener;
    }
  }
  return null;
}

/**
 * Compatibilité de longueur : règle du « multiple de 3 » pour `*` et `_`,
 * longueur identique pour le barré GFM.
 * @param {Delimiter} opener
 * @param {Delimiter} closer
 * @returns {boolean}
 */
function delimitersMatch(opener, closer) {
  if (closer.cc === '~') {
    return opener.numdelims === closer.numdelims;
  }
  const oddMatch = (closer.canOpen || opener.canClose)
    && closer.origdelims % 3 !== 0
    && (opener.origdelims + closer.origdelims) % 3 === 0;
  return !oddMatch;
}

/**
 * Fin d'une destination brute : parenthèses équilibrées, pas d'espace ni de
 * caractère de contrôle.
 * @param {string} subject
 * @param {number} start
 * @returns {number} Position de fin, ou -1 si les parenthèses sont déséquilibrées
 *   ou trop imbriquées.
 */
function scanRawDestination(subject, start) {
  let pos = start;
  let depth = 0;
  while (pos < subject.length) {
    const c = subject[pos];
    if (c === '\\' && reEscapable.test(subject.charAt(pos + 1))) {
      pos += 2;
      continue;
    }
    if (c <= ' ' || (c === ')' && depth === 0)) {
      break;
    }
    depth += PAREN_DEPTH[c] ?? 0;
    if (depth > MAX_DESTINATION_PARENS) {
      return -1;
    }
    pos += 1;
  }
  return depth === 0 ? pos : -1;
}

/** Variation de profondeur apportée par chaque parenthèse. */
const PAREN_DEPTH = /** @type {Record<string, number>} */ ({ '(': 1, ')': -1 });

/**
 * Fusionne les nœuds texte adjacents (récursivement).
 * @param {Node} parent
 */
function mergeText(parent) {
  let node = parent.firstChild;
  while (node) {
    if (node.type === 'text' && node.next && node.next.type === 'text') {
      node.literal += node.next.literal;
      node.next.unlink();
      continue;
    }
    if (node.firstChild) {
      mergeText(node);
    }
    node = node.next;
  }
}

/**
 * Texte brut d'un sous-arbre, calculé sans récursion.
 * @param {Node} root
 * @returns {string}
 */
function flatText(root) {
  let result = '';
  const stack = [root];
  while (stack.length > 0) {
    const node = /** @type {Node} */ (stack.pop());
    if (node.literal !== undefined) {
      result += node.literal;
    } else if (node.type === 'softbreak' || node.type === 'linebreak') {
      result += ' ';
    }
    const children = node.childList();
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
  return result;
}

/**
 * Aplatit (sans récursion) les éléments imbriqués au-delà de MAX_INLINE_DEPTH.
 * @param {Node} block
 */
function limitDepth(block) {
  /** @type {Array<[Node, number]>} */
  const stack = [[block, 0]];
  while (stack.length > 0) {
    const [node, depth] = /** @type {[Node, number]} */ (stack.pop());
    if (depth >= MAX_INLINE_DEPTH && node.firstChild) {
      const literal = flatText(node);
      for (const child of node.childList()) {
        child.unlink();
      }
      node.appendChild(text(literal));
      continue;
    }
    for (let child = node.firstChild; child; child = child.next) {
      stack.push([child, depth + 1]);
    }
  }
}
