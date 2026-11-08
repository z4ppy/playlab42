/**
 * Décodage des références de caractères HTML (entités nommées et numériques).
 *
 * La table HTML5 complète compte plus de 2 000 noms ; on embarque ici une
 * sélection des entités usuelles (français, typographie, maths, grec, flèches,
 * ponctuation ASCII). Une entité inconnue n'est pas décodée : elle reste du
 * texte littéral, exactement comme l'exige CommonMark pour un nom invalide.
 *
 * @module parser/entities
 */

/** Sélection d'entités nommées (nom sans « & » ni « ; » → texte). */
const NAMED = new Map(Object.entries({
  // Syntaxe HTML et ponctuation ASCII (utile aussi contre les URL déguisées).
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  Tab: '\t', NewLine: '\n', excl: '!', num: '#', dollar: '$', percnt: '%',
  lpar: '(', rpar: ')', ast: '*', plus: '+', comma: ',', period: '.',
  sol: '/', colon: ':', semi: ';', equals: '=', quest: '?', commat: '@',
  lsqb: '[', rsqb: ']', bsol: '\\', lowbar: '_', grave: '`', lcub: '{',
  rcub: '}', verbar: '|', vert: '|', Hat: '^', tilde: '˜',
  // Lettres accentuées.
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
  aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò',
  oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø', oelig: 'œ',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yuml: 'ÿ', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Auml: 'Ä', Aring: 'Å', AElig: 'Æ',
  Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Icirc: 'Î',
  Iuml: 'Ï', Ntilde: 'Ñ', Ocirc: 'Ô', Ouml: 'Ö', Oslash: 'Ø', OElig: 'Œ',
  Ugrave: 'Ù', Ucirc: 'Û', Uuml: 'Ü', Yuml: 'Ÿ', Dcaron: 'Ď', dcaron: 'ď',
  // Typographie.
  laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sbquo: '‚', bdquo: '„', hellip: '…', mdash: '—', ndash: '–', bull: '•',
  middot: '·', thinsp: '\u2009', ensp: '\u2002', emsp: '\u2003', shy: '\u00AD',
  zwj: '\u200D', zwnj: '\u200C', dagger: '†', Dagger: '‡', permil: '‰',
  prime: '′', Prime: '″', sect: '§', para: '¶', copy: '©', reg: '®',
  trade: '™', deg: '°', iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º',
  // Monnaies.
  euro: '€', cent: '¢', pound: '£', yen: '¥', curren: '¤',
  // Mathématiques.
  plusmn: '±', times: '×', divide: '÷', frac12: '½', frac14: '¼',
  frac34: '¾', sup1: '¹', sup2: '²', sup3: '³', micro: 'µ', not: '¬',
  infin: '∞', ne: '≠', le: '≤', ge: '≥', asymp: '≈', equiv: '≡', sum: '∑',
  prod: '∏', radic: '√', part: '∂', nabla: '∇', isin: '∈', notin: '∉',
  cap: '∩', cup: '∪', sub: '⊂', sup: '⊃', and: '∧', or: '∨', forall: '∀',
  exist: '∃', empty: '∅', minus: '−', lowast: '∗', ngE: '≧̸',
  HilbertSpace: 'ℋ', DifferentialD: 'ⅆ', ClockwiseContourIntegral: '∲',
  // Flèches et symboles.
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', lArr: '⇐',
  rArr: '⇒', hArr: '⇔', check: '✓', cross: '✗', star: '☆', starf: '★',
  hearts: '♥', spades: '♠', clubs: '♣', diams: '♦',
  // Grec.
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ',
  Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ',
  Psi: 'Ψ', Omega: 'Ω',
}));

/** Caractère de remplacement pour les points de code invalides. */
const REPLACEMENT = '�';

/**
 * Décode un point de code numérique selon les règles CommonMark : zéro,
 * substituts UTF-16 et valeurs hors Unicode deviennent U+FFFD.
 * @param {number} code
 * @returns {string}
 */
function fromCodePointSafe(code) {
  const invalid = code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF);
  return invalid ? REPLACEMENT : String.fromCodePoint(code);
}

/**
 * Décode une référence complète telle que `&eacute;`, `&#233;` ou `&#xE9;`.
 * @param {string} entity - Référence avec « & » et « ; ».
 * @returns {string|null} Texte décodé, ou null si le nom est inconnu.
 */
export function decodeEntity(entity) {
  const body = entity.slice(1, -1);
  if (body[0] !== '#') {
    return NAMED.get(body) ?? null;
  }
  const hex = body[1] === 'x' || body[1] === 'X';
  const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  return fromCodePointSafe(code);
}

/** Forme d'une référence de caractère reconnue par CommonMark. */
export const ENTITY_SOURCE = '&(?:#[xX][a-fA-F0-9]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});';
