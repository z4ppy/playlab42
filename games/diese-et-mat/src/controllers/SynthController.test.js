/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { EventEmitter } from '../utils/EventEmitter.js';
import { SynthController } from './SynthController.js';
import { AudioEngine } from '../audio/AudioEngine.js';

const SLIDERS = [
  'attack', 'decay', 'sustain', 'release',
  'fm-harmonicity', 'fm-modulation-index',
  'pluck-attack-noise', 'pluck-dampening', 'pluck-resonance', 'pluck-release',
  'membrane-pitch-decay', 'membrane-octaves',
  'metal-frequency', 'metal-harmonicity', 'metal-modulation-index', 'metal-resonance', 'metal-octaves',
  'reverb-amount', 'delay-time', 'delay-feedback', 'filter-frequency', 'volume',
];

function buildDom() {
  document.body.innerHTML = `
    <div id="overlay"></div>
    <select id="synth-preset-select"></select>
    <select id="synth-type-select"><option value="mono">mono</option><option value="fm">fm</option></select>
    <div id="synth-oscillators">
      <button class="synth-osc-btn" data-osc="sine"></button>
      <button class="synth-osc-btn" data-osc="square"></button>
    </div>
    <div class="synth-typed-control" data-types="fm,pluck" id="typed-fm"></div>
    <div class="synth-typed-control" id="typed-none"></div>
    ${SLIDERS.map((id) => `<input type="range" id="synth-${id}"><span id="synth-${id}-value">-</span>`).join('')}
    <input type="checkbox" id="synth-reverb-enabled">
    <input type="checkbox" id="synth-delay-enabled">
    <input type="checkbox" id="synth-filter-enabled">
  `;
}

function label(id) {
  return document.getElementById(`synth-${id}-value`).textContent;
}

