/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { PianoController } from './PianoController.js';
import { SynthManager } from '../audio/SynthManager.js';

global.structuredClone ??= value => JSON.parse(JSON.stringify(value));

function createEngine() {
  return {
    start: jest.fn().mockResolvedValue(),
    dispose: jest.fn(),
    applySettings: jest.fn(),
    getSettings: jest.fn(() => ({
      preset: 'piano',
      oscillator: 'triangle',
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
      effects: {
        reverb: { enabled: true, amount: 0.5 },
        delay: { enabled: false, time: 0.2, feedback: 0.3 },
        filter: { enabled: true, frequency: 800 },
      },
    })),
    setPreset: jest.fn(),
    setEffect: jest.fn(),
    setReverb: jest.fn(),
    setDelay: jest.fn(),
    setFilter: jest.fn(),
    noteOn: jest.fn(),
    noteOff: jest.fn(),
  };
}

function buildDom() {
  document.body.innerHTML = `
    <div id="overlay"></div><div id="keyboard"></div><div id="note"></div>
    <select id="piano-instrument-select"></select>
    <button id="piano-octave-down"></button><button id="piano-octave-up"></button>
    <span id="piano-octave-value">4</span>
    <input type="checkbox" id="piano-fx-reverb"><input id="piano-fx-reverb-amount" type="range" min="0" max="100">
    <input type="checkbox" id="piano-fx-delay"><input id="piano-fx-delay-time" type="range" min="0" max="1000">
    <input type="checkbox" id="piano-fx-filter"><input id="piano-fx-filter-freq" type="range" min="0" max="5000">`;
  return {
    overlay: document.getElementById('overlay'),
    keyboard: document.getElementById('keyboard'),
    noteDisplay: document.getElementById('note'),
  };
}

