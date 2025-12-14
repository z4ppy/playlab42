/**
 * Tests unitaires pour parcours-viewer.js
 * Tests des fonctions pures (sans DOM)
 */

import { ParcoursViewer } from './parcours-viewer.js';

describe('ParcoursViewer', () => {

  // =========================================================================
  // flattenStructure
  // =========================================================================
  describe('flattenStructure()', () => {
    // Créer une instance minimale pour accéder à la méthode
    let viewer;

    beforeEach(() => {
      // Mock du container avec une API minimale
      const mockContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      viewer = new ParcoursViewer(mockContainer);
    });

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

});
