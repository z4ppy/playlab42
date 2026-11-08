/**
 * Réécriture de L-systèmes (Lindenmayer) — logique pure, sans DOM.
 *
 * Deux représentations coexistent :
 * - L-système classique : la chaîne est une simple `string` (rapide, compacte) ;
 * - L-système paramétré : la chaîne est un tableau de modules `{ s, p }` où
 *   `s` est le symbole et `p` ses paramètres numériques, ex. F(10) → { s:'F', p:[10] }.
 *
 * Les règles stochastiques (plusieurs règles pour un même symbole) sont tirées
 * selon leur poids avec un PRNG à graine : même graine ⇒ même plante.
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import { compileExpression, ExpressionError } from './expression.js';

/**
 * Limite par défaut du nombre de symboles. Au-delà, le tracé ne tient plus
 * dans la mémoire d'un téléphone (≈ 16 octets par segment) et l'onglet fige.
 */
export const MAX_SYMBOLS = 2_000_000;

/** Nombre maximal d'itérations accepté, quelle que soit la croissance. */
export const MAX_ITERATIONS = 30;

/** Erreur levée quand la chaîne dépasse la limite de symboles. */
export class LSystemLimitError extends Error {
  /**
   * @param {number} length - Longueur atteinte (ou estimée)
   * @param {number} limit - Limite autorisée
   * @param {number} iteration - Itération (1-indexée) qui dépasse
   */
  constructor(length, limit, iteration) {
    super(`La chaîne dépasse ${limit.toLocaleString('fr-FR')} symboles à l'itération ${iteration}`);
    this.name = 'LSystemLimitError';
    this.length = length;
    this.limit = limit;
    this.iteration = iteration;
  }
}

export { ExpressionError };

/**
 * @typedef {object} RuleDefinition
 * @property {string} predecessor - Symbole remplacé, ex. « F » ou « A(l,w) : l > 1 »
 * @property {string} successor - Remplacement, ex. « F+F--F+F »
 * @property {number|string} [probability] - Poids relatif (1 par défaut)
 */

/**
 * @typedef {object} SystemDefinition
 * @property {string} axiom - Chaîne initiale
 * @property {RuleDefinition[]} rules - Règles de réécriture
 */

/**
 * @typedef {object} Module
 * @property {string} s - Symbole
 * @property {number[]} p - Paramètres (vide si aucun)
 */

/**
 * Champ de l'éditeur à l'origine d'une erreur de syntaxe.
 * @typedef {{ kind: 'axiom' } | { kind: 'rule', index: number, part: 'predecessor'|'successor'|'probability' }} ErrorField
 */

/**
 * Exécute `compile` en rattachant toute erreur de syntaxe au champ indiqué
 * (sauf si une erreur plus précise l'a déjà fait).
 * @template T
 * @param {ErrorField} field - Champ concerné
 * @param {() => T} compile - Compilation
 * @returns {T}
 */
export function inField(field, compile) {
  try {
    return compile();
  } catch (error) {
    if (error instanceof ExpressionError && !error.field) {
      error.field = field;
    }
    throw error;
  }
}

/**
 * Normalise une saisie : supprime les espaces et remplace les signes
 * typographiques (−, –, →) qu'un clavier mobile insère volontiers.
 * @param {string} text - Saisie brute
 * @returns {string} Saisie normalisée
 */
export function normalizeSymbols(text) {
  return String(text ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '');
}

/**
 * Indique si le système utilise des paramètres (présence de parenthèses).
 * @param {SystemDefinition} definition - Système
 * @returns {boolean}
 */
export function isParametric(definition) {
  const texts = [definition.axiom, ...definition.rules.flatMap((rule) => [rule.predecessor, rule.successor])];
  return texts.some((text) => String(text ?? '').includes('('));
}

/**
 * Lit un poids de règle ; vide ⇒ 1.
 * @param {number|string|undefined} value - Poids saisi
 * @param {number} index - Indice de la règle (messages)
 * @returns {number}
 */
function parseWeight(value, index) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 1;
  }
  const weight = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(weight) || weight < 0) {
    throw new ExpressionError(`Règle ${index + 1} : probabilité invalide « ${value} »`);
  }
  return weight;
}

/**
 * Règles actives : on ignore les lignes dont le prédécesseur est vide,
 * ce qui permet d'ajouter une ligne dans l'éditeur sans casser le rendu.
 * @param {RuleDefinition[]} rules - Règles brutes
 * @returns {{ rule: RuleDefinition, index: number }[]}
 */
function activeRules(rules) {
  return rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => normalizeSymbols(rule.predecessor) !== '');
}

/**
 * Ajoute une alternative dans la table symbole → règles.
 * @template T
 * @param {Map<string, T[]>} table - Table à compléter
 * @param {string} symbol - Symbole
 * @param {T} entry - Alternative
 */
