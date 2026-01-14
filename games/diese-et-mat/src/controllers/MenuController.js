/**
 * MenuController - Gestion du menu de sélection d'exercices
 *
 * Gère l'affichage du menu, les filtres et la sélection d'exercices.
 * Émet un événement 'exercise-selected' quand un exercice est choisi.
 *
 * @module controllers/MenuController
 */

import { EventEmitter } from '../utils/EventEmitter.js';

// ============================================================================
// Classe MenuController
// ============================================================================

/**
 * Contrôleur du menu de sélection d'exercices
 */
export class MenuController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur de menu
   *
   * @param {Object} options - Options de configuration
   * @param {HTMLElement} options.container - Élément DOM conteneur
   * @param {Array} options.exercises - Liste des exercices disponibles
   * @param {Function} options.isUnlocked - Fonction (id) => boolean
   * @param {Function} options.getProgress - Fonction (id) => number (0-1)
   */
  constructor(options) {
    super();

    /** @type {HTMLElement} Conteneur DOM */
    this.container = options.container;

    /** @type {Array} Liste des exercices */
    this.exercises = options.exercises || [];

    /** @type {Function} Vérifie si un exercice est déverrouillé */
    this.isUnlocked = options.isUnlocked || (() => true);

    /** @type {Function} Retourne la progression d'un exercice */
    this.getProgress = options.getProgress || (() => 0);

    /** @type {Object} État des filtres */
    this.filters = {
      category: 'all',    // 'all' | 'notes' | 'intervals' | 'chords' | 'rhythm'
      difficulty: 'all',  // 'all' | 1 | 2 | 3
      showLocked: true,   // Afficher les exercices verrouillés
    };
  }

  // --------------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------------

  /**
   * Affiche le menu
   */
  render() {
    if (!this.container) {
      return;
    }

    const filteredExercises = this._getFilteredExercises();

    this.container.innerHTML = `
      <div class="menu-container">
        <h2 class="menu-title">Choisissez un exercice</h2>

        <!-- Barre de filtres -->
        <div class="filters-bar">
          <div class="filter-group">
            <label class="filter-label">Catégorie</label>
            <div class="filter-buttons" data-filter="category">
              <button class="filter-btn ${this.filters.category === 'all' ? 'active' : ''}" data-value="all">Tous</button>
              <button class="filter-btn ${this.filters.category === 'notes' ? 'active' : ''}" data-value="notes">🎼 Notes</button>
              <button class="filter-btn ${this.filters.category === 'intervals' ? 'active' : ''}" data-value="intervals">↕️ Intervalles</button>
              <button class="filter-btn ${this.filters.category === 'chords' ? 'active' : ''}" data-value="chords">🎹 Accords</button>
              <button class="filter-btn ${this.filters.category === 'rhythm' ? 'active' : ''}" data-value="rhythm">🥁 Rythme</button>
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">Difficulté</label>
            <div class="filter-buttons" data-filter="difficulty">
              <button class="filter-btn ${this.filters.difficulty === 'all' ? 'active' : ''}" data-value="all">Tous</button>
              <button class="filter-btn ${this.filters.difficulty === 1 ? 'active' : ''}" data-value="1">★☆☆</button>
              <button class="filter-btn ${this.filters.difficulty === 2 ? 'active' : ''}" data-value="2">★★☆</button>
              <button class="filter-btn ${this.filters.difficulty === 3 ? 'active' : ''}" data-value="3">★★★</button>
            </div>
          </div>

          <div class="filter-group filter-toggle">
            <label class="toggle-label">
              <input type="checkbox" data-filter="showLocked" ${this.filters.showLocked ? 'checked' : ''}>
              <span>Afficher verrouillés</span>
            </label>
          </div>
        </div>

        <!-- Compteur de résultats -->
        <div class="filter-results">
          ${filteredExercises.length} exercice${filteredExercises.length > 1 ? 's' : ''} trouvé${filteredExercises.length > 1 ? 's' : ''}
        </div>

        <!-- Grille d'exercices -->
        <div class="exercises-grid">
          ${this._renderExerciseCards(filteredExercises)}
        </div>
      </div>
    `;

    this._setupEventListeners();
  }

  /**
   * Génère le HTML des cartes d'exercices
   * @private
   */
  _renderExerciseCards(exercises) {
    if (exercises.length === 0) {
      return '<div class="no-results">Aucun exercice ne correspond aux filtres sélectionnés.</div>';
    }

    return exercises.map(ex => this._renderExerciseCard(ex)).join('');
  }

  /**
   * Génère le HTML d'une carte d'exercice
   * @private
   */
  _renderExerciseCard(exercise) {
    const { id, title, description, difficulty, icon, categoryName } = exercise;
    const locked = !this.isUnlocked(id);
    const progress = this.getProgress(id);
    const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);

    return `
      <div class="exercise-card ${locked ? 'locked' : ''}" data-exercise-id="${id}">
        <div class="exercise-card-category">
          <span class="category-icon">${icon || ''}</span>
          <span class="category-name">${categoryName || ''}</span>
        </div>
        <div class="exercise-card-content">
          <div class="exercise-card-info">
            <div class="exercise-card-title">
              ${locked ? '🔒 ' : ''}${title}
            </div>
            <div class="exercise-card-description">${description}</div>
          </div>
          <div class="exercise-card-meta">
            <div class="exercise-card-stars">${stars}</div>
            ${progress > 0 ? `<div class="exercise-card-progress">${Math.round(progress * 100)}%</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Filtrage
  // --------------------------------------------------------------------------

  /**
   * Retourne les exercices filtrés selon les critères actuels
   * @private
   */
  _getFilteredExercises() {
    return this.exercises.filter(ex => {
      // Filtre par catégorie
      if (this.filters.category !== 'all' && ex.category !== this.filters.category) {
        return false;
      }

      // Filtre par difficulté
      if (this.filters.difficulty !== 'all' && ex.difficulty !== this.filters.difficulty) {
        return false;
      }

      // Filtre par état verrouillé
      if (!this.filters.showLocked && !this.isUnlocked(ex.id)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Met à jour un filtre et rafraîchit l'affichage
   *
   * @param {string} filterName - Nom du filtre
   * @param {*} value - Nouvelle valeur
   */
  setFilter(filterName, value) {
    if (filterName in this.filters) {
      this.filters[filterName] = value;
      this.render();
      this.emit('filter-changed', { filter: filterName, value });
    }
  }

  // --------------------------------------------------------------------------
  // Événements
  // --------------------------------------------------------------------------

  /**
   * Configure les event listeners
   * @private
   */
  _setupEventListeners() {
    // Délégation d'événements pour les filtres
    this.container.addEventListener('click', (e) => {
      // Clic sur un bouton de filtre
      const filterBtn = e.target.closest('.filter-btn');
      if (filterBtn) {
        const filterGroup = filterBtn.closest('[data-filter]');
        if (filterGroup) {
          const filterName = filterGroup.dataset.filter;
          let value = filterBtn.dataset.value;

          // Convertir en nombre pour difficulty
          if (filterName === 'difficulty' && value !== 'all') {
            value = parseInt(value, 10);
          }

          this.setFilter(filterName, value);
        }
        return;
      }

      // Clic sur une carte d'exercice
      const card = e.target.closest('.exercise-card:not(.locked)');
      if (card) {
        const exerciseId = card.dataset.exerciseId;
        this.emit('exercise-selected', { exerciseId });
      }
    });

    // Checkbox pour showLocked
    const lockedCheckbox = this.container.querySelector('[data-filter="showLocked"]');
    if (lockedCheckbox) {
      lockedCheckbox.addEventListener('change', (e) => {
        this.setFilter('showLocked', e.target.checked);
      });
    }
  }

  // --------------------------------------------------------------------------
  // API publique
  // --------------------------------------------------------------------------

  /**
   * Met à jour la liste des exercices
   *
   * @param {Array} exercises - Nouvelle liste
   */
  setExercises(exercises) {
    this.exercises = exercises;
    this.render();
  }

  /**
   * Rafraîchit l'affichage (utile après changement de progression)
   */
  refresh() {
    this.render();
  }

  /**
   * Nettoie les ressources
   */
  dispose() {
    super.dispose();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default MenuController;
