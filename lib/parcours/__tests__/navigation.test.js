/**
 * Tests de la navigation entre slides
 * Navigation (prev, next, goTo), handleKeydown, showSlide
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer } from '../../parcours-viewer.js';
import {
  createMockContainer,
  createTestEpic,
  setupGlobalMocks,
  teardownGlobalMocks,
} from '../test-helpers.js';

describe('ParcoursViewer - Navigation', () => {
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
});
