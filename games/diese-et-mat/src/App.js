/**
 * Diese & Mat - Orchestrateur principal de l'application
 *
 * Gère la navigation entre les vues, l'état global et le cycle de vie.
 *
 * @module App
 */

import GameKit from '../../../lib/gamekit.js';

// ============================================================================
// Classe App
// ============================================================================

/**
 * Orchestrateur principal de l'application Diese & Mat.
 */
export class App {
  /**
   * Crée une nouvelle instance de l'application.
   */
  constructor() {
    /** @type {string} Vue active ('menu' | 'exercise' | 'progress' | 'settings') */
    this.currentView = 'menu';

    /** @type {Object|null} Données de progression */
    this.progress = null;

    /** @type {boolean} Audio initialisé */
    this.audioReady = false;

    /** @type {Object} Références aux éléments DOM */
    this.elements = {};
  }

  /**
   * Initialise l'application.
   */
  init() {
    // Cacher le loading et récupérer les références DOM
    this.cacheElements();

    // Charger la progression sauvegardée
    this.loadProgress();

    // Configurer les événements
    this.setupEventListeners();

    // Configurer les hooks GameKit
    this.setupGameKitHooks();

    // Afficher le menu principal
    this.hideLoading();
    this.showView('menu');

    // Mettre à jour l'affichage du niveau
    this.updateLevelBadge();

    console.log('Diese & Mat initialisé');
  }

  /**
   * Met en cache les références aux éléments DOM.
   */
  cacheElements() {
    this.elements = {
      loading: document.getElementById('loading'),
      audioBanner: document.getElementById('audio-banner'),
      levelBadge: document.getElementById('level-badge'),
      btnProgress: document.getElementById('btn-progress'),
      btnSettings: document.getElementById('btn-settings'),
      menuView: document.getElementById('menu-view'),
      exerciseView: document.getElementById('exercise-view'),
      progressView: document.getElementById('progress-view'),
      settingsView: document.getElementById('settings-view'),
    };
  }

  /**
   * Configure les écouteurs d'événements.
   */
  setupEventListeners() {
    // Boutons header
    this.elements.btnProgress?.addEventListener('click', () => {
      this.showView('progress');
    });

    this.elements.btnSettings?.addEventListener('click', () => {
      this.showView('settings');
    });

    // Bannière audio
    this.elements.audioBanner?.addEventListener('click', () => {
      this.initAudio();
    });

    // Raccourcis clavier globaux
    document.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
  }

  /**
   * Configure les hooks du cycle de vie GameKit.
   */
  setupGameKitHooks() {
    // Pause quand l'onglet est masqué
    window.onGamePause = () => {
      console.log('Jeu en pause');
      // TODO: Mettre en pause l'exercice en cours
    };

    // Reprise
    window.onGameResume = () => {
      console.log('Jeu repris');
    };

    // Nettoyage
    window.onGameDispose = () => {
      console.log('Nettoyage du jeu');
      this.dispose();
    };

    // Changement préférence son
    window.onSoundChange = (enabled) => {
      console.log('Son:', enabled ? 'activé' : 'désactivé');
      // TODO: Mettre à jour l'état audio
    };
  }