function makeManager(config, type = 'fm') {
  const manager = new EventEmitter();
  Object.assign(manager, {
    config,
    preset: config.preset,
    oscillator: config.oscillator,
    envelope: config.envelope || { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1 },
    effects: config.effects || {},
    isAudioReady: false,
    getCurrentSynthType: () => type,
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

function open(config, type) {
  buildDom();
  const manager = makeManager(config, type);
  const controller = new SynthController({ overlay: document.getElementById('overlay') }, { synthManager: manager });
  controller.show();
  return { controller, manager };
}

const FULL = {
  preset: 'piano',
  oscillator: 'square',
  envelope: { attack: 0.123, decay: 0.456, sustain: 0.75, release: 1.5 },
  fm: { harmonicity: 2.46, modulationIndex: 7.6 },
  pluck: { attackNoise: 2.5, dampening: 1234.6, resonance: 0.95, release: 1.25 },
  membrane: { pitchDecay: 0.0123, octaves: 5.6 },
  metal: { frequency: 321.4, harmonicity: 6.66, modulationIndex: 41.5, resonance: 5555.5, octaves: 2.25 },
  effects: {
    reverb: { enabled: true, amount: 0.55 },
    delay: { enabled: false, time: 0.35, feedback: 0.45 },
    filter: { enabled: true, frequency: 888.8 },
  },
};

describe('SynthController : mise à jour des curseurs', () => {
  test('affiche chaque valeur avec son unité à l’initialisation', () => {
    open(FULL);
    expect(label('attack')).toBe('123ms');
    expect(label('decay')).toBe('456ms');
    expect(label('sustain')).toBe('75%');
    expect(label('release')).toBe('1.50s');
    expect(label('fm-harmonicity')).toBe('2.5');
    expect(label('fm-modulation-index')).toBe('8');
    expect(label('pluck-attack-noise')).toBe('2.5');
    expect(label('pluck-dampening')).toBe('1235 Hz');
    expect(label('pluck-resonance')).toBe('0.95');
    expect(label('pluck-release')).toBe('1.3s');
    expect(label('membrane-pitch-decay')).toBe('0.012s');
    expect(label('membrane-octaves')).toBe('6');
    expect(label('metal-frequency')).toBe('321 Hz');
    expect(label('metal-harmonicity')).toBe('6.7');
    expect(label('metal-modulation-index')).toBe('42');
    expect(label('metal-resonance')).toBe('5556 Hz');
    expect(label('metal-octaves')).toBe('2.3');
    expect(label('reverb-amount')).toBe('55%');
    expect(label('delay-time')).toBe('350ms');
    expect(label('delay-feedback')).toBe('45%');
    expect(label('filter-frequency')).toBe('889 Hz');
    expect(label('volume')).toBe('-10 dB');
  });

  test('config-changed relit la config et met à jour libellés, curseurs et effets', () => {
    const { manager } = open({ preset: 'piano', oscillator: 'sine' });
    expect(label('fm-harmonicity')).toBe('3.0');
    manager.config = { ...FULL, effects: { reverb: { enabled: true, amount: 0.2 } } };
    manager.emit('config-changed', {});
    expect(label('attack')).toBe('123ms');
    expect(label('fm-harmonicity')).toBe('2.5');
    expect(label('pluck-release')).toBe('1.3s');
    expect(label('membrane-octaves')).toBe('6');
    expect(label('metal-octaves')).toBe('2.3');
    expect(label('reverb-amount')).toBe('20%');
    expect(document.getElementById('synth-reverb-enabled').checked).toBe(true);
    expect(document.getElementById('synth-delay-enabled').checked).toBe(false);
    expect(label('delay-time')).toBe('200ms');
  });

  test('les valeurs fausses 0, null ou undefined retombent sur les défauts', () => {
    const { manager } = open({ preset: 'piano', oscillator: 'sine' });
    manager.config = {
      fm: { harmonicity: 0, modulationIndex: null },
      pluck: { attackNoise: 0, dampening: undefined, resonance: null, release: 0 },
      membrane: { pitchDecay: 0, octaves: null },
      metal: { frequency: 0, harmonicity: null, modulationIndex: 0, resonance: undefined, octaves: 0 },
      effects: {
        reverb: { enabled: false, amount: 0 },
        delay: { enabled: false, time: null, feedback: 0 },
        filter: { enabled: false },
      },
    };
    manager.emit('config-changed', {});
    expect(label('fm-harmonicity')).toBe('3.0');
    expect(label('fm-modulation-index')).toBe('10');
    expect(label('pluck-attack-noise')).toBe('1.5');
    expect(label('pluck-dampening')).toBe('3500 Hz');
    expect(label('pluck-resonance')).toBe('0.98');
    expect(label('pluck-release')).toBe('2.0s');
    expect(label('membrane-pitch-decay')).toBe('0.050s');
    expect(label('membrane-octaves')).toBe('8');
    expect(label('metal-frequency')).toBe('400 Hz');
    expect(label('metal-harmonicity')).toBe('5.1');
    expect(label('metal-modulation-index')).toBe('32');
    expect(label('metal-resonance')).toBe('4000 Hz');
    expect(label('metal-octaves')).toBe('1.5');
    expect(label('reverb-amount')).toBe('30%');
    expect(label('delay-time')).toBe('200ms');
    expect(label('delay-feedback')).toBe('30%');
    expect(label('filter-frequency')).toBe('2000 Hz');
  });

  test('les sections et effets absents laissent l’affichage inchangé', () => {
    const { manager } = open(FULL);
    const before = SLIDERS.map(label);
    manager.config = { preset: 'piano', oscillator: 'sine', effects: { chorus: { enabled: true } } };
    manager.emit('config-changed', {});
    expect(SLIDERS.map(label)).toEqual(before);
    manager.config = { preset: 'piano', oscillator: 'sine', effects: { delay: { enabled: false, time: 0.5, feedback: 0.1 } } };
    manager.emit('config-changed', {});
    expect(label('delay-time')).toBe('500ms');
    expect(label('reverb-amount')).toBe('55%');
  });

  test('tolère l’absence des éléments DOM de curseurs', () => {
    const { manager } = open(FULL);
    document.body.innerHTML = '';
    expect(() => manager.emit('config-changed', {})).not.toThrow();
  });
});

describe('SynthController : presets et panneau', () => {
  test('changer de preset applique le preset, les contrôles typés puis les curseurs', () => {
    const { controller, manager } = open(FULL);
    const order = [];
    manager.setPreset.mockImplementation((value) => {
      order.push(`setPreset:${value}`);
      manager.config = { ...FULL, fm: { harmonicity: 9, modulationIndex: 20 } };
    });
    controller.on('preset-selected', ({ preset }) => order.push(`event:${preset}`));
    const select = document.getElementById('synth-preset-select');
    expect(select.querySelectorAll('optgroup').length).toBe(4);
    select.value = 'organ';
    select.dispatchEvent(new Event('change'));
    expect(order).toEqual(['setPreset:organ', 'event:organ']);
    expect(label('fm-harmonicity')).toBe('9.0');
    expect(document.getElementById('typed-fm').classList.contains('visible')).toBe(true);
    expect(document.getElementById('typed-none').classList.contains('visible')).toBe(false);
  });

  test('l’événement preset-changed du gestionnaire synchronise le select', () => {
    const { manager } = open(FULL);
    manager.emit('preset-changed', { preset: 'organ' });
    expect(document.getElementById('synth-preset-select').value).toBe('organ');
  });

  test('les boutons d’oscillateur reflètent l’actif et émettent la sélection', () => {
    const { controller, manager } = open(FULL);
    const [sine, square] = document.querySelectorAll('.synth-osc-btn');
    expect(square.getAttribute('aria-pressed')).toBe('true');
    const selected = [];
    controller.on('oscillator-selected', (payload) => selected.push(payload));
    sine.click();
    expect(manager.setOscillator).toHaveBeenCalledWith('sine');
    expect(selected).toEqual([{ oscillator: 'sine' }]);
    expect(sine.classList.contains('active')).toBe(true);
    expect(square.getAttribute('aria-pressed')).toBe('false');
  });

  test('l’interaction avec un curseur envoie la valeur convertie et met à jour son libellé', () => {
    const { manager } = open(FULL);
    const slider = document.getElementById('synth-attack');
    slider.value = '500';
    slider.dispatchEvent(new Event('input'));
    expect(manager.setEnvelope).toHaveBeenCalledWith({ attack: 0.5 });
    expect(label('attack')).toBe('500ms');
  });

  test('dispose retire les écouteurs du gestionnaire', () => {
    const { controller, manager } = open(FULL);
    expect(manager.listenerCount('config-changed')).toBe(1);
    controller.dispose();
    expect(manager.listenerCount('config-changed')).toBe(0);
  });
});

describe('SynthController : callbacks des curseurs et commandes', () => {
  const input = (id, value) => {
    const slider = document.getElementById(`synth-${id}`);
    slider.value = String(value);
    slider.dispatchEvent(new Event('input'));
  };

  test('chaque curseur de paramètre envoie la valeur convertie au gestionnaire', () => {
    const { manager } = open(FULL);
    input('decay', 500);
    input('sustain', 40);
    input('release', 2000);
    expect(manager.setEnvelope.mock.calls).toEqual([[{ decay: 0.5 }], [{ sustain: 0.4 }], [{ release: 2 }]]);

    input('fm-harmonicity', 4);
    input('fm-modulation-index', 12);
    input('pluck-attack-noise', 20);
    input('pluck-dampening', 2000);
    input('pluck-resonance', 95);
    input('pluck-release', 1000);
    input('membrane-pitch-decay', 100);
    input('membrane-octaves', 4);
    input('metal-frequency', 500);
    input('metal-harmonicity', 6);
    input('metal-modulation-index', 20);
    input('metal-resonance', 3000);
    input('metal-octaves', 2);
    expect(manager.setSynthParam.mock.calls).toEqual([
      ['fm', 'harmonicity', 4], ['fm', 'modulationIndex', 12],
      ['pluck', 'attackNoise', 2], ['pluck', 'dampening', 2000], ['pluck', 'resonance', 0.95], ['pluck', 'release', 1],
      ['membrane', 'pitchDecay', 0.1], ['membrane', 'octaves', 4],
      ['metal', 'frequency', 500], ['metal', 'harmonicity', 6], ['metal', 'modulationIndex', 20],
      ['metal', 'resonance', 3000], ['metal', 'octaves', 2],
    ]);
  });

  test('les curseurs d’effets et de volume appellent le gestionnaire et leurs cases', () => {
    const { manager } = open(FULL);
    input('reverb-amount', 50);
    input('delay-time', 400);
    input('delay-feedback', 60);
    input('filter-frequency', 1500);
    input('volume', -20);
    expect(manager.setEffect.mock.calls).toEqual([
      ['reverb', { amount: 0.5 }], ['delay', { time: 0.4 }], ['delay', { feedback: 0.6 }], ['filter', { frequency: 1500 }],
    ]);
    expect(manager.setVolume).toHaveBeenCalledWith(-20);
    expect(label('volume')).toBe('-20 dB');
    const reverb = document.getElementById('synth-reverb-enabled');
    expect(reverb.checked).toBe(true);
    reverb.checked = false;
    reverb.dispatchEvent(new Event('change'));
    expect(manager.toggleEffect).toHaveBeenCalledWith('reverb', false);
  });

  test('effect-changed et envelope-changed mettent à jour l’interface', () => {
    const { manager } = open(FULL);
    manager.emit('effect-changed', { effectName: 'filter', config: { enabled: false, frequency: 500 } });
    expect(document.getElementById('synth-filter-enabled').checked).toBe(false);
    expect(label('filter-frequency')).toBe('500 Hz');
    manager.emit('effect-changed', { effectName: 'inconnu', config: { enabled: true } });
    manager.emit('envelope-changed', { envelope: { attack: 0.2, decay: 0.1, sustain: 0.1, release: 0.5 } });
    expect(label('attack')).toBe('200ms');
    manager.emit('oscillator-changed', { oscillator: 'sine' });
    expect(document.querySelector('[data-osc="sine"]').classList.contains('active')).toBe(true);
  });

  test('le select de type applique le type seulement si l’audio est prêt', () => {
    const { manager } = open(FULL, 'mono');
    manager.audioEngine = { setSynthType: jest.fn() };
    const select = document.getElementById('synth-type-select');
    select.value = 'fm';
    select.dispatchEvent(new Event('change'));
    expect(manager.audioEngine.setSynthType).not.toHaveBeenCalled();
    expect(select.value).toBe('mono');
    select.value = 'fm';
    manager.isAudioReady = true;
    select.dispatchEvent(new Event('change'));
    expect(manager.audioEngine.setSynthType).toHaveBeenCalledWith('fm');
  });

  test('le bouton de test joue C4 puis se réactive, ou signale l’échec', async () => {
    document.body.innerHTML = '';
    const { manager } = open(FULL);
    document.body.insertAdjacentHTML('beforeend', '<button id="synth-test-btn"></button>');
    const second = new SynthController({ overlay: document.getElementById('overlay') }, { synthManager: manager });
    second.show();
    const button = document.getElementById('synth-test-btn');
    manager.playNote = jest.fn().mockResolvedValue(undefined);
    button.click();
    expect(button.disabled).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.playNote).toHaveBeenCalledWith('C4', '8n');
    expect(button.disabled).toBe(false);

    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    manager.playNote = jest.fn().mockRejectedValue(new Error('x'));
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button.title).toBe('Audio indisponible : réessayez');
    expect(button.disabled).toBe(false);
    logged.mockRestore();
  });
});

describe('SynthController : construction du select des presets', () => {
  const options = () => [...document.querySelectorAll('#synth-preset-select optgroup')].map((group) => [
    group.label,
    [...group.querySelectorAll('option')].map((option) => [option.value, option.textContent, option.selected]),
  ]);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('quatre groupes ordonnés, libellés sans icône et preset courant sélectionné', () => {
    open({ ...FULL, preset: 'bell' });
    const presets = AudioEngine.getPresets();
    expect(options().map(([label]) => label)).toEqual(['Claviers', 'Guitares', 'Synthés', 'Percussions']);
    expect(options().map(([, group]) => group.map(([value]) => value))).toEqual([
      ['piano', 'electricPiano', 'organ'],
      ['guitarClassic', 'guitarFolk', 'guitarElectric'],
      ['synthLead', 'retro8bit', 'bell'],
      ['percKick', 'percSnare', 'percTom', 'percWood', 'percHihat', 'percCymbal'],
    ]);
    for (const [, group] of options()) {
      for (const [value, text, selected] of group) {
        expect(text).toBe(presets[value].name);
        expect(selected).toBe(value === 'bell');
      }
    }
    expect(document.getElementById('synth-preset-select').value).toBe('bell');
  });

  test('un preset absent du catalogue est ignoré mais son groupe reste présent', () => {
    jest.spyOn(AudioEngine, 'getPresets').mockReturnValue({ piano: { name: 'Piano' }, retro8bit: { name: 'Rétro' } });
    open({ ...FULL, preset: 'retro8bit' });
    expect(options()).toEqual([
      ['Claviers', [['piano', 'Piano', false]]],
      ['Guitares', []],
      ['Synthés', [['retro8bit', 'Rétro', true]]],
      ['Percussions', []],
    ]);
  });

  test('sans preset courant, aucune option n\'est sélectionnée', () => {
    open({ ...FULL, preset: undefined });
    expect(options().flatMap(([, group]) => group).filter(([, , selected]) => selected)).toEqual([]);
  });
});

describe('SynthController : abonnements au gestionnaire', () => {
  const EVENTS = ['preset-changed', 'oscillator-changed', 'envelope-changed', 'effect-changed', 'config-changed'];

  test('un abonnement par événement, tous retirés à la destruction sans toucher les autres', () => {
    const { controller, manager } = open(FULL);
    const foreign = jest.fn();
    manager.on('preset-changed', foreign);
    expect(EVENTS.map((event) => manager.listenerCount(event))).toEqual([2, 1, 1, 1, 1]);
    controller.dispose();
    expect(EVENTS.map((event) => manager.listenerCount(event))).toEqual([1, 0, 0, 0, 0]);
    manager.emit('preset-changed', { preset: 'organ' });
    expect(foreign).toHaveBeenCalledTimes(1);
  });
});