function addToTable(table, symbol, entry) {
  const list = table.get(symbol);
  if (list) {
    list.push(entry);
  } else {
    table.set(symbol, [entry]);
  }
}

/**
 * Compile les règles d'un L-système classique.
 * @param {RuleDefinition[]} rules - Règles
 * @returns {Map<string, { successor: string, weight: number }[]>}
 */
export function compileStringRules(rules) {
  const table = new Map();
  for (const { rule, index } of activeRules(rules)) {
    const predecessor = normalizeSymbols(rule.predecessor);
    inField({ kind: 'rule', index, part: 'predecessor' }, () => {
      if ([...predecessor].length !== 1) {
        throw new ExpressionError(`Règle ${index + 1} : le symbole à remplacer doit être un seul caractère (reçu « ${predecessor} »)`);
      }
    });
    addToTable(table, predecessor, {
      successor: normalizeSymbols(rule.successor),
      weight: inField({ kind: 'rule', index, part: 'probability' }, () => parseWeight(rule.probability, index)),
    });
  }
  return table;
}

/**
 * Tire une alternative selon les poids. Avec une seule alternative, aucun
 * nombre aléatoire n'est consommé : un système déterministe reste indépendant
 * de la graine.
 * @template {{ weight: number }} T
 * @param {T[]} alternatives - Alternatives candidates
 * @param {SeededRandom} rng - Générateur
 * @returns {T|null}
 */
export function pickWeighted(alternatives, rng) {
  if (alternatives.length === 1) {
    return alternatives[0];
  }
  const total = alternatives.reduce((sum, alt) => sum + alt.weight, 0);
  if (total <= 0) {
    return null;
  }
  let threshold = rng.random() * total;
  for (const alternative of alternatives) {
    threshold -= alternative.weight;
    if (threshold < 0) {
      return alternative;
    }
  }
  return alternatives[alternatives.length - 1];
}

/**
 * Réécrit une chaîne classique une fois.
 * @param {string} input - Chaîne courante
 * @param {Map<string, { successor: string, weight: number }[]>} table - Règles
 * @param {SeededRandom} rng - Générateur
 * @param {{ limit: number, iteration: number }} guard - Garde-fou
 * @returns {string}
 */
function rewriteString(input, table, rng, guard) {
  const parts = [];
  let length = 0;
  for (const symbol of input) {
    const alternatives = table.get(symbol);
    const chosen = alternatives ? pickWeighted(alternatives, rng) : null;
    const output = chosen ? chosen.successor : symbol;
    length += output.length;
    if (length > guard.limit) {
      throw new LSystemLimitError(length, guard.limit, guard.iteration);
    }
    parts.push(output);
  }
  return parts.join('');
}

/**
 * Découpe une suite de modules « A(1,2)F(3)+ » en symboles et listes
 * d'arguments textuels (les virgules imbriquées dans des parenthèses
 * appartiennent à l'expression, ex. max(a,b)).
 * @param {string} text - Texte normalisé
 * @returns {{ s: string, args: string[] }[]}
 */
export function splitModules(text) {
  const modules = [];
  const chars = [...text];
  let index = 0;
  while (index < chars.length) {
    const symbol = chars[index++];
    if (symbol === '(' || symbol === ')' || symbol === ',') {
      throw new ExpressionError(`« ${symbol} » inattendu dans « ${text} »`);
    }
    let args = [];
    if (chars[index] === '(') {
      const closing = findClosing(chars, index, text);
      args = splitArguments(chars.slice(index + 1, closing).join(''));
      index = closing + 1;
    }
    modules.push({ s: symbol, args });
  }
  return modules;
}

/**
 * Trouve la parenthèse fermante correspondante.
 * @param {string[]} chars - Caractères
 * @param {number} opening - Indice de « ( »
 * @param {string} text - Texte (messages)
 * @returns {number}
 */
function findClosing(chars, opening, text) {
  let depth = 0;
  for (let i = opening; i < chars.length; i++) {
    if (chars[i] === '(') {depth++;}
    if (chars[i] === ')') {depth--;}
    if (depth === 0) {return i;}
  }
  throw new ExpressionError(`Parenthèse non fermée dans « ${text} »`);
}

/**
 * Sépare les arguments au premier niveau de parenthèses.
 * @param {string} inner - Contenu entre parenthèses
 * @returns {string[]}
 */
function splitArguments(inner) {
  const args = [];
  let depth = 0;
  let current = '';
  for (const char of inner) {
    if (char === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }
    if (char === '(') {depth++;}
    if (char === ')') {depth--;}
    current += char;
  }
  args.push(current);
  if (args.some((arg) => arg === '')) {
    throw new ExpressionError(`Argument vide dans « (${inner}) »`);
  }
  return args;
}

