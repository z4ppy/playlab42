/**
 * Tests pour ProgressTracker
 *
 * @module engine/ProgressTracker.test
 */

import { jest } from '@jest/globals';
import { ProgressTracker } from './ProgressTracker.js';

// ============================================================================
// Note: ProgressTracker utilise GameKit en priorité. Ces tests vérifient
// la logique métier du tracker sans dépendre de la persistance externe.
// ============================================================================

describe('ProgressTracker', () => {
  describe('Configuration', () => {
    test('doit utiliser la clé de stockage par défaut', () => {
      const tracker = new ProgressTracker();
      expect(tracker.storageKey).toBe('diese-et-mat-progress');
    });

    test('doit accepter une clé personnalisée', () => {
      const tracker = new ProgressTracker({ storageKey: 'custom-key' });
      expect(tracker.storageKey).toBe('custom-key');
    });

    test('doit démarrer avec progress null', () => {
      const tracker = new ProgressTracker();
      expect(tracker.progress).toBeNull();
    });
  });

  describe('XP global', () => {
    test('getGlobalXP() doit retourner 0 si progress est null', () => {
      const tracker = new ProgressTracker();
      expect(tracker.getGlobalXP()).toBe(0);
    });

    test('addXP() ne doit rien faire si progress est null', () => {
      const tracker = new ProgressTracker();
      tracker.addXP(100);
      expect(tracker.progress).toBeNull();
    });

    test('addXP() doit ajouter de l\'XP après load()', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.addXP(50);
      tracker.addXP(30);

      expect(tracker.getGlobalXP()).toBe(80);
    });
  });

  describe('getLevel()', () => {
    test('doit être niveau 1 avec 0 XP', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const level = tracker.getLevel();

      expect(level.level).toBe(1);
      expect(level.currentXP).toBe(0);
      expect(level.progress).toBe(0);
    });

    test('doit calculer le niveau correctement', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();
      tracker.addXP(150);

      const level = tracker.getLevel();

      // 100 XP pour niveau 1, donc 150 = niveau 2 avec 50 XP
      expect(level.level).toBe(2);
      expect(level.currentXP).toBe(50);
    });

    test('doit calculer la progression en pourcentage', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();
      tracker.addXP(50);

      const level = tracker.getLevel();

      // 50/100 = 50%
      expect(level.progress).toBe(50);
    });

    test('doit gérer les niveaux élevés', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();
      // Niveau 1: 100, Niveau 2: 282, Niveau 3: 519, Total: 901
      tracker.addXP(1000);

      const level = tracker.getLevel();

      expect(level.level).toBe(4);
    });
  });

  describe('Compétences (Skills)', () => {
    test('getSkill() doit créer une compétence par défaut', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const skill = tracker.getSkill('treble-clef');

      expect(skill.level).toBe(1);
      expect(skill.xp).toBe(0);
      expect(skill.accuracy).toBe(0);
      expect(skill.totalQuestions).toBe(0);
      expect(skill.correctAnswers).toBe(0);
    });

    test('updateSkill() doit mettre à jour les données', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.updateSkill('treble-clef', {
        xp: 30,
        totalQuestions: 10,
        correctAnswers: 8,
      });

      const skill = tracker.getSkill('treble-clef');

      expect(skill.xp).toBe(30);
      expect(skill.totalQuestions).toBe(10);
      expect(skill.correctAnswers).toBe(8);
      expect(skill.accuracy).toBe(80);
    });

    test('updateSkill() doit cumuler les sessions', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.updateSkill('bass-clef', {
        xp: 30,
        totalQuestions: 10,
        correctAnswers: 8,
      });
      tracker.updateSkill('bass-clef', {
        xp: 20,
        totalQuestions: 10,
        correctAnswers: 9,
      });

      const skill = tracker.getSkill('bass-clef');

      expect(skill.xp).toBe(50);
      expect(skill.totalQuestions).toBe(20);
      expect(skill.correctAnswers).toBe(17);
      expect(skill.accuracy).toBe(85);
    });

    test('updateSkill() doit calculer le niveau de skill', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.updateSkill('intervals', { xp: 125 });

      const skill = tracker.getSkill('intervals');

      // 125 / 50 = 2.5, donc niveau 3
      expect(skill.level).toBe(3);
    });

    test('getAllSkills() doit retourner toutes les compétences définies', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const skills = tracker.getAllSkills();

      // Vérifie que toutes les compétences définies sont présentes avec leur nom
      expect(skills['treble-clef']).toBeDefined();
      expect(skills['treble-clef'].name).toBe('Clé de sol');
      expect(skills['treble-clef']).toHaveProperty('xp');
      expect(skills['treble-clef']).toHaveProperty('level');

      expect(skills['bass-clef']).toBeDefined();
      expect(skills['bass-clef'].name).toBe('Clé de fa');

      expect(skills['intervals']).toBeDefined();
      expect(skills['intervals'].name).toBe('Intervalles');

      expect(skills['chords']).toBeDefined();
      expect(skills['chords'].name).toBe('Accords');

      expect(skills['rhythm']).toBeDefined();
      expect(skills['rhythm'].name).toBe('Rythme');

      expect(skills['accidentals']).toBeDefined();
      expect(skills['accidentals'].name).toBe('Altérations');
    });
  });

  describe('Sessions', () => {
    test('recordSession() doit enregistrer une session', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.recordSession({
        exerciseId: 'test-ex',
        skill: 'treble-clef',
        score: 100,
        xp: 50,
        accuracy: 90,
        totalQuestions: 10,
        correctAnswers: 9,
        duration: 60,
      });

      const sessions = tracker.getRecentSessions(10);
      const recorded = sessions.find((s) => s.exerciseId === 'test-ex');

      expect(recorded).toBeDefined();
      expect(recorded.score).toBe(100);
      expect(recorded.xp).toBe(50);
    });

    test('recordSession() doit mettre à jour la compétence associée', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      // Récupérer les valeurs initiales
      const initialSkill = tracker.getSkill('rhythm');
      const initialXP = initialSkill.xp;
      const initialQuestions = initialSkill.totalQuestions;
      const initialCorrect = initialSkill.correctAnswers;

      tracker.recordSession({
        exerciseId: 'test-ex-rhythm',
        skill: 'rhythm',
        xp: 50,
        totalQuestions: 10,
        correctAnswers: 9,
      });

      const skill = tracker.getSkill('rhythm');

      // Vérifier que les valeurs ont augmenté
      expect(skill.xp).toBe(initialXP + 50);
      expect(skill.totalQuestions).toBe(initialQuestions + 10);
      expect(skill.correctAnswers).toBe(initialCorrect + 9);
    });

    test('recordSession() doit ajouter l\'XP global', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();
      const initialXP = tracker.getGlobalXP();

      tracker.recordSession({
        exerciseId: 'test-ex3',
        xp: 50,
      });

      expect(tracker.getGlobalXP()).toBe(initialXP + 50);
    });

    test('getRecentSessions() doit retourner les sessions les plus récentes en premier', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.recordSession({ exerciseId: 'ex-first', xp: 10 });
      tracker.recordSession({ exerciseId: 'ex-second', xp: 20 });
      tracker.recordSession({ exerciseId: 'ex-third', xp: 30 });

      const recent = tracker.getRecentSessions(3);

      // Le plus récent en premier
      expect(recent[0].exerciseId).toBe('ex-third');
      expect(recent[1].exerciseId).toBe('ex-second');
      expect(recent[2].exerciseId).toBe('ex-first');
    });

    test('doit limiter à 100 sessions', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      // Nettoyer les sessions existantes
      tracker.progress.sessions = [];

      for (let i = 0; i < 110; i++) {
        tracker.recordSession({
          exerciseId: `limit-ex${i}`,
          xp: 1,
        });
      }

      expect(tracker.progress.sessions.length).toBe(100);
      // Les 10 premières ont été supprimées
      expect(tracker.progress.sessions[0].exerciseId).toBe('limit-ex10');
    });
  });

  describe('Achievements', () => {
    test('checkAchievements() doit débloquer first-perfect', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const newAchievements = tracker.checkAchievements({
        accuracy: 100,
        totalQuestions: 10,
      });

      expect(newAchievements.some((a) => a.id === 'first-perfect')).toBe(true);
    });

    test('checkAchievements() ne doit pas débloquer first-perfect avec moins de 10 questions', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const newAchievements = tracker.checkAchievements({
        accuracy: 100,
        totalQuestions: 5,
      });

      expect(newAchievements.some((a) => a.id === 'first-perfect')).toBe(false);
    });

    test('checkAchievements() doit débloquer streak10', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const newAchievements = tracker.checkAchievements({
        bestStreak: 10,
      });

      expect(newAchievements.some((a) => a.id === 'streak10')).toBe(true);
    });

    test('checkAchievements() doit débloquer streak25', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const newAchievements = tracker.checkAchievements({
        bestStreak: 25,
      });

      // streak25 sera nouveau si pas encore débloqué
      // Note: streak10 peut déjà être débloqué par des tests précédents
      const hasStreak25 = newAchievements.some((a) => a.id === 'streak25') ||
        tracker.progress.achievements.includes('streak25');
      expect(hasStreak25).toBe(true);
    });

    test('checkAchievements() doit débloquer level5', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();
      // Ajouter assez d'XP pour niveau 5+
      tracker.addXP(2000);

      const newAchievements = tracker.checkAchievements({});

      expect(newAchievements.some((a) => a.id === 'level5')).toBe(true);
    });

    test('ne doit pas débloquer le même achievement deux fois', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.checkAchievements({ accuracy: 100, totalQuestions: 10 });
      const second = tracker.checkAchievements({
        accuracy: 100,
        totalQuestions: 10,
      });

      expect(second.some((a) => a.id === 'first-perfect')).toBe(false);
    });

    test('getUnlockedAchievements() doit retourner les achievements débloqués', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.checkAchievements({ accuracy: 100, totalQuestions: 10 });

      const unlocked = tracker.getUnlockedAchievements();

      expect(unlocked.some((a) => a.name === 'Sans faute !')).toBe(true);
    });

    test('getAllAchievements() doit retourner tous les achievements avec état', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.checkAchievements({ accuracy: 100, totalQuestions: 10 });

      const all = tracker.getAllAchievements();

      expect(all.length).toBeGreaterThan(0);

      // Vérifier la structure des achievements
      const perfect = all.find((a) => a.id === 'first-perfect');
      expect(perfect).toBeDefined();
      expect(perfect).toHaveProperty('unlocked');
      expect(perfect).toHaveProperty('name');
      expect(perfect).toHaveProperty('description');

      // first-perfect doit être débloqué (dans ce test ou précédemment)
      expect(perfect.unlocked).toBe(true);
    });
  });

  describe('Paramètres', () => {
    test('getSettings() doit retourner les paramètres par défaut', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const settings = tracker.getSettings();

      expect(settings.notation).toBe('french');
      expect(settings.defaultDifficulty).toBe(1);
    });

    test('setSetting() doit mettre à jour un paramètre', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      tracker.setSetting('notation', 'english');

      expect(tracker.getSettings().notation).toBe('english');
    });

    test('setSetting() ne doit rien faire si progress est null', () => {
      const tracker = new ProgressTracker();
      tracker.setSetting('notation', 'english');

      expect(tracker.progress).toBeNull();
    });

    test('getSettings() doit retourner des paramètres par défaut si progress est null', () => {
      const tracker = new ProgressTracker();
      const settings = tracker.getSettings();

      // Vérifie que les paramètres ont la structure attendue
      expect(settings).toHaveProperty('notation');
      expect(settings).toHaveProperty('defaultDifficulty');
      expect(['french', 'english']).toContain(settings.notation);
    });
  });

  describe('Callbacks', () => {
    test('onUpdate() doit enregistrer un callback', () => {
      const tracker = new ProgressTracker();
      const callback = jest.fn();

      tracker.onUpdate(callback);

      expect(tracker._updateCallbacks).toContain(callback);
    });

    test('save() doit appeler les callbacks', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      const callback = jest.fn();
      tracker.onUpdate(callback);

      await tracker.save();

      expect(callback).toHaveBeenCalledWith(tracker.progress);
    });
  });

  describe('reset()', () => {
    test('doit réinitialiser l\'XP à 0', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      // Ajouter des données
      tracker.addXP(500);
      expect(tracker.getGlobalXP()).toBeGreaterThan(0);

      await tracker.reset();

      // Après reset, l'XP est à 0
      expect(tracker.getGlobalXP()).toBe(0);
    });

    test('reset() doit définir la structure par défaut', async () => {
      const tracker = new ProgressTracker();
      await tracker.load();

      await tracker.reset();

      // Vérifie que la structure est correcte
      expect(tracker.progress).toHaveProperty('version', 1);
      expect(tracker.progress).toHaveProperty('globalXP', 0);
      expect(tracker.progress).toHaveProperty('skills');
      expect(tracker.progress).toHaveProperty('sessions');
      expect(tracker.progress).toHaveProperty('achievements');
      expect(tracker.progress).toHaveProperty('settings');
    });
  });

  describe('load() et save()', () => {
    test('load() doit initialiser progress', async () => {
      const tracker = new ProgressTracker();
      const progress = await tracker.load();

      expect(progress.version).toBe(1);
      expect(progress.globalXP).toBeGreaterThanOrEqual(0);
      expect(progress.settings).toBeDefined();
      // La notation peut être 'french' ou 'english' selon les tests précédents
      expect(['french', 'english']).toContain(progress.settings.notation);
    });

    test('save() ne doit rien faire si progress est null', async () => {
      const tracker = new ProgressTracker();
      // Ne devrait pas lever d'erreur
      await expect(tracker.save()).resolves.not.toThrow();
    });

    test('recordSession() ne doit rien faire si progress est null', () => {
      const tracker = new ProgressTracker();
      tracker.recordSession({ exerciseId: 'ex', xp: 10 });

      expect(tracker.progress).toBeNull();
    });
  });
});
