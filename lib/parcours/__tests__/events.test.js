/**
 * Tests des gestionnaires d'événements
 * handleHashChange, setupEventListeners
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer } from '../../parcours-viewer.js';
import {
  createMockElement,
  createMockContainer,
  createTestEpic,
  setupGlobalMocks,
  teardownGlobalMocks,
} from '../test-helpers.js';

describe('ParcoursViewer - Events', () => {
  let mockContainer;
  let mockElements;
  let viewer;
  let originals;

  beforeEach(() => {
    ({ container: mockContainer, elements: mockElements } = createMockContainer());
    originals = setupGlobalMocks();
    viewer = new ParcoursViewer(mockContainer);
  });

  afterEach(() => {
    teardownGlobalMocks(originals);
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
            if (selector === '.pv-menu-slide') { return mockSlideItem; }
            if (selector === '.pv-menu-toggle') { return null; }
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
            if (selector === '.pv-menu-slide') { return mockSlideItem; }
            if (selector === '.pv-menu-toggle') { return null; }
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
        if (selector === '.pv-menu-section') { return mockSection; }
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
            if (selector === '.pv-menu-slide') { return null; }
            if (selector === '.pv-menu-toggle') { return mockToggle; }
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
        if (selector === '.pv-menu-section') { return mockSection; }
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
            if (selector === '.pv-menu-slide') { return null; }
            if (selector === '.pv-menu-toggle') { return mockToggle; }
            return null;
          },
        },
      };

      mockElements.menu._clickHandler(mockEvent);

      expect(mockSection.getAttribute('aria-expanded')).toBe('true');
    });
  });
});
