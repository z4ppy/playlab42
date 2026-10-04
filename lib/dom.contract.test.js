/**
 * @jest-environment jsdom
 *
 * Contrats des utilitaires DOM sur un vrai DOM (les tests existants utilisent un faux document).
 */
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { create, fillTemplate, cloneTemplate, escapeHtml, isEditableTarget, delegate } from './dom.js';

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('create() sur vrai DOM', () => {
  it('distingue classe, style objet, écouteur, attribut brut et enfants ignorés', () => {
    const clicks = jest.fn();
    const node = create('button', {
      class: 'a b', style: { color: 'red' }, onClick: clicks, onfoo: 'texte', 'data-n': 3, hidden: '',
    }, ['t', create('i'), 12, null, undefined]);
    node.click();
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(node.outerHTML).toBe('<button class="a b" style="color: red;" onfoo="texte" data-n="3" hidden="">t<i></i></button>');
  });

  it('traite un style textuel comme un attribut et échappe le texte', () => {
    const node = create('p', { style: 'color: blue' }, ['<b>x</b>']);
    expect(node.getAttribute('style')).toBe('color: blue');
    expect(node.innerHTML).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('fillTemplate() sur vrai DOM', () => {
  it('remplit textes, attributs et classes, et ignore sélecteurs absents ou valeurs vides', () => {
    document.body.innerHTML = '<template id="t"><div class="c"><h3></h3><p class="old"></p></div></template>';
    const out = fillTemplate('t', {
      h3: 'Titre', p: { class: 'new', 'data-k': 'v', textContent: 'Texte' }, '.absent': 'x', '.c': null, span: undefined,
    });
    expect(out.querySelector('h3').textContent).toBe('Titre');
    expect(out.querySelector('p').outerHTML).toBe('<p class="new" data-k="v">Texte</p>');
  });

  it('injecte innerHTML seulement sur demande explicite et accepte innerText', () => {
    document.body.innerHTML = '<template id="t"><p></p><span></span></template>';
    const out = fillTemplate('t', { p: { innerHTML: '<b>x</b>' }, span: { innerText: 'y' } });
    expect(out.querySelector('p').innerHTML).toBe('<b>x</b>');
    expect(out.querySelector('span').textContent).toBe('y');
  });

  it('retourne un fragment vide avec avertissement si le template manque', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(fillTemplate('nope', { p: 'x' }).childNodes).toHaveLength(0);
    expect(cloneTemplate('nope').childNodes).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('autres contrats DOM', () => {
  it('échappe les caractères HTML et vide les valeurs non textuelles', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href="x"&gt;&amp;\'&lt;/a&gt;');
    expect([escapeHtml(null), escapeHtml(4), escapeHtml(undefined)]).toEqual(['', '', '']);
    expect(escapeHtml('simple')).toBe('simple');
  });

  it('reconnaît les cibles de saisie et les zones éditables', () => {
    document.body.innerHTML = `<input id="i"><div contenteditable="true"><b id="in"></b></div>
      <div contenteditable="false"><b id="out"></b></div><textarea id="t"></textarea>`;
    expect(isEditableTarget(document.getElementById('i'))).toBe(true);
    expect(isEditableTarget(document.getElementById('t'))).toBe(true);
    expect(isEditableTarget(document.getElementById('in'))).toBe(true);
    expect(isEditableTarget(document.getElementById('out'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });

  it('délègue aux seuls descendants correspondants et se désabonne', () => {
    document.body.innerHTML = '<ul id="l"><li class="k"><b>x</b></li><li>y</li></ul>';
    const list = document.getElementById('l');
    const handler = jest.fn();
    const off = delegate(list, 'click', '.k', handler);
    list.querySelector('b').click();
    list.querySelectorAll('li')[1].click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe(list.querySelector('.k'));
    off();
    list.querySelector('b').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
