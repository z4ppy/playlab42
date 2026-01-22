/**
 * Tests unitaires pour lib/dom.js
 * Utilitaires DOM pour Playlab42
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  $,
  $$,
  create,
  on,
  delegate,
  escapeHtml,
  cloneTemplate,
  fillTemplate,
  ready,
  debounce,
} from './dom.js';

describe('DOM Utilities', () => {
  let originalDocument;
  let originalNode;
  let mockDocument;

  beforeEach(() => {
    originalDocument = global.document;
    originalNode = global.Node;

    // Mock Node pour les tests (fonction constructeur simple)
    global.Node = function MockNode() {};

    // Mock document minimal
    const elements = new Map();

    mockDocument = {
      querySelector: jest.fn((sel) => elements.get(sel) || null),
      querySelectorAll: jest.fn((sel) => {
        const result = [];
        for (const [key, el] of elements) {
          if (key.includes(sel) || sel === '*') {
            result.push(el);
          }
        }
        return result;
      }),
      createElement: jest.fn((tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          style: {},
          textContent: '',
          _innerHTML: '',
          attributes: {},
          children: [],
          eventListeners: {},
          appendChild: jest.fn(function (child) {
            this.children.push(child);
            return child;
          }),
          setAttribute: jest.fn(function (key, value) {
            this.attributes[key] = value;
          }),
          getAttribute: jest.fn(function (key) {
            return this.attributes[key];
          }),
          addEventListener: jest.fn(function (event, handler, opts) {
            if (!this.eventListeners[event]) {
              this.eventListeners[event] = [];
            }
            this.eventListeners[event].push({ handler, opts });
          }),
          removeEventListener: jest.fn(function (event, handler) {
            if (this.eventListeners[event]) {
              this.eventListeners[event] = this.eventListeners[event].filter(
                (l) => l.handler !== handler,
              );
            }
          }),
          contains: jest.fn(() => true),
          closest: jest.fn(function () { return this; }),
        };
        Object.defineProperty(el, 'innerHTML', {
          get() { return this._innerHTML; },
          set(value) { this._innerHTML = value; },
        });
        return el;
      }),
      createTextNode: jest.fn((text) => ({ nodeType: 3, textContent: text })),
      createDocumentFragment: jest.fn(() => ({
        children: [],
        appendChild: jest.fn(function (child) {
          this.children.push(child);
        }),
        querySelector: jest.fn(() => null),
      })),
      getElementById: jest.fn(() => null),
      readyState: 'complete',
      addEventListener: jest.fn(),
      _elements: elements,
      _addElement: (sel, el) => elements.set(sel, el),
    };

    global.document = mockDocument;

    // Mock console.warn
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.document = originalDocument;
    global.Node = originalNode;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // $() - querySelector shortcut
  // ===========================================================================
  describe('$()', () => {
    it('appelle querySelector sur document par défaut', () => {
      const mockEl = { id: 'test' };
      mockDocument._addElement('#test', mockEl);

      const result = $('#test');

      expect(mockDocument.querySelector).toHaveBeenCalledWith('#test');
      expect(result).toBe(mockEl);
    });

    it('utilise le contexte fourni', () => {
      const mockContext = {
        querySelector: jest.fn(() => ({ id: 'child' })),
      };

      const result = $('.child', mockContext);

      expect(mockContext.querySelector).toHaveBeenCalledWith('.child');
      expect(result).toEqual({ id: 'child' });
    });

    it('retourne null si élément non trouvé', () => {
      const result = $('#nonexistent');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // $$() - querySelectorAll shortcut
  // ===========================================================================
  describe('$$()', () => {
    it('retourne un tableau d\'éléments', () => {
      mockDocument._addElement('.item1', { id: 'item1' });
      mockDocument._addElement('.item2', { id: 'item2' });

      const result = $$('*');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('utilise le contexte fourni', () => {
      const mockContext = {
        querySelectorAll: jest.fn(() => [{ id: '1' }, { id: '2' }]),
      };

      const result = $$('.items', mockContext);

      expect(mockContext.querySelectorAll).toHaveBeenCalledWith('.items');
      expect(result).toHaveLength(2);
    });

    it('retourne un tableau vide si aucun élément', () => {
      mockDocument.querySelectorAll.mockReturnValue([]);

      const result = $$('.nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // create() - createElement helper
  // ===========================================================================
  describe('create()', () => {
    it('crée un élément avec le tag spécifié', () => {
      const el = create('div');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(el.tagName).toBe('DIV');
    });

    it('applique la classe via l\'attribut class', () => {
      const el = create('div', { class: 'my-class' });

      expect(el.className).toBe('my-class');
    });

    it('applique les styles via l\'attribut style (objet)', () => {
      const el = create('div', { style: { color: 'red', fontSize: '14px' } });

      expect(el.style.color).toBe('red');
      expect(el.style.fontSize).toBe('14px');
    });

    it('attache les event handlers (onclick, etc.)', () => {
      const handler = jest.fn();
      const el = create('button', { onClick: handler });

      expect(el.addEventListener).toHaveBeenCalledWith('click', handler);
    });

    it('applique les attributs standards', () => {
      const el = create('input', { type: 'text', placeholder: 'Entrer...' });

      expect(el.setAttribute).toHaveBeenCalledWith('type', 'text');
      expect(el.setAttribute).toHaveBeenCalledWith('placeholder', 'Entrer...');
    });

    it('applique les data attributes', () => {
      const el = create('div', { 'data-id': '42', 'data-name': 'test' });

      expect(el.setAttribute).toHaveBeenCalledWith('data-id', '42');
      expect(el.setAttribute).toHaveBeenCalledWith('data-name', 'test');
    });

    it('ajoute les enfants texte', () => {
      const el = create('p', {}, ['Hello ', 'World']);

      expect(mockDocument.createTextNode).toHaveBeenCalledWith('Hello ');
      expect(mockDocument.createTextNode).toHaveBeenCalledWith('World');
      expect(el.appendChild).toHaveBeenCalledTimes(2);
    });

    it('ajoute les enfants éléments (Node)', () => {
      // Créer un Node mock en héritant de la classe Node
      const childNode = Object.create(global.Node.prototype);
      childNode.nodeType = 1;

      const el = create('div', {}, [childNode]);

      expect(el.appendChild).toHaveBeenCalledWith(childNode);
    });

    it('ignore les enfants non valides', () => {
      // null, undefined et nombres ne sont ni string ni Node
      const el = create('div', {}, [null, undefined, 42, {}]);

      // Aucun de ces enfants ne devrait être ajouté
      // (seuls les string et instanceof Node le sont)
      expect(el.appendChild).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // on() - addEventListener helper
  // ===========================================================================
  describe('on()', () => {
    it('attache un event listener', () => {
      const el = mockDocument.createElement('button');
      const handler = jest.fn();

      on(el, 'click', handler);

      expect(el.addEventListener).toHaveBeenCalledWith('click', handler, {});
    });

    it('passe les options au listener', () => {
      const el = mockDocument.createElement('button');
      const handler = jest.fn();
      const opts = { capture: true, passive: true };

      on(el, 'click', handler, opts);

      expect(el.addEventListener).toHaveBeenCalledWith('click', handler, opts);
    });

    it('retourne une fonction pour retirer le listener', () => {
      const el = mockDocument.createElement('button');
      const handler = jest.fn();

      const off = on(el, 'click', handler);

      expect(typeof off).toBe('function');

      off();
      expect(el.removeEventListener).toHaveBeenCalledWith('click', handler, {});
    });
  });

  // ===========================================================================
  // delegate() - Event delegation
  // ===========================================================================
  describe('delegate()', () => {
    it('attache un listener délégué', () => {
      const el = mockDocument.createElement('ul');

      delegate(el, 'click', 'li', jest.fn());

      expect(el.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('retourne une fonction pour retirer le listener', () => {
      const el = mockDocument.createElement('ul');
      const handler = jest.fn();

      const off = delegate(el, 'click', 'li', handler);

      expect(typeof off).toBe('function');
    });

    it('appelle le handler quand la cible matche le sélecteur', () => {
      const el = mockDocument.createElement('ul');
      const handler = jest.fn();

      delegate(el, 'click', 'li', handler);

      // Récupérer le handler délégué
      const delegatedHandler = el.addEventListener.mock.calls[0][1];

      // Simuler un clic sur un élément li
      const mockTarget = {
        closest: jest.fn(() => mockTarget),
      };
      const mockEvent = { target: mockTarget };

      delegatedHandler(mockEvent);

      expect(mockTarget.closest).toHaveBeenCalledWith('li');
      expect(handler).toHaveBeenCalledWith(mockTarget, mockEvent);
    });

    it('n\'appelle pas le handler si la cible ne matche pas', () => {
      const el = mockDocument.createElement('ul');
      const handler = jest.fn();

      delegate(el, 'click', 'li', handler);

      const delegatedHandler = el.addEventListener.mock.calls[0][1];

      const mockTarget = {
        closest: jest.fn(() => null), // Ne matche pas
      };
      const mockEvent = { target: mockTarget };

      delegatedHandler(mockEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // escapeHtml() - XSS prevention
  // ===========================================================================
  describe('escapeHtml()', () => {
    it('échappe les caractères < et >', () => {
      const result = escapeHtml('<script>alert("xss")</script>');

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('échappe les guillemets', () => {
      const result = escapeHtml('Hello "World" & \'Test\'');

      expect(result).toContain('&quot;');
      expect(result).toContain('&#039;');
      expect(result).toContain('&amp;');
    });

    it('retourne une chaîne vide pour les non-strings', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(42)).toBe('');
      expect(escapeHtml({})).toBe('');
    });

    it('préserve le texte normal', () => {
      const result = escapeHtml('Hello World');

      expect(result).toBe('Hello World');
    });

    it('gère les chaînes vides', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  // ===========================================================================
  // cloneTemplate() - Template cloning
  // ===========================================================================
  describe('cloneTemplate()', () => {
    it('clone le contenu d\'un template existant', () => {
      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => ({ cloned: true })),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockTemplate);

      const result = cloneTemplate('my-template');

      expect(mockDocument.getElementById).toHaveBeenCalledWith('my-template');
      expect(mockTemplate.content.cloneNode).toHaveBeenCalledWith(true);
      expect(result).toEqual({ cloned: true });
    });

    it('retourne un fragment vide si template non trouvé', () => {
      mockDocument.getElementById.mockReturnValue(null);

      const result = cloneTemplate('nonexistent');

      expect(console.warn).toHaveBeenCalledWith('Template #nonexistent introuvable');
      expect(mockDocument.createDocumentFragment).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // fillTemplate() - Template filling
  // ===========================================================================
  describe('fillTemplate()', () => {
    it('remplit le template avec les données texte', () => {
      const mockFragment = {
        querySelector: jest.fn((sel) => {
          if (sel === 'h3') {return { textContent: '' };}
          if (sel === 'p') {return { textContent: '' };}
          return null;
        }),
      };
      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockFragment),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockTemplate);

      fillTemplate('card', {
        'h3': 'Titre',
        'p': 'Description',
      });

      expect(mockFragment.querySelector).toHaveBeenCalledWith('h3');
      expect(mockFragment.querySelector).toHaveBeenCalledWith('p');
    });

    it('remplit le template avec des objets d\'attributs', () => {
      const mockImg = {
        setAttribute: jest.fn(),
      };
      const mockFragment = {
        querySelector: jest.fn((sel) => {
          if (sel === '.thumb') {return mockImg;}
          return null;
        }),
      };
      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockFragment),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockTemplate);

      fillTemplate('card', {
        '.thumb': { src: 'image.png', alt: 'Image' },
      });

      expect(mockImg.setAttribute).toHaveBeenCalledWith('src', 'image.png');
      expect(mockImg.setAttribute).toHaveBeenCalledWith('alt', 'Image');
    });

    it('gère textContent et innerHTML dans les objets', () => {
      const mockEl = {
        textContent: '',
        _innerHTML: '',
        className: '',
      };
      Object.defineProperty(mockEl, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) { this._innerHTML = value; },
      });

      const mockFragment = {
        querySelector: jest.fn(() => mockEl),
      };
      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockFragment),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockTemplate);

      fillTemplate('card', {
        '.content': { textContent: 'Text', innerHTML: '<b>Bold</b>', class: 'active' },
      });

      expect(mockEl.textContent).toBe('Text');
      expect(mockEl.innerHTML).toBe('<b>Bold</b>');
      expect(mockEl.className).toBe('active');
    });

    it('ignore les sélecteurs sans correspondance', () => {
      const mockFragment = {
        querySelector: jest.fn(() => null),
      };
      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockFragment),
        },
      };
      mockDocument.getElementById.mockReturnValue(mockTemplate);

      // Ne devrait pas lever d'erreur
      expect(() => fillTemplate('card', {
        '.nonexistent': 'Value',
      })).not.toThrow();
    });
  });

  // ===========================================================================
  // ready() - DOM ready helper
  // ===========================================================================
  describe('ready()', () => {
    it('exécute immédiatement si DOM déjà prêt', () => {
      mockDocument.readyState = 'complete';
      const fn = jest.fn();

      ready(fn);

      expect(fn).toHaveBeenCalled();
    });

    it('exécute immédiatement si DOM interactif', () => {
      mockDocument.readyState = 'interactive';
      const fn = jest.fn();

      ready(fn);

      expect(fn).toHaveBeenCalled();
    });

    it('attend DOMContentLoaded si DOM en chargement', () => {
      mockDocument.readyState = 'loading';
      const fn = jest.fn();

      ready(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', fn);
    });
  });

  // ===========================================================================
  // debounce() - Debounce helper
  // ===========================================================================
  describe('debounce()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('retarde l\'exécution de la fonction', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('annule les appels précédents si rappelé', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passe les arguments à la fonction', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('utilise le délai par défaut de 200ms', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn);

      debouncedFn();
      jest.advanceTimersByTime(199);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalled();
    });
  });
});
