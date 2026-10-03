/** @jest-environment jsdom */
/**
 * Tests des fonctions de transformation de données
 * flattenStructure, buildBreadcrumb, buildMenuHTML
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer } from '../../parcours-viewer.js';
import { createTestEpic } from './fixtures.js';

describe('ParcoursViewer - Structure', () => {
  let viewer;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ epics: [createTestEpic()] }),
    });
    viewer = new ParcoursViewer(document.getElementById('viewer'));
    await viewer.load('test-epic');
  });

  afterEach(() => {
    viewer.close();
    jest.restoreAllMocks();
    delete global.fetch;
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
  // buildBreadcrumb
  // =========================================================================
  describe('buildBreadcrumb()', () => {
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
      viewer.goTo(1);
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

    it('garde une icône vide pour les sections sans icône, comme le DOM réel', () => {
      const structure = [
        {
          type: 'section',
          id: 'no-icon',
          title: 'Sans icône',
          children: [],
        },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('aria-hidden="true"></span>');
    });

    it('garde une icône vide pour les slides sans icône, comme le DOM réel', () => {
      const structure = [
        { type: 'slide', id: 'no-icon', title: 'Sans icône' },
      ];
      const result = viewer.buildMenuHTML(structure);

      expect(result).toContain('aria-hidden="true"></span>');
    });
  });
});
