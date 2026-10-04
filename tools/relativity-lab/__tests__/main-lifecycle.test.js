/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { mockThreeBoundary } from './support/mock-three.js';
import { startApp, press } from './support/main-harness.js';

await mockThreeBoundary();

let harness;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('main : cycle de vie de la boucle', () => {
  test('stop puis start dans la même frame ne crée qu’une boucle', async () => {
    harness = await startApp();
    const { app, runFrame } = harness;
    const rendered = app.sceneManager.renderer.rendered;

    app.stop();
    app.start();
    const afterStart = rendered.length;
    runFrame();
    expect(rendered).toHaveLength(afterStart + 1);
    runFrame();
    expect(rendered).toHaveLength(afterStart + 2);
  });

  test('stop annule la frame planifiée', async () => {
    harness = await startApp();
    harness.app.stop();
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});

describe('main : libération des écouteurs', () => {
  test('après dispose, clavier, boutons, thème et préférences système sont inertes', async () => {
    harness = await startApp();
    const { app, mediaListeners } = harness;
    expect(mediaListeners).toHaveLength(1);
    const updateTheme = jest.spyOn(app.sceneManager, 'updateTheme');
    const removeDocument = jest.spyOn(document, 'removeEventListener');
    const simulation = app.simulation;
    const toggle = jest.spyOn(simulation, 'toggle');
    const reset = jest.spyOn(simulation, 'reset');

    app.dispose();
    press('Space');
    press('KeyR');
    document.getElementById('play-button').click();
    document.getElementById('reset-button').click();
    document.documentElement.setAttribute('data-theme', 'light');
    await Promise.resolve();
    document.documentElement.removeAttribute('data-theme');

    expect(toggle).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(simulation.state).toBe('paused');
    expect(updateTheme).not.toHaveBeenCalled();
    expect(mediaListeners).toHaveLength(0);
    for (const type of ['mousemove', 'mouseup', 'touchmove', 'touchend']) {
      expect(removeDocument.mock.calls.filter(([name]) => name === type)).toHaveLength(5);
    }
  });

  test('dispose libère aussi les panneaux (horloges, Doppler, moteur)', async () => {
    harness = await startApp();
    const { app, resizeObservers } = harness;
    const removeWindow = jest.spyOn(window, 'removeEventListener');
    const signalOf = (target, type) => target.addEventListener.mock.calls.find(([name]) => name === type)[2].signal;
    const blurSignal = signalOf(window, 'blur');
    const visibilitySignal = signalOf(document, 'visibilitychange');
    expect(blurSignal.aborted).toBe(false);
    app.dispose();
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(blurSignal.aborted).toBe(true);
    expect(visibilitySignal.aborted).toBe(true);
    expect(resizeObservers).toHaveLength(2);
    expect(resizeObservers.every((observer) => observer.disconnected)).toBe(true);
  });

  test('dispose est idempotent', async () => {
    harness = await startApp();
    harness.app.dispose();
    expect(() => harness.app.dispose()).not.toThrow();
  });
});

describe('main : échec d’initialisation', () => {
  test('libère la scène déjà créée et ne laisse aucun écouteur actif', async () => {
    harness = await startApp({ breakMatchMedia: true });
    const { app } = harness;
    expect(app.sceneManager.renderer.disposed).toBe(true);
    expect(app.simulation.observers).toHaveLength(0);
  });

  test('dispose avant toute initialisation ne lève pas', async () => {
    harness = await startApp({ omit: ['hud'] });
    expect(() => harness.app.dispose()).not.toThrow();
  });
});
