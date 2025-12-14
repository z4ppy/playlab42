/**
 * Playlab42 - Viewer de Parcours
 * Affiche et navigue dans les slides d'un Epic
 * @see openspec/changes/add-parcours-system/specs/parcours/spec.md
 */

// === Constantes ===
const STORAGE_KEY = 'parcours-progress';
const PRELOAD_ADJACENT = 1; // Nombre de slides à pré-charger

/**
 * Classe principale du viewer de parcours
 */
export class ParcoursViewer {
  /**
   * @param {HTMLElement} container - Conteneur du viewer
   * @param {Object} options - Options de configuration
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onClose: options.onClose || (() => {}),
      onSlideChange: options.onSlideChange || (() => {}),
      ...options,
    };

    // État
    this.epic = null;
    this.slides = []; // Liste plate des slides
    this.currentIndex = 0;
    this.progress = { visited: [], current: null };
    this.menuOpen = false;

    // Éléments DOM (initialisés dans render())
    this.el = {};

    // Bindings
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  /**
   * Charge un Epic et affiche le viewer
   * @param {string} epicId - ID de l'epic à charger
   * @param {string} [slideId] - ID de la slide à afficher (optionnel)
   */
  async load(epicId, slideId = null) {
    try {
      // Charger le catalogue parcours
      const response = await fetch('./data/parcours.json');
      if (!response.ok) {throw new Error('Catalogue parcours introuvable');}
      const catalogue = await response.json();

      // Trouver l'epic
      this.epic = catalogue.epics.find(e => e.id === epicId);
      if (!this.epic) {throw new Error(`Epic non trouvé: ${epicId}`);}

      // Extraire la liste plate des slides
      this.slides = this.flattenStructure(this.epic.structure);

      // Charger la progression
      this.loadProgress();

      // Déterminer la slide à afficher
      if (slideId) {
        const index = this.slides.findIndex(s => s.id === slideId);
        this.currentIndex = index >= 0 ? index : 0;
      } else if (this.progress.current) {
        const index = this.slides.findIndex(s => s.id === this.progress.current);
        this.currentIndex = index >= 0 ? index : 0;
      } else {
        this.currentIndex = 0;
      }

      // Rendre le viewer
      this.render();
      this.setupEventListeners();
      await this.showSlide(this.currentIndex);

    } catch (e) {
      console.error('Erreur chargement parcours:', e);
      this.showError(e.message);
    }
  }

  /**
   * Aplatit la structure hiérarchique en liste de slides
   * @param {Array} structure - Structure hiérarchique
   * @param {string} [parentPath] - Chemin parent pour le breadcrumb
   * @returns {Array} Liste plate des slides avec métadonnées
   */
  flattenStructure(structure, parentPath = []) {
    const slides = [];

    for (const item of structure) {
      if (item.type === 'section') {
        const sectionPath = [...parentPath, { id: item.id, title: item.title, icon: item.icon }];
        slides.push(...this.flattenStructure(item.children, sectionPath));
      } else if (item.type === 'slide') {
        slides.push({
          id: item.id,
          title: item.title,
          icon: item.icon,
          optional: item.optional,
          path: parentPath,
        });
      }
    }

    return slides;
  }

