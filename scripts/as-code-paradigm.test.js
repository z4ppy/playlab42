/**
 * Contrat documentaire du parcours « Le Paradigme As-Code » : découpage en
 * étapes, gabarit commun des slides, liens externes sûrs et sources archivées.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSlideIds, validateEpicFields } from './parcours-utils.js';

const root = fileURLToPath(new URL('../parcours/epics/as-code-paradigm/', import.meta.url));
const readText = relative => readFileSync(join(root, relative), 'utf8');
const manifest = JSON.parse(readText('epic.json'));

const expectedSteps = [
  '01-introduction', '02-histoire', '03-infrastructure', '04-gitops', '05-galaxie',
  '06-catalog', '07-bilan', '08-tendances', '09-sources', '10-glossaire',
];

const steps = expectedSteps.map(id => ({
  id,
  meta: JSON.parse(readText(`slides/${id}/slide.json`)),
  html: readText(`slides/${id}/index.html`),
}));

/** Toutes les URL absolues du parcours : favoris du manifeste et liens des slides. */
function absoluteUrls() {
  const fromSlides = steps.flatMap(({ html }) => [...html.matchAll(/href="(https?:[^"]+)"/g)].map(match => match[1]));
  return [...manifest.bookmarks.map(bookmark => bookmark.url), ...fromSlides];
}

describe('Parcours Le Paradigme As-Code', () => {
  test('découpe le contenu en dix étapes réparties en trois sections', () => {
    expect(validateEpicFields(manifest).errors).toEqual([]);
    expect(extractSlideIds(manifest.content)).toEqual(expectedSteps);
    expect(manifest.content.map(section => section.id)).toEqual(['origines', 'pratiques', 'bilan']);
    expect(manifest.hierarchy).toEqual(['playlab42']);
  });

  test('annonce une durée égale à la somme des étapes', () => {
    let minutes = 0;
    for (const { meta } of steps) {
      expect(meta.duration).toMatch(/^[1-9]\d* min$/);
      minutes += Number.parseInt(meta.duration, 10);
    }
    expect(manifest.metadata.duration).toBe(`${minutes} min`);
  });

  test('ne garde que le glossaire comme étape facultative', () => {
    const optional = steps.filter(({ meta }) => meta.optional).map(({ id }) => id);
    expect(optional).toEqual(['10-glossaire']);
    expect(steps.every(({ meta }) => meta.type === 'page')).toBe(true);
    expect(steps.every(({ id, meta }) => meta.id === id && meta.title !== manifest.title)).toBe(true);
  });

  test.each(expectedSteps)('%s suit le gabarit commun sans ressource distante', id => {
    const { html } = steps.find(step => step.id === id);
    expect(html).toContain('<article class="slide">');
    expect(html).toContain('lib/theme.css');
    expect(html).toContain('_shared/slide-base.css');
    const assets = [...html.matchAll(/<(?:link|script)\b[^>]*>/g)].map(match => match[0]);
    expect(assets.filter(tag => /(?:href|src)="https?:/.test(tag))).toEqual([]);
    expect(html).not.toMatch(/\sstyle="/);
  });

  test('protège chaque lien ouvert dans un nouvel onglet', () => {
    const unsafe = steps.flatMap(({ id, html }) => [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)]
      .filter(match => !/rel="noopener noreferrer"/.test(match[0]))
      .map(match => `${id}: ${match[0]}`));
    expect(unsafe).toEqual([]);
  });

  test('ne cite le site disparu de Weaveworks que par son archive', () => {
    const direct = absoluteUrls().filter(url => url.includes('weave.works/') && !url.startsWith('https://web.archive.org/'));
    expect(direct).toEqual([]);
  });

  test('fait pointer chaque appel de note vers une source existante', () => {
    const sources = new Set([...steps.at(8).html.matchAll(/<li id="(src-\d+)"/g)].map(match => match[1]));
    const calls = steps.flatMap(({ html }) => [...html.matchAll(/09-sources\/index\.html#(src-\d+)/g)].map(match => match[1]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter(anchor => !sources.has(anchor))).toEqual([]);
  });
});
