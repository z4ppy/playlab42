/**
 * Playlab42 - Viewer de Parcours (Version Refactorisée)
 * Affiche et navigue dans les slides d'un Epic
 * @see openspec/changes/add-parcours-system/specs/parcours/spec.md
 */

import { ParcoursProgress } from './parcours/ParcoursProgress.js';
import { ParcoursNavigation } from './parcours/ParcoursNavigation.js';
import { ParcoursUI } from './parcours/ParcoursUI.js';

/**
 * Classe principale du viewer de parcours
 * Orchestre les composants : Progress, Navigation, UI
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
    this.slides = [];

    // Composants (initialisés dans load())
    this._progress = null;
    this.navigation = null;
    this.ui = null;

    // État interne pour compatibilité tests
    this._menuOpen = false;

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

      // Initialiser les composants
      this._progress = new ParcoursProgress(epicId);
      this._progress.load();

      this.navigation = new ParcoursNavigation(
        this.epic,
        this.slides,
        this._progress,
        (slide, index) => this.onSlideChange(slide, index),
      );

      this.ui = new ParcoursUI(
        this.container,
        this.epic,
        this.slides,
        this._progress,
        this.navigation,
      );

      // Déterminer la slide à afficher
      let startIndex = 0;
      if (slideId) {
        const index = this.slides.findIndex(s => s.id === slideId);
        startIndex = index >= 0 ? index : 0;
      } else {
        const currentSlide = this._progress.getCurrentSlide();
        if (currentSlide) {
          const index = this.slides.findIndex(s => s.id === currentSlide);
          startIndex = index >= 0 ? index : 0;
        }
      }
      this.navigation.setCurrentIndex(startIndex);

      // Rendre le viewer
      this.ui.render();
      this.setupEventListeners();
      this.navigation.showSlide(startIndex);

    } catch (e) {
      console.error('Erreur chargement parcours:', e);
      if (this.ui) {
        this.ui.showError(e.message);
      } else {
        // UI pas encore initialisée, créer une instance minimale pour afficher l'erreur
        this.ui = { container: this.container, showError: (msg) => {
          this.container.innerHTML = `<div class="pv-error"><p>${msg}</p></div>`;
        } };
        this.ui.showError(e.message);
      }
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
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Boutons header
    this.ui.el.btnClose.addEventListener('click', () => this.close());
    this.ui.el.btnMenu.addEventListener('click', () => this.ui.toggleMenu());
    this.ui.el.btnCloseMenu.addEventListener('click', () => this.ui.toggleMenu(false));

    // Navigation
    this.ui.el.btnPrev.addEventListener('click', () => this.prev());
    this.ui.el.btnNext.addEventListener('click', () => this.next());

    // Menu - click sur slide
    this.ui.el.menu.addEventListener('click', (e) => {
      const slideItem = e.target.closest('.pv-menu-slide');
      if (slideItem) {
        const slideId = slideItem.dataset.slideId;
        const index = this.slides.findIndex(s => s.id === slideId);
        if (index >= 0) {
          this.goTo(index);
          this.ui.toggleMenu(false);
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
    this.ui.el.slideFrame.addEventListener('load', () => {
      this.ui.el.loading.classList.add('hidden');
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
   * Callback appelé quand on change de slide
   * @param {Object} slide
   * @param {number} index
   */
  onSlideChange(slide, index) {
    this.ui.updateUI();
    this.options.onSlideChange(slide, index);
  }

  /**
   * Navigation - slide précédente
   */
  prev() {
    const currentIdx = this.currentIndex;
    if (currentIdx > 0) {
      this.showSlide(currentIdx - 1);
    }
  }

  /**
   * Navigation - slide suivante
   */
  next() {
    const currentIdx = this.currentIndex;
    if (currentIdx < this.slides.length - 1) {
      this.showSlide(currentIdx + 1);
    }
  }

  /**
   * Navigation - aller à une slide
   * @param {number} index
   */
  goTo(index) {
    if (index >= 0 && index < this.slides.length) {
      this.showSlide(index);
    }
  }

  /**
   * Affiche une slide par index (implémentation standalone pour tests)
   * @param {number} index
   */
  showSlide(index) {
    if (this.navigation) {
      this.navigation.showSlide(index);
      return;
    }

    // Implémentation standalone pour tests
    if (index < 0 || index >= this.slides.length) {return;}

    const slide = this.slides[index];
    this._currentIndexOverride = index;

    // Mettre à jour l'URL
    if (this.epic && typeof history !== 'undefined') {
      const newHash = `#/parcours/${this.epic.id}/${slide.id}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    }

    // Marquer comme visitée
    if (this._progress && typeof this._progress.markVisited === 'function') {
      this._progress.markVisited(slide.id);
    } else if (this._progress && this._progress.visited) {
      if (!this._progress.visited.includes(slide.id)) {
        this._progress.visited.push(slide.id);
      }
      this._progress.current = slide.id;
    }

    // Pré-charger les slides adjacentes
    this.preloadAdjacent();

    // Mettre à jour l'UI
    this.updateUI();

    // Afficher le loading (si élément existe)
    if (this.el && this.el.loading) {
      this.el.loading.classList.remove('hidden');
    }

    // Charger dans l'iframe (si élément existe)
    if (this.el && this.el.slideFrame && this.epic) {
      const slidePath = `${this.epic.path}/slides/${slide.id}/index.html`;
      this.el.slideFrame.src = slidePath;
    }

    // Callback
    this.options.onSlideChange(slide, index);
  }

  /**
   * Rafraîchit le menu (implémentation standalone pour tests)
   */
  renderMenu() {
    if (this.ui && this.ui.renderMenu) {
      this.ui.renderMenu();
      return;
    }

    // Implémentation standalone pour tests
    if (this.el && this.el.menu && this.epic) {
      this.el.menu.innerHTML = this.buildMenuHTML(this.epic.structure);
    }
  }

  /**
   * Met à jour l'UI (proxy pour ui)
   */
  updateUI() {
    if (this.ui) {
      this.ui.updateUI();
    }
  }

  /**
   * Construit le breadcrumb (proxy pour ui)
   * @param {Object} slide
   * @returns {string}
   */
  renderBreadcrumb(slide) {
    return this.ui ? this.ui.buildBreadcrumb(slide) : '';
  }

  /**
   * Construit le breadcrumb (implémentation standalone pour tests)
   * @param {Object} slide
   * @returns {string}
   */
  buildBreadcrumb(slide) {
    // Si UI existe, utiliser sa méthode
    if (this.ui && this.ui.buildBreadcrumb) {
      return this.ui.buildBreadcrumb(slide);
    }

    // Sinon, implémentation standalone
    if (!this.epic || !slide) {return '';}

    const escapeHtml = (str) => {
      if (typeof str !== 'string') {return '';}
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const parts = [
      `<span class="pv-breadcrumb-item">${escapeHtml(this.epic.title)}</span>`,
    ];

    if (slide.path) {
      for (const section of slide.path) {
        parts.push('<span class="pv-breadcrumb-sep">›</span>');
        parts.push(`<span class="pv-breadcrumb-item">${escapeHtml(section.title)}</span>`);
      }
    }

    parts.push('<span class="pv-breadcrumb-sep">›</span>');
    parts.push(`<span class="pv-breadcrumb-item current">${escapeHtml(slide.title)}</span>`);

    return parts.join('');
  }

  /**
   * Construit le HTML du menu (implémentation standalone pour tests)
   * @param {Array} structure
   * @returns {string}
   */
  buildMenuHTML(structure) {
    // Si UI existe, utiliser sa méthode
    if (this.ui && this.ui.buildMenuHTML) {
      return this.ui.buildMenuHTML(structure);
    }

    // Sinon, implémentation standalone
    if (!structure) {return '';}

    const escapeHtml = (str) => {
      if (typeof str !== 'string') {return '';}
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    let html = '<ul role="group">';

    for (const item of structure) {
      if (item.type === 'section') {
        const iconSection = item.icon || '📁';
        html += `
          <li role="treeitem" aria-expanded="true" class="pv-menu-section">
            <button class="pv-menu-toggle" aria-label="Déplier/Replier">
              <span class="pv-menu-icon">${iconSection}</span>
              <span class="pv-menu-label">${escapeHtml(item.title)}</span>
            </button>
            ${this.buildMenuHTML(item.children)}
          </li>
        `;
      } else if (item.type === 'slide') {
        // Compatibilité avec progress comme objet ou comme instance ParcoursProgress
        let isVisited = false;
        if (this._progress) {
          if (typeof this._progress.isVisited === 'function') {
            isVisited = this._progress.isVisited(item.id);
          } else if (this._progress.visited && Array.isArray(this._progress.visited)) {
            isVisited = this._progress.visited.includes(item.id);
          }
        }
        const currentSlideId = this.slides[this.currentIndex]?.id;
        const isCurrent = currentSlideId === item.id;
        const stateClass = isCurrent ? 'current' : (isVisited ? 'visited' : '');
        const stateIcon = isCurrent ? '●' : (isVisited ? '✓' : '○');
        const iconSlide = item.icon || '📄';
        const optionalClass = item.optional ? 'optional' : '';
        const optionalTag = item.optional ? '<span class="pv-menu-optional">(optionnel)</span>' : '';

        html += `
          <li role="treeitem" class="pv-menu-slide ${stateClass} ${optionalClass}" data-slide-id="${item.id}">
            <button class="pv-menu-item">
              <span class="pv-menu-state">${stateIcon}</span>
              <span class="pv-menu-icon">${iconSlide}</span>
              <span class="pv-menu-label">${escapeHtml(item.title)}</span>
              ${optionalTag}
            </button>
          </li>
        `;
      }
    }

    html += '</ul>';
    return html;
  }

  /**
   * Toggle le menu (implémentation standalone pour tests)
   * @param {boolean} [force] - Force l'état (optionnel)
   */
  toggleMenu(force) {
    if (this.ui && this.ui.toggleMenu) {
      this.ui.toggleMenu(force);
      // Synchroniser l'état interne
      this._menuOpen = this.ui.menuOpen || false;
    } else {
      // Implémentation standalone pour tests
      if (force !== undefined) {
        this._menuOpen = force;
      } else {
        this._menuOpen = !this._menuOpen;
      }

      // Mettre à jour le DOM si el.sidebar existe
      if (this.el && this.el.sidebar) {
        if (this._menuOpen) {
          this.el.sidebar.classList.add('open');
          this.el.sidebar.setAttribute('aria-hidden', 'false');
        } else {
          this.el.sidebar.classList.remove('open');
          this.el.sidebar.setAttribute('aria-hidden', 'true');
        }
      }
    }
  }

  /**
   * Charge la progression (implémentation standalone pour tests)
   */
  loadProgress() {
    if (this._progress && typeof this._progress.load === 'function') {
      // Instance de ParcoursProgress
      this._progress.load();
      return;
    }

    // Implémentation standalone pour tests
    try {
      const STORAGE_KEY = 'parcours-progress';
      const data = globalThis.localStorage.getItem(STORAGE_KEY);
      if (data) {
        const all = JSON.parse(data);
        if (this.epic && all[this.epic.id]) {
          this._progress = all[this.epic.id];
        } else {
          this._progress = { visited: [], current: null };
        }
      } else {
        this._progress = { visited: [], current: null };
      }
    } catch {
      this._progress = { visited: [], current: null };
    }
  }

  /**
   * Sauvegarde la progression (implémentation standalone pour tests)
   */
  saveProgress() {
    if (this._progress && typeof this._progress.save === 'function') {
      // Instance de ParcoursProgress
      this._progress.save();
      return;
    }

    // Implémentation standalone pour tests
    try {
      const STORAGE_KEY = 'parcours-progress';
      const data = globalThis.localStorage.getItem(STORAGE_KEY);
      const all = data ? JSON.parse(data) : {};
      if (this.epic) {
        all[this.epic.id] = this._progress;
      }
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Erreur sauvegarde progression:', e);
    }
  }

  /**
   * Accès à la progression (getter pour compatibilité tests)
   * @returns {Object}
   */
  get progress() {
    return this._progress;
  }

  /**
   * Définir la progression (setter pour compatibilité tests)
   * @param {Object} value
   */
  set progress(value) {
    this._progress = value;
  }

  /**
   * Render le viewer (proxy pour ui)
   */
  render() {
    if (this.ui) {
      this.ui.render();
    }
  }

  /**
   * Setup event listeners (appelé par load)
   */
  setupEventListeners() {
    if (this.ui) {
      this.ui.setupEventListeners();
    }

    // Listeners du viewer
    document.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('hashchange', this.handleHashChange);
  }

  /**
   * Affiche une erreur (proxy pour ui)
   * @param {string} message
   */
  showError(message) {
    if (this.ui) {
      this.ui.showError(message);
    } else {
      this.container.innerHTML = `<p>❌ ${message}</p>`;
    }
  }

  /**
   * Pré-charge les slides adjacentes (proxy pour navigation)
   */
  preloadAdjacent() {
    if (this.navigation) {
      this.navigation.preloadAdjacent();
    }
  }

  /**
   * Pré-charge une slide (proxy pour navigation)
   * @param {number} index
   */
  preloadSlide(index) {
    if (this.navigation) {
      this.navigation.preloadSlide(index);
    }
  }

  /**
   * Accès aux éléments DOM (getter pour compatibilité tests)
   * @returns {Object}
   */
  get el() {
    if (this._el) {
      return this._el;
    }
    return this.ui ? this.ui.el : {};
  }

  /**
   * Définir les éléments DOM (setter pour compatibilité tests)
   * @param {Object} value
   */
  set el(value) {
    this._el = value;
  }

  /**
   * Ferme le viewer
   */
  close() {
    // Nettoyer les écouteurs
    document.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('hashchange', this.handleHashChange);

    // Vider le container
    if (this.ui) {
      this.ui.cleanup();
    }

    // Retirer le hash
    history.pushState(null, '', window.location.pathname);

    // Callback
    this.options.onClose();
  }

  /**
   * Getter pour currentIndex (compatibilité tests)
   * @returns {number}
   */
  get currentIndex() {
    if (this._currentIndexOverride !== undefined) {
      return this._currentIndexOverride;
    }
    return this.navigation ? this.navigation.getCurrentIndex() : 0;
  }

  /**
   * Setter pour currentIndex (compatibilité tests)
   * @param {number} value
   */
  set currentIndex(value) {
    this._currentIndexOverride = value;
  }

  /**
   * Getter pour menuOpen (compatibilité tests)
   * @returns {boolean}
   */
  get menuOpen() {
    return this._menuOpen;
  }

  /**
   * Setter pour menuOpen (compatibilité tests)
   * @param {boolean} value
   */
  set menuOpen(value) {
    this._menuOpen = value;
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
