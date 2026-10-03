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

  it('énumère dix ressources HTTP et ne les confond pas avec les checks GitHub', () => {
    const factory = readFileSync(resolve(root, 'docs/guides/software-factory.md'), 'utf8');
    const smokeSection = factory.split('### Identité et contrôle après publication')[1]
      .split('### Ce qui reste distinct')[0];
    const resources = [...smokeSection.matchAll(/^\| `([^`]+)` \|/gm)]
      .map(([, resource]) => resource);
    expect(resources).toEqual([
      'build-info.json', 'build-manifest.json', 'index.html', 'docs/site/index.html',
      'data/catalogue.json', 'data/parcours.json', 'data/bookmarks.json',
      'catalogue.tools[0].path', 'catalogue.games[0].path',
      '${epic.path}/slides/${slide.id}/index.html',
    ]);
    expect(resources).toHaveLength(10);
    expect(smokeSection).toMatch(/dix ressources HTTP/);
    expect(smokeSection).toMatch(/neuf checks GitHub\s+requis/);
    const publication = readFileSync(resolve(epicDir, 'slides/11-publication/index.html'), 'utf8');
    expect(publication).toContain('dix ressources HTTP');
    expect(publication).toContain('build-manifest.json');
    expect(publication).toContain('neuf checks GitHub requis');
    expect(publication).not.toMatch(/(?:neuf|9) ressources HTTP/);
  });

  it('distingue livraison du socle, correctifs locaux et preuves opérationnelles', () => {
    const factory = readFileSync(resolve(root, 'docs/guides/software-factory.md'), 'utf8');
    const quality = readFileSync(resolve(root, 'docs/guides/software-quality.md'), 'utf8');
    const operations = readFileSync(resolve(root, 'docs/guides/artifact-operations.md'), 'utf8');
    const readme = readFileSync(resolve(epicDir, 'README.md'), 'utf8');
    for (const document of [factory, quality, operations, readme]) {
      expect(document).toMatch(/intégrés? à `?main`? et publiés?/);
      expect(document).toContain('fix/review-software-factory');
    }
    expect(factory).toContain('Validation native constatée');
    expect(factory).toContain('Cette preuve datée concerne ce head');
    expect(factory).toContain('quality/tests-first');
    expect(operations).toMatch(/pas qu'un run planifié a été exécuté/);
    expect(operations).toContain('Cela prouve une reprise de fichiers locaux, pas une reprise Pages en production.');
    expect(operations).toContain('Le manifeste est **non signé**');
    expect(readme).toContain("l'archivage nécessite une autorisation distincte");
  });

  it('explique les tests avant refactoring sans confondre implémentation et livraison', () => {
    const quality = readFileSync(resolve(root, 'docs/guides/software-quality.md'), 'utf8');
    const slide = readFileSync(resolve(epicDir, 'slides/10-qualite-ci/index.html'), 'utf8');
    expect(quality).toContain('## Application tests-first');
    expect(quality).toContain('tests de comportement avant les refactorings');
    expect(quality).toContain('sans seuil global artificiel');
    expect(quality).toContain('non intégrés à main');
    expect(slide).toContain('Tests avant refactoring');
    expect(slide).toContain('une couverture élevée ne prouve pas la qualité des assertions');
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
