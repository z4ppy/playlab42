import { jest } from '@jest/globals';
import { GolfSound } from './audio.js';

/** Faux contexte WebAudio qui journalise les nœuds créés. */
function fakeHost({ failOn } = {}) {
  const log = [];
  const param = name => ({
    setValueAtTime: (...args) => log.push([`${name}.set`, ...args]),
    exponentialRampToValueAtTime: (...args) => log.push([`${name}.ramp`, ...args]),
  });
  class FakeContext {
    constructor() {
      if (failOn === 'create') { throw new Error('refus'); }
      this.currentTime = 1;
      this.destination = { name: 'sortie' };
      this.close = jest.fn();
    }

    resume() { return Promise.reject(new Error('geste requis')); }

    createOscillator() {
      if (failOn === 'play') { throw new Error('saturé'); }
      const node = { frequency: param('frequence'), connect: target => target, start: at => log.push(['start', at]), stop: at => log.push(['stop', at]) };
      Object.defineProperty(node, 'type', { set(value) { log.push(['type', value]); } });
      return node;
    }

    createGain() { return { gain: param('gain'), connect: target => { log.push(['connect', target.name]); return target; } }; }
  }
  return { host: { AudioContext: FakeContext }, log };
}

describe('Effets sonores', () => {
  test('coupé par défaut ; aucun contexte avant l’activation', () => {
    const { host, log } = fakeHost();
    const sound = new GolfSound(host, jest.fn());
    sound.play('shoot');
    expect(sound.enabled).toBe(false);
    expect(sound.context).toBeNull();
    expect(log).toEqual([]);
  });

  test('joue une glissade de fréquence courte une fois activé', () => {
    const { host, log } = fakeHost();
    const sound = new GolfSound(host, jest.fn());
    expect(sound.setEnabled(true)).toBe(true);
    sound.play('holed');
    sound.play('inconnu');
    expect(log).toEqual([
      ['type', 'sine'], ['frequence.set', 523, 1], ['frequence.ramp', 1046, 1.45],
      ['gain.set', 0.22, 1], ['gain.ramp', 0.001, 1.45], ['connect', 'sortie'], ['start', 1], ['stop', 1.45],
    ]);
  });

  test('sans WebAudio, le son reste coupé ; la variante préfixée est reconnue', () => {
    expect(new GolfSound({}, jest.fn()).setEnabled(true)).toBe(false);
    const { host } = fakeHost();
    expect(new GolfSound({ webkitAudioContext: host.AudioContext }, jest.fn()).available).toBe(true);
  });

  test.each(['create', 'play'])('une erreur audio (%s) coupe le son et prévient le joueur', failOn => {
    const { host } = fakeHost({ failOn });
    const onFailure = jest.fn();
    const sound = new GolfSound(host, onFailure);
    sound.setEnabled(true);
    sound.play('bounce');
    expect(sound.enabled).toBe(false);
    expect(onFailure).toHaveBeenCalledWith('Le son est indisponible dans ce navigateur : il a été coupé.');
  });

  test('le démontage ferme le contexte et coupe le son', () => {
    const { host } = fakeHost();
    const sound = new GolfSound(host, jest.fn());
    sound.setEnabled(true);
    const { context } = sound;
    sound.dispose();
    expect(context.close).toHaveBeenCalled();
    expect(sound.enabled).toBe(false);
    sound.dispose();
  });
});
