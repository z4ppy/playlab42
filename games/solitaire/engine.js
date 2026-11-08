/**
 * Moteur du Solitaire (Klondike) - isomorphe, pur et déterministe.
 *
 * Il implémente le contrat `GameEngine` du lab (`lib/types/game-engine.ts`) :
 * aucune lecture du DOM, du stockage, du réseau ni de l'horloge ; l'état est
 * un objet JSON ; une même seed et les mêmes actions donnent les mêmes états.
 *
 * Règles : sept colonnes, talon, défausse, quatre fondations par enseigne.
 * Pioche de 1 ou 3 cartes, recyclage illimité de la défausse, retour d'une
 * carte de fondation vers le tableau autorisé (−15 points). Une carte cachée
 * découverte est retournée automatiquement.
 *
 * Annuler/refaire n'est pas une action du moteur : l'état étant du JSON
 * immuable, le client garde simplement la pile des états précédents. Le moteur
 * reste une fonction de transition, et un replay se réduit à la liste des
 * actions réellement jouées.
 *
 * @see lib/types/game-engine.ts
 * @module games/solitaire/engine
 */

import { MAX_DEAL_NUMBER, dealBoard } from './engine/deal.js';
import { applyMove, isLegalMove, isWon, listMoves } from './engine/rules.js';
import { nextScore } from './engine/scoring.js';
import { findWinnableDeal } from './engine/winnable.js';

/** Identifiant du joueur quand la configuration n'en fournit pas. */
export const DEFAULT_PLAYER_ID = 'joueur';

/**
 * @typedef {import('./engine/rules.js').Board} Board
 * @typedef {import('./engine/rules.js').SolitaireAction} SolitaireAction
 *
 * @typedef {Object} SolitaireConfig
 * @property {number} seed - Numéro de donne demandé, entier 32 bits non signé
 * @property {[string]} [playerIds] - Un seul joueur (défaut `['joueur']`)
 * @property {{drawCount?: 1|3, winnableOnly?: boolean}} [options]
 *
 * @typedef {Object} SolitaireState
 * @property {1} version - Version du format d'état
 * @property {string} playerId - Seul joueur de la partie
 * @property {number} requestedDeal - Numéro de donne demandé
 * @property {number} dealNumber - Numéro réellement distribué (rejouable tel quel)
 * @property {boolean} winnableOnly - L'option « donnes gagnables » était active
 * @property {boolean|null} winnable - `true` si prouvée gagnable, `null` si non vérifiée
 * @property {Board} board - Plateau complet, cartes cachées comprises
 * @property {number} score - Score courant (jamais négatif)
 * @property {number} moves - Actions jouées, pioches comprises
 * @property {number} passMoves - Coups (hors pioche) depuis le dernier recyclage
 * @property {number} stalePasses - Tours de talon complets consécutifs sans aucun coup
 * @property {boolean} gameOver
 * @property {string[]|null} winners - `[playerId]` si gagné, `null` sinon
 * @property {number} rngState - État du générateur après le mélange
 *
 * @typedef {Object} SolitaireView
 * @property {string} playerId
 * @property {number} dealNumber
 * @property {1|3} drawCount
 * @property {boolean|null} winnable
 * @property {{downCount: number, up: string[]}[]} tableau - Cartes cachées réduites à leur nombre
 * @property {number} stockCount - Taille du talon, jamais son contenu ni son ordre
 * @property {string[]} waste - Défausse, cartes déjà retournées face visible
 * @property {string[][]} foundations
 * @property {number} score
 * @property {number} moves
 * @property {number} passMoves
 * @property {number} stalePasses
 * @property {boolean} gameOver
 * @property {string[]|null} winners
 */

/** @param {unknown} seed @returns {number} Numéro de donne validé */
function readSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_DEAL_NUMBER) {
    throw new Error(`Seed invalide : entier attendu entre 0 et ${MAX_DEAL_NUMBER}.`);
  }
  return seed;
}

/** @param {unknown} playerIds @returns {string} Identifiant de l'unique joueur */
function readPlayer(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length !== 1 || typeof playerIds[0] !== 'string') {
    throw new Error('Le Solitaire se joue avec exactement un joueur.');
  }
  return playerIds[0];
}

/** @param {unknown} drawCount @returns {1|3} Mode de pioche validé */
function readDrawCount(drawCount) {
  if (drawCount !== 1 && drawCount !== 3) {
    throw new Error('Pioche invalide : 1 ou 3 cartes.');
  }
  return drawCount;
}

/**
 * Lit et valide la configuration ; toute valeur douteuse est refusée.
 * @param {SolitaireConfig} config
 * @returns {{seed: number, playerId: string, drawCount: 1|3, winnableOnly: boolean}}
 */
function readConfig(config) {
  const { seed, playerIds = [DEFAULT_PLAYER_ID], options = {} } = config ?? {};
  return {
    seed: readSeed(seed),
    playerId: readPlayer(playerIds),
    drawCount: readDrawCount(options.drawCount ?? 1),
    winnableOnly: options.winnableOnly === true,
  };
}

/**
 * Vérifie la forme d'une action reçue, sans juger de sa légalité.
 * @param {unknown} action
 * @returns {boolean}
 */
