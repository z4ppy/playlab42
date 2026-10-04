/** Banc d'essai de main.js : DOM de la page, frontières navigateur/Three, démarrage réel. */
import { jest } from '@jest/globals';
import { installBrowserBoundary } from './browser-boundary.js';

const PAGE = {
  panels: '<section id="panels"></section>',
  hud: '<div id="hud"></div>',
  clock: '<div id="clock-panel"></div>',
  observer: '<div id="observer-view"></div>',
  motor: '<div id="motor-panel"></div>',
  doppler: '<div id="doppler-graph"></div>',
  actions: `<button id="play-button"><span class="play-button-icon">▶</span><span class="play-button-text">Play</span></button>
    <button id="reset-button">Reset</button>`,
};

function sizeCanvasContainer() {
  const container = document.getElementById('canvas-container');
  if (!container) { return; }
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
}

export function buildPage(omit = []) {
  const parts = Object.entries(PAGE).filter(([key]) => !omit.includes(key)).map(([, html]) => html);
  const canvas = omit.includes('canvas') ? '' : '<div id="canvas-container"><div class="loading">Chargement</div></div>';
  document.body.innerHTML = canvas + parts.join('');
  sizeCanvasContainer();
}

/** Évite que les écouteurs globaux d'un test survivent au suivant. */
function trackGlobalListeners() {
  const tracked = [];
  for (const target of [document, window]) {
    const original = target.addEventListener.bind(target);
    jest.spyOn(target, 'addEventListener').mockImplementation((...args) => {
      tracked.push([target, args]);
      return original(...args);
    });
  }
  return () => {
    for (const [target, args] of tracked) { target.removeEventListener(...args); }
  };
}

export async function startApp({ omit = [], loading = false, breakMatchMedia = false } = {}) {
  const browser = installBrowserBoundary();
  const untrack = trackGlobalListeners();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  buildPage(omit);
  delete window.relativityApp;
  if (breakMatchMedia) { window.matchMedia = undefined; }
  if (loading) { jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading'); }
  await jest.isolateModulesAsync(async () => { await import('../../src/main.js'); });
  if (loading) {
    if (window.relativityApp) { throw new Error('main.js ne doit pas démarrer avant DOMContentLoaded'); }
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { ...browser, app: window.relativityApp, error, cleanup: untrack };
}

export function press(code, init = {}, target = document.body) {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
