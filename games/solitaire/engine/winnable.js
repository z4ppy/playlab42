/**
 * Choix d'une donne gagnable : une décision du jeu, prise à la génération.
 *
 * Le moteur connaît toutes les cartes ; il peut donc lancer le solveur à
 * information complète sur la donne demandée, puis sur les suivantes, jusqu'à
 * en prouver une gagnable. Le joueur, lui, ne reçoit que la garantie (« cette
 * donne a une solution »), jamais la solution ni les cartes cachées.
 *
 * Le budget est exprimé en nœuds, jamais en temps : une même configuration
 * donne toujours la même donne, sur n'importe quelle machine. La recherche est
 * élaguée (rapide) : une donne qu'elle ne résout pas est simplement passée,
 * même si elle était peut-être gagnable.
 *
 * @module games/solitaire/engine/winnable
 */

import { solve } from '../ai/solver.js';
import { MAX_DEAL_NUMBER, dealBoard } from './deal.js';

/** Bornes de la recherche : environ 1 donne sur 2 est résolue sous ce budget. */
export const WINNABLE_SEARCH = Object.freeze({ maxAttempts: 30, maxNodesPerDeal: 4000 });

/**
 * Premier numéro de donne prouvé gagnable à partir de `dealNumber` (inclus).
 * @param {number} dealNumber - Numéro demandé
 * @param {1|3} drawCount - Mode de pioche, qui change la solvabilité
 * @param {{maxAttempts: number, maxNodesPerDeal: number}} [limits]
 * @returns {number|null} Numéro trouvé, ou `null` si aucune donne n'a été prouvée
 */
export function findWinnableDeal(dealNumber, drawCount, limits = WINNABLE_SEARCH) {
  for (let attempt = 0; attempt < limits.maxAttempts; attempt++) {
    // Le numéro reboucle après le plus grand entier 32 bits, comme une seed.
    const candidate = (dealNumber + attempt) % (MAX_DEAL_NUMBER + 1);
    const result = solve(dealBoard(candidate, drawCount).board, {
      maxNodes: limits.maxNodesPerDeal,
      exhaustive: false,
    });
    if (result.status === 'winnable') {
      return candidate;
    }
  }
  return null;
}
