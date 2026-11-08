/**
 * Conformité CommonMark : exemples officiels de la spécification 0.31.2
 * (CC-BY-SA 4.0, John MacFarlane), recopiés dans fixtures/.
 */
import { readFileSync } from 'node:fs';
import { renderHtml } from '../src/render-html.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/commonmark-0.31.2.json', import.meta.url), 'utf8'));
/** Options qui reproduisent exactement la sortie de référence. */
const SPEC = { headingIds: false, tableWrapper: false, highlightCode: false };

describe('fixture CommonMark', () => {
  test('porte la source et la licence de la spécification', () => {
    expect(fixture.license).toMatch(/CC-BY-SA 4\.0/);
    expect(fixture.source).toMatch(/0\.31\.2/);
  });

  test('couvre un sous-ensemble significatif de chaque section non HTML', () => {
    const sections = new Set(fixture.examples.map((example) => example.section));
    expect(fixture.examples.length).toBeGreaterThan(550);
    for (const section of ['Tabs', 'Setext headings', 'Fenced code blocks', 'Block quotes', 'List items', 'Lists', 'Emphasis and strong emphasis', 'Links', 'Images', 'Link reference definitions', 'Entity and numeric character references']) {
      expect(sections).toContain(section);
    }
  });
});

describe.each(Array.from(new Set(fixture.examples.map((example) => example.section))))('%s', (section) => {
  const examples = fixture.examples.filter((example) => example.section === section);
  test.each(examples.map((example) => [example.example, example]))('exemple %i', (_number, example) => {
    expect(renderHtml(example.markdown, SPEC)).toBe(example.html);
  });
});

/**
 * Écarts volontaires avec la spécification, chacun justifié.
 */
describe('écarts volontaires', () => {
  test('HTML brut : affiché comme du texte, jamais interprété (ex. 21, 344, 475)', () => {
    expect(renderHtml('<a href="/bar\\/)">\n', SPEC)).toBe('<p>&lt;a href=&quot;/bar/)&quot;&gt;</p>\n');
    expect(renderHtml('*<img src="foo" title="*"/>\n', SPEC)).toBe('<p><em>&lt;img src=&quot;foo&quot; title=&quot;</em>&quot;/&gt;</p>\n');
  });

  test('schémas non autorisés : lien automatique neutralisé (ex. 596, 598, 601)', () => {
    const html = renderHtml('<irc://foo.bar:2233/baz>\n', SPEC);
    expect(html).not.toContain('href');
    expect(html).toContain('md-blocked');
  });

  test('liens automatiques étendus GFM actifs (ex. 611, 612)', () => {
    expect(renderHtml('https://example.com\n', SPEC)).toBe('<p><a href="https://example.com">https://example.com</a></p>\n');
    expect(renderHtml('foo@bar.example.com\n', SPEC)).toBe('<p><a href="mailto:foo@bar.example.com">foo@bar.example.com</a></p>\n');
  });
});
