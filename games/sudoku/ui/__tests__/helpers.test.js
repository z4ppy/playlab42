import { describe, expect, it, jest } from '@jest/globals';
import { commandForKey } from '../keyboard.js';
import { createClock, formatDuration, spokenDuration } from '../clock.js';
import { formatPuzzleHash, parsePuzzleHash, randomSeed } from '../share.js';
import { createAutoPlayer } from '../auto-player.js';
import { createHintCoach, hintDecorations, hintText } from '../hint-coach.js';

describe('Clavier', () => {
  it.each([
    [{ key: '7', code: 'Digit7' }, { type: 'digit', value: 7 }],
    // AZERTY sans Maj : la touche physique compte, pas le caractère « è ».
    [{ key: 'è', code: 'Digit7' }, { type: 'digit', value: 7 }],
    [{ key: '7', code: 'Digit7', shiftKey: true }, { type: 'digit', value: 7 }],
    [{ key: '3', code: 'Numpad3' }, { type: 'digit', value: 3 }],
    [{ key: '4' }, { type: 'digit', value: 4 }],
    [{ key: 'Delete', code: 'Delete' }, { type: 'erase' }],
    [{ key: 'Backspace' }, { type: 'erase' }],
    [{ key: '0', code: 'Digit0' }, { type: 'erase' }],
    [{ key: 'Insert', code: 'Numpad0' }, { type: 'erase' }],
    [{ key: 'z', ctrlKey: true }, { type: 'undo' }],
    [{ key: 'Z', metaKey: true, shiftKey: true }, { type: 'redo' }],
    [{ key: 'y', ctrlKey: true }, { type: 'redo' }],
    [{ key: 'N' }, { type: 'toggleNotes' }],
    [{ key: 'h' }, { type: 'hint' }],
    [{ key: 'p' }, { type: 'pause' }],
  ])('%p → %p', (event, command) => {
    expect(commandForKey(event)).toEqual(command);
  });

  it.each([
    [{ key: 'ArrowLeft' }], [{ key: 'Enter' }], [{ key: 'x' }], [{ key: '1', ctrlKey: true }],
    [{ key: '5', code: 'Digit5', altKey: true }], [{}], [{ ctrlKey: true }],
  ])('ignore %p', (event) => {
    expect(commandForKey(event)).toBeNull();
  });
});

describe('Chronomètre', () => {
  it('cumule le temps hors pause et repart d’une durée sauvegardée', () => {
    let now = 1000;
    const clock = createClock(() => now);
    expect(clock.isRunning()).toBe(false);
    clock.start();
    now = 4000;
    expect(clock.elapsed()).toBe(3000);
    clock.start();
    clock.pause();
    now = 60_000;
    clock.pause();
    expect(clock.elapsed()).toBe(3000);
    clock.reset(10_000);
    clock.start();
    now = 61_000;
    expect(clock.elapsed()).toBe(11_000);
    // Une horloge qui recule ne produit jamais de temps négatif.
    now = 0;
    expect(clock.elapsed()).toBe(10_000);
    clock.pause();
    expect(clock.elapsed()).toBe(10_000);
    clock.reset();
    expect(clock.elapsed()).toBe(0);
  });

  it('utilise Date.now par défaut', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(5);
    const clock = createClock();
    clock.start();
    spy.mockReturnValue(1005);
    expect(clock.elapsed()).toBe(1000);
    spy.mockRestore();
  });

  it('formate les durées pour l’affichage et la lecture vocale', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(462_000)).toBe('07:42');
    expect(formatDuration(3_909_000)).toBe('1:05:09');
    expect(formatDuration(-5)).toBe('00:00');
    expect(spokenDuration(462_000)).toBe('7 minutes 42 secondes');
    expect(spokenDuration(3_601_000)).toBe('1 heure 1 seconde');
    expect(spokenDuration(0)).toBe('0 seconde');
  });
});