  /**
   * Génère le HTML du viewer
   */
  render() {
    this.container.innerHTML = `
      <div class="parcours-viewer">
        <header class="pv-header">
          <button class="pv-btn pv-btn-close" aria-label="Fermer" title="Fermer (Escape)">✕</button>
          <nav class="pv-breadcrumb" aria-label="Fil d'Ariane"></nav>
          <button class="pv-btn pv-btn-menu" aria-label="Menu" title="Menu (m)">☰</button>
        </header>

        <aside class="pv-sidebar" aria-label="Plan du parcours" aria-hidden="true">
          <div class="pv-sidebar-header">
            <h2 class="pv-epic-title"></h2>
            <button class="pv-btn pv-btn-close-menu" aria-label="Fermer le menu">✕</button>
          </div>
          <nav class="pv-menu" role="tree" aria-label="Structure du parcours"></nav>
        </aside>

        <main class="pv-content" role="region" aria-label="Contenu de la slide">
          <div class="pv-slide-container">
            <iframe class="pv-slide-frame" sandbox="allow-scripts allow-same-origin" title="Contenu de la slide"></iframe>
            <div class="pv-loading">
              <div class="pv-spinner"></div>
              <p>Chargement...</p>
            </div>
          </div>
        </main>

        <footer class="pv-footer">
          <button class="pv-btn pv-btn-prev" aria-label="Précédent" title="Précédent (←)">← Précédent</button>
          <div class="pv-progress-info" aria-live="polite" aria-atomic="true">
            <span class="pv-progress-text"></span>
            <div class="pv-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="pv-progress-fill"></div>
            </div>
          </div>
          <button class="pv-btn pv-btn-next" aria-label="Suivant" title="Suivant (→)">Suivant →</button>
        </footer>
      </div>
    `;

    // Cacher les éléments DOM
    this.el = {
      viewer: this.container.querySelector('.parcours-viewer'),
      header: this.container.querySelector('.pv-header'),
      btnClose: this.container.querySelector('.pv-btn-close'),
      breadcrumb: this.container.querySelector('.pv-breadcrumb'),
      btnMenu: this.container.querySelector('.pv-btn-menu'),
      sidebar: this.container.querySelector('.pv-sidebar'),
      epicTitle: this.container.querySelector('.pv-epic-title'),
      btnCloseMenu: this.container.querySelector('.pv-btn-close-menu'),
      menu: this.container.querySelector('.pv-menu'),
      content: this.container.querySelector('.pv-content'),
      slideContainer: this.container.querySelector('.pv-slide-container'),
      slideFrame: this.container.querySelector('.pv-slide-frame'),
      loading: this.container.querySelector('.pv-loading'),
      footer: this.container.querySelector('.pv-footer'),
      btnPrev: this.container.querySelector('.pv-btn-prev'),
      btnNext: this.container.querySelector('.pv-btn-next'),
      progressText: this.container.querySelector('.pv-progress-text'),
      progressFill: this.container.querySelector('.pv-progress-fill'),
    };

    // Remplir le titre de l'epic
    this.el.epicTitle.textContent = this.epic.title;

    // Construire le menu
    this.renderMenu();
  }

  /**
   * Génère le menu de navigation (tree view)
   */
  renderMenu() {
    this.el.menu.innerHTML = this.buildMenuHTML(this.epic.structure);
  }

  /**
   * Construit le HTML du menu récursivement
   * @param {Array} structure - Structure hiérarchique
   * @returns {string} HTML du menu
   */
  buildMenuHTML(structure) {
    let html = '<ul role="group">';

    for (const item of structure) {
      if (item.type === 'section') {
        html += `
          <li role="treeitem" aria-expanded="true" class="pv-menu-section">
            <button class="pv-menu-toggle" aria-label="Déplier/Replier">
              <span class="pv-menu-icon">${item.icon || '📁'}</span>
              <span class="pv-menu-label">${this.escapeHtml(item.title)}</span>
            </button>
            ${this.buildMenuHTML(item.children)}
          </li>
        `;
      } else if (item.type === 'slide') {
        const isVisited = this.progress.visited.includes(item.id);
        const isCurrent = this.slides[this.currentIndex]?.id === item.id;
        const stateClass = isCurrent ? 'current' : (isVisited ? 'visited' : '');
        const stateIcon = isCurrent ? '●' : (isVisited ? '✓' : '○');

        html += `
          <li role="treeitem" class="pv-menu-slide ${stateClass} ${item.optional ? 'optional' : ''}" data-slide-id="${item.id}">
            <button class="pv-menu-item">
              <span class="pv-menu-state">${stateIcon}</span>
              <span class="pv-menu-icon">${item.icon || '📄'}</span>
              <span class="pv-menu-label">${this.escapeHtml(item.title)}</span>
              ${item.optional ? '<span class="pv-menu-optional">(optionnel)</span>' : ''}
            </button>
          </li>
        `;
      }
    }

    html += '</ul>';
    return html;
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Boutons header
    this.el.btnClose.addEventListener('click', () => this.close());
    this.el.btnMenu.addEventListener('click', () => this.toggleMenu());
    this.el.btnCloseMenu.addEventListener('click', () => this.toggleMenu(false));

    // Navigation
    this.el.btnPrev.addEventListener('click', () => this.prev());
    this.el.btnNext.addEventListener('click', () => this.next());

    // Menu - click sur slide
    this.el.menu.addEventListener('click', (e) => {
      const slideItem = e.target.closest('.pv-menu-slide');
      if (slideItem) {
        const slideId = slideItem.dataset.slideId;
        const index = this.slides.findIndex(s => s.id === slideId);
        if (index >= 0) {
          this.goTo(index);
          this.toggleMenu(false);
        }
      }

      // Toggle section
      const toggle = e.target.closest('.pv-menu-toggle');
      if (toggle) {
        const section = toggle.closest('.pv-menu-section');
        const isExpanded = section.getAttribute('aria-expanded') === 'true';
        section.setAttribute('aria-expanded', !isExpanded);
      }
    });

    // Clavier
    document.addEventListener('keydown', this.handleKeydown);

    // Hash change
    window.addEventListener('hashchange', this.handleHashChange);

    // Chargement iframe
    this.el.slideFrame.addEventListener('load', () => {
      this.el.loading.classList.add('hidden');
    });
  }

