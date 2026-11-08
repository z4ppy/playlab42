/**
 * Fabriques de positions construites à la main pour les tests du Solitaire.
 * Les cartes s'écrivent avec leurs codes (`'7H'`) ; seules les piles utiles
 * sont précisées, les autres restent vides.
 */

import { RANKS, SUITS } from '../engine/cards.js';
import { SolitaireEngine } from '../engine.js';

export const PLAYER = 'joueur';

/**
 * Colonne de tableau.
 * @param {string[]} up - Cartes visibles (la dernière est accessible)
 * @param {string[]} [down] - Cartes cachées
 */
export function column(up, down = []) {
  return { down, up };
}

/** Fondation de l'enseigne `suit` montée jusqu'au rang `height`. */
export function foundation(suit, height) {
  return RANKS.slice(0, height).map(rank => `${rank}${suit}`);
}

/**
 * Plateau minimal : sept colonnes (vides par défaut) et quatre fondations.
 * @param {object} parts - `tableau` (colonnes 0, 1…), `stock`, `waste`, `heights`, `drawCount`
 */
export function board({ tableau = [], stock = [], waste = [], heights = [0, 0, 0, 0], drawCount = 1 } = {}) {
  return {
    drawCount,
    tableau: Array.from({ length: 7 }, (_, index) => tableau[index] ?? column([])),
    stock,
    waste,
    foundations: SUITS.map((suit, index) => foundation(suit, heights[index])),
  };
}

/** État moteur valide (issu de `init`) dont on remplace le plateau. */
export function stateWith(customBoard, overrides = {}) {
  const engine = new SolitaireEngine();
  const base = engine.init({ seed: 1, playerIds: [PLAYER], options: { drawCount: customBoard.drawCount } });
  return { ...base, board: customBoard, ...overrides };
}

/** Coup `move` lisible dans les tests. */
export function move(from, to, count = 1) {
  return { type: 'move', from, to, count };
}
