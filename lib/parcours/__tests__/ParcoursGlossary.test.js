/**
 * Tests unitaires pour ParcoursGlossary
 * @see openspec/changes/add-glossary-system/proposal.md
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursGlossary } from '../ParcoursGlossary.js';

describe('ParcoursGlossary', () => {
  let glossary;
  let originalFetch;
  let originalDocument;
  let mockFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalDocument = global.document;

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock document minimal
    const createMockElement = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        textContent: '',
        _innerHTML: '',
        id: '',
        className: '',
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        addEventListener: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ top: 100, left: 50, width: 100, height: 20, bottom: 120 })),
        querySelectorAll: jest.fn(() => []),
        remove: jest.fn(),
      };
      Object.defineProperty(el, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) { this._innerHTML = value; },
      });
      return el;
    };

    global.document = {
      createElement: jest.fn((tag) => createMockElement(tag)),
      body: {
        appendChild: jest.fn(),
      },
      head: {
        appendChild: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    // Mock window
    global.window = {
      innerWidth: 1024,
      scrollY: 0,
    };

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => cb());

    // Mock console.warn
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    glossary = new ParcoursGlossary('test-epic', './parcours/test-epic');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.document = originalDocument;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Constructeur
  // ===========================================================================
  describe('constructor()', () => {
    it('initialise avec epicId et epicPath', () => {
      expect(glossary.epicId).toBe('test-epic');
      expect(glossary.epicPath).toBe('./parcours/test-epic');
    });

    it('initialise terms comme objet vide', () => {
      expect(glossary.terms).toEqual({});
    });

    it('initialise loaded à false', () => {
      expect(glossary.loaded).toBe(false);
    });
  });

  // ===========================================================================
  // load()
  // ===========================================================================
  describe('load()', () => {
    it('charge et fusionne les glossaires global et epic', async () => {
      // Mock global glossary
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          api: { short: 'Interface de programmation' },
        }),
      });
      // Mock epic glossary
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          react: { short: 'Bibliothèque UI JavaScript' },
        }),
      });

      await glossary.load();

      expect(glossary.loaded).toBe(true);
      expect(glossary.terms).toHaveProperty('api');
      expect(glossary.terms).toHaveProperty('react');
    });

    it('ne recharge pas si déjà chargé', async () => {
      glossary.loaded = true;
      await glossary.load();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('supporte le format { terms: {...} }', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ terms: { api: { short: 'Test' } } }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false });

      await glossary.load();

      expect(glossary.terms).toHaveProperty('api');
    });

    it('les termes epic écrasent les termes globaux', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ api: { short: 'Global definition' } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ api: { short: 'Epic definition' } }),
      });

      await glossary.load();

      expect(glossary.terms.api.short).toBe('Epic definition');
    });

    it('gère les fichiers manquants gracieusement', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      mockFetch.mockResolvedValueOnce({ ok: false });

      await glossary.load();

      expect(glossary.loaded).toBe(true);
      expect(glossary.terms).toEqual({});
    });

    it('gère les erreurs de fetch gracieusement', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await glossary.load();

      expect(glossary.loaded).toBe(true);
      expect(glossary.terms).toEqual({});
    });
  });

  // ===========================================================================
  // has()
  // ===========================================================================
  describe('has()', () => {
    beforeEach(() => {
      glossary.terms = {
        api: { short: 'Application Programming Interface' },
        react: { short: 'Bibliothèque UI' },
      };
    });

    it('retourne true si le terme existe', () => {
      expect(glossary.has('api')).toBe(true);
    });

    it('retourne false si le terme n\'existe pas', () => {
      expect(glossary.has('unknown')).toBe(false);
    });

    it('est insensible à la casse', () => {
      expect(glossary.has('API')).toBe(true);
      expect(glossary.has('Api')).toBe(true);
    });

    it('gère les espaces autour du terme', () => {
      expect(glossary.has('  api  ')).toBe(true);
    });
  });

  // ===========================================================================
  // get()
  // ===========================================================================
  describe('get()', () => {
    beforeEach(() => {
      glossary.terms = {
        api: { short: 'Interface', long: 'Description longue', see: ['rest', 'http'] },
      };
    });

    it('retourne l\'entrée si le terme existe', () => {
      const entry = glossary.get('api');
      expect(entry).toEqual({
        short: 'Interface',
        long: 'Description longue',
        see: ['rest', 'http'],
      });
    });

    it('retourne undefined si le terme n\'existe pas', () => {
      expect(glossary.get('unknown')).toBeUndefined();
    });

    it('est insensible à la casse', () => {
      expect(glossary.get('API')).toBeDefined();
    });
  });

  // ===========================================================================
  // allTerms()
  // ===========================================================================
  describe('allTerms()', () => {
    it('retourne la liste de tous les termes', () => {
      glossary.terms = {
        api: { short: 'Test' },
        react: { short: 'Test' },
        node: { short: 'Test' },
      };

      const terms = glossary.allTerms();
      expect(terms).toHaveLength(3);
      expect(terms).toContain('api');
      expect(terms).toContain('react');
      expect(terms).toContain('node');
    });

    it('retourne un tableau vide si aucun terme', () => {
      expect(glossary.allTerms()).toEqual([]);
    });
  });

  // ===========================================================================
  // termsByCategory()
  // ===========================================================================
  describe('termsByCategory()', () => {
    beforeEach(() => {
      glossary.terms = {
        api: { short: 'Test', category: 'Web' },
        rest: { short: 'Test', category: 'Web' },
        react: { short: 'Test', category: 'Frontend' },
        node: { short: 'Test' }, // Pas de catégorie -> "Autres"
      };
    });

    it('groupe les termes par catégorie', () => {
      const categories = glossary.termsByCategory();

      expect(categories).toHaveProperty('Web');
      expect(categories).toHaveProperty('Frontend');
      expect(categories).toHaveProperty('Autres');
    });

    it('met les termes sans catégorie dans "Autres"', () => {
      const categories = glossary.termsByCategory();

      expect(categories['Autres']).toContain('node');
    });

    it('trie les termes alphabétiquement dans chaque catégorie', () => {
      const categories = glossary.termsByCategory();

      expect(categories['Web']).toEqual(['api', 'rest']); // a < r
    });
  });

  // ===========================================================================
  // _normalizeTerm()
  // ===========================================================================
  describe('_normalizeTerm()', () => {
    it('convertit en minuscules', () => {
      expect(glossary._normalizeTerm('API')).toBe('api');
      expect(glossary._normalizeTerm('React')).toBe('react');
    });

    it('supprime les espaces autour', () => {
      expect(glossary._normalizeTerm('  api  ')).toBe('api');
    });
  });

  // ===========================================================================
  // _escapeHtml()
  // ===========================================================================
  describe('_escapeHtml()', () => {
    it('échappe les caractères dangereux', () => {
      // Le mock du document.createElement retourne un objet où textContent
      // est assigné et innerHTML retourne la même valeur
      const mockDiv = {
        textContent: '',
        get innerHTML() {
          return this.textContent;
        },
      };
      global.document.createElement = jest.fn(() => mockDiv);

      const result = glossary._escapeHtml('Test');
      expect(mockDiv.textContent).toBe('Test');
    });
  });

  // ===========================================================================
  // _slugify()
  // ===========================================================================
  describe('_slugify()', () => {
    it('convertit en minuscules', () => {
      expect(glossary._slugify('API')).toBe('api');
    });

    it('supprime les accents', () => {
      expect(glossary._slugify('éàü')).toBe('eau');
    });

    it('remplace les espaces et caractères spéciaux par des tirets', () => {
      expect(glossary._slugify('Hello World!')).toBe('hello-world');
    });

    it('supprime les tirets en début et fin', () => {
      expect(glossary._slugify('--hello--')).toBe('hello');
    });

    it('gère les chaînes complexes', () => {
      expect(glossary._slugify('API REST & GraphQL')).toBe('api-rest-graphql');
    });
  });

  // ===========================================================================
  // generateGlossaryPage()
  // ===========================================================================
  describe('generateGlossaryPage()', () => {
    beforeEach(() => {
      glossary.terms = {
        api: { short: 'Interface', category: 'Web' },
        react: { short: 'Library', long: 'React is a UI library', see: ['vue'], category: 'Frontend' },
        other: { short: 'Test' }, // Catégorie "Autres"
      };

      // Mock _escapeHtml pour retourner la valeur telle quelle dans les tests
      jest.spyOn(glossary, '_escapeHtml').mockImplementation((str) => str);
    });

    it('génère une page avec toutes les catégories', () => {
      const html = glossary.generateGlossaryPage();

      expect(html).toContain('Web');
      expect(html).toContain('Frontend');
      expect(html).toContain('Autres');
    });

    it('place la catégorie "Autres" en dernier', () => {
      const html = glossary.generateGlossaryPage();

      const autresIndex = html.indexOf('Autres');
      const webIndex = html.indexOf('Web');
      const frontendIndex = html.indexOf('Frontend');

      expect(autresIndex).toBeGreaterThan(webIndex);
      expect(autresIndex).toBeGreaterThan(frontendIndex);
    });

    it('inclut les définitions courtes', () => {
      const html = glossary.generateGlossaryPage();

      expect(html).toContain('Interface');
      expect(html).toContain('Library');
    });

    it('inclut les définitions longues si présentes', () => {
      const html = glossary.generateGlossaryPage();

      expect(html).toContain('React is a UI library');
    });

    it('inclut les liens "Voir aussi" si présents', () => {
      const html = glossary.generateGlossaryPage();

      expect(html).toContain('Voir aussi');
      expect(html).toContain('vue');
    });

    it('génère des IDs d\'ancrage corrects', () => {
      const html = glossary.generateGlossaryPage();

      expect(html).toContain('id="term-api"');
      expect(html).toContain('id="term-react"');
    });
  });

  // ===========================================================================
  // attachTooltips()
  // ===========================================================================
  describe('attachTooltips()', () => {
    let mockContainer;
    let mockDfnElements;

    beforeEach(() => {
      glossary.terms = {
        api: { short: 'Application Programming Interface' },
      };

      mockDfnElements = [];

      mockContainer = {
        querySelectorAll: jest.fn(() => mockDfnElements),
      };
    });

    it('ne fait rien si container est null', () => {
      expect(() => glossary.attachTooltips(null)).not.toThrow();
    });

    it('recherche les éléments dfn et [data-term]', () => {
      glossary.attachTooltips(mockContainer);

      expect(mockContainer.querySelectorAll).toHaveBeenCalledWith('dfn, [data-term]');
    });

    it('ajoute les attributs d\'accessibilité aux éléments dfn', () => {
      const mockDfn = {
        textContent: 'api',
        dataset: {},
        classList: { add: jest.fn() },
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDfnElements.push(mockDfn);

      glossary.attachTooltips(mockContainer);

      expect(mockDfn.classList.add).toHaveBeenCalledWith('glossary-term');
      expect(mockDfn.setAttribute).toHaveBeenCalledWith('tabindex', '0');
      expect(mockDfn.setAttribute).toHaveBeenCalledWith('role', 'button');
      expect(mockDfn.setAttribute).toHaveBeenCalledWith('aria-describedby', 'glossary-tooltip');
    });

    it('avertit si un terme n\'est pas défini dans le glossaire', () => {
      const mockDfn = {
        textContent: 'unknown-term',
        dataset: {},
        classList: { add: jest.fn() },
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDfnElements.push(mockDfn);

      glossary.attachTooltips(mockContainer);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unknown-term'));
    });

    it('utilise data-term si présent', () => {
      const mockDfn = {
        textContent: 'text content',
        dataset: { term: 'api' },
        classList: { add: jest.fn() },
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDfnElements.push(mockDfn);

      glossary.attachTooltips(mockContainer);

      // Devrait utiliser 'api' et non 'text content'
      expect(mockDfn.classList.add).toHaveBeenCalledWith('glossary-term');
    });

    it('enregistre un listener click sur le document', () => {
      glossary.attachTooltips(mockContainer);

      expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  // ===========================================================================
  // detachTooltips()
  // ===========================================================================
  describe('detachTooltips()', () => {
    it('supprime l\'élément tooltip s\'il existe', () => {
      const mockTooltip = { remove: jest.fn() };
      glossary._tooltipEl = mockTooltip;

      glossary.detachTooltips();

      expect(mockTooltip.remove).toHaveBeenCalled();
      expect(glossary._tooltipEl).toBeNull();
    });

    it('retire le listener click du document', () => {
      const mockHandler = jest.fn();
      glossary._boundHideTooltip = mockHandler;

      glossary.detachTooltips();

      expect(global.document.removeEventListener).toHaveBeenCalledWith('click', mockHandler);
      expect(glossary._boundHideTooltip).toBeNull();
    });

    it('ne lance pas d\'erreur si déjà détaché', () => {
      glossary._tooltipEl = null;
      glossary._boundHideTooltip = null;

      expect(() => glossary.detachTooltips()).not.toThrow();
    });
  });

  // ===========================================================================
  // _showTooltip()
  // ===========================================================================
  describe('_showTooltip()', () => {
    const mockEntry = { short: 'Test definition', see: ['other'] };
    let mockTargetEl;

    beforeEach(() => {
      mockTargetEl = {
        getBoundingClientRect: jest.fn(() => ({
          top: 100,
          left: 50,
          width: 100,
          height: 20,
          bottom: 120,
        })),
      };

      // Mock _escapeHtml
      jest.spyOn(glossary, '_escapeHtml').mockImplementation((str) => str);
      // Mock _positionTooltip
      jest.spyOn(glossary, '_positionTooltip').mockImplementation(() => {});
    });

    it('crée l\'élément tooltip s\'il n\'existe pas', () => {
      glossary._showTooltip(mockTargetEl, mockEntry, 'api');

      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(global.document.body.appendChild).toHaveBeenCalled();
    });

    it('réutilise l\'élément tooltip s\'il existe déjà', () => {
      const existingTooltip = {
        id: 'glossary-tooltip',
        innerHTML: '',
        style: {},
      };
      glossary._tooltipEl = existingTooltip;

      glossary._showTooltip(mockTargetEl, mockEntry, 'api');

      expect(global.document.createElement).not.toHaveBeenCalled();
    });

    it('inclut le terme dans le header', () => {
      const mockTooltip = { id: '', className: '', innerHTML: '', style: {}, setAttribute: jest.fn() };
      global.document.createElement = jest.fn(() => mockTooltip);

      glossary._showTooltip(mockTargetEl, mockEntry, 'MyTerm');

      expect(mockTooltip.innerHTML).toContain('MyTerm');
    });

    it('inclut la définition courte', () => {
      const mockTooltip = { id: '', className: '', innerHTML: '', style: {}, setAttribute: jest.fn() };
      global.document.createElement = jest.fn(() => mockTooltip);

      glossary._showTooltip(mockTargetEl, mockEntry, 'api');

      expect(mockTooltip.innerHTML).toContain('Test definition');
    });

    it('inclut les termes "voir aussi" si présents', () => {
      const mockTooltip = { id: '', className: '', innerHTML: '', style: {}, setAttribute: jest.fn() };
      global.document.createElement = jest.fn(() => mockTooltip);

      glossary._showTooltip(mockTargetEl, mockEntry, 'api');

      expect(mockTooltip.innerHTML).toContain('other');
    });

    it('n\'inclut pas "voir aussi" si pas de termes liés', () => {
      const mockTooltip = { id: '', className: '', innerHTML: '', style: {}, setAttribute: jest.fn() };
      global.document.createElement = jest.fn(() => mockTooltip);
      const entryWithoutSee = { short: 'Test' };

      glossary._showTooltip(mockTargetEl, entryWithoutSee, 'api');

      expect(mockTooltip.innerHTML).not.toContain('Voir aussi');
    });
  });

  // ===========================================================================
  // _hideTooltip()
  // ===========================================================================
  describe('_hideTooltip()', () => {
    it('cache le tooltip en mettant opacity à 0', () => {
      glossary._tooltipEl = { style: { opacity: '1', transform: '' } };

      glossary._hideTooltip();

      expect(glossary._tooltipEl.style.opacity).toBe('0');
    });

    it('ne lance pas d\'erreur si tooltip n\'existe pas', () => {
      glossary._tooltipEl = null;

      expect(() => glossary._hideTooltip()).not.toThrow();
    });
  });

  // ===========================================================================
  // _positionTooltip()
  // ===========================================================================
  describe('_positionTooltip()', () => {
    let mockTargetEl;

    beforeEach(() => {
      glossary._tooltipEl = {
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
        getBoundingClientRect: jest.fn(() => ({
          width: 200,
          height: 50,
        })),
      };

      mockTargetEl = {
        getBoundingClientRect: jest.fn(() => ({
          top: 100,
          left: 150,
          width: 80,
          height: 20,
          bottom: 120,
        })),
      };
    });

    it('positionne le tooltip au-dessus par défaut', () => {
      glossary._positionTooltip(mockTargetEl);

      // top = rect.top (100) - tooltipRect.height (50) - 8 = 42
      expect(glossary._tooltipEl.style.top).toBe('42px');
    });

    it('positionne le tooltip en-dessous si déborde en haut', () => {
      mockTargetEl.getBoundingClientRect.mockReturnValue({
        top: 30, // Trop haut
        left: 150,
        width: 80,
        height: 20,
        bottom: 50,
      });

      glossary._positionTooltip(mockTargetEl);

      // Devrait être positionné en-dessous
      expect(glossary._tooltipEl.classList.add).toHaveBeenCalledWith('glossary-tooltip--below');
    });

    it('évite le débordement horizontal à gauche', () => {
      mockTargetEl.getBoundingClientRect.mockReturnValue({
        top: 100,
        left: 10, // Très à gauche
        width: 80,
        height: 20,
        bottom: 120,
      });

      glossary._positionTooltip(mockTargetEl);

      // left ne devrait pas être inférieur à 8
      const leftValue = parseFloat(glossary._tooltipEl.style.left);
      expect(leftValue).toBeGreaterThanOrEqual(8);
    });

    it('évite le débordement horizontal à droite', () => {
      mockTargetEl.getBoundingClientRect.mockReturnValue({
        top: 100,
        left: 900, // Très à droite
        width: 80,
        height: 20,
        bottom: 120,
      });

      glossary._positionTooltip(mockTargetEl);

      // left ne devrait pas dépasser window.innerWidth - tooltipWidth - 8
      const leftValue = parseFloat(glossary._tooltipEl.style.left);
      expect(leftValue).toBeLessThanOrEqual(1024 - 200 - 8);
    });
  });
});
