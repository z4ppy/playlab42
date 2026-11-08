/**
 * Parseur : AST public, lignes source, robustesse et performances.
 */
import { parse } from '../src/parser/index.js';
import { renderHtml, renderTree, toHtml } from '../src/render-html.js';
import { inlineText, walk } from '../src/parser/ast.js';
import { decodeEntity } from '../src/parser/entities.js';
import { MAX_NESTING } from '../src/parser/blocks.js';

describe('AST', () => {
  test('forme des nœuds de blocs et lignes source', () => {
    const doc = parse('# T\n\n- a\n- b\n\n> q\n\n```js\nx\n```\n\n---\n');
    expect(doc.children.map((node) => [node.type, node.line, node.endLine])).toEqual([
      ['heading', 1, 1], ['list', 3, 4], ['blockquote', 6, 6], ['code_block', 8, 10], ['thematic_break', 12, 12],
    ]);
    const [heading, list, , code] = doc.children;
    expect(heading).toMatchObject({ level: 1, children: [{ type: 'text', literal: 'T' }] });
    expect(list).toMatchObject({ ordered: false, tight: true, start: 1 });
    expect(code).toMatchObject({ info: 'js', literal: 'x\n' });
    expect(JSON.stringify(doc)).not.toContain('parent');
  });

  test('liste ordonnée, départ et liste lâche', () => {
    const list = parse('3. a\n\n4. b\n').children[0];
    expect(list).toMatchObject({ ordered: true, start: 3, tight: false });
  });

  test('walk et inlineText', () => {
    const types = [];
    walk(parse('a *b* [c](d) ![e](f)'), (node) => types.push(node.type));
    expect(types).toEqual(['document', 'paragraph', 'text', 'emph', 'text', 'text', 'link', 'text', 'text', 'image', 'text']);
    expect(inlineText(parse('a *b*  \nc `d`').children[0].children)).toBe('a b c d');
    expect(inlineText(undefined)).toBe('');
  });

  test('entrées diverses : CRLF, CR, NUL, vide', () => {
    expect(renderHtml('a\r\nb\rc')).toBe('<p>a\nb\nc</p>\n');
    expect(renderHtml(`a${String.fromCharCode(0)}b`)).toBe('<p>a�b</p>\n'.replace('\\uFFFD', String.fromCharCode(0xFFFD)));
    expect(renderHtml('')).toBe('');
    expect(parse(undefined).children).toEqual([]);
  });

  test('entités numériques invalides', () => {
    const replacement = String.fromCharCode(0xFFFD);
    expect(decodeEntity('&#0;')).toBe(replacement);
    expect(decodeEntity('&#xD800;')).toBe(replacement);
    expect(decodeEntity('&#x110000;')).toBe(replacement);
    expect(decodeEntity('&eacute;')).toBe('é');
    expect(decodeEntity('&inconnu;')).toBeNull();
  });
});

describe('rendu', () => {
  test('attributs data-line pour l\'aperçu, omis à la sérialisation de clé', () => {
    const tree = renderTree(parse('a\n\n- [ ] b\n'), { sourceLines: true });
    expect(toHtml(tree)).toContain('<p data-line="1">a</p>');
    expect(toHtml(tree)).toContain('<li data-line="3" class="task-list-item">');
    expect(toHtml(tree, { skipLines: true })).not.toContain('data-line');
  });

  test('liste ordonnée avec départ et images avec titre', () => {
    expect(renderHtml('7. a')).toBe('<ol start="7">\n<li>a</li>\n</ol>\n');
    expect(renderHtml('![alt *x*](/i.png "t")')).toBe('<p><img src="/i.png" alt="alt x" title="t" /></p>\n');
  });
});

describe('robustesse et performances', () => {
  test('imbrication limitée : les marqueurs au-delà restent du texte', () => {
    let depth = 0;
    let node = parse(`${'> '.repeat(MAX_NESTING + 10)}fin`);
    while (node.children?.[0]?.type === 'blockquote') {
      depth += 1;
      node = node.children[0];
    }
    expect(depth).toBe(MAX_NESTING);
    const rest = inlineText(node.children[0].children);
    expect(rest.startsWith('>')).toBe(true);
    expect(rest.endsWith('fin')).toBe(true);
  });

  test('parenthèses de destination : 32 niveaux acceptés, au-delà du texte', () => {
    const nested = (depth) => `[a](${'('.repeat(depth)}x${')'.repeat(depth)})`;
    expect(renderHtml(nested(32))).toContain(`href="${'('.repeat(32)}x${')'.repeat(32)}"`);
    expect(renderHtml(nested(33))).not.toContain('href');
  });

  test.each([
    ['crochets ouvrants', '['.repeat(20000)],
    ['emphases non fermées', '*a '.repeat(20000)],
    ['emphases alternées', '*_'.repeat(20000)],
    ['backticks de longueurs variées', Array.from({ length: 2000 }, (_, i) => '`'.repeat((i % 50) + 1)).join('x')],
    ['citations imbriquées', `${'>'.repeat(5000)} a`],
    ['listes imbriquées', Array.from({ length: 500 }, (_, i) => `${'  '.repeat(i)}- a`).join('\n')],
    ['liens imbriqués', `${'[a]('.repeat(5000)}`],
    ['emphases profondément imbriquées', `${'*'.repeat(20000)}a${'*'.repeat(20000)}`],
    ['images imbriquées', `${'!['.repeat(5000)}a${'](x)'.repeat(5000)}`],
    ['emphases mêlées', `${'*a _'.repeat(5000)}b${'_ a*'.repeat(5000)}`],
  ])('entrée pathologique : %s', (_name, input) => {
    const started = Date.now();
    expect(typeof renderHtml(input)).toBe('string');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  // Non-régression : l'index des backticks consommait sa liste par shift(),
  // ce qui rendait un paragraphe truffé de code en ligne quadratique
  // (40 000 code spans : plus de 3 s, 80 000 : plus de 11 s).
  test.each([
    ['code en ligne en série', '`a` '.repeat(40000), 40000],
    ['backticks collés', '`a'.repeat(100000), 50000],
  ])('code en ligne en masse dans un seul paragraphe : %s', (_name, input, spans) => {
    const started = Date.now();
    const doc = parse(input);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].children.filter((node) => node.type === 'code')).toHaveLength(spans);
  });

  test('index des backticks : une suite plus courte ou plus longue ne ferme pas le code', () => {
    expect(renderHtml('``a` b ``` c`` d `e`')).toBe('<p><code>a` b ``` c</code> d <code>e</code></p>\n');
  });

  test('document de 5 000 lignes analysé et rendu en un temps raisonnable', () => {
    const section = (i) => `## Section ${i}\n\nDu **texte** avec un [lien](https://x.org/${i}) et \`code\`.\n- a\n- [ ] b`;
    const big = Array.from({ length: 1000 }, (_, i) => section(i)).join('\n');
    expect(big.split('\n')).toHaveLength(5000);
    const started = Date.now();
    const html = renderHtml(big);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(html.match(/<h2/g)).toHaveLength(1000);
  });
});
