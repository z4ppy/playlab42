/**
 * Chronomètre de partie, côté client : le moteur ne lit jamais l'horloge.
 * La source de temps est injectée pour des tests sans attente réelle.
 */

/**
 * @param {() => number} [now] Horloge en millisecondes.
 * @returns {{start: () => void, pause: () => void, reset: (elapsedMs?: number) => void,
 *   elapsed: () => number, isRunning: () => boolean}}
 */
export function createClock(now = () => Date.now()) {
  let accumulated = 0;
  let startedAt = null;
  return {
    start() {
      startedAt ??= now();
    },
    pause() {
      if (startedAt !== null) {
        accumulated += Math.max(0, now() - startedAt);
        startedAt = null;
      }
    },
    reset(elapsedMs = 0) {
      accumulated = elapsedMs;
      startedAt = null;
    },
    elapsed() {
      return accumulated + (startedAt === null ? 0 : Math.max(0, now() - startedAt));
    },
    isRunning() {
      return startedAt !== null;
    },
  };
}

const pad = (value) => String(value).padStart(2, '0');

/**
 * « 07:42 », ou « 1:05:09 » au-delà d'une heure.
 * @param {number} milliseconds
 * @returns {string}
 */
export function formatDuration(milliseconds) {
  const total = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const clock = `${pad(minutes)}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

/**
 * Durée en toutes lettres pour les lecteurs d'écran : « 7 minutes 42 secondes ».
 * @param {number} milliseconds
 * @returns {string}
 */
export function spokenDuration(milliseconds) {
  const total = Math.floor(Math.max(0, milliseconds) / 1000);
  const units = [[Math.floor(total / 3600), 'heure'], [Math.floor((total % 3600) / 60), 'minute'], [total % 60, 'seconde']];
  const parts = units.filter(([count]) => count > 0).map(([count, unit]) => `${count} ${unit}${count > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(' ') : '0 seconde';
}
