/**
 * Mini-évaluateur d'expressions arithmétiques pour les L-systèmes paramétrés.
 *
 * Pourquoi un parseur maison : les règles viennent de l'utilisateur ou de
 * l'URL partagée ; `eval` ou `new Function` exécuteraient du code arbitraire.
 * On compile donc l'expression en un arbre de fermetures, sans aucun accès
 * au contexte global : seuls les nombres, les paramètres déclarés et une
 * poignée de fonctions mathématiques sont reconnus.
 *
 * Grammaire (priorité croissante) :
 *   ou       := et ('||' et)*
 *   et       := cmp ('&&' cmp)*
 *   cmp      := somme (('<'|'<='|'>'|'>='|'=='|'!=') somme)?
 *   somme    := produit (('+'|'-') produit)*
 *   produit  := unaire (('*'|'/'|'%') unaire)*
 *   unaire   := ('-'|'+'|'!') unaire | puissance
 *   puissance:= primaire ('^' unaire)?
 *   primaire := nombre | ident | ident '(' args ')' | '(' ou ')'
 */

/** Erreur de syntaxe dans une expression ou une règle. */
export class ExpressionError extends Error {
  /**
   * @param {string} message - Message lisible (français)
   */
  constructor(message) {
    super(message);
    this.name = 'ExpressionError';
    /**
     * Champ de saisie fautif, renseigné par le compilateur de L-système.
     * @type {{ kind: 'axiom' } | { kind: 'rule', index: number, part: 'predecessor'|'successor'|'probability' } | undefined}
     */
    this.field = undefined;
  }
}

/** Fonctions autorisées dans les expressions (aucune n'a d'effet de bord). */
const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  round: Math.round,
  // Trigonométrie en degrés : c'est l'unité des angles partout dans l'outil.
  sin: (deg) => Math.sin((deg * Math.PI) / 180),
  cos: (deg) => Math.cos((deg * Math.PI) / 180),
};

const TOKEN_PATTERN = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|==|!=|&&|\|\||[-+*/%^()<>!,])/y;

/**
 * Découpe une expression en jetons.
 * @param {string} source - Texte de l'expression
 * @returns {string[]} Jetons
 * @throws {ExpressionError} Si un caractère est inattendu
 */
export function tokenize(source) {
  const tokens = [];
  TOKEN_PATTERN.lastIndex = 0;
  let index = 0;
  while (index < source.length) {
    if (source.slice(index).trim() === '') {
      break;
    }
    TOKEN_PATTERN.lastIndex = index;
    const match = TOKEN_PATTERN.exec(source);
    if (!match) {
      throw new ExpressionError(`Caractère inattendu « ${source.slice(index).trim()[0]} » dans « ${source} »`);
    }
    tokens.push(match[1]);
    index = TOKEN_PATTERN.lastIndex;
  }
  return tokens;
}

const BINARY = {
  '||': (a, b) => (a || b ? 1 : 0),
  '&&': (a, b) => (a && b ? 1 : 0),
  '<': (a, b) => (a < b ? 1 : 0),
  '<=': (a, b) => (a <= b ? 1 : 0),
  '>': (a, b) => (a > b ? 1 : 0),
  '>=': (a, b) => (a >= b ? 1 : 0),
  '==': (a, b) => (a === b ? 1 : 0),
  '!=': (a, b) => (a !== b ? 1 : 0),
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '^': (a, b) => a ** b,
};

/** Niveaux de priorité des opérateurs binaires associatifs à gauche. */
const LEVELS = [
  ['||'],
  ['&&'],
  ['<', '<=', '>', '>=', '==', '!='],
  ['+', '-'],
  ['*', '/', '%'],
];

/**
 * Analyseur descendant récursif qui produit directement des fermetures.
 */
class Parser {
  /**
   * @param {string[]} tokens - Jetons
   * @param {string[]} names - Noms de paramètres autorisés
   * @param {string} source - Texte d'origine, pour les messages
   */
  constructor(tokens, names, source) {
    this.tokens = tokens;
    this.position = 0;
    this.names = names;
    this.source = source;
  }

  peek() {
    return this.tokens[this.position];
  }

  next() {
    return this.tokens[this.position++];
  }

  expect(token) {
    if (this.next() !== token) {
      throw new ExpressionError(`« ${token} » attendu dans « ${this.source} »`);
    }
  }

  /**
   * Analyse un niveau binaire associatif à gauche.
   * @param {number} level - Indice dans LEVELS
   * @returns {(scope: Record<string, number>) => number}
   */
  binary(level) {
    if (level >= LEVELS.length) {
      return this.unary();
    }
    let left = this.binary(level + 1);
    while (LEVELS[level].includes(this.peek())) {
      const apply = BINARY[this.next()];
      const lhs = left;
      const rhs = this.binary(level + 1);
      left = (scope) => apply(lhs(scope), rhs(scope));
    }
    return left;
  }

  unary() {
    const token = this.peek();
    if (token === '-' || token === '+' || token === '!') {
      this.next();
      const operand = this.unary();
      if (token === '-') {return (scope) => -operand(scope);}
      if (token === '!') {return (scope) => (operand(scope) ? 0 : 1);}
      return operand;
    }
    return this.power();
  }

  power() {
    const base = this.primary();
    if (this.peek() !== '^') {
      return base;
    }
    this.next();
    // Associativité à droite : 2^3^2 = 2^(3^2).
    const exponent = this.unary();
    return (scope) => base(scope) ** exponent(scope);
  }

  primary() {
    const token = this.next();
    if (token === undefined) {
      throw new ExpressionError(`Expression incomplète : « ${this.source} »`);
    }
    if (token === '(') {
      const inner = this.binary(0);
      this.expect(')');
      return inner;
    }
    if (/^[\d.]/.test(token)) {
      const value = Number(token);
      return () => value;
    }
    if (/^[A-Za-z_]/.test(token)) {
      return this.identifier(token);
    }
    throw new ExpressionError(`Jeton inattendu « ${token} » dans « ${this.source} »`);
  }

  identifier(name) {
    if (this.peek() === '(') {
      return this.call(name);
    }
    if (!this.names.includes(name)) {
      throw new ExpressionError(`Paramètre inconnu « ${name} » dans « ${this.source} »`);
    }
    return (scope) => scope[name];
  }

  call(name) {
    const fn = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : null;
    if (!fn) {
      throw new ExpressionError(`Fonction inconnue « ${name} » (autorisées : ${Object.keys(FUNCTIONS).join(', ')})`);
    }
    this.expect('(');
    const args = [this.binary(0)];
    while (this.peek() === ',') {
      this.next();
      args.push(this.binary(0));
    }
    this.expect(')');
    return (scope) => fn(...args.map((arg) => arg(scope)));
  }
}

/**
 * Compile une expression en fonction évaluable.
 * @param {string} source - Expression, par exemple « l*0.7 » ou « w > 1 »
 * @param {string[]} [names] - Paramètres autorisés
 * @returns {(scope: Record<string, number>) => number} Fonction d'évaluation
 * @throws {ExpressionError} Si l'expression est invalide
 */
export function compileExpression(source, names = []) {
  const tokens = tokenize(source);
  if (tokens.length === 0) {
    throw new ExpressionError('Expression vide');
  }
  const parser = new Parser(tokens, names, source);
  const evaluate = parser.binary(0);
  if (parser.position < tokens.length) {
    throw new ExpressionError(`Jeton en trop « ${parser.peek()} » dans « ${source} »`);
  }
  return evaluate;
}
