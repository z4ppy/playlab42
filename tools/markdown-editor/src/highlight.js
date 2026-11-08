/**
 * Coloration syntaxique légère, faite maison, pour les blocs de code.
 *
 * Chaque langage est une liste ordonnée de règles `[type, expression]` ; à
 * chaque position la première règle qui s'applique produit un jeton, sinon le
 * caractère reste du texte ordinaire. Ce n'est pas un analyseur complet (pas
 * d'imbrication de gabarits, d'expressions régulières JS…) mais il colore
 * correctement les cas courants, sans dépendance, en temps linéaire.
 *
 * @module highlight
 */

/** @typedef {{ type: string|null, text: string }} Token */
/** @typedef {Array<[string|null, RegExp]>} Grammar */

const JS_KEYWORDS = 'async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield';

/** @type {Record<string, Grammar>} */
const GRAMMARS = {
  js: [
    ['comment', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ['string', /"(?:\\[\s\S]|[^\\"\n])*"?|'(?:\\[\s\S]|[^\\'\n])*'?|`(?:\\[\s\S]|[^\\`])*`?/y],
    ['number', /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/y],
    ['literal', /\b(?:true|false|null|undefined|NaN|Infinity)\b/y],
    ['keyword', new RegExp(`\\b(?:${JS_KEYWORDS})\\b`, 'y')],
    ['function', /[A-Za-z_$][\w$]*(?=\s*\()/y],
    [null, /[A-Za-z_$][\w$]*/y],
  ],
  json: [
    ['property', /"(?:\\.|[^\\"\n])*"(?=\s*:)/y],
    ['string', /"(?:\\.|[^\\"\n])*"?/y],
    ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y],
    ['literal', /\b(?:true|false|null)\b/y],
    ['comment', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
  ],
  html: [
    ['comment', /<!--[\s\S]*?(?:-->|$)/y],
    ['keyword', /<!DOCTYPE[^>]*>/iy],
    ['tag', /<\/?[A-Za-z][\w:-]*|\/?>/y],
    ['attr', /[A-Za-z_:][\w:.-]*(?==)/y],
    ['string', /"[^"]*"?|'[^']*'?/y],
    ['literal', /&(?:#\d+|#x[\da-fA-F]+|\w+);/y],
  ],
  css: [
    ['comment', /\/\*[\s\S]*?(?:\*\/|$)/y],
    ['string', /"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
    ['keyword', /@[\w-]+|!important\b/y],
    // Propriété : suivie de « : » puis d'une valeur close par « ; » ou « } »
    // (un sélecteur comme « a:hover { » ne l'est pas).
    ['property', /(?:--)?[A-Za-z][\w-]*(?=\s*:[^;{}]*[;}])/y],
    ['number', /#[\da-fA-F]{3,8}\b|-?\b\d*\.?\d+(?:%|[a-z]+)?/y],
    ['function', /[A-Za-z-]+(?=\()/y],
    [null, /[A-Za-z_-][\w-]*/y],
  ],
  bash: [
    ['comment', /(?<![^\s;])#[^\n]*/y],
    ['string', /"(?:\\[\s\S]|[^\\"])*"?|'[^']*'?/y],
    ['variable', /\$(?:\{[^}\n]*\}?|[A-Za-z_]\w*|[@#?$!*\d-])/y],
    ['keyword', /\b(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|return|local|export|readonly|source|exit)\b/y],
    ['function', /(?<=^|[\s;|&(])(?:sudo|cd|ls|echo|printf|cat|grep|sed|awk|find|git|npm|npx|node|make|docker|curl|mkdir|rm|cp|mv|chmod|test)\b/my],
    ['attr', /(?<=\s)--?[A-Za-z][\w-]*/y],
    ['number', /\b\d+\b/y],
    [null, /[A-Za-z_][\w-]*/y],
  ],
};

/** Alias de noms de langage acceptés dans la chaîne d'information. */
const ALIASES = new Map(Object.entries({
  javascript: 'js', js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', typescript: 'js',
  json: 'json', jsonc: 'json', json5: 'json',
  html: 'html', htm: 'html', xml: 'html', svg: 'html', xhtml: 'html',
  css: 'css', scss: 'css', less: 'css',
  bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', shellscript: 'bash',
}));

/**
 * Nom de grammaire pour un langage déclaré, ou null s'il n'est pas colorable.
 * @param {string} language
 * @returns {string|null}
 */
export function resolveLanguage(language) {
  return ALIASES.get(String(language).toLowerCase()) ?? null;
}

/**
 * Applique la première règle reconnue à la position donnée.
 * @param {Grammar} grammar
 * @param {string} code
 * @param {number} pos
 * @returns {Token|null}
 */
function matchRule(grammar, code, pos) {
  for (const [type, re] of grammar) {
    re.lastIndex = pos;
    const match = re.exec(code);
    if (match && match[0].length > 0) {
      return { type, text: match[0] };
    }
  }
  return null;
}

/**
 * Découpe du code en jetons colorables.
 * @param {string} code
 * @param {string} language - Nom ou alias du langage.
 * @returns {Token[]|null} Jetons (texte ordinaire : type null), ou null si
 *   le langage n'est pas pris en charge.
 */
export function highlight(code, language) {
  const name = resolveLanguage(language);
  if (!name) {
    return null;
  }
  const grammar = GRAMMARS[name];
  /** @type {Token[]} */
  const tokens = [];
  let plain = '';
  let pos = 0;
  while (pos < code.length) {
    const token = matchRule(grammar, code, pos);
    if (token && token.type) {
      if (plain) {
        tokens.push({ type: null, text: plain });
        plain = '';
      }
      tokens.push(token);
    } else {
      plain += token ? token.text : code[pos];
    }
    pos += token ? token.text.length : 1;
  }
  if (plain) {
    tokens.push({ type: null, text: plain });
  }
  return tokens;
}
