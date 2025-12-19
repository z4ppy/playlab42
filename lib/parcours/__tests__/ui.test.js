/**
 * Tests de l'interface utilisateur
 * toggleMenu, updateUI, render, renderMenu
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

describe('ParcoursViewer - UI', () => {
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
        if (selector === '.pv-menu-state') { return mockStateEl1; }
        return null;
      };

      const mockMenuItem2 = createMockElement('li');
      mockMenuItem2.dataset = { slideId: 'slide-2' };
      const mockStateEl2 = createMockElement('span');
      mockMenuItem2.querySelector = (selector) => {
        if (selector === '.pv-menu-state') { return mockStateEl2; }
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
  // render
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

  // =========================================================================
  // renderMenu
  // =========================================================================
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
});
