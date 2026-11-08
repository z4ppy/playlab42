/**
 * Sauvegarde locale via GameKit.saveProgress : partie en cours et meilleurs temps.
 *
 * Un meilleur temps se MINIMISE : on n'utilise donc pas GameKit.saveScore, qui trie
 * par score décroissant. Format versionné ; une donnée illisible ou d'une version
 * future n'est jamais écrasée : la session continue sans sauvegarde et le dit.
 */

import { LEVEL_IDS } from '../engine/difficulty.js';
import { isSudokuState } from '../engine.js';

export const PROGRESS_VERSION = 1;

/**
 * @typedef {Object} CurrentGame
 * @property {import('../engine.js').SudokuState} state
 * @property {number} elapsedMs
 * @property {number} hints Indices demandés.
 * @property {boolean} assisted Vrai si l'IA a joué au moins un coup.
 *
 * @typedef {{version: 1, current: CurrentGame | null, best: Record<string, number | null>}} ProgressData
 */

const isDuration = (value) => Number.isFinite(value) && value >= 0;

const emptyBest = () => Object.fromEntries(LEVEL_IDS.map((level) => [level, null]));

function isCurrentGame(current) {
  return current === null || (Boolean(current) && isSudokuState(current.state) && isDuration(current.elapsedMs)
    && Number.isInteger(current.hints) && typeof current.assisted === 'boolean');
}

/**
 * @param {unknown} data
 * @returns {data is ProgressData}
 */
export function isProgressData(data) {
  return Boolean(data) && data.version === PROGRESS_VERSION && isCurrentGame(data.current)
    && LEVEL_IDS.every((level) => data.best?.[level] === null || isDuration(data.best?.[level]));
}

/**
 * @param {{loadProgress: () => unknown, saveProgress: (data: unknown) => boolean}} kit
 * @param {(message: string) => void} notify Message visible en cas de problème.
 */
export function createProgressStore(kit, notify) {
  const loaded = kit.loadProgress();
  const readable = loaded === null || isProgressData(loaded);
  /** @type {ProgressData} */
  const data = isProgressData(loaded) ? loaded : { version: PROGRESS_VERSION, current: null, best: emptyBest() };
  if (!readable) {
    notify('Sauvegarde locale illisible ou d’une version plus récente : elle est conservée telle quelle et cette partie ne sera pas enregistrée.');
  }

  const write = () => {
    if (readable && !kit.saveProgress(data)) {
      notify('Le stockage local est indisponible : la progression reste en mémoire seulement.');
    }
  };

  return {
    /** @returns {CurrentGame | null} */
    current: () => data.current,
    /** @param {string} level @returns {number | null} */
    best: (level) => data.best[level],
    /** @param {CurrentGame | null} current */
    saveCurrent(current) {
      data.current = current;
      write();
    },
    /**
     * Enregistre un temps et indique s'il bat le record du niveau.
     * @param {string} level
     * @param {number} elapsedMs
     * @returns {boolean}
     */
    recordTime(level, elapsedMs) {
      const previous = data.best[level];
      const improved = previous === null || elapsedMs < previous;
      if (improved) {
        data.best[level] = elapsedMs;
      }
      data.current = null;
      write();
      return improved;
    },
  };
}
