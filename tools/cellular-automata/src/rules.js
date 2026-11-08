/**
 * Règles des automates cellulaires : élémentaires (Wolfram) et « type Life ».
 *
 * Module pur, sans DOM : il est partagé par l'interface et les tests.
 */

/** Règles élémentaires célèbres proposées en raccourci. */
export const FAMOUS_ELEMENTARY_RULES = Object.freeze([
  { rule: 30, label: 'Chaos (générateur pseudo-aléatoire)' },
  { rule: 90, label: 'Triangle de Sierpiński' },
  { rule: 110, label: 'Turing-complète' },
  { rule: 184, label: 'Trafic routier' },
  { rule: 45, label: 'Chaos asymétrique' },
  { rule: 150, label: 'Sierpiński dense (XOR à 3)' },
]);

/** Règles 2D prédéfinies, en notation B/S canonique. */
export const LIFE_PRESETS = Object.freeze([
  { id: 'conway', name: 'Conway (Jeu de la vie)', notation: 'B3/S23' },
  { id: 'highlife', name: 'HighLife', notation: 'B36/S23' },
  { id: 'seeds', name: 'Seeds', notation: 'B2/S' },
  { id: 'day-night', name: 'Jour & Nuit', notation: 'B3678/S34678' },
  { id: 'replicator', name: 'Réplicateur', notation: 'B1357/S1357' },
  { id: 'maze', name: 'Labyrinthe', notation: 'B3/S12345' },
  { id: 'coral', name: 'Corail', notation: 'B3/S45678' },
  { id: 'diamoeba', name: 'Diamoeba', notation: 'B35678/S5678' },
  { id: 'anneal', name: 'Recuit (Anneal)', notation: 'B4678/S35678' },
  { id: 'life-without-death', name: 'Vie sans mort', notation: 'B3/S012345678' },
]);

/**
 * Vérifie qu'un numéro de règle élémentaire est un entier de 0 à 255.
 * @param {unknown} rule
 * @returns {rule is number}
 */
export function isValidElementaryRule(rule) {
  return Number.isInteger(rule) && /** @type {number} */ (rule) >= 0 && /** @type {number} */ (rule) <= 255;
}

/**
 * Sortie de la règle pour chacun des 8 motifs de voisinage.
 * L'indice est la valeur binaire du motif (gauche·4 + centre·2 + droite) :
 * la règle 30 = 00011110₂ donne la cellule vivante pour les motifs 1, 2, 3 et 4.
 * @param {number} rule - Numéro de Wolfram (0-255)
 * @returns {number[]} 8 valeurs 0/1, indexées par motif
 */
export function elementaryOutputs(rule) {
  const outputs = [];
  for (let pattern = 0; pattern < 8; pattern++) {
    outputs.push((rule >> pattern) & 1);
  }
  return outputs;
}

/**
 * Inverse la sortie d'un motif : c'est l'édition de règle « au doigt ».
 * @param {number} rule - Numéro de Wolfram (0-255)
 * @param {number} pattern - Motif 0-7
 * @returns {number} Nouveau numéro de règle
 */
export function toggleElementaryPattern(rule, pattern) {
  return (rule ^ (1 << pattern)) & 0xff;
}

/**
 * Calcule la génération suivante d'un automate élémentaire sur un anneau
 * (la cellule de gauche du bord gauche est la dernière de la ligne).
 * @param {Uint8Array} row - Ligne courante (0/1)
 * @param {number} rule - Numéro de Wolfram
 * @param {Uint8Array} [out] - Tampon de sortie réutilisable, de même longueur
 * @returns {Uint8Array} La ligne suivante (`out` si fourni)
 */
export function stepElementary(row, rule, out = new Uint8Array(row.length)) {
  const width = row.length;
  for (let x = 0; x < width; x++) {
    const left = row[x === 0 ? width - 1 : x - 1];
    const right = row[x === width - 1 ? 0 : x + 1];
    const pattern = (left << 2) | (row[x] << 1) | right;
    out[x] = (rule >> pattern) & 1;
  }
  return out;
}

/**
 * Règle de type Life : ensembles de voisinages provoquant naissance et survie.
 * @typedef {object} LifeRule
 * @property {number[]} birth - Nombres de voisins (0-8) faisant naître une cellule
 * @property {number[]} survive - Nombres de voisins (0-8) gardant une cellule en vie
 */

