import { readFileSync, existsSync } from 'node:fs';
import { chapters, references, chapterTerms } from './chapters.js';
import { modelExperiments } from './model-experiments.js';
import { conceptExperiments } from './concept-experiments.js';
import { transformerExplainer } from './transformer-explainer.js';

const root = new URL('../', import.meta.url);
const epic = JSON.parse(readFileSync(new URL('epic.json', root), 'utf8'));

describe('Contrat éditorial du parcours', () => {
  test('vingt-deux étapes implémentées et deux annexes, sans catégorie inventée', () => {
    expect(chapters).toHaveLength(22);
    expect(new Set(chapters.map(c => c.id)).size).toBe(22);
    expect(epic.id).toBe('anatomie-llm');
    expect(epic.hierarchy).toEqual(['autres']);
    expect(epic.content.flatMap(item => item.content || [item])).toHaveLength(24);
    for (const c of chapters) {
      expect(typeof (modelExperiments[c.experiment] || conceptExperiments[c.experiment]
        || (c.experiment === 'transformerExplainer' && transformerExplainer))).toBe('function');
      expect(c.choices[c.answer]).toBeTruthy();
      expect(c.refs.every(id => Object.hasOwn(references, id))).toBe(true);
      expect(c.body.length).toBeGreaterThan(500);
      expect(c.caveat.length).toBeGreaterThan(60);
    }
  });
  test('les fichiers publiés correspondent à leurs sources éditoriales', () => {
    for (const c of chapters) {
      const html = readFileSync(new URL(`slides/${c.id}/index.html`, root), 'utf8');
      const metadata = JSON.parse(readFileSync(new URL(`slides/${c.id}/slide.json`, root), 'utf8'));
      expect(metadata.id).toBe(c.id);
      expect(html).toContain(c.body);
      expect(html).toContain(`data-experiment="${c.experiment}"`);
      expect(html).toContain('Lire la correction');
      expect(html).toContain('<noscript>');
      expect(html).toContain('Le vocabulaire de cette étape');
      expect(html.indexOf('class="explanation"')).toBeLessThan(html.indexOf('class="experiment"'));
      expect(chapterTerms[c.experiment].length).toBeGreaterThanOrEqual(3);
      expect(html).not.toMatch(/on(?:click|input|change)=/i);
      expect(html).not.toMatch(/<script[^>]+src="https?:/);
    }
  });
  test('les prérequis précèdent les mécanismes qu’ils expliquent', () => {
    const index = id => chapters.findIndex(chapter => chapter.id === id);
    for (const [before, after] of [['01-un-token', '01b-luciole'], ['01b-luciole', '02-tokenisation'], ['02-tokenisation', '02b-cas-reels'], ['03b-nombres', '04-embeddings'], ['06b-tetes', '07-attention'], ['07-attention', '06-position'], ['09b-scores', '10-tirage'], ['16-synthese', '16b-transformer-explainer']]) {
      expect(index(before)).toBeLessThan(index(after));
    }
    expect(chapters.at(-1).id).toBe('16b-transformer-explainer');
    expect(index('09b-scores')).toBeLessThan(index('09-logit-lens'));
  });
  test('les sources et le glossaire sont des pages statiques publiables', () => {
    for (const id of ['17-sources', '18-glossaire']) {
      expect(existsSync(new URL(`slides/${id}/index.html`, root))).toBe(true);
    }
    const glossary = JSON.parse(readFileSync(new URL('glossary.json', root), 'utf8'));
    expect(Object.keys(glossary.terms).length).toBeGreaterThanOrEqual(20);
    expect(existsSync(new URL(epic.thumbnail, root))).toBe(true);
  });
});
