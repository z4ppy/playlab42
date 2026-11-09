/**
 * Client de l'IA côté page : envoie les requêtes au Web Worker et rend des
 * promesses. Si le worker ne peut pas être créé ou échoue à se charger
 * (navigateur ancien, page ouverte en file://, politique de sécurité), les
 * requêtes — y compris celles en attente — sont traitées sur le fil principal
 * avec exactement le même code (`handleAiRequest`).
 *
 * `cancelAll` résout les promesses en attente avec `{ cancelled: true }` et
 * termine le worker : un calcul devenu inutile (annulation, nouvelle partie)
 * ne bloque donc jamais la requête suivante.
 */

import { handleAiRequest } from './protocol.js';

/**
 * Crée le worker module de l'IA, ou null si l'environnement ne le permet pas.
 * @returns {Worker | null}
 */
export function createDefaultWorker() {
  if (typeof Worker !== 'function') {
    return null;
  }
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

/**
 * @typedef {Object} AiClientOptions
 * @property {() => (Worker | null)} [createWorker] - Fabrique du worker (injectable pour les tests)
 * @property {(request: object) => object} [handleInline] - Traitement de repli sur le fil principal
 * @property {(task: () => void) => void} [schedule] - Report du repli, pour laisser la page se redessiner
 */

export class AiClient {
  /** @type {Map<number, { request: object, resolve: (response: object) => void }>} */
  #pending = new Map();
  #nextId = 1;
  /** @type {Worker | null} */
  #worker = null;
  #inline = false;

  /**
   * @param {AiClientOptions} [options] - Dépendances injectables
   */
  constructor({ createWorker = createDefaultWorker, handleInline = handleAiRequest, schedule = (task) => setTimeout(task, 0) } = {}) {
    this.createWorker = createWorker;
    this.handleInline = handleInline;
    this.schedule = schedule;
  }

  /** @returns {'worker' | 'inline'} Mode de calcul effectif ou prévu */
  get mode() {
    return this.#inline ? 'inline' : 'worker';
  }

  /** @returns {boolean} Une requête est-elle en cours ? */
  get busy() {
    return this.#pending.size > 0;
  }

  /**
   * Envoie une requête ; l'identifiant est attribué ici.
   * @param {object} payload - Requête sans `id` (voir protocol.js)
   * @returns {Promise<object>} Réponse du protocole, ou `{ cancelled: true }`
   */
  request(payload) {
    const request = { ...payload, id: this.#nextId++ };
    return new Promise((resolve) => {
      this.#pending.set(request.id, { request, resolve });
      this.#dispatch(request);
    });
  }

  /** Abandonne toutes les requêtes en cours et arrête le calcul du worker. */
  cancelAll() {
    for (const [id, { resolve }] of this.#pending) {
      resolve({ id, ok: false, cancelled: true });
    }
    this.#pending.clear();
    this.#worker?.terminate();
    this.#worker = null;
  }

  /**
   * @param {object} request - Requête numérotée
   */
  #dispatch(request) {
    const worker = this.#ensureWorker();
    if (worker) {
      worker.postMessage(request);
    } else {
      this.#runInline(request);
    }
  }

  /**
   * @param {object} request - Requête numérotée
   */
  #runInline(request) {
    this.schedule(() => {
      if (this.#pending.has(request.id)) {
        this.#settle(this.handleInline(request));
      }
    });
  }

  /**
   * @param {{ id: number }} response - Réponse reçue
   */
  #settle(response) {
    const pending = this.#pending.get(response?.id);
    if (pending) {
      this.#pending.delete(response.id);
      pending.resolve(response);
    }
  }

  /** @returns {Worker | null} Worker prêt, créé à la demande */
  #ensureWorker() {
    if (this.#inline || this.#worker) {
      return this.#worker;
    }
    try {
      this.#worker = this.createWorker();
    } catch {
      this.#worker = null;
    }
    if (!this.#worker) {
      this.#inline = true;
      return null;
    }
    const worker = this.#worker;
    // Un worker remplacé (après cancelAll) ne doit plus rien influencer.
    worker.addEventListener('message', (event) => {
      if (worker === this.#worker) {
        this.#settle(event.data);
      }
    });
    worker.addEventListener('error', (event) => {
      if (worker === this.#worker) {
        this.#fallBack(event);
      }
    });
    return worker;
  }

  /**
   * Le worker n'a pas pu se charger : bascule définitive sur le fil principal
   * et reprise des requêtes en attente.
   * @param {Event} event - Erreur du worker
   */
  #fallBack(event) {
    event.preventDefault?.();
    this.#worker?.terminate();
    this.#worker = null;
    this.#inline = true;
    for (const { request } of this.#pending.values()) {
      this.#runInline(request);
    }
  }
}