/**
 * Résultat d'analyse d'une notation B/S.
 * @typedef {{ rule: LifeRule, error: null } | { rule: null, error: string }} LifeRuleParse
 */

const BS_NOTATION = /^B([0-8]*)\/?S([0-8]*)$/;
const SB_EXPLICIT_NOTATION = /^S([0-8]*)\/?B([0-8]*)$/;
const SB_NOTATION = /^([0-8]*)\/([0-8]*)$/;

/**
 * Convertit une liste de chiffres en ensemble trié et sans doublon.
 * @param {string} digits
 * @returns {number[]}
 */
function digitsToSet(digits) {
  return [...new Set([...digits].map(Number))].sort((a, b) => a - b);
}

/**
 * Analyse une notation de règle Life. Formats acceptés (insensibles à la casse
 * et aux espaces) : « B3/S23 », « B3S23 », « S23/B3 » et la notation historique
 * S/B « 23/3 ».
 * @param {string} text
 * @returns {LifeRuleParse}
 */
export function parseLifeRule(text) {
  const compact = String(text ?? '').replace(/\s+/g, '').toUpperCase();
  if (compact === '') {
    return { rule: null, error: 'Règle vide : écrivez par exemple B3/S23.' };
  }
  const bs = BS_NOTATION.exec(compact);
  if (bs) {
    return { rule: { birth: digitsToSet(bs[1]), survive: digitsToSet(bs[2]) }, error: null };
  }
  const sbExplicit = SB_EXPLICIT_NOTATION.exec(compact);
  if (sbExplicit) {
    return { rule: { birth: digitsToSet(sbExplicit[2]), survive: digitsToSet(sbExplicit[1]) }, error: null };
  }
  const sb = SB_NOTATION.exec(compact);
  if (sb) {
    return { rule: { birth: digitsToSet(sb[2]), survive: digitsToSet(sb[1]) }, error: null };
  }
  if (/[9]/.test(compact)) {
    return { rule: null, error: 'Une cellule a au plus 8 voisins : chiffres de 0 à 8 uniquement.' };
  }
  return { rule: null, error: 'Notation attendue : B (naissance) puis S (survie), par exemple B36/S23.' };
}

/**
 * Écrit une règle en notation canonique « B…/S… ».
 * @param {LifeRule} rule
 * @returns {string}
 */
export function formatLifeRule(rule) {
  return `B${rule.birth.join('')}/S${rule.survive.join('')}`;
}

/**
 * Table de transition plate pour la boucle de simulation :
 * `table[vivante * 9 + voisins]` vaut 1 si la cellule est vivante ensuite.
 * @param {LifeRule} rule
 * @returns {Uint8Array} 18 entrées
 */
export function lifeRuleTable(rule) {
  const table = new Uint8Array(18);
  for (const n of rule.birth) {
    table[n] = 1;
  }
  for (const n of rule.survive) {
    table[9 + n] = 1;
  }
  return table;
}

/**
 * Énumère des nombres en français : « 2 », « 2 ou 3 », « 1, 3 ou 5 ».
 * @param {number[]} values
 * @returns {string}
 */
function listCounts(values) {
  if (values.length <= 1) {
    return values.join('');
  }
  return `${values.slice(0, -1).join(', ')} ou ${values[values.length - 1]}`;
}

/**
 * Phrase explicative d'une règle B/S.
 * @param {LifeRule} rule
 * @returns {string}
 */
export function describeLifeRule(rule) {
  const birth = rule.birth.length > 0 ? `Naissance avec ${listCounts(rule.birth)} voisines` : 'Aucune naissance';
  const survive = rule.survive.length > 0 ? `survie avec ${listCounts(rule.survive)}` : 'aucune survie';
  return `${birth}, ${survive}.`;
}

/**
 * Nom lisible d'une notation si elle correspond à un préréglage.
 * @param {string} notation - Notation canonique
 * @returns {string|null}
 */
export function lifePresetName(notation) {
  const preset = LIFE_PRESETS.find((p) => p.notation === notation);
  return preset ? preset.name : null;
}
