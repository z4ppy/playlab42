import { jest } from '@jest/globals';
import { initOnce } from './init-once.js';

describe('initOnce', () => {
  const makeOwner = () => ({ ready: false, _disposed: false, _initPromise: null });

  test('un objet détruit rejette sans initialiser', async () => {
    const owner = { ...makeOwner(), _disposed: true };
    const initialize = jest.fn();
    await expect(initOnce(owner, 'détruit', initialize)).rejects.toThrow('détruit');
    expect(initialize).not.toHaveBeenCalled();
  });

  test('un objet prêt répond sans initialiser', async () => {
    const owner = { ...makeOwner(), ready: true };
    const initialize = jest.fn();
    await expect(initOnce(owner, 'détruit', initialize)).resolves.toBeUndefined();
    expect(initialize).not.toHaveBeenCalled();
  });

  test('les appels concurrents partagent la promesse, libérée après succès', async () => {
    const owner = makeOwner();
    const initialize = jest.fn().mockResolvedValue();
    const first = initOnce(owner, 'détruit', initialize);
    expect(initOnce(owner, 'détruit', initialize)).toBe(first);
    expect(owner._initPromise).toBe(first);
    await first;
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(owner._initPromise).toBeNull();
  });

  test('un échec est propagé tel quel puis la promesse est libérée pour un nouvel essai', async () => {
    const owner = makeOwner();
    const failure = new Error('échec');
    await expect(initOnce(owner, 'détruit', () => Promise.reject(failure))).rejects.toBe(failure);
    expect(owner._initPromise).toBeNull();
    await expect(initOnce(owner, 'détruit', () => Promise.resolve())).resolves.toBeUndefined();
  });
});
