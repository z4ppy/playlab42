/**
 * Contrat éditorial du parcours « Histoire des LLM ».
 *
 * Vérifie ce qu'une relecture humaine oublie facilement : chaque slide charge
 * les styles partagés, cite ses sources, n'utilise ni style en ligne ni
 * gestionnaire d'événement inline, et chaque portrait est crédité sous une
 * licence libre.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const epic = JSON.parse(read('epic.json'));
const glossary = JSON.parse(read('glossary.json')).terms;
const credits = JSON.parse(read('assets/portraits/credits.json'));

const leaves = epic.content.flatMap(item => item.content || [item]);
const pages = leaves.map(leaf => ({ ...leaf, html: read(`slides/${leaf.id}/index.html`) }));
const contentPages = pages.filter(page => page.type !== 'glossary' && page.id !== '17-sources');

// Licences libres acceptées, avec la variante nationale éventuelle (ex. « CC BY-SA 2.0 de »).
const ALLOWED_LICENSES = /^(Domaine public|CC0( 1\.0)?|CC BY(-SA)? [1-4]\.0( [a-z]{2})?)$/;

describe('Structure du parcours', () => {
  test('chaque feuille du manifeste correspond à une slide existante', () => {
    for (const leaf of leaves) {
      const meta = JSON.parse(read(`slides/${leaf.id}/slide.json`));
      expect(meta.id).toBe(leaf.id);
      expect(meta.title.length).toBeGreaterThan(3);
    }
  });

  test('aucun dossier de slide orphelin', () => {
    const folders = readdirSync(new URL('slides/', root));
    expect(folders.sort()).toEqual(leaves.map(leaf => leaf.id).sort());
  });

  test('la durée annoncée correspond à la somme des slides', () => {
    const total = leaves
      .map(leaf => JSON.parse(read(`slides/${leaf.id}/slide.json`)).duration)
      .filter(Boolean)
      .reduce((sum, duration) => sum + Number.parseInt(duration, 10), 0);
    expect(epic.metadata.duration).toBe(`${total} min`);
  });

  test('catégorie existante, auteur renseigné et vignette présente', () => {
    expect(epic.hierarchy).toEqual(['autres']);
    expect(epic.metadata.author).toBe('Cyrille');
    expect(existsSync(new URL(epic.thumbnail, root))).toBe(true);
  });
});

describe('Conventions HTML des slides', () => {
  test.each(pages.map(page => [page.id, page.html]))('%s charge les styles partagés, sans style ni script en ligne', (id, html) => {
    expect(html).toContain('href="../../../../../lib/theme.css"');
    expect(html).toContain('href="../../../../_shared/slide-base.css"');
    expect(html).toContain('href="../../_shared/history.css"');
    expect(html).toContain('<article class="slide">');
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\sstyle="/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/<script[^>]+src="https?:/i);
    // L'iframe du viewer n'autorise pas les formulaires (sandbox sans allow-forms).
    expect(html).not.toMatch(/type="submit"/i);
  });

  test.each(pages.map(page => [page.id, page.html]))('%s : liens externes ouverts dans un nouvel onglet, sans fuite d’opener', (id, html) => {
    const external = html.match(/<a [^>]*href="https?:[^>]*>/g) || [];
    for (const anchor of external) {
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toContain('rel="noopener noreferrer"');
    }
  });

  test.each(pages.map(page => [page.id, page.html]))('%s : les SVG n’ont pas de couleur codée en dur', (id, html) => {
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
    for (const svg of svgs) {
      expect(svg).not.toMatch(/(fill|stroke)="#/);
      expect(svg).toMatch(/role="img"/);
      expect(svg).toMatch(/<title id=/);
      expect(svg).toMatch(/<desc id=/);
    }
  });

  test.each(pages.map(page => [page.id, page.html]))('%s : images présentes sur disque et décrites', (id, html) => {
    for (const [, src] of html.matchAll(/<img [^>]*src="([^"]+)"/g)) {
      expect(existsSync(new URL(`slides/${id}/${src}`, root))).toBe(true);
    }
    for (const tag of html.match(/<img [^>]*>/g) || []) {
      expect(tag).toMatch(/\salt="/);
    }
  });
});

describe('Rigueur éditoriale', () => {
  test.each(contentPages.map(page => [page.id, page.html]))('%s cite ses sources', (id, html) => {
    const sources = html.match(/<details class="page-sources">[\s\S]*?<\/details>/);
    expect(sources).not.toBeNull();
    if (id !== '16-lecons') {
      expect((sources[0].match(/href="https:/g) || []).length).toBeGreaterThanOrEqual(1);
    }
  });

  test.each(contentPages.map(page => [page.id, page.html]))('%s : chaque question de quiz a une seule bonne réponse et une explication', (id, html) => {
    const fieldsets = html.match(/<fieldset>[\s\S]*?<\/fieldset>/g) || [];
    // L'introduction et la synthèse (frise) n'ont pas de quiz à choix.
    if (!['01-introduction', '16-lecons'].includes(id)) {
      expect(fieldsets.length).toBeGreaterThanOrEqual(2);
    }
    for (const fieldset of fieldsets) {
      expect((fieldset.match(/data-correct/g) || []).length).toBe(1);
      expect(fieldset).toContain('class="explain" hidden');
    }
  });

  test('chaque terme marqué <dfn> est défini dans le glossaire', () => {
    for (const page of pages) {
      for (const [, attrs, text] of page.html.matchAll(/<dfn([^>]*)>([^<]*)<\/dfn>/g)) {
        const term = (attrs.match(/data-term="([^"]+)"/)?.[1] || text).toLowerCase().trim();
        expect({ page: page.id, term, defined: Object.hasOwn(glossary, term) })
          .toEqual({ page: page.id, term, defined: true });
      }
    }
  });

  test('la frise à reconstituer a des identifiants uniques et des dates croissantes', () => {
    const html = pages.find(page => page.id === '16-lecons').html;
    const items = [...html.matchAll(/<li data-id="([^"]+)">[\s\S]*?<span class="date">(\d{4})<\/span><\/li>/g)];
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(new Set(items.map(([, id]) => id)).size).toBe(items.length);
    const years = items.map(([, , year]) => Number(year));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});

describe('Portraits sous licence libre', () => {
  const usedPortraits = new Set(
    pages.flatMap(page => [...page.html.matchAll(/assets\/portraits\/([a-z0-9-]+\.jpg)/g)].map(match => match[1])),
  );

  test('chaque portrait crédité existe, est utilisé et porte une licence libre', () => {
    expect(credits.length).toBeGreaterThan(0);
    for (const credit of credits) {
      expect(existsSync(new URL(`assets/portraits/${credit.file}`, root))).toBe(true);
      expect(usedPortraits.has(credit.file)).toBe(true);
      expect(credit.license).toMatch(ALLOWED_LICENSES);
      expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(credit.author.length).toBeGreaterThan(0);
    }
  });

  test('chaque portrait affiché est crédité et le dossier ne contient rien d’autre', () => {
    const files = new Set(credits.map(credit => credit.file));
    for (const file of usedPortraits) {
      expect(files.has(file)).toBe(true);
    }
    const onDisk = readdirSync(new URL('assets/portraits/', root)).filter(name => name.endsWith('.jpg'));
    expect(onDisk.sort()).toEqual([...files].sort());
  });

  test('la page Sources liste tous les crédits', () => {
    const sources = pages.find(page => page.id === '17-sources').html;
    for (const credit of credits) {
      expect(sources).toContain(credit.sourceUrl);
    }
  });

  test('aucun marqueur de portraits non généré ne subsiste', () => {
    for (const page of pages) {
      expect(page.html).not.toMatch(/data-people="/);
    }
  });
});
