/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { TunerController } from './TunerController.js';

function createStream() {
  const track = { stop: jest.fn() };
  return { track, stream: { getTracks: () => [track] } };
}

function installMicrophone({ getUserMedia, createContext }) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  window.AudioContext = createContext;
}

function workingContext() {
  const context = {
    sampleRate: 44100,
    createAnalyser: () => ({ fftSize: 0, getFloatTimeDomainData: jest.fn() }),
    createMediaStreamSource: () => ({ connect: jest.fn() }),
    close: jest.fn(),
  };
  return { context, create: jest.fn(() => context) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('TunerController : permissions, annulation et nettoyage', () => {
  let tuner;
  let status;
  let events;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="status"></div><button id="toggle"></button>';
    status = document.getElementById('status');
    tuner = new TunerController({ status, toggle: document.getElementById('toggle') });
    events = [];
    ['started', 'stopped', 'error'].forEach(name => tuner.on(name, () => events.push(name)));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    tuner.dispose();
    jest.restoreAllMocks();
    jest.useRealTimers();
    delete window.AudioContext;
  });

  test('un refus de permission affiche l’erreur sans ouvrir de contexte audio', async () => {
    const { create } = workingContext();
    installMicrophone({ getUserMedia: jest.fn().mockRejectedValue(new Error('NotAllowedError')), createContext: create });
    await tuner.start();
    expect(status.textContent).toBe('Accès micro refusé');
    expect(status.classList.contains('error')).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(tuner._active).toBe(false);
    expect(events).toEqual(['error']);
  });

  test('stop pendant une demande de micro en attente libère le flux obtenu ensuite', async () => {
    const pending = deferred();
    const { track, stream } = createStream();
    const { create } = workingContext();
    installMicrophone({ getUserMedia: jest.fn(() => pending.promise), createContext: create });

    const starting = tuner.start();
    tuner.stop();
    pending.resolve(stream);
    await starting;

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(tuner._active).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(events).toEqual(['stopped']);
  });

  test('dispose pendant une demande de micro en attente ne réactive pas l’accordeur', async () => {
    const pending = deferred();
    const { track, stream } = createStream();
    const { create } = workingContext();
    installMicrophone({ getUserMedia: jest.fn(() => pending.promise), createContext: create });

    const starting = tuner.start();
    tuner.dispose();
    pending.resolve(stream);
    await starting;

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(tuner._active).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test('un échec de création du contexte audio libère le micro obtenu', async () => {
    const { track, stream } = createStream();
    installMicrophone({
      getUserMedia: jest.fn().mockResolvedValue(stream),
      createContext: jest.fn(() => { throw new Error('contexte indisponible'); }),
    });
    await tuner.start();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(tuner._active).toBe(false);
    expect(status.textContent).toBe('Accès micro refusé');
    expect(events).toEqual(['error']);
  });

  test('un échec après création du contexte ferme aussi ce contexte', async () => {
    const { track, stream } = createStream();
    const { context, create } = workingContext();
    context.createMediaStreamSource = () => { throw new Error('source refusée'); };
    installMicrophone({ getUserMedia: jest.fn().mockResolvedValue(stream), createContext: create });
    await tuner.start();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(tuner._active).toBe(false);
  });

  test('une nouvelle tentative réussit après un échec de contexte', async () => {
    const first = createStream();
    const second = createStream();
    const { create } = workingContext();
    create.mockImplementationOnce(() => { throw new Error('contexte indisponible'); });
    const getUserMedia = jest.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    installMicrophone({ getUserMedia, createContext: create });
    await tuner.start();
    await tuner.start();
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    expect(second.track.stop).not.toHaveBeenCalled();
    expect(tuner._active).toBe(true);
    expect(events).toEqual(['error', 'started']);
  });
});