/**
 * Évalue un axiome paramétré (arguments constants).
 * @param {string} axiom - Axiome, ex. « A(100,1) »
 * @returns {Module[]}
 */
export function parseModules(axiom) {
  return splitModules(normalizeSymbols(axiom)).map(({ s, args }) => ({
    s,
    p: args.map((arg) => compileExpression(arg, [])({})),
  }));
}

/**
 * Compile le prédécesseur « A(l,w) : condition » d'une règle paramétrée.
 * @param {string} text - Prédécesseur brut
 * @param {number} index - Indice de règle (messages)
 * @returns {{ symbol: string, names: string[], condition: ((scope: object) => number)|null }}
 */
function compilePredecessor(text, index) {
  const normalized = normalizeSymbols(text);
  const colon = normalized.indexOf(':');
  const head = colon === -1 ? normalized : normalized.slice(0, colon);
  const conditionText = colon === -1 ? '' : normalized.slice(colon + 1);
  const modules = splitModules(head);
  if (modules.length !== 1) {
    throw new ExpressionError(`Règle ${index + 1} : un seul module attendu à gauche (reçu « ${head} »)`);
  }
  const names = modules[0].args;
  if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) {
    throw new ExpressionError(`Règle ${index + 1} : paramètres formels invalides dans « ${head} »`);
  }
  const condition = conditionText ? compileExpression(conditionText, names) : null;
  return { symbol: modules[0].s, names, condition };
}

/**
 * Compile les règles d'un L-système paramétré.
 * @param {RuleDefinition[]} rules - Règles
 * @returns {Map<string, object[]>} Table symbole → règles compilées
 */
export function compileParametricRules(rules) {
  const table = new Map();
  for (const { rule, index } of activeRules(rules)) {
    const predecessor = inField({ kind: 'rule', index, part: 'predecessor' }, () => compilePredecessor(rule.predecessor, index));
    const successor = inField({ kind: 'rule', index, part: 'successor' }, () => splitModules(normalizeSymbols(rule.successor)).map(({ s, args }) => ({
      s,
      args: args.map((arg) => compileExpression(arg, predecessor.names)),
    })));
    addToTable(table, predecessor.symbol, {
      ...predecessor,
      successor,
      weight: inField({ kind: 'rule', index, part: 'probability' }, () => parseWeight(rule.probability, index)),
    });
  }
  return table;
}

/**
 * Construit la portée { nom: valeur } d'un module pour une règle.
 * @param {string[]} names - Paramètres formels
 * @param {number[]} values - Valeurs effectives
 * @returns {Record<string, number>}
 */
function bindScope(names, values) {
  const scope = Object.create(null);
  names.forEach((name, i) => {
    scope[name] = values[i];
  });
  return scope;
}

/**
 * Règles applicables à un module : même symbole, même arité, condition vraie.
 * @param {Module} module - Module courant
 * @param {object[]} candidates - Règles du symbole
 * @returns {{ rule: object, scope: Record<string, number>, weight: number }[]}
 */
function applicableRules(module, candidates) {
  const matches = [];
  for (const rule of candidates) {
    if (rule.names.length !== module.p.length) {
      continue;
    }
    const scope = bindScope(rule.names, module.p);
    if (!rule.condition || rule.condition(scope)) {
      matches.push({ rule, scope, weight: rule.weight });
    }
  }
  return matches;
}

/**
 * Réécrit une suite de modules une fois.
 * @param {Module[]} input - Modules courants
 * @param {Map<string, object[]>} table - Règles compilées
 * @param {SeededRandom} rng - Générateur
 * @param {{ limit: number, iteration: number }} guard - Garde-fou
 * @returns {Module[]}
 */
function rewriteModules(input, table, rng, guard) {
  const output = [];
  for (const module of input) {
    const candidates = table.get(module.s);
    const matches = candidates ? applicableRules(module, candidates) : [];
    const chosen = matches.length > 0 ? pickWeighted(matches, rng) : null;
    if (chosen) {
      for (const item of chosen.rule.successor) {
        output.push({ s: item.s, p: item.args.map((arg) => arg(chosen.scope)) });
      }
    } else {
      output.push(module);
    }
    if (output.length > guard.limit) {
      throw new LSystemLimitError(output.length, guard.limit, guard.iteration);
    }
  }
  return output;
}

/**
 * @typedef {object} ExpandResult
 * @property {boolean} parametric - Représentation paramétrée ?
 * @property {string|Module[]} result - Chaîne finale
 * @property {number} length - Nombre de symboles
 * @property {number[]} lengths - Longueur après chaque itération (indice 0 = axiome)
 */

