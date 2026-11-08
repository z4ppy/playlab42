/**
 * Extensions GFM : tableaux, listes de tâches, barré, liens automatiques étendus.
 */
import { parse } from '../src/parser/index.js';
import { renderHtml } from '../src/render-html.js';
import { parseDelimiterRow, splitTableRow } from '../src/parser/table.js';
import { trimAutolink } from '../src/parser/autolink.js';

const html = (markdown) => renderHtml(markdown, { headingIds: false, tableWrapper: false, highlightCode: false });

describe('tableaux', () => {
  test('en-tête, alignements et corps', () => {
    expect(html('| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n')).toBe(
      '<table>\n<thead>\n<tr>\n<th align="left">a</th>\n<th align="center">b</th>\n<th align="right">c</th>\n</tr>\n</thead>\n'
      + '<tbody>\n<tr>\n<td align="left">1</td>\n<td align="center">2</td>\n<td align="right">3</td>\n</tr>\n</tbody>\n</table>\n',
    );
  });

  test('barres de bordure facultatives et éléments en ligne dans les cellules', () => {
    expect(html('a | b\n--|--\n**x** | `y`\n')).toContain('<td><strong>x</strong></td>\n<td><code>y</code></td>');
  });

  test('barre échappée, y compris dans du code', () => {
    expect(html('| a |\n| - |\n| `x \\| y` |\n')).toContain('<td><code>x | y</code></td>');
  });

  test('nombre de cellules ajusté à l\'en-tête', () => {
    const table = parse('| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |\n').children[0];
    expect(table.rows.map((row) => row.length)).toEqual([2, 2]);
    expect(table.rows[0][1]).toEqual([]);
  });

  test('en-tête et délimitation de largeurs différentes : pas de tableau', () => {
    expect(html('| a | b |\n| - |\n')).toBe('<p>| a | b |\n| - |</p>\n');
  });

  test('sans tableau sans barre : reste un titre Setext', () => {
    expect(html('Titre\n---\n')).toBe('<h2>Titre</h2>\n');
  });

  test('le tableau s\'arrête à une ligne vide ou à un autre bloc ; une ligne simple est une rangée', () => {
    const doc = parse('| a |\n| - |\n| 1 |\nsuite\n> citation\n');
    expect(doc.children.map((node) => node.type)).toEqual(['table', 'blockquote']);
    expect(doc.children[0].rows).toHaveLength(2);
  });

  test('un paragraphe qui précède l\'en-tête reste un paragraphe', () => {
    const doc = parse('intro\n| a |\n| - |\n');
    expect(doc.children.map((node) => [node.type, node.line])).toEqual([['paragraph', 1], ['table', 2]]);
  });

  test('outils de découpage', () => {
    expect(splitTableRow('| a | b\\|c |')).toEqual(['a', 'b|c']);
    expect(parseDelimiterRow('---')).toBeNull();
    expect(parseDelimiterRow('| -x- |')).toBeNull();
    expect(parseDelimiterRow(':-|:-:|-:')).toEqual(['left', 'center', 'right']);
  });

  test('enveloppe défilante par défaut (petits écrans)', () => {
    expect(renderHtml('| a |\n| - |\n')).toMatch(/^<div class="md-table">\n<table>/);
  });
});

describe('listes de tâches', () => {
  test('cases cochées et décochées', () => {
    const out = html('- [ ] à faire\n- [x] fait\n- [X] fait aussi\n- [] pas une tâche\n');
    expect(out).toContain('<ul class="contains-task-list">');
    expect(out.match(/type="checkbox"/g)).toHaveLength(3);
    expect(out.match(/checked=""/g)).toHaveLength(2);
    expect(out).toContain('<li>[] pas une tâche</li>');
  });

  test('AST : champ task', () => {
    const list = parse('1. [x] a\n2. b\n').children[0];
    expect(list.children.map((item) => item.task)).toEqual([true, null]);
  });

  test('liste lâche : la case est dans le premier paragraphe', () => {
    expect(html('- [x] a\n\n- [ ] b\n')).toContain('<li class="task-list-item">\n<p><input');
  });

  test('cases actives dans l\'aperçu, avec leur ligne source', () => {
    const out = renderHtml('texte\n\n- [ ] a\n', { interactiveTasks: true });
    expect(out).toContain('data-task-line="3"');
    expect(out).not.toContain('disabled');
  });
});

describe('barré', () => {
  test.each([
    ['~~barré~~', '<p><del>barré</del></p>\n'],
    ['~simple~', '<p><del>simple</del></p>\n'],
    ['~~mélange~', '<p>~~mélange~</p>\n'],
    ['x ~~~trois~~~', '<p>x ~~~trois~~~</p>\n'],
    ['**~~gras barré~~**', '<p><strong><del>gras barré</del></strong></p>\n'],
    ['a ~~ b ~~', '<p>a ~~ b ~~</p>\n'],
  ])('%s', (markdown, expected) => {
    expect(html(markdown)).toBe(expected);
  });
});

describe('liens automatiques étendus', () => {
  test.each([
    ['Voir www.commonmark.org.', '<p>Voir <a href="http://www.commonmark.org">www.commonmark.org</a>.</p>\n'],
    ['(https://a.org/x_(y))', '<p>(<a href="https://a.org/x_(y)">https://a.org/x_(y)</a>)</p>\n'],
    ['https://a.org/b)', '<p><a href="https://a.org/b">https://a.org/b</a>)</p>\n'],
    ['écrire à a.b+c@ex.org !', '<p>écrire à <a href="mailto:a.b+c@ex.org">a.b+c@ex.org</a> !</p>\n'],
    ['`https://dans.le.code`', '<p><code>https://dans.le.code</code></p>\n'],
    ['[lien](/x) https://a.org', '<p><a href="/x">lien</a> <a href="https://a.org">https://a.org</a></p>\n'],
    ['pas@lien-', '<p>pas@lien-</p>\n'],
    ['urlhttps://collée', '<p>urlhttps://collée</p>\n'],
    // Exemples de la spécification GFM (liens automatiques étendus).
    ['www.google.com/search?q=commonmark&hl;', '<p><a href="http://www.google.com/search?q=commonmark">www.google.com/search?q=commonmark</a>&amp;hl;</p>\n'],
    ['www.google.com/search?q=commonmark&hl=en', '<p><a href="http://www.google.com/search?q=commonmark&amp;hl=en">www.google.com/search?q=commonmark&amp;hl=en</a></p>\n'],
    ['a.b-c_d@a.b', '<p><a href="mailto:a.b-c_d@a.b">a.b-c_d@a.b</a></p>\n'],
    ['a.b-c_d@a.b.', '<p><a href="mailto:a.b-c_d@a.b">a.b-c_d@a.b</a>.</p>\n'],
    ['a.b-c_d@a.b-', '<p>a.b-c_d@a.b-</p>\n'],
    ['a.b-c_d@a.b_', '<p>a.b-c_d@a.b_</p>\n'],
  ])('%s', (markdown, expected) => {
    expect(html(markdown)).toBe(expected);
  });

  test('ponctuation finale retirée', () => {
    expect(trimAutolink('https://a.org/x?!.,')).toBe('https://a.org/x');
    expect(trimAutolink('https://a.org/(x))')).toBe('https://a.org/(x)');
    expect(trimAutolink('https://a.org/?q=1&amp;&hl;.')).toBe('https://a.org/?q=1');
  });
});
