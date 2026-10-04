/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { TunerController } from './TunerController.js';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 4096;

function sine(frequency, amplitude = 0.5) {
  return Float32Array.from({ length: FFT_SIZE }, (_, i) => (
    amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)
  ));
}

function createCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'calls') {return calls;}
      if (!(name in target)) {target[name] = (...args) => { calls.push([name, ...args]); };}
      return target[name];
    },
    set(target, name, value) {
      calls.push(['set', name, value]);
      target[name] = value;
      return true;
    },
  });
  const canvas = document.createElement('canvas');
  canvas.getContext = jest.fn(() => ctx);
  canvas.getBoundingClientRect = () => ({ width: 200, height: 100 });
  return { canvas, ctx, calls };
}

function buildElements() {
  document.body.innerHTML = `
    <div id="overlay"></div>
    <button id="toggle"><span class="tuner-btn-icon"></span><span class="tuner-btn-text"></span></button>
    <span id="note"></span><span id="octave"></span><span id="freq"></span><span id="cents"></span>
    <div id="indicator"></div><div id="status"></div><span id="range"></span>
    <div id="history"></div><span id="dot"></span>`;
  const $ = id => document.getElementById(id);
  const graph = createCanvas();
  return {
    elements: {
      overlay: $('overlay'), toggle: $('toggle'), note: $('note'), octave: $('octave'),
      frequency: $('freq'), cents: $('cents'), indicator: $('indicator'), status: $('status'),
      graph: graph.canvas, graphRange: $('range'), history: $('history'), liveDot: $('dot'),
    },
    graph,
  };
}

/** Micro, contexte audio et analyseur de test pilotés par `signal.current`. */
function installMicrophone(signal) {
  const track = { stop: jest.fn() };
  const stream = { getTracks: () => [track] };
  const source = { connect: jest.fn() };
  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData: jest.fn((buffer) => buffer.set(signal.current)),
  };
  const context = {
    sampleRate: SAMPLE_RATE,
    createAnalyser: () => analyser,
    createMediaStreamSource: jest.fn(() => source),
    close: jest.fn(),
  };
  const getUserMedia = jest.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  const AudioContext = jest.fn(() => context);
  window.AudioContext = AudioContext;
  return { track, stream, source, analyser, context, getUserMedia, AudioContext };
}

