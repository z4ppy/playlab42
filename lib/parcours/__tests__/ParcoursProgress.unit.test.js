/**
 * Tests unitaires directs pour ParcoursProgress
 * Ces tests testent la classe ParcoursProgress en isolation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursProgress } from '../ParcoursProgress.js';

describe('ParcoursProgress (unit)', () => {
  let progress;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
      setItem: jest.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: jest.fn((key) => { delete mockLocalStorage.store[key]; }),
      clear: jest.fn(() => { mockLocalStorage.store = {}; }),
    };
    global.localStorage = mockLocalStorage;

    // Mock console.warn
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    progress = new ParcoursProgress('test-epic');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Constructeur
  // ===========================================================================
  describe('constructor()', () => {
    it('initialise avec l\'epicId fourni', () => {
      expect(progress.epicId).toBe('test-epic');
    });

    it('initialise data avec visited vide et current null', () => {
      expect(progress.data).toEqual({ visited: [], current: null });
    });

    it('accepte n\'importe quel epicId', () => {
      const customProgress = new ParcoursProgress('custom-epic-123');
      expect(customProgress.epicId).toBe('custom-epic-123');
    });
  });

  // ===========================================================================
  // load()
  // ===========================================================================
  describe('load()', () => {
    it('charge la progression depuis localStorage', () => {
      const savedData = {
        'test-epic': { visited: ['slide-1', 'slide-2'], current: 'slide-2' },
      };
      mockLocalStorage.store['parcours-progress'] = JSON.stringify(savedData);

      progress.load();

      expect(progress.data).toEqual({ visited: ['slide-1', 'slide-2'], current: 'slide-2' });
    });

    it('initialise avec données vides si aucune donnée en localStorage', () => {
      progress.load();

      expect(progress.data).toEqual({ visited: [], current: null });
    });

    it('initialise avec données vides si l\'epic n\'existe pas dans le storage', () => {
      const savedData = {
        'autre-epic': { visited: ['slide-x'], current: 'slide-x' },
      };
      mockLocalStorage.store['parcours-progress'] = JSON.stringify(savedData);

      progress.load();

      expect(progress.data).toEqual({ visited: [], current: null });
    });

    it('gère les erreurs de parsing JSON', () => {
      mockLocalStorage.store['parcours-progress'] = 'invalid json {{{';

      progress.load();

      expect(progress.data).toEqual({ visited: [], current: null });
    });

    it('gère les erreurs de localStorage.getItem', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      progress.load();

      expect(progress.data).toEqual({ visited: [], current: null });
    });

    it('charge la progression pour l\'epic spécifique', () => {
      const savedData = {
        'test-epic': { visited: ['slide-1'], current: 'slide-1' },
        'other-epic': { visited: ['slide-a', 'slide-b'], current: 'slide-b' },
      };
      mockLocalStorage.store['parcours-progress'] = JSON.stringify(savedData);

      progress.load();

      expect(progress.data.visited).toEqual(['slide-1']);
      expect(progress.data.current).toBe('slide-1');
    });
  });

  // ===========================================================================
  // save()
  // ===========================================================================
  describe('save()', () => {
    it('sauvegarde la progression dans localStorage', () => {
      progress.data = { visited: ['slide-1'], current: 'slide-1' };

      progress.save();

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
    });

    it('préserve les données des autres epics', () => {
      const existingData = {
        'other-epic': { visited: ['slide-x'], current: 'slide-x' },
      };
      mockLocalStorage.store['parcours-progress'] = JSON.stringify(existingData);
      progress.data = { visited: ['slide-1'], current: 'slide-1' };

      progress.save();

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData['other-epic']).toEqual({ visited: ['slide-x'], current: 'slide-x' });
      expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
    });

    it('met à jour les données existantes de l\'epic', () => {
      const existingData = {
        'test-epic': { visited: ['slide-1'], current: 'slide-1' },
      };
      mockLocalStorage.store['parcours-progress'] = JSON.stringify(existingData);
      progress.data = { visited: ['slide-1', 'slide-2'], current: 'slide-2' };

      progress.save();

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData['test-epic']).toEqual({ visited: ['slide-1', 'slide-2'], current: 'slide-2' });
    });

    it('gère les erreurs de localStorage silencieusement', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      progress.data = { visited: ['slide-1'], current: 'slide-1' };

      expect(() => progress.save()).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('crée les données initiales si localStorage est vide', () => {
      progress.data = { visited: ['slide-1'], current: 'slide-1' };

      progress.save();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'parcours-progress',
        expect.any(String),
      );
    });
  });

  // ===========================================================================
  // markVisited()
  // ===========================================================================
  describe('markVisited()', () => {
    beforeEach(() => {
      // Mock save pour éviter les effets de bord
      jest.spyOn(progress, 'save').mockImplementation(() => {});
    });

    it('ajoute la slide aux visitées', () => {
      progress.markVisited('slide-1');

      expect(progress.data.visited).toContain('slide-1');
    });

    it('met à jour current', () => {
      progress.markVisited('slide-1');

      expect(progress.data.current).toBe('slide-1');
    });

    it('ne duplique pas les slides visitées', () => {
      progress.data.visited = ['slide-1'];

      progress.markVisited('slide-1');

      expect(progress.data.visited.filter((id) => id === 'slide-1').length).toBe(1);
    });

    it('appelle save()', () => {
      progress.markVisited('slide-1');

      expect(progress.save).toHaveBeenCalled();
    });

    it('ajoute plusieurs slides distinctes', () => {
      progress.markVisited('slide-1');
      progress.markVisited('slide-2');
      progress.markVisited('slide-3');

      expect(progress.data.visited).toEqual(['slide-1', 'slide-2', 'slide-3']);
    });

    it('met à jour current à chaque appel', () => {
      progress.markVisited('slide-1');
      expect(progress.data.current).toBe('slide-1');

      progress.markVisited('slide-2');
      expect(progress.data.current).toBe('slide-2');

      progress.markVisited('slide-1'); // Retour sur slide-1
      expect(progress.data.current).toBe('slide-1');
    });
  });

  // ===========================================================================
  // isVisited()
  // ===========================================================================
  describe('isVisited()', () => {
    it('retourne true si la slide a été visitée', () => {
      progress.data.visited = ['slide-1', 'slide-2'];

      expect(progress.isVisited('slide-1')).toBe(true);
      expect(progress.isVisited('slide-2')).toBe(true);
    });

    it('retourne false si la slide n\'a pas été visitée', () => {
      progress.data.visited = ['slide-1'];

      expect(progress.isVisited('slide-2')).toBe(false);
      expect(progress.isVisited('slide-3')).toBe(false);
    });

    it('retourne false si aucune slide visitée', () => {
      expect(progress.isVisited('slide-1')).toBe(false);
    });
  });

  // ===========================================================================
  // getCurrentSlide()
  // ===========================================================================
  describe('getCurrentSlide()', () => {
    it('retourne la slide courante', () => {
      progress.data.current = 'slide-2';

      expect(progress.getCurrentSlide()).toBe('slide-2');
    });

    it('retourne null si aucune slide courante', () => {
      expect(progress.getCurrentSlide()).toBeNull();
    });
  });

  // ===========================================================================
  // Scénarios d'intégration
  // ===========================================================================
  describe('Scénarios complets', () => {
    it('gère un parcours utilisateur complet', () => {
      // L'utilisateur visite plusieurs slides
      progress.markVisited('intro');
      progress.markVisited('chapter-1');
      progress.markVisited('chapter-2');

      expect(progress.isVisited('intro')).toBe(true);
      expect(progress.isVisited('chapter-1')).toBe(true);
      expect(progress.isVisited('chapter-2')).toBe(true);
      expect(progress.getCurrentSlide()).toBe('chapter-2');
    });

    it('persiste et restaure la progression', () => {
      // Simuler une session
      progress.markVisited('slide-1');
      progress.markVisited('slide-2');

      // Simuler save réel
      progress.save = jest.fn().mockImplementation(function () {
        const data = mockLocalStorage.getItem('parcours-progress');
        const all = data ? JSON.parse(data) : {};
        all[this.epicId] = this.data;
        mockLocalStorage.store['parcours-progress'] = JSON.stringify(all);
      }).bind(progress);

      progress.save();

      // Créer une nouvelle instance et charger
      const newProgress = new ParcoursProgress('test-epic');
      newProgress.load();

      expect(newProgress.data.visited).toEqual(['slide-1', 'slide-2']);
      expect(newProgress.data.current).toBe('slide-2');
    });

    it('isole les progressions par epic', () => {
      // Setup deux epics
      const epicA = new ParcoursProgress('epic-a');
      const epicB = new ParcoursProgress('epic-b');

      // Remplacer save par une version fonctionnelle
      const realSave = function () {
        const data = mockLocalStorage.getItem('parcours-progress');
        const all = data ? JSON.parse(data) : {};
        all[this.epicId] = this.data;
        mockLocalStorage.store['parcours-progress'] = JSON.stringify(all);
      };

      epicA.save = realSave.bind(epicA);
      epicB.save = realSave.bind(epicB);

      epicA.markVisited('a-slide-1');
      epicB.markVisited('b-slide-1');
      epicB.markVisited('b-slide-2');

      // Charger les données
      const newEpicA = new ParcoursProgress('epic-a');
      const newEpicB = new ParcoursProgress('epic-b');
      newEpicA.load();
      newEpicB.load();

      expect(newEpicA.data.visited).toEqual(['a-slide-1']);
      expect(newEpicB.data.visited).toEqual(['b-slide-1', 'b-slide-2']);
    });
  });
});
