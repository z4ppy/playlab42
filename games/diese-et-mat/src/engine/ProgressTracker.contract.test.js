/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import GameKit from '../../../../lib/gamekit.js';
import { ProgressTracker } from './ProgressTracker.js';

describe('Contrats de progression et notifications', () => {
  let tracker;

  beforeEach(async () => {
    localStorage.clear();
    jest.spyOn(GameKit, 'loadProgress').mockResolvedValue({
      globalXP: 0, skills: {}, sessions: [], achievements: [],
    });
    jest.spyOn(GameKit, 'saveProgress').mockResolvedValue(undefined);
    tracker = new ProgressTracker();
    await tracker.load();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    [{ accuracy: 100, totalQuestions: 9, bestStreak: 9 }, []],
    [{ accuracy: 99, totalQuestions: 10, bestStreak: 10 }, ['streak10']],
    [{ accuracy: 100, totalQuestions: 10, bestStreak: 24 }, ['first-perfect', 'streak10']],
    [{ accuracy: 100, totalQuestions: 10, bestStreak: 25 }, ['first-perfect', 'streak10', 'streak25']],
  ])('respecte les bornes des achievements pour %j', (context, expected) => {
    expect(tracker.checkAchievements(context).map(({ id }) => id)).toEqual(expected);
    expect(tracker.checkAchievements(context)).toEqual([]);
    expect(tracker.getUnlockedAchievements().map(({ id }) => id)).toEqual(expected);
  });

  test.each([5, 10])('débloque les niveaux à leur seuil exact : %i', (level) => {
    const threshold = Array.from({ length: level - 1 }, (_, index) =>
      Math.floor(100 * Math.pow(index + 1, 1.5))).reduce((sum, xp) => sum + xp, 0);
    tracker.addXP(threshold - 1);
    expect(tracker.getLevel().level).toBe(level - 1);
    expect(tracker.checkAchievements({}).map(({ id }) => id))
      .toEqual(level === 10 ? ['level5'] : []);
    tracker.addXP(1);
    expect(tracker.getLevel().level).toBe(level);
    expect(tracker.checkAchievements({}).map(({ id }) => id)).toEqual([`level${level}`]);
    expect(tracker.checkAchievements({})).toEqual([]);
    expect(tracker.getAllAchievements().find(({ id }) => id === 'all-clefs').unlocked).toBe(false);
  });

  test('ne débloque rien avant le chargement', () => {
    expect(new ProgressTracker().checkAchievements({
      accuracy: 100, totalQuestions: 10, bestStreak: 25,
    })).toEqual([]);
  });

  test('isole les valeurs par défaut entre deux progressions nouvellement chargées', async () => {
    GameKit.loadProgress.mockResolvedValue(null);
    const first = new ProgressTracker();
    const second = new ProgressTracker();
    await first.load();
    await second.load();
    first.recordSession({
      exerciseId: 'première', skill: 'treble-clef', xp: 50,
      totalQuestions: 10, correctAnswers: 10,
    });
    first.setSetting('notation', 'english');
    expect(first.checkAchievements({ bestStreak: 10 }).map(({ id }) => id)).toEqual(['streak10']);
    expect(second.getRecentSessions()).toEqual([]);
    expect(second.getAllSkills()['treble-clef'].xp).toBe(0);
    expect(second.getSettings().notation).toBe('french');
    expect(second.getUnlockedAchievements()).toEqual([]);
    expect(second.checkAchievements({ bestStreak: 10 }).map(({ id }) => id)).toEqual(['streak10']);
  });

  test('reset efface aussi les collections et paramètres créés par défaut', async () => {
    GameKit.loadProgress.mockResolvedValue(null);
    await tracker.load();
    tracker.recordSession({ exerciseId: 'avant-reset', skill: 'rhythm', xp: 50 });
    tracker.checkAchievements({ bestStreak: 25 });
    tracker.setSetting('notation', 'english');
    await tracker.reset();
    expect(tracker.progress).toEqual({
      version: 1, globalXP: 0, skills: {}, sessions: [], achievements: [],
      settings: { notation: 'french', defaultDifficulty: 1 },
    });
    expect(tracker.checkAchievements({ bestStreak: 25 }).map(({ id }) => id))
      .toEqual(['streak10', 'streak25']);
  });

  test('une progression partielle migrée reçoit aussi ses propres collections par défaut', async () => {
    GameKit.loadProgress.mockResolvedValue({ version: 1, globalXP: 42 });
    await tracker.load();
    const other = new ProgressTracker();
    await other.load();
    tracker.recordSession({ exerciseId: 'migrée', skill: 'chords', xp: 5 });
    tracker.setSetting('notation', 'english');
    tracker.checkAchievements({ bestStreak: 10 });
    expect(other.progress).toEqual({
      version: 1, globalXP: 42, skills: {}, sessions: [], achievements: [],
      settings: { notation: 'french', defaultDifficulty: 1 },
    });
  });

  test('sauvegarde les mutations puis notifie avec le même objet', async () => {
    const update = jest.fn();
    tracker.onUpdate(update);
    tracker.recordSession({ exerciseId: 'lecture', skill: 'treble-clef', xp: 5 });
    tracker.checkAchievements({ bestStreak: 10 });
    expect(update).not.toHaveBeenCalled();
    await tracker.save();
    expect(GameKit.saveProgress).toHaveBeenCalledWith(tracker.progress);
    expect(JSON.parse(localStorage.getItem(tracker.storageKey))).toEqual(tracker.progress);
    expect(update).toHaveBeenCalledWith(tracker.progress);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('conserve le fallback et les erreurs visibles lorsque les stockages échouent', async () => {
    const unavailable = new Error('stockage refusé');
    GameKit.loadProgress.mockRejectedValue(unavailable);
    localStorage.setItem(tracker.storageKey, JSON.stringify({
      globalXP: 42, achievements: ['streak10'],
    }));
    await tracker.load();
    expect(tracker.getGlobalXP()).toBe(42);
    expect(tracker.checkAchievements({ bestStreak: 10 })).toEqual([]);
    GameKit.saveProgress.mockRejectedValue(unavailable);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw unavailable; });
    const update = jest.fn();
    tracker.onUpdate(update);
    await tracker.save();
    expect(warning).toHaveBeenCalledWith('Erreur lors de la sauvegarde:', unavailable);
    expect(update).toHaveBeenCalledWith(tracker.progress);
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('{json cassé');
    await tracker.load();
    expect(warning).toHaveBeenCalledWith(
      'Erreur lors du chargement de la progression:', expect.any(SyntaxError),
    );
    expect(tracker.getGlobalXP()).toBe(0);
  });
});
