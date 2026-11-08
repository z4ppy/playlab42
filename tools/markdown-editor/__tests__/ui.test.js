/**
 * @jest-environment jsdom
 */

/**
 * Interface (jsdom) : rendu DOM de l'aperçu, application des commandes,
 * contrôleur complet monté sur la vraie page index.html.
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { parse } from '../src/parser/index.js';
import { renderTree } from '../src/render-html.js';
import { PreviewRenderer, buildNode } from '../src/ui/dom-render.js';
import { applyState, readState } from '../src/ui/textarea.js';
import { Toast } from '../src/ui/toast.js';
import { MAX_FILE_BYTES, copyText, readTextFile, rejectReason } from '../src/ui/files.js';
import { MarkdownEditorApp, decodeAnchor } from '../src/ui/app.js';
import { LineMeasurer, ScrollSync } from '../src/ui/scroll-sync.js';

const PAGE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const tree = (markdown) => renderTree(parse(markdown), { sourceLines: true, interactiveTasks: true, idPrefix: 'md-' });

describe('aperçu DOM', () => {
  test('construit le DOM sans innerHTML ; le texte reste du texte', () => {
    const container = document.createElement('article');
    new PreviewRenderer(container).render(tree('# T\n\n<img src=x onerror=alert(1)> **g**\n'));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('h1')?.id).toBe('md-t');
    expect(container.querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)> g');
  });

  test('refuse une balise hors liste blanche et ignore les attributs inconnus', () => {
    expect(() => buildNode(document, { tag: 'script', attrs: {}, children: [] })).toThrow(/non autorisée/);
    const node = /** @type {Element} */ (buildNode(document, { tag: 'a', attrs: { href: '/x', onclick: 'alert(1)' }, children: [{ text: 'x' }] }));
    expect(node.getAttribute('onclick')).toBeNull();
    expect(node.getAttribute('href')).toBe('/x');
  });

  test('réutilise les blocs inchangés et décale leurs lignes', () => {
    const container = document.createElement('article');
    const renderer = new PreviewRenderer(container);
    renderer.render(tree('a\n\n- [ ] b\n\nc\n'));
    const list = container.querySelector('ul');
    const stats = renderer.render(tree('nouveau\n\na\n\n- [ ] b\n\nc\n'));
    expect(stats).toEqual({ reused: 3, created: 1 });
    expect(container.querySelector('ul')).toBe(list);
    expect(list?.getAttribute('data-line')).toBe('5');
    expect(container.querySelector('input')?.getAttribute('data-task-line')).toBe('5');
    expect([...container.children].map((element) => element.textContent?.trim())).toEqual(['nouveau', 'a', 'b', 'c']);
    renderer.render(tree('c\n'));
    expect(container.children).toHaveLength(1);
    renderer.clear();
    expect(container.children).toHaveLength(0);
  });
});

describe('zone de saisie', () => {
  test('applique un état (repli sans execCommand) et notifie la saisie', () => {
    const area = document.createElement('textarea');
    document.body.append(area);
    area.value = 'abc';
    const onInput = jest.fn();
    area.addEventListener('input', onInput);
    applyState(area, { text: 'aXc', start: 1, end: 2 });
    expect(readState(area)).toEqual({ text: 'aXc', start: 1, end: 2 });
    expect(onInput).toHaveBeenCalledTimes(1);
    applyState(area, { text: 'aXc', start: 0, end: 0 }, { focus: false });
    expect(onInput).toHaveBeenCalledTimes(1);
    area.remove();
  });

  test('utilise execCommand quand il est disponible (historique conservé)', () => {
    const area = document.createElement('textarea');
    document.body.append(area);
    area.value = 'abc';
    document.execCommand = jest.fn((command, _ui, value) => {
      const { selectionStart, selectionEnd } = area;
      area.setRangeText(command === 'delete' ? '' : value, selectionStart, selectionEnd, 'end');
      return true;
    });
    applyState(area, { text: 'aZZc', start: 3, end: 3 });
    applyState(area, { text: 'ac', start: 1, end: 1 });
    expect(document.execCommand.mock.calls.map(([command]) => command)).toEqual(['insertText', 'delete']);
    expect(area.value).toBe('ac');
    delete document.execCommand;
    area.remove();
  });

  test('mesure des lignes via un miroir', () => {
    const area = document.createElement('textarea');
    document.body.append(area);
    area.value = 'a\nb\nc';
    const measurer = new LineMeasurer(area);
    expect(measurer.lineTops()).toHaveLength(3);
    expect(measurer.lineTops()).toBe(measurer.lineTops());
    expect(measurer.topOf(99)).toBe(0);
  });
});

