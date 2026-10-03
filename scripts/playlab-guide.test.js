/**
 * Contrat du guide Playlab42 avec les ressources et le catalogue actuels.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSlideIds, validateEpicFields } from './parcours-utils.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const epicDir = resolve(root, 'parcours/epics/hello-playlab42');
const epic = JSON.parse(readFileSync(resolve(epicDir, 'epic.json'), 'utf8'));
const ids = [
  '01-bienvenue', '02-methodologies', '03-architecture',
  '04-creer-outil', '05-creer-jeu', '06-creer-bot',
  '08-specs-skills', '09-kit-contribution', '10-qualite-ci', '11-publication',
  '07-aller-plus-loin',
];
const historicalIds = [
  '01-bienvenue', '02-methodologies', '03-architecture',
  '04-creer-outil', '05-creer-jeu', '06-creer-bot', '07-aller-plus-loin',
];

describe('Playlab42 — Guide et usine logicielle', () => {
  it('garde les liens historiques et ajoute quatre étapes avant la conclusion', () => {
    expect(validateEpicFields(epic).errors).toEqual([]);
    expect(extractSlideIds(epic.content)).toEqual(ids);
    expect(ids.filter(id => historicalIds.includes(id))).toEqual(historicalIds);
    expect(epic.metadata.language).toBe('fr');
    expect(existsSync(resolve(epicDir, epic.thumbnail))).toBe(true);
  });

  it('annonce la somme des durées des onze étapes', () => {
    const duration = ids.reduce((total, id) => {
      const slide = JSON.parse(readFileSync(resolve(epicDir, 'slides', id, 'slide.json'), 'utf8'));
      expect(slide.duration).toMatch(/^\d+ min$/);
      return total + Number.parseInt(slide.duration, 10);
    }, 0);
    expect(duration).toBe(60);
    expect(epic.metadata.duration).toBe(`${duration} min`);
  });

  it('nomme uniquement les skills effectivement versionnés dans le dépôt', () => {
    const slides = ids.map(id => readFileSync(resolve(epicDir, 'slides', id, 'index.html'), 'utf8'));
    const skills = [
      'openspec-explore', 'openspec-propose', 'openspec-apply-change',
      'openspec-update-change', 'openspec-sync-specs', 'openspec-archive-change',
      ...readdirSync(resolve(root, '.github/skills')).filter(name => name.startsWith('playlab-')),
    ];
    for (const name of skills) {
      expect(slides.join('\n')).toContain(name);
      expect({ name, exists: existsSync(resolve(root, '.github/skills', name, 'SKILL.md')) })
        .toEqual({ name, exists: true });
    }
  });

  describe.each(ids)('Slide %s', id => {
    const path = resolve(epicDir, 'slides', id, 'index.html');

    it('déclare son identité et utilise le lecteur et le thème communs', () => {
      const html = readFileSync(path, 'utf8');
      const metadata = JSON.parse(readFileSync(resolve(dirname(path), 'slide.json'), 'utf8'));
      expect(metadata.id).toBe(id);
      expect(metadata.title).toBeTruthy();
      expect(html).toMatch(/<html\b[^>]*lang="fr"/);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toMatch(/<body\b[^>]*class="[^"]*\bplaylab-guide\b/);
      expect(html).toContain('../../playlab-guide.css');
      expect(html).toContain('_shared/slide-base.css');
      expect(html).toContain('_shared/slide-utils.js');
      expect(html).toContain('initSlide');
      expect(html).toContain('data-slide-footer');
      const identifiers = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
      expect(new Set(identifiers).size).toBe(identifiers.length);
    });

    it('référence des ressources locales existantes', () => {
      const html = readFileSync(path, 'utf8');
      const references = [
        ...html.matchAll(/\b(?:src|href)="([^"]+)"/g),
        ...html.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g),
      ];
      for (const [, reference] of references) {
        if (!reference.startsWith('.')) {continue;}
        const local = reference.split(/[?#]/)[0];
        const target = resolve(dirname(path), local);
        const generatedGuide = relative(resolve(root, 'docs/site'), target);
        const source = !generatedGuide.startsWith('..') && generatedGuide.endsWith('.html')
          ? resolve(root, 'docs', generatedGuide.replace(/\.html$/, '.md')) : target;
        expect({ reference, exists: existsSync(source) })
          .toEqual({ reference, exists: true });
      }
    });

    it('cite des chemins réels dans la documentation GitHub du projet', () => {
      const html = readFileSync(path, 'utf8');
      const sources = [...html.matchAll(
        /href="https:\/\/github\.com\/z4ppy\/playlab42\/(?:blob|tree)\/main\/([^"]+)"/g,
      )];
      for (const [, source] of sources) {
        const local = decodeURIComponent(source.split(/[?#]/)[0]);
        expect({ source, exists: existsSync(resolve(root, local)) })
          .toEqual({ source, exists: true });
      }
    });
  });
});
