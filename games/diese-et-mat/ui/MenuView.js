/**
 * MenuView - Vue du menu principal
 *
 * Affiche la liste des catégories et exercices disponibles.
 *
 * @module ui/MenuView
 */

// ============================================================================
// Classe MenuView
// ============================================================================

/**
 * Vue du menu principal
 */
export class MenuView {
  /**
   * Crée une nouvelle vue de menu
   *
   * @param {HTMLElement} container - Conteneur DOM
   * @param {Object} options - Options
   * @param {Function} options.onExerciseSelect - Callback de sélection
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onExerciseSelect = options.onExerciseSelect || (() => {});

    /** @type {Object|null} Données des exercices */
    this.data = null;

    /** @type {string|null} Catégorie sélectionnée */
    this.selectedCategory = null;

    /** @type {Object} Progression par exercice */
    this.progress = {};
  }

  // --------------------------------------------------------------------------
  // Chargement des données
  // --------------------------------------------------------------------------

  /**
   * Charge les données des exercices
   *
   * @returns {Promise<void>}
   */
  async loadExercises() {
    try {
      const response = await fetch('./data/exercises.json');
      this.data = await response.json();
    } catch (error) {
      console.error('Erreur lors du chargement des exercices:', error);
      this.data = { exercises: [], categories: [] };
    }
  }

  /**
   * Met à jour la progression
   *
   * @param {Object} progress - Progression par exercice
   */
  setProgress(progress) {
    this.progress = progress || {};
  }

  // --------------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------------

  /**
   * Affiche le menu
   */
  async render() {
    if (!this.data) {
      await this.loadExercises();
    }

    this.container.innerHTML = '';
    this.container.className = 'menu-view active';

    // Titre
    const header = document.createElement('div');
    header.className = 'menu-header';
    header.innerHTML = `
      <h2>Choisir un exercice</h2>
      <p>Sélectionnez une catégorie puis un exercice</p>
    `;
    this.container.appendChild(header);

    // Catégories
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'categories-container';

    for (const category of this.data.categories) {
      const categoryCard = this._createCategoryCard(category);
      categoriesContainer.appendChild(categoryCard);
    }

    this.container.appendChild(categoriesContainer);

    // Zone d'exercices (initialement cachée)
    const exercisesContainer = document.createElement('div');
    exercisesContainer.className = 'exercises-container';
    exercisesContainer.style.display = 'none';
    exercisesContainer.id = 'exercises-list';
    this.container.appendChild(exercisesContainer);

    this._addStyles();
  }

  /**
   * Crée une carte de catégorie
   * @private
   */
  _createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.dataset.categoryId = category.id;

    // Compter les exercices de cette catégorie
    const exerciseCount = this.data.exercises.filter(
      (e) => e.category === category.id,
    ).length;

    card.innerHTML = `
      <div class="category-icon">${category.icon}</div>
      <div class="category-info">
        <h3>${category.name}</h3>
        <p>${category.description}</p>
        <span class="exercise-count">${exerciseCount} exercice${exerciseCount > 1 ? 's' : ''}</span>
      </div>
    `;

    card.addEventListener('click', () => this._showCategory(category.id));

    return card;
  }

  /**
   * Affiche les exercices d'une catégorie
   * @private
   */
  _showCategory(categoryId) {
    this.selectedCategory = categoryId;

    const exercisesContainer = document.getElementById('exercises-list');
    exercisesContainer.style.display = 'block';
    exercisesContainer.innerHTML = '';

    // Bouton retour
    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    backBtn.innerHTML = '← Retour';
    backBtn.addEventListener('click', () => {
      exercisesContainer.style.display = 'none';
      this.selectedCategory = null;
    });
    exercisesContainer.appendChild(backBtn);

    // Liste des exercices
    const exercises = this.data.exercises.filter(
      (e) => e.category === categoryId,
    );

    const list = document.createElement('div');
    list.className = 'exercise-list';

    for (const exercise of exercises) {
      const exerciseCard = this._createExerciseCard(exercise);
      list.appendChild(exerciseCard);
    }

    exercisesContainer.appendChild(list);

    // Scroll vers les exercices
    exercisesContainer.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Crée une carte d'exercice
   * @private
   */
  _createExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exerciseId = exercise.id;

    // Progression de l'exercice
    const progress = this.progress[exercise.id] || { bestScore: 0, plays: 0 };

    // Étoiles de difficulté
    const stars = '★'.repeat(exercise.difficulty) +
      '☆'.repeat(3 - exercise.difficulty);

    card.innerHTML = `
      <div class="exercise-header">
        <h4>${exercise.title}</h4>
        <span class="difficulty">${stars}</span>
      </div>
      <p class="exercise-description">${exercise.description}</p>
      <div class="exercise-meta">
        <span class="questions-count">${exercise.config.questionsCount} questions</span>
        ${progress.plays > 0 ? `<span class="best-score">Meilleur: ${progress.bestScore}%</span>` : ''}
      </div>
      <button class="start-button">Commencer</button>
    `;

    const startBtn = card.querySelector('.start-button');
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onExerciseSelect(exercise);
    });

    return card;
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  /**
   * Ajoute les styles CSS
   * @private
   */
  _addStyles() {
    if (document.getElementById('menu-view-styles')) {return;}

    const style = document.createElement('style');
    style.id = 'menu-view-styles';
    style.textContent = `
      .menu-view {
        padding: var(--space-md);
        max-width: 800px;
        margin: 0 auto;
      }

      .menu-header {
        text-align: center;
        margin-bottom: var(--space-lg);
      }

      .menu-header h2 {
        margin-bottom: var(--space-xs);
      }

      .menu-header p {
        color: var(--color-text-muted);
      }

      .categories-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      .category-card {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .category-card:hover {
        border-color: var(--color-accent);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .category-icon {
        font-size: 2.5rem;
      }

      .category-info h3 {
        margin: 0 0 var(--space-xs);
      }

      .category-info p {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .exercise-count {
        display: inline-block;
        margin-top: var(--space-xs);
        font-size: var(--font-size-xs);
        color: var(--color-accent);
      }

      .exercises-container {
        padding-top: var(--space-md);
        border-top: 1px solid var(--color-border);
      }

      .back-button {
        background: none;
        border: none;
        color: var(--color-accent);
        font-size: var(--font-size-md);
        cursor: pointer;
        padding: var(--space-sm) 0;
        margin-bottom: var(--space-md);
      }

      .back-button:hover {
        text-decoration: underline;
      }

      .exercise-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .exercise-card {
        padding: var(--space-md);
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
      }

      .exercise-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-xs);
      }

      .exercise-header h4 {
        margin: 0;
      }

      .difficulty {
        color: var(--color-warning);
      }

      .exercise-description {
        margin: 0 0 var(--space-sm);
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }

      .exercise-meta {
        display: flex;
        gap: var(--space-md);
        margin-bottom: var(--space-md);
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .best-score {
        color: var(--color-success);
      }

      .start-button {
        width: 100%;
        padding: var(--space-sm);
        background: var(--color-accent);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--font-size-md);
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .start-button:hover {
        background: var(--color-accent-hover);
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Cache la vue
   */
  hide() {
    this.container.classList.remove('active');
  }

  /**
   * Affiche la vue
   */
  show() {
    this.container.classList.add('active');
  }

  /**
   * Nettoie la vue
   */
  dispose() {
    this.container.innerHTML = '';
    this.data = null;
  }
}

export default MenuView;
