/** @jest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ParcoursViewer, initParcoursFromHash } from '../../parcours-viewer.js';
import { ParcoursUI } from '../ParcoursUI.js';
import { ParcoursNavigation } from '../ParcoursNavigation.js';
import { ParcoursProgress } from '../ParcoursProgress.js';
import { createTestEpic } from './fixtures.js';

const otherEpic = () => ({
  id: 'other', title: 'Autre parcours', path: './parcours/other',
  structure: [{ type: 'slide', id: 'other-slide', title: 'Autre étape' }],
});
const response = (epics = [createTestEpic(), otherEpic()]) => ({
  ok: true, json: () => Promise.resolve({ epics }),
});
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('ParcoursViewer — contrats des composants réels', () => {
  let viewer;
  let container;
  let onSlideChange;
  let onClose;

  beforeEach(() => {
    document.body.innerHTML = '<button id="opener">Ouvrir</button><div id="reader"></div>';
    document.head.querySelectorAll('link[rel="prefetch"]').forEach(link => link.remove());
    container = document.getElementById('reader');
    window.history.replaceState(null, '', '/');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(response());
    onSlideChange = jest.fn();
    onClose = jest.fn();
    viewer = new ParcoursViewer(container, { onSlideChange, onClose });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    viewer.close();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  function key(key, options = {}, target = document.activeElement) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    return event;
  }

  it('initialise depuis le hash avec les vrais composants, titre et focus', async () => {
    window.history.replaceState(null, '', '#/parcours/test-epic/slide-2');
    const changed = deferred();
    viewer = initParcoursFromHash(container, { onSlideChange: changed.resolve, onClose });
    await changed.promise;
    expect(viewer.ui).toBeInstanceOf(ParcoursUI);
    expect(viewer.navigation).toBeInstanceOf(ParcoursNavigation);
    expect(viewer.progress).toBeInstanceOf(ParcoursProgress);
    expect(viewer.currentIndex).toBe(1);
    expect(viewer.el.slideFrame.getAttribute('src')).toContain('/slide-2/index.html');
    expect(viewer.el.slideFrame.title).toBe('Slide 2');
    expect(document.activeElement).toBe(viewer.el.btnClose);
  });

  it.each(['', '#/other'])('n’ouvre rien pour le hash %s', hash => {
    window.history.replaceState(null, '', hash || '/');
    expect(initParcoursFromHash(container)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'slide-2', 1],
    ['slide-3', 'slide-2', 2],
    ['absente', 'slide-2', 0],
    [null, 'absente', 0],
  ])('choisit la slide explicite %s ou la reprise %s', async (explicit, saved, index) => {
    localStorage.setItem('parcours-progress', JSON.stringify({
      'test-epic': { visited: ['slide-1'], current: saved },
    }));
    await viewer.load('test-epic', explicit);
    expect(viewer.currentIndex).toBe(index);
    expect(viewer.progress.getCurrentSlide()).toBe(viewer.slides[index].id);
  });

  it('navigation, menu, progression accessible et chargement partagent le même état', async () => {
    await viewer.load('test-epic');
    expect(viewer.el.btnPrev.disabled).toBe(true);
    expect(viewer.el.loading.classList.contains('hidden')).toBe(false);
    viewer.el.slideFrame.dispatchEvent(new Event('load'));
    expect(viewer.el.loading.classList.contains('hidden')).toBe(true);
    viewer.el.btnNext.click();
    expect(viewer.currentIndex).toBe(1);
    expect(viewer.el.loading.classList.contains('hidden')).toBe(false);
    expect(viewer.el.breadcrumb.textContent).toContain('Section 1');
    expect(viewer.el.progressText.textContent).toBe('Étape 2 sur 3');
    expect(viewer.el.progressSummary.textContent).toBe('2 parcourues · 67 %');
    expect(viewer.el.progressFill.parentElement.getAttribute('aria-valuenow')).toBe('67');
    expect(viewer.el.menu.querySelector('[data-slide-id="slide-1"]').classList.contains('visited')).toBe(true);
    expect(viewer.el.menu.querySelector('[data-slide-id="slide-2"] button').getAttribute('aria-current')).toBe('page');
    expect(viewer.el.menu.querySelector('[data-slide-id="slide-2"]').classList.contains('optional')).toBe(true);
    viewer.el.btnMenu.click();
    viewer.el.menu.querySelector('[data-slide-id="slide-3"] button').click();
    expect(viewer.currentIndex).toBe(2);
    expect(viewer.menuOpen).toBe(false);
    expect(viewer.el.btnNext.disabled).toBe(true);
    expect(viewer.el.menu.querySelector('[data-slide-id="slide-2"] button').hasAttribute('aria-current')).toBe(false);
    viewer.prev();
    viewer.goTo(-1);
    viewer.showSlide(99);
    expect(viewer.currentIndex).toBe(1);
    expect(viewer.progress.data.visited).toEqual(['slide-1', 'slide-2', 'slide-3']);
    expect(JSON.parse(localStorage.getItem('parcours-progress'))['test-epic'].current).toBe('slide-2');
    expect(window.location.hash).toBe('#/parcours/test-epic/slide-2');
    expect(onSlideChange).toHaveBeenLastCalledWith(viewer.slides[1], 1);
    expect(document.head.querySelector('link[rel="prefetch"]').href).toContain('/slide-2/');
  });

  it('plie les sections et garde le plan ouvert sur grand écran', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1440 });
    await viewer.load('test-epic');
    expect(viewer.menuOpen).toBe(true);
    const toggle = viewer.el.menu.querySelector('.pv-menu-toggle');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.closest('li').classList.contains('collapsed')).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    viewer.el.menu.querySelector('[data-slide-id="slide-3"] button').click();
    expect(viewer.menuOpen).toBe(true);
  });

  it('raccourcis et limites sont effectifs sans mock de navigation', async () => {
    await viewer.load('test-epic');
    expect(key('ArrowLeft').defaultPrevented).toBe(true);
    expect(viewer.currentIndex).toBe(0);
    key('ArrowRight');
    expect(viewer.currentIndex).toBe(1);
    key('End');
    expect(viewer.currentIndex).toBe(2);
    key('ArrowRight');
    expect(viewer.currentIndex).toBe(2);
    key('Home');
    expect(viewer.currentIndex).toBe(0);
    key('m');
    expect(viewer.menuOpen).toBe(true);
    key('Escape');
    expect(viewer.menuOpen).toBe(false);
    key('Escape');
    expect(container.children).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['altKey', 'ctrlKey', 'metaKey'])('préserve le modificateur %s', async modifier => {
    await viewer.load('test-epic');
    expect(key('ArrowRight', { [modifier]: true }).defaultPrevented).toBe(false);
    expect(viewer.currentIndex).toBe(0);
  });

  it.each(['input', 'textarea', 'select', 'div'])('préserve la saisie dans %s', async tag => {
    await viewer.load('test-epic');
    const editable = document.createElement(tag);
    if (tag === 'div') {
      editable.setAttribute('contenteditable', 'true');
      editable.innerHTML = '<span>Texte éditable</span>';
    }
    container.append(editable);
    const target = editable.firstElementChild || editable;
    expect(key('ArrowRight', {}, target).defaultPrevented).toBe(false);
    expect(viewer.currentIndex).toBe(0);
  });

  it('respecte un événement déjà traité', async () => {
    await viewer.load('test-epic');
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    event.preventDefault();
    viewer.el.btnNext.dispatchEvent(event);
    expect(viewer.currentIndex).toBe(0);
  });

  it('piège Tab et Shift-Tab dans le plan mobile puis rend le focus', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390 });
    await viewer.load('test-epic');
    viewer.toggleMenu(true);
    const buttons = [...viewer.el.sidebar.querySelectorAll('button')];
    buttons.forEach(button => {
      jest.spyOn(button, 'getClientRects').mockReturnValue([{ width: 44, height: 44 }]);
    });
    const first = buttons[0];
    const last = buttons.at(-1);
    expect(document.activeElement).toBe(first);
    last.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
    viewer.el.btnNext.focus();
    key('Tab');
    expect(document.activeElement).toBe(first);
    viewer.toggleMenu(false);
    expect(document.activeElement).toBe(viewer.el.btnMenu);
    expect(viewer.el.btnMenu.getAttribute('aria-expanded')).toBe('false');
    expect(viewer.el.sidebar.getAttribute('aria-hidden')).toBe('true');
  });

  it('hashchange du même epic navigue et un hash hors parcours ferme', async () => {
    await viewer.load('test-epic');
    window.history.replaceState(null, '', '#/parcours/test-epic/slide-3');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(viewer.currentIndex).toBe(2);
    window.history.replaceState(null, '', '#/catalogue');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(container.innerHTML).toBe('');
  });

  it('change d’epic sans conserver DOM, progression ou listeners obsolètes', async () => {
    await viewer.load('test-epic');
    const oldNext = viewer.el.btnNext;
    const oldClose = viewer.el.btnClose;
    const changed = deferred();
    viewer.options.onSlideChange = changed.resolve;
    window.history.replaceState(null, '', '#/parcours/other/other-slide');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await changed.promise;
    expect(viewer.epic.id).toBe('other');
    expect(viewer.el.epicTitle.textContent).toBe('Autre parcours');
    expect(viewer.progress.data.visited).toEqual(['other-slide']);
    expect(viewer.el.btnNext.disabled).toBe(true);
    oldNext.dispatchEvent(new MouseEvent('click'));
    oldClose.dispatchEvent(new MouseEvent('click'));
    expect(viewer.currentIndex).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [() => Promise.reject(new Error('<img src=x onerror=bad>')), '<img src=x onerror=bad>'],
    [() => Promise.resolve({ ok: false }), 'Catalogue parcours introuvable'],
    [() => Promise.resolve(response([])), 'Epic non trouvé: test-epic'],
    [() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('JSON invalide')) }), 'JSON invalide'],
  ])('affiche une erreur asynchrone échappée et un retour effectif', async (fetcher, text) => {
    fetch.mockImplementation(fetcher);
    await viewer.load('test-epic');
    expect(container.querySelector('.pv-error p').textContent).toContain(text);
    expect(container.querySelector('img')).toBeNull();
    expect(console.error).toHaveBeenCalled();
    container.querySelector('.pv-btn-error-back').click();
    expect(window.location.hash).toBe('');
  });

  it('messages TOC authentifiés, échappement, sélection, puis effacement au changement', async () => {
    await viewer.load('test-epic');
    const source = viewer.el.slideFrame.contentWindow;
    const data = { type: 'slide:toc', items: [{ id: 'intro', label: '<img>', icon: '<svg>', level: 9 }] };
    window.dispatchEvent(new MessageEvent('message', { source: window, data }));
    expect(container.querySelector('.pv-toc-list')).toBeNull();
    window.dispatchEvent(new MessageEvent('message', { source, data }));
    expect(container.querySelector('.pv-toc-label').textContent).toBe('<img>');
    expect(container.querySelector('.pv-toc-item').classList.contains('level-2')).toBe(true);
    expect(container.querySelector('.pv-toc-list img')).toBeNull();
    const post = jest.spyOn(source, 'postMessage');
    container.querySelector('.pv-toc-anchor').click();
    expect(post).toHaveBeenCalledWith({ type: 'viewer:scroll-to', anchor: 'intro' }, '*');
    expect(container.querySelector('.pv-toc-item').classList.contains('active')).toBe(true);
    viewer.next();
    expect(container.querySelector('.pv-toc-list')).toBeNull();
  });

  it('refuse les TOC mal typées sans throw ni mutation des messages', async () => {
    await viewer.load('test-epic');
    const source = viewer.el.slideFrame.contentWindow;
    const item = Object.freeze({ id: 'safe', label: 'Sûr', level: 9 });
    const items = [null, 1, { id: {}, label: 'invalide' }, { id: 'x', label: [] }, item];
    expect(() => window.dispatchEvent(new MessageEvent('message', {
      source, data: { type: 'slide:toc', items },
    }))).not.toThrow();
    expect(viewer.currentToc).toEqual([{ id: 'safe', label: 'Sûr', level: 2, icon: undefined }]);
    expect(item.level).toBe(9);
    window.dispatchEvent(new MessageEvent('message', { source, data: { type: 'slide:toc:clear' } }));
    expect(container.querySelector('.pv-toc-list')).toBeNull();
  });

  it('ne réaffiche pas un chargement ancien après une sélection plus récente', async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const first = viewer.load('test-epic');
    await viewer.load('other');
    pending.resolve(response());
    await first;
    expect(viewer.epic.id).toBe('other');
    expect(viewer.el.epicTitle.textContent).toBe('Autre parcours');
  });

  it('une fermeture pendant le fetch empêche toute réouverture tardive', async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const loading = viewer.load('test-epic');
    viewer.close();
    pending.resolve(response());
    await loading;
    expect(container.innerHTML).toBe('');
    expect(onSlideChange).not.toHaveBeenCalled();
  });

  it('une erreur tardive ne remplace pas le parcours plus récent', async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const first = viewer.load('test-epic');
    await viewer.load('other');
    pending.reject(new Error('Ancien refus'));
    await first;
    expect(container.querySelector('.pv-error')).toBeNull();
    expect(viewer.epic.id).toBe('other');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('une fermeture pendant le décodage JSON empêche toute erreur tardive', async () => {
    const decoding = deferred();
    const started = deferred();
    fetch.mockResolvedValue({
      ok: true, json: () => { started.resolve(); return decoding.promise; },
    });
    const loading = viewer.load('test-epic');
    await started.promise;
    viewer.close();
    decoding.reject(new Error('JSON arrivé après fermeture'));
    await loading;
    expect(container.innerHTML).toBe('');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('recharge le même epic avec les métadonnées réellement reçues', async () => {
    await viewer.load('test-epic');
    const updated = { ...createTestEpic(), title: 'Titre actualisé', path: './nouveau' };
    fetch.mockResolvedValue(response([updated]));
    await viewer.load('test-epic', 'slide-3');
    expect(viewer.el.epicTitle.textContent).toBe('Titre actualisé');
    expect(viewer.el.slideFrame.getAttribute('src')).toBe('./nouveau/slides/slide-3/index.html');
    expect(viewer.progress.data.visited).toEqual(['slide-1', 'slide-3']);
  });

  it('un nouveau setup ne double pas les événements et close les désactive', async () => {
    await viewer.load('test-epic');
    viewer.setupEventListeners();
    key('ArrowRight');
    expect(viewer.currentIndex).toBe(1);
    expect(onSlideChange).toHaveBeenCalledTimes(2);
    viewer.close();
    key('ArrowRight', {}, document.body);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'slide:toc', items: [] } }));
    expect(onSlideChange).toHaveBeenCalledTimes(2);
  });

  it('borne la TOC à 15 et efface le sommaire si la nouvelle liste est vide', async () => {
    await viewer.load('test-epic');
    viewer.handleSlideToc(Array.from({ length: 20 }, (_, index) => ({
      id: `anchor-${index}`, label: `Titre ${index}`, level: 1,
    })));
    expect(container.querySelectorAll('.pv-toc-item')).toHaveLength(15);
    viewer.handleSlideToc('non-tableau');
    expect(console.warn).toHaveBeenCalled();
    expect(container.querySelectorAll('.pv-toc-item')).toHaveLength(15);
    viewer.handleSlideToc([]);
    expect(container.querySelector('.pv-toc-list')).toBeNull();
  });

  it('sélectionne sans injection une ancre contenant des caractères de sélecteur', async () => {
    await viewer.load('test-epic');
    const anchor = 'x"] <svg>';
    viewer.handleSlideToc([{ id: anchor, label: 'Ancre' }]);
    viewer.scrollToAnchor(anchor);
    expect(container.querySelector('.pv-toc-item.active').dataset.anchorId).toBe(anchor);
  });

  it('préserve les progressions des autres epics et affiche un refus de stockage sans écraser', async () => {
    const original = { other: { visited: ['other-slide'], current: 'other-slide' } };
    localStorage.setItem('parcours-progress', JSON.stringify(original));
    await viewer.load('test-epic');
    expect(JSON.parse(localStorage.getItem('parcours-progress')).other).toEqual(original.other);
    localStorage.setItem('parcours-progress', '{invalide');
    await viewer.load('test-epic');
    expect(container.querySelector('.parcours-viewer')).not.toBeNull();
    expect(viewer.progress.lastError).not.toBeNull();
    expect(console.warn).toHaveBeenCalled();
    expect(localStorage.getItem('parcours-progress')).toBe('{invalide');
  });

  it('dimensionne, borne et restaure le plan desktop', async () => {
    localStorage.setItem('parcours-menu-width', '350');
    await viewer.load('test-epic');
    expect(viewer.el.sidebar.style.width).toBe('350px');
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback();
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    Object.defineProperty(viewer.el.sidebar, 'offsetWidth', { value: 350 });
    viewer.el.resizeHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    expect(viewer.el.slideFrame.style.pointerEvents).toBe('none');
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    expect(viewer.el.sidebar.style.width).toBe('400px');
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500 }));
    expect(viewer.el.sidebar.style.width).toBe('200px');
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(viewer.el.slideFrame.style.pointerEvents).toBe('');
    expect(document.body.style.cursor).toBe('');
    expect(localStorage.getItem('parcours-menu-width')).toBe('350');
  });

  it('libère un drag et son animation en fermant le lecteur', async () => {
    await viewer.load('test-epic');
    const callbacks = new Map();
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.set(1, callback);
      return 1;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => callbacks.delete(id));
    viewer.el.resizeHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 280 }));
    expect(document.body.style.cursor).toBe('col-resize');
    viewer.close();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    expect(cancel).toHaveBeenCalledWith(1);
    expect(callbacks.size).toBe(0);
  });

  it('une route revenue à l’epic affiché invalide le chargement encore en attente', async () => {
    await viewer.load('test-epic');
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const loading = viewer.load('other');
    window.history.replaceState(null, '', '#/parcours/test-epic/slide-2');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    pending.resolve(response());
    await loading;
    expect(viewer.epic.id).toBe('test-epic');
    expect(viewer.currentIndex).toBe(1);
    expect(window.location.hash).toBe('#/parcours/test-epic/slide-2');
  });

  it('termine le dernier mouvement du resize avant de sauvegarder sa largeur', async () => {
    await viewer.load('test-epic');
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    Object.defineProperty(viewer.el.sidebar, 'offsetWidth', {
      get: () => Number.parseInt(viewer.el.sidebar.style.width, 10) || 300,
    });
    viewer.el.resizeHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 280 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(cancel).toHaveBeenCalledWith(42);
    expect(viewer.el.sidebar.style.width).toBe('380px');
    expect(localStorage.getItem('parcours-menu-width')).toBe('380');
  });

  it('une préférence de largeur inaccessible n’empêche pas la lecture ni le nettoyage', async () => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function(name) {
      if (name === 'parcours-menu-width') { throw new Error('Lecture refusée'); }
      return read.call(this, name);
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(name, value) {
      if (name === 'parcours-menu-width') { throw new Error('Écriture refusée'); }
      return write.call(this, name, value);
    });
    await viewer.load('test-epic');
    expect(container.querySelector('.pv-error')).toBeNull();
    expect(viewer.el.slideFrame.title).toBe('Slide 1');
    viewer.el.resizeHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    expect(() => viewer.close()).not.toThrow();
    expect(document.body.style.cursor).toBe('');
    expect(console.warn).toHaveBeenCalled();
  });

  it('les anciens contrôles de resize et TOC ne pilotent plus le lecteur suivant', async () => {
    await viewer.load('test-epic');
    viewer.handleSlideToc([{ id: 'intro', label: 'Introduction' }]);
    const oldHandle = viewer.el.resizeHandle;
    const oldAnchor = container.querySelector('.pv-toc-anchor');
    await viewer.load('other');
    const scroll = jest.spyOn(viewer, 'scrollToAnchor');
    oldAnchor.click();
    oldHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, bubbles: true }));
    expect(scroll).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe('');
  });

  it.each([null, undefined, NaN, '1', 0.5, {}, Infinity])('refuse l’index non entier %s sans altérer la navigation', async index => {
    await viewer.load('test-epic');
    expect(() => {
      viewer.goTo(index);
      viewer.showSlide(index);
    }).not.toThrow();
    expect(viewer.currentIndex).toBe(0);
    expect(viewer.progress.data.visited).toEqual(['slide-1']);
  });

  it('conserve les délégations publiques de rendu, préchargement et sauvegarde', async () => {
    await viewer.load('test-epic');
    document.head.querySelectorAll('link[rel="prefetch"]').forEach(link => link.remove());
    viewer.preloadAdjacent();
    viewer.preloadSlide('slide-3');
    expect([...document.head.querySelectorAll('link[rel="prefetch"]')].map(link => link.getAttribute('href')))
      .toEqual(['./parcours/test-epic/slides/slide-2/index.html', './parcours/test-epic/slides/slide-3/index.html']);
    viewer.renderMenu();
    expect(viewer.el.menu.querySelectorAll('.pv-menu-slide')).toHaveLength(3);
    expect(viewer.saveProgress()).toBe(true);
  });

  it('un bouton de plan obsolète et un clic hors commande ne déclenchent aucune navigation', async () => {
    await viewer.load('test-epic');
    const button = viewer.el.menu.querySelector('[data-slide-id="slide-2"]');
    button.dataset.slideId = 'disparue';
    button.querySelector('button').click();
    viewer.el.menu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(viewer.currentIndex).toBe(0);
    expect(onSlideChange).toHaveBeenCalledTimes(1);
  });

  it('les hashes du même epic sans cible, inconnus ou déjà courants ne rejouent pas la slide', async () => {
    await viewer.load('test-epic');
    for (const suffix of ['', '/absente', '/slide-1']) {
      window.history.replaceState(null, '', `#/parcours/test-epic${suffix}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    expect(viewer.currentIndex).toBe(0);
    expect(onSlideChange).toHaveBeenCalledTimes(1);
  });

  it('ne détourne ni les touches inconnues ni Tab desktop ou sans boutons visibles', async () => {
    await viewer.load('test-epic');
    expect(key('toString').defaultPrevented).toBe(false);
    expect(key('Tab').defaultPrevented).toBe(false);
    Object.defineProperty(window, 'innerWidth', { value: 390 });
    viewer.toggleMenu(true);
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(viewer.menuOpen).toBe(true);
  });

  it('signale un epic vide au lieu de simuler une slide ou un état chargé', async () => {
    fetch.mockResolvedValue(response([{ ...createTestEpic(), structure: [] }]));
    await viewer.load('test-epic');
    expect(container.querySelector('.pv-error p').textContent).toContain('Parcours sans slide');
    expect(container.querySelector('iframe')).toBeNull();
    expect(onSlideChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(container.querySelector('.pv-btn-error-back'));
    container.querySelector('.pv-btn-error-back').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('conserve les callbacks par défaut sans devoir injecter de faux composants', async () => {
    viewer = new ParcoursViewer(container);
    expect(viewer.currentIndex).toBe(0);
    await viewer.load('test-epic');
    viewer.next();
    viewer.close();
    expect(container.innerHTML).toBe('');
  });

  it('lie toutes les commandes visibles au lecteur, y compris fermer le plan et retourner', async () => {
    await viewer.load('test-epic');
    viewer.el.btnNext.click();
    viewer.el.btnPrev.click();
    expect(viewer.currentIndex).toBe(0);
    viewer.el.btnMenu.click();
    viewer.el.btnCloseMenu.click();
    expect(viewer.menuOpen).toBe(false);
    viewer.el.btnClose.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe('');
  });

  it('la TOC mobile rend le focus et les messages vides, inconnus ou après fermeture restent inertes', async () => {
    expect(() => viewer.sendToSlide('viewer:scroll-to', { anchor: 'intro' })).not.toThrow();
    Object.defineProperty(window, 'innerWidth', { value: 390 });
    await viewer.load('test-epic');
    const source = viewer.el.slideFrame.contentWindow;
    viewer.handleSlideMessage({ source, data: null });
    viewer.handleSlideMessage({ source, data: { type: 'inconnu' } });
    expect(viewer.currentToc).toBeNull();
    viewer.handleSlideToc([{ id: 'intro', label: 'Introduction' }]);
    viewer.toggleMenu(true);
    container.querySelector('.pv-toc-anchor').click();
    expect(viewer.menuOpen).toBe(false);
    expect(document.activeElement).toBe(viewer.el.btnMenu);
    viewer.close();
    expect(viewer.currentToc).toBeNull();
    expect(() => viewer.handleSlideMessage({ source, data: { type: 'slide:toc', items: [] } })).not.toThrow();
  });
});
