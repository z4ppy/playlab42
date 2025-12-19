/**
 * Helpers partagés pour les tests du ParcoursViewer
 * @module lib/parcours/__tests__/test-helpers
 */

import { jest } from '@jest/globals';
import { flattenStructure } from './utils.js';
import { escapeHtml } from '../dom.js';

// =========================================================================
// Mocks DOM
// =========================================================================

/**
 * Crée un mock d'élément DOM complet
 * @param {string} tagName - Nom de la balise HTML
 * @param {Object} attrs - Attributs initiaux
 * @returns {Object} Mock d'élément DOM
 */
export function createMockElement(tagName = 'div', attrs = {}) {
  const classList = new Set();
  const attributes = new Map(Object.entries(attrs));
  const children = [];
  const eventListeners = new Map();

  return {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    textContent: '',
    src: '',
    disabled: false,
    style: {},
    parentElement: null,
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classList.has(cls)) {
            classList.delete(cls);
          } else {
            classList.add(cls);
          }
        } else if (force) {
          classList.add(cls);
        } else {
          classList.delete(cls);
        }
      },
      contains: (cls) => classList.has(cls),
    },
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    addEventListener: (event, handler) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (eventListeners.has(event)) {
        const handlers = eventListeners.get(event);
        const idx = handlers.indexOf(handler);
        if (idx >= 0) { handlers.splice(idx, 1); }
      }
    },
    dispatchEvent: (event) => {
      if (eventListeners.has(event.type)) {
        eventListeners.get(event.type).forEach(h => h(event));
      }
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    appendChild: (child) => {
      children.push(child);
      child.parentElement = this;
    },
    _eventListeners: eventListeners,
    _classList: classList,
    _children: children,
    dataset: {},
  };
}

/**
 * Crée un container mock avec tous les éléments nécessaires au viewer
 * @returns {Object} { container, elements }
 */
export function createMockContainer() {
  const elements = {};
  const container = createMockElement('div');

  // Éléments du viewer
  const elementNames = [
    'viewer', 'header', 'btnClose', 'breadcrumb', 'btnMenu',
    'sidebar', 'epicTitle', 'btnCloseMenu', 'menu', 'content',
    'slideContainer', 'slideFrame', 'loading', 'footer',
    'btnPrev', 'btnNext', 'progressText', 'progressFill',
  ];

  elementNames.forEach(name => {
    elements[name] = createMockElement('div');
  });

  // Le menu a une méthode querySelectorAll spéciale
  elements.menu.querySelectorAll = () => [];

  // Le progressFill a un parent pour progressbar
  elements.progressFill.parentElement = createMockElement('div');

  container.querySelector = (selector) => {
    const mapping = {
      '.parcours-viewer': elements.viewer,
      '.pv-header': elements.header,
      '.pv-btn-close': elements.btnClose,
      '.pv-breadcrumb': elements.breadcrumb,
      '.pv-btn-menu': elements.btnMenu,
      '.pv-sidebar': elements.sidebar,
      '.pv-epic-title': elements.epicTitle,
      '.pv-btn-close-menu': elements.btnCloseMenu,
      '.pv-menu': elements.menu,
      '.pv-content': elements.content,
      '.pv-slide-container': elements.slideContainer,
      '.pv-slide-frame': elements.slideFrame,
      '.pv-loading': elements.loading,
      '.pv-footer': elements.footer,
      '.pv-btn-prev': elements.btnPrev,
      '.pv-btn-next': elements.btnNext,
      '.pv-progress-text': elements.progressText,
      '.pv-progress-fill': elements.progressFill,
    };
    // Retourner un mock par défaut au lieu de null pour éviter les erreurs
    return mapping[selector] || createMockElement();
  };

  return { container, elements };
}

// =========================================================================
// Données de test
// =========================================================================

/**
 * Crée des données de test pour un epic
 * @returns {Object} Epic de test avec structure hiérarchique
 */
