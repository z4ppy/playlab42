/**
 * Client IA : acheminement vers un worker simulé, repli sur le fil principal,
 * annulation et réponses périmées. Aucun navigateur n'est nécessaire.
 */

import { AiClient, createDefaultWorker } from '../client.js';
import { stateAfter } from './helpers.js';

/** Worker factice : mémorise les messages et laisse le test répondre ou échouer. */
class FakeWorker {
  constructor() {
    this.posted = [];
    this.listeners = { message: [], error: [] };
    this.terminated = false;
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  postMessage(message) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data) {
    this.listeners.message.forEach((listener) => listener({ data }));
  }

  fail() {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    this.listeners.error.forEach((listener) => listener(event));
    return event;
  }
}

/** Client branché sur des workers factices et un repli synchrone instrumenté. */
function setup({ workerAvailable = true } = {}) {
  const workers = [];
  const inline = [];
  const client = new AiClient({
    createWorker: () => {
      if (!workerAvailable) {
        return null;
      }
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    handleInline: (request) => {
      inline.push(request);
      return { id: request.id, ok: true, inline: true };
    },
    schedule: (task) => task(),
  });
  return { client, workers, inline };
}

describe('AiClient', () => {
  it('numérote les requêtes et résout la promesse correspondante', async () => {
    const { client, workers } = setup();
    const first = client.request({ kind: 'analyze' });
    const second = client.request({ kind: 'move' });
    expect(client.mode).toBe('worker');
    expect(client.busy).toBe(true);
    const [worker] = workers;
    expect(worker.posted.map((message) => message.id)).toEqual([1, 2]);
    worker.reply({ id: 2, ok: true, value: 'deux' });
    worker.reply({ id: 1, ok: true, value: 'un' });
    await expect(first).resolves.toEqual({ id: 1, ok: true, value: 'un' });
    await expect(second).resolves.toEqual({ id: 2, ok: true, value: 'deux' });
    expect(client.busy).toBe(false);
  });

  it('ignore les réponses inconnues ou malformées', async () => {
    const { client, workers } = setup();
    const pending = client.request({ kind: 'analyze' });
    workers[0].reply({ id: 99, ok: true });
    workers[0].reply(null);
    expect(client.busy).toBe(true);
    workers[0].reply({ id: 1, ok: true });
    await expect(pending).resolves.toMatchObject({ id: 1 });
  });

  it('annule les requêtes en cours et repart d\'un worker neuf', async () => {
    const { client, workers } = setup();
    const pending = client.request({ kind: 'move' });
    client.cancelAll();
    await expect(pending).resolves.toEqual({ id: 1, ok: false, cancelled: true });
    expect(workers[0].terminated).toBe(true);
    // Une réponse tardive de l'ancien worker n'affecte plus rien.
    const next = client.request({ kind: 'analyze' });
    workers[0].reply({ id: 2, ok: true, stale: true });
    workers[0].fail();
    expect(workers).toHaveLength(2);
    expect(client.mode).toBe('worker');
    workers[1].reply({ id: 2, ok: true, fresh: true });
    await expect(next).resolves.toEqual({ id: 2, ok: true, fresh: true });
    client.cancelAll();
  });

  it('bascule sur le fil principal si le worker échoue à se charger, en reprenant l\'attente', async () => {
    const { client, workers, inline } = setup();
    const pending = client.request({ kind: 'analyze' });
    const event = workers[0].fail();
    expect(event.defaultPrevented).toBe(true);
    expect(workers[0].terminated).toBe(true);
    await expect(pending).resolves.toEqual({ id: 1, ok: true, inline: true });
    expect(client.mode).toBe('inline');
    await expect(client.request({ kind: 'move' })).resolves.toMatchObject({ id: 2, inline: true });
    expect(inline.map((request) => request.id)).toEqual([1, 2]);
  });

  it('calcule sur le fil principal sans worker, et n\'exécute pas une requête annulée', async () => {
    const tasks = [];
    const inline = [];
    const client = new AiClient({
      createWorker: () => { throw new Error('Worker interdit'); },
      handleInline: (request) => { inline.push(request.id); return { id: request.id, ok: true }; },
      schedule: (task) => tasks.push(task),
    });
    const cancelled = client.request({ kind: 'analyze' });
    client.cancelAll();
    const kept = client.request({ kind: 'analyze' });
    tasks.forEach((task) => task());
    await expect(cancelled).resolves.toMatchObject({ cancelled: true });
    await expect(kept).resolves.toEqual({ id: 2, ok: true });
    expect(inline).toEqual([2]);
  });

  it('se rabat sur le repli quand la fabrique ne fournit pas de worker', async () => {
    const { client } = setup({ workerAvailable: false });
    await expect(client.request({ kind: 'analyze' })).resolves.toMatchObject({ inline: true });
  });

  it('la fabrique par défaut renvoie null hors navigateur, un worker module sinon', () => {
    expect(typeof Worker).toBe('undefined');
    expect(createDefaultWorker()).toBeNull();
    globalThis.Worker = class {
      constructor(url, options) {
        Object.assign(this, { url: String(url), options });
      }
    };
    try {
      const worker = createDefaultWorker();
      expect(worker.url).toMatch(/ai\/worker\.js$/);
      expect(worker.options).toEqual({ type: 'module' });
    } finally {
      delete globalThis.Worker;
    }
  });

  it('utilise par défaut le vrai protocole, reporté par setTimeout', async () => {
    expect(new AiClient().mode).toBe('worker');
    const client = new AiClient({ createWorker: () => null });
    const response = await client.request({ kind: 'analyze', view: stateAfter('112237') });
    expect(response).toMatchObject({ id: 1, ok: true, analysis: { column: 3 } });
  });
});
