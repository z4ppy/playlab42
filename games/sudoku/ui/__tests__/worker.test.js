import { afterAll, describe, expect, it } from '@jest/globals';
import { SudokuEngine } from '../../engine.js';
import { CLASSIC } from '../../engine/__tests__/fixtures.js';

/*
 * Le Worker est un module ordinaire qui écoute `self` : on lui fournit un `self`
 * factice pour vérifier son protocole sans navigateur.
 */
const listeners = [];
const posted = [];
globalThis.self = {
  addEventListener: (type, listener) => listeners.push({ type, listener }),
  postMessage: (message) => posted.push(message),
};
await import('../generation-worker.js');

afterAll(() => {
  delete globalThis.self;
});

describe('Worker de génération', () => {
  const send = (data) => listeners.forEach(({ listener }) => listener({ data }));

  it('répond avec l’état produit par le moteur', () => {
    const config = { seed: 3, playerIds: ['joueur'], puzzle: CLASSIC };
    send({ id: 7, config });
    expect(listeners.map(({ type }) => type)).toEqual(['message']);
    expect(posted.at(-1)).toEqual({ id: 7, state: new SudokuEngine().init(config) });
  });

  it('renvoie le message d’erreur d’une configuration invalide', () => {
    send({ id: 8, config: { seed: -1, playerIds: ['joueur'] } });
    expect(posted.at(-1)).toEqual({ id: 8, error: expect.stringContaining('seed') });
  });
});
