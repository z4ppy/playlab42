/**
 * @jest-environment jsdom
 *
 * Tests: app/bookmarks.js - showBookmarkPreview (vignette de la preview)
 *
 * La preview est un élément unique (#bookmark-preview, cf. index.html) réutilisé
 * d'un survol à l'autre : ces tests couvrent le repli emoji et la course entre
 * deux survols successifs.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mocks ESM : unstable_mockModule + import dynamique (cf. jest.config.js)
const preview = document.createElement('div');
preview.innerHTML = `
  <div class="bookmark-preview-image"></div>
  <div class="bookmark-preview-content">
    <h4 class="bookmark-preview-title"></h4>
    <p class="bookmark-preview-description"></p>
    <span class="bookmark-preview-domain"></span>
  </div>
`;

const el = { bookmarkPreview: preview };
const state = { bookmarksCatalogue: null, bookmarkTag: null, searchQuery: '' };

jest.unstable_mockModule('./state.js', () => ({ state, setState: jest.fn() }));
jest.unstable_mockModule('./dom-cache.js', () => ({ el }));

const actualDom = await import('../lib/dom.js');
jest.unstable_mockModule('../lib/dom.js', () => ({
  ...actualDom,
  cloneTemplate: () => document.createDocumentFragment(),
}));

const { showBookmarkPreview } = await import('./bookmarks.js');

const imageEl = () => preview.querySelector('.bookmark-preview-image');

/** Ancre minimale : showBookmarkPreview appelle getBoundingClientRect() */
function anchor() {
  const a = document.createElement('a');
  a.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 20, width: 100, height: 20 });
  return a;
}

const bookmarkA = {
  title: 'Bookmark A',
  domain: 'a.example',
  icon: '🅰️',
  meta: { ogImage: 'data/bookmarks-images/a.png' },
};

const bookmarkB = {
  title: 'Bookmark B',
  domain: 'b.example',
  icon: '🅱️',
  meta: { ogImage: 'data/bookmarks-images/b.png' },
};

describe('bookmarks: showBookmarkPreview', () => {
  beforeEach(() => {
    imageEl().textContent = '';
  });

  it('affiche une <img> pour un bookmark avec image OG', () => {
    showBookmarkPreview(bookmarkA, anchor());
    const img = imageEl().querySelector('img');

    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('data/bookmarks-images/a.png');
    expect(img.alt).toBe('Aperçu de Bookmark A');
    expect(img.loading).toBe('lazy');
    expect(img.decoding).toBe('async');
  });

  it("ne déclare pas de dimensions intrinsèques (l'image OG est distante)", () => {
    showBookmarkPreview(bookmarkA, anchor());
    const img = imageEl().querySelector('img');

    expect(img.getAttribute('width')).toBeNull();
    expect(img.getAttribute('height')).toBeNull();
  });

  it("affiche l'emoji du bookmark quand il n'y a pas d'image OG", () => {
    showBookmarkPreview({ title: 'Sans image', domain: 'c.example', icon: '📘' }, anchor());

    expect(imageEl().querySelector('img')).toBeNull();
    expect(imageEl().textContent).toBe('📘');
  });

  it("utilise l'emoji par défaut quand le bookmark n'a pas d'icône", () => {
    showBookmarkPreview({ title: 'Sans icône', domain: 'd.example' }, anchor());

    expect(imageEl().textContent).toBe('🔖');
  });

  it("remplace l'image en erreur par l'emoji tant qu'elle est affichée", () => {
    showBookmarkPreview(bookmarkA, anchor());
    const imgA = imageEl().querySelector('img');

    imgA.onerror();

    expect(imageEl().textContent).toBe('🅰️');
  });

  it("neutralise le handler de l'image précédente au survol suivant", () => {
    showBookmarkPreview(bookmarkA, anchor());
    const imgA = imageEl().querySelector('img');

    showBookmarkPreview(bookmarkB, anchor());

    expect(imgA.onerror).toBeNull();
  });

  it("n'écrase pas la preview suivante quand l'erreur arrive après un autre survol", () => {
    showBookmarkPreview(bookmarkA, anchor());
    const imgA = imageEl().querySelector('img');
    // Capturé avant le survol suivant : simule une requête déjà en vol dont le
    // handler a été planifié, garde de parentNode comprise.
    const onErrorA = imgA.onerror;

    // Survol de B avant l'expiration de la requête de A
    showBookmarkPreview(bookmarkB, anchor());
    const imgB = imageEl().querySelector('img');

    // L'erreur de A arrive ensuite, sur un nœud désormais détaché
    onErrorA();

    expect(imageEl().querySelector('img')).toBe(imgB);
    expect(imgB.getAttribute('src')).toBe('data/bookmarks-images/b.png');
    expect(imageEl().textContent).not.toBe('🅰️');
  });
});
