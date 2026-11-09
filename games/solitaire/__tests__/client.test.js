/**
 * Modules du client sans DOM : session (annuler/refaire), destinations d'un
 * clic, annonces, réglages locaux, minuteries, raccourcis et navigation.
 */

import { jest } from '@jest/globals';
import { SolitaireEngine } from '../engine.js';
import { GameSession } from '../ui/session.js';
import { bestMove, foundationMove } from '../ui/destinations.js';
import { announceAction } from '../ui/announce.js';
import { DEFAULT_SETTINGS, SolitaireProgress, dealFromQuery, isProgressData } from '../ui/progress.js';
import { StepPlayer, Stopwatch, formatDuration } from '../ui/timers.js';
import { shortcutFor } from '../ui/shortcuts.js';
import { navigate } from '../ui/keyboard.js';
import { TapResolver, overlapArea } from '../ui/pointer.js';
import { fanFor, FAN } from '../ui/board-view.js';
import { PLAYER, board, column, move, stateWith } from './positions.js';

const engine = new SolitaireEngine();

describe('Session : annuler et refaire', () => {
  it('annule sans limite puis refait, et une nouvelle action efface « refaire »', () => {
    const session = new GameSession();
    session.start({ seed: 1, drawCount: 1 });
    const initial = session.state;
    expect(session.canUndo).toBe(false);
    expect(session.play({ type: 'draw' })).toBe(true);
    expect(session.play({ type: 'draw' })).toBe(true);
    expect(session.depth).toBe(2);
    expect(session.undo()).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.undo()).toBe(false);
    expect(session.state).toBe(initial);
    expect(session.redo()).toBe(true);
    expect(session.canRedo).toBe(true);
    session.play({ type: 'draw' });
    expect(session.canRedo).toBe(false);
    expect(session.redo()).toBe(false);
  });

  it('refuse une action illégale sans changer l\'état', () => {
    const session = new GameSession({ engine, playerId: 'p1' });
    const state = session.start({ seed: 2, drawCount: 3, winnableOnly: false });
    expect(session.play({ type: 'recycle' })).toBe(false);
    expect(session.state).toBe(state);
    expect(session.validActions()).toEqual(engine.getValidActions(state, 'p1'));
    expect(session.view.stockCount).toBe(24);
  });

  it('mémorise les positions vues pour l\'historique des indices', () => {
    const session = new GameSession();
    session.start({ seed: 3, drawCount: 1 });
    session.play({ type: 'draw' });
    expect(session.historyKeys().size).toBe(2);
  });
});

describe('Destinations d\'un clic', () => {
  it('monte sans risque un as ou une carte sûre', () => {
    const position = board({ tableau: [column(['AH']), column(['2S'])], heights: [1, 0, 0, 0] });
    expect(bestMove(position, 'tableau-0', 1)).toEqual(move('tableau-0', 'foundation-1'));
  });

  it('garde dans le tableau une carte qui peut encore servir, le double-clic la monte', () => {
    // Le 5 de cœur peut monter, mais les 4 noirs ne sont pas sortis : il va sur le 6 de pique.
    const position = board({ tableau: [column(['5H']), column(['6S'])], heights: [0, 4, 0, 0] });
    expect(bestMove(position, 'tableau-0', 1)).toEqual(move('tableau-0', 'tableau-1'));
    expect(foundationMove(position, 'tableau-0', 1)).toEqual(move('tableau-0', 'foundation-1'));
  });

  it('préfère une colonne occupée à une colonne vide, et ignore le roi déjà au fond', () => {
    const position = board({ tableau: [column(['KS']), column([]), column(['QD']), column(['KH'], ['2C'])] });
    expect(bestMove(position, 'tableau-0', 1)).toBeNull();
    expect(bestMove(position, 'tableau-3', 1)).toEqual(move('tableau-3', 'tableau-1'));
    const queen = board({ tableau: [column(['KS']), column([]), column(['QD']), column(['KC'])] });
    expect(bestMove(queen, 'tableau-2', 1)).toEqual(move('tableau-2', 'tableau-0'));
  });

  it('se rabat sur la fondation, ou ne propose rien', () => {
    const position = board({ tableau: [column(['5H'])], heights: [0, 4, 0, 0] });
    expect(bestMove(position, 'tableau-0', 1)).toEqual(move('tableau-0', 'foundation-1'));
    expect(foundationMove(position, 'tableau-0', 2)).toBeNull();
    expect(foundationMove(position, 'foundation-1', 1)).toBeNull();
    expect(foundationMove(board(), 'waste', 1)).toBeNull();
    expect(bestMove(board({ waste: ['9C'] }), 'waste', 1)).toBeNull();
  });
});