  /**
   * Cache l'écran de chargement.
   */
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
  }

  /**
   * Affiche une vue.
   * @param {'menu'|'exercise'|'progress'|'settings'} viewName - Nom de la vue
   */
  showView(viewName) {
    // Masquer toutes les vues
    const views = ['menuView', 'exerciseView', 'progressView', 'settingsView'];
    views.forEach(view => {
      if (this.elements[view]) {
        this.elements[view].classList.remove('active');
      }
    });

    // Afficher la vue demandée
    const viewElement = this.elements[`${viewName}View`];
    if (viewElement) {
      viewElement.classList.add('active');
      this.currentView = viewName;

      // Initialiser le contenu de la vue si nécessaire
      this.initView(viewName);
    }
  }

  /**
   * Initialise le contenu d'une vue.
   * @param {string} viewName - Nom de la vue
   */
  initView(viewName) {
    switch (viewName) {
      case 'menu':
        this.renderMenu();
        break;
      case 'progress':
        this.renderProgress();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  /**
   * Affiche le menu principal.
   */
  renderMenu() {
    const container = this.elements.menuView;
    if (!container) {return;}

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: var(--space-lg); text-align: center;">
          Choisissez un exercice
        </h2>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Catégorie: Lecture de notes -->
          <div class="category">
            <h3 style="
              display: flex;
              align-items: center;
              gap: var(--space-sm);
              margin-bottom: var(--space-sm);
              color: var(--color-text-muted);
              font-size: var(--font-size-sm);
            ">
              <span>🎼</span>
              Lecture de notes
            </h3>
            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              ${this.renderExerciseCard('note-treble-natural', 'Clé de sol - Notes naturelles', 'Do à Si sur la portée', 1)}
              ${this.renderExerciseCard('note-treble-sharps', 'Clé de sol - Avec dièses', 'Inclut les altérations', 2, !this.isExerciseUnlocked('note-treble-sharps'))}
              ${this.renderExerciseCard('note-bass-natural', 'Clé de fa - Notes naturelles', 'Lecture en clé de fa', 2, !this.isExerciseUnlocked('note-bass-natural'))}
            </div>
          </div>

          <!-- Catégorie: Intervalles -->
          <div class="category">
            <h3 style="
              display: flex;
              align-items: center;
              gap: var(--space-sm);
              margin-bottom: var(--space-sm);
              color: var(--color-text-muted);
              font-size: var(--font-size-sm);
            ">
              <span>↕️</span>
              Intervalles
            </h3>
            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              ${this.renderExerciseCard('interval-small', 'Petits intervalles', 'Secondes et tierces', 2, !this.isExerciseUnlocked('interval-small'))}
              ${this.renderExerciseCard('interval-all', 'Tous intervalles', 'De l\'unisson à l\'octave', 3, !this.isExerciseUnlocked('interval-all'))}
            </div>
          </div>
        </div>
      </div>
    `;

    // Ajouter les event listeners sur les cartes
    container.querySelectorAll('.exercise-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseId = card.dataset.exerciseId;
        this.startExercise(exerciseId);
      });
    });
  }

  /**
   * Génère le HTML d'une carte d'exercice.
   * @param {string} id - ID de l'exercice
   * @param {string} title - Titre
   * @param {string} description - Description
   * @param {number} difficulty - Difficulté (1-5)
   * @param {boolean} locked - Verrouillé
   * @returns {string} HTML
   */
  renderExerciseCard(id, title, description, difficulty, locked = false) {
    const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
    const progress = this.getExerciseProgress(id);

    return `
      <div class="exercise-card ${locked ? 'locked' : ''}"
           data-exercise-id="${id}"
           style="
             padding: var(--space-md);
             background: var(--color-bg-secondary);
             border: 1px solid var(--color-border);
             border-radius: var(--radius-md);
             cursor: ${locked ? 'not-allowed' : 'pointer'};
             opacity: ${locked ? '0.5' : '1'};
             transition: all var(--transition-fast);
           ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-weight: bold; margin-bottom: var(--space-xs);">
              ${locked ? '🔒 ' : ''}${title}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              ${description}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="color: var(--color-warning); font-size: var(--font-size-sm);">
              ${stars}
            </div>
            ${progress > 0 ? `
              <div style="font-size: var(--font-size-xs); color: var(--color-success); margin-top: var(--space-xs);">
                ${Math.round(progress * 100)}% réussite
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Démarre un exercice.
   * @param {string} exerciseId - ID de l'exercice
   */
  startExercise(exerciseId) {
    console.log('Démarrage exercice:', exerciseId);

    // TODO: Charger l'exercice et afficher la vue exercice
    this.showView('exercise');

    // Afficher un placeholder pour l'instant
    const container = this.elements.exerciseView;
    if (container) {
      container.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: var(--space-lg);
          text-align: center;
        ">
          <div style="font-size: 4rem; margin-bottom: var(--space-lg);">🎵</div>
          <h2>Exercice: ${exerciseId}</h2>
          <p style="color: var(--color-text-muted); margin: var(--space-md) 0;">
            L'exercice sera bientôt disponible !
          </p>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-accent);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          ">
            Retour au menu
          </button>
        </div>
      `;
    }
  }

  /**
   * Affiche la vue progression.
   */
  renderProgress() {
    const container = this.elements.progressView;
    if (!container) {return;}

    const progress = this.progress || this.getDefaultProgress();

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Ma progression</h2>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-xs) var(--space-sm);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            cursor: pointer;
          ">← Retour</button>
        </div>

        <!-- Niveau global -->
        <div style="
          padding: var(--space-lg);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          text-align: center;
          margin-bottom: var(--space-lg);
        ">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            NIVEAU
          </div>
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);">
            ${progress.level}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            ${progress.xp} XP
          </div>
        </div>

        <!-- Compétences -->
        <h3 style="margin-bottom: var(--space-md);">Compétences</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
          ${this.renderSkillBar('Clé de sol', progress.skills['treble-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Clé de fa', progress.skills['bass-clef']?.accuracy || 0)}
          ${this.renderSkillBar('Altérations', progress.skills['accidentals']?.accuracy || 0)}
          ${this.renderSkillBar('Intervalles', progress.skills['intervals']?.accuracy || 0)}
        </div>
      </div>
    `;
  }

  /**
   * Génère une barre de compétence.
   * @param {string} name - Nom de la compétence
   * @param {number} accuracy - Taux de réussite (0-1)
   * @returns {string} HTML
   */
  renderSkillBar(name, accuracy) {
    const percent = Math.round(accuracy * 100);
    return `
      <div style="
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-md);
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span>${name}</span>
          <span style="color: var(--color-text-muted);">${percent}%</span>
        </div>
        <div style="
          height: 8px;
          background: var(--color-bg);
          border-radius: 4px;
          overflow: hidden;
        ">
          <div style="
            width: ${percent}%;
            height: 100%;
            background: var(--color-success);
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
  }

  /**
   * Affiche la vue paramètres.
   */
  renderSettings() {
    const container = this.elements.settingsView;
    if (!container) {return;}

    container.innerHTML = `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Paramètres</h2>
          <button onclick="app.showView('menu')" style="
            padding: var(--space-xs) var(--space-sm);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            cursor: pointer;
          ">← Retour</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Notation -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-weight: bold; margin-bottom: var(--space-sm);">
              Notation musicale
            </div>
            <div style="display: flex; gap: var(--space-sm);">
              <label style="
                flex: 1;
                padding: var(--space-sm);
                background: var(--color-accent);
                color: white;
                border-radius: var(--radius-sm);
                text-align: center;
                cursor: pointer;
              ">
                <input type="radio" name="notation" value="french" checked style="display: none;">
                Do Ré Mi
              </label>
              <label style="
                flex: 1;
                padding: var(--space-sm);
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                text-align: center;
                cursor: pointer;
              ">
                <input type="radio" name="notation" value="english" style="display: none;">
                C D E
              </label>
            </div>
          </div>

          <!-- Volume -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-weight: bold; margin-bottom: var(--space-sm);">
              Volume
            </div>
            <input type="range" min="0" max="100" value="80" style="width: 100%;">
          </div>

          <!-- Reset -->
          <button onclick="app.resetProgress()" style="
            padding: var(--space-md);
            background: var(--color-error);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            margin-top: var(--space-lg);
          ">
            Réinitialiser la progression
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Gère les raccourcis clavier.
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    // Échap pour revenir au menu
    if (event.key === 'Escape' && this.currentView !== 'menu') {
      this.showView('menu');
    }
  }

  /**
   * Initialise l'audio (nécessite une interaction utilisateur).
   */
  initAudio() {
    if (this.audioReady) {return;}

    try {
      // TODO: Initialiser Tone.js
      console.log('Audio initialisé');
      this.audioReady = true;

      // Cacher la bannière
      if (this.elements.audioBanner) {
        this.elements.audioBanner.classList.add('hidden');
      }
    } catch (error) {
      console.error('Erreur initialisation audio:', error);
    }
  }

  /**
   * Charge la progression depuis GameKit.
   */
  loadProgress() {
    this.progress = GameKit.loadProgress() || this.getDefaultProgress();
  }

  /**
   * Sauvegarde la progression via GameKit.
   */
  saveProgress() {
    if (this.progress) {
      GameKit.saveProgress(this.progress);
    }
  }

  /**
   * Retourne la progression par défaut.
   * @returns {Object}
   */
  getDefaultProgress() {
    return {
      level: 1,
      xp: 0,
      skills: {
        'treble-clef': { level: 0, accuracy: 0, attempts: 0 },
        'bass-clef': { level: 0, accuracy: 0, attempts: 0 },
        'accidentals': { level: 0, accuracy: 0, attempts: 0 },
        'intervals': { level: 0, accuracy: 0, attempts: 0 },
      },
      history: [],
      achievements: [],
    };
  }

  /**
   * Vérifie si un exercice est débloqué.
   * @param {string} exerciseId - ID de l'exercice
   * @returns {boolean}
   */
  isExerciseUnlocked(exerciseId) {
    // Pour l'instant, seul le premier exercice est débloqué par défaut
    const unlockedByDefault = ['note-treble-natural'];
    if (unlockedByDefault.includes(exerciseId)) {
      return true;
    }

    // Les autres sont débloqués selon la progression
    const progress = this.progress || this.getDefaultProgress();

    // Déblocage basé sur les compétences
    switch (exerciseId) {
      case 'note-treble-sharps':
        return (progress.skills['treble-clef']?.accuracy || 0) >= 0.7;
      case 'note-bass-natural':
        return (progress.skills['treble-clef']?.accuracy || 0) >= 0.5;
      case 'interval-small':
        return progress.level >= 2;
      case 'interval-all':
        return (progress.skills['intervals']?.accuracy || 0) >= 0.6;
      default:
        return false;
    }
  }

  /**
   * Retourne le taux de réussite d'un exercice.
   * @param {string} exerciseId - ID de l'exercice
   * @returns {number} Taux (0-1)
   */
  getExerciseProgress(exerciseId) {
    const progress = this.progress || this.getDefaultProgress();
    const record = progress.history?.find(h => h.exerciseId === exerciseId);
    return record ? record.score / record.maxScore : 0;
  }

  /**
   * Met à jour l'affichage du niveau dans le header.
   */
  updateLevelBadge() {
    if (this.elements.levelBadge) {
      const level = this.progress?.level || 1;
      this.elements.levelBadge.textContent = `Niveau ${level}`;
    }
  }

  /**
   * Réinitialise la progression.
   */
  resetProgress() {
    if (confirm('Voulez-vous vraiment réinitialiser votre progression ?')) {
      this.progress = this.getDefaultProgress();
      GameKit.clearProgress();
      this.updateLevelBadge();
      this.showView('menu');
    }
  }

  /**
   * Nettoie les ressources.
   */
  dispose() {
    // Sauvegarder la progression
    this.saveProgress();

    // TODO: Nettoyer l'audio, les timers, etc.
    console.log('Diese & Mat nettoyé');
  }
}
