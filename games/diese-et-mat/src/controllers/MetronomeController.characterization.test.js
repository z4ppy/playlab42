/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { MetronomeController } from './MetronomeController.js';

function createAudio() {
  const synths = [];
  class Synth {
    constructor() {
      this.volume = { value: 0 };
      this.triggerAttackRelease = jest.fn();
      this.dispose = jest.fn();
      synths.push(this);
    }
    toDestination() { return this; }
  }
  return { started: true, muted: false, Tone: { Synth, now: () => 1 }, synths };
}

function buildDom() {
  document.body.innerHTML = `
    <div id="overlay"></div>
    <span id="bpm"></span>
    <input id="slider" type="range" min="30" max="300" value="120">
    <select id="sig"><option value="4/4">4/4</option><option value="3/4">3/4</option></select>
    <div id="beats"></div>
    <button id="play"><span class="metronome-play-icon"></span><span class="metronome-play-text"></span></button>
    <button id="metronome-minus-10"></button><button id="metronome-minus-1"></button>
    <button id="metronome-plus-1"></button><button id="metronome-plus-10"></button>`;
  const $ = id => document.getElementById(id);
  return {
    overlay: $('overlay'), bpmValue: $('bpm'), tempoSlider: $('slider'),
    timeSignature: $('sig'), beats: $('beats'), playBtn: $('play'),
  };
}

