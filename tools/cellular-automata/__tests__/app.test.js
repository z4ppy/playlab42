/**
 * @jest-environment jsdom
 */

/**
 * Tests de l'orchestration (sans canvas) : aperçu du pinceau après un geste
 * tactile et curseur clavier sur la grille.
 */

import { jest } from '@jest/globals';
import { CellularApp } from '../src/app.js';
import { DEFAULT_STATE } from '../src/hash-state.js';

/**
 * @param {Partial<import('../src/hash-state.js').ShareState>} [state]
 */
function createApp(state = {}) {
  const renderer = {
    refreshTheme() {},
    resize: () => ({ width: 480, height: 480 }),
    draw() {},
    exportPng: () => Promise.resolve(null),
  };
  const ui = { sync() {}, counters() {}, toast: jest.fn() };
  const app = new CellularApp({
    // @ts-expect-error -- doublure minimale du rendu
    renderer,
    ui,
    state: { ...DEFAULT_STATE, size: 48, cells: '!', ...state },
    reducedMotion: true,
    writeHash() {},
  });
  app.layout();
  return app;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('aperçu du pinceau', () => {
  it('disparaît quand le doigt se lève (2D)', () => {
    const app = createApp();
    app.gestureStart({ x: 100, y: 100 }, 'touch');
    expect(app.hoverCell).not.toBeNull();
    app.gestureEnd({ x: 100, y: 100 });
    expect(app.hoverCell).toBeNull();
    expect(app.currentFrame().cursor).toBeNull();
  });

  it('disparaît après un pincement (geste annulé)', () => {
    const app = createApp();
    app.gestureStart({ x: 100, y: 100 }, 'touch');
    app.gestureCancel();
    expect(app.hoverCell).toBeNull();
  });

  it('disparaît aussi en 1D', () => {
    const app = createApp({ mode: '1d' });
    app.gestureStart({ x: 50, y: 2 }, 'pen');
    app.gestureEnd({ x: 50, y: 2 });
    expect(app.currentFrame().cursor).toBeNull();
  });

  it('reste affiché à la souris, qui continue de survoler', () => {
    const app = createApp();
    app.gestureStart({ x: 100, y: 100 }, 'mouse');
    app.gestureEnd({ x: 100, y: 100 });
    expect(app.hoverCell).toEqual({ x: 10, y: 10 });
  });
});

describe('curseur clavier', () => {
  it('part du centre, se déplace et reste dans la grille', () => {
    const app = createApp();
    expect(app.showKeyCursor()).toEqual({ x: 24, y: 24 });
    expect(app.moveKeyCursor(1, -1)).toEqual({ x: 25, y: 23 });
    for (let i = 0; i < 60; i++) {
      app.moveKeyCursor(-1, 0);
    }
    expect(app.keyCursor).toEqual({ x: 0, y: 23 });
    expect(app.currentFrame().cursor).toEqual({ x: 0, y: 23 });
    expect(app.describeKeyCursor()).toBe('Colonne 1, ligne 24 : morte.');
  });

  it('Entrée bascule la cellule, l’outil Effacer l’éteint', () => {
    const app = createApp();
    app.showKeyCursor();
    expect(app.activateKeyCursor()).toBe('Cellule vivante.');
    expect(app.grid.population).toBe(1);
    expect(app.activateKeyCursor()).toBe('Cellule morte.');
    expect(app.grid.population).toBe(0);
    app.activateKeyCursor();
    app.setTool('erase');
    expect(app.activateKeyCursor()).toBe('Cellule morte.');
    expect(app.grid.population).toBe(0);
  });

  it('pose le motif choisi sous le curseur', () => {
    const app = createApp();
    app.selectPattern('glider');
    app.showKeyCursor();
    expect(app.currentFrame().ghost).toHaveLength(5);
    expect(app.activateKeyCursor()).toBe('Planeur posé.');
    expect(app.grid.population).toBe(5);
  });

  it('modifie la ligne de départ en 1D', () => {
    const app = createApp({ mode: '1d', width: 65 });
    expect(app.showKeyCursor()).toEqual({ x: 32, y: 0 });
    expect(app.moveKeyCursor(0, 5)).toEqual({ x: 32, y: 0 });
    app.moveKeyCursor(-2, 0);
    app.activateKeyCursor();
    expect(app.initialRow[30]).toBe(1);
    expect(app.history.ages[30]).toBeGreaterThan(0);
    expect(app.describeKeyCursor()).toBe('Colonne 31 sur 65 : vivante.');
  });

  it('fait suivre la vue zoomée', () => {
    const app = createApp();
    app.zoomBy(4);
    app.showKeyCursor();
    for (let i = 0; i < 30; i++) {
      app.moveKeyCursor(1, 0);
    }
    const { scale, offsetX } = app.view;
    const left = offsetX + app.keyCursor.x * scale;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + scale).toBeLessThanOrEqual(480);
  });

  it('s’efface quand la grille perd le focus', () => {
    const app = createApp();
    app.moveKeyCursor(1, 0);
    app.hideKeyCursor();
    expect(app.keyCursor).toBeNull();
    expect(app.currentFrame().cursor).toBeNull();
  });
});

describe('annulation', () => {
  it('« Tout effacer » propose une annulation marquée pour Ctrl+Z', () => {
    const app = createApp({ cells: 'bo$2bo$3o!' });
    app.clear();
    expect(app.grid.population).toBe(0);
    const [, action] = app.ui.toast.mock.calls.at(-1);
    expect(action).toMatchObject({ label: 'Annuler', undo: true });
    action.run();
    expect(app.grid.population).toBe(5);
  });
});
