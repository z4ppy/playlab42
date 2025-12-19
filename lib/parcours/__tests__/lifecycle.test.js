/**
 * Tests du cycle de vie du ParcoursViewer
 * constructor, load, close, showError, Préchargement
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer } from '../../parcours-viewer.js';
import {
  createMockContainer,
  createTestEpic,
  setupGlobalMocks,
  teardownGlobalMocks,
} from '../test-helpers.js';

describe('ParcoursViewer - Lifecycle', () => {
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
  // Préchargement
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

    it('met à jour l\'URL via navigate', () => {
      viewer.close();

      // navigate('/') définit window.location.hash à '/'
      expect(global.window.location.hash).toBe('/');
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
    it('affiche un message d\'erreur échappé', () => {
      viewer.showError('Epic non trouvé');

      expect(mockContainer.innerHTML).toContain('pv-error');
      expect(mockContainer.innerHTML).toContain('Epic non trouvé');
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
