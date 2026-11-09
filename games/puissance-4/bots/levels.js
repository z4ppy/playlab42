/**
 * Niveaux proposés dans l'interface, chacun associé à un bot et à son budget.
 * Les noms de bots correspondent à ceux déclarés dans game.json.
 */

import { GreedyBot } from './greedy.js';
import { MinimaxBot } from './minimax.js';
import { RandomBot } from './random.js';

/**
 * @typedef {Object} Level
 * @property {string} label - Libellé affiché
 * @property {number} points - Points enregistrés en cas de victoire humaine
 * @property {() => { chooseAction: Function, chooseWithAnalysis?: Function }} create - Fabrique du bot
 */

/** @type {Readonly<Record<string, Level>>} */
export const LEVELS = Object.freeze({
  facile: { label: 'Facile', points: 1, create: () => new RandomBot() },
  moyen: { label: 'Moyen', points: 2, create: () => new GreedyBot() },
  // Minimax volontairement myope : 4 coups d'anticipation seulement.
  difficile: { label: 'Difficile', points: 3, create: () => new MinimaxBot({ maxDepth: 4, maxNodes: 50_000 }) },
  expert: { label: 'Expert', points: 5, create: () => new MinimaxBot() },
});

/**
 * Indique si un identifiant de niveau existe.
 * @param {unknown} level - Valeur à contrôler
 * @returns {level is keyof typeof LEVELS}
 */
export function isLevel(level) {
  return typeof level === 'string' && Object.hasOwn(LEVELS, level);
}
