/**
 * Orchestre le chargement et le cycle de vie des composants réels du lecteur.
 * @see openspec/specs/parcours/spec.md
 */
import { ParcoursProgress } from './parcours/ParcoursProgress.js';
import { ParcoursNavigation } from './parcours/ParcoursNavigation.js';
import { ParcoursUI } from './parcours/ParcoursUI.js';
import { flattenStructure } from './parcours/utils.js';
import { fetchEpic, getStartIndex } from './parcours/loading.js';
import { handleViewerKeydown } from './parcours/keyboard.js';
import { bindViewerEvents } from './parcours/events.js';
import { normalizeToc } from './parcours/slide-messages.js';
import { navigate } from './router.js';

export class ParcoursViewer {
  /**
   * @param {HTMLElement} container
   * @param {Object} options - Callbacks onClose et onSlideChange.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onClose: () => {},
      onSlideChange: () => {},
      ...options,
    };
    this.epic = null;
    this.slides = [];
    this._progress = null;
    this.navigation = null;
    this.ui = new ParcoursUI(container, null, [], null, null);
    this._currentToc = null;
    this._loadVersion = 0;
    this._disposeEvents = null;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
    this.handleSlideMessage = this.handleSlideMessage.bind(this);
  }

  /**
   * Charge un epic et sa cible explicite ou sauvegardée.
   * Une sélection plus récente ou une fermeture invalide le résultat en attente.
   * @param {string} epicId
   * @param {string|null} slideId
   * @returns {Promise<void>}
   */
  async load(epicId, slideId = null) {
    const version = ++this._loadVersion;
    try {
      const epic = await fetchEpic(epicId);
      if (version !== this._loadVersion) { return; }
      const slides = this.flattenStructure(epic.structure);
      if (!slides.length) { throw new Error('Parcours sans slide'); }
      this.initializeComponents(epic, slides);
      const startIndex = getStartIndex(slides, slideId, this._progress);
      this.navigation.setCurrentIndex(startIndex);
      this.render();
      this.setupEventListeners();
      this.showSlide(startIndex);
      this.el.btnClose.focus();
    } catch (error) {
      if (version !== this._loadVersion) { return; }
      console.error('Erreur chargement parcours:', error);
      this.showError(error.message);
    }
  }

  initializeComponents(epic, slides) {
    this.cleanup();
    this.epic = epic;
    this.slides = slides;
    this._currentToc = null;
    this._progress = new ParcoursProgress(epic.id);
    this.loadProgress();
    this.navigation = new ParcoursNavigation(
      epic, slides, this._progress, (slide, index) => this.onSlideChange(slide, index),
    );
    this.ui = new ParcoursUI(this.container, epic, slides, this._progress, this.navigation);
    this.ui.setTocAnchorClickHandler(anchorId => this.scrollToAnchor(anchorId));
  }

  flattenStructure(structure, parentPath = []) {
    return flattenStructure(structure, parentPath);
  }

  handleKeydown(event) {
    handleViewerKeydown(this, event);
  }

  handleHashChange() {
    const match = window.location.hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);
    if (!match) {
      this.close();
      return;
    }
    const [, epicId, slideId] = match;
    if (epicId !== this.epic?.id) {
      this.load(epicId, slideId);
      return;
    }
    ++this._loadVersion;
    if (slideId) {
      const index = this.slides.findIndex(slide => slide.id === slideId);
      if (index >= 0 && index !== this.currentIndex) { this.showSlide(index); }
    }
  }

  /** Seule l'iframe courante peut fournir son sommaire. */
  handleSlideMessage(event) {
    const iframe = this.el.slideFrame;
    if (!iframe || event.source !== iframe.contentWindow) { return; }
    const { type, items } = event.data || {};
    if (type === 'slide:toc') { this.handleSlideToc(items); }
    else if (type === 'slide:toc:clear') { this.clearCurrentToc(); }
  }

  handleSlideToc(items) {
    const validItems = normalizeToc(items);
    if (!validItems) { return; }
    this.clearCurrentToc();
    this._currentToc = validItems;
    this.ui.injectSlideToc(this.navigation.getCurrentSlide().id, validItems);
  }

  clearCurrentToc() {
    this._currentToc = null;
    this.ui.clearSlideToc();
  }

  sendToSlide(type, data = {}) {
    this.el.slideFrame?.contentWindow?.postMessage({ type, ...data }, '*');
  }

  scrollToAnchor(anchorId) {
    this.sendToSlide('viewer:scroll-to', { anchor: anchorId });
    this.ui.setActiveTocAnchor(anchorId);
    if (window.innerWidth < 768 && this.menuOpen) { this.toggleMenu(false); }
  }

  onSlideChange(slide, index) {
    this.clearCurrentToc();
    this.updateUI();
    this.options.onSlideChange(slide, index);
  }

  prev() { this.navigation.prev(); }
  next() { this.navigation.next(); }
  goTo(index) { this.navigation.goTo(index); }
  showSlide(index) { this.navigation.showSlide(index); }
  preloadAdjacent() { this.navigation.preloadAdjacent(); }
  preloadSlide(slideId) { this.navigation.preloadSlide(slideId); }
  render() { this.ui.render(); }
  renderMenu() { this.ui.renderMenu(); }
  updateUI() { this.ui.updateUI(); }
  buildBreadcrumb(slide) { return this.ui.buildBreadcrumb(slide); }
  buildMenuHTML(structure) { return this.ui.buildMenuHTML(structure); }
  toggleMenu(force) { this.ui.toggleMenu(force); }
  loadProgress() { return this._progress.load(); }
  saveProgress() { return this._progress.save(); }

  showError(message) {
    this.cleanup();
    this.ui.showError(message, () => {
      this.close();
      window.location.hash = '';
    });
  }

  setupEventListeners() {
    this._disposeEvents?.();
    this._disposeEvents = bindViewerEvents(this);
  }

  cleanup() {
    this._disposeEvents?.();
    this._disposeEvents = null;
    this.ui.cleanup();
    this._currentToc = null;
  }

  close() {
    ++this._loadVersion;
    this.cleanup();
    navigate('/');
    this.options.onClose();
  }

  get progress() { return this._progress; }
  get el() { return this.ui.el; }
  get currentIndex() { return this.navigation?.getCurrentIndex() ?? 0; }
  get menuOpen() { return this.ui.menuOpen; }
  get currentToc() { return this._currentToc; }
}

/**
 * Initialise le lecteur depuis la route, sans ouvrir les autres vues.
 * @returns {ParcoursViewer|null}
 */
export function initParcoursFromHash(container, options = {}) {
  const match = window.location.hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);
  if (!match) { return null; }
  const [, epicId, slideId] = match;
  const viewer = new ParcoursViewer(container, options);
  viewer.load(epicId, slideId);
  return viewer;
}
