/**
 * Cartes du Solitaire : codes, rangs, couleurs et noms français.
 *
 * Une carte est un code de deux caractères, rang puis enseigne, par exemple
 * `'TH'` pour le 10 de cœur ou `'QS'` pour la dame de pique. Ce format reste
 * lisible dans un état JSON et dans un test, tout en se comparant par `===`.
 *
 * Rangs : A 2 3 4 5 6 7 8 9 T J Q K (as = 1, roi = 13).
 * Enseignes : S pique, H cœur, C trèfle, D carreau. Cet ordre alterne les
 * couleurs ; il fixe aussi l'indice de chaque fondation.
 *
 * @module games/solitaire/engine/cards
 */

/** Enseignes dans l'ordre des fondations (alternance noir/rouge). */
export const SUITS = Object.freeze(['S', 'H', 'C', 'D']);

/** Rangs dans l'ordre croissant : l'indice + 1 donne la valeur. */
export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']);

/** Rang du roi, seule carte autorisée sur une colonne vide. */
export const KING = 13;

const RED_SUITS = new Set(['H', 'D']);

/** Libellés français affichés dans un coin de carte (V, D, R comme un jeu français). */
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

/** Noms complets avec article défini, pour les phrases d'indice et les annonces. */
const RANK_NAMES = [
  'l’as', 'le 2', 'le 3', 'le 4', 'le 5', 'le 6', 'le 7', 'le 8', 'le 9', 'le 10',
  'le valet', 'la dame', 'le roi',
];

const SUIT_NAMES = Object.freeze({ S: 'pique', H: 'cœur', C: 'trèfle', D: 'carreau' });

/**
 * @typedef {Object} CardInfo
 * @property {string} code - Code de la carte (`'7H'`)
 * @property {number} rank - Valeur de 1 (as) à 13 (roi)
 * @property {string} suit - Enseigne (`'S'`, `'H'`, `'C'` ou `'D'`)
 * @property {number} suitIndex - Indice de la fondation de cette enseigne
 * @property {boolean} red - Vrai pour cœur et carreau
 */

/** Table figée code → informations : une seule source pour toutes les règles. */
const CARD_INFO = new Map();
SUITS.forEach((suit, suitIndex) => {
  RANKS.forEach((rankCode, index) => {
    const code = `${rankCode}${suit}`;
    CARD_INFO.set(code, Object.freeze({ code, rank: index + 1, suit, suitIndex, red: RED_SUITS.has(suit) }));
  });
});

/**
 * Indique si une valeur est un code de carte connu.
 * @param {unknown} code - Valeur à tester
 * @returns {boolean}
 */
export function isCard(code) {
  return typeof code === 'string' && CARD_INFO.has(code);
}

/**
 * Informations d'une carte.
 * @param {string} code - Code de la carte
 * @returns {CardInfo}
 * @throws {Error} Si le code n'est pas une carte
 */
export function cardInfo(code) {
  const info = CARD_INFO.get(code);
  if (!info) {
    throw new Error(`Carte inconnue : ${String(code)}`);
  }
  return info;
}

/**
 * Jeu complet de 52 cartes, enseigne par enseigne, de l'as au roi.
 * @returns {string[]} Nouveau tableau (le mélange peut le muter)
 */
export function createDeck() {
  return [...CARD_INFO.keys()];
}

/**
 * Règle du tableau : une carte se pose sur une carte de rang immédiatement
 * supérieur et de couleur opposée ; seul un roi occupe une colonne vide.
 * @param {string} card - Carte déplacée (la plus haute d'une séquence)
 * @param {string|undefined} target - Carte d'arrivée, ou `undefined` si la colonne est vide
 * @returns {boolean}
 */
export function canStack(card, target) {
  const moving = cardInfo(card);
  if (target === undefined) {
    return moving.rank === KING;
  }
  const below = cardInfo(target);
  return moving.rank === below.rank - 1 && moving.red !== below.red;
}

/**
 * Règle des fondations : chaque enseigne monte de l'as au roi sur sa propre pile.
 * @param {string} card - Carte à poser
 * @param {number} foundationIndex - Indice de la fondation visée
 * @param {string[]} foundation - Cartes déjà posées sur cette fondation
 * @returns {boolean}
 */
export function canFound(card, foundationIndex, foundation) {
  const info = cardInfo(card);
  return info.suitIndex === foundationIndex && info.rank === foundation.length + 1;
}

/**
 * Libellés courts pour dessiner une carte.
 * @param {string} code - Code de la carte
 * @returns {{rank: string, suit: string, red: boolean}}
 */
export function cardLabel(code) {
  const info = cardInfo(code);
  return { rank: RANK_LABELS[info.rank - 1], suit: info.suit, red: info.red };
}

/**
 * Nom français avec article : « la dame de cœur », « l’as de pique ».
 * @param {string} code - Code de la carte
 * @returns {string}
 */
export function cardName(code) {
  const info = cardInfo(code);
  return `${RANK_NAMES[info.rank - 1]} de ${SUIT_NAMES[info.suit]}`;
}

/**
 * Nom français d'une enseigne (« cœur »).
 * @param {number} suitIndex - Indice de fondation
 * @returns {string}
 */
export function suitName(suitIndex) {
  return SUIT_NAMES[SUITS[suitIndex]];
}
