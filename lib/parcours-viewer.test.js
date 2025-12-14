/**
 * Tests unitaires pour parcours-viewer.js
 * Couverture complète avec mocks DOM
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer, initParcoursFromHash } from './parcours-viewer.js';

// =========================================================================
// Helpers pour créer des mocks DOM
// =========================================================================

/**
 * Crée un mock d'élément DOM complet
 */
function createMockElement(tagName = 'div', attrs = {}) {
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
        if (idx >= 0) {handlers.splice(idx, 1);}
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
 * Crée un container mock avec tous les éléments nécessaires
 */
function createMockContainer() {
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
    return mapping[selector] || null;
  };

  return { container, elements };
}

/**
 * Crée des données de test pour un epic
 */
function createTestEpic() {
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
// Tests
// =========================================================================

describe('ParcoursViewer', () => {
  let mockContainer;
  let mockElements;
  let viewer;
  let originalDocument;
  let originalWindow;
  let originalLocalStorage;

  beforeEach(() => {
    // Setup mocks
    ({ container: mockContainer, elements: mockElements } = createMockContainer());

    // Mock document
    originalDocument = global.document;
    global.document = {
      createElement: (tag) => createMockElement(tag),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      head: {
        appendChild: jest.fn(),
      },
    };

    // Mock window
    originalWindow = global.window;
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
    originalLocalStorage = global.localStorage;
    const storage = {};
    global.localStorage = {
      getItem: jest.fn((key) => storage[key] || null),
      setItem: jest.fn((key, value) => { storage[key] = value; }),
      removeItem: jest.fn((key) => { delete storage[key]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
    };

    // Mock console
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    viewer = new ParcoursViewer(mockContainer);
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Constructor
  // =========================================================================
  describe('constructor()', () => {
    it('initialise avec les options par défaut', () => {
      expect(viewer.container).toBe(mockContainer);
      expect(viewer.epic).toBeNull();
      expect(viewer.slides).toEqual([]);
      expect(viewer.currentIndex).toBe(0);
      expect(viewer.menuOpen).toBe(false);
    });

    it('accepte des callbacks personnalisés', () => {
      const onClose = jest.fn();
      const onSlideChange = jest.fn();
      const customViewer = new ParcoursViewer(mockContainer, { onClose, onSlideChange });

      expect(customViewer.options.onClose).toBe(onClose);
      expect(customViewer.options.onSlideChange).toBe(onSlideChange);
    });

    it('bind les méthodes handleKeydown et handleHashChange', () => {
      expect(typeof viewer.handleKeydown).toBe('function');
      expect(typeof viewer.handleHashChange).toBe('function');
    });
  });

  // =========================================================================
  // flattenStructure
  // =========================================================================
  describe('flattenStructure()', () => {
    it('aplatit des slides simples sans sections', () => {
      const structure = [
        { type: 'slide', id: '01-intro', title: 'Intro' },
        { type: 'slide', id: '02-setup', title: 'Setup' },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result).toEqual([
        { id: '01-intro', title: 'Intro', icon: undefined, optional: undefined, path: [] },
        { id: '02-setup', title: 'Setup', icon: undefined, optional: undefined, path: [] },
      ]);
    });

    it('aplatit des slides dans une section', () => {
      const structure = [
        {
          type: 'section',
          id: 'basics',
          title: 'Les bases',
          icon: '📚',
          children: [
            { type: 'slide', id: '01-intro', title: 'Intro' },
          ],
        },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('01-intro');
      expect(result[0].path).toEqual([
        { id: 'basics', title: 'Les bases', icon: '📚' },
      ]);
    });

    it('préserve le chemin avec sections imbriquées', () => {
      const structure = [
        {
          type: 'section',
          id: 'level1',
          title: 'Niveau 1',
          icon: '1️⃣',
          children: [
            {
              type: 'section',
              id: 'level2',
              title: 'Niveau 2',
              icon: '2️⃣',
              children: [
                { type: 'slide', id: 'deep-slide', title: 'Slide profonde' },
              ],
            },
          ],
        },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result).toHaveLength(1);
      expect(result[0].path).toEqual([
        { id: 'level1', title: 'Niveau 1', icon: '1️⃣' },
        { id: 'level2', title: 'Niveau 2', icon: '2️⃣' },
      ]);
    });

    it('préserve l\'ordre des slides entre sections', () => {
      const structure = [
        {
          type: 'section',
          id: 'section1',
          title: 'Section 1',
          children: [
            { type: 'slide', id: 's1-slide1', title: 'S1 Slide 1' },
            { type: 'slide', id: 's1-slide2', title: 'S1 Slide 2' },
          ],
        },
        { type: 'slide', id: 'standalone', title: 'Standalone' },
        {
          type: 'section',
          id: 'section2',
          title: 'Section 2',
          children: [
            { type: 'slide', id: 's2-slide1', title: 'S2 Slide 1' },
          ],
        },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result.map(s => s.id)).toEqual([
        's1-slide1',
        's1-slide2',
        'standalone',
        's2-slide1',
      ]);
    });

    it('préserve le flag optional sur les slides', () => {
      const structure = [
        { type: 'slide', id: 'required', title: 'Required' },
        { type: 'slide', id: 'optional', title: 'Optional', optional: true },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result[0].optional).toBeUndefined();
      expect(result[1].optional).toBe(true);
    });

    it('préserve les icônes des slides', () => {
      const structure = [
        { type: 'slide', id: 'with-icon', title: 'With Icon', icon: '🎯' },
        { type: 'slide', id: 'no-icon', title: 'No Icon' },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result[0].icon).toBe('🎯');
      expect(result[1].icon).toBeUndefined();
    });

    it('retourne un tableau vide pour une structure vide', () => {
      const result = viewer.flattenStructure([]);

      expect(result).toEqual([]);
    });

    it('gère une section vide', () => {
      const structure = [
        {
          type: 'section',
          id: 'empty',
          title: 'Section vide',
          children: [],
        },
      ];

      const result = viewer.flattenStructure(structure);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // escapeHtml
  // =========================================================================
  describe('escapeHtml()', () => {
    it('échappe les caractères HTML dangereux', () => {
      // Créer un mock qui simule le comportement réel de escapeHtml
      const mockDiv = {
        textContent: '',
        innerHTML: '',
      };
      // Quand textContent est assigné, innerHTML devient la version échappée
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(val) { this.innerHTML = val.replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
      });
      global.document.createElement = () => mockDiv;

      const result = viewer.escapeHtml('<script>alert("xss")</script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('retourne une chaîne vide pour une chaîne vide', () => {
      const mockDiv = { textContent: '', innerHTML: '' };
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(val) { this.innerHTML = val; },
      });
      global.document.createElement = () => mockDiv;

      const result = viewer.escapeHtml('');
      expect(result).toBe('');
    });

    it('gère les caractères spéciaux', () => {
      const mockDiv = { textContent: '', innerHTML: '' };
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(val) {
          this.innerHTML = val
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        },
      });
      global.document.createElement = () => mockDiv;

      const result = viewer.escapeHtml('Test & "quotes" <tag>');
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
    });
  });

  // =========================================================================
  // buildBreadcrumb
  // =========================================================================
  describe('buildBreadcrumb()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      // Mock escapeHtml pour qu'il retourne la valeur telle quelle
      viewer.escapeHtml = (str) => str;
    });

    it('construit un breadcrumb pour une slide sans section', () => {
      const slide = { id: 'slide-1', title: 'Slide 1', path: [] };
      const result = viewer.buildBreadcrumb(slide);

      expect(result).toContain('Epic de Test');
      expect(result).toContain('Slide 1');
      expect(result).toContain('pv-breadcrumb-sep');
    });

    it('construit un breadcrumb avec sections imbriquées', () => {
      const slide = {
        id: 'slide-1',
        title: 'Slide 1',
        path: [
          { id: 'section1', title: 'Section 1' },
          { id: 'section2', title: 'Section 2' },
        ],
      };
      const result = viewer.buildBreadcrumb(slide);

      expect(result).toContain('Epic de Test');
      expect(result).toContain('Section 1');
      expect(result).toContain('Section 2');
      expect(result).toContain('Slide 1');
    });
  });

  // =========================================================================
  // buildMenuHTML
  // =========================================================================
  describe('buildMenuHTML()', () => {
    beforeEach(() => {
      viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
      viewer.slides = [
        { id: 'slide-1', title: 'Slide 1' },
        { id: 'slide-2', title: 'Slide 2' },
      ];
      viewer.currentIndex = 0;
      // Mock escapeHtml pour qu'il retourne la valeur telle quelle
      viewer.escapeHtml = (str) => str;
    });

    it('génère le HTML pour des slides simples', () => {
      const structure = [
        { type: 'slide', id: 'slide-1', title: 'Slide 1', icon: '📄' },
        { type: 'slide', id: 'slide-2', title: 'Slide 2' },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('pv-menu-slide');
      expect(result).toContain('data-slide-id="slide-1"');
      expect(result).toContain('data-slide-id="slide-2"');
    });

    it('génère le HTML pour des sections', () => {
      const structure = [
        {
          type: 'section',
          id: 'section1',
          title: 'Section 1',
          icon: '📚',
          children: [
            { type: 'slide', id: 'slide-1', title: 'Slide 1' },
          ],
        },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('pv-menu-section');
      expect(result).toContain('pv-menu-toggle');
      expect(result).toContain('Section 1');
    });

    it('marque la slide courante', () => {
      const structure = [
        { type: 'slide', id: 'slide-1', title: 'Slide 1' },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('current');
    });

    it('marque les slides visitées', () => {
      viewer.currentIndex = 1;
      viewer.slides[1] = { id: 'slide-2', title: 'Slide 2' };
      const structure = [
        { type: 'slide', id: 'slide-1', title: 'Slide 1' },
        { type: 'slide', id: 'slide-2', title: 'Slide 2' },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('visited');
    });

    it('marque les slides optionnelles', () => {
      const structure = [
        { type: 'slide', id: 'slide-opt', title: 'Optional', optional: true },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('optional');
      expect(result).toContain('(optionnel)');
    });

    it('utilise une icône par défaut pour les sections sans icône', () => {
      const structure = [
        {
          type: 'section',
          id: 'no-icon',
          title: 'Sans icône',
          children: [],
        },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('📁');
    });

    it('utilise une icône par défaut pour les slides sans icône', () => {
      viewer.slides = [{ id: 'no-icon', title: 'Sans icône' }];
      viewer.currentIndex = 0;
      const structure = [
        { type: 'slide', id: 'no-icon', title: 'Sans icône' },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('📄');
    });
  });

  // =========================================================================
  // toggleMenu
  // =========================================================================
  describe('toggleMenu()', () => {
    beforeEach(() => {
      viewer.el = mockElements;
    });

    it('ouvre le menu quand il est fermé', () => {
      viewer.menuOpen = false;
      viewer.toggleMenu();

      expect(viewer.menuOpen).toBe(true);
    });

    it('ferme le menu quand il est ouvert', () => {
      viewer.menuOpen = true;
      viewer.toggleMenu();

      expect(viewer.menuOpen).toBe(false);
    });

    it('force l\'ouverture avec true', () => {
      viewer.menuOpen = false;
      viewer.toggleMenu(true);

      expect(viewer.menuOpen).toBe(true);
    });

    it('force la fermeture avec false', () => {
      viewer.menuOpen = true;
      viewer.toggleMenu(false);

      expect(viewer.menuOpen).toBe(false);
    });

    it('met à jour les classes CSS et aria-hidden', () => {
      viewer.menuOpen = false;
      viewer.toggleMenu(true);

      expect(mockElements.viewer._classList.has('menu-open')).toBe(true);
      expect(mockElements.sidebar.getAttribute('aria-hidden')).toBe('false');
    });
  });

  // =========================================================================
  // prev, next, goTo
  // =========================================================================
  describe('Navigation', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.el = mockElements;
      viewer.progress = { visited: [], current: null };

      // Mock showSlide pour éviter les effets de bord
      viewer.showSlide = jest.fn();
    });

    describe('prev()', () => {
      it('navigue à la slide précédente', () => {
        viewer.currentIndex = 2;
        viewer.prev();

        expect(viewer.showSlide).toHaveBeenCalledWith(1);
      });

      it('ne fait rien si on est à la première slide', () => {
        viewer.currentIndex = 0;
        viewer.prev();

        expect(viewer.showSlide).not.toHaveBeenCalled();
      });
    });

    describe('next()', () => {
      it('navigue à la slide suivante', () => {
        viewer.currentIndex = 0;
        viewer.next();

        expect(viewer.showSlide).toHaveBeenCalledWith(1);
      });

      it('ne fait rien si on est à la dernière slide', () => {
        viewer.currentIndex = viewer.slides.length - 1;
        viewer.next();

        expect(viewer.showSlide).not.toHaveBeenCalled();
      });
    });

    describe('goTo()', () => {
      it('navigue à un index valide', () => {
        viewer.goTo(1);

        expect(viewer.showSlide).toHaveBeenCalledWith(1);
      });

      it('ne fait rien pour un index négatif', () => {
        viewer.goTo(-1);

        expect(viewer.showSlide).not.toHaveBeenCalled();
      });

      it('ne fait rien pour un index trop grand', () => {
        viewer.goTo(100);

        expect(viewer.showSlide).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // handleKeydown
  // =========================================================================
  describe('handleKeydown()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.el = mockElements;
      viewer.progress = { visited: [], current: null };
      viewer.prev = jest.fn();
      viewer.next = jest.fn();
      viewer.goTo = jest.fn();
      viewer.toggleMenu = jest.fn();
      viewer.close = jest.fn();
    });

    it('ignore les événements depuis un INPUT', () => {
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'INPUT' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(viewer.next).not.toHaveBeenCalled();
    });

    it('ignore les événements depuis un TEXTAREA', () => {
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'TEXTAREA' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ArrowLeft navigue à la slide précédente', () => {
      const event = {
        key: 'ArrowLeft',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.prev).toHaveBeenCalled();
    });

    it('ArrowRight navigue à la slide suivante', () => {
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.next).toHaveBeenCalled();
    });

    it('Escape ferme le menu si ouvert', () => {
      viewer.menuOpen = true;
      const event = {
        key: 'Escape',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.toggleMenu).toHaveBeenCalledWith(false);
      expect(viewer.close).not.toHaveBeenCalled();
    });

    it('Escape ferme le viewer si menu fermé', () => {
      viewer.menuOpen = false;
      const event = {
        key: 'Escape',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(viewer.close).toHaveBeenCalled();
    });

    it('m toggle le menu', () => {
      const event = {
        key: 'm',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.toggleMenu).toHaveBeenCalled();
    });

    it('Home navigue à la première slide', () => {
      const event = {
        key: 'Home',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.goTo).toHaveBeenCalledWith(0);
    });

    it('End navigue à la dernière slide', () => {
      const event = {
        key: 'End',
        target: { tagName: 'DIV' },
        preventDefault: jest.fn(),
      };

      viewer.handleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(viewer.goTo).toHaveBeenCalledWith(viewer.slides.length - 1);
    });
  });

  // =========================================================================
  // handleHashChange
  // =========================================================================
  describe('handleHashChange()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.currentIndex = 0;
      viewer.close = jest.fn();
      viewer.load = jest.fn();
      viewer.showSlide = jest.fn();
    });

    it('ferme le viewer si le hash ne correspond pas au pattern', () => {
      global.window.location.hash = '#/other/path';

      viewer.handleHashChange();

      expect(viewer.close).toHaveBeenCalled();
    });

    it('ferme le viewer si le hash est vide', () => {
      global.window.location.hash = '';

      viewer.handleHashChange();

      expect(viewer.close).toHaveBeenCalled();
    });

    it('recharge si l\'epic est différent', () => {
      global.window.location.hash = '#/parcours/autre-epic/slide-1';

      viewer.handleHashChange();

      expect(viewer.load).toHaveBeenCalledWith('autre-epic', 'slide-1');
    });

    it('navigue si c\'est une autre slide du même epic', () => {
      global.window.location.hash = '#/parcours/test-epic/slide-2';

      viewer.handleHashChange();

      expect(viewer.showSlide).toHaveBeenCalledWith(1);
    });

    it('ne navigue pas si c\'est la même slide', () => {
      global.window.location.hash = '#/parcours/test-epic/slide-1';

      viewer.handleHashChange();

      expect(viewer.showSlide).not.toHaveBeenCalled();
    });

    it('gère un hash parcours sans slideId', () => {
      global.window.location.hash = '#/parcours/autre-epic';

      viewer.handleHashChange();

      expect(viewer.load).toHaveBeenCalledWith('autre-epic', undefined);
    });
  });

  // =========================================================================
  // loadProgress et saveProgress
  // =========================================================================
  describe('Gestion de la progression', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
    });

    describe('loadProgress()', () => {
      it('charge la progression depuis localStorage', () => {
        const savedProgress = {
          'test-epic': { visited: ['slide-1', 'slide-2'], current: 'slide-2' },
        };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: ['slide-1', 'slide-2'], current: 'slide-2' });
      });

      it('initialise une progression vide si rien en storage', () => {
        global.localStorage.getItem.mockReturnValue(null);

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });

      it('initialise une progression vide si l\'epic n\'existe pas', () => {
        const savedProgress = {
          'autre-epic': { visited: ['slide-1'], current: 'slide-1' },
        };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });

      it('gère les erreurs de parsing JSON', () => {
        global.localStorage.getItem.mockReturnValue('invalid json');

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });
    });

    describe('saveProgress()', () => {
      it('sauvegarde la progression dans localStorage', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        global.localStorage.getItem.mockReturnValue(null);

        viewer.saveProgress();

        expect(global.localStorage.setItem).toHaveBeenCalled();
        const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
        expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
      });

      it('préserve la progression des autres epics', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        const existingData = { 'autre-epic': { visited: ['x'], current: 'x' } };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(existingData));

        viewer.saveProgress();

        const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
        expect(savedData['autre-epic']).toEqual({ visited: ['x'], current: 'x' });
        expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
      });

      it('gère les erreurs de localStorage', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        global.localStorage.getItem.mockImplementation(() => { throw new Error('Storage error'); });

        // Ne doit pas lever d'exception
        expect(() => viewer.saveProgress()).not.toThrow();
        expect(console.warn).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // showSlide
  // =========================================================================
  describe('showSlide()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.el = mockElements;
      viewer.progress = { visited: [], current: null };
      viewer.options.onSlideChange = jest.fn();
      viewer.updateUI = jest.fn();
      viewer.preloadAdjacent = jest.fn();
      viewer.saveProgress = jest.fn();
    });

    it('ne fait rien pour un index invalide (négatif)', () => {
      viewer.showSlide(-1);

      expect(viewer.updateUI).not.toHaveBeenCalled();
    });

    it('ne fait rien pour un index invalide (trop grand)', () => {
      viewer.showSlide(100);

      expect(viewer.updateUI).not.toHaveBeenCalled();
    });

    it('met à jour l\'index courant', () => {
      viewer.showSlide(1);

      expect(viewer.currentIndex).toBe(1);
    });

    it('met à jour l\'URL avec history.replaceState', () => {
      global.window.location.hash = '';
      viewer.showSlide(0);

      expect(global.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '#/parcours/test-epic/slide-1',
      );
    });

    it('charge la slide dans l\'iframe', () => {
      viewer.showSlide(0);

      expect(mockElements.slideFrame.src).toBe('./parcours/test-epic/slides/slide-1/index.html');
    });

    it('marque la slide comme visitée', () => {
      viewer.showSlide(0);

      expect(viewer.progress.visited).toContain('slide-1');
    });

    it('ne duplique pas les slides visitées', () => {
      viewer.progress.visited = ['slide-1'];
      viewer.showSlide(0);

      expect(viewer.progress.visited.filter(id => id === 'slide-1').length).toBe(1);
    });

    it('appelle le callback onSlideChange', () => {
      viewer.showSlide(0);

      expect(viewer.options.onSlideChange).toHaveBeenCalledWith(viewer.slides[0], 0);
    });

    it('affiche le loading', () => {
      mockElements.loading._classList.add('hidden');
      viewer.showSlide(0);

      expect(mockElements.loading._classList.has('hidden')).toBe(false);
    });
  });

  // =========================================================================
  // updateUI
  // =========================================================================
  describe('updateUI()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.el = mockElements;
      viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
      viewer.currentIndex = 0;
      viewer.buildBreadcrumb = jest.fn().mockReturnValue('<nav>breadcrumb</nav>');
    });

    it('met à jour le breadcrumb', () => {
      viewer.updateUI();

      expect(viewer.buildBreadcrumb).toHaveBeenCalledWith(viewer.slides[0]);
      expect(mockElements.breadcrumb.innerHTML).toBe('<nav>breadcrumb</nav>');
    });

    it('désactive le bouton précédent sur la première slide', () => {
      viewer.currentIndex = 0;
      viewer.updateUI();

      expect(mockElements.btnPrev.disabled).toBe(true);
    });

    it('active le bouton précédent sur les autres slides', () => {
      viewer.currentIndex = 1;
      viewer.updateUI();

      expect(mockElements.btnPrev.disabled).toBe(false);
    });

    it('désactive le bouton suivant sur la dernière slide', () => {
      viewer.currentIndex = viewer.slides.length - 1;
      viewer.updateUI();

      expect(mockElements.btnNext.disabled).toBe(true);
    });

    it('met à jour le texte de progression', () => {
      viewer.currentIndex = 1;
      viewer.updateUI();

      expect(mockElements.progressText.textContent).toBe('2 / 3');
    });

    it('met à jour la barre de progression', () => {
      viewer.currentIndex = 1;
      viewer.updateUI();

      expect(mockElements.progressFill.style.width).toBe('67%');
    });

    it('met à jour les états des items du menu', () => {
      // Créer des items de menu mock
      const mockMenuItem1 = createMockElement('li');
      mockMenuItem1.dataset = { slideId: 'slide-1' };
      const mockStateEl1 = createMockElement('span');
      mockMenuItem1.querySelector = (selector) => {
        if (selector === '.pv-menu-state') {return mockStateEl1;}
        return null;
      };

      const mockMenuItem2 = createMockElement('li');
      mockMenuItem2.dataset = { slideId: 'slide-2' };
      const mockStateEl2 = createMockElement('span');
      mockMenuItem2.querySelector = (selector) => {
        if (selector === '.pv-menu-state') {return mockStateEl2;}
        return null;
      };

      const mockMenuItem3 = createMockElement('li');
      mockMenuItem3.dataset = { slideId: 'slide-3' };
      mockMenuItem3.querySelector = () => null; // Pas d'élément state

      mockElements.menu.querySelectorAll = () => [mockMenuItem1, mockMenuItem2, mockMenuItem3];

      viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
      viewer.currentIndex = 0;
      viewer.updateUI();

      // slide-1 est courante
      expect(mockMenuItem1._classList.has('current')).toBe(true);
      expect(mockMenuItem1._classList.has('visited')).toBe(false);
      expect(mockMenuItem1.getAttribute('aria-current')).toBe('page');
      expect(mockStateEl1.textContent).toBe('●');

      // slide-2 n'est pas visitée
      expect(mockMenuItem2._classList.has('current')).toBe(false);
      expect(mockMenuItem2._classList.has('visited')).toBe(false);
      expect(mockMenuItem2.getAttribute('aria-current')).toBeNull();
      expect(mockStateEl2.textContent).toBe('○');
    });

    it('marque les slides visitées non courantes', () => {
      const mockMenuItem = createMockElement('li');
      mockMenuItem.dataset = { slideId: 'slide-1' };
      const mockStateEl = createMockElement('span');
      mockMenuItem.querySelector = () => mockStateEl;

      mockElements.menu.querySelectorAll = () => [mockMenuItem];

      viewer.progress = { visited: ['slide-1'], current: 'slide-2' };
      viewer.currentIndex = 1;
      viewer.updateUI();

      expect(mockMenuItem._classList.has('visited')).toBe(true);
      expect(mockMenuItem._classList.has('current')).toBe(false);
      expect(mockStateEl.textContent).toBe('✓');
    });
  });

  // =========================================================================
  // preloadAdjacent et preloadSlide
  // =========================================================================
  describe('Préchargement', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.currentIndex = 1;
    });

    describe('preloadSlide()', () => {
      it('crée un lien prefetch', () => {
        const mockLink = { rel: '', href: '' };
        const createElementSpy = jest.fn(() => mockLink);
        const appendChildSpy = jest.fn();
        global.document.createElement = createElementSpy;
        global.document.head.appendChild = appendChildSpy;

        viewer.preloadSlide('slide-1');

        expect(createElementSpy).toHaveBeenCalledWith('link');
        expect(appendChildSpy).toHaveBeenCalled();
        expect(mockLink.rel).toBe('prefetch');
        expect(mockLink.href).toContain('slide-1');
      });
    });

    describe('preloadAdjacent()', () => {
      it('pré-charge les slides adjacentes', () => {
        viewer.preloadSlide = jest.fn();
        viewer.preloadAdjacent();

        expect(viewer.preloadSlide).toHaveBeenCalledWith('slide-3');
        expect(viewer.preloadSlide).toHaveBeenCalledWith('slide-1');
      });

      it('ne pré-charge pas au-delà des limites', () => {
        viewer.currentIndex = 0;
        viewer.preloadSlide = jest.fn();
        viewer.preloadAdjacent();

        // Seulement la suivante
        expect(viewer.preloadSlide).toHaveBeenCalledTimes(1);
        expect(viewer.preloadSlide).toHaveBeenCalledWith('slide-2');
      });
    });
  });

  // =========================================================================
  // close
  // =========================================================================
  describe('close()', () => {
    beforeEach(() => {
      viewer.options.onClose = jest.fn();
    });

    it('retire les event listeners', () => {
      viewer.close();

      expect(global.document.removeEventListener).toHaveBeenCalledWith('keydown', viewer.handleKeydown);
      expect(global.window.removeEventListener).toHaveBeenCalledWith('hashchange', viewer.handleHashChange);
    });

    it('vide le container', () => {
      mockContainer.innerHTML = '<div>content</div>';
      viewer.close();

      expect(mockContainer.innerHTML).toBe('');
    });

    it('met à jour l\'URL', () => {
      viewer.close();

      expect(global.history.pushState).toHaveBeenCalledWith(null, '', '/test');
    });

    it('appelle le callback onClose', () => {
      viewer.close();

      expect(viewer.options.onClose).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // showError
  // =========================================================================
  describe('showError()', () => {
    beforeEach(() => {
      // Mock escapeHtml pour qu'il retourne la valeur telle quelle
      viewer.escapeHtml = (str) => str;
    });

    it('affiche un message d\'erreur échappé', () => {
      viewer.showError('Epic non trouvé');

      expect(mockContainer.innerHTML).toContain('pv-error');
      expect(mockContainer.innerHTML).toContain('Epic non trouvé');
    });
  });

  // =========================================================================
  // render et renderMenu
  // =========================================================================
  describe('render()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.progress = { visited: [], current: null };
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
    });

    it('génère le HTML du viewer', () => {
      viewer.render();

      expect(mockContainer.innerHTML).toContain('parcours-viewer');
      expect(mockContainer.innerHTML).toContain('pv-header');
      expect(mockContainer.innerHTML).toContain('pv-sidebar');
      expect(mockContainer.innerHTML).toContain('pv-content');
      expect(mockContainer.innerHTML).toContain('pv-footer');
    });

    it('initialise les éléments DOM', () => {
      viewer.render();

      expect(viewer.el.viewer).toBeDefined();
      expect(viewer.el.btnClose).toBeDefined();
      expect(viewer.el.slideFrame).toBeDefined();
    });

    it('affiche le titre de l\'epic', () => {
      viewer.render();

      expect(mockElements.epicTitle.textContent).toBe('Epic de Test');
    });
  });

  describe('renderMenu()', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
      viewer.progress = { visited: [], current: null };
      viewer.slides = viewer.flattenStructure(viewer.epic.structure);
      viewer.el = mockElements;
    });

    it('appelle buildMenuHTML', () => {
      viewer.buildMenuHTML = jest.fn().mockReturnValue('<ul>menu</ul>');
      viewer.renderMenu();

      expect(viewer.buildMenuHTML).toHaveBeenCalledWith(viewer.epic.structure);
      expect(mockElements.menu.innerHTML).toBe('<ul>menu</ul>');
    });
  });

  // =========================================================================
  // setupEventListeners
  // =========================================================================
  describe('setupEventListeners()', () => {
    beforeEach(() => {
      viewer.el = mockElements;
      viewer.close = jest.fn();
      viewer.toggleMenu = jest.fn();
      viewer.prev = jest.fn();
      viewer.next = jest.fn();
      viewer.slides = [{ id: 'slide-1' }, { id: 'slide-2' }];
      viewer.goTo = jest.fn();
    });

    it('attache les listeners aux boutons', () => {
      viewer.setupEventListeners();

      expect(mockElements.btnClose._eventListeners.has('click')).toBe(true);
      expect(mockElements.btnMenu._eventListeners.has('click')).toBe(true);
      expect(mockElements.btnCloseMenu._eventListeners.has('click')).toBe(true);
      expect(mockElements.btnPrev._eventListeners.has('click')).toBe(true);
      expect(mockElements.btnNext._eventListeners.has('click')).toBe(true);
    });

    it('attache le listener au clavier', () => {
      viewer.setupEventListeners();

      expect(global.document.addEventListener).toHaveBeenCalledWith('keydown', viewer.handleKeydown);
    });

    it('attache le listener au hashchange', () => {
      viewer.setupEventListeners();

      expect(global.window.addEventListener).toHaveBeenCalledWith('hashchange', viewer.handleHashChange);
    });

    it('attache le listener au chargement de l\'iframe', () => {
      viewer.setupEventListeners();

      expect(mockElements.slideFrame._eventListeners.has('load')).toBe(true);
    });

    it('cache le loading quand l\'iframe est chargée', () => {
      viewer.setupEventListeners();
      mockElements.loading._classList.delete('hidden');

      // Simuler le chargement de l'iframe
      const loadHandlers = mockElements.slideFrame._eventListeners.get('load');
      loadHandlers[0]();

      expect(mockElements.loading._classList.has('hidden')).toBe(true);
    });

    it('gère le clic sur une slide dans le menu', () => {
      const mockSlideItem = {
        dataset: { slideId: 'slide-2' },
      };
      mockElements.menu.addEventListener = (event, handler) => {
        if (event === 'click') {
          // Stocker le handler pour pouvoir le tester
          mockElements.menu._clickHandler = handler;
        }
      };

      viewer.setupEventListeners();

      // Simuler un clic sur une slide du menu
      const mockEvent = {
        target: {
          closest: (selector) => {
            if (selector === '.pv-menu-slide') {return mockSlideItem;}
            if (selector === '.pv-menu-toggle') {return null;}
            return null;
          },
        },
      };

      mockElements.menu._clickHandler(mockEvent);

      expect(viewer.goTo).toHaveBeenCalledWith(1);
      expect(viewer.toggleMenu).toHaveBeenCalledWith(false);
    });

    it('gère le clic sur une slide inexistante dans le menu', () => {
      const mockSlideItem = {
        dataset: { slideId: 'inexistant' },
      };
      mockElements.menu.addEventListener = (event, handler) => {
        if (event === 'click') {
          mockElements.menu._clickHandler = handler;
        }
      };

      viewer.setupEventListeners();

      const mockEvent = {
        target: {
          closest: (selector) => {
            if (selector === '.pv-menu-slide') {return mockSlideItem;}
            if (selector === '.pv-menu-toggle') {return null;}
            return null;
          },
        },
      };

      mockElements.menu._clickHandler(mockEvent);

      expect(viewer.goTo).not.toHaveBeenCalled();
    });

    it('gère le toggle d\'une section dans le menu', () => {
      const mockSection = createMockElement('li');
      mockSection.setAttribute('aria-expanded', 'true');

      const mockToggle = createMockElement('button');
      mockToggle.closest = (selector) => {
        if (selector === '.pv-menu-section') {return mockSection;}
        return null;
      };

      mockElements.menu.addEventListener = (event, handler) => {
        if (event === 'click') {
          mockElements.menu._clickHandler = handler;
        }
      };

      viewer.setupEventListeners();

      const mockEvent = {
        target: {
          closest: (selector) => {
            if (selector === '.pv-menu-slide') {return null;}
            if (selector === '.pv-menu-toggle') {return mockToggle;}
            return null;
          },
        },
      };

      mockElements.menu._clickHandler(mockEvent);

      expect(mockSection.getAttribute('aria-expanded')).toBe('false');
    });

    it('déplie une section fermée au clic', () => {
      const mockSection = createMockElement('li');
      mockSection.setAttribute('aria-expanded', 'false');

      const mockToggle = createMockElement('button');
      mockToggle.closest = (selector) => {
        if (selector === '.pv-menu-section') {return mockSection;}
        return null;
      };

      mockElements.menu.addEventListener = (event, handler) => {
        if (event === 'click') {
          mockElements.menu._clickHandler = handler;
        }
      };

      viewer.setupEventListeners();

      const mockEvent = {
        target: {
          closest: (selector) => {
            if (selector === '.pv-menu-slide') {return null;}
            if (selector === '.pv-menu-toggle') {return mockToggle;}
            return null;
          },
        },
      };

      mockElements.menu._clickHandler(mockEvent);

      expect(mockSection.getAttribute('aria-expanded')).toBe('true');
    });
  });

  // =========================================================================
  // load
  // =========================================================================
  describe('load()', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      viewer.render = jest.fn();
      viewer.setupEventListeners = jest.fn();
      viewer.showSlide = jest.fn();
      viewer.showError = jest.fn();
      viewer.loadProgress = jest.fn();
    });

    it('charge le catalogue et l\'epic', async () => {
      const catalogue = { epics: [createTestEpic()] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });

      await viewer.load('test-epic');

      expect(global.fetch).toHaveBeenCalledWith('./data/parcours.json');
      expect(viewer.epic).toEqual(createTestEpic());
      expect(viewer.render).toHaveBeenCalled();
      expect(viewer.setupEventListeners).toHaveBeenCalled();
      expect(viewer.showSlide).toHaveBeenCalledWith(0);
    });

    it('navigue à la slide spécifiée', async () => {
      const catalogue = { epics: [createTestEpic()] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });

      await viewer.load('test-epic', 'slide-2');

      expect(viewer.showSlide).toHaveBeenCalledWith(1);
    });

    it('affiche une erreur si le catalogue est introuvable', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      await viewer.load('test-epic');

      expect(viewer.showError).toHaveBeenCalledWith('Catalogue parcours introuvable');
    });

    it('affiche une erreur si l\'epic n\'existe pas', async () => {
      const catalogue = { epics: [] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });

      await viewer.load('inexistant');

      expect(viewer.showError).toHaveBeenCalledWith('Epic non trouvé: inexistant');
    });

    it('reprend à la slide sauvegardée si pas de slideId', async () => {
      const catalogue = { epics: [createTestEpic()] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });
      viewer.loadProgress = jest.fn(() => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-2' };
      });

      await viewer.load('test-epic');

      expect(viewer.showSlide).toHaveBeenCalledWith(1);
    });

    it('gère un slideId invalide', async () => {
      const catalogue = { epics: [createTestEpic()] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });

      await viewer.load('test-epic', 'inexistant');

      expect(viewer.showSlide).toHaveBeenCalledWith(0);
    });

    it('gère une progression sauvegardée avec slideId invalide', async () => {
      const catalogue = { epics: [createTestEpic()] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(catalogue),
      });
      viewer.loadProgress = jest.fn(() => {
        viewer.progress = { visited: [], current: 'inexistant' };
      });

      await viewer.load('test-epic');

      expect(viewer.showSlide).toHaveBeenCalledWith(0);
    });
  });
});