describe('Annonces', () => {
  const play = (position, action) => {
    const state = stateWith(position);
    return announceAction(engine.getPlayerView(state, PLAYER), action,
      engine.getPlayerView(engine.applyAction(state, action, PLAYER), PLAYER));
  };

  it('annonce un déplacement, une colonne vide et une carte découverte', () => {
    expect(play(board({ tableau: [column(['8S']), column(['7H'], ['QC'])] }), move('tableau-1', 'tableau-0')))
      .toBe('Le 7 de cœur va sur le 8 de pique, colonne 1. Carte découverte en colonne 2 : la dame de trèfle.');
    expect(play(board({ tableau: [column(['KH', 'QS', 'JD'])] }), move('tableau-0', 'tableau-3', 3)))
      .toBe('Le roi de cœur et 2 cartes vont dans la colonne 4.');
    expect(play(board({ tableau: [column(['KH', 'QS'])] }), move('tableau-0', 'tableau-3', 2)))
      .toBe('Le roi de cœur et 1 carte vont dans la colonne 4.');
  });

  it('annonce pioche, recyclage, fondation et victoire', () => {
    expect(play(board({ stock: ['2C', 'AC'], tableau: [column(['KS'])] }), { type: 'draw' })).toBe('Pioche : l’as de trèfle.');
    expect(play(board({ drawCount: 3, stock: ['3C', '2C', 'AC'], tableau: [column(['KS'])] }), { type: 'draw' }))
      .toBe('Pioche : l’as de trèfle, le 2 de trèfle, le 3 de trèfle ; le 3 de trèfle est jouable.');
    expect(play(board({ waste: ['2C', 'AC'], tableau: [column(['KS'])] }), { type: 'recycle' })).toBe('La défausse retourne au talon : 2 cartes.');
    expect(play(board({ waste: ['KS'], heights: [12, 13, 13, 13] }), move('waste', 'foundation-0')))
      .toBe('Le roi de pique monte sur sa fondation. Partie gagnée !');
  });
});

