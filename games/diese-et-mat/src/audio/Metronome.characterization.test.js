import { jest } from '@jest/globals';
import { Metronome } from './Metronome.js';

function createAudio({ started = true, muted = false } = {}) {
  const synths = [];
  class Synth {
    constructor(options) {
      this.options = options;
      this.volume = { value: 0 };
      this.triggerAttackRelease = jest.fn();
      this.dispose = jest.fn();
      this.destination = false;
      synths.push(this);
    }
    toDestination() {
      this.destination = true;
      return this;
    }
  }
  const clock = { now: 10 };
  return {
    started,
    muted,
    start: jest.fn(function start() { this.started = true; return Promise.resolve(); }),
    Tone: { Synth, now: () => clock.now },
    synths,
    clock,
  };
}

describe('Metronome : caractérisation audio et lecture', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('valeurs par défaut et options explicites', () => {
    const defaults = new Metronome(createAudio());
    expect(defaults).toMatchObject({ tempo: 120, accent: true, playing: false, currentBeat: 0 });
    expect(defaults.timeSignature).toEqual({ beats: 4, beatValue: 4 });

    const custom = new Metronome(createAudio(), {
      tempo: 90, accent: false, timeSignature: { beats: 3, beatValue: 8 },
    });
    expect(custom).toMatchObject({ tempo: 90, accent: false });
    expect(custom.timeSignature).toEqual({ beats: 3, beatValue: 8 });
  });

  test('démarre le moteur si besoin puis crée un click synth réutilisé', async () => {
    const audio = createAudio({ started: false });
    const metronome = new Metronome(audio);
    await metronome.start();
    expect(audio.start).toHaveBeenCalledTimes(1);
    expect(audio.synths).toHaveLength(1);
    expect(audio.synths[0].destination).toBe(true);
    expect(audio.synths[0].volume.value).toBe(-5);
    expect(audio.synths[0].options.oscillator.type).toBe('triangle');
    await metronome._initClickSynth();
    expect(audio.synths).toHaveLength(1);
    metronome.dispose();
  });

  test('ne redémarre pas un moteur déjà démarré', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    await metronome.start();
    expect(audio.start).not.toHaveBeenCalled();
    metronome.dispose();
  });

  test('premier beat immédiat, accent sur le temps fort puis cycle de mesure', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio, { tempo: 120, timeSignature: { beats: 3, beatValue: 4 } });
    const beats = [];
    const downbeats = jest.fn();
    metronome.onBeat((beat, isDownbeat) => beats.push([beat, isDownbeat]));
    metronome.onDownbeat(downbeats);
    await metronome.start();
    expect(metronome.playing).toBe(true);
    expect(beats).toEqual([[1, true]]);
    jest.advanceTimersByTime(500 * 3);
    expect(beats).toEqual([[1, true], [2, false], [3, false], [1, true]]);
    expect(downbeats).toHaveBeenCalledTimes(2);
    const pitches = audio.synths[0].triggerAttackRelease.mock.calls.map(call => call[0]);
    expect(pitches).toEqual(['G5', 'C5', 'C5', 'G5']);
    expect(audio.synths[0].triggerAttackRelease.mock.calls[0][1]).toBe('32n');
    metronome.dispose();
  });

  test('sans accent ou en muet : pas de G5, et muet ne joue rien', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio, { accent: false });
    await metronome.start();
    expect(audio.synths[0].triggerAttackRelease.mock.calls[0][0]).toBe('C5');
    metronome.setAccent(true);
    audio.muted = true;
    jest.advanceTimersByTime(500);
    expect(audio.synths[0].triggerAttackRelease).toHaveBeenCalledTimes(1);
    expect(metronome.currentBeat).toBe(2);
    metronome.dispose();
  });

  test('les temps joués restent strictement croissants même si l’horloge audio stagne', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    await metronome.start();
    metronome._tick();
    metronome._tick();
    const times = audio.synths[0].triggerAttackRelease.mock.calls.map(call => call[2]);
    expect(times[0]).toBeCloseTo(10.01);
    expect(times[1]).toBeCloseTo(times[0] + 0.05);
    expect(times[2]).toBeCloseTo(times[1] + 0.05);
    metronome.dispose();
  });

  test('stop remet à zéro, arrête les ticks et start rejoue le premier beat', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    const beats = [];
    metronome.onBeat(beat => beats.push(beat));
    await metronome.start();
    jest.advanceTimersByTime(500);
    metronome.stop();
    expect(metronome).toMatchObject({ playing: false, currentBeat: 0, _intervalId: null });
    jest.advanceTimersByTime(5000);
    expect(beats).toEqual([1, 2]);
    await metronome.start();
    expect(beats).toEqual([1, 2, 1]);
    metronome.dispose();
  });

  test('start ignoré quand déjà en lecture ou détruit', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    await metronome.start();
    await metronome.start();
    expect(jest.getTimerCount()).toBe(1);
    metronome.dispose();
    await metronome.start();
    expect(metronome.playing).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('toggle alterne lecture et arrêt, y compris pendant un démarrage', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    expect(await metronome.toggle()).toBe(true);
    expect(await metronome.toggle()).toBe(false);

    let ready;
    audio.started = false;
    audio.start = jest.fn(() => new Promise((resolve) => { ready = resolve; }));
    const metronome2 = new Metronome(audio);
    const pending = metronome2.start();
    expect(await metronome2.toggle()).toBe(false);
    ready();
    await pending;
    expect(metronome2.playing).toBe(false);
    metronome.dispose();
    metronome2.dispose();
  });

  test('setTempo borne la valeur et redémarre la lecture au nouveau rythme', async () => {
    const metronome = new Metronome(createAudio());
    metronome.setTempo(10);
    expect(metronome.tempo).toBe(30);
    metronome.setTempo(1000);
    expect(metronome.tempo).toBe(300);

    metronome.setTempo(60);
    await metronome.start();
    const beats = [];
    metronome.onBeat(beat => beats.push(beat));
    metronome.setTempo(240);
    await Promise.resolve();
    await Promise.resolve();
    expect(metronome.getBeatDuration()).toBe(250);
    expect(metronome.playing).toBe(true);
    beats.length = 0;
    jest.advanceTimersByTime(500);
    expect(beats).toHaveLength(2);
    expect(jest.getTimerCount()).toBe(1);
    metronome.dispose();
  });

  test('signature, durées de mesure et retrait des callbacks', async () => {
    const metronome = new Metronome(createAudio(), { tempo: 100 });
    metronome.setTimeSignature(6, 8);
    expect(metronome.timeSignature).toEqual({ beats: 6, beatValue: 8 });
    expect(metronome.getMeasureDuration()).toBeCloseTo(3600);
    const first = jest.fn();
    const second = jest.fn();
    metronome.onBeat(first);
    metronome.onBeat(second);
    metronome.offBeat(first);
    metronome.offBeat(jest.fn());
    await metronome.start();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1, true);
    metronome.dispose();
  });

  test('dispose libère le synth, les callbacks et l’intervalle', async () => {
    const audio = createAudio();
    const metronome = new Metronome(audio);
    const cb = jest.fn();
    metronome.onBeat(cb);
    metronome.onDownbeat(cb);
    await metronome.start();
    cb.mockClear();
    metronome.dispose();
    expect(audio.synths[0].dispose).toHaveBeenCalledTimes(1);
    expect(metronome._clickSynth).toBeNull();
    expect(metronome._beatCallbacks).toEqual([]);
    expect(metronome._downbeatCallbacks).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
  });
});
