/**
 * IndexedDB minimal en mémoire (une base, des magasins clé/valeur) pour les tests.
 */

/** Requête qui réussit à la microtâche suivante. */
function request(compute) {
  const req = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
  queueMicrotask(() => {
    try {
      req.result = compute(req);
      req.onsuccess?.();
    } catch (error) {
      req.error = error;
      req.onerror?.();
    }
  });
  return req;
}

export function createFakeIndexedDb() {
  const stores = new Map();
  const db = {
    createObjectStore: (name) => stores.set(name, new Map()),
    transaction: (name) => ({
      objectStore: () => ({
        get: (key) => request(() => stores.get(name).get(key)),
        put: (value, key) => request(() => {
          // Copie profonde, comme le clonage structuré d'IndexedDB (données JSON ici).
          stores.get(name).set(key, JSON.parse(JSON.stringify(value)));
          return key;
        }),
      }),
    }),
  };
  return {
    stores,
    open: () => request((req) => {
      if (stores.size === 0) {
        req.result = db;
        req.onupgradeneeded?.();
      }
      return db;
    }),
  };
}
