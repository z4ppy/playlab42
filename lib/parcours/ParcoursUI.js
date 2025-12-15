/**
 * Gestion du rendu HTML du viewer de parcours
 */

import { escapeHtml } from '../dom.js';

export class ParcoursUI {
  /**
   * @param {HTMLElement} container - Conteneur du viewer
   * @param {Object} epic - Epic chargé
   * @param {Array} slides - Liste plate des slides
   * @param {ParcoursProgress} progress - Gestionnaire de progression
   * @param {ParcoursNavigation} navigation - Gestionnaire de navigation
   */
  constructor(container, epic, slides, progress, navigation) {
    this.container = container;
    this.epic = epic;
    this.slides = slides;
    this.progress = progress;
    this.navigation = navigation;
    this.el = {};
    this.menuOpen = false;
  }

  /**
   * Rend l'interface complète
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
   * Génère le menu de navigation
   */
  renderMenu() {
    this.el.menu.innerHTML = this.buildMenuHTML(this.epic.structure);
  }

  /**
   * Construit le HTML du menu récursivement
   * @param {Array} structure - Structure hiérarchique
   * @returns {string}
   */
  buildMenuHTML(structure) {
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
        const isVisited = this.progress.isVisited(item.id);
        const isCurrent = this.slides[this.navigation.getCurrentIndex()]?.id === item.id;
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
   * Met à jour l'interface utilisateur
   */
  updateUI() {
    const slide = this.navigation.getCurrentSlide();
    const currentIndex = this.navigation.getCurrentIndex();

    // Breadcrumb
    this.el.breadcrumb.innerHTML = this.buildBreadcrumb(slide);

    // Boutons navigation
    this.el.btnPrev.disabled = currentIndex === 0;
    this.el.btnNext.disabled = currentIndex === this.slides.length - 1;

    // Progression
    const progressPercent = Math.round(((currentIndex + 1) / this.slides.length) * 100);
    this.el.progressText.textContent = `${currentIndex + 1} / ${this.slides.length}`;
    this.el.progressFill.style.width = `${progressPercent}%`;
    this.el.progressFill.parentElement.setAttribute('aria-valuenow', progressPercent);

    // Menu - mettre à jour les états
    this.el.menu.querySelectorAll('.pv-menu-slide').forEach(item => {
      const slideId = item.dataset.slideId;
      const isVisited = this.progress.isVisited(slideId);
      const isCurrent = slideId === slide.id;

      item.classList.toggle('visited', isVisited && !isCurrent);
      item.classList.toggle('current', isCurrent);

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

    // Afficher la slide dans l'iframe
    this.showSlideContent(slide);
  }

  /**
   * Affiche le contenu d'une slide dans l'iframe
   * @param {Object} slide
   */
  showSlideContent(slide) {
    this.el.loading.classList.remove('hidden');
    const slidePath = `${this.epic.path}/slides/${slide.id}/index.html`;
    this.el.slideFrame.src = slidePath;
  }

  /**
   * Construit le fil d'Ariane
   * @param {Object} slide
   * @returns {string}
   */
  buildBreadcrumb(slide) {
    const parts = [
      `<span class="pv-breadcrumb-item">${escapeHtml(this.epic.title)}</span>`,
    ];

    for (const section of slide.path) {
      parts.push('<span class="pv-breadcrumb-sep">›</span>');
      parts.push(`<span class="pv-breadcrumb-item">${escapeHtml(section.title)}</span>`);
    }

    parts.push('<span class="pv-breadcrumb-sep">›</span>');
    parts.push(`<span class="pv-breadcrumb-item current">${escapeHtml(slide.title)}</span>`);

    return parts.join('');
  }

  /**
   * Toggle le menu latéral
   * @param {boolean} [open]
   */
  toggleMenu(open) {
    this.menuOpen = open !== undefined ? open : !this.menuOpen;
    this.el.viewer.classList.toggle('menu-open', this.menuOpen);
    this.el.sidebar.setAttribute('aria-hidden', !this.menuOpen);
  }

  /**
   * Affiche une erreur
   * @param {string} message
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="parcours-viewer pv-error">
        <div class="pv-error-content">
          <p>❌ ${escapeHtml(message)}</p>
          <button class="pv-btn pv-btn-error-back">Retour</button>
        </div>
      </div>
    `;

    const backButton = this.container.querySelector('.pv-btn-error-back');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.location.hash = '';
      });
    }
  }

  /**
   * Nettoie le viewer
   */
  cleanup() {
    this.container.innerHTML = '';
  }
}
