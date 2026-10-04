/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { EventEmitter } from '../utils/EventEmitter.js';
import { SynthController } from './SynthController.js';

function makeManager(config = {}) {
  const manager = new EventEmitter();
  Object.assign(manager, {
    config,
    preset: 'piano',
    oscillator: 'sine',
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1 },
    effects: config.effects || {},
    isAudioReady: false,
    getCurrentSynthType: () => 'mono',
    setPreset: jest.fn(),
    setOscillator: jest.fn(),
    setEnvelope: jest.fn(),
    setSynthParam: jest.fn(),
    setEffect: jest.fn(),
    toggleEffect: jest.fn(),
    setVolume: jest.fn(),
  });
  return manager;
}

function open(html, config) {
  document.body.innerHTML = `<div id="overlay"></div>${html}`;
  const manager = makeManager(config);
  const controller = new SynthController({ overlay: document.getElementById('overlay') }, { synthManager: manager });
  controller.show();
  return { controller, manager };
}

const input = (id, value) => {
  const slider = document.getElementById(`synth-${id}`);
  slider.value = String(value);
  slider.dispatchEvent(new Event('input'));
};

describe('SynthController : panneau partiel ou sans gestionnaire', () => {
  test('sans aucun contrôle dans le DOM, afficher, synchroniser et détruire ne plante pas', () => {
    const { controller, manager } = open('');
    expect(controller.isVisible()).toBe(true);
    expect(() => {
      manager.emit('preset-changed', { preset: 'organ' });
      manager.emit('oscillator-changed', { oscillator: 'square' });
      manager.emit('effect-changed', { effectName: 'reverb', config: { enabled: true, amount: 0.1 } });
      manager.emit('config-changed', {});
    }).not.toThrow();
    controller.hide();
    expect(controller.isVisible()).toBe(false);
    controller.dispose();
    expect(manager.listenerCount('config-changed')).toBe(0);
  });

  test('sans gestionnaire ni options, le panneau s’affiche sans rien brancher', () => {
    document.body.innerHTML = '<div id="overlay"></div><input type="range" id="synth-attack"><span id="synth-attack-value">-</span>';
    const controller = new SynthController({ overlay: document.getElementById('overlay') });
    expect(() => controller.show()).not.toThrow();
    expect(controller.isVisible()).toBe(true);
    expect(document.getElementById('synth-attack-value').textContent).toBe('-');
    expect(() => controller.dispose()).not.toThrow();
  });

  test('un contrôle typé sans data-types reste masqué', () => {
    open('<div class="synth-typed-control" id="plain"></div><div class="synth-typed-control" data-types="mono" id="mono"></div>');
    expect(document.getElementById('plain').classList.contains('visible')).toBe(false);
    expect(document.getElementById('mono').classList.contains('visible')).toBe(true);
  });

  test('envelope-changed sans enveloppe laisse les curseurs inchangés', () => {
    const { manager } = open('<input type="range" id="synth-attack"><span id="synth-attack-value">avant</span>');
    const before = document.getElementById('synth-attack-value').textContent;
    manager.emit('envelope-changed', {});
    expect(document.getElementById('synth-attack-value').textContent).toBe(before);
    manager.emit('envelope-changed', { envelope: { attack: 0.3, decay: 0.1, sustain: 0.1, release: 1 } });
    expect(document.getElementById('synth-attack-value').textContent).toBe('300ms');
  });

  test('un curseur sans libellé envoie quand même sa valeur au gestionnaire', () => {
    const { manager } = open('<input type="range" id="synth-decay">');
    input('decay', 800);
    expect(manager.setEnvelope).toHaveBeenCalledWith({ decay: 0.8 });
  });

  test('un effet sans case garde son curseur fonctionnel et ne branche pas de bascule', () => {
    const { manager } = open('<input type="range" id="synth-delay-time"><span id="synth-delay-time-value"></span>', {
      effects: { delay: { enabled: true, time: 0.5, feedback: 0.3 } },
    });
    expect(document.getElementById('synth-delay-time-value').textContent).toBe('500ms');
    input('delay-time', 250);
    expect(manager.setEffect).toHaveBeenCalledWith('delay', { time: 0.25 });
    expect(manager.toggleEffect).not.toHaveBeenCalled();
    manager.emit('effect-changed', { effectName: 'delay', config: { enabled: false, time: 0.1, feedback: 0.3 } });
    expect(document.getElementById('synth-delay-time-value').textContent).toBe('100ms');
  });

  test('les effets absents de la configuration s’initialisent désactivés avec leurs défauts', () => {
    const { manager } = open(`
      <input type="checkbox" id="synth-reverb-enabled" checked>
      <input type="range" id="synth-reverb-amount"><span id="synth-reverb-amount-value"></span>`, { effects: {} });
    expect(document.getElementById('synth-reverb-enabled').checked).toBe(false);
    expect(document.getElementById('synth-reverb-amount-value').textContent).toBe('30%');
    input('reverb-amount', 80);
    expect(manager.setEffect).toHaveBeenCalledWith('reverb', { amount: 0.8 });
  });

  test('les contrôles Noise s’initialisent sans commander le gestionnaire', () => {
    const { manager } = open(`
      <select id="synth-noise-type"><option value="white">w</option><option value="pink">p</option></select>
      <input type="range" id="synth-noise-filter-freq"><span id="synth-noise-filter-freq-value"></span>`);
    expect(document.getElementById('synth-noise-filter-freq-value').textContent).toBe('3000 Hz');
    const select = document.getElementById('synth-noise-type');
    select.value = 'pink';
    select.dispatchEvent(new Event('change'));
    input('noise-filter-freq', 500);
    expect(document.getElementById('synth-noise-filter-freq-value').textContent).toBe('500 Hz');
    expect(manager.setSynthParam).not.toHaveBeenCalled();
    expect(manager.setEffect).not.toHaveBeenCalled();
  });

  test('les boutons d’oscillateur sont ignorés quand leur conteneur est absent', () => {
    const { controller, manager } = open('<button class="synth-osc-btn" data-osc="sine"></button>');
    manager.emit('oscillator-changed', { oscillator: 'sine' });
    expect(document.querySelector('.synth-osc-btn').classList.contains('active')).toBe(false);
    document.querySelector('.synth-osc-btn').click();
    expect(manager.setOscillator).not.toHaveBeenCalled();
    controller.dispose();
  });
});
