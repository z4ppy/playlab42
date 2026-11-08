/**
 * Table des matières, statistiques et coloration syntaxique.
 */
import { parse } from '../src/parser/index.js';
import { renderHtml } from '../src/render-html.js';
import { Slugger, buildToc, nestToc, slugify } from '../src/toc.js';
import { computeStats, countWords, formatStats, plainText } from '../src/stats.js';
import { highlight, resolveLanguage } from '../src/highlight.js';

describe('ancres et sommaire', () => {
  test.each([
    ['Bonjour le monde', 'bonjour-le-monde'],
    ['Éditeur Markdown !', 'éditeur-markdown-'],
    ['  API `v2` (bêta)  ', 'api-v2-bêta'],
    ['C\'est l\'été', 'cest-lété'],
    ['snake_case & co', 'snake_case--co'],
  ])('slugify(%j)', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  test('doublons numérotés comme sur GitHub, sans collision', () => {
    const slugger = new Slugger();
    expect(['A', 'A', 'A-1', 'A', '', '!!'].map((text) => slugger.slug(text))).toEqual(['a', 'a-1', 'a-1-1', 'a-2', 'section', 'section-1']);
  });

  test('buildToc : texte brut, niveaux, lignes et titres imbriqués', () => {
    const doc = parse('# Un *titre*\n\ntexte\n\n## Sous\n\n> ### Cité\n\nSetext\n---\n');
    expect(buildToc(doc)).toEqual([
      { level: 1, text: 'Un titre', id: 'un-titre', line: 1 },
      { level: 2, text: 'Sous', id: 'sous', line: 5 },
      { level: 3, text: 'Cité', id: 'cité', line: 7 },
      { level: 2, text: 'Setext', id: 'setext', line: 9 },
    ]);
  });

  test('les id rendus correspondent au sommaire (ancres stables)', () => {
    const markdown = '# Intro\n\n## Intro\n\n[aller](#intro-1)\n';
    const html = renderHtml(markdown, { idPrefix: 'md-' });
    expect(html).toContain('<h1 id="md-intro">');
    expect(html).toContain('<h2 id="md-intro-1">');
    expect(buildToc(parse(markdown)).map((entry) => entry.id)).toEqual(['intro', 'intro-1']);
  });

  test('nestToc tolère les sauts de niveau', () => {
    const tree = nestToc([
      { level: 2, text: 'a', id: 'a', line: 1 },
      { level: 4, text: 'b', id: 'b', line: 2 },
      { level: 3, text: 'c', id: 'c', line: 3 },
      { level: 1, text: 'd', id: 'd', line: 4 },
    ]);
    expect(tree.map((node) => [node.id, node.children.map((child) => child.id)])).toEqual([['a', ['b', 'c']], ['d', []]]);
  });
});

describe('statistiques', () => {
  test('mots du texte rendu, pas de la syntaxe ni des URL', () => {
    const source = '# Titre\n\nUn [lien](https://exemple.org/très/long) et **gras** l\'été.\n\n| a b | c |\n| - | - |\n| d | e |\n\n```\ncode ici\n```\n';
    const stats = computeStats(source, parse(source));
    // Titre, Un, lien, et, gras, l'été + a, b, c, d, e + code, ici.
    expect(stats.words).toBe(13);
    expect(stats.lines).toBe(12);
    expect(stats.readingMinutes).toBe(1);
  });

  test('caractères en points de code, temps de lecture arrondi', () => {
    const source = `${'mot '.repeat(700)}😀`;
    const stats = computeStats(source, parse(source));
    expect(stats.characters).toBe(2801);
    expect(stats.readingMinutes).toBe(3);
    expect(computeStats('', parse(''))).toEqual({ words: 0, characters: 0, lines: 0, readingMinutes: 0 });
  });

  test('countWords et plainText', () => {
    expect(countWords('aujourd’hui, vingt-deux 42 fois')).toBe(4);
    expect(plainText(parse('a  \nb'))).toBe('a b');
  });

  test('formatStats en français', () => {
    expect(formatStats({ words: 1234, characters: 1, lines: 1, readingMinutes: 6 })).toMatch(/^1\s234 mots · 1 caractère · 6 min de lecture$/);
    expect(formatStats({ words: 0, characters: 0, lines: 0, readingMinutes: 0 })).toBe('0 mot · 0 caractère · 0 min');
  });
});

describe('coloration syntaxique', () => {
  const types = (code, language) => highlight(code, language).filter((token) => token.type).map((token) => `${token.type}:${token.text}`);

  test('les jetons recomposent exactement le code', () => {
    const code = 'const a = "x"; // fin\n<div class="b">&amp;</div>';
    for (const language of ['js', 'json', 'html', 'css', 'bash']) {
      expect(highlight(code, language).map((token) => token.text).join('')).toBe(code);
    }
  });

  test('JavaScript', () => {
    expect(types('const n = 0x1F; // note\nfoo(`t`, null)', 'javascript')).toEqual([
      'keyword:const', 'number:0x1F', 'comment:// note', 'function:foo', 'string:`t`', 'literal:null',
    ]);
    expect(types('constant', 'js')).toEqual([]);
  });

  test('JSON', () => {
    expect(types('{"a": [1.5e3, true, "x"]}', 'json')).toEqual(['property:"a"', 'number:1.5e3', 'literal:true', 'string:"x"']);
  });

  test('HTML', () => {
    expect(types('<!DOCTYPE html><!-- c --><a href="x">&eacute;</a>', 'html')).toEqual([
      'keyword:<!DOCTYPE html>', 'comment:<!-- c -->', 'tag:<a', 'attr:href', 'string:"x"', 'tag:>', 'literal:&eacute;', 'tag:</a', 'tag:>',
    ]);
  });

  test('CSS', () => {
    expect(types('@media print { a:hover { color: #fff !important; margin: 2px; } }', 'css')).toEqual([
      'keyword:@media', 'property:color', 'number:#fff', 'keyword:!important', 'property:margin', 'number:2px',
    ]);
  });

  test('Bash', () => {
    expect(types('# c\nexport A="$HOME" && npm run build --watch 2', 'sh')).toEqual([
      'comment:# c', 'keyword:export', 'string:"$HOME"', 'function:npm', 'attr:--watch', 'number:2',
    ]);
  });

  test('langage inconnu : pas de coloration', () => {
    expect(highlight('x', 'cobol')).toBeNull();
    expect(resolveLanguage('TS')).toBe('js');
    expect(renderHtml('```cobol\nMOVE\n```\n')).toBe('<pre><code class="language-cobol">MOVE\n</code></pre>\n');
  });

  test('rendu : jetons échappés dans des span', () => {
    expect(renderHtml('```html\n<b>\n```\n')).toBe('<pre><code class="language-html"><span class="tok-tag">&lt;b</span><span class="tok-tag">&gt;</span>\n</code></pre>\n');
  });
});
