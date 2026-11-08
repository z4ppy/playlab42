/**
 * Chronomètre de la page, hors du moteur (qui ne lit jamais l'horloge).
 * Le temps en pause n'est pas compté ; la source de temps est injectable pour les tests.
 */
export class Clock {
  /** @param {() => number} now - Horloge monotone en millisecondes (performance.now). */
  constructor(now) {
    this.now = now;
    this.reset();
  }

  /** Remet à zéro, à l'arrêt. */
  reset() {
    this.accumulated = 0;
    this.startedAt = null;
  }

  /** @returns {boolean} Le temps s'écoule. */
  get running() {
    return this.startedAt !== null;
  }

  /** Démarre ou reprend (sans effet si déjà en marche). */
  start() {
    if (!this.running) { this.startedAt = this.now(); }
  }

  /** Suspend en gardant le temps écoulé. */
  pause() {
    if (this.running) {
      this.accumulated += this.now() - this.startedAt;
      this.startedAt = null;
    }
  }

  /** @returns {number} Millisecondes écoulées hors pauses. */
  elapsed() {
    return this.accumulated + (this.running ? this.now() - this.startedAt : 0);
  }
}

/**
 * Formate une durée : « 0:07 » en jeu, « 0:07,4 » avec les dixièmes pour un résultat.
 * @param {number} milliseconds - Durée.
 * @param {{tenths?: boolean}} [options] - Afficher les dixièmes.
 * @returns {string}
 */
export function formatTime(milliseconds, { tenths = false } = {}) {
  const totalTenths = Math.floor(Math.max(0, milliseconds) / 100);
  const seconds = Math.floor(totalTenths / 10);
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return tenths ? `${text},${totalTenths % 10}` : text;
}
