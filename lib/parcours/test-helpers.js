/**
 * Helpers partagés pour les tests du ParcoursViewer
 * @module lib/parcours/__tests__/test-helpers
 */

import { jest } from '@jest/globals';

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
