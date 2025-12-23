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
    this._currentTocSlideId = null; // ID de la slide ayant une TOC injectée
    this._onTocAnchorClick = null; // Callback pour clic sur ancre TOC

    // État du resize
    this._isResizing = false;
    this._resizeStartX = 0;
    this._resizeStartWidth = 0;
    this._boundHandleResizeMove = this._handleResizeMove.bind(this);
    this._boundHandleResizeEnd = this._handleResizeEnd.bind(this);
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
          <div class="pv-resize-handle" aria-hidden="true"></div>
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
      resizeHandle: this.container.querySelector('.pv-resize-handle'),
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

    // Initialiser le resize de la sidebar (desktop uniquement)
    this._initResize();
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

  // ===========================================================================
  // Gestion de la TOC intra-slide
  // ===========================================================================

  /**
   * Définit le callback pour les clics sur les ancres TOC
   * @param {Function} handler - (anchorId) => void
   */
  setTocAnchorClickHandler(handler) {
    this._onTocAnchorClick = handler;
  }

  /**
   * Injecte la TOC d'une slide dans le menu latéral
   * @param {string} slideId - ID de la slide
   * @param {Array} items - Items de la TOC [{id, label, icon?, level?}]
   */
  injectSlideToc(slideId, items) {
    if (!slideId || !items || items.length === 0) {
      return;
    }

    // Effacer l'ancienne TOC si différente slide
    if (this._currentTocSlideId && this._currentTocSlideId !== slideId) {
      this.clearSlideToc(this._currentTocSlideId);
    }

    // Trouver l'élément de la slide dans le menu
    const slideItem = this.el.menu?.querySelector(`[data-slide-id="${slideId}"]`);
    if (!slideItem) {
      return;
    }

    // Marquer la slide comme ayant une TOC (expandable)
    slideItem.classList.add('has-toc', 'toc-expanded');
    slideItem.setAttribute('aria-expanded', 'true');

    // Vérifier si la TOC existe déjà
    let tocList = slideItem.querySelector('.pv-toc-list');
    if (tocList) {
      tocList.remove();
    }

    // Créer la liste TOC
    tocList = document.createElement('ul');
    tocList.className = 'pv-toc-list';
    tocList.setAttribute('role', 'group');

    for (const item of items) {
      const li = document.createElement('li');
      li.className = `pv-toc-item level-${item.level || 1}`;
      li.setAttribute('role', 'treeitem');
      li.dataset.anchorId = item.id;

      const btn = document.createElement('button');
      btn.className = 'pv-toc-anchor';
      btn.innerHTML = `
        <span class="pv-toc-state">○</span>
        ${item.icon ? `<span class="pv-toc-icon">${escapeHtml(item.icon)}</span>` : ''}
        <span class="pv-toc-label">${escapeHtml(item.label)}</span>
      `;

      // Gestionnaire de clic
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._onTocAnchorClick) {
          this._onTocAnchorClick(item.id);
        }
      });

      li.appendChild(btn);
      tocList.appendChild(li);
    }

    // Insérer après le bouton de la slide
    slideItem.appendChild(tocList);
    this._currentTocSlideId = slideId;
  }

  /**
   * Efface la TOC d'une slide
   * @param {string} slideId - ID de la slide
   */
  clearSlideToc(slideId) {
    if (!slideId) {
      return;
    }

    const slideItem = this.el.menu?.querySelector(`[data-slide-id="${slideId}"]`);
    if (slideItem) {
      slideItem.classList.remove('has-toc', 'toc-expanded');
      slideItem.removeAttribute('aria-expanded');

      const tocList = slideItem.querySelector('.pv-toc-list');
      if (tocList) {
        tocList.remove();
      }
    }

    if (this._currentTocSlideId === slideId) {
      this._currentTocSlideId = null;
    }
  }

  /**
   * Met à jour l'ancre active dans la TOC
   * @param {string} anchorId - ID de l'ancre active
   */
  setActiveTocAnchor(anchorId) {
    if (!this._currentTocSlideId) {
      return;
    }

    const slideItem = this.el.menu?.querySelector(`[data-slide-id="${this._currentTocSlideId}"]`);
    if (!slideItem) {
      return;
    }

    // Retirer l'état actif de tous les items
    slideItem.querySelectorAll('.pv-toc-item').forEach(item => {
      item.classList.remove('active');
      const state = item.querySelector('.pv-toc-state');
      if (state) {
        state.textContent = '○';
      }
    });

    // Marquer l'ancre active
    if (anchorId) {
      const activeItem = slideItem.querySelector(`[data-anchor-id="${anchorId}"]`);
      if (activeItem) {
        activeItem.classList.add('active');
        const state = activeItem.querySelector('.pv-toc-state');
        if (state) {
          state.textContent = '●';
        }
      }
    }
  }

  // ===========================================================================
  // Resize de la sidebar (Desktop)
  // ===========================================================================

  /**
   * Clé localStorage pour la largeur du menu
   */
  static MENU_WIDTH_KEY = 'parcours-menu-width';
  static MIN_WIDTH = 200;
  static MAX_WIDTH = 400;

  /**
   * Initialise le redimensionnement de la sidebar
   */
  _initResize() {
    if (!this.el.resizeHandle || !this.el.sidebar) {
      return;
    }

    // Restaurer la largeur sauvegardée
    const savedWidth = localStorage.getItem(ParcoursUI.MENU_WIDTH_KEY);
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= ParcoursUI.MIN_WIDTH && width <= ParcoursUI.MAX_WIDTH) {
        this._setSidebarWidth(width);
      }
    }

    // Ajouter les listeners pour le drag
    this.el.resizeHandle.addEventListener('mousedown', (e) => {
      this._handleResizeStart(e);
    });
  }

  /**
   * Démarre le redimensionnement
   * @param {MouseEvent} e
   */
  _handleResizeStart(e) {
    // Ignorer sur mobile
    if (window.innerWidth < 768) {
      return;
    }

    e.preventDefault();
    this._isResizing = true;
    this._resizeStartX = e.clientX;
    this._resizeStartWidth = this.el.sidebar.offsetWidth;

    this.el.resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', this._boundHandleResizeMove);
    document.addEventListener('mouseup', this._boundHandleResizeEnd);
  }

  /**
   * Gère le mouvement pendant le resize
   * @param {MouseEvent} e
   */
  _handleResizeMove(e) {
    if (!this._isResizing) {
      return;
    }

    const deltaX = e.clientX - this._resizeStartX;
    const newWidth = Math.min(
      ParcoursUI.MAX_WIDTH,
      Math.max(ParcoursUI.MIN_WIDTH, this._resizeStartWidth + deltaX),
    );

    this._setSidebarWidth(newWidth);
  }

  /**
   * Termine le redimensionnement
   */
  _handleResizeEnd() {
    if (!this._isResizing) {
      return;
    }

    this._isResizing = false;
    this.el.resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', this._boundHandleResizeMove);
    document.removeEventListener('mouseup', this._boundHandleResizeEnd);

    // Sauvegarder la largeur
    const currentWidth = this.el.sidebar.offsetWidth;
    localStorage.setItem(ParcoursUI.MENU_WIDTH_KEY, currentWidth.toString());
  }

  /**
   * Applique une largeur à la sidebar
   * @param {number} width - Largeur en pixels
   */
  _setSidebarWidth(width) {
    if (!this.el.sidebar || !this.el.viewer) {
      return;
    }

    this.el.sidebar.style.width = `${width}px`;
    this.el.viewer.style.gridTemplateColumns = `${width}px 1fr`;
  }
}