function isWellFormed(action) {
  if (action === null || typeof action !== 'object' || Array.isArray(action)) {
    return false;
  }
  if (action.type === 'draw' || action.type === 'recycle') {
    return Object.keys(action).length === 1;
  }
  return action.type === 'move' && typeof action.from === 'string' && typeof action.to === 'string'
    && Number.isInteger(action.count);
}

/**
 * Suivi des tours de talon : il permet à l'IA (et au joueur) de savoir que
 * repiocher ne montrerait rien de nouveau. Ce compteur découle des coups
 * joués, il est donc public.
 */
function talonProgress(state, action) {
  if (action.type === 'move') {
    return { passMoves: state.passMoves + 1, stalePasses: 0 };
  }
  if (action.type === 'recycle') {
    return { passMoves: 0, stalePasses: state.passMoves === 0 ? state.stalePasses + 1 : 0 };
  }
  return { passMoves: state.passMoves, stalePasses: state.stalePasses };
}

/**
 * Moteur de jeu du Solitaire Klondike.
 */
export class SolitaireEngine {
  /**
   * Distribue une donne. Avec `winnableOnly`, le moteur cherche à partir de la
   * seed la première donne que son solveur prouve gagnable (voir winnable.js).
   * @param {SolitaireConfig} config
   * @returns {SolitaireState}
   */
  init(config) {
    const { seed, playerId, drawCount, winnableOnly } = readConfig(config);
    const winnableDeal = winnableOnly ? findWinnableDeal(seed, drawCount) : null;
    const dealNumber = winnableDeal ?? seed;
    const { board, rngState } = dealBoard(dealNumber, drawCount);
    return {
      version: 1,
      playerId,
      requestedDeal: seed,
      dealNumber,
      winnableOnly,
      winnable: winnableDeal === null ? null : true,
      board,
      score: 0,
      moves: 0,
      passMoves: 0,
      stalePasses: 0,
      gameOver: false,
      winners: null,
      rngState,
    };
  }

  /**
   * Applique une action légale et retourne un nouvel état.
   * @param {SolitaireState} state
   * @param {SolitaireAction} action
   * @param {string} playerId
   * @returns {SolitaireState}
   * @throws {Error} Si l'action est invalide ou ne vient pas du joueur
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error(`Action invalide : ${JSON.stringify(action) ?? String(action)}`);
    }
    // Copie défensive : l'état produit ne partage jamais l'objet action reçu.
    const played = action.type === 'move'
      ? { type: 'move', from: action.from, to: action.to, count: action.count } : { type: action.type };
    const outcome = applyMove(state.board, played);
    const won = isWon(outcome.board);
    const blocked = !won && listMoves(outcome.board).length === 0;
    return {
      ...state,
      ...talonProgress(state, played),
      board: outcome.board,
      score: nextScore(state.score, played, outcome, state.board.drawCount),
      moves: state.moves + 1,
      gameOver: won || blocked,
      winners: won ? [state.playerId] : null,
    };
  }

  /**
   * @param {SolitaireState} state
   * @param {unknown} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    return !state.gameOver && playerId === state.playerId && isWellFormed(action)
      && isLegalMove(state.board, action);
  }

  /**
   * Toutes les actions légales, dans un ordre stable.
   * @param {SolitaireState} state
   * @param {string} playerId
   * @returns {SolitaireAction[]}
   */
  getValidActions(state, playerId) {
    if (state.gameOver || playerId !== state.playerId) {
      return [];
    }
    return listMoves(state.board);
  }

  /**
   * Vue publique : les cartes face cachée sont réduites à leur nombre, le
   * talon à sa taille. La défausse est exposée en entier : chacune de ses
   * cartes a été retournée face visible devant le joueur. La même vue est
   * rendue à tout observateur : rien n'est privé au-delà des cartes cachées.
   * @param {SolitaireState} state
   * @param {string} _playerId
   * @returns {SolitaireView}
   */
  getPlayerView(state, _playerId) {
    const { board } = state;
    return {
      playerId: state.playerId,
      dealNumber: state.dealNumber,
      drawCount: board.drawCount,
      winnable: state.winnable,
      tableau: board.tableau.map(column => ({ downCount: column.down.length, up: [...column.up] })),
      stockCount: board.stock.length,
      waste: [...board.waste],
      foundations: board.foundations.map(foundation => [...foundation]),
      score: state.score,
      moves: state.moves,
      passMoves: state.passMoves,
      stalePasses: state.stalePasses,
      gameOver: state.gameOver,
      winners: state.winners ? [...state.winners] : null,
    };
  }

  /**
   * @param {SolitaireState} state
   * @returns {boolean}
   */
  isGameOver(state) {
    return state.gameOver;
  }

  /**
   * @param {SolitaireState} state
   * @returns {string[]|null} `[playerId]` après une victoire, `null` après un blocage
   */
  getWinners(state) {
    return state.winners ? [...state.winners] : null;
  }

  /**
   * @param {SolitaireState} state
   * @returns {string}
   */
  getCurrentPlayer(state) {
    return state.playerId;
  }

  /**
   * @param {SolitaireState} state
   * @returns {Record<string, number>}
   */
  getScores(state) {
    return { [state.playerId]: state.score };
  }
}

export default SolitaireEngine;
