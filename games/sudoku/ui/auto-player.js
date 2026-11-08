/**
 * Boucle « Regarder l'IA résoudre » : un coup, une pause, un coup...
 * Le rythme appartient au client ; chaque coup passe par le moteur comme un coup humain.
 * Les temporisateurs sont injectés pour tester la boucle sans attendre.
 */

/**
 * @param {Object} options
 * @param {() => boolean} options.step Joue un coup ; retourne false quand il n'y a plus rien à jouer.
 * @param {() => number} options.delay Délai entre deux coups, en millisecondes.
 * @param {() => void} [options.onStop] Appelé à chaque arrêt (fin de grille ou demande).
 * @param {(callback: () => void, ms: number) => unknown} [options.schedule]
 * @param {(handle: unknown) => void} [options.cancel]
 */
export function createAutoPlayer({
  step,
  delay,
  onStop = () => {},
  // Résolus à chaque appel (et non au chargement) : les horloges simulées des tests s'appliquent.
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle),
}) {
  let timer = null;
  let running = false;

  const stop = () => {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    if (running) {
      running = false;
      onStop();
    }
  };

  const tick = () => {
    timer = null;
    if (running && step()) {
      timer = schedule(tick, delay());
    } else {
      stop();
    }
  };

  return {
    start() {
      if (!running) {
        running = true;
        timer = schedule(tick, 0);
      }
    },
    stop,
    isRunning: () => running,
  };
}