export function createTestEpic() {
  return {
    id: 'test-epic',
    title: 'Epic de Test',
    path: './parcours/test-epic',
    structure: [
      {
        type: 'section',
        id: 'section1',
        title: 'Section 1',
        icon: '📚',
        children: [
          { type: 'slide', id: 'slide-1', title: 'Slide 1', icon: '📄' },
          { type: 'slide', id: 'slide-2', title: 'Slide 2', optional: true },
        ],
      },
      { type: 'slide', id: 'slide-3', title: 'Slide 3' },
    ],
  };
}

// =========================================================================
// Setup / Teardown globaux
// =========================================================================

/**
 * Configure les mocks globaux pour les tests
 * @returns {Object} Références aux originaux pour le teardown
 */
export function setupGlobalMocks() {
  const originals = {
    document: global.document,
    window: global.window,
    localStorage: globalThis.localStorage,
  };

  // Mock document
  global.document = {
    createElement: (tag) => createMockElement(tag),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    head: {
      appendChild: jest.fn(),
    },
  };

  // Mock window
  global.window = {
    location: {
      hash: '',
      pathname: '/test',
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  // Mock history
  global.history = {
    replaceState: jest.fn(),
    pushState: jest.fn(),
  };

  // Mock localStorage
  const storage = {};
  const localStorageMock = {
    getItem: jest.fn((key) => storage[key] || null),
    setItem: jest.fn((key, value) => { storage[key] = value; }),
    removeItem: jest.fn((key) => { delete storage[key]; }),
    clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    _storage: storage, // Accès direct pour les tests
  };
  globalThis.localStorage = localStorageMock;
  global.localStorage = localStorageMock;

  // Mock console
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  return originals;
}

/**
 * Restaure les globaux originaux après les tests
 * @param {Object} originals - Références aux originaux
 */
export function teardownGlobalMocks(originals) {
  global.document = originals.document;
  global.window = originals.window;
  globalThis.localStorage = originals.localStorage;
  global.localStorage = originals.localStorage;
  jest.restoreAllMocks();
}

// =========================================================================
// Mocks de composants
// =========================================================================

/**
 * Crée un mock de ParcoursProgress
 * @param {string} epicId - ID de l'epic
 * @returns {Object} Mock de ParcoursProgress
 */
export function createMockProgress(epicId = 'test-epic') {
  const data = { visited: [], current: null };
  return {
    epicId,
    data,
    load: jest.fn(),
    save: jest.fn(),
    markVisited: jest.fn((slideId) => {
      if (!data.visited.includes(slideId)) {
        data.visited.push(slideId);
      }
      data.current = slideId;
    }),
    isVisited: jest.fn((slideId) => data.visited.includes(slideId)),
    getCurrentSlide: jest.fn(() => data.current),
    // Alias pour compatibilité avec plain objects dans les tests
    get visited() { return data.visited; },
    set visited(v) { data.visited = v; },
    get current() { return data.current; },
    set current(v) { data.current = v; },
  };
}

/**
 * Crée un mock de ParcoursNavigation
 * @param {Object} epic - Epic de test
 * @param {Array} slides - Liste des slides
 * @param {Object} progress - Mock de progress
 * @param {Function} onSlideChange - Callback
 * @returns {Object} Mock de ParcoursNavigation
 */
export function createMockNavigation(epic, slides, progress, onSlideChange = jest.fn()) {
  let currentIndex = 0;
  return {
    epic,
    slides,
    progress,
    onSlideChange,
    getCurrentIndex: jest.fn(() => currentIndex),
    setCurrentIndex: jest.fn((idx) => { currentIndex = idx; }),
    getCurrentSlide: jest.fn(() => slides[currentIndex]),
    prev: jest.fn(() => {
      if (currentIndex > 0) {
        currentIndex--;
        onSlideChange(slides[currentIndex], currentIndex);
      }
    }),
    next: jest.fn(() => {
      if (currentIndex < slides.length - 1) {
        currentIndex++;
        onSlideChange(slides[currentIndex], currentIndex);
      }
    }),
    goTo: jest.fn((idx) => {
      if (idx >= 0 && idx < slides.length) {
        currentIndex = idx;
        onSlideChange(slides[currentIndex], currentIndex);
      }
    }),
    showSlide: jest.fn((idx) => {
      if (idx >= 0 && idx < slides.length) {
        currentIndex = idx;
        progress.markVisited(slides[idx].id);
        onSlideChange(slides[idx], idx);
      }
    }),
    preloadAdjacent: jest.fn(),
    preloadSlide: jest.fn(),
    get currentIndex() { return currentIndex; },
    set currentIndex(v) { currentIndex = v; },
  };
}

/**
 * Crée un mock de ParcoursUI
 * @param {HTMLElement} container - Container mock
 * @param {Object} epic - Epic de test
 * @param {Array} slides - Liste des slides
 * @param {Object} progress - Mock de progress
 * @param {Object} navigation - Mock de navigation
 * @returns {Object} Mock de ParcoursUI
 */
export function createMockUI(container, epic, slides, progress, navigation) {
  const elements = createMockContainer().elements;
  let menuOpen = false;

  return {
    container,
    epic,
    slides,
    progress,
    navigation,
    el: elements,
    render: jest.fn(() => {
      container.innerHTML = '<div class="parcours-viewer">...</div>';
    }),
    renderMenu: jest.fn(),
    updateUI: jest.fn(),
    toggleMenu: jest.fn((force) => {
      menuOpen = force !== undefined ? force : !menuOpen;
    }),
    showError: jest.fn((msg) => {
      container.innerHTML = `<div class="pv-error">${escapeHtml(msg)}</div>`;
    }),
    showSlideContent: jest.fn(),
    buildBreadcrumb: jest.fn((slide) => {
      const parts = [`<span>${escapeHtml(epic.title)}</span>`];
      if (slide.path) {
        for (const s of slide.path) {
          parts.push(`<span>${escapeHtml(s.title)}</span>`);
        }
      }
      parts.push(`<span>${escapeHtml(slide.title)}</span>`);
      return parts.join(' › ');
    }),
    buildMenuHTML: jest.fn((structure) => {
      let html = '<ul>';
      for (const item of structure) {
        if (item.type === 'section') {
          html += `<li class="pv-menu-section">${escapeHtml(item.title)}</li>`;
        } else {
          html += `<li class="pv-menu-slide" data-slide-id="${item.id}">${escapeHtml(item.title)}</li>`;
        }
      }
      return `${html}</ul>`;
    }),
    cleanup: jest.fn(() => { container.innerHTML = ''; }),
    get menuOpen() { return menuOpen; },
    set menuOpen(v) { menuOpen = v; },
  };
}

/**
 * Initialise un viewer avec des composants mockés prêts à l'emploi
 * @param {ParcoursViewer} viewer - Instance de ParcoursViewer
 * @param {Object} options - Options d'initialisation
 * @returns {Object} { viewer, progress, navigation, ui, elements }
 */
export function initializeViewerWithMocks(viewer, options = {}) {
  const { container, elements } = createMockContainer();
  const epic = options.epic || createTestEpic();
  const slides = flattenStructure(epic.structure);

  // Créer les mocks de composants
  const progress = createMockProgress(epic.id);
  const navigation = createMockNavigation(epic, slides, progress);
  const ui = createMockUI(container, epic, slides, progress, navigation);

  // Injecter dans le viewer
  viewer.epic = epic;
  viewer.slides = slides;
  viewer._progress = progress;
  viewer.navigation = navigation;
  viewer.ui = ui;
  viewer._el = elements;

  return { viewer, progress, navigation, ui, elements, slides, epic };
}

// Ré-exporter les utilitaires pour les tests qui en ont besoin
export { escapeHtml, flattenStructure };
