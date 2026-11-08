/**
 * Client de calcul : délègue au worker et ne garde que la dernière demande.
 *
 * Si l'utilisateur change un réglage pendant un long calcul, on termine le
 * worker en cours (annulation réelle, pas seulement ignorée) et on en relance
 * un. Sans worker (page ouverte en file://, navigateur ancien), on calcule sur
 * le fil principal après avoir laissé l'interface afficher « Calcul… ».
 */

import { computeDrawing, describeError } from './compute.js';

/**
 * @typedef {{ ok: true, result: ReturnType<typeof computeDrawing> } | { ok: false, error: ReturnType<typeof describeError> } | { ok: false, cancelled: true }} ComputeOutcome
 */

/**
 * Crée un worker module, ou null si c'est impossible.
 * @returns {Worker|null}
 */
function createWorker() {
  try {
    return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Calcul sur le fil principal (repli).
 * @param {import('./compute.js').ComputeParams} params - Paramètres
 * @returns {Promise<ComputeOutcome>}
 */
function computeInline(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve({ ok: true, result: computeDrawing(params) });
      } catch (error) {
        resolve({ ok: false, error: describeError(error) });
      }
    }, 16);
  });
}

export class ComputeClient {
  constructor() {
    this.worker = null;
    this.workerAvailable = typeof Worker !== 'undefined';
    this.nextId = 1;
    /** @type {{ id: number, resolve: (outcome: ComputeOutcome) => void }|null} */
    this.pending = null;
  }

  /**
   * Lance un calcul ; la promesse précédente éventuelle se résout en « annulé ».
   * @param {import('./compute.js').ComputeParams} params - Paramètres
   * @returns {Promise<ComputeOutcome>}
   */
  run(params) {
    this.cancel();
    const worker = this.ensureWorker();
    if (!worker) {
      return computeInline(params);
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending = { id, resolve };
      worker.postMessage({ id, params });
    });
  }

  ensureWorker() {
    if (!this.worker && this.workerAvailable) {
      this.worker = createWorker();
      if (!this.worker) {
        this.workerAvailable = false;
        return null;
      }
      this.worker.addEventListener('message', (event) => this.onMessage(event.data));
      this.worker.addEventListener('error', (event) => this.onWorkerError(event));
    }
    return this.worker;
  }

  onMessage(message) {
    if (!this.pending || message.id !== this.pending.id) {
      return;
    }
    const { resolve } = this.pending;
    this.pending = null;
    resolve(message.ok ? { ok: true, result: message.result } : { ok: false, error: message.error });
  }

  /**
   * Le worker n'a pas pu se charger (CSP, file://) : on bascule sur le repli.
   * @param {ErrorEvent} event - Erreur
   */
  onWorkerError(event) {
    event.preventDefault?.();
    const pending = this.pending;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    this.workerAvailable = false;
    if (pending) {
      pending.resolve({ ok: false, error: { code: 'internal', message: 'Le calcul en arrière-plan a échoué ; nouvel essai sur la page.' }, retry: true });
    }
  }

  /** Annule le calcul en cours en terminant le worker. */
  cancel() {
    if (!this.pending) {
      return;
    }
    const { resolve } = this.pending;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    resolve({ ok: false, cancelled: true });
  }
}
