/**
 * Commandes d'édition pures : { texte, sélection } → { texte, sélection }.
 * Notation des cas : « [ » et « ] » marquent la sélection, « | » le curseur.
 */
import {
  continueBlock, cycleHeading, diffText, indentLines, insertCode, insertLink, insertTable,
  lineRange, parseListLine, selectionTouchesList, toggleLinePrefix, toggleTaskAtLine, toggleWrap,
} from '../src/editor-commands.js';
import { parse } from '../src/parser/index.js';
import { renderHtml } from '../src/render-html.js';

/**
 * @param {string} marked - Texte avec [sélection] ou curseur |.
 * @returns {import('../src/editor-commands.js').EditorState}
 */
function state(marked) {
  const caret = marked.indexOf('|');
  if (caret >= 0) {
    return { text: marked.replace('|', ''), start: caret, end: caret };
  }
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
}

/** Affiche un état avec la même notation. */
function show({ text, start, end }) {
  return start === end ? `${text.slice(0, start)}|${text.slice(start)}` : `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`;
}

describe('toggleWrap', () => {
  test.each([
    ['un [mot] ici', '**', 'un **[mot]** ici'],
    ['un **[mot]** ici', '**', 'un [mot] ici'],
    ['un [**mot**] ici', '**', 'un [mot] ici'],
    ['un [mot ]ici', '**', 'un **[mot]** ici'],
    ['vide |', '**', 'vide **[gras]**'],
    ['un [mot] ici', '`', 'un `[mot]` ici'],
    ['un [mot] ici', '~~', 'un ~~[mot]~~ ici'],
  ])('%s avec %s', (input, marker, expected) => {
    expect(show(toggleWrap(state(input), marker, 'gras'))).toBe(expected);
  });
});

describe('préfixes de lignes', () => {
  test.each([
    ['[a\nb]', 'quote', '[> a\n> b]'],
    ['[> a\n> b]', 'quote', '[a\nb]'],
    ['[a\n\nb]', 'bullet', '[- a\n\n- b]'],
    ['[- a\n- b]', 'bullet', '[a\nb]'],
    ['[- a\n- b]', 'ordered', '[1. a\n2. b]'],
    ['[1. a\n2. b]', 'ordered', '[a\nb]'],
    ['[- a\nb]', 'task', '[- [ ] a\n- [ ] b]'],
    ['- [x] |a', 'task', '|a'],
    ['  - [x] |a', 'bullet', '  - |a'],
    ['te|xte', 'quote', '> te|xte'],
  ])('%s → %s : %s', (input, kind, expected) => {
    expect(show(toggleLinePrefix(state(input), kind))).toBe(expected);
  });

  test('titres : aucun → # → ## → ### → aucun', () => {
    let current = state('Ti|tre');
    const seen = [];
    for (let i = 0; i < 4; i++) {
      current = cycleHeading(current);
      seen.push(show(current));
    }
    expect(seen).toEqual(['# Ti|tre', '## Ti|tre', '### Ti|tre', 'Ti|tre']);
  });
});

describe('insertions', () => {
  test('lien sur un texte : l\'adresse est sélectionnée', () => {
    expect(show(insertLink(state('voir [ici] !')))).toBe('voir [ici]([https://]) !');
  });

  test('lien sur une URL sélectionnée : l\'intitulé est sélectionné', () => {
    expect(show(insertLink(state('[https://a.org]')))).toBe('[[texte du lien]](https://a.org)');
  });

  test('lien sans sélection', () => {
    expect(show(insertLink(state('|')))).toBe('[texte du lien]([https://])');
  });

  test('code en ligne ou bloc clôturé', () => {
    expect(show(insertCode(state('a [b] c')))).toBe('a `[b]` c');
    expect(show(insertCode(state('[l1\nl2]')))).toBe('```\n[l1\nl2]\n```\n');
    expect(show(insertCode(state('texte\n|')))).toBe('texte\n```\n[code]\n```\n');
    expect(show(insertCode(state('mot|')))).toBe('mot`[code]`');
  });

  test('tableau : entouré de lignes vides', () => {
    expect(show(insertTable(state('Intro|')))).toBe('Intro\n\n| [Colonne 1] | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |\n');
    expect(show(insertTable(state('|')))).toBe('| [Colonne 1] | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |\n');
    expect(show(insertTable(state('a\n|\nb')))).toBe('a\n\n| [Colonne 1] | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |\n\nb');
    expect(show(insertTable(state('a\n\n|')))).toBe('a\n\n| [Colonne 1] | Colonne 2 |\n| --- | --- |\n| Valeur | Valeur |\n');
  });
});

