/**
 * Tests unitaires pour parcours-utils.js
 * @see openspec/specs/parcours/spec.md
 */

import {
  extractSlideIds,
  countSlides,
  buildStructure,
  buildHierarchy,
  aggregateTags,
  buildFeatured,
  validateEpicFields,
  convertMarkdown,
  injectInTemplate,
} from './parcours-utils.js';

describe('parcours-utils', () => {

  // =========================================================================
  // extractSlideIds
  // =========================================================================
  describe('extractSlideIds()', () => {
    it('extrait les IDs de slides simples', () => {
      const content = [
        { id: '01-intro' },
        { id: '02-setup' },
        { id: '03-conclusion' },
      ];

      expect(extractSlideIds(content)).toEqual([
        '01-intro',
        '02-setup',
        '03-conclusion',
      ]);
    });

    it('extrait les IDs de slides dans les sections', () => {
      const content = [
        {
          id: 'section-1',
          title: 'Section 1',
          content: [
            { id: '01-slide' },
            { id: '02-slide' },
          ],
        },
        { id: '03-standalone' },
      ];

      expect(extractSlideIds(content)).toEqual([
        '01-slide',
        '02-slide',
        '03-standalone',
      ]);
    });

    it('gère les sections imbriquées', () => {
      const content = [
        {
          id: 'section-1',
          content: [
            {
              id: 'section-1-1',
              content: [
                { id: 'deep-slide' },
              ],
            },
          ],
        },
      ];

      expect(extractSlideIds(content)).toEqual(['deep-slide']);
    });

    it('retourne un tableau vide pour un contenu vide', () => {
      expect(extractSlideIds([])).toEqual([]);
    });

    it('ignore les éléments sans id ni content', () => {
      const content = [
        { id: '01-valid' },
        { title: 'invalid' },
        { id: '02-valid' },
      ];

      expect(extractSlideIds(content)).toEqual(['01-valid', '02-valid']);
    });
  });

  // =========================================================================
  // countSlides
  // =========================================================================
  describe('countSlides()', () => {
    it('compte les slides simples', () => {
      const content = [
        { id: '01' },
        { id: '02' },
        { id: '03' },
      ];

      expect(countSlides(content)).toEqual({ total: 3, optional: 0 });
    });

    it('compte les slides dans les sections', () => {
      const content = [
        {
          id: 'section',
          content: [
            { id: '01' },
            { id: '02' },
          ],
        },
        { id: '03' },
      ];

      expect(countSlides(content)).toEqual({ total: 3, optional: 0 });
    });

    it('compte les slides optionnelles', () => {
      const content = [
        { id: '01' },
        { id: '02', optional: true },
        { id: '03', optional: true },
      ];

      expect(countSlides(content)).toEqual({ total: 3, optional: 2 });
    });

    it('hérite le statut optionnel de la section parente', () => {
      const content = [
        {
          id: 'optional-section',
          optional: true,
          content: [
            { id: '01' },
            { id: '02' },
          ],
        },
        { id: '03' },
      ];

      expect(countSlides(content)).toEqual({ total: 3, optional: 2 });
    });

    it('une slide optionnelle dans une section optionnelle reste optionnelle', () => {
      const content = [
        {
          id: 'section',
          optional: true,
          content: [
            { id: '01', optional: true },
          ],
        },
      ];

      expect(countSlides(content)).toEqual({ total: 1, optional: 1 });
    });

    it('retourne 0 pour un contenu vide', () => {
      expect(countSlides([])).toEqual({ total: 0, optional: 0 });
    });
  });

  // =========================================================================
  // buildStructure
  // =========================================================================
  describe('buildStructure()', () => {
    it('construit la structure pour des slides simples', () => {
      const content = [
        { id: '01-intro' },
        { id: '02-setup' },
      ];

      const getSlideData = (id) => ({
        id,
        title: id === '01-intro' ? 'Introduction' : 'Setup',
      });

      const result = buildStructure(content, getSlideData);

      expect(result).toEqual([
        { type: 'slide', id: '01-intro', title: 'Introduction', icon: undefined, optional: undefined },
        { type: 'slide', id: '02-setup', title: 'Setup', icon: undefined, optional: undefined },
      ]);
    });

    it('construit la structure avec des sections', () => {
      const content = [
        {
          id: 'basics',
          title: 'Les bases',
          icon: '📚',
          content: [
            { id: '01-intro' },
          ],
        },
      ];

      const getSlideData = () => ({ title: 'Intro' });

      const result = buildStructure(content, getSlideData);

      expect(result).toEqual([
        {
          type: 'section',
          id: 'basics',
          title: 'Les bases',
          icon: '📚',
          optional: undefined,
          children: [
            { type: 'slide', id: '01-intro', title: 'Intro', icon: undefined, optional: undefined },
          ],
        },
      ]);
    });

    it('utilise l\'ID comme titre si getSlideData retourne null', () => {
      const content = [{ id: '01-test' }];
      const getSlideData = () => null;

      const result = buildStructure(content, getSlideData);

      expect(result[0].title).toBe('01-test');
    });

    it('préserve le flag optional', () => {
      const content = [
        { id: '01', optional: true },
      ];

      const result = buildStructure(content, () => ({ title: 'Test' }));

      expect(result[0].optional).toBe(true);
    });
  });

  // =========================================================================
  // buildHierarchy
  // =========================================================================
  describe('buildHierarchy()', () => {
    const baseConfig = {
      taxonomy: {
        threshold: 3,
        hierarchy: [
          { id: 'tutorials', label: 'Tutoriels', icon: '📖' },
          { id: 'guides', label: 'Guides', icon: '📘' },
          { id: 'autres', label: 'Autres', icon: '📁' },
        ],
      },
    };

    it('compte les epics par catégorie', () => {
      const epics = [
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['guides'], tags: [] },
      ];

      const result = buildHierarchy(epics, baseConfig);

      const tutorials = result.find(n => n.id === 'tutorials');
      expect(tutorials.count).toBe(3);
    });

    it('masque les catégories sous le threshold', () => {
      const epics = [
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['tutorials'], tags: [] },
        { hierarchy: ['guides'], tags: [] },
        { hierarchy: ['guides'], tags: [] },
      ];

      const result = buildHierarchy(epics, baseConfig);

      // tutorials a 3 epics (>= threshold) → visible
      // guides a 2 epics (< threshold) → non visible
      expect(result.find(n => n.id === 'tutorials')).toBeDefined();
      expect(result.find(n => n.id === 'guides')).toBeUndefined();
    });

    it('autres est toujours visible', () => {
      const epics = [];
      const result = buildHierarchy(epics, baseConfig);

      expect(result.find(n => n.id === 'autres')).toBeDefined();
    });

    it('absorbe les catégories sous le threshold dans autres', () => {
      const epics = [
        { hierarchy: ['guides'], tags: [] },
        { hierarchy: ['guides'], tags: [] },
      ];

      const result = buildHierarchy(epics, baseConfig);

      const autres = result.find(n => n.id === 'autres');
      expect(autres.count).toBe(2);
    });

    it('utilise la vignette du premier epic avec thumbnail', () => {
      const epics = [
        { hierarchy: ['tutorials'], tags: [], thumbnail: null },
        { hierarchy: ['tutorials'], tags: [], thumbnail: '/path/to/thumb.png' },
        { hierarchy: ['tutorials'], tags: [], thumbnail: '/other/thumb.png' },
      ];

      const result = buildHierarchy(epics, baseConfig);

      const tutorials = result.find(n => n.id === 'tutorials');
      expect(tutorials.thumbnail).toBe('/path/to/thumb.png');
    });
  });

  // =========================================================================
  // aggregateTags
  // =========================================================================
  describe('aggregateTags()', () => {
    it('compte les occurrences de chaque tag', () => {
      const epics = [
        { tags: ['javascript', 'beginner'] },
        { tags: ['javascript', 'advanced'] },
        { tags: ['python'] },
      ];

      const result = aggregateTags(epics, {});

      expect(result.find(t => t.id === 'javascript').count).toBe(2);
      expect(result.find(t => t.id === 'beginner').count).toBe(1);
      expect(result.find(t => t.id === 'python').count).toBe(1);
    });

    it('trie les tags par fréquence décroissante', () => {
      const epics = [
        { tags: ['rare'] },
        { tags: ['common', 'rare'] },
        { tags: ['common'] },
        { tags: ['common'] },
      ];

      const result = aggregateTags(epics, {});

      expect(result[0].id).toBe('common');
      expect(result[0].count).toBe(3);
      expect(result[1].id).toBe('rare');
      expect(result[1].count).toBe(2);
    });

    it('utilise les labels personnalisés', () => {
      const epics = [{ tags: ['js'] }];
      const config = {
        taxonomy: {
          tagLabels: { js: 'JavaScript' },
        },
      };

      const result = aggregateTags(epics, config);

      expect(result[0].label).toBe('JavaScript');
    });

    it('utilise l\'ID comme label par défaut', () => {
      const epics = [{ tags: ['unknown-tag'] }];

      const result = aggregateTags(epics, {});

      expect(result[0].label).toBe('unknown-tag');
    });

    it('retourne un tableau vide si aucun tag', () => {
      const epics = [{ tags: [] }, { tags: [] }];

      const result = aggregateTags(epics, {});

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // buildFeatured
  // =========================================================================
  describe('buildFeatured()', () => {
    const now = new Date('2025-06-15');

    it('retourne les epics récents', () => {
      const epics = [
        { id: 'recent', created: '2025-06-01', tags: [] },
        { id: 'old', created: '2024-01-01', tags: [] },
      ];

      const config = {
        featured: {
          showRecent: true,
          recentCount: 5,
          recentMonths: 6,
        },
      };

      const result = buildFeatured(epics, config, now);

      expect(result.recent.length).toBe(1);
      expect(result.recent[0].id).toBe('recent');
    });

    it('préfère updated à created pour le tri', () => {
      const epics = [
        { id: 'updated', created: '2025-01-01', updated: '2025-06-10', tags: [] },
        { id: 'new', created: '2025-06-05', tags: [] },
      ];

      const config = {
        featured: {
          showRecent: true,
          recentCount: 5,
          recentMonths: 6,
        },
      };

      const result = buildFeatured(epics, config, now);

      expect(result.recent[0].id).toBe('updated');
    });

    it('limite le nombre d\'epics récents', () => {
      const epics = Array.from({ length: 10 }, (_, i) => ({
        id: `epic-${i}`,
        created: '2025-06-01',
        tags: [],
      }));

      const config = {
        featured: {
          showRecent: true,
          recentCount: 3,
          recentMonths: 6,
        },
      };

      const result = buildFeatured(epics, config, now);

      expect(result.recent.length).toBe(3);
    });

    it('retourne un tableau vide si showRecent est false', () => {
      const epics = [{ id: 'test', created: '2025-06-01', tags: [] }];

      const result = buildFeatured(epics, { featured: { showRecent: false } }, now);

      expect(result.recent).toEqual([]);
    });

    it('retourne un tableau vide si config.featured est absent', () => {
      const result = buildFeatured([], {}, now);

      expect(result.recent).toEqual([]);
    });
  });

  // =========================================================================
  // validateEpicFields
  // =========================================================================
  describe('validateEpicFields()', () => {
    const validEpic = {
      id: 'test-epic',
      title: 'Test Epic',
      description: 'Description',
      hierarchy: ['tutorials'],
      tags: ['test'],
      metadata: {
        author: 'Test Author',
        created: '2025-01-01',
      },
      content: [],
    };

    it('valide un epic complet sans erreurs', () => {
      const result = validateEpicFields(validEpic);

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('détecte les champs requis manquants', () => {
      const epic = { id: 'test' };

      const result = validateEpicFields(epic);

      expect(result.errors).toContain('Champ requis manquant: title');
      expect(result.errors).toContain('Champ requis manquant: description');
      expect(result.errors).toContain('Champ requis manquant: hierarchy');
      expect(result.errors).toContain('Champ requis manquant: tags');
      expect(result.errors).toContain('Champ requis manquant: metadata');
      expect(result.errors).toContain('Champ requis manquant: content');
    });

    it('détecte metadata.author manquant', () => {
      const epic = {
        ...validEpic,
        metadata: { created: '2025-01-01' },
      };

      const result = validateEpicFields(epic);

      expect(result.errors).toContain('metadata.author requis');
    });

    it('détecte metadata.created manquant', () => {
      const epic = {
        ...validEpic,
        metadata: { author: 'Test' },
      };

      const result = validateEpicFields(epic);

      expect(result.errors).toContain('metadata.created requis');
    });
  });

  // =========================================================================
  // convertMarkdown
  // =========================================================================
  describe('convertMarkdown()', () => {
    it('convertit un titre H1', () => {
      const result = convertMarkdown('# Hello');

      expect(result).toContain('<h1>Hello</h1>');
    });

    it('convertit du texte en gras', () => {
      const result = convertMarkdown('**bold**');

      expect(result).toContain('<strong>bold</strong>');
    });

    it('convertit du texte en italique', () => {
      const result = convertMarkdown('*italic*');

      expect(result).toContain('<em>italic</em>');
    });

    it('convertit du code inline', () => {
      const result = convertMarkdown('`code`');

      expect(result).toContain('<code>code</code>');
    });

    it('convertit un bloc de code avec langage', () => {
      const result = convertMarkdown('```javascript\nconst x = 1;\n```');

      expect(result).toContain('class="language-javascript"');
      expect(result).toContain('const x = 1;');
    });

    it('convertit une liste non ordonnée', () => {
      const result = convertMarkdown('- item 1\n- item 2');

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item 1</li>');
    });

    it('convertit un tableau GFM', () => {
      const result = convertMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');

      expect(result).toContain('<table>');
      expect(result).toContain('<th>A</th>');
      expect(result).toContain('<td>1</td>');
    });
  });

  // =========================================================================
  // injectInTemplate
  // =========================================================================
  describe('injectInTemplate()', () => {
    it('injecte le titre et le contenu', () => {
      const template = '<title>{{TITLE}}</title><body>{{CONTENT}}</body>';

      const result = injectInTemplate(template, 'Mon Titre', '<p>Contenu</p>');

      expect(result).toBe('<title>Mon Titre</title><body><p>Contenu</p></body>');
    });

    it('préserve le template autour des placeholders', () => {
      const template = '<!DOCTYPE html><html>{{TITLE}} - {{CONTENT}}</html>';

      const result = injectInTemplate(template, 'T', 'C');

      expect(result).toBe('<!DOCTYPE html><html>T - C</html>');
    });

    it('gère les caractères spéciaux dans le titre', () => {
      const template = '{{TITLE}}';

      const result = injectInTemplate(template, 'Titre avec <script>', '');

      expect(result).toBe('Titre avec <script>');
    });
  });

});
