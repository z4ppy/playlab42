/**
 * ProgressTracker - Suivi de la progression
 *
 * Gère la persistance de la progression de l'utilisateur,
 * les niveaux par compétence et les achievements.
 *
 * @module engine/ProgressTracker
 */

import GameKit from '../../../../lib/gamekit.js';

// ============================================================================
// Constantes
// ============================================================================

/** Structure de progression par défaut */
const DEFAULT_PROGRESS = {
  version: 1,
  globalXP: 0,
  skills: {},
  sessions: [],
  achievements: [],
  settings: {
    notation: 'french', // 'french' ou 'english'
    defaultDifficulty: 1,
  },
};

/** Chaque chargement/reset possède ses collections et paramètres mutables. */
function createDefaultProgress() {
  return {
    ...DEFAULT_PROGRESS,
    skills: {},
    sessions: [],
    achievements: [],
    settings: { ...DEFAULT_PROGRESS.settings },
  };
}

/** Définition des compétences */
const SKILLS = {
  'treble-clef': { name: 'Clé de sol', category: 'note-reading' },
  'bass-clef': { name: 'Clé de fa', category: 'note-reading' },
  accidentals: { name: 'Altérations', category: 'note-reading' },
  intervals: { name: 'Intervalles', category: 'intervals' },
  chords: { name: 'Accords', category: 'chords' },
  rhythm: { name: 'Rythme', category: 'rhythm' },
};

/** Définition des achievements */
const ACHIEVEMENTS = {
  'first-perfect': {
    id: 'first-perfect',
    name: 'Sans faute !',
    description: 'Termine un exercice avec 100% de bonnes réponses',
    icon: '🎯',
  },
  streak10: {
    id: 'streak10',
    name: 'En série',
    description: 'Atteins une série de 10 bonnes réponses',
    icon: '🔥',
  },
  streak25: {
    id: 'streak25',
    name: 'Inarrêtable',
    description: 'Atteins une série de 25 bonnes réponses',
    icon: '🌟',
  },
  level5: {
    id: 'level5',
    name: 'Apprenti musicien',
    description: 'Atteins le niveau 5',
    icon: '🎵',
  },
  level10: {
    id: 'level10',
    name: 'Musicien confirmé',
    description: 'Atteins le niveau 10',
    icon: '🎼',
  },
  'all-clefs': {
    id: 'all-clefs',
    name: 'Bilingue',
    description: 'Maîtrise la clé de sol et la clé de fa',
    icon: '🎹',
  },
};

/** Critères dans l'ordre des notifications, indépendants du déblocage persistant. */
const ACHIEVEMENT_RULES = [
  {
    id: 'first-perfect',
    matches: (context) => context.accuracy === 100 && context.totalQuestions >= 10,
  },
  { id: 'streak10', matches: (context) => context.bestStreak >= 10 },
  { id: 'streak25', matches: (context) => context.bestStreak >= 25 },
  { id: 'level5', matches: (_context, level) => level >= 5 },
  { id: 'level10', matches: (_context, level) => level >= 10 },
];

// ============================================================================
// Classe ProgressTracker
// ============================================================================

/**
 * Tracker de progression utilisateur
 */
export class ProgressTracker {
  /**
   * Crée un nouveau tracker
   *
   * @param {Object} options - Options
   * @param {string} options.storageKey - Clé de stockage
   */
  constructor(options = {}) {
    /** @type {string} Clé de stockage */
    this.storageKey = options.storageKey || 'diese-et-mat-progress';

    /** @type {Object} Données de progression */
    this.progress = null;

    /** @type {Function[]} Callbacks de mise à jour */
    this._updateCallbacks = [];
  }

  // --------------------------------------------------------------------------
  // Chargement / Sauvegarde
  // --------------------------------------------------------------------------

