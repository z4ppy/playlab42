/**
 * Temps côté client : chronomètre de partie et lecture pas à pas.
 *
 * Le moteur ne lit jamais l'horloge ; le chrono n'est qu'un affichage. Les
 * horloges et minuteries sont injectées, ce qui rend ces classes testables.
 *
 * @module games/solitaire/ui/timers
 */

/**
 * Durée lisible : « 4:07 », ou « 1:02:09 » au-delà d'une heure.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Chronomètre qui ne compte pas les pauses. */
export class Stopwatch {
  #now;
  #elapsed = 0;
  #since = null;

  /** @param {() => number} now - Horloge monotone en millisecondes */
  constructor(now) {
    this.#now = now;
  }

  /** Démarre ou reprend. */
  start() {
    this.#since ??= this.#now();
  }

  /** Met en pause sans perdre le temps écoulé. */
  pause() {
    if (this.#since !== null) {
      this.#elapsed += this.#now() - this.#since;
      this.#since = null;
    }
  }

  /** Remet à zéro, à l'arrêt. */
  reset() {
    this.#elapsed = 0;
    this.#since = null;
  }

  get running() {
    return this.#since !== null;
  }

  /** @returns {number} Millisecondes écoulées */
  get elapsed() {
    return this.#elapsed + (this.#since === null ? 0 : this.#now() - this.#since);
  }
}

/**
 * Répète une étape à intervalle fixe jusqu'à ce qu'elle renvoie `false`
 * (regarder l'IA, fin automatique). Une seule lecture à la fois.
 */
export class StepPlayer {
  #timer = null;
  #onStop = null;

  /** @param {{setTimeout: Function, clearTimeout: Function}} timers */
  constructor(timers) {
    this.timers = timers;
  }

  /** Une lecture est-elle en cours (y compris pendant une étape) ? */
  get running() {
    return this.#onStop !== null;
  }

  /**
   * @param {() => boolean} step - Joue un coup ; `false` termine la lecture
   * @param {number} delay - Pause entre deux coups, en millisecondes
   * @param {() => void} [onStop] - Appelé une fois à l'arrêt, quelle qu'en soit la cause
   */
  start(step, delay, onStop = () => {}) {
    this.stop();
    this.#onStop = onStop;
    const tick = () => {
      this.#timer = null;
      const more = step();
      // L'étape a pu arrêter la lecture elle-même (victoire, action du joueur).
      if (!this.running) {
        return;
      }
      if (more) {
        this.#timer = this.timers.setTimeout(tick, delay);
      } else {
        this.stop();
      }
    };
    this.#timer = this.timers.setTimeout(tick, delay);
  }

  /** Arrête la lecture en cours, s'il y en a une. */
  stop() {
    if (!this.running) {
      return;
    }
    if (this.#timer !== null) {
      this.timers.clearTimeout(this.#timer);
    }
    this.#timer = null;
    const onStop = this.#onStop;
    this.#onStop = null;
    onStop();
  }
}
