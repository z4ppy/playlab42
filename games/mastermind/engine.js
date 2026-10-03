/**
 * Mastermind Engine - Moteur de jeu isomorphe
 * Fonctionne côté client ET serveur
 *
 * L'humain est toujours le décodeur (celui qui devine).
 * L'ordinateur est toujours le codeur (génère le code secret et calcule les feedbacks).
 *
 * @see openspec/specs/mastermind/spec.md
 */

import { SeededRandom } from '../../lib/seeded-random.js';

/**
 * @typedef {'R' | 'B' | 'G' | 'Y' | 'O' | 'V'} Color
 * Rouge, Bleu, Vert, Jaune, Orange, Violet
 */

/**
 * @typedef {Object} Feedback
 * @property {number} black - Nombre de pions noirs (couleur + position correctes)
 * @property {number} white - Nombre de pions blancs (couleur correcte, position incorrecte)
 */

/**
 * @typedef {Object} Attempt
 * @property {Color[]} code - La combinaison tentée (4 couleurs)
 * @property {Feedback} feedback - Le retour de l'ordinateur
 */

/**
 * @typedef {Object} MastermindState
 * @property {Color[]} secretCode - Code secret (4 couleurs, caché au joueur pendant le jeu)
 * @property {Attempt[]} attempts - Historique des tentatives (max 10)
 * @property {boolean} gameOver - Partie terminée ?
 * @property {string|null} winner - ID du gagnant, ou null si défaite
 * @property {number} maxAttempts - Nombre maximum de tentatives (10)
 * @property {number} rngState - État du RNG pour replay
 * @property {string} playerId - ID du joueur unique
 */

/**
 * @typedef {{type: 'submit', code: Color[]} | {type: 'reset', seed: number}} MastermindAction
 *
 * @typedef {Omit<MastermindState, 'secretCode'> & {secretCode: Color[] | null}} MastermindView
 */

/**
 * @typedef {Object} MastermindConfig
 * @property {number} seed - Seed pour le RNG
 * @property {string} playerId - ID du joueur
 */

// Couleurs disponibles : Rouge, Bleu, Vert, Jaune, Orange, Violet
const COLORS = ['R', 'B', 'G', 'Y', 'O', 'V'];
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 10;

/**
 * Moteur de jeu Mastermind
 */
export class MastermindEngine {
  /**
   * Initialise une nouvelle partie
   * @param {MastermindConfig} config
   * @returns {MastermindState}
   */
  init(config) {
    const rng = new SeededRandom(config.seed);

    // Générer le code secret (ordinateur = codeur)
    const secretCode = Array.from({ length: CODE_LENGTH }, () => {
      const idx = Math.floor(rng.random() * COLORS.length);
      return COLORS[idx];
    });

    return {
      secretCode,
      attempts: [],
      gameOver: false,
      winner: null,
      maxAttempts: MAX_ATTEMPTS,
      rngState: config.seed,
      playerId: config.playerId,
    };
  }

  /**
   * Applique une action et retourne le nouvel état
   * @param {MastermindState} state
   * @param {MastermindAction} action
   * @param {string} playerId
   * @returns {MastermindState}
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    if (action.type === 'reset') {
      return this.init({ seed: action.seed, playerId });
    }

    // Action 'submit'
    const feedback = this.#calculateFeedback(state.secretCode, action.code);

    const newAttempt = {
      code: action.code,
      feedback,
    };

    const newState = {
      ...state,
      attempts: [...state.attempts, newAttempt],
    };

    // Vérifier victoire
    if (feedback.black === CODE_LENGTH) {
      newState.gameOver = true;
      newState.winner = playerId;
    }
    // Vérifier défaite (10 tentatives échouées)
    else if (newState.attempts.length >= MAX_ATTEMPTS) {
      newState.gameOver = true;
      newState.winner = null; // Défaite
    }

    return newState;
  }

  /**
   * Vérifie si une action est valide
   * @param {MastermindState} state
   * @param {MastermindAction} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return false;
    }
    // Seul le joueur propriétaire peut agir
    if (playerId !== state.playerId) {
      return false;
    }

    if (action.type === 'reset') {
      return Number.isSafeInteger(action.seed);
    }

    if (action.type === 'submit') {
      // Partie déjà terminée
      if (state.gameOver) {
        return false;
      }

      // Vérifier que le code a 4 couleurs valides
      if (!Array.isArray(action.code) || action.code.length !== CODE_LENGTH) {
        return false;
      }

      // Matérialiser les cases creuses, que Array.every ignorerait.
      return Array.from(action.code).every((color) => COLORS.includes(color));
    }

    return false;
  }

  /**
   * Retourne les actions valides pour un joueur
   * @param {MastermindState} state
   * @param {string} playerId
   * @returns {MastermindAction[]}
   */
  getValidActions(state, playerId) {
    if (playerId !== state.playerId || state.gameOver) {
      return [];
    }

    // Ordre lexicographique stable, sans consulter le code secret.
    const actions = [];
    for (const a of COLORS) {
      for (const b of COLORS) {
        for (const c of COLORS) {
          for (const d of COLORS) {
            actions.push({ type: 'submit', code: [a, b, c, d] });
          }
        }
      }
    }
    return actions;
  }

  /** @param {MastermindState} state @returns {boolean} */
  isGameOver(state) { return state.gameOver; }

  /** @param {MastermindState} state @returns {string[] | null} */
  getWinners(state) { return state.winner === null ? null : [state.winner]; }

  /** @param {MastermindState} state @returns {string | null} */
  getCurrentPlayer(state) { return state.gameOver ? null : state.playerId; }

  /**
   * Retourne la vue du joueur (fog of war)
   * Le code secret est caché pendant le jeu, révélé à la fin
   * @param {MastermindState} state
   * @param {string} _playerId - Non utilisé (jeu single-player)
   * @returns {MastermindView}
   */
  getPlayerView(state, _playerId) {
    if (state.gameOver) {
      // Révéler le code secret à la fin
      return state;
    }

    // Cacher le code secret pendant le jeu
    return {
      ...state,
      secretCode: null,
    };
  }

  /**
   * Calcule le feedback pour une tentative
   * Algorithme en 2 passes pour éviter le double comptage
   *
   * @private
   * @param {Color[]} secret - Code secret
   * @param {Color[]} guess - Tentative du joueur
   * @returns {Feedback}
   */
  #calculateFeedback(secret, guess) {
    // Passe 1 : Compter les positions exactes (noirs)
    let black = 0;
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (secret[i] === guess[i]) {
        black++;
      }
    }

    // Passe 2 : Compter les correspondances de couleurs (total)
    const secretCounts = this.#countColors(secret);
    const guessCounts = this.#countColors(guess);

    let totalMatches = 0;
    for (const color of COLORS) {
      totalMatches += Math.min(
        secretCounts[color] || 0,
        guessCounts[color] || 0,
      );
    }

    // Les blancs = correspondances totales - noirs
    const white = totalMatches - black;

    return { black, white };
  }

  /**
   * Compte les occurrences de chaque couleur
   * @private
   * @param {Color[]} code
   * @returns {Object.<Color, number>}
   */
  #countColors(code) {
    const counts = {};
    for (const color of code) {
      counts[color] = (counts[color] || 0) + 1;
    }
    return counts;
  }
}
