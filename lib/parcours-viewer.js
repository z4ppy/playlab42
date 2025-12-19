/**
 * Playlab42 - Viewer de Parcours (Version Simplifiée)
 * Orchestre les composants : Progress, Navigation, UI
 * @see openspec/changes/add-parcours-system/specs/parcours/spec.md
 */

import { ParcoursProgress } from './parcours/ParcoursProgress.js';
import { ParcoursNavigation } from './parcours/ParcoursNavigation.js';
import { ParcoursUI } from './parcours/ParcoursUI.js';
import { flattenStructure as flattenStructureUtil } from './parcours/utils.js';
import { replaceRoute, navigate } from './router.js';
import { escapeHtml } from './dom.js';

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

    // État interne
    this._menuOpen = false;
    this._el = null;
    this._currentIndexOverride = undefined;

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
      if (!response.ok) { throw new Error('Catalogue parcours introuvable'); }
      const catalogue = await response.json();

      // Trouver l'epic
      this.epic = catalogue.epics.find(e => e.id === epicId);
      if (!this.epic) { throw new Error(`Epic non trouvé: ${epicId}`); }

      // Extraire la liste plate des slides
      this.slides = this.flattenStructure(this.epic.structure);

      // Initialiser les composants (sauf si déjà injectés par les tests)
      if (!this._progress) {
        this._progress = new ParcoursProgress(epicId);
      }
      this.loadProgress();

      if (!this.navigation) {
        this.navigation = new ParcoursNavigation(
          this.epic,
          this.slides,
          this._progress,
          (slide, index) => this.onSlideChange(slide, index),
        );
      }

      if (!this.ui) {
        this.ui = new ParcoursUI(
          this.container,
          this.epic,
          this.slides,
          this._progress,
          this.navigation,
        );
      }

      // Déterminer la slide à afficher
      let startIndex = 0;
      if (slideId) {
        const index = this.slides.findIndex(s => s.id === slideId);
        startIndex = index >= 0 ? index : 0;
      } else {
        const currentSlide = this._progress?.getCurrentSlide?.() || this._progress?.current;
        if (currentSlide) {
          const index = this.slides.findIndex(s => s.id === currentSlide);
          startIndex = index >= 0 ? index : 0;
        }
      }
      this.navigation?.setCurrentIndex?.(startIndex);

      // Rendre le viewer
      this.render();
      this.setupEventListeners();
      this.showSlide(startIndex);

    } catch (e) {
      console.error('Erreur chargement parcours:', e);
      this.showError(e.message);
    }
  }

  /**
   * Aplatit la structure hiérarchique en liste de slides
   * @param {Array} structure - Structure hiérarchique
   * @param {Array} [parentPath] - Chemin parent pour le breadcrumb
   * @returns {Array} Liste plate des slides avec métadonnées
   */
  flattenStructure(structure, parentPath = []) {
    return flattenStructureUtil(structure, parentPath);
  }

  // ===========================================================================
  // Gestion des événements
  // ===========================================================================

  /**
   * Gère les événements clavier
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }

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

    if (epicId !== this.epic?.id) {
      this.load(epicId, slideId);
      return;
    }

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
    this.ui?.updateUI?.();
    this.options.onSlideChange(slide, index);
  }

  // ===========================================================================
  // Navigation (délégation vers ParcoursNavigation)
  // ===========================================================================

  prev() {
    if (this.navigation) {
      this.navigation.prev();
    } else if (this.currentIndex > 0) {
      this.showSlide(this.currentIndex - 1);
    }
  }

  next() {
    if (this.navigation) {
      this.navigation.next();
    } else if (this.currentIndex < this.slides.length - 1) {
      this.showSlide(this.currentIndex + 1);
    }
  }

  goTo(index) {
    if (this.navigation) {
      this.navigation.goTo(index);
    } else if (index >= 0 && index < this.slides.length) {
      this.showSlide(index);
    }
  }

  showSlide(index) {
    if (this.navigation?.showSlide) {
      this.navigation.showSlide(index);
      return;
    }

    // Fallback minimaliste pour les tests sans navigation
    if (index < 0 || index >= this.slides.length) { return; }
    const slide = this.slides[index];
    this._currentIndexOverride = index;

    if (this.epic) {
      replaceRoute(`/parcours/${this.epic.id}/${slide.id}`);
    }

    // Marquer comme visitée
    if (this._progress?.markVisited) {
      this._progress.markVisited(slide.id);
    } else if (this._progress?.visited && !this._progress.visited.includes(slide.id)) {
      this._progress.visited.push(slide.id);
      this._progress.current = slide.id;
    }

    this.preloadAdjacent();
    this.updateUI();

    if (this.el?.loading) {
      this.el.loading.classList.remove('hidden');
    }
    if (this.el?.slideFrame && this.epic) {
      this.el.slideFrame.src = `${this.epic.path}/slides/${slide.id}/index.html`;
    }

    this.options.onSlideChange(slide, index);
  }

  preloadAdjacent() {
    if (this.navigation?.preloadAdjacent) {
      this.navigation.preloadAdjacent();
      return;
    }

    // Fallback pour tests
    const PRELOAD_ADJACENT = 1;
    for (let i = 1; i <= PRELOAD_ADJACENT; i++) {
      if (this.currentIndex + i < this.slides.length) {
        this.preloadSlide(this.slides[this.currentIndex + i].id);
      }
      if (this.currentIndex - i >= 0) {
        this.preloadSlide(this.slides[this.currentIndex - i].id);
      }
    }
  }

  preloadSlide(slideId) {
    if (this.navigation?.preloadSlide) {
      this.navigation.preloadSlide(slideId);
      return;
    }

    // Fallback pour tests
    if (typeof document === 'undefined' || !this.epic) { return; }
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `${this.epic.path}/slides/${slideId}/index.html`;
    document.head.appendChild(link);
  }

  // ===========================================================================
  // UI (délégation vers ParcoursUI)
  // ===========================================================================

  render() {
    if (this.ui?.render) {
      this.ui.render();
      return;
    }

    // Fallback minimaliste pour tests
    if (!this.container) { return; }
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
            <div class="pv-loading"><div class="pv-spinner"></div><p>Chargement...</p></div>
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

    this._el = {
      viewer: this.container.querySelector('.parcours-viewer'),
      btnClose: this.container.querySelector('.pv-btn-close'),
      breadcrumb: this.container.querySelector('.pv-breadcrumb'),
      btnMenu: this.container.querySelector('.pv-btn-menu'),
      sidebar: this.container.querySelector('.pv-sidebar'),
      epicTitle: this.container.querySelector('.pv-epic-title'),
      btnCloseMenu: this.container.querySelector('.pv-btn-close-menu'),
      menu: this.container.querySelector('.pv-menu'),
      slideFrame: this.container.querySelector('.pv-slide-frame'),
      loading: this.container.querySelector('.pv-loading'),
      btnPrev: this.container.querySelector('.pv-btn-prev'),
      btnNext: this.container.querySelector('.pv-btn-next'),
      progressText: this.container.querySelector('.pv-progress-text'),
      progressFill: this.container.querySelector('.pv-progress-fill'),
    };

    if (this.epic && this._el.epicTitle) {
      this._el.epicTitle.textContent = this.epic.title;
    }
  }

  renderMenu() {
    if (this.ui?.renderMenu) {
      this.ui.renderMenu();
    } else if (this.el?.menu && this.epic) {
      this.el.menu.innerHTML = this.buildMenuHTML(this.epic.structure);
    }
  }

  updateUI() {
    if (this.ui?.updateUI) {
      this.ui.updateUI();
      return;
    }

    // Fallback minimaliste pour tests
    if (!this.el || !this.slides.length) { return; }
    const idx = this.currentIndex;
    const slide = this.slides[idx];
    if (!slide) { return; }

    if (this.el.breadcrumb) {
      this.el.breadcrumb.innerHTML = this.buildBreadcrumb(slide);
    }
    if (this.el.btnPrev) { this.el.btnPrev.disabled = idx === 0; }
    if (this.el.btnNext) { this.el.btnNext.disabled = idx === this.slides.length - 1; }

    const pct = Math.round(((idx + 1) / this.slides.length) * 100);
    if (this.el.progressText) { this.el.progressText.textContent = `${idx + 1} / ${this.slides.length}`; }
    if (this.el.progressFill) {
      this.el.progressFill.style.width = `${pct}%`;
      this.el.progressFill.parentElement?.setAttribute('aria-valuenow', pct);
    }

    // Mise à jour des états du menu
    this.el.menu?.querySelectorAll?.('.pv-menu-slide')?.forEach(item => {
      const slideId = item.dataset.slideId;
      const isVisited = this._progress?.isVisited?.(slideId) ||
                        this._progress?.visited?.includes?.(slideId) || false;
      const isCurrent = slideId === slide.id;

      item.classList.toggle('visited', isVisited && !isCurrent);
      item.classList.toggle('current', isCurrent);
      if (isCurrent) { item.setAttribute('aria-current', 'page'); }
      else { item.removeAttribute('aria-current'); }

      const stateEl = item.querySelector('.pv-menu-state');
      if (stateEl) { stateEl.textContent = isCurrent ? '●' : (isVisited ? '✓' : '○'); }
    });
  }

  buildBreadcrumb(slide) {
    if (this.ui?.buildBreadcrumb) {
      return this.ui.buildBreadcrumb(slide);
    }

    // Fallback pour tests
    if (!this.epic || !slide) { return ''; }
    const parts = [`<span class="pv-breadcrumb-item">${escapeHtml(this.epic.title)}</span>`];
    for (const sec of (slide.path || [])) {
      parts.push('<span class="pv-breadcrumb-sep">›</span>');
      parts.push(`<span class="pv-breadcrumb-item">${escapeHtml(sec.title)}</span>`);
    }
    parts.push('<span class="pv-breadcrumb-sep">›</span>');
    parts.push(`<span class="pv-breadcrumb-item current">${escapeHtml(slide.title)}</span>`);
    return parts.join('');
  }

  buildMenuHTML(structure) {
    if (this.ui?.buildMenuHTML) {
      return this.ui.buildMenuHTML(structure);
    }

    // Fallback pour tests
    if (!structure) { return ''; }
    let html = '<ul role="group">';
    for (const item of structure) {
      if (item.type === 'section') {
        html += `<li role="treeitem" aria-expanded="true" class="pv-menu-section">
          <button class="pv-menu-toggle"><span class="pv-menu-icon">${item.icon || '📁'}</span>
          <span class="pv-menu-label">${escapeHtml(item.title)}</span></button>
          ${this.buildMenuHTML(item.children)}</li>`;
      } else if (item.type === 'slide') {
        const isVisited = this._progress?.isVisited?.(item.id) ||
                          this._progress?.visited?.includes?.(item.id) || false;
        const isCurrent = this.slides[this.currentIndex]?.id === item.id;
        const state = isCurrent ? 'current' : (isVisited ? 'visited' : '');
        const icon = isCurrent ? '●' : (isVisited ? '✓' : '○');
        const opt = item.optional ? 'optional' : '';
        const optTag = item.optional ? '<span class="pv-menu-optional">(optionnel)</span>' : '';
        html += `<li role="treeitem" class="pv-menu-slide ${state} ${opt}" data-slide-id="${item.id}">
          <button class="pv-menu-item"><span class="pv-menu-state">${icon}</span>
          <span class="pv-menu-icon">${item.icon || '📄'}</span>
          <span class="pv-menu-label">${escapeHtml(item.title)}</span>${optTag}</button></li>`;
      }
    }
    return `${html}</ul>`;
  }

  toggleMenu(force) {
    if (this.ui?.toggleMenu) {
      this.ui.toggleMenu(force);
      this._menuOpen = this.ui.menuOpen || false;
    } else {
      this._menuOpen = force !== undefined ? force : !this._menuOpen;
      if (this.el) {
        this.el.viewer?.classList.toggle('menu-open', this._menuOpen);
        this.el.sidebar?.classList.toggle('open', this._menuOpen);
        this.el.sidebar?.setAttribute('aria-hidden', String(!this._menuOpen));
      }
    }
  }

  showError(message) {
    if (this.ui?.showError) {
      this.ui.showError(message);
      return;
    }

    // Fallback pour tests
    this.container.innerHTML = `
      <div class="parcours-viewer pv-error">
        <div class="pv-error-content">
          <p>❌ ${escapeHtml(message)}</p>
          <button class="pv-btn pv-btn-error-back">Retour</button>
        </div>
      </div>
    `;
    const btn = this.container.querySelector('.pv-btn-error-back');
    btn?.addEventListener('click', () => { window.location.hash = ''; });
  }

  setupEventListeners() {
    // Listeners globaux du viewer
    document.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('hashchange', this.handleHashChange);

    // Récupérer les éléments DOM (soit depuis ui, soit depuis _el)
    const el = this.ui?.el || this._el;
    if (!el) { return; }

    // Boutons principaux
    el.btnClose?.addEventListener('click', () => this.close());
    el.btnMenu?.addEventListener('click', () => this.toggleMenu());
    el.btnCloseMenu?.addEventListener('click', () => this.toggleMenu(false));
    el.btnPrev?.addEventListener('click', () => this.prev());
    el.btnNext?.addEventListener('click', () => this.next());

    // Iframe - cacher le loading quand chargée
    el.slideFrame?.addEventListener('load', () => {
      el.loading?.classList.add('hidden');
    });

    // Menu - navigation vers les slides et toggle sections
    el.menu?.addEventListener('click', (e) => {
      const slideItem = e.target.closest('.pv-menu-slide');
      if (slideItem) {
        const idx = this.slides.findIndex(s => s.id === slideItem.dataset.slideId);
        if (idx >= 0) { this.goTo(idx); this.toggleMenu(false); }
        return;
      }
      const toggle = e.target.closest('.pv-menu-toggle');
      if (toggle) {
        const section = toggle.closest('.pv-menu-section');
        if (section) {
          const exp = section.getAttribute('aria-expanded') === 'true';
          section.setAttribute('aria-expanded', !exp);
          section.classList.toggle('collapsed');
        }
      }
    });
  }

  // ===========================================================================
  // Progression (délégation vers ParcoursProgress)
  // ===========================================================================

  loadProgress() {
    if (this._progress?.load) {
      this._progress.load();
      return;
    }

    // Fallback pour tests avec plain object
    try {
      const STORAGE_KEY = 'parcours-progress';
      const data = globalThis.localStorage.getItem(STORAGE_KEY);
      if (data) {
        const all = JSON.parse(data);
        this._progress = this.epic && all[this.epic.id]
          ? all[this.epic.id]
          : { visited: [], current: null };
      } else {
        this._progress = { visited: [], current: null };
      }
    } catch {
      this._progress = { visited: [], current: null };
    }
  }

  saveProgress() {
    if (this._progress?.save) {
      this._progress.save();
      return;
    }

    // Fallback pour tests avec plain object
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

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  close() {
    document.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('hashchange', this.handleHashChange);

    if (this.ui?.cleanup) {
      this.ui.cleanup();
    } else if (this.container) {
      this.container.innerHTML = '';
    }

    navigate('/');
    this.options.onClose();
  }

  // ===========================================================================
  // Getters / Setters (compatibilité)
  // ===========================================================================

  get progress() { return this._progress; }
  set progress(v) { this._progress = v; }

  get el() { return this._el || this.ui?.el || {}; }
  set el(v) { this._el = v; }

  get currentIndex() {
    if (this._currentIndexOverride !== undefined) { return this._currentIndexOverride; }
    return this.navigation?.getCurrentIndex?.() || 0;
  }
  set currentIndex(v) { this._currentIndexOverride = v; }

  get menuOpen() { return this._menuOpen; }
  set menuOpen(v) { this._menuOpen = v; }
}

/**
 * Initialise le viewer de parcours depuis un hash URL
 * @param {HTMLElement} container - Conteneur du viewer
 * @param {Object} options - Options de configuration
 * @returns {ParcoursViewer|null} Instance du viewer ou null si pas de parcours
 */
export function initParcoursFromHash(container, options = {}) {
  const hash = window.location.hash;
  const match = hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);

  if (!match) { return null; }

  const [, epicId, slideId] = match;
  const viewer = new ParcoursViewer(container, options);
  viewer.load(epicId, slideId);
  return viewer;
}