describe('défilement synchronisé', () => {
  /** Donne à un élément des dimensions et un défilement simulés. */
  function scrollable(element, { scrollHeight, clientHeight }) {
    let top = 0;
    Object.defineProperty(element, 'scrollTop', { get: () => top, set: (value) => { top = value; }, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
    return element;
  }

  test('l\'aperçu suit l\'éditeur et inversement, sans écho', () => {
    const editor = scrollable(document.createElement('textarea'), { scrollHeight: 1100, clientHeight: 100 });
    const pane = scrollable(document.createElement('section'), { scrollHeight: 2100, clientHeight: 100 });
    document.body.append(editor, pane);
    editor.value = Array.from({ length: 50 }, (_, i) => `ligne ${i + 1}`).join('\n');
    const block = document.createElement('p');
    block.setAttribute('data-line', '26');
    pane.append(block);
    pane.getBoundingClientRect = () => ({ top: 0 });
    block.getBoundingClientRect = () => ({ top: 1500 - pane.scrollTop });
    let active = true;
    const sync = new ScrollSync(editor, pane, () => active);
    // jsdom ne fait pas de mise en page : chaque ligne mesure 20 px.
    sync.measurer.lineTops = () => Array.from({ length: 50 }, (_, i) => i * 20);
    editor.scrollTop = 250;
    editor.dispatchEvent(new Event('scroll'));
    expect(pane.scrollTop).toBeCloseTo(750);
    pane.dispatchEvent(new Event('scroll'));
    expect(editor.scrollTop).toBe(250);
    sync.invalidate();
    pane.scrollTop = 1500;
    pane.dispatchEvent(new Event('scroll'));
    expect(editor.scrollTop).toBeCloseTo(500);
    active = false;
    editor.scrollTop = 0;
    editor.dispatchEvent(new Event('scroll'));
    expect(pane.scrollTop).toBe(1500);
  });
});

describe('toast et fichiers', () => {
  test('message avec action, masqué ensuite', () => {
    jest.useFakeTimers();
    const root = document.createElement('p');
    const text = document.createElement('span');
    const action = document.createElement('button');
    const toast = new Toast(root, text, action);
    const run = jest.fn();
    toast.show('Fait', { label: 'Annuler', run });
    expect([root.hidden, text.textContent, action.hidden, action.textContent]).toEqual([false, 'Fait', false, 'Annuler']);
    action.click();
    expect(run).toHaveBeenCalled();
    expect(root.hidden).toBe(true);
    toast.show('Info');
    expect(action.hidden).toBe(true);
    jest.advanceTimersByTime(6000);
    expect(root.hidden).toBe(true);
    jest.useRealTimers();
  });

  test('toast : suspendu au focus et au survol, focus rendu à sa disparition', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<textarea id="t"></textarea><button id="before">x</button><p id="r"><span></span><button></button></p>';
    const root = document.getElementById('r');
    const action = root.querySelector('button');
    const textarea = document.getElementById('t');
    const toast = new Toast(root, root.querySelector('span'), action, () => textarea);
    toast.show('Brouillon restauré.', { label: 'Repartir de zéro', run: jest.fn() });
    const before = document.getElementById('before');
    before.focus();
    action.focus();
    action.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: before }));
    jest.advanceTimersByTime(30000);
    expect(root.hidden).toBe(false);
    // Le focus sort : le minuteur repart pour toute sa durée.
    before.focus();
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: before }));
    jest.advanceTimersByTime(9000);
    expect(root.hidden).toBe(false);
    jest.advanceTimersByTime(1500);
    expect(root.hidden).toBe(true);
    // Survol : suspendu, puis relancé à la sortie du pointeur.
    toast.show('Info');
    root.dispatchEvent(new Event('pointerenter'));
    jest.advanceTimersByTime(20000);
    expect(root.hidden).toBe(false);
    root.dispatchEvent(new Event('pointerleave'));
    jest.advanceTimersByTime(5000);
    expect(root.hidden).toBe(true);
    // Masqué avec le focus dedans : retour à l'élément d'origine…
    toast.show('Annulable', { label: 'Annuler', run: jest.fn() });
    action.focus();
    action.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: before }));
    toast.hide();
    expect(document.activeElement).toBe(before);
    // … ou, s'il a disparu, à la zone de saisie.
    toast.show('Annulable', { label: 'Annuler', run: jest.fn() });
    action.focus();
    action.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: before }));
    before.remove();
    action.click();
    expect(document.activeElement).toBe(textarea);
    jest.useRealTimers();
  });

  test('fichiers acceptés ou refusés', async () => {
    const md = new File([`${String.fromCharCode(0xFEFF)}# a\r\nb`], 'notes.md', { type: '' });
    expect(rejectReason(md)).toBeNull();
    expect(await readTextFile(md)).toBe('# a\nb');
    expect(rejectReason(new File(['x'], 'photo.png', { type: 'image/png' }))).toMatch(/pas un fichier texte/);
    const huge = new File(['x'], 'gros.md');
    Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });
    await expect(readTextFile(huge)).rejects.toThrow(/5 Mo/);
  });

  test('copie : API presse-papiers puis repli', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText(document, 'x')).toBe(true);
    writeText.mockRejectedValueOnce(new Error('refus'));
    document.execCommand = jest.fn(() => true);
    expect(await copyText(document, 'y')).toBe(true);
    document.execCommand = jest.fn(() => {
      throw new Error('non');
    });
    writeText.mockRejectedValueOnce(new Error('refus'));
    expect(await copyText(document, 'z')).toBe(false);
    delete document.execCommand;
  });
});

