/** @jest-environment jsdom */
import { SynthManager } from './SynthManager.js';

// jsdom n'expose pas structuredClone, présent dans les navigateurs ciblés
global.structuredClone ??= value => JSON.parse(JSON.stringify(value));

describe('SynthManager : isolation des réglages par défaut', () => {
  beforeEach(() => localStorage.clear());

  test('modifier un effet ne contamine pas une nouvelle instance', () => {
    const first = new SynthManager();
    first.setEffect('delay', { time: 0.9 });
    first.dispose();
    localStorage.clear();

    const second = new SynthManager();
    expect(second.config.effects.delay.time).not.toBe(0.9);
    second.dispose();
  });

  test('modifier un paramètre de synthé ne contamine pas une nouvelle instance', () => {
    const first = new SynthManager();
    first.setSynthParam('fm', 'harmonicity', 42);
    first.dispose();
    localStorage.clear();

    const second = new SynthManager();
    expect(second.config.fm?.harmonicity).not.toBe(42);
    second.dispose();
  });

  test('resetConfig restaure réellement les effets par défaut', () => {
    const manager = new SynthManager();
    const initial = manager.config.effects.reverb;
    manager.setEffect('reverb', { amount: 0.77, enabled: !initial.enabled });
    manager.resetConfig();
    expect(manager.config.effects.reverb).toEqual(initial);
    manager.dispose();
  });
});
