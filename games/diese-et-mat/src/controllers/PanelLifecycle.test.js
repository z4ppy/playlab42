/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { MetronomeController } from './MetronomeController.js';
import { PianoController } from './PianoController.js';
import { SynthController } from './SynthController.js';
import { TunerController } from './TunerController.js';

const stopHooks = {
  Metronome: ['_stop'],
  Piano: ['stopAllNotes'],
  Synth: null,
  Tuner: ['stop'],
};

const factories = {
  Metronome: (elements) => new MetronomeController(elements, {}),
  Piano: (elements) => new PianoController(elements, { synthManager: { on() {}, off() {}, stopAllNotes() {} } }),
  Synth: (elements) => new SynthController(elements, {}),
  Tuner: (elements) => new TunerController(elements, {}),
};

describe.each(Object.keys(factories))('Cycle de vie du panneau %s', (name) => {
  let overlay;
  let controller;

  beforeEach(() => {
    overlay = document.createElement('div');
    controller = factories[name]({ overlay });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('show ajoute la classe visible avant chaque appel à _init', () => {
    const init = jest.spyOn(controller, '_init').mockImplementation(() => {
      expect(overlay.classList.contains('visible')).toBe(true);
    });
    expect(controller.isVisible()).toBe(false);
    controller.show();
    controller.show();
    expect(overlay.className).toBe('visible');
    expect(controller.isVisible()).toBe(true);
    expect(init).toHaveBeenCalledTimes(2);
  });

  test('hide retire la classe visible puis exécute les hooks d’arrêt', () => {
    const hooks = stopHooks[name] || [];
    const seen = [];
    for (const hook of hooks) {
      jest.spyOn(controller, hook).mockImplementation(() => {
        seen.push([hook, overlay.classList.contains('visible')]);
      });
    }
    jest.spyOn(controller, '_init').mockImplementation(() => {});
    controller.show();
    controller.hide();
    expect(controller.isVisible()).toBe(false);
    expect(seen).toEqual(hooks.map((hook) => [hook, false]));
  });

  test('sans overlay, show ne fait rien et isVisible vaut false', () => {
    const bare = factories[name]({});
    const init = jest.spyOn(bare, '_init');
    expect(() => bare.show()).not.toThrow();
    expect(init).not.toHaveBeenCalled();
    expect(bare.isVisible()).toBe(false);
    expect(typeof bare.isVisible()).toBe('boolean');
  });

  test('hide sans overlay exécute quand même les hooks d’arrêt', () => {
    const hooks = stopHooks[name] || [];
    const bare = factories[name]({});
    const spies = hooks.map((hook) => jest.spyOn(bare, hook).mockImplementation(() => {}));
    expect(() => bare.hide()).not.toThrow();
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