/**
 * Développe un L-système sur `iterations` étapes.
 * @param {SystemDefinition} definition - Axiome et règles
 * @param {number} iterations - Nombre d'itérations (≥ 0)
 * @param {{ seed?: number, maxLength?: number }} [options] - Graine et limite
 * @returns {ExpandResult}
 * @throws {LSystemLimitError} Si la chaîne dépasse `maxLength`
 * @throws {ExpressionError} Si une règle est invalide
 */
export function expand(definition, iterations, options = {}) {
  const { seed = 1, maxLength = MAX_SYMBOLS } = options;
  const rng = new SeededRandom(seed);
  const parametric = isParametric(definition);
  const table = parametric ? compileParametricRules(definition.rules) : compileStringRules(definition.rules);
  const rewrite = parametric ? rewriteModules : rewriteString;
  let current = parametric
    ? inField({ kind: 'axiom' }, () => parseModules(definition.axiom))
    : normalizeSymbols(definition.axiom);
  if (current.length > maxLength) {
    throw new LSystemLimitError(current.length, maxLength, 0);
  }
  const lengths = [current.length];
  for (let iteration = 1; iteration <= iterations; iteration++) {
    current = rewrite(current, table, rng, { limit: maxLength, iteration });
    lengths.push(current.length);
  }
  return { parametric, result: current, length: current.length, lengths };
}

/**
 * Compte les occurrences de chaque symbole.
 * @param {string[]} symbols - Symboles
 * @returns {Map<string, number>}
 */
function countSymbols(symbols) {
  const counts = new Map();
  for (const symbol of symbols) {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  return counts;
}

/**
 * Pour chaque symbole réécrit, compte de symboles produits par son plus long
 * successeur. Majorant volontaire : en stochastique ou avec conditions, la
 * vraie longueur ne peut pas dépasser cette estimation.
 * @param {SystemDefinition} definition - Système
 * @returns {Map<string, Map<string, number>>}
 */
function worstSuccessors(definition) {
  const parametric = isParametric(definition);
  const worst = new Map();
  for (const { rule, index } of activeRules(definition.rules)) {
    const head = normalizeSymbols(rule.predecessor).split(':')[0];
    const symbol = parametric ? inField({ kind: 'rule', index, part: 'predecessor' }, () => splitModules(head)[0].s) : head;
    const successor = normalizeSymbols(rule.successor);
    const symbols = parametric ? inField({ kind: 'rule', index, part: 'successor' }, () => splitModules(successor).map((m) => m.s)) : [...successor];
    const previous = worst.get(symbol);
    const total = (counts) => [...counts.values()].reduce((a, b) => a + b, 0);
    const counts = countSymbols(symbols);
    if (!previous || total(counts) > total(previous)) {
      worst.set(symbol, counts);
    }
  }
  return worst;
}

/**
 * Majore la longueur de la chaîne à chaque itération, sans la construire :
 * on fait évoluer un simple histogramme de symboles. Coût négligeable même
 * pour des milliards de symboles, ce qui permet de refuser d'avance un calcul
 * qui figerait l'onglet et d'indiquer le nombre d'itérations encore possible.
 * @param {SystemDefinition} definition - Système
 * @param {number} iterations - Itérations demandées
 * @returns {number[]} Majorants (indice 0 = axiome) ; peut contenir Infinity
 */
export function estimateLengths(definition, iterations) {
  const worst = worstSuccessors(definition);
  const axiom = normalizeSymbols(definition.axiom);
  let counts = countSymbols(isParametric(definition) ? inField({ kind: 'axiom' }, () => splitModules(axiom).map((m) => m.s)) : [...axiom]);
  const sum = (map) => [...map.values()].reduce((a, b) => a + b, 0);
  const lengths = [sum(counts)];
  for (let i = 1; i <= iterations; i++) {
    const next = new Map();
    for (const [symbol, count] of counts) {
      const produced = worst.get(symbol) ?? new Map([[symbol, 1]]);
      for (const [child, times] of produced) {
        next.set(child, (next.get(child) ?? 0) + count * times);
      }
    }
    counts = next;
    lengths.push(sum(counts));
  }
  return lengths;
}

/**
 * Plus grand nombre d'itérations dont le majorant reste sous la limite.
 * @param {SystemDefinition} definition - Système
 * @param {number} [limit] - Limite de symboles
 * @param {number} [cap] - Plafond d'itérations
 * @returns {number} Nombre d'itérations sûr (peut valoir `cap`)
 */
export function maxSafeIterations(definition, limit = MAX_SYMBOLS, cap = MAX_ITERATIONS) {
  const lengths = estimateLengths(definition, cap);
  const firstOver = lengths.findIndex((length) => length > limit);
  return firstOver === -1 ? cap : Math.max(0, firstOver - 1);
}