// =========================================================================
// initParcoursFromHash
// =========================================================================
describe('initParcoursFromHash()', () => {
  let mockContainer;
  let originalWindow;

  beforeEach(() => {
    mockContainer = createMockElement('div');
    mockContainer.querySelector = () => createMockElement('div');

    originalWindow = global.window;
    global.window = {
      location: {
        hash: '',
        pathname: '/test',
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    global.document = {
      createElement: () => createMockElement('div'),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      head: { appendChild: jest.fn() },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ epics: [createTestEpic()] }),
    });
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('retourne null si le hash ne correspond pas', () => {
    global.window.location.hash = '#/other';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeNull();
  });

  it('retourne null pour un hash vide', () => {
    global.window.location.hash = '';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeNull();
  });

  it('crée un viewer et charge l\'epic', () => {
    global.window.location.hash = '#/parcours/test-epic';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeInstanceOf(ParcoursViewer);
  });

  it('passe le slideId au viewer', () => {
    global.window.location.hash = '#/parcours/test-epic/slide-2';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeInstanceOf(ParcoursViewer);
  });

  it('passe les options au viewer', () => {
    global.window.location.hash = '#/parcours/test-epic';
    const onClose = jest.fn();

    const result = initParcoursFromHash(mockContainer, { onClose });

    expect(result.options.onClose).toBe(onClose);
  });
});