describe('Réglages et statistiques locales', () => {
  const kit = (stored, ok = true) => ({
    loadProgress: jest.fn(() => stored), saveProgress: jest.fn(() => ok), saveScore: jest.fn(() => ok),
  });

  it('démarre avec les réglages par défaut et compte parties et victoires', () => {
    const fake = kit(null);
    const notify = jest.fn();
    const progress = new SolitaireProgress(fake, notify);
    expect(progress.settings).toEqual(DEFAULT_SETTINGS);
    progress.updateSettings({ drawCount: 3 });
    progress.recordStart();
    progress.recordWin({ score: 420, elapsedMs: 61_000.4 });
    progress.recordStart();
    progress.recordWin({ score: 300, elapsedMs: 90_000 });
    expect(progress.stats).toEqual({ played: 2, won: 2, bestTimeMs: 61_000, bestScore: 420 });
    expect(fake.saveScore).toHaveBeenCalledWith(420);
    expect(isProgressData(fake.saveProgress.mock.calls.at(-1)[0])).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it('ignore des données illisibles sans les effacer et signale le stockage indisponible', () => {
    const notify = jest.fn();
    const progress = new SolitaireProgress(kit({ version: 2 }, false), notify);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('illisibles'));
    progress.recordStart();
    progress.recordWin({ score: 10, elapsedMs: 1000 });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('score'));
  });

  it('relit des données valides et refuse les incohérentes', () => {
    const data = { version: 1, settings: { drawCount: 3, winnableOnly: true, autoFinish: false }, stats: { played: 3, won: 1, bestTimeMs: null, bestScore: 0 } };
    expect(new SolitaireProgress(kit(data), jest.fn()).settings.drawCount).toBe(3);
    expect(isProgressData({ ...data, stats: { ...data.stats, won: 4 } })).toBe(false);
    expect(isProgressData({ ...data, settings: { ...data.settings, drawCount: 2 } })).toBe(false);
    expect(isProgressData(null)).toBe(false);
  });

  it('lit la donne demandée dans l\'adresse', () => {
    expect(dealFromQuery('?donne=1234&pioche=3')).toEqual({ seed: 1234, drawCount: 3 });
    expect(dealFromQuery('?donne=-1&pioche=2')).toEqual({});
    expect(dealFromQuery('?donne=&pioche=1')).toEqual({ drawCount: 1 });
    expect(dealFromQuery('?donne=99999999999')).toEqual({});
  });
});

describe('Minuteries', () => {
  it('formate les durées', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(247_900)).toBe('4:07');
    expect(formatDuration(3_729_000)).toBe('1:02:09');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('chronomètre sans compter les pauses', () => {
    let now = 0;
    const watch = new Stopwatch(() => now);
    watch.start();
    now = 1000;
    watch.pause();
    watch.pause();
    now = 5000;
    expect(watch.elapsed).toBe(1000);
    watch.start();
    watch.start();
    now = 5500;
    expect(watch.running).toBe(true);
    expect(watch.elapsed).toBe(1500);
    watch.reset();
    expect(watch.elapsed).toBe(0);
  });

  it('joue pas à pas jusqu\'à l\'arrêt demandé par l\'étape ou par l\'appelant', () => {
    jest.useFakeTimers();
    const player = new StepPlayer({ setTimeout, clearTimeout });
    const onStop = jest.fn();
    let steps = 0;
    player.start(() => ++steps < 3, 100, onStop);
    expect(player.running).toBe(true);
    jest.advanceTimersByTime(1000);
    expect(steps).toBe(3);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(player.running).toBe(false);
    player.start(() => true, 100, onStop);
    jest.advanceTimersByTime(250);
    player.stop();
    player.stop();
    expect(onStop).toHaveBeenCalledTimes(2);
    player.start(() => { player.stop(); return true; }, 100);
    jest.advanceTimersByTime(500);
    expect(player.running).toBe(false);
    jest.useRealTimers();
  });
});

