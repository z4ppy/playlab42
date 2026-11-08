/**
 * Point d'entrée de l'outil « Automate cellulaire ».
 * Lit le permalien, assemble rendu, interface et gestes, puis lance la boucle.
 */

import { initTheme, onThemeChange, toggleTheme } from '../../../lib/theme.js';
import { decodeState } from './hash-state.js';
import { Renderer } from './renderer.js';
import { Ui } from './ui.js';
import { CellularApp } from './app.js';
import { GestureController } from './pointer.js';

initTheme();

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('board'));
const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const { state, warnings } = decodeState(location.hash);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Dernier fragment écrit par l'outil, pour distinguer une saisie manuelle. */
let writtenHash = location.hash.replace(/^#/, '');

const ui = new Ui();
const app = new CellularApp({
  renderer: new Renderer(canvas),
  ui,
  state,
  reducedMotion,
  writeHash: (hash) => {
    writtenHash = hash;
    try {
      history.replaceState(null, '', `#${hash}`);
    } catch {
      // Certains contextes (fichier local, bac à sable) refusent replaceState.
    }
  },
});
ui.bind(app);

new GestureController(canvas, {
  start: (p, pointerType) => app.gestureStart(p, pointerType),
  move: (p) => app.gestureMove(p),
  end: (p) => app.gestureEnd(p),
  cancel: () => app.gestureCancel(),
  pinch: (factor, cx, cy, dx, dy) => {
    app.zoomAround(factor, cx, cy);
    if (app.mode === '2d') {
      app.panBy(dx, dy);
    }
  },
  hover: (p) => app.hover(p),
  wheel: (factor, cx, cy) => app.zoomAround(factor, cx, cy),
});

new ResizeObserver(() => app.layout()).observe(stage);

document.getElementById('theme-toggle')?.addEventListener('click', () => toggleTheme());
onThemeChange(() => {
  app.refreshTheme();
  ui.drawPatternThumbs();
});

// Un permalien collé dans la barre d'adresse recharge l'état partagé.
window.addEventListener('hashchange', () => {
  if (location.hash.replace(/^#/, '') !== writtenHash) {
    location.reload();
  }
});

app.start();
if (warnings.length > 0) {
  ui.toast(`Lien partiellement invalide (${warnings.join(', ')}) : valeurs par défaut utilisées.`);
}
