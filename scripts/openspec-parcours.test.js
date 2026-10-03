/**
 * Vérifie le contrat des slides OpenSpec avec le catalogue et le lecteur.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSlideIds, validateEpicFields } from './parcours-utils.js';

const epicDir = fileURLToPath(new URL('../parcours/epics/openspec-usage-guide/', import.meta.url));
const epic = JSON.parse(readFileSync(resolve(epicDir, 'epic.json'), 'utf8'));
const slideIds = [
  '00-presentation',
  '01-introduction',
  '02-workflow',
  '03-creer-proposal',
  '04-implementer',
  '05-archiver',
  '06-bonnes-pratiques',
];

describe('Parcours OpenSpec / OPSX', () => {
  it('préserve les identifiants et l’ordre de progression du parcours', () => {
    expect(extractSlideIds(epic.content)).toEqual(slideIds);
    expect(validateEpicFields(epic).errors).toEqual([]);
    expect(epic.metadata.language).toBe('fr');
    expect(existsSync(resolve(epicDir, epic.thumbnail))).toBe(true);
  });

  it('référence la documentation de la version publiée', () => {
    const sources = epic.bookmarks.filter(({ url }) => url.includes('Fission-AI/OpenSpec'));
    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(sources.every(({ url }) => url.includes('/v1.14.0/'))).toBe(true);
  });

  it('annonce une durée cohérente avec les sept étapes', () => {
    const duration = slideIds.reduce((total, id) => {
      const slide = JSON.parse(readFileSync(resolve(epicDir, 'slides', id, 'slide.json'), 'utf8'));
      expect(slide.duration).toMatch(/^\d+ min$/);
      return total + Number.parseInt(slide.duration, 10);
    }, 0);
    expect(epic.metadata.duration).toBe(`${duration} min`);
    const presentation = readFileSync(resolve(epicDir, 'slides/00-presentation/index.html'), 'utf8');
    expect(presentation).toContain(`${duration} minutes`);
  });

  it('utilise les marqueurs normatifs reconnus par le validateur dans le delta illustratif', () => {
    const proposal = readFileSync(resolve(epicDir, 'slides/03-creer-proposal/index.html'), 'utf8');
    const delta = proposal.match(/<pre><code>(# Delta[\s\S]*?)<\/code><\/pre>/)?.[1];
    expect(delta).toBeDefined();
    expect(delta).toMatch(/### Requirement:.*\n[^\n]*\b(?:SHALL|MUST)\b/);
    expect(delta).toContain('#### Scenario:');
    expect(delta).toContain('## ADDED Requirements');
  });

  describe.each(slideIds)('Slide %s', (id) => {
    const htmlPath = resolve(epicDir, 'slides', id, 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    const metadata = JSON.parse(readFileSync(resolve(dirname(htmlPath), 'slide.json'), 'utf8'));

    it('conserve les métadonnées et une structure accessible en français', () => {
      expect(metadata.id).toBe(id);
      expect(metadata.title.length).toBeGreaterThan(0);
      expect(html).toMatch(/<html\b[^>]*lang="fr"/);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toMatch(/<meta\b[^>]*name="viewport"/);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('charge les améliorations locales et les utilitaires partagés', () => {
      expect(html).toMatch(/<body\b[^>]*class="[^"]*\bopenspec-guide\b/);
      expect(html).toContain('../../openspec-guide.css');
      expect(html).toContain('../../openspec-guide.js');
      expect(html).toContain('_shared/slide-base.css');
      expect(html).toContain('_shared/slide-utils.js');
      expect(html).toContain('initSlide');
      expect(html).toContain('data-slide-footer');
    });

    it('ne contient aucune ressource locale manquante', () => {
      const attributes = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)];
      const moduleImports = [...html.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)];
      for (const [, reference] of [...attributes, ...moduleImports]) {
        if (!reference.startsWith('.')) {continue;}
        const path = reference.split(/[?#]/)[0];
        expect({ reference, exists: existsSync(resolve(dirname(htmlPath), path)) })
          .toEqual({ reference, exists: true });
      }
    });

    it('protège les liens ouverts dans une nouvelle fenêtre', () => {
      for (const [link] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        expect(link).toMatch(/\brel="[^"]*\bnoopener\b/);
      }
    });
  });
});
