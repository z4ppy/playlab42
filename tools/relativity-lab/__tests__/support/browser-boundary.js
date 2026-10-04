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
    addEventListener: jest.fn((type, listener) => mediaListeners.push({ type, listener })),
    removeEventListener: jest.fn(),
  }));
  window.requestAnimationFrame = jest.fn((callback) => {
    frames.push(callback);
    return frames.length;
  });
  window.cancelAnimationFrame = jest.fn();

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