/**
 * Monte la vraie page et le contrôleur avec des services en mémoire.
 * @param {{ draft?: string, wide?: boolean, view?: string|null }} [options]
 */
function mountApp({ draft, wide = true, view = null } = {}) {
  document.body.innerHTML = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>'));
  const byId = (id) => document.getElementById(id);
  const saved = { text: draft };
  const drafts = {
    load: () => (saved.text === undefined ? null : { text: saved.text, savedAt: 0 }),
    save: jest.fn((text) => {
      saved.text = text;
      return { ok: true };
    }),
    clear: jest.fn(() => true),
  };
  const toast = { show: jest.fn(), hide: jest.fn() };
  const media = { matches: wide, addEventListener: jest.fn() };
  const preference = { value: view, get() { return this.value; }, set: jest.fn(function set(value) { this.value = value; return true; }) };
  const app = new MarkdownEditorApp({
    app: byId('app'), source: byId('source'), previewPane: byId('preview-pane'), preview: byId('preview'),
    toolbar: byId('toolbar'), tocPanel: byId('toc-panel'), tocList: byId('toc-list'), tocToggle: byId('toc-toggle'),
    menuToggle: byId('menu-toggle'), menu: byId('file-menu'), fileInput: byId('file-input'),
    dropOverlay: byId('drop-overlay'), stats: byId('stats'), saveState: byId('save-state'), announcer: byId('announcer'),
  }, { drafts, viewPreference: preference, toast, wide: media, mac: false });
  app.start('# Exemple\n\n- [ ] tâche\n');
  return { app, drafts, toast, preference, media, byId, source: /** @type {HTMLTextAreaElement} */ (byId('source')) };
}

