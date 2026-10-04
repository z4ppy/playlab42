/**
 * Contrat des niveaux d'XP partagés par ScoreCalculator et ProgressTracker.
 * Les valeurs attendues sont écrites en dur (seuil du niveau N : 100 × N^1,5,
 * arrondi à l'inférieur) pour ne pas recopier l'algorithme testé.
 */
import { ScoreCalculator } from './ScoreCalculator.js';
import { ProgressTracker } from './ProgressTracker.js';
import { calculateLevelProgress } from './level-progress.js';

const CAS_LIMITES = [
  // xp, niveau, XP dans le niveau, XP requis, pourcentage affiché
  [0, 1, 0, 100, 0],
  [1, 1, 1, 100, 1],
  [99, 1, 99, 100, 99],
  [100, 2, 0, 282, 0],
  [101, 2, 1, 282, 0],
  [240, 2, 140, 282, 50],
  [381, 2, 281, 282, 100],
  [382, 3, 0, 519, 0],
  [900, 3, 518, 519, 100],
  [901, 4, 0, 800, 0],
  [-1, 1, -1, 100, -1],
  [-50, 1, -50, 100, -50],
  [99.5, 1, 99.5, 100, 100],
  [10000, 9, 1598, 2700, 59],
];

function trackerAvecXP(xp) {
  const tracker = new ProgressTracker();
  tracker.progress = { globalXP: xp, skills: {}, sessions: [], achievements: [], settings: {} };
  return tracker;
}

describe('Niveaux d’XP', () => {
  test.each(CAS_LIMITES)('ScoreCalculator.calculateLevel(%p) → niveau %p', (xp, level, currentXP, requiredXP, progress) => {
    expect(ScoreCalculator.calculateLevel(xp)).toEqual({ level, currentXP, requiredXP, progress });
  });

  test.each(CAS_LIMITES)('ProgressTracker.getLevel() avec %p XP donne le même résultat', (xp, level, currentXP, requiredXP, progress) => {
    const tracker = trackerAvecXP(xp);
    expect(tracker.getLevel()).toEqual({ level, currentXP, requiredXP, progress });
  });

  test.each(CAS_LIMITES)('le helper pur calculateLevelProgress(%p) est partagé', (xp, level, currentXP, requiredXP, progress) => {
    expect(calculateLevelProgress(xp)).toEqual({ level, currentXP, requiredXP, progress });
  });

  test('le résultat reste un objet JSON à quatre clés ordonnées', () => {
    const result = ScoreCalculator.calculateLevel(150);
    expect(Object.keys(result)).toEqual(['level', 'currentXP', 'requiredXP', 'progress']);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('chaque appel retourne un nouvel objet', () => {
    expect(ScoreCalculator.calculateLevel(5)).not.toBe(ScoreCalculator.calculateLevel(5));
  });

  test('un XP global NaN ou absent est lu comme 0 par le tracker', () => {
    const vide = { level: 1, currentXP: 0, requiredXP: 100, progress: 0 };
    expect((trackerAvecXP(NaN)).getLevel()).toEqual(vide);
    expect((trackerAvecXP(undefined)).getLevel()).toEqual(vide);
    expect(new ProgressTracker().getLevel()).toEqual(vide);
  });

  test('l’XP de score et la réinitialisation du calculateur restent indépendants du niveau', () => {
    const calculator = new ScoreCalculator();
    for (let i = 0; i < 12; i++) { calculator.calculateScore(true); }
    const avant = ScoreCalculator.calculateLevel(150);
    expect(calculator.getStats().totalXP).toBeGreaterThan(0);
    calculator.reset();
    expect(calculator.getStats().totalXP).toBe(0);
    expect(ScoreCalculator.calculateLevel(150)).toEqual(avant);
  });

  test('l’XP ajouté au tracker fait progresser le niveau affiché jusqu’au seuil exact', () => {
    const tracker = trackerAvecXP(0);
    tracker.addXP(99);
    expect(tracker.getLevel().level).toBe(1);
    tracker.addXP(1);
    expect(tracker.getLevel()).toEqual({ level: 2, currentXP: 0, requiredXP: 282, progress: 0 });
  });

  test('la progression suit les sessions enregistrées et se réinitialise avec la progression', async () => {
    const tracker = trackerAvecXP(0);
    await tracker.recordSession({ exerciseId: 'ex', xp: 150, correctAnswers: 1, totalQuestions: 1, accuracy: 100 });
    expect(tracker.getLevel().level).toBe(2);
    tracker.progress.globalXP = 0;
    expect(tracker.getLevel().level).toBe(1);
  });

  describe('XP invalide', () => {
    test.each([NaN, Infinity, -Infinity])('rejette %p avec une RangeError contextualisée', (xp) => {
      expect(() => calculateLevelProgress(xp)).toThrow(RangeError);
      expect(() => ScoreCalculator.calculateLevel(xp)).toThrow(`XP invalide : un nombre fini est attendu, reçu ${xp}`);
    });

    test.each([['5', 'string'], [null, 'object'], [undefined, 'undefined'], [{}, 'object'], [10n, 'bigint']])(
      'rejette %p avec une TypeError',
      (xp, type) => {
        expect(() => ScoreCalculator.calculateLevel(xp)).toThrow(TypeError);
        expect(() => calculateLevelProgress(xp)).toThrow(`reçu ${type}`);
      },
    );

    test('les valeurs négatives et fractionnaires restent valides et inchangées', () => {
      expect(calculateLevelProgress(-0.5)).toEqual({ level: 1, currentXP: -0.5, requiredXP: 100, progress: -0 });
      expect(calculateLevelProgress(Number.MAX_SAFE_INTEGER).level).toBeGreaterThan(1);
    });

    test('le tracker échoue explicitement pour Infinity ou un XP non numérique, sans repli silencieux', () => {
      expect(() => trackerAvecXP(Infinity).getLevel()).toThrow(RangeError);
      expect(() => trackerAvecXP('12').getLevel()).toThrow(TypeError);
      expect(() => trackerAvecXP(-Infinity).getLevel()).toThrow(RangeError);
    });

    test('checkAchievements, seul appelant, propage l’erreur de niveau invalide', () => {
      expect(() => trackerAvecXP(Infinity).checkAchievements({})).toThrow(RangeError);
    });
  });
});