  /**
   * Charge la progression
   *
   * @returns {Promise<Object>}
   */
  async load() {
    try {
      // Essayer GameKit d'abord
      const gamekitProgress = await GameKit.loadProgress();
      if (gamekitProgress) {
        this.progress = this._migrate(gamekitProgress);
        return this.progress;
      }
    } catch {
      // GameKit non disponible
    }

    // Fallback localStorage
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.progress = this._migrate(JSON.parse(stored));
        return this.progress;
      }
    } catch (error) {
      console.warn('Erreur lors du chargement de la progression:', error);
    }

    // Progression par défaut
    this.progress = createDefaultProgress();
    return this.progress;
  }

  /**
   * Sauvegarde la progression
   *
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.progress) {return;}

    try {
      // Sauvegarder via GameKit
      await GameKit.saveProgress(this.progress);
    } catch {
      // GameKit non disponible
    }

    // Fallback localStorage
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde:', error);
    }

    this._emitUpdate();
  }

  /**
   * Migre les données vers la dernière version
   * @private
   */
  _migrate(data) {
    // Pour l'instant, pas de migration nécessaire
    return { ...createDefaultProgress(), ...data };
  }

  // --------------------------------------------------------------------------
  // Progression globale
  // --------------------------------------------------------------------------

  /**
   * Retourne l'XP global
   *
   * @returns {number}
   */
  getGlobalXP() {
    return this.progress?.globalXP || 0;
  }

  /**
   * Ajoute de l'XP
   *
   * @param {number} xp - XP à ajouter
   */
  addXP(xp) {
    if (!this.progress) {return;}
    this.progress.globalXP += xp;
  }

  /**
   * Retourne le niveau global
   *
   * @returns {{ level: number, currentXP: number, requiredXP: number, progress: number }}
   */
  getLevel() {
    const xp = this.getGlobalXP();
    let level = 1;
    let usedXP = 0;

    while (true) {
      const requiredForNext = Math.floor(100 * Math.pow(level, 1.5));
      if (usedXP + requiredForNext > xp) {
        const currentXP = xp - usedXP;
        return {
          level,
          currentXP,
          requiredXP: requiredForNext,
          progress: Math.round((currentXP / requiredForNext) * 100),
        };
      }
      usedXP += requiredForNext;
      level++;
    }
  }

  // --------------------------------------------------------------------------
  // Compétences (Skills)
  // --------------------------------------------------------------------------

  /**
   * Retourne la progression d'une compétence
   *
   * @param {string} skillId - ID de la compétence
   * @returns {Object}
   */
  getSkill(skillId) {
    if (!this.progress?.skills[skillId]) {
      this.progress.skills[skillId] = {
        level: 1,
        xp: 0,
        accuracy: 0,
        totalQuestions: 0,
        correctAnswers: 0,
      };
    }
    return this.progress.skills[skillId];
  }

  /**
   * Met à jour une compétence après une session
   *
   * @param {string} skillId - ID de la compétence
   * @param {Object} sessionData - Données de la session
   */
  updateSkill(skillId, sessionData) {
    const skill = this.getSkill(skillId);

    skill.xp += sessionData.xp || 0;
    skill.totalQuestions += sessionData.totalQuestions || 0;
    skill.correctAnswers += sessionData.correctAnswers || 0;

    // Recalculer l'accuracy
    if (skill.totalQuestions > 0) {
      skill.accuracy = Math.round(
        (skill.correctAnswers / skill.totalQuestions) * 100,
      );
    }

    // Calculer le niveau de skill
    skill.level = this._calculateSkillLevel(skill.xp);
  }

  /**
   * Calcule le niveau d'une compétence
   * @private
   */
  _calculateSkillLevel(xp) {
    // Formule simplifiée : 50 XP par niveau
    return Math.floor(xp / 50) + 1;
  }

  /**
   * Retourne toutes les compétences
   *
   * @returns {Object}
   */
  getAllSkills() {
    const result = {};
    for (const skillId in SKILLS) {
      result[skillId] = {
        ...SKILLS[skillId],
        ...this.getSkill(skillId),
      };
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Sessions
  // --------------------------------------------------------------------------

  /**
   * Enregistre une session d'exercice
   *
   * @param {Object} sessionData - Données de la session
   */
  recordSession(sessionData) {
    if (!this.progress) {return;}

    const session = {
      timestamp: Date.now(),
      exerciseId: sessionData.exerciseId,
      skill: sessionData.skill,
      score: sessionData.score,
      xp: sessionData.xp,
      accuracy: sessionData.accuracy,
      questions: sessionData.totalQuestions,
      correct: sessionData.correctAnswers,
      duration: sessionData.duration,
    };

    this.progress.sessions.push(session);

    // Garder uniquement les 100 dernières sessions
    if (this.progress.sessions.length > 100) {
      this.progress.sessions = this.progress.sessions.slice(-100);
    }

    // Mettre à jour la compétence
    if (sessionData.skill) {
      this.updateSkill(sessionData.skill, sessionData);
    }

    // Mettre à jour l'XP global
    this.addXP(sessionData.xp || 0);
  }

  /**
   * Retourne les sessions récentes
   *
   * @param {number} count - Nombre de sessions
   * @returns {Array}
   */
  getRecentSessions(count = 10) {
    return (this.progress?.sessions || []).slice(-count).reverse();
  }

  // --------------------------------------------------------------------------
  // Achievements
  // --------------------------------------------------------------------------

  /**
   * Vérifie et débloque les achievements
   *
   * @param {Object} context - Contexte (session, stats, etc.)
   * @returns {Array} Nouveaux achievements débloqués
   */
  checkAchievements(context) {
    const newAchievements = [];
    const level = this.getLevel().level;
    for (const rule of ACHIEVEMENT_RULES) {
      if (rule.matches(context, level) && this._unlockAchievement(rule.id)) {
        newAchievements.push(ACHIEVEMENTS[rule.id]);
      }
    }

    return newAchievements;
  }

  /**
   * Débloque un achievement
   * @private
   */
  _unlockAchievement(id) {
    if (!this.progress) {return false;}
    if (this.progress.achievements.includes(id)) {return false;}

    this.progress.achievements.push(id);
    return true;
  }

  /**
   * Retourne les achievements débloqués
   *
   * @returns {Array}
   */
  getUnlockedAchievements() {
    return (this.progress?.achievements || []).map((id) => ACHIEVEMENTS[id]);
  }

  /**
   * Retourne tous les achievements (avec état)
   *
   * @returns {Array}
   */
  getAllAchievements() {
    const unlocked = this.progress?.achievements || [];
    return Object.values(ACHIEVEMENTS).map((a) => ({
      ...a,
      unlocked: unlocked.includes(a.id),
    }));
  }

  // --------------------------------------------------------------------------
  // Paramètres
  // --------------------------------------------------------------------------

  /**
   * Retourne les paramètres
   *
   * @returns {Object}
   */
  getSettings() {
    return this.progress?.settings || DEFAULT_PROGRESS.settings;
  }

  /**
   * Met à jour un paramètre
   *
   * @param {string} key - Clé
   * @param {*} value - Valeur
   */
  setSetting(key, value) {
    if (!this.progress) {return;}
    this.progress.settings[key] = value;
  }

  // --------------------------------------------------------------------------
  // Événements
  // --------------------------------------------------------------------------

  /**
   * Ajoute un callback de mise à jour
   *
   * @param {Function} callback
   */
  onUpdate(callback) {
    this._updateCallbacks.push(callback);
  }

  /**
   * Émet une mise à jour
   * @private
   */
  _emitUpdate() {
    this._updateCallbacks.forEach((cb) => cb(this.progress));
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  /**
   * Réinitialise toute la progression
   * Remplace aussi les collections et paramètres avant sauvegarde/notification.
   */
  async reset() {
    this.progress = createDefaultProgress();
    await this.save();
  }
}

export default ProgressTracker;