describe('contrôleur', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.open = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('démarre sur l\'exemple, rend l\'aperçu, le sommaire et les statistiques', () => {
    const { byId } = mountApp();
    expect(byId('app').dataset.view).toBe('split');
    expect(byId('preview').querySelector('h1')?.id).toBe('md-exemple');
    expect(byId('toc-list').textContent).toBe('Exemple');
    expect(byId('stats').textContent).toMatch(/^2 mots/);
    expect(byId('toolbar').querySelectorAll('.mde-tool')).toHaveLength(15);
  });

  test('retrait au toucher : boutons ⇥ et ⇤, message hors liste', () => {
    const { source, byId, toast } = mountApp();
    document.execCommand = jest.fn(() => false);
    const tool = (id) => byId('toolbar').querySelector(`[data-command="${id}"]`);
    expect(tool('indent').getAttribute('aria-label')).toBe('Augmenter le retrait (Tab)');
    source.value = '- a\n- b';
    source.setSelectionRange(7, 7);
    tool('indent').click();
    expect(source.value).toBe('- a\n  - b');
    tool('outdent').click();
    expect(source.value).toBe('- a\n- b');
    source.value = 'texte';
    source.setSelectionRange(2, 2);
    tool('indent').click();
    expect(source.value).toBe('texte');
    expect(toast.show).toHaveBeenLastCalledWith(expect.stringMatching(/éléments de liste/));
    delete document.execCommand;
  });

  test('état vide : indication dans la zone de saisie et aperçu sans nœud (:empty)', () => {
    const { source, byId, app } = mountApp();
    expect(source.placeholder).toMatch(/Markdown/);
    source.value = '';
    app.renderNow();
    expect(byId('preview').childNodes).toHaveLength(0);
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.md-doc:empty::before \{\s*content: "[^"]+"/);
  });

  test('restaure un brouillon et propose de repartir de zéro', () => {
    const { source, toast } = mountApp({ draft: 'brouillon' });
    expect(source.value).toBe('brouillon');
    const [, action] = toast.show.mock.calls[0];
    action.run();
    expect(source.value).toBe('');
  });

  test('petit écran : la vue côte à côte devient l\'éditeur seul, l\'aperçu est rendu à la demande', () => {
    const { app, byId, preference } = mountApp({ wide: false, view: 'split' });
    expect(byId('app').dataset.view).toBe('editor');
    expect(byId('preview').children).toHaveLength(0);
    byId('app').querySelector('[data-set-view="preview"]').click();
    expect(byId('app').dataset.view).toBe('preview');
    expect(preference.set).toHaveBeenCalledWith('preview');
    expect(byId('preview').querySelector('h1')).not.toBeNull();
    app.setView('inconnue');
    expect(byId('app').dataset.view).toBe('editor');
  });

  test('saisie : rendu différé puis brouillon enregistré', () => {
    const { source, byId, drafts } = mountApp();
    source.value = '# Nouveau';
    source.dispatchEvent(new Event('input'));
    expect(byId('save-state').textContent).toBe('Modifié…');
    jest.advanceTimersByTime(1000);
    expect(byId('preview').textContent).toBe('Nouveau');
    expect(drafts.save).toHaveBeenLastCalledWith('# Nouveau');
    expect(byId('save-state').textContent).toMatch(/^Brouillon enregistré/);
  });

  test('échec d\'enregistrement signalé', () => {
    const { app, drafts, byId } = mountApp();
    drafts.save.mockReturnValueOnce({ ok: false, reason: 'quota' });
    app.saveNow();
    expect(byId('save-state').textContent).toBe('Brouillon non enregistré (stockage plein)');
    expect(byId('save-state').classList.contains('is-warning')).toBe(true);
  });

  test('clavier : raccourci, Entrée dans une liste, Tab, Échap libère la tabulation', () => {
    const { source } = mountApp();
    const key = (init) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      source.dispatchEvent(event);
      return event.defaultPrevented;
    };
    source.value = 'mot';
    source.setSelectionRange(0, 3);
    expect(key({ key: 'b', ctrlKey: true })).toBe(true);
    expect(source.value).toBe('**mot**');
    source.value = '- a';
    source.setSelectionRange(3, 3);
    expect(key({ key: 'Enter' })).toBe(true);
    expect(source.value).toBe('- a\n- ');
    expect(key({ key: 'Tab' })).toBe(true);
    expect(source.value).toBe('- a\n  - ');
    expect(key({ key: 'Tab', shiftKey: true })).toBe(true);
    expect(source.value).toBe('- a\n- ');
    expect(key({ key: 'Escape' })).toBe(false);
    expect(key({ key: 'Tab' })).toBe(false);
    source.value = 'texte';
    source.dispatchEvent(new Event('focus'));
    expect(key({ key: 'Tab' })).toBe(false);
    expect(key({ key: 'Enter' })).toBe(false);
    expect(key({ key: 'Enter', isComposing: true })).toBe(false);
  });

  test('barre d\'outils : commande, annuler, navigation aux flèches', () => {
    const { source, byId } = mountApp();
    document.execCommand = jest.fn(() => false);
    source.value = 'x';
    source.setSelectionRange(0, 1);
    byId('toolbar').querySelector('[data-command="quote"]').click();
    expect(source.value).toBe('> x');
    byId('toolbar').querySelector('[data-command="undo"]').click();
    expect(document.execCommand).toHaveBeenCalledWith('undo');
    const buttons = [...byId('toolbar').querySelectorAll('.mde-tool')];
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    expect(buttons[buttons.length - 1].getAttribute('tabindex')).toBe('0');
    delete document.execCommand;
  });

  test('aperçu : case cochée modifie la source, liens internes et externes', () => {
    const { source, byId } = mountApp();
    byId('preview').querySelector('input').click();
    expect(source.value).toBe('# Exemple\n\n- [x] tâche\n');
    // La marge tactile de l'élément agit comme la case.
    byId('preview').querySelector('.task-list-item').click();
    expect(source.value).toBe('# Exemple\n\n- [ ] tâche\n');
    source.value = '# Haut\n\n[haut](#haut) [ext](https://a.org)';
    source.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(500);
    const [internal, external] = byId('preview').querySelectorAll('a');
    internal.click();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    external.click();
    expect(window.open).toHaveBeenCalledWith('https://a.org', '_blank', 'noopener,noreferrer');
  });

  test('aperçu : ancre en UTF-8 invalide sans exception', () => {
    const { source, byId } = mountApp();
    source.value = '[x](#%E0%A4) [y](#%C3%A9t%C3%A9)';
    source.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(500);
    const [broken, encoded] = byId('preview').querySelectorAll('a');
    const lookups = jest.spyOn(document, 'getElementById');
    expect(() => broken.click()).not.toThrow();
    encoded.click();
    expect(lookups.mock.calls.map(([id]) => id)).toEqual(['md-%E0%A4', 'md-été']);
    lookups.mockRestore();
    expect(decodeAnchor('%E0')).toBe('%E0');
  });

  test('aperçu : chaque case est nommée par sa tâche et modifie la bonne ligne', () => {
    const { source, byId, app, toast } = mountApp();
    source.value = '- [ ] Lire\n- - [ ] Imbriquée\n-\n  [x] Suivante';
    app.renderNow();
    const boxes = [...byId('preview').querySelectorAll('input')];
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual(['Lire', 'Imbriquée', 'Suivante']);
    boxes[1].click();
    expect(source.value).toBe('- [ ] Lire\n- - [x] Imbriquée\n-\n  [x] Suivante');
    byId('preview').querySelectorAll('input')[2].click();
    expect(source.value).toBe('- [ ] Lire\n- - [x] Imbriquée\n-\n  [ ] Suivante');
    // Source devenue introuvable (texte changé sans rendu) : la case revient en arrière.
    const stale = byId('preview').querySelectorAll('input')[0];
    source.value = 'plus de tâche';
    stale.click();
    expect(stale.checked).toBe(false);
    expect(source.value).toBe('plus de tâche');
    expect(toast.show).toHaveBeenLastCalledWith(expect.stringMatching(/pas pu être modifiée/));
  });

  test('sommaire : ouverture, navigation et fermeture par Échap', () => {
    const { byId, source, app } = mountApp({ wide: false });
    byId('toc-toggle').click();
    expect(byId('toc-panel').hidden).toBe(false);
    byId('toc-list').querySelector('a').click();
    expect(byId('toc-panel').hidden).toBe(true);
    expect(source.selectionStart).toBe(0);
    app.setView('preview');
    byId('toc-toggle').click();
    byId('toc-list').querySelector('a').click();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    byId('toc-toggle').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(byId('toc-panel').hidden).toBe(true);
    source.value = 'sans titre';
    app.renderNow();
    expect(byId('toc-list').textContent).toMatch(/Aucun titre/);
  });

  test('menu Fichier : ouverture, Échap, clic extérieur, export et copie', async () => {
    const { byId, toast } = mountApp();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    const clicks = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    byId('menu-toggle').click();
    expect(byId('file-menu').hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(byId('file-menu').hidden).toBe(true);
    byId('menu-toggle').click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(byId('file-menu').hidden).toBe(true);
    byId('file-menu').querySelector('[data-action="export-html"]').click();
    byId('file-menu').querySelector('[data-action="save-md"]').click();
    expect(clicks).toHaveBeenCalledTimes(2);
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/html;charset=utf-8');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn().mockResolvedValue(undefined) }, configurable: true });
    byId('file-menu').querySelector('[data-action="copy-html"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('<h1 id="exemple">Exemple</h1>'));
    expect(toast.show).toHaveBeenCalledWith('HTML copié dans le presse-papiers.');
    clicks.mockRestore();
  });

  test('menu Fichier : se ferme quand le focus le quitte au clavier', () => {
    const { byId } = mountApp();
    const menu = byId('file-menu');
    const items = menu.querySelectorAll('button');
    const leave = (from, to) => from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }));
    byId('menu-toggle').click();
    leave(items[0], items[1]);
    leave(items[1], byId('menu-toggle'));
    expect(menu.hidden).toBe(false);
    leave(items[items.length - 1], byId('source'));
    expect(menu.hidden).toBe(true);
    // Sans destination : fermé seulement si la page a perdu le focus.
    const focused = jest.spyOn(document, 'hasFocus').mockReturnValue(true);
    byId('menu-toggle').click();
    leave(items[0], null);
    jest.runOnlyPendingTimers();
    expect(menu.hidden).toBe(false);
    focused.mockReturnValue(false);
    leave(items[0], null);
    jest.runOnlyPendingTimers();
    expect(menu.hidden).toBe(true);
    focused.mockRestore();
  });

  test('Ctrl+S enregistre immédiatement ; Nouveau document vide le texte avec annulation', () => {
    const { byId, drafts, source, toast } = mountApp();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(drafts.save).toHaveBeenCalled();
    byId('file-menu').querySelector('[data-action="new"]').click();
    expect(source.value).toBe('');
    expect(drafts.clear).toHaveBeenCalled();
    toast.show.mock.calls.at(-1)[1].run();
    expect(source.value).toBe('# Exemple\n\n- [ ] tâche\n');
  });

  test('ouverture d\'un fichier par sélection et par dépôt', async () => {
    // FileReader (jsdom) s'appuie sur de vrais minuteurs.
    jest.useRealTimers();
    const settle = async () => {
      for (let i = 0; i < 40 && toast.show.mock.calls.length === shown; i++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      shown = toast.show.mock.calls.length;
    };
    const { byId, source, toast } = mountApp();
    let shown = toast.show.mock.calls.length;
    const input = /** @type {HTMLInputElement} */ (byId('file-input'));
    Object.defineProperty(input, 'files', { value: [new File(['# Ouvert'], 'a.md')], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
    expect(source.value).toBe('# Ouvert');
    const drag = (type, files) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
      byId('app').dispatchEvent(event);
      return event;
    };
    drag('dragenter');
    expect(byId('drop-overlay').hidden).toBe(false);
    expect(drag('dragover').defaultPrevented).toBe(true);
    drag('dragleave');
    expect(byId('drop-overlay').hidden).toBe(true);
    drag('drop', [new File(['x'], 'image.png', { type: 'image/png' })]);
    await settle();
    expect(toast.show).toHaveBeenLastCalledWith(expect.stringMatching(/pas un fichier texte/));
  });
});

describe('mise en page', () => {
  test('chaque rangée de la grille a sa zone nommée (une rangée masquée ne décale pas les autres)', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/grid-template-areas:\s*"top"\s*"toolbar"\s*"work"\s*"status"/);
    for (const [selector, area] of [['mde-top', 'top'], ['mde-toolbar', 'toolbar'], ['mde-work', 'work'], ['mde-status', 'status']]) {
      expect(css).toMatch(new RegExp(`\\.${selector} \\{[^}]*grid-area: ${area};`));
    }
  });
});