describe('PianoController : caractérisation du clavier et des contrôles', () => {
  let engine;
  let synth;
  let elements;
  let piano;

  beforeEach(() => {
    localStorage.clear();
    engine = createEngine();
    synth = new SynthManager({ audioEngine: engine });
    elements = buildDom();
    piano = new PianoController(elements, { synthManager: synth });
  });
  afterEach(() => {
    piano.dispose();
    synth.dispose();
  });

  const key = note => elements.keyboard.querySelector(`[data-note="${note}"]`);
  const fire = (el, type, init = {}) => {
    const event = new Event(type, { cancelable: true, bubbles: true });
    Object.assign(event, init);
    el.dispatchEvent(event);
    return event;
  };

  test('show construit 24 touches accessibles et le mapping AZERTY, une seule fois', () => {
    piano.show();
    expect(piano.isVisible()).toBe(true);
    expect(elements.keyboard.children).toHaveLength(24);
    expect(key('C4').getAttribute('aria-label')).toBe('Jouer Do4, raccourci Q');
    expect(key('C#4').getAttribute('aria-label')).toBe('Jouer Do♯4, raccourci 2');
    expect(key('F#5').getAttribute('aria-label')).toBe('Jouer Fa♯5');
    expect(key('C#4').className).toContain('piano-key-black');
    expect(key('C#4').style.left).toBe('42px');
    expect(piano.keyMap).toMatchObject({ q: 'C4', s: 'D4', k: 'C5', v: 'B5' });
    const first = elements.keyboard.firstChild;
    piano.show();
    expect(elements.keyboard.firstChild).toBe(first);
  });

  test('sans SynthManager, show reste inerte', () => {
    const bare = new PianoController(elements);
    bare.show();
    expect(elements.keyboard.children).toHaveLength(0);
    bare.stopNote('C4');
    bare.dispose();
  });

  test('souris : pression puis relâchement joue et coupe la note avec événements', async () => {
    piano.show();
    const events = [];
    piano.on('note-on', e => events.push(['on', e.note]));
    piano.on('note-off', e => events.push(['off', e.note]));
    const c4 = key('C4');
    const down = fire(c4, 'mousedown');
    expect(down.defaultPrevented).toBe(true);
    expect(c4.classList.contains('active')).toBe(true);
    expect(c4.getAttribute('aria-pressed')).toBe('true');
    expect(elements.noteDisplay.textContent).toBe('Do4');
    await new Promise(process.nextTick);
    expect(engine.noteOn).toHaveBeenCalledWith('C4');
    fire(c4, 'mouseup');
    expect(c4.classList.contains('active')).toBe(false);
    expect(engine.noteOff).toHaveBeenCalledWith('C4');
    expect(events).toEqual([['on', 'C4'], ['off', 'C4']]);
    fire(c4, 'mouseleave');
    expect(engine.noteOff).toHaveBeenCalledTimes(1);
  });

  test('tactile, blur et clavier natif relâchent la bonne note', async () => {
    piano.show();
    const d4 = key('D4');
    expect(fire(d4, 'touchstart').defaultPrevented).toBe(true);
    await new Promise(process.nextTick);
    fire(d4, 'touchend');
    fire(d4, 'touchstart');
    await new Promise(process.nextTick);
    fire(d4, 'touchcancel');
    fire(d4, 'keydown', { key: 'Enter', repeat: false });
    await new Promise(process.nextTick);
    fire(d4, 'keydown', { key: ' ', repeat: true });
    fire(d4, 'keydown', { key: 'a' });
    expect(engine.noteOn).toHaveBeenCalledTimes(3);
    expect(fire(d4, 'keyup', { key: 'Enter' }).defaultPrevented).toBe(true);
    fire(d4, 'keyup', { key: 'a' });
    fire(d4, 'blur');
    expect(engine.noteOff).toHaveBeenCalledTimes(3);
  });

  test('un clic synthétique (detail 0) joue puis relâche automatiquement', async () => {
    piano.show();
    const e4 = key('E4');
    fire(e4, 'click', { detail: 1 });
    expect(engine.noteOn).not.toHaveBeenCalled();
    fire(e4, 'click', { detail: 0 });
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
    expect(engine.noteOn).toHaveBeenCalledWith('E4');
    expect(engine.noteOff).toHaveBeenCalledWith('E4');
  });

  test('raccourcis clavier et notes inconnues', async () => {
    piano.show();
    piano.handleKeyDown('h');
    await new Promise(process.nextTick);
    expect(key('A4').classList.contains('active')).toBe(true);
    piano.handleKeyUp('h');
    expect(key('A4').classList.contains('active')).toBe(false);
    piano.handleKeyDown('?');
    piano.handleKeyUp('?');
    expect(engine.noteOn).toHaveBeenCalledTimes(1);
    expect(piano._noteToFrench('H9')).toBe('H9');
    expect(piano._noteToFrench('Z')).toBe('Z');
  });

  test('un échec audio est affiché sans événement note-on, un relâchement tardif l’ignore', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      piano.show();
      engine.start.mockRejectedValueOnce(new Error('contexte refusé'));
      const on = jest.fn();
      piano.on('note-on', on);
      await piano.playNote('C4', key('C4'));
      expect(elements.noteDisplay.textContent).toBe('Audio indisponible : contexte refusé');
      expect(on).not.toHaveBeenCalled();
      engine.start.mockRejectedValueOnce('texte brut');
      await piano.playNote('D4');
      expect(elements.noteDisplay.textContent).toBe('Audio indisponible : texte brut');
    } finally {
      logged.mockRestore();
    }
  });

  test('une note déjà demandée n’est pas relancée ; stopAllNotes réinitialise les touches', async () => {
    piano.show();
    const first = piano.playNote('C4', key('C4'));
    const second = piano.playNote('C4', key('C4'));
    await Promise.all([first, second]);
    await piano.playNote('E4', key('E4'));
    expect(engine.noteOn).toHaveBeenCalledTimes(2);
    piano.stopAllNotes();
    expect(elements.keyboard.querySelectorAll('.piano-key.active')).toHaveLength(0);
    expect(engine.noteOff).toHaveBeenCalledTimes(2);
    piano.hide();
    expect(piano.isVisible()).toBe(false);
  });

  test('les boutons d’octave bornent entre 1 et 6 et reconstruisent le clavier', () => {
    piano.show();
    const down = document.getElementById('piano-octave-down');
    const up = document.getElementById('piano-octave-up');
    const value = document.getElementById('piano-octave-value');
    for (let i = 0; i < 5; i++) { down.click(); }
    expect(piano.baseOctave).toBe(1);
    expect(value.textContent).toBe('1');
    expect(key('C1')).not.toBeNull();
    expect(piano.keyMap.q).toBe('C1');
    for (let i = 0; i < 8; i++) { up.click(); }
    expect(piano.baseOctave).toBe(6);
    expect(key('C6')).not.toBeNull();
    expect(key('C1')).toBeNull();
  });

  test('presets groupés, sélection courante et changement relayé au SynthManager', () => {
    piano.show();
    const select = document.getElementById('piano-instrument-select');
    expect([...select.querySelectorAll('optgroup')].map(g => g.label)).toEqual([
      'Claviers', 'Guitares', 'Synthés', 'Percussions',
    ]);
    expect(select.value).toBe('piano');
    expect(select.querySelector('option[value="organ"]').textContent).toContain('🎵');
    select.value = 'organ';
    select.dispatchEvent(new Event('change'));
    expect(synth.preset).toBe('organ');
    synth.setPreset('bell');
    expect(select.value).toBe('bell');
    synth.setPreset('bell');
  });

  test('effets : état initial, interactions et resynchronisation sur effect-changed', () => {
    piano.show();
    const box = id => document.getElementById(id);
    expect(box('piano-fx-reverb').checked).toBe(false);
    expect(box('piano-fx-reverb-amount').disabled).toBe(true);
    box('piano-fx-reverb').checked = true;
    box('piano-fx-reverb').dispatchEvent(new Event('change'));
    expect(box('piano-fx-reverb-amount').disabled).toBe(false);
    expect(engine.setReverb).not.toHaveBeenCalled();
    box('piano-fx-delay-time').value = '400';
    box('piano-fx-delay-time').dispatchEvent(new Event('input'));
    box('piano-fx-filter-freq').value = '1200';
    box('piano-fx-filter-freq').dispatchEvent(new Event('input'));
    expect(synth.effects.delay.time).toBeCloseTo(0.4);
    expect(synth.effects.filter.frequency).toBe(1200);
    box('piano-fx-reverb-amount').value = '70';
    box('piano-fx-reverb-amount').dispatchEvent(new Event('input'));
    expect(synth.effects.reverb.amount).toBeCloseTo(0.7);
    expect(synth.effects.reverb.enabled).toBe(true);

    synth.setEffect('delay', { enabled: true });
    expect(box('piano-fx-delay').checked).toBe(true);
    expect(box('piano-fx-delay-time').disabled).toBe(false);
  });

  test('sans éléments d’effets ni SynthManager, les contrôles restent silencieux', () => {
    document.body.innerHTML = '';
    const bare = new PianoController({}, { synthManager: synth });
    bare.show();
    bare._initControls();
    bare._syncEffectsUI();
    bare._updatePresetUI('organ');
    bare.handleKeyDown('q');
    bare.stopAllNotes();
    bare.dispose();
    const noSynth = new PianoController({});
    noSynth._initEffects();
    noSynth._syncEffectsUI();
    noSynth.dispose();
  });

  test('dispose retire les écouteurs du SynthManager et permet de réinitialiser', () => {
    piano.show();
    const select = document.getElementById('piano-instrument-select');
    piano.dispose();
    synth.setPreset('bell');
    expect(select.value).not.toBe('bell');
    expect(piano._cleanupHandlers).toEqual([]);
    expect(piano._initialized).toBe(false);
  });
});