describe('listes au clavier', () => {
  test.each([
    ['- un|', '- un\n- |'],
    ['1. un|', '1. un\n2. |'],
    ['3) un|', '3) un\n4) |'],
    ['- [x] fait|', '- [x] fait\n- [ ] |'],
    ['  * imbriqué|', '  * imbriqué\n  * |'],
    ['- coupé|ici', '- coupé\n- |ici'],
    ['> cité|', '> cité\n> |'],
    ['- un\n- |', '- un\n\n|'],
    ['> |', '\n|'],
  ])('Entrée sur %j', (input, expected) => {
    expect(show(continueBlock(state(input)))).toBe(expected);
  });

  test.each([
    ['texte|'],
    ['-|'],
    ['|- a'],
    ['[- a]'],
  ])('Entrée sans effet sur %j', (input) => {
    expect(continueBlock(state(input))).toBeNull();
  });

  test('Tab imbrique sous l\'élément précédent (largeur du contenu)', () => {
    expect(show(indentLines(state('- a\n- b|'), 1))).toBe('- a\n  - b|');
    expect(show(indentLines(state('1. a\n2. b|'), 1))).toBe('1. a\n   2. b|');
    expect(show(indentLines(state('- a|'), 1))).toBe('  - a|');
  });

  test('Maj+Tab remonte au niveau du parent', () => {
    expect(show(indentLines(state('1. a\n   - b|'), -1))).toBe('1. a\n- b|');
    expect(show(indentLines(state('  - b|'), -1))).toBe('- b|');
    expect(show(indentLines(state('- b|'), -1))).toBe('- b|');
  });

  test('indentation d\'une sélection de plusieurs lignes', () => {
    expect(show(indentLines(state('- a\n[- b\n- c]'), 1))).toBe('- a\n[  - b\n  - c]');
  });

  test('Tab n\'est intercepté que dans une liste', () => {
    expect(selectionTouchesList(state('- a|'))).toBe(true);
    expect(selectionTouchesList(state('texte|'))).toBe(false);
  });
});

describe('outils', () => {
  test('parseListLine', () => {
    expect(parseListLine('\t- [x] a')).toMatchObject({ indent: 4, marker: '-', task: true, number: null, contentOffset: 6 });
    expect(parseListLine('12) b')).toMatchObject({ number: 12, delimiter: ')', contentOffset: 4 });
    expect(parseListLine('texte')).toBeNull();
  });

  test('lineRange exclut une dernière ligne sélectionnée depuis son début', () => {
    expect(lineRange('ab\ncd\nef', 1, 6)).toEqual({ from: 0, to: 5 });
    expect(lineRange('ab\ncd', 4, 4)).toEqual({ from: 3, to: 5 });
  });

  test('toggleTaskAtLine', () => {
    expect(toggleTaskAtLine('x\n- [ ] a\n> 1. [X] b', 2)).toBe('x\n- [x] a\n> 1. [X] b');
    expect(toggleTaskAtLine('x\n- [ ] a\n> 1. [X] b', 3)).toBe('x\n- [ ] a\n> 1. [ ] b');
    expect(toggleTaskAtLine('- a', 1)).toBeNull();
    expect(toggleTaskAtLine('- a', 9)).toBeNull();
  });

  test.each([
    ['- - [ ] a', '- - [x] a'],
    ['1. - [ ] a', '1. - [x] a'],
    ['-\n  [ ] a', '-\n  [x] a'],
    ['> - > 1. [x] a', '> - > 1. [ ] a'],
    ['- [ ] a\n- [x] b', '- [x] a\n- [x] b'],
  ])('toggleTaskAtLine via la position de l\'AST : %j', (markdown, expected) => {
    // Non-régression : chaque case rendue active doit modifier la source.
    const html = renderHtml(markdown, { interactiveTasks: true });
    const [, line, offset] = /data-task-line="(\d+)" data-task-offset="(\d+)"/.exec(html);
    expect(toggleTaskAtLine(markdown, Number(line), Number(offset))).toBe(expected);
    // Repli sans position : la ligne est analysée.
    expect(toggleTaskAtLine(markdown, Number(line))).toBe(expected);
  });

  test('toggleTaskAtLine refuse une position qui ne désigne pas une case', () => {
    expect(toggleTaskAtLine('- [ ] a', 1, 4)).toBeNull();
    expect(toggleTaskAtLine('- [ ] a', 1, 0)).toBeNull();
    expect(toggleTaskAtLine('- [ ] a', 1, Number.NaN)).toBeNull();
    expect(toggleTaskAtLine('- [ ] a', 1, 3)).toBe('- [x] a');
  });

  test('tâche précédée d\'une définition de lien : pas de position, repli sur la ligne', () => {
    const doc = parse('- [r]: /u\n  [ ] a');
    const item = doc.children[0].children[0];
    expect(item.task).toBe(false);
    expect(item.taskOffset).toBeUndefined();
    expect(item.taskLine).toBe(2);
    expect(toggleTaskAtLine('- [r]: /u\n  [ ] a', item.taskLine)).toBe('- [r]: /u\n  [x] a');
  });

  test('diffText', () => {
    expect(diffText('abcdef', 'abXYef')).toEqual({ from: 2, to: 4, insert: 'XY' });
    expect(diffText('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' });
    expect(diffText('same', 'same')).toEqual({ from: 4, to: 4, insert: '' });
  });
});