  /**
   * Gère les événements clavier
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    // Ignorer si focus dans un input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {return;}

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.next();
        break;
      case 'Escape':
        e.preventDefault();
        if (this.menuOpen) {
          this.toggleMenu(false);
        } else {
          this.close();
        }
        break;
      case 'm':
        e.preventDefault();
        this.toggleMenu();
        break;
      case 'Home':
        e.preventDefault();
        this.goTo(0);
        break;
      case 'End':
        e.preventDefault();
        this.goTo(this.slides.length - 1);
        break;
    }
  }

  /**
   * Gère les changements de hash URL
   */
  handleHashChange() {
    const hash = window.location.hash;
    const match = hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);

    if (!match) {
      this.close();
      return;
    }

    const [, epicId, slideId] = match;

    // Si c'est un autre epic, recharger
    if (epicId !== this.epic?.id) {
      this.load(epicId, slideId);
      return;
    }

    // Si c'est une autre slide du même epic
    if (slideId) {
      const index = this.slides.findIndex(s => s.id === slideId);
      if (index >= 0 && index !== this.currentIndex) {
        this.showSlide(index);
      }
    }
  }

  /**
   * Affiche une slide par son index
   * @param {number} index - Index de la slide
   */
  showSlide(index) {
    if (index < 0 || index >= this.slides.length) {return;}

    const slide = this.slides[index];
    this.currentIndex = index;

    // Mettre à jour l'URL
    const newHash = `#/parcours/${this.epic.id}/${slide.id}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }

    // Afficher le loading
    this.el.loading.classList.remove('hidden');

    // Charger la slide dans l'iframe
    const slidePath = `${this.epic.path}/slides/${slide.id}/index.html`;
    this.el.slideFrame.src = slidePath;

    // Marquer comme visitée
    if (!this.progress.visited.includes(slide.id)) {
      this.progress.visited.push(slide.id);
    }
    this.progress.current = slide.id;
    this.saveProgress();

    // Mettre à jour l'UI
    this.updateUI();

    // Pré-charger les slides adjacentes
    this.preloadAdjacent();

    // Callback
    this.options.onSlideChange(slide, index);
  }

  /**
   * Met à jour l'interface utilisateur
   */
  updateUI() {
    const slide = this.slides[this.currentIndex];

    // Breadcrumb
    this.el.breadcrumb.innerHTML = this.buildBreadcrumb(slide);

    // Boutons navigation
    this.el.btnPrev.disabled = this.currentIndex === 0;
    this.el.btnNext.disabled = this.currentIndex === this.slides.length - 1;

    // Progression
    const progressPercent = Math.round(((this.currentIndex + 1) / this.slides.length) * 100);
    this.el.progressText.textContent = `${this.currentIndex + 1} / ${this.slides.length}`;
    this.el.progressFill.style.width = `${progressPercent}%`;
    this.el.progressFill.parentElement.setAttribute('aria-valuenow', progressPercent);

    // Menu - mettre à jour les états
    this.el.menu.querySelectorAll('.pv-menu-slide').forEach(item => {
      const slideId = item.dataset.slideId;
      const isVisited = this.progress.visited.includes(slideId);
      const isCurrent = slideId === slide.id;

      item.classList.toggle('visited', isVisited && !isCurrent);
      item.classList.toggle('current', isCurrent);

      // ARIA: marquer la slide courante
      if (isCurrent) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }

      const stateEl = item.querySelector('.pv-menu-state');
      if (stateEl) {
        stateEl.textContent = isCurrent ? '●' : (isVisited ? '✓' : '○');
      }
    });
  }

  /**
   * Construit le fil d'Ariane
   * @param {Object} slide - Slide actuelle
   * @returns {string} HTML du breadcrumb
   */
  buildBreadcrumb(slide) {
    const parts = [
      `<span class="pv-breadcrumb-item">${this.escapeHtml(this.epic.title)}</span>`,
    ];

    for (const section of slide.path) {
      parts.push('<span class="pv-breadcrumb-sep">›</span>');
      parts.push(`<span class="pv-breadcrumb-item">${this.escapeHtml(section.title)}</span>`);
    }

    parts.push('<span class="pv-breadcrumb-sep">›</span>');
    parts.push(`<span class="pv-breadcrumb-item current">${this.escapeHtml(slide.title)}</span>`);

    return parts.join('');
  }

  /**
   * Pré-charge les slides adjacentes
   */
  preloadAdjacent() {
    for (let i = 1; i <= PRELOAD_ADJACENT; i++) {
      // Suivante
      if (this.currentIndex + i < this.slides.length) {
        const nextSlide = this.slides[this.currentIndex + i];
        this.preloadSlide(nextSlide.id);
      }
      // Précédente
      if (this.currentIndex - i >= 0) {
        const prevSlide = this.slides[this.currentIndex - i];
        this.preloadSlide(prevSlide.id);
      }
    }
  }

  /**
   * Pré-charge une slide
   * @param {string} slideId - ID de la slide
   */
  preloadSlide(slideId) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `${this.epic.path}/slides/${slideId}/index.html`;
    document.head.appendChild(link);
  }

  /**
   * Navigation - slide précédente
   */
  prev() {
    if (this.currentIndex > 0) {
      this.goTo(this.currentIndex - 1);
    }
  }

  /**
   * Navigation - slide suivante
   */
  next() {
    if (this.currentIndex < this.slides.length - 1) {
      this.goTo(this.currentIndex + 1);
    }
  }

  /**
   * Navigation - aller à une slide
   * @param {number} index - Index de la slide
   */
  goTo(index) {
    if (index >= 0 && index < this.slides.length) {
      this.showSlide(index);
    }
  }

  /**
   * Toggle le menu latéral
   * @param {boolean} [open] - État souhaité (toggle si non spécifié)
   */
  toggleMenu(open) {
    this.menuOpen = open !== undefined ? open : !this.menuOpen;
    this.el.viewer.classList.toggle('menu-open', this.menuOpen);
    this.el.sidebar.setAttribute('aria-hidden', !this.menuOpen);
  }

  /**
   * Ferme le viewer
   */
  close() {
    // Nettoyer les écouteurs
    document.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('hashchange', this.handleHashChange);

    // Vider le container
    this.container.innerHTML = '';

    // Retirer le hash
    history.pushState(null, '', window.location.pathname);

    // Callback
    this.options.onClose();
  }

  /**
   * Affiche une erreur
   * @param {string} message - Message d'erreur
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="parcours-viewer pv-error">
        <div class="pv-error-content">
          <p>❌ ${this.escapeHtml(message)}</p>
          <button class="pv-btn" onclick="window.location.hash = ''">Retour</button>
        </div>
      </div>
    `;
  }

  /**
   * Charge la progression depuis localStorage
   */
  loadProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const all = JSON.parse(data);
        this.progress = all[this.epic.id] || { visited: [], current: null };
      }
    } catch {
      this.progress = { visited: [], current: null };
    }
  }

  /**
   * Sauvegarde la progression dans localStorage
   */
  saveProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const all = data ? JSON.parse(data) : {};
      all[this.epic.id] = this.progress;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Erreur sauvegarde progression:', e);
    }
  }

  /**
   * Échappe le HTML
   * @param {string} str - Chaîne à échapper
   * @returns {string} Chaîne échappée
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Initialise le viewer de parcours depuis un hash URL
 * @param {HTMLElement} container - Conteneur du viewer
 * @param {Object} options - Options de configuration
 * @returns {ParcoursViewer|null} Instance du viewer ou null si pas de parcours dans l'URL
 */
export function initParcoursFromHash(container, options = {}) {
  const hash = window.location.hash;
  const match = hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);

  if (!match) {return null;}

  const [, epicId, slideId] = match;
  const viewer = new ParcoursViewer(container, options);
  viewer.load(epicId, slideId);
  return viewer;
}