describe('Numéro de grille partageable', () => {
  it('écrit et relit le niveau et la seed', () => {
    expect(formatPuzzleHash('expert', 123456)).toBe('#expert-123456');
    expect(parsePuzzleHash('#expert-123456')).toEqual({ level: 'expert', seed: 123456 });
    expect(parsePuzzleHash('easy-0')).toEqual({ level: 'easy', seed: 0 });
  });

  it.each(['', '#', '#expert', '#cauchemar-12', '#easy-12a', '#easy-99999999999', '#easy-4294967296', undefined])(
    'refuse %p', (hash) => {
      expect(parsePuzzleHash(hash)).toBeNull();
    },
  );

  it('tire une seed courte', () => {
    expect(randomSeed(() => 0.123456789)).toBe(123456);
    expect(randomSeed(() => 0.9999999)).toBeLessThan(1_000_000);
  });
});

describe('Lecture automatique de l’IA', () => {
  function fakeTimers() {
    const queue = [];
    return {
      queue,
      schedule: (callback, ms) => { queue.push({ callback, ms }); return queue.length; },
      cancel: jest.fn(),
      flush() { queue.shift().callback(); },
    };
  }

  it('joue jusqu’à la fin de la grille au rythme demandé', () => {
    const timers = fakeTimers();
    let moves = 0;
    const onStop = jest.fn();
    const player = createAutoPlayer({ step: () => ++moves < 3, delay: () => 50, onStop, ...timers });
    player.start();
    player.start();
    expect(timers.queue).toHaveLength(1);
    expect(timers.queue[0].ms).toBe(0);
    timers.flush();
    expect(timers.queue[0].ms).toBe(50);
    timers.flush();
    timers.flush();
    expect(moves).toBe(3);
    expect(player.isRunning()).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('s’arrête à la demande en annulant le prochain coup', () => {
    const timers = fakeTimers();
    const step = jest.fn(() => true);
    const onStop = jest.fn();
    const player = createAutoPlayer({ step, delay: () => 10, onStop, ...timers });
    player.stop();
    expect(onStop).not.toHaveBeenCalled();
    player.start();
    player.stop();
    expect(timers.cancel).toHaveBeenCalledWith(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    timers.flush();
    expect(step).not.toHaveBeenCalled();
  });

  it('utilise les temporisateurs du navigateur par défaut', () => {
    jest.useFakeTimers();
    const step = jest.fn(() => false);
    const player = createAutoPlayer({ step, delay: () => 10 });
    player.start();
    jest.runAllTimers();
    expect(step).toHaveBeenCalledTimes(1);
    player.start();
    player.stop();
    jest.useRealTimers();
  });
});

describe('Indice en deux temps', () => {
  const advice = {
    kind: 'logic', action: { type: 'place', cell: 37, value: 6 }, hint: 'Regardez la boîte 4 : où peut aller le 6 ?',
    detail: 'Dans la boîte 4, le 6 ne peut aller qu’en ligne 5, colonne 2.', technique: 'Singleton caché',
    focusCells: [27, 28], steps: [{ cells: [37], eliminations: [{ cell: 40, value: 3 }] }],
  };

  it('montre la région, puis le raisonnement et la case', () => {
    const advise = jest.fn(() => advice);
    const coach = createHintCoach(advise);
    expect(hintDecorations(coach.state()).hintFocus.size).toBe(0);
    const first = coach.next({});
    expect(first.stage).toBe(1);
    expect(hintText(first)).toBe('Indice (Singleton caché) : Regardez la boîte 4 : où peut aller le 6 ?');
    expect([...hintDecorations(first).hintFocus]).toEqual([27, 28]);
    expect(hintDecorations(first).hintTargets.size).toBe(0);
    const second = coach.next({});
    expect(second.stage).toBe(2);
    expect(hintText(second)).toBe(advice.detail);
    expect([...hintDecorations(second).hintTargets]).toEqual([37, 40]);
    expect([...hintDecorations(second).hintPattern]).toEqual([37]);
    expect(advise).toHaveBeenCalledTimes(1);
    coach.reset();
    expect(coach.state()).toEqual({ stage: 0, advice: null });
  });

  it('n’a rien à dire sur une grille terminée', () => {
    const coach = createHintCoach(() => null);
    const state = coach.next({});
    expect(state.stage).toBe(0);
    expect(hintText(state)).toBe('Aucun indice : la grille est terminée.');
    expect(createHintCoach().state().stage).toBe(0);
  });
});
