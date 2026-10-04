/** Frontières navigateur déterministes : contexte 2D, observers, media query, horloge et frames. */
import { jest } from '@jest/globals';

export function createContext2d() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'calls') { return calls; }
      if (prop in target) { return target[prop]; }
      return (...args) => { calls.push([prop, ...args]); };
    },
    set(target, prop, value) {
      target[prop] = value;
      calls.push([`set:${String(prop)}`, value]);
      return true;
    },
  });
  return ctx;
}

export function installBrowserBoundary() {
  const frames = [];
  const resizeObservers = [];
  const mediaListeners = [];
  const clock = { now: 1000 };

  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      resizeObservers.push(this);
    }
    observe(element) { this.observed.push(element); }
    disconnect() { this.disconnected = true; }
  }

  const context = createContext2d();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  jest.spyOn(performance, 'now').mockImplementation(() => clock.now);
  globalThis.ResizeObserver = FakeResizeObserver;
  window.matchMedia = jest.fn(() => ({
    addEventListener: jest.fn((type, listener, options) => {
      const entry = { type, listener };
      mediaListeners.push(entry);
      options?.signal?.addEventListener('abort', () => mediaListeners.splice(mediaListeners.indexOf(entry), 1));
    }),
    removeEventListener: jest.fn((type, listener) => {
      const index = mediaListeners.findIndex((entry) => entry.type === type && entry.listener === listener);
      if (index !== -1) { mediaListeners.splice(index, 1); }
    }),
  }));
  const scheduled = new Map();
  let lastFrameId = 0;
  window.requestAnimationFrame = jest.fn((callback) => {
    const id = ++lastFrameId;
    const pending = () => callback();
    scheduled.set(id, pending);
    frames.push(pending);
    return id;
  });
  window.cancelAnimationFrame = jest.fn((id) => {
    const index = frames.indexOf(scheduled.get(id));
    if (index !== -1) { frames.splice(index, 1); }
  });

  return {
    clock,
    context,
    frames,
    resizeObservers,
    mediaListeners,
    /** Exécute les frames en attente (une génération), en avançant l'horloge de `ms`. */
    runFrame(ms = 16) {
      clock.now += ms;
      for (const callback of frames.splice(0)) { callback(); }
    },
  };
}
