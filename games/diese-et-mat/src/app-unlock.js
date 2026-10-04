/**
 * Diese & Mat - Règles de déblocage des exercices (module privé de App)
 *
 * @module app-unlock
 */

const UNLOCKED_BY_DEFAULT = ['note-treble-natural'];

const skillAccuracy = (progress, skillId) => progress.skills[skillId]?.accuracy || 0;

/** Condition de déblocage des autres exercices, selon la progression. */
const UNLOCK_RULES = {
  'note-treble-sharps': (progress) => skillAccuracy(progress, 'treble-clef') >= 0.7,
  'note-bass-natural': (progress) => skillAccuracy(progress, 'treble-clef') >= 0.5,
  'interval-basic': (progress) => progress.level >= 2,
  'interval-all': (progress) => skillAccuracy(progress, 'intervals') >= 0.6,
};

/**
 * Indique si l'hôte correspond à un environnement de développement.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isDevHostname(hostname) {
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname.endsWith('.local') ||
         hostname.endsWith('.lan');
}

/**
 * Applique les règles de déblocage hors mode développement.
 * @param {string} exerciseId - ID de l'exercice
 * @param {{level: number, skills: Object}} progress - Progression courante
 * @returns {boolean}
 */
export function isUnlockedByProgress(exerciseId, progress) {
  if (UNLOCKED_BY_DEFAULT.includes(exerciseId)) {
    return true;
  }
  return UNLOCK_RULES[exerciseId]?.(progress) ?? false;
}
