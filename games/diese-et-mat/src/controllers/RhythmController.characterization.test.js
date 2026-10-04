/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { RhythmController } from './RhythmController.js';

const QUESTION = {
  tempo: 120,
  beatsPerMeasure: 4,
  pattern: [
    { startBeat: 0, duration: 'quarter' },
    { startBeat: 1, duration: 'half' },
    { startBeat: 2.5, duration: 'eighth' },
  ],
};

function createMetronome() {
  return {
    _clickSynth: {},
    _playClick: jest.fn(),
    setTempo: jest.fn(),
    setTimeSignature: jest.fn(),
    start: jest.fn().mockResolvedValue(),
    stop: jest.fn(),
  };
}

function mount(controller, question = QUESTION) {
  document.body.innerHTML = '<div id="question"></div><div id="feedback-container"></div>';
  const container = document.getElementById('question');
  controller.show(question, container);
  return container;
}

describe('RhythmController : caractérisation du mode rythme', () => {
  let metronome;
  let controller;
  let warn;

  beforeEach(() => {
    jest.useFakeTimers();
    metronome = createMetronome();
    controller = new RhythmController({ getMetronome: () => metronome });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    controller.dispose();
    warn.mockRestore();
    jest.useRealTimers();
  });

  test('show construit la piste, marque les notes et initialise l’état', () => {
    const container = mount(controller);
    const cells = [...container.querySelectorAll('.rhythm-beat')];
    expect(cells).toHaveLength(4);
    expect(cells.map(c => c.dataset.hasNote)).toEqual(['true', 'true', 'true', undefined]);
    expect(cells[1].dataset.noteIndex).toBe('1');
    expect(cells[1].textContent).toContain('Blanche');
    expect(cells[3].textContent).toContain('-');
    expect(container.querySelector('#rhythm-tap-zone').textContent).toBe('TAP');
    expect(container.textContent).toContain('Tempo: 120 BPM');
    expect(controller.state).toMatchObject({
      beatDuration: 500, hits: 0, misses: 0, started: false, currentBeat: -1,
      noteResults: [null, null, null],
    });
    expect(controller.isRunning).toBe(false);
  });

  test('start prépare audio et métronome puis lance 3, 2, 1, GO avant la lecture', async () => {
    const ensure = jest.fn().mockResolvedValue();
    controller = new RhythmController({ getMetronome: () => metronome, ensureAudioReady: ensure });
    mount(controller);
    const started = jest.fn();
    controller.on('rhythm-started', started);
    const feedback = document.getElementById('feedback-container');
    await controller.start();
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(metronome.setTempo).toHaveBeenCalledWith(120);
    expect(metronome.setTimeSignature).toHaveBeenCalledWith(4, 4);
    expect(document.getElementById('btn-start-rhythm').style.display).toBe('none');
    expect(document.activeElement).toBe(document.getElementById('rhythm-tap-zone'));
    expect(feedback.textContent.trim()).toBe('3');
    await controller.start();
    expect(metronome.setTempo).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(500);
    expect(feedback.textContent.trim()).toBe('2');
    jest.advanceTimersByTime(500);
    expect(feedback.textContent.trim()).toBe('1');
    jest.advanceTimersByTime(500);
    expect(feedback.textContent.trim()).toBe('GO!');
    expect(metronome._playClick.mock.calls.map(c => c[0])).toEqual([false, false, true]);
    expect(started).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(feedback.textContent).toBe('');
    expect(controller.isRunning).toBe(true);
    expect(metronome.start).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledTimes(1);
  });

  test('une indisponibilité audio passe en mode silencieux mais le compte à rebours continue', async () => {
    controller = new RhythmController({
      getMetronome: () => metronome,
      ensureAudioReady: () => Promise.reject(new Error('micro')),
    });
    mount(controller);
    await controller.start();
    expect(warn).toHaveBeenCalledWith('Audio non disponible, mode silencieux');
    expect(metronome.setTempo).not.toHaveBeenCalled();
    expect(document.getElementById('feedback-container').textContent.trim()).toBe('3');
  });

  test('sans métronome ni feedback, start et lecture ne cassent pas', async () => {
    controller = new RhythmController();
    document.body.innerHTML = '';
    const container = document.createElement('div');
    document.body.appendChild(container);
    controller.show(QUESTION, container);
    await controller.start();
    jest.advanceTimersByTime(1800);
    expect(controller.isRunning).toBe(true);
    controller.stop();
    controller.start();
    expect(controller.isRunning).toBe(false);
  });

  test('un échec du métronome au lancement est journalisé sans arrêter le rythme', async () => {
    metronome.start.mockRejectedValue(new Error('contexte suspendu'));
    mount(controller);
    await controller.start();
    jest.advanceTimersByTime(1800);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.isRunning).toBe(true);
    expect(warn).toHaveBeenCalledWith('Audio du rythme indisponible:', expect.any(Error));
  });

  test('un tap avant démarrage lance l’exercice, pas un second départ', async () => {
    mount(controller);
    const zone = document.getElementById('rhythm-tap-zone');
    zone.dispatchEvent(new Event('mousedown', { cancelable: true }));
    expect(zone.classList.contains('pressed')).toBe(true);
    await Promise.resolve();
    expect(controller.state.starting).toBe(true);
    zone.dispatchEvent(new Event('touchstart', { cancelable: true }));
    await jest.advanceTimersByTimeAsync(100);
    expect(zone.classList.contains('pressed')).toBe(false);
    expect(metronome.setTempo).toHaveBeenCalledTimes(1);
  });

  test('clavier : Entrée/Espace tapent sans répétition, les autres touches sont ignorées', () => {
    mount(controller);
    const taps = jest.fn();
    controller.on('tap', taps);
    controller._state.started = true;
    controller._state.startTime = Date.now();
    const zone = document.getElementById('rhythm-tap-zone');
    const key = (k, extra = {}) => {
      const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...extra });
      zone.dispatchEvent(event);
      return event;
    };
    expect(key('Enter').defaultPrevented).toBe(true);
    key(' ');
    key(' ', { repeat: true });
    key('a');
    expect(taps).toHaveBeenCalledTimes(2);
    zone.dispatchEvent(new MouseEvent('click', { detail: 1 }));
    expect(taps).toHaveBeenCalledTimes(2);
    zone.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(taps).toHaveBeenCalledTimes(3);
  });

  test('un exercice complet marque réussites, manqués, score et émet rhythm-ended', async () => {
    mount(controller);
    const taps = [];
    const ended = jest.fn();
    controller.on('tap', payload => taps.push(payload.hit));
    controller.on('rhythm-ended', ended);
    await controller.start();
    jest.advanceTimersByTime(1800);
    expect(controller.isRunning).toBe(true);
    const cells = controller.state.cells;
    const startTime = controller.state.startTime;

    controller._handleTap({ preventDefault() {} }); // beat 0 : hit
    jest.advanceTimersByTime(500);
    jest.advanceTimersByTime(50);
    controller.handleKeydown({ key: ' ', preventDefault: jest.fn() }); // proche de 1 : hit
    controller.handleKeydown({ key: 'x', preventDefault: jest.fn() });
    jest.advanceTimersByTime(300); // t ≈ 850 → trop tard pour la note 3
    controller._handleTap(null); // hors tolérance
    expect(taps).toEqual([true, true, false]);
    expect(cells[0].classList.contains('hit')).toBe(true);
    expect(cells[0].classList.contains('active')).toBe(false);
    expect(document.getElementById('rhythm-hits').textContent).toBe('2');

    jest.advanceTimersByTime(2200);
    expect(controller.isRunning).toBe(false);
    expect(controller.state.misses).toBe(1);
    expect(cells[2].classList.contains('miss')).toBe(true);
    expect(document.getElementById('rhythm-misses').textContent).toBe('1');
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended.mock.calls[0][0]).toMatchObject({ hits: 2, total: 3, isCorrect: false });
    expect(ended.mock.calls[0][0].accuracy).toBeCloseTo(2 / 3);
    expect(metronome.stop).toHaveBeenCalled();
    expect(startTime).toBeLessThanOrEqual(Date.now());
  });

  test('un rythme parfait est jugé correct (>= 70 %)', async () => {
    mount(controller);
    const ended = jest.fn();
    controller.on('rhythm-ended', ended);
    await controller.start();
    jest.advanceTimersByTime(1800);
    controller._handleTap(null);
    jest.advanceTimersByTime(500);
    controller._handleTap(null);
    jest.advanceTimersByTime(750);
    controller._handleTap(null);
    jest.advanceTimersByTime(2000);
    expect(ended.mock.calls[0][0]).toMatchObject({ hits: 3, total: 3, accuracy: 1, isCorrect: true });
  });

  test('un motif vide donne une précision nulle', () => {
    mount(controller, { tempo: 60, beatsPerMeasure: 1, pattern: [] });
    const ended = jest.fn();
    controller.on('rhythm-ended', ended);
    controller._end();
    expect(ended).toHaveBeenCalledWith({ hits: 0, total: 0, accuracy: 0, isCorrect: false });
    controller.stop();
    controller._end();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  test('stop annule compte à rebours, animation et métronome, puis efface l’état', async () => {
    mount(controller);
    await controller.start();
    jest.advanceTimersByTime(1800);
    expect(controller.isRunning).toBe(true);
    const timersBefore = jest.getTimerCount();
    expect(timersBefore).toBeGreaterThan(0);
    controller.stop();
    expect(controller.state).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(metronome.stop).toHaveBeenCalled();
    controller.handleKeydown({ key: ' ', preventDefault: jest.fn() });
    controller._animateCursor();
    controller._startPlayback();
  });

  test('fermer pendant le compte à rebours supprime tous les rappels', async () => {
    mount(controller);
    await controller.start();
    jest.advanceTimersByTime(1600);
    controller.dispose();
    jest.advanceTimersByTime(5000);
    expect(controller.isRunning).toBe(false);
    expect(document.getElementById('feedback-container').textContent.trim()).toBe('GO!');
  });

  test('showEndFeedback affiche le pourcentage et la tonalité du résultat', () => {
    mount(controller);
    controller.showEndFeedback(true, 0.8, 4, 5);
    const feedback = document.getElementById('feedback-container');
    expect(feedback.textContent).toContain('✓');
    expect(feedback.textContent).toContain('80% - 4/5 notes');
    controller.showEndFeedback(false, 0.333, 1, 3);
    expect(feedback.textContent).toContain('✗');
    expect(feedback.textContent).toContain('33% - 1/3 notes');
    document.body.innerHTML = '';
    controller.showEndFeedback(true, 1, 1, 1);
  });
});
