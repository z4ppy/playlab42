/**
 * Numéro de grille partageable : le niveau et la seed suffisent à régénérer
 * exactement la même grille (le générateur est déterministe).
 * Format du fragment d'URL : « #expert-123456 ».
 */

import { isLevelId } from '../engine/difficulty.js';
import { isSeed } from '../engine.js';

/**
 * @param {string} level
 * @param {number} seed
 * @returns {string} Fragment d'URL, dièse compris.
 */
export const formatPuzzleHash = (level, seed) => `#${level}-${seed}`;

/**
 * @param {string} hash Fragment lu dans `location.hash`.
 * @returns {{level: import('../engine/difficulty.js').LevelId, seed: number} | null}
 */
export function parsePuzzleHash(hash) {
  const match = /^#?([a-z]+)-(\d{1,10})$/.exec(hash ?? '');
  if (!match || !isLevelId(match[1])) {
    return null;
  }
  const seed = Number(match[2]);
  return isSeed(seed) ? { level: match[1], seed } : null;
}

/**
 * Seed courte, facile à dicter : 6 chiffres au plus.
 * @param {() => number} random Source d'aléa du client (Math.random en production).
 * @returns {number}
 */
export const randomSeed = (random) => Math.floor(random() * 1_000_000);
