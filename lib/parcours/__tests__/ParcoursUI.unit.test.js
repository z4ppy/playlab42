/**
 * Tests unitaires directs pour ParcoursUI
 * Ces tests testent les méthodes non couvertes de ParcoursUI
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursUI } from '../ParcoursUI.js';

describe('ParcoursUI (unit)', () => {
  let ui;
  let mockContainer;
  let mockEpic;
  let mockSlides;
  let mockProgress;
  let mockNavigation;
  let mockLocalStorage;
  let originalDocument;
  let originalWindow;
  let originalLocalStorage;

  beforeEach(() => {
    // Sauvegarder les originaux
    originalDocument = global.document;
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;

    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
      setItem: jest.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: jest.fn((key) => { delete mockLocalStorage.store[key]; }),
    };
    global.localStorage = mockLocalStorage;

    // Mock window
    global.window = {
      innerWidth: 1024,
      location: { hash: '' },
    };

    // Créer les mocks
    mockEpic = {
      id: 'test-epic',
      title: 'Test Epic',
      path: './parcours/test-epic',
      structure: [
        {
          type: 'section',
          title: 'Section 1',
          icon: '📚',
          children: [
            { type: 'slide', id: 'slide-1', title: 'Slide 1', icon: '📄' },
            { type: 'slide', id: 'slide-2', title: 'Slide 2', optional: true },
          ],
        },
      ],
    };

    mockSlides = [
      { id: 'slide-1', title: 'Slide 1', path: [{ title: 'Section 1' }] },
      { id: 'slide-2', title: 'Slide 2', path: [{ title: 'Section 1' }] },
      { id: 'slide-3', title: 'Slide 3', path: [{ title: 'Section 2' }] },
    ];

    mockProgress = {
      isVisited: jest.fn((id) => id === 'slide-1'),
    };

    mockNavigation = {
      getCurrentIndex: jest.fn(() => 0),
      getCurrentSlide: jest.fn(() => mockSlides[0]),
    };

    // Fonction helper pour créer des éléments DOM mock
    const createMockElement = (tag = 'div') => {
      const el = {
        tagName: tag.toUpperCase(),
        _innerHTML: '',
        textContent: '',
        className: '',
        style: {},
        dataset: {},
        children: [],
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          toggle: jest.fn(),
          contains: jest.fn(),
        },
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        removeAttribute: jest.fn(),
        querySelector: jest.fn(() => null),
        querySelectorAll: jest.fn(() => []),
        appendChild: jest.fn((child) => {
          el.children.push(child);
          return child;
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        remove: jest.fn(),
        parentElement: null,
        offsetWidth: 300,
      };
      Object.defineProperty(el, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) { this._innerHTML = value; },
      });
      el.querySelector = jest.fn((sel) => {
        if (sel.includes('pv-')) {
          return createMockElement();
        }
        return null;
      });
      return el;
    };

    // Mock container
    mockContainer = createMockElement();
    mockContainer.querySelector = jest.fn((sel) => {
      const el = createMockElement();
      el.selector = sel;
      return el;
    });

    // Mock document
    global.document = {
      createElement: jest.fn((tag) => createMockElement(tag)),
      body: {
        style: {},
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    // Mock requestAnimationFrame et cancelAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => {
      cb();
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();

    // Créer l'instance UI
    ui = new ParcoursUI(mockContainer, mockEpic, mockSlides, mockProgress, mockNavigation);
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // constructor()
  // ===========================================================================
  describe('constructor()', () => {
    it('initialise les propriétés correctement', () => {
      expect(ui.container).toBe(mockContainer);
      expect(ui.epic).toBe(mockEpic);
      expect(ui.slides).toBe(mockSlides);
      expect(ui.progress).toBe(mockProgress);
      expect(ui.navigation).toBe(mockNavigation);
      expect(ui.menuOpen).toBe(false);
    });
  });

  // ===========================================================================
  // render()
  // ===========================================================================
  describe('render()', () => {
    it('injecte le HTML du viewer', () => {
      ui.render();

      expect(mockContainer.innerHTML).toContain('parcours-viewer');
      expect(mockContainer.innerHTML).toContain('pv-header');
      expect(mockContainer.innerHTML).toContain('pv-sidebar');
      expect(mockContainer.innerHTML).toContain('pv-content');
      expect(mockContainer.innerHTML).toContain('pv-footer');
    });

    it('cache les références aux éléments DOM', () => {
      ui.render();

      expect(ui.el).toBeDefined();
      expect(mockContainer.querySelector).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // buildMenuHTML()
  // ===========================================================================
  describe('buildMenuHTML()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('génère le HTML pour les sections', () => {
      const html = ui.buildMenuHTML(mockEpic.structure);

      expect(html).toContain('pv-menu-section');
      expect(html).toContain('Section 1');
    });

    it('génère le HTML pour les slides', () => {
      const html = ui.buildMenuHTML(mockEpic.structure);

      expect(html).toContain('pv-menu-slide');
      expect(html).toContain('data-slide-id="slide-1"');
    });

    it('marque les slides avec leurs états (current/visited)', () => {
      // La slide-1 est courante (index 0), donc elle a 'current'
      // La slide-2 n'est pas visitée donc elle a 'pv-menu-state' avec ○
      const html = ui.buildMenuHTML(mockEpic.structure);

      // La slide courante doit avoir 'current' et l'icône ●
      expect(html).toContain('current');
      expect(html).toContain('●');
      // Les slides non visitées ont l'icône ○
      expect(html).toContain('○');
    });

    it('marque les slides optionnelles', () => {
      const html = ui.buildMenuHTML(mockEpic.structure);

      expect(html).toContain('optional');
      expect(html).toContain('pv-menu-optional');
    });

    it('utilise les icônes personnalisées', () => {
      const html = ui.buildMenuHTML(mockEpic.structure);

      expect(html).toContain('📚'); // Section icon
      expect(html).toContain('📄'); // Slide icon
    });
  });

  // ===========================================================================
  // buildBreadcrumb()
  // ===========================================================================
  describe('buildBreadcrumb()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('inclut le titre de l\'epic', () => {
      const html = ui.buildBreadcrumb(mockSlides[0]);

      expect(html).toContain('Test Epic');
    });

    it('inclut le chemin de la slide', () => {
      const html = ui.buildBreadcrumb(mockSlides[0]);

      expect(html).toContain('Section 1');
    });

    it('inclut le titre de la slide courante', () => {
      const html = ui.buildBreadcrumb(mockSlides[0]);

      expect(html).toContain('Slide 1');
      expect(html).toContain('current');
    });

    it('génère les séparateurs', () => {
      const html = ui.buildBreadcrumb(mockSlides[0]);

      expect(html).toContain('pv-breadcrumb-sep');
      expect(html).toContain('›');
    });
  });

  // ===========================================================================
  // toggleMenu()
  // ===========================================================================
  describe('toggleMenu()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('inverse l\'état du menu par défaut', () => {
      expect(ui.menuOpen).toBe(false);

      ui.toggleMenu();

      expect(ui.menuOpen).toBe(true);
      expect(ui.el.viewer.classList.toggle).toHaveBeenCalledWith('menu-open', true);
    });

    it('force l\'ouverture si open=true', () => {
      ui.toggleMenu(true);

      expect(ui.menuOpen).toBe(true);
    });

    it('force la fermeture si open=false', () => {
      ui.menuOpen = true;

      ui.toggleMenu(false);

      expect(ui.menuOpen).toBe(false);
    });

    it('met à jour aria-hidden', () => {
      ui.toggleMenu(true);

      expect(ui.el.sidebar.setAttribute).toHaveBeenCalledWith('aria-hidden', false);
    });
  });

  // ===========================================================================
  // showError()
  // ===========================================================================
  describe('showError()', () => {
    it('affiche le message d\'erreur', () => {
      ui.showError('Une erreur est survenue');

      expect(mockContainer.innerHTML).toContain('Une erreur est survenue');
      expect(mockContainer.innerHTML).toContain('pv-error');
    });

    it('échappe le HTML dans le message', () => {
      ui.showError('<script>alert("xss")</script>');

      expect(mockContainer.innerHTML).not.toContain('<script>');
    });

    it('ajoute un bouton retour', () => {
      ui.showError('Erreur');

      expect(mockContainer.innerHTML).toContain('pv-btn-error-back');
    });
  });

  // ===========================================================================
  // cleanup()
  // ===========================================================================
  describe('cleanup()', () => {
    it('vide le container', () => {
      ui.render();

      ui.cleanup();

      expect(mockContainer.innerHTML).toBe('');
    });
  });

  // ===========================================================================
  // setTocAnchorClickHandler()
  // ===========================================================================
  describe('setTocAnchorClickHandler()', () => {
    it('enregistre le handler', () => {
      const handler = jest.fn();

      ui.setTocAnchorClickHandler(handler);

      expect(ui._onTocAnchorClick).toBe(handler);
    });
  });

  // ===========================================================================
  // injectSlideToc()
  // ===========================================================================
  describe('injectSlideToc()', () => {
    beforeEach(() => {
      ui.render();
      // Mock le querySelector du menu pour retourner un élément slide
      const mockSlideItem = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
        setAttribute: jest.fn(),
        removeAttribute: jest.fn(),
        querySelector: jest.fn(() => null),
        appendChild: jest.fn(),
      };
      ui.el.menu = {
        querySelector: jest.fn(() => mockSlideItem),
      };
    });

    it('ne fait rien si slideId est null', () => {
      ui.injectSlideToc(null, [{ id: 'anchor-1', label: 'Anchor 1' }]);

      expect(ui._currentTocSlideId).toBeNull();
    });

    it('ne fait rien si items est vide', () => {
      ui.injectSlideToc('slide-1', []);

      expect(ui._currentTocSlideId).toBeNull();
    });

    it('crée la liste TOC pour les items', () => {
      const items = [
        { id: 'anchor-1', label: 'Anchor 1', level: 1 },
        { id: 'anchor-2', label: 'Anchor 2', icon: '🔗', level: 2 },
      ];

      ui.injectSlideToc('slide-1', items);

      expect(ui._currentTocSlideId).toBe('slide-1');
      expect(global.document.createElement).toHaveBeenCalledWith('ul');
      expect(global.document.createElement).toHaveBeenCalledWith('li');
      expect(global.document.createElement).toHaveBeenCalledWith('button');
    });

    it('efface l\'ancienne TOC si slide différente', () => {
      ui._currentTocSlideId = 'slide-old';
      jest.spyOn(ui, 'clearSlideToc');

      ui.injectSlideToc('slide-1', [{ id: 'a', label: 'A' }]);

      expect(ui.clearSlideToc).toHaveBeenCalledWith('slide-old');
    });
  });

  // ===========================================================================
  // clearSlideToc()
  // ===========================================================================
  describe('clearSlideToc()', () => {
    beforeEach(() => {
      ui.render();
      ui._currentTocSlideId = 'slide-1';
    });

    it('ne fait rien si slideId est null', () => {
      ui.clearSlideToc(null);

      expect(ui._currentTocSlideId).toBe('slide-1');
    });

    it('efface la TOC et reset l\'état', () => {
      const mockSlideItem = {
        classList: {
          remove: jest.fn(),
        },
        removeAttribute: jest.fn(),
        querySelector: jest.fn(() => ({ remove: jest.fn() })),
      };
      ui.el.menu = {
        querySelector: jest.fn(() => mockSlideItem),
      };

      ui.clearSlideToc('slide-1');

      expect(mockSlideItem.classList.remove).toHaveBeenCalledWith('has-toc', 'toc-expanded');
      expect(ui._currentTocSlideId).toBeNull();
    });
  });

  // ===========================================================================
  // setActiveTocAnchor()
  // ===========================================================================
  describe('setActiveTocAnchor()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('ne fait rien si pas de TOC courante', () => {
      ui._currentTocSlideId = null;

      // Ne devrait pas lever d'erreur
      expect(() => ui.setActiveTocAnchor('anchor-1')).not.toThrow();
    });

    it('met à jour l\'ancre active', () => {
      ui._currentTocSlideId = 'slide-1';
      const mockTocItems = [
        {
          classList: { add: jest.fn(), remove: jest.fn() },
          querySelector: jest.fn(() => ({ textContent: '' })),
        },
      ];
      const mockSlideItem = {
        querySelectorAll: jest.fn(() => mockTocItems),
        querySelector: jest.fn(() => mockTocItems[0]),
      };
      ui.el.menu = {
        querySelector: jest.fn(() => mockSlideItem),
      };

      ui.setActiveTocAnchor('anchor-1');

      expect(mockSlideItem.querySelectorAll).toHaveBeenCalledWith('.pv-toc-item');
    });
  });

  // ===========================================================================
  // _initResize()
  // ===========================================================================
  describe('_initResize()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('restaure la largeur sauvegardée', () => {
      mockLocalStorage.store[ParcoursUI.MENU_WIDTH_KEY] = '350';
      jest.spyOn(ui, '_setSidebarWidth');

      ui._initResize();

      expect(ui._setSidebarWidth).toHaveBeenCalledWith(350);
    });

    it('ignore les largeurs hors limites', () => {
      mockLocalStorage.store[ParcoursUI.MENU_WIDTH_KEY] = '50'; // < MIN_WIDTH
      jest.spyOn(ui, '_setSidebarWidth');

      ui._initResize();

      expect(ui._setSidebarWidth).not.toHaveBeenCalled();
    });

    it('ajoute un listener mousedown sur le handle', () => {
      ui._initResize();

      expect(ui.el.resizeHandle.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function),
      );
    });
  });

  // ===========================================================================
  // _handleResizeStart()
  // ===========================================================================
  describe('_handleResizeStart()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('ignore sur mobile', () => {
      global.window.innerWidth = 500;

      ui._handleResizeStart({ clientX: 100, preventDefault: jest.fn() });

      expect(ui._isResizing).toBe(false);
    });

    it('démarre le resize sur desktop', () => {
      global.window.innerWidth = 1024;
      const mockEvent = {
        clientX: 100,
        preventDefault: jest.fn(),
      };

      ui._handleResizeStart(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui._isResizing).toBe(true);
      expect(ui._resizeStartX).toBe(100);
    });

    it('ajoute les listeners document', () => {
      global.window.innerWidth = 1024;
      ui._handleResizeStart({ clientX: 100, preventDefault: jest.fn() });

      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'mousemove',
        ui._boundHandleResizeMove,
      );
      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'mouseup',
        ui._boundHandleResizeEnd,
      );
    });
  });

  // ===========================================================================
  // _handleResizeMove()
  // ===========================================================================
  describe('_handleResizeMove()', () => {
    beforeEach(() => {
      ui.render();
      ui._isResizing = true;
      ui._resizeStartX = 100;
      ui._resizeStartWidth = 300;
    });

    it('ne fait rien si pas en resize', () => {
      ui._isResizing = false;
      jest.spyOn(ui, '_setSidebarWidth');

      ui._handleResizeMove({ clientX: 150 });

      expect(ui._setSidebarWidth).not.toHaveBeenCalled();
    });

    it('calcule la nouvelle largeur', () => {
      jest.spyOn(ui, '_setSidebarWidth');

      ui._handleResizeMove({ clientX: 150 }); // +50px

      // requestAnimationFrame est mocké pour appeler immédiatement
      expect(ui._setSidebarWidth).toHaveBeenCalledWith(350);
    });

    it('respecte les limites MIN et MAX', () => {
      jest.spyOn(ui, '_setSidebarWidth');

      ui._handleResizeMove({ clientX: 600 }); // +500px, dépasserait MAX

      expect(ui._setSidebarWidth).toHaveBeenCalledWith(ParcoursUI.MAX_WIDTH);
    });
  });

  // ===========================================================================
  // _handleResizeEnd()
  // ===========================================================================
  describe('_handleResizeEnd()', () => {
    beforeEach(() => {
      ui.render();
      ui._isResizing = true;
    });

    it('ne fait rien si pas en resize', () => {
      ui._isResizing = false;

      ui._handleResizeEnd();

      expect(global.document.removeEventListener).not.toHaveBeenCalled();
    });

    it('termine le resize', () => {
      ui._handleResizeEnd();

      expect(ui._isResizing).toBe(false);
      expect(ui.el.resizeHandle.classList.remove).toHaveBeenCalledWith('dragging');
    });

    it('retire les listeners document', () => {
      ui._handleResizeEnd();

      expect(global.document.removeEventListener).toHaveBeenCalledWith(
        'mousemove',
        ui._boundHandleResizeMove,
      );
      expect(global.document.removeEventListener).toHaveBeenCalledWith(
        'mouseup',
        ui._boundHandleResizeEnd,
      );
    });

    it('sauvegarde la largeur dans localStorage', () => {
      ui._handleResizeEnd();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        ParcoursUI.MENU_WIDTH_KEY,
        expect.any(String),
      );
    });
  });

  // ===========================================================================
  // _setSidebarWidth()
  // ===========================================================================
  describe('_setSidebarWidth()', () => {
    beforeEach(() => {
      ui.render();
    });

    it('applique la largeur à la sidebar', () => {
      ui._setSidebarWidth(350);

      expect(ui.el.sidebar.style.width).toBe('350px');
    });

    it('met à jour le grid du viewer', () => {
      ui._setSidebarWidth(350);

      expect(ui.el.viewer.style.gridTemplateColumns).toBe('350px 1fr');
    });

    it('ne fait rien si sidebar ou viewer manquant', () => {
      ui.el.sidebar = null;

      // Ne devrait pas lever d'erreur
      expect(() => ui._setSidebarWidth(350)).not.toThrow();
    });
  });

  // ===========================================================================
  // updateUI()
  // ===========================================================================
  describe('updateUI()', () => {
    beforeEach(() => {
      ui.render();
      // Mock les éléments nécessaires
      ui.el.breadcrumb = { _innerHTML: '' };
      Object.defineProperty(ui.el.breadcrumb, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) { this._innerHTML = value; },
      });
      ui.el.btnPrev = { disabled: false };
      ui.el.btnNext = { disabled: false };
      ui.el.progressText = { textContent: '' };
      ui.el.progressFill = {
        style: {},
        parentElement: {
          setAttribute: jest.fn(),
        },
      };
      const mockMenuItems = [];
      ui.el.menu = {
        querySelectorAll: jest.fn(() => mockMenuItems),
      };
      jest.spyOn(ui, 'showSlideContent').mockImplementation(() => {});
    });

    it('met à jour le breadcrumb', () => {
      ui.updateUI();

      expect(ui.el.breadcrumb.innerHTML).toContain('Test Epic');
    });

    it('désactive btnPrev sur la première slide', () => {
      mockNavigation.getCurrentIndex.mockReturnValue(0);

      ui.updateUI();

      expect(ui.el.btnPrev.disabled).toBe(true);
    });

    it('désactive btnNext sur la dernière slide', () => {
      mockNavigation.getCurrentIndex.mockReturnValue(mockSlides.length - 1);

      ui.updateUI();

      expect(ui.el.btnNext.disabled).toBe(true);
    });

    it('met à jour la progression', () => {
      mockNavigation.getCurrentIndex.mockReturnValue(1);

      ui.updateUI();

      expect(ui.el.progressText.textContent).toBe('2 / 3');
    });

    it('appelle showSlideContent', () => {
      ui.updateUI();

      expect(ui.showSlideContent).toHaveBeenCalledWith(mockSlides[0]);
    });
  });

  // ===========================================================================
  // showSlideContent()
  // ===========================================================================
  describe('showSlideContent()', () => {
    beforeEach(() => {
      ui.render();
      ui.el.loading = {
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };
      ui.el.slideFrame = { src: '' };
    });

    it('affiche le loading', () => {
      ui.showSlideContent(mockSlides[0]);

      expect(ui.el.loading.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('définit le src de l\'iframe', () => {
      ui.showSlideContent(mockSlides[0]);

      expect(ui.el.slideFrame.src).toBe('./parcours/test-epic/slides/slide-1/index.html');
    });
  });
});