describe('MetronomeController : caractérisation du panneau', () => {
  let audio;
  let elements;
  let controller;
  let logged;

  beforeEach(() => {
    jest.useFakeTimers();
    audio = createAudio();
    elements = buildDom();
    controller = new MetronomeController(elements, { getAudioEngine: () => audio });
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    controller.dispose();
    logged.mockRestore();
    jest.useRealTimers();
  });

  test('show rend visible, crée le métronome et n’initialise qu’une fois', () => {
    controller.show();
    expect(controller.isVisible()).toBe(true);
    const metronome = controller.metronome;
    expect(metronome).not.toBeNull();
    controller.show();
    expect(controller.metronome).toBe(metronome);
    expect(metronome._beatCallbacks).toHaveLength(1);
    expect(controller.playing).toBe(false);
  });

  test('sans moteur audio, aucun métronome n’est créé et rien ne joue', async () => {
    const bare = new MetronomeController(buildDom());
    bare.show();
    expect(bare.metronome).toBeNull();
    await bare.start();
    expect(bare.playing).toBe(false);
    bare.setTempo(500);
    bare.stop();
    bare.dispose();
  });

  test('le bouton lecture démarre puis arrête avec UI, indicateurs et événements', async () => {
    const events = [];
    controller.on('start', () => events.push('start'));
    controller.on('stop', () => events.push('stop'));
    controller.show();
    controller.setTimeSignature(3);
    elements.playBtn.click();
    await jest.advanceTimersByTimeAsync(0);
    expect(controller.playing).toBe(true);
    expect(elements.playBtn.getAttribute('aria-pressed')).toBe('true');
    expect(elements.playBtn.classList.contains('playing')).toBe(true);
    expect(elements.playBtn.querySelector('.metronome-play-icon').textContent).toBe('⏹');
    expect(elements.playBtn.querySelector('.metronome-play-text').textContent).toBe('Arrêter');
    const cells = [...elements.beats.querySelectorAll('.metronome-beat')];
    expect(cells.map(c => c.dataset.beat)).toEqual(['1', '2', '3']);
    expect(cells[0].classList.contains('active')).toBe(true);
    expect(cells[0].classList.contains('downbeat')).toBe(true);

    await jest.advanceTimersByTimeAsync(500);
    expect(cells[0].classList.contains('active')).toBe(false);
    expect(cells[1].classList.contains('active')).toBe(true);
    expect(cells[1].classList.contains('downbeat')).toBe(false);

    elements.playBtn.click();
    await jest.advanceTimersByTimeAsync(0);
    expect(controller.playing).toBe(false);
    expect(elements.playBtn.getAttribute('aria-pressed')).toBe('false');
    expect(elements.playBtn.querySelector('.metronome-play-text').textContent).toBe('Démarrer');
    expect(cells.some(c => c.classList.contains('active'))).toBe(false);
    expect(events).toEqual(['start', 'stop']);
  });

  test('start ignoré si déjà en cours ; toggle renvoie le nouvel état', async () => {
    controller.show();
    expect(await controller.toggle()).toBe(true);
    await controller.start();
    expect(jest.getTimerCount()).toBe(1);
    expect(await controller.toggle()).toBe(false);
  });

  test('une erreur audio au clic remet l’UI à zéro et est journalisée', async () => {
    audio.started = false;
    audio.start = () => Promise.reject(new Error('audio bloqué'));
    const failing = new MetronomeController(elements, { getAudioEngine: () => audio });
    failing.show();
    elements.playBtn.click();
    await jest.advanceTimersByTimeAsync(0);
    expect(failing.playing).toBe(false);
    expect(elements.playBtn.getAttribute('aria-pressed')).toBe('false');
    expect(logged).toHaveBeenCalledWith('Audio du métronome indisponible:', expect.any(Error));
    failing.dispose();
  });

  test('ensureReady partage la préparation, crée le métronome après l’audio et ne le duplique pas', async () => {
    let ready;
    const order = [];
    const late = new MetronomeController(elements, {
      getAudioEngine: () => audio,
      ensureAudioReady: () => new Promise((resolve) => { ready = resolve; }),
    });
    const first = late.ensureReady();
    expect(late.ensureReady()).toBe(first);
    ready();
    const metronome = await first;
    order.push(late.metronome === metronome);
    expect(await late.ensureReady()).toBe(metronome);
    expect(metronome._beatCallbacks).toHaveLength(1);
    expect(order).toEqual([true]);
    late.dispose();
    expect(await late.ensureReady()).toBeNull();
  });

  test('stop pendant le démarrage annule la demande et émet stop', async () => {
    let ready;
    const slow = new MetronomeController(elements, {
      getAudioEngine: () => audio,
      ensureAudioReady: () => new Promise((resolve) => { ready = resolve; }),
    });
    const stops = jest.fn();
    slow.on('stop', stops);
    const pending = slow.start();
    expect(await Promise.race([slow.toggle(), Promise.resolve('attente')])).toBe(false);
    ready();
    await pending;
    expect(slow.playing).toBe(false);
    expect(stops).toHaveBeenCalledTimes(1);
    slow.dispose();
  });

  test('détruire pendant l’attente du métronome arrête sans émettre start', async () => {
    controller.show();
    const started = jest.fn();
    controller.on('start', started);
    const pending = controller.start();
    controller.dispose();
    await pending;
    expect(started).not.toHaveBeenCalled();
    expect(controller.metronome).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('setTempo borne, met à jour affichage, slider et métronome en lecture', async () => {
    controller.show();
    const changes = [];
    controller.on('tempoChange', bpm => changes.push(bpm));
    controller.setTempo(1000);
    expect(elements.bpmValue.textContent).toBe('300');
    expect(elements.tempoSlider.value).toBe('300');
    expect(controller.metronome.tempo).toBe(300);
    controller.setTempo(5);
    expect(controller.metronome.tempo).toBe(30);
    await controller.start();
    controller.setTempo(60);
    await jest.advanceTimersByTimeAsync(0);
    expect(controller.playing).toBe(true);
    expect(changes).toEqual([300, 30, 60]);
  });

  test('slider et boutons ±1/±10 ajustent le tempo courant', () => {
    controller.show();
    elements.tempoSlider.value = '100';
    elements.tempoSlider.dispatchEvent(new Event('input'));
    expect(controller.metronome.tempo).toBe(100);
    const click = id => document.getElementById(id).click();
    click('metronome-plus-10');
    click('metronome-plus-1');
    expect(controller.metronome.tempo).toBe(111);
    click('metronome-minus-1');
    click('metronome-minus-10');
    expect(controller.metronome.tempo).toBe(100);
  });

  test('ajustement relatif partant de 120 sans métronome', () => {
    const bare = new MetronomeController(buildDom());
    const changes = [];
    bare.on('tempoChange', bpm => changes.push(bpm));
    bare._adjustTempo(10);
    expect(changes).toEqual([130]);
    bare.dispose();
  });

  test('changer la signature reconstruit les indicateurs et prévient le métronome', () => {
    controller.show();
    const changes = [];
    controller.on('timeSignatureChange', beats => changes.push(beats));
    elements.timeSignature.value = '3/4';
    elements.timeSignature.dispatchEvent(new Event('change'));
    expect(controller.metronome.timeSignature).toEqual({ beats: 3, beatValue: 4 });
    expect(elements.beats.children).toHaveLength(3);
    controller.setTimeSignature(5);
    expect(elements.beats.children).toHaveLength(5);
    expect(changes).toEqual([3, 5]);
  });

  test('hide masque le panneau et arrête la lecture', async () => {
    controller.show();
    await controller.start();
    controller.hide();
    expect(controller.isVisible()).toBe(false);
    expect(controller.playing).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('dispose libère le métronome et son synthétiseur', async () => {
    controller.show();
    await controller.start();
    controller.dispose();
    expect(audio.synths[0].dispose).toHaveBeenCalledTimes(1);
    expect(controller.metronome).toBeNull();
    await controller.start();
    expect(controller.playing).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('sans éléments DOM, les mises à jour restent silencieuses', () => {
    const headless = new MetronomeController({}, { getAudioEngine: () => audio });
    headless.setTempo(90);
    headless.setTimeSignature(3);
    headless._updateUI(false);
    headless._updateBeatIndicator(1, true);
    headless.show();
    expect(headless.isVisible()).toBe(false);
    headless.dispose();
  });
});
