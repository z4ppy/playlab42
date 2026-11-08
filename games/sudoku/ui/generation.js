/**
 * Génération des grilles hors du fil principal.
 *
 * Mesures (README) : une grille Facile se génère en quelques millisecondes, une
 * grille Difficile ou Expert en 100 ms en moyenne mais parfois près d'une seconde.
 * On délègue donc `engine.init` à un Web Worker de module pour ne jamais figer
 * l'interface. Repli synchrone si le navigateur ne fournit pas de Worker de module
 * ou si le Worker échoue : le résultat est identique, seul le confort change.
 * Le Worker renvoie l'état JSON produit par le même moteur : aucune règle dupliquée.
 */

/**
 * @param {Object} options
 * @param {{init: (config: object) => object}} options.engine Moteur pour le repli synchrone.
 * @param {(() => Worker) | null} options.createWorker Fabrique du Worker, ou null pour forcer le repli.
 * @returns {{generate: (config: object) => Promise<object>, dispose: () => void}}
 */
export function createPuzzleFactory({ engine, createWorker }) {
  let worker = null;
  let nextId = 0;
  const pending = new Map();

  const fallback = (config) => engine.init(config);

  const failAll = () => {
    worker?.terminate();
    worker = null;
    for (const { config, resolve, reject } of pending.values()) {
      // Le Worker a échoué : on génère sur le fil principal, sans perdre la demande.
      Promise.resolve().then(() => resolve(fallback(config))).catch(reject);
    }
    pending.clear();
  };

  const onMessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) {
      return;
    }
    pending.delete(data.id);
    if (data.error) {
      request.reject(new Error(data.error));
    } else {
      request.resolve(data.state);
    }
  };

  const ensureWorker = () => {
    if (!worker && createWorker) {
      try {
        worker = createWorker();
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', failAll);
      } catch {
        worker = null;
      }
    }
    return worker;
  };

  return {
    generate(config) {
      const target = ensureWorker();
      if (!target) {
        return new Promise((resolve) => resolve(fallback(config)));
      }
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { config, resolve, reject });
        target.postMessage({ id, config });
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}
