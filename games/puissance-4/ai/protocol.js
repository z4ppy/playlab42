/**
 * Protocole de messages entre la page et le Web Worker de l'IA.
 *
 * Toute la logique vit dans `handleAiRequest`, une fonction pure du message
 * reçu : le worker se contente de la relayer, et le repli sans worker l'appelle
 * directement. On la teste donc entièrement hors navigateur.
 *
 * Requêtes :
 *   { id, kind: 'analyze', view, budget? }           → { id, ok: true, analysis }
 *   { id, kind: 'move', view, level, rngState }      → { id, ok: true, action, rngState, analysis? }
 * Erreur : { id, ok: false, error } (message en français, jamais d'exception).
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import { COLORS, COLUMNS, ROWS } from '../engine/board.js';
import { Puissance4Engine } from '../engine.js';
import { LEVELS, isLevel } from '../bots/levels.js';
import { analyzeView } from './advisor.js';

const engine = new Puissance4Engine();

/** Budget de l'évaluation affichée après chaque coup : plus léger que l'indice. */
export const EVALUATION_BUDGET = Object.freeze({ maxNodes: 250_000 });

/**
 * Vérifie qu'une ligne de la grille ne contient que des cases connues.
 * @param {unknown} line - Ligne reçue
 * @returns {boolean}
 */
const isBoardLine = (line) => Array.isArray(line) && line.length === COLUMNS
  && line.every((cell) => cell === null || COLORS.includes(cell));

/**
 * Grille 6 × 7 respectant la gravité : aucune case vide sous un jeton.
 * Les bitboards de l'IA supposent des colonnes remplies depuis le bas.
 * @param {unknown} board - Grille reçue
 * @returns {boolean}
 */
function isBoard(board) {
  if (!Array.isArray(board) || board.length !== ROWS || !board.every(isBoardLine)) {
    return false;
  }
  return board.slice(1).every((line, index) => line.every((cell, col) => cell !== null || board[index][col] === null));
}

/**
 * Contrôle la forme d'une vue reçue d'un autre contexte (le worker ne fait
 * confiance à rien) : grille 6 × 7, joueur au trait coloré, partie en cours.
 * @param {any} view - Vue reçue
 * @returns {void}
 * @throws {Error} Si la vue est inutilisable
 */
function assertPlayableView(view) {
  const valid = view !== null && typeof view === 'object' && isBoard(view.board)
    && COLORS.includes(view.colors?.[view.currentPlayerId]);
  if (!valid) {
    throw new Error('Vue de partie invalide.');
  }
  if (view.gameOver || engine.getValidActions(view, view.currentPlayerId).length === 0) {
    throw new Error('La partie est terminée : aucun coup à analyser.');
  }
}

/**
 * Lit un budget optionnel en ne gardant que des entiers positifs.
 * @param {unknown} budget - Budget reçu
 * @returns {import('./search.js').SearchBudget | undefined}
 */
function readBudget(budget) {
  if (budget === undefined) {
    return undefined;
  }
  const { maxDepth, maxNodes } = /** @type {any} */ (budget) ?? {};
  const positive = (value) => value === undefined || (Number.isInteger(value) && value > 0);
  if (!positive(maxDepth) || !positive(maxNodes)) {
    throw new Error('Budget de recherche invalide.');
  }
  return { maxDepth, maxNodes };
}

/**
 * Demande « move » : le bot du niveau choisit un coup avec le RNG transmis.
 * @param {any} request - Requête validée pour la vue
 * @returns {object} Charge utile de la réponse
 */
function chooseMove(request) {
  if (!isLevel(request.level) || !Number.isInteger(request.rngState)) {
    throw new Error('Niveau ou état du générateur aléatoire invalide.');
  }
  const bot = LEVELS[request.level].create();
  const rng = SeededRandom.fromState(request.rngState);
  const validActions = engine.getValidActions(request.view, request.view.currentPlayerId);
  const choice = bot.chooseWithAnalysis
    ? bot.chooseWithAnalysis(request.view, validActions, rng)
    : { action: bot.chooseAction(request.view, validActions, rng) };
  return { ...choice, rngState: rng.getState() };
}

/** Traitement de chaque type de requête. */
const HANDLERS = {
  analyze: (request) => ({ analysis: analyzeView(request.view, readBudget(request.budget) ?? EVALUATION_BUDGET) }),
  move: chooseMove,
};

/**
 * Traite une requête et renvoie toujours une réponse (succès ou erreur).
 * @param {any} request - Message reçu
 * @returns {{ id: number | null, ok: boolean, error?: string }} Réponse sérialisable
 */
export function handleAiRequest(request) {
  const id = Number.isInteger(request?.id) ? request.id : null;
  try {
    const handler = Object.hasOwn(HANDLERS, request?.kind) ? HANDLERS[request.kind] : null;
    if (id === null || !handler) {
      throw new Error('Requête IA inconnue.');
    }
    assertPlayableView(request.view);
    return { id, ok: true, ...handler(request) };
  } catch (error) {
    return { id, ok: false, error: error.message };
  }
}