describe('Raccourcis et gestes', () => {
  it('associe touches et commandes, Ctrl seulement pour annuler et refaire', () => {
    expect(shortcutFor({ key: 'Z' })).toBe('undo');
    expect(shortcutFor({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(shortcutFor({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(shortcutFor({ key: 'y', metaKey: true })).toBe('redo');
    expect(shortcutFor({ key: 'p', ctrlKey: true })).toBeNull();
    expect(shortcutFor({ key: 'i', altKey: true })).toBeNull();
    expect(shortcutFor({ key: '?' })).toBe('help');
    expect(shortcutFor({ key: 'x' })).toBeNull();
  });

  it('distingue appui simple et double, sans attendre si inutile', () => {
    const calls = [];
    let pending = null;
    const timers = { setTimeout: fn => { pending = fn; return 1; }, clearTimeout: () => { pending = null; } };
    const taps = new TapResolver(timers);
    taps.tap('a', () => calls.push('a1'), null);
    taps.tap('b', () => calls.push('b1'), () => calls.push('b2'));
    expect(taps.pendingKey).toBe('b');
    taps.tap('b', () => calls.push('b1'), () => calls.push('b2'));
    taps.tap('c', () => calls.push('c1'), () => calls.push('c2'));
    taps.tap('d', () => calls.push('d1'), null);
    taps.tap('e', () => calls.push('e1'), () => calls.push('e2'));
    pending();
    taps.flush();
    expect(calls).toEqual(['a1', 'b2', 'c1', 'd1', 'e1']);
    expect(taps.pendingKey).toBeNull();
  });

  it('mesure le recouvrement de deux rectangles', () => {
    const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });
    expect(overlapArea(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(25);
    expect(overlapArea(rect(0, 0, 10, 10), rect(20, 0, 10, 10))).toBe(0);
  });

  it('resserre l\'éventail d\'une longue colonne pour tenir à l\'écran', () => {
    expect(fanFor({ downCount: 0, up: ['KS'] }, 100, 50)).toBe(FAN.up);
    expect(fanFor({ downCount: 2, up: ['KS', 'QH', 'JS'] }, 100, 1000)).toBe(FAN.up);
    expect(fanFor({ downCount: 6, up: Array(12).fill('KS') }, 100, 300)).toBe(FAN.minUp);
    expect(fanFor({ downCount: 0, up: Array(5).fill('KS') }, 100, 200)).toBeCloseTo(0.25);
  });
});

describe('Navigation clavier', () => {
  const sizes = { 'tableau-0': 3, 'tableau-1': 0, 'tableau-2': 1, stock: 0, waste: 1, 'foundation-0': 0 };
  const deepest = pile => sizes[pile] ?? 1;

  it('se déplace dans une rangée et vers une colonne par son numéro', () => {
    expect(navigate({ pile: 'tableau-0', count: 1 }, 'ArrowRight', deepest)).toEqual({ pile: 'tableau-1', count: 0 });
    expect(navigate({ pile: 'tableau-0', count: 1 }, 'ArrowLeft', deepest)).toEqual({ pile: 'tableau-0', count: 1 });
    expect(navigate({ pile: 'stock', count: 0 }, 'ArrowRight', deepest)).toEqual({ pile: 'waste', count: 1 });
    expect(navigate({ pile: 'waste', count: 1 }, 'ArrowRight', deepest)).toEqual({ pile: 'foundation-0', count: 0 });
    expect(navigate({ pile: 'tableau-0', count: 1 }, '3', deepest)).toEqual({ pile: 'tableau-2', count: 1 });
    expect(navigate({ pile: 'tableau-0', count: 1 }, 'x', deepest)).toBeNull();
  });

  it('monte dans la colonne pour prendre plus de cartes, puis rejoint la rangée du haut', () => {
    expect(navigate({ pile: 'tableau-0', count: 1 }, 'ArrowUp', deepest)).toEqual({ pile: 'tableau-0', count: 2 });
    expect(navigate({ pile: 'tableau-0', count: 3 }, 'ArrowUp', deepest)).toEqual({ pile: 'stock', count: 0 });
    expect(navigate({ pile: 'tableau-2', count: 1 }, 'ArrowUp', deepest)).toEqual({ pile: 'waste', count: 1 });
    expect(navigate({ pile: 'tableau-0', count: 2 }, 'ArrowDown', deepest)).toEqual({ pile: 'tableau-0', count: 1 });
    expect(navigate({ pile: 'tableau-0', count: 1 }, 'ArrowDown', deepest)).toEqual({ pile: 'tableau-0', count: 1 });
  });

  it('descend de la rangée du haut vers la colonne correspondante', () => {
    expect(navigate({ pile: 'foundation-0', count: 0 }, 'ArrowDown', deepest)).toEqual({ pile: 'tableau-3', count: 1 });
    expect(navigate({ pile: 'stock', count: 0 }, 'ArrowDown', deepest)).toEqual({ pile: 'tableau-0', count: 1 });
    expect(navigate({ pile: 'stock', count: 0 }, 'ArrowUp', deepest)).toEqual({ pile: 'stock', count: 0 });
  });
});
