/**
 * Tests unitaires directs pour ParcoursNavigation
 * Ces tests testent la classe ParcoursNavigation en isolation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock de replaceRoute avant l'import de ParcoursNavigation
const mockReplaceRoute = jest.fn();
jest.unstable_mockModule('../../router.js', () => ({
  replaceRoute: mockReplaceRoute,
}));

// Import dynamique après le mock
const { ParcoursNavigation } = await import('../ParcoursNavigation.js');

describe('ParcoursNavigation (unit)', () => {
  let navigation;
  let mockEpic;
  let mockSlides;
  let mockProgress;
  let mockOnSlideChange;

  beforeEach(() => {
    mockReplaceRoute.mockClear();

    // Setup des mocks
    mockEpic = {
      id: 'test-epic',
      path: './parcours/test-epic',
    };

    mockSlides = [
      { id: 'slide-1', title: 'Introduction' },
      { id: 'slide-2', title: 'Chapitre 1' },
      { id: 'slide-3', title: 'Chapitre 2' },
      { id: 'slide-4', title: 'Conclusion' },
    ];

    mockProgress = {
      markVisited: jest.fn(),
    };

    mockOnSlideChange = jest.fn();

    // Mock du document pour preloadSlide
    global.document = {
      createElement: jest.fn(() => ({
        rel: '',
        href: '',
      })),
      head: {
        appendChild: jest.fn(),
      },
    };

    navigation = new ParcoursNavigation(mockEpic, mockSlides, mockProgress, mockOnSlideChange);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Constructeur
  // ===========================================================================
  describe('constructor()', () => {
    it('initialise avec les paramètres fournis', () => {
      expect(navigation.epic).toBe(mockEpic);
      expect(navigation.slides).toBe(mockSlides);
      expect(navigation.progress).toBe(mockProgress);
      expect(navigation.onSlideChange).toBe(mockOnSlideChange);
    });

    it('initialise currentIndex à 0', () => {
      expect(navigation.currentIndex).toBe(0);
    });
  });

  // ===========================================================================
  // prev()
  // ===========================================================================
  describe('prev()', () => {
    it('navigue à la slide précédente', () => {
      navigation.currentIndex = 2;
      jest.spyOn(navigation, 'goTo');

      navigation.prev();

      expect(navigation.goTo).toHaveBeenCalledWith(1);
    });

    it('ne fait rien si on est à la première slide', () => {
      navigation.currentIndex = 0;
      jest.spyOn(navigation, 'goTo');

      navigation.prev();

      expect(navigation.goTo).not.toHaveBeenCalled();
    });

    it('navigue de l\'index 1 à 0', () => {
      navigation.currentIndex = 1;
      jest.spyOn(navigation, 'goTo');

      navigation.prev();

      expect(navigation.goTo).toHaveBeenCalledWith(0);
    });
  });

  // ===========================================================================
  // next()
  // ===========================================================================
  describe('next()', () => {
    it('navigue à la slide suivante', () => {
      navigation.currentIndex = 0;
      jest.spyOn(navigation, 'goTo');

      navigation.next();

      expect(navigation.goTo).toHaveBeenCalledWith(1);
    });

    it('ne fait rien si on est à la dernière slide', () => {
      navigation.currentIndex = mockSlides.length - 1;
      jest.spyOn(navigation, 'goTo');

      navigation.next();

      expect(navigation.goTo).not.toHaveBeenCalled();
    });

    it('navigue de l\'avant-dernière à la dernière slide', () => {
      navigation.currentIndex = mockSlides.length - 2;
      jest.spyOn(navigation, 'goTo');

      navigation.next();

      expect(navigation.goTo).toHaveBeenCalledWith(mockSlides.length - 1);
    });
  });

  // ===========================================================================
  // goTo()
  // ===========================================================================
  describe('goTo()', () => {
    it('appelle showSlide pour un index valide', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(2);

      expect(navigation.showSlide).toHaveBeenCalledWith(2);
    });

    it('ne fait rien pour un index négatif', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(-1);

      expect(navigation.showSlide).not.toHaveBeenCalled();
    });

    it('ne fait rien pour un index égal à la longueur', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(mockSlides.length);

      expect(navigation.showSlide).not.toHaveBeenCalled();
    });

    it('ne fait rien pour un index supérieur à la longueur', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(100);

      expect(navigation.showSlide).not.toHaveBeenCalled();
    });

    it('accepte l\'index 0', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(0);

      expect(navigation.showSlide).toHaveBeenCalledWith(0);
    });

    it('accepte le dernier index valide', () => {
      jest.spyOn(navigation, 'showSlide');

      navigation.goTo(mockSlides.length - 1);

      expect(navigation.showSlide).toHaveBeenCalledWith(mockSlides.length - 1);
    });
  });

  // ===========================================================================
  // showSlide()
  // ===========================================================================
  describe('showSlide()', () => {
    it('ne fait rien pour un index négatif', () => {
      navigation.showSlide(-1);

      expect(mockOnSlideChange).not.toHaveBeenCalled();
    });

    it('ne fait rien pour un index trop grand', () => {
      navigation.showSlide(100);

      expect(mockOnSlideChange).not.toHaveBeenCalled();
    });

    it('met à jour currentIndex', () => {
      navigation.showSlide(2);

      expect(navigation.currentIndex).toBe(2);
    });

    it('appelle replaceRoute avec la bonne URL', () => {
      navigation.showSlide(1);

      expect(mockReplaceRoute).toHaveBeenCalledWith('/parcours/test-epic/slide-2');
    });

    it('marque la slide comme visitée', () => {
      navigation.showSlide(0);

      expect(mockProgress.markVisited).toHaveBeenCalledWith('slide-1');
    });

    it('appelle le callback onSlideChange', () => {
      navigation.showSlide(1);

      expect(mockOnSlideChange).toHaveBeenCalledWith(mockSlides[1], 1);
    });

    it('pré-charge les slides adjacentes', () => {
      jest.spyOn(navigation, 'preloadAdjacent');

      navigation.showSlide(1);

      expect(navigation.preloadAdjacent).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // preloadAdjacent()
  // ===========================================================================
  describe('preloadAdjacent()', () => {
    it('pré-charge la slide suivante', () => {
      navigation.currentIndex = 0;
      jest.spyOn(navigation, 'preloadSlide');

      navigation.preloadAdjacent();

      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-2');
    });

    it('pré-charge la slide précédente', () => {
      navigation.currentIndex = 2;
      jest.spyOn(navigation, 'preloadSlide');

      navigation.preloadAdjacent();

      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-2');
    });

    it('pré-charge les deux slides adjacentes au milieu', () => {
      navigation.currentIndex = 1;
      jest.spyOn(navigation, 'preloadSlide');

      navigation.preloadAdjacent();

      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-3');
      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-1');
    });

    it('ne pré-charge pas de slide inexistante à la fin', () => {
      navigation.currentIndex = mockSlides.length - 1;
      jest.spyOn(navigation, 'preloadSlide');

      navigation.preloadAdjacent();

      // Ne devrait pré-charger que la précédente
      expect(navigation.preloadSlide).toHaveBeenCalledTimes(1);
      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-3');
    });

    it('ne pré-charge pas de slide inexistante au début', () => {
      navigation.currentIndex = 0;
      jest.spyOn(navigation, 'preloadSlide');

      navigation.preloadAdjacent();

      // Ne devrait pré-charger que la suivante
      expect(navigation.preloadSlide).toHaveBeenCalledTimes(1);
      expect(navigation.preloadSlide).toHaveBeenCalledWith('slide-2');
    });
  });

  // ===========================================================================
  // preloadSlide()
  // ===========================================================================
  describe('preloadSlide()', () => {
    it('crée un élément link', () => {
      navigation.preloadSlide('slide-1');

      expect(global.document.createElement).toHaveBeenCalledWith('link');
    });

    it('définit rel="prefetch"', () => {
      const mockLink = { rel: '', href: '' };
      global.document.createElement = jest.fn(() => mockLink);

      navigation.preloadSlide('slide-1');

      expect(mockLink.rel).toBe('prefetch');
    });

    it('définit le href correct', () => {
      const mockLink = { rel: '', href: '' };
      global.document.createElement = jest.fn(() => mockLink);

      navigation.preloadSlide('slide-1');

      expect(mockLink.href).toBe('./parcours/test-epic/slides/slide-1/index.html');
    });

    it('ajoute le link au head', () => {
      const mockLink = { rel: '', href: '' };
      global.document.createElement = jest.fn(() => mockLink);

      navigation.preloadSlide('slide-1');

      expect(global.document.head.appendChild).toHaveBeenCalledWith(mockLink);
    });
  });

  // ===========================================================================
  // getCurrentSlide()
  // ===========================================================================
  describe('getCurrentSlide()', () => {
    it('retourne la slide à l\'index courant', () => {
      navigation.currentIndex = 1;

      const slide = navigation.getCurrentSlide();

      expect(slide).toBe(mockSlides[1]);
    });

    it('retourne la première slide par défaut', () => {
      const slide = navigation.getCurrentSlide();

      expect(slide).toBe(mockSlides[0]);
    });
  });

  // ===========================================================================
  // getCurrentIndex()
  // ===========================================================================
  describe('getCurrentIndex()', () => {
    it('retourne l\'index courant', () => {
      navigation.currentIndex = 3;

      expect(navigation.getCurrentIndex()).toBe(3);
    });

    it('retourne 0 par défaut', () => {
      expect(navigation.getCurrentIndex()).toBe(0);
    });
  });

  // ===========================================================================
  // setCurrentIndex()
  // ===========================================================================
  describe('setCurrentIndex()', () => {
    it('définit l\'index courant', () => {
      navigation.setCurrentIndex(2);

      expect(navigation.currentIndex).toBe(2);
    });

    it('accepte l\'index 0', () => {
      navigation.currentIndex = 5;
      navigation.setCurrentIndex(0);

      expect(navigation.currentIndex).toBe(0);
    });
  });
});