describe('TunerController : caractérisation', () => {
  let signal;
  let mic;
  let setup;
  let tuner;
  let logged;

  beforeEach(() => {
    jest.useFakeTimers();
    setup = buildElements();
    signal = { current: new Float32Array(FFT_SIZE) };
    mic = installMicrophone(signal);
    tuner = new TunerController(setup.elements, { formatNote: note => `♪${note}` });
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    tuner.dispose();
    logged.mockRestore();
    jest.useRealTimers();
    delete window.AudioContext;
  });

  const frame = () => jest.advanceTimersByTime(16);

  test('show/hide pilotent la visibilité et le bouton déclenche toggle', async () => {
    tuner.show();
    expect(tuner.isVisible()).toBe(true);
    tuner.show();
    setup.elements.toggle.click();
    await jest.advanceTimersByTimeAsync(0);
    expect(mic.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(tuner._active).toBe(true);
    tuner.hide();
    expect(tuner.isVisible()).toBe(false);
    expect(tuner._active).toBe(false);
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
  });

  test('start ouvre micro et analyseur, met à jour l’UI et émet started', async () => {
    const started = jest.fn();
    tuner.on('started', started);
    await tuner.start();
    expect(mic.analyser.fftSize).toBe(4096);
    expect(mic.source.connect).toHaveBeenCalledWith(mic.analyser);
    expect(started).toHaveBeenCalledTimes(1);
    const { toggle, status, liveDot } = setup.elements;
    expect(toggle.classList.contains('active')).toBe(true);
    expect(toggle.querySelector('.tuner-btn-icon').textContent).toBe('⏹');
    expect(toggle.querySelector('.tuner-btn-text').textContent).toBe('Arrêter');
    expect(status.textContent).toBe('Écoute en cours...');
    expect(status.classList.contains('active')).toBe(true);
    expect(liveDot.classList.contains('active')).toBe(true);
    expect(setup.graph.canvas.width).toBe(200);
  });

  test('un refus de micro affiche l’erreur et émet error sans rester actif', async () => {
    const failure = Object.assign(new Error('NotAllowedError'), { name: 'NotAllowedError' });
    mic.getUserMedia.mockRejectedValueOnce(failure);
    const errors = jest.fn();
    tuner.on('error', errors);
    await tuner.start();
    expect(errors).toHaveBeenCalledWith(failure);
    expect(setup.elements.status.textContent).toBe('Accès micro refusé');
    expect(setup.elements.status.classList.contains('error')).toBe(true);
    expect(tuner._active).toBe(false);
    expect(logged).toHaveBeenCalledWith('Erreur accès micro:', failure);
  });

  test('webkitAudioContext sert de repli, toggle alterne démarrage et arrêt', async () => {
    delete window.AudioContext;
    window.webkitAudioContext = mic.AudioContext;
    try {
      await tuner.toggle();
      expect(mic.AudioContext).toHaveBeenCalledTimes(1);
      expect(tuner._active).toBe(true);
      await tuner.toggle();
      expect(tuner._active).toBe(false);
    } finally {
      delete window.webkitAudioContext;
    }
  });

  test('un La 440 est détecté, affiché, historisé et émis', async () => {
    signal.current = sine(440);
    const detected = [];
    tuner.on('noteDetected', payload => detected.push(payload));
    await tuner.start();
    expect(detected).toHaveLength(1);
    frame();
    expect(detected).toHaveLength(2);
    expect(detected[0]).toMatchObject({ note: 'A', octave: 4 });
    expect(detected[0].frequency).toBeCloseTo(440, -1);
    const { note, octave, frequency, cents, indicator, liveDot, history } = setup.elements;
    expect(note.textContent).toBe('♪A');
    expect(note.classList.contains('in-tune')).toBe(true);
    expect(octave.textContent).toBe('4');
    expect(frequency.textContent).toMatch(/^44\d\.\d Hz$/);
    expect(cents.textContent).toMatch(/^\+?\d cents$/);
    expect(liveDot.classList.contains('detecting')).toBe(true);
    expect(history.querySelectorAll('.tuner-history-note')).toHaveLength(1);
    frame();
    frame();
    expect(history.querySelectorAll('.tuner-history-note')).toHaveLength(1);
    expect(setup.elements.graphRange.textContent).toMatch(/^\d+-\d+ Hz$/);
  });

  test('silence : affichage neutre, pas d’événement, indicateur live éteint', async () => {
    const detected = jest.fn();
    tuner.on('noteDetected', detected);
    await tuner.start();
    frame();
    expect(detected).not.toHaveBeenCalled();
    expect(setup.elements.note.textContent).toBe('-');
    expect(setup.elements.octave.textContent).toBe('');
    expect(setup.elements.frequency.textContent).toBe('-- Hz');
    expect(setup.elements.cents.textContent).toBe('-- cents');
    expect(setup.elements.indicator.style.left).toBe('50%');
    expect(setup.elements.liveDot.classList.contains('detecting')).toBe(false);
  });

  test('bruit sans pic de corrélation : aucune fréquence', () => {
    let seed = 1;
    const noise = Float32Array.from({ length: FFT_SIZE }, () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5);
    });
    expect(tuner._detectPitch(noise, SAMPLE_RATE)).toBe(-1);
    expect(tuner._detectPitch(new Float32Array(FFT_SIZE), SAMPLE_RATE)).toBe(-1);
    expect(tuner._detectPitch(sine(330), SAMPLE_RATE)).toBeCloseTo(330, -1);
  });

  test('conversion fréquence → note, octave et cents', () => {
    expect(tuner._frequencyToNote(440)).toMatchObject({ note: 'A', octave: 4, cents: 0 });
    expect(tuner._frequencyToNote(261.63)).toMatchObject({ note: 'C', octave: 4, cents: 0 });
    expect(tuner._frequencyToNote(246.94)).toMatchObject({ note: 'B', octave: 3 });
    expect(tuner._frequencyToNote(466.16)).toMatchObject({ note: 'A#', octave: 4 });
    const flat = tuner._frequencyToNote(440 * Math.pow(2, -20 / 1200));
    expect(flat.cents).toBe(-20);
    expect(flat.exactFrequency).toBeCloseTo(440);
  });

  test('justesse : classes in-tune/flat/sharp, indicateur borné, signe des cents', () => {
    const { note, cents, indicator } = setup.elements;
    tuner._updateDisplay({ note: 'A', octave: 4, cents: -20 }, 435.123);
    expect(note.classList.contains('flat')).toBe(true);
    expect(cents.textContent).toBe('-20 cents');
    expect(setup.elements.frequency.textContent).toBe('435.1 Hz');
    expect(indicator.style.left).toBe('30%');
    tuner._updateDisplay({ note: 'A', octave: 4, cents: 40 }, 440);
    expect(note.classList.contains('sharp')).toBe(true);
    expect(cents.textContent).toBe('+40 cents');
    expect(indicator.style.left).toBe('90%');
    tuner._updateDisplay({ note: 'A', octave: 4, cents: 49 }, 440);
    expect(indicator.style.left).toBe('99%');
    tuner._updateDisplay({ note: 'A', octave: 4, cents: 5 }, 440);
    expect(note.classList.contains('in-tune')).toBe(true);
    tuner._updateDisplay({ note: 'A', octave: 4, cents: -5 }, 440);
    expect(note.classList.contains('in-tune')).toBe(true);
    tuner._updateDisplay({ note: 'A', octave: 4, cents: 80 }, 440);
    expect(indicator.style.left).toBe('100%');
    tuner._updateDisplay({ note: 'A', octave: 4, cents: -80 }, 440);
    expect(indicator.style.left).toBe('0%');
  });

  test('sans éléments, l’affichage et l’UI sont silencieux', () => {
    const bare = new TunerController({});
    bare._updateDisplay(null, 0);
    bare._updateDisplay({ note: 'A', octave: 4, cents: 1 }, 440);
    bare._updateUI(true);
    bare._updateLiveIndicator(true);
    bare._updateStatus('x');
    bare._updateHistoryDisplay();
    bare._initGraph();
    bare._clearGraph();
    bare._drawGraph();
    bare._init();
    expect(bare.formatNote('B')).toBe('B');
    bare.dispose();
  });

  test('historique : dédoublonne, limite à 10, classe et signe des cents', () => {
    for (let octave = 1; octave <= 12; octave++) {
      tuner._addToNoteHistory({ note: 'C', octave, cents: octave % 3 === 0 ? -9 : octave % 3 === 1 ? 9 : 0 });
    }
    tuner._addToNoteHistory({ note: 'C', octave: 12, cents: 0 });
    const items = [...setup.elements.history.querySelectorAll('.tuner-history-note')];
    expect(items).toHaveLength(10);
    expect(items[0].textContent.replace(/\s+/g, ' ').trim()).toBe('♪C 12 -9');
    expect(items[0].classList.contains('flat')).toBe(true);
    expect(items[1].classList.contains('in-tune')).toBe(true);
    expect(items[2].classList.contains('sharp')).toBe(true);
    expect(items[2].textContent).toContain('+9');
  });

  test('graphe : fond, plage, lignes de notes avec libellés naturels et courbe', () => {
    tuner._frequencyHistory = [null, 220, 247, 261.63, 0, 330];
    tuner._drawGraph();
    const names = setup.graph.calls.map(c => c[0]);
    expect(names).toEqual(expect.arrayContaining(['clearRect', 'fillRect', 'beginPath', 'stroke', 'arc', 'fill']));
    expect(setup.elements.graphRange.textContent).toBe('198-363 Hz');
    const labels = setup.graph.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
    expect(labels).toEqual(expect.arrayContaining(['♪A', '♪C', '♪E']));
    expect(labels.every(label => !label.includes('#'))).toBe(true);
    expect(setup.graph.calls.filter(c => c[0] === 'moveTo').length).toBeGreaterThan(1);
    expect(setup.graph.calls.filter(c => c[0] === 'lineTo').length).toBeGreaterThan(1);
    expect(setup.graph.calls.filter(c => c[0] === 'setLineDash')).toEqual([
      ['setLineDash', [2, 4]], ['setLineDash', []],
    ]);
  });

  test('graphe : historique trop court ou sans fréquence valide ne trace que le fond', () => {
    setup.elements.graphRange.textContent = 'initial';
    tuner._frequencyHistory = [440];
    tuner._drawGraph();
    tuner._frequencyHistory = [null, null];
    tuner._drawGraph();
    expect(setup.graph.calls.some(c => c[0] === 'stroke')).toBe(false);
    expect(setup.elements.graphRange.textContent).toBe('initial');
  });

  test('graphe : dernier point absent, pas de marqueur final', () => {
    tuner._frequencyHistory = [440, 450, null];
    tuner._drawGraph();
    expect(setup.graph.calls.some(c => c[0] === 'arc')).toBe(false);
    expect(setup.graph.calls.some(c => c[0] === 'stroke')).toBe(true);
  });

  test('l’historique des fréquences est borné à 200 points', async () => {
    signal.current = sine(440);
    await tuner.start();
    for (let i = 0; i < 205; i++) { frame(); }
    expect(tuner._frequencyHistory).toHaveLength(200);
  });

  test('stop libère micro et contexte, efface graphe et historique, arrête la boucle', async () => {
    signal.current = sine(440);
    const stopped = jest.fn();
    tuner.on('stopped', stopped);
    await tuner.start();
    frame();
    tuner.stop();
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    expect(mic.context.close).toHaveBeenCalledTimes(1);
    expect(setup.elements.history.innerHTML).toBe('');
    expect(setup.elements.graphRange.textContent).toBe('-- Hz');
    expect(setup.graph.calls.some(c => c[0] === 'clearRect')).toBe(true);
    expect(setup.elements.status.textContent).toBe('Cliquez pour démarrer');
    expect(setup.elements.toggle.querySelector('.tuner-btn-text').textContent).toBe('Activer le micro');
    expect(setup.elements.liveDot.classList.contains('active')).toBe(false);
    expect(stopped).toHaveBeenCalledTimes(1);
    const reads = mic.analyser.getFloatTimeDomainData.mock.calls.length;
    jest.advanceTimersByTime(200);
    expect(mic.analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(reads);
    expect(tuner._frequencyHistory).toEqual([]);
    expect(tuner._lastNoteName).toBeNull();
    tuner.stop();
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
  });

  test('dispose arrête l’écoute et coupe les écouteurs', async () => {
    await tuner.start();
    const stopped = jest.fn();
    tuner.on('stopped', stopped);
    tuner.dispose();
    expect(mic.context.close).toHaveBeenCalledTimes(1);
    expect(stopped).toHaveBeenCalledTimes(1);
    stopped.mockClear();
    tuner.emit('stopped');
    expect(stopped).not.toHaveBeenCalled();
  });
});
