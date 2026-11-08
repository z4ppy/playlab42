/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { attachThumbnailMotion, canHover, motionAllowed, TOUCH_DWELL_MS } from './thumbnail-motion.js';

/**
 * Fenêtre simulée : préférences média, connexion, observateur d'intersection et minuteries.
 * @param {{hover?: boolean, reduced?: boolean, connection?: object, observer?: boolean}} options
 */
function fakeWindow({ hover = true, reduced = false, connection = {}, observer = true } = {}) {
  const observers = [];
  const win = {
    matchMedia: query => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : hover,
    }),
    navigator: { connection },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
    IntersectionObserver: observer
      ? class {
        constructor(callback) {
          this.callback = callback;
          this.targets = [];
          observers.push(this);
        }
        observe(target) {
          this.targets.push(target);
        }
      }
      : undefined,
  };
  /** Simule l'entrée ou la sortie d'une carte dans la bande centrale. */
  win.intersect = (target, isIntersecting) => {
    for (const obs of observers) {
      if (obs.targets.includes(target)) {obs.callback([{ target, isIntersecting }]);}
    }
  };
  return win;
}

/** Préchargeur simulé : `load()` ou `fail()` déclenchent la fin du chargement. */
function fakeImageCtor() {
  const instances = [];
  class FakeImage {
    constructor() {
      instances.push(this);
    }
    load() {
      this.onload?.();
    }
    fail() {
      this.onerror?.();
    }
  }
  return { FakeImage, instances };
}

function card() {
  const link = document.createElement('a');
  const img = document.createElement('img');
  img.setAttribute('src', 'games/dames/thumb.png');
  link.appendChild(img);
  document.body.appendChild(link);
  return { link, img };
}

describe('motionAllowed et canHover', () => {
  it('autorise l\'animation par défaut', () => {
    expect(motionAllowed(fakeWindow())).toBe(true);
  });

  it('respecte la réduction des animations, l\'économie de données et les connexions lentes', () => {
    expect(motionAllowed(fakeWindow({ reduced: true }))).toBe(false);
    expect(motionAllowed(fakeWindow({ connection: { saveData: true } }))).toBe(false);
    expect(motionAllowed(fakeWindow({ connection: { effectiveType: '2g' } }))).toBe(false);
    expect(motionAllowed(fakeWindow({ connection: { effectiveType: '4g' } }))).toBe(true);
  });

  it('distingue un pointeur capable de survol d\'un écran tactile', () => {
    expect(canHover(fakeWindow({ hover: true }))).toBe(true);
    expect(canHover(fakeWindow({ hover: false }))).toBe(false);
  });
});

describe('attachThumbnailMotion avec une souris', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('affiche l\'animation au survol une fois chargée, puis revient à l\'image fixe', () => {
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win: fakeWindow(), ImageCtor: FakeImage });

    link.dispatchEvent(new Event('pointerenter'));
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
    instances[0].load();
    expect(img.getAttribute('src')).toBe('games/dames/thumb.anim.webp');

    link.dispatchEvent(new Event('pointerleave'));
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
  });

  it('n\'affiche pas une animation arrivée après la sortie du pointeur', () => {
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win: fakeWindow(), ImageCtor: FakeImage });

    link.dispatchEvent(new Event('pointerenter'));
    link.dispatchEvent(new Event('pointerleave'));
    instances[0].load();
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
  });

  it('garde l\'image fixe si l\'animation ne se charge pas', () => {
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win: fakeWindow(), ImageCtor: FakeImage });

    link.dispatchEvent(new Event('pointerenter'));
    instances[0].fail();
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
  });

  it('anime aussi au focus clavier', () => {
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win: fakeWindow(), ImageCtor: FakeImage });

    link.dispatchEvent(new Event('focusin'));
    instances[0].load();
    expect(img.getAttribute('src')).toBe('games/dames/thumb.anim.webp');
    link.dispatchEvent(new Event('focusout'));
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
  });

  it('ne télécharge rien quand les animations sont réduites', () => {
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', {
      win: fakeWindow({ reduced: true }), ImageCtor: FakeImage,
    });

    link.dispatchEvent(new Event('pointerenter'));
    expect(instances).toHaveLength(0);
  });
});

describe('attachThumbnailMotion sur écran tactile', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('anime la carte arrêtée au centre après un court délai, puis l\'arrête à la sortie', () => {
    const win = fakeWindow({ hover: false });
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win, ImageCtor: FakeImage });

    win.intersect(link, true);
    jest.advanceTimersByTime(TOUCH_DWELL_MS - 1);
    expect(instances).toHaveLength(0);
    jest.advanceTimersByTime(1);
    instances[0].load();
    expect(img.getAttribute('src')).toBe('games/dames/thumb.anim.webp');

    win.intersect(link, false);
    expect(img.getAttribute('src')).toBe('games/dames/thumb.png');
  });

  it('ignore une carte qui ne fait que traverser le centre', () => {
    const win = fakeWindow({ hover: false });
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(link, img, 'games/dames/thumb.anim.webp', { win, ImageCtor: FakeImage });

    win.intersect(link, true);
    jest.advanceTimersByTime(TOUCH_DWELL_MS / 2);
    win.intersect(link, false);
    jest.advanceTimersByTime(TOUCH_DWELL_MS);
    expect(instances).toHaveLength(0);
  });

  it('n\'anime qu\'une carte à la fois', () => {
    const win = fakeWindow({ hover: false });
    const first = card();
    const second = card();
    const { FakeImage, instances } = fakeImageCtor();
    attachThumbnailMotion(first.link, first.img, 'a.anim.webp', { win, ImageCtor: FakeImage });
    attachThumbnailMotion(second.link, second.img, 'b.anim.webp', { win, ImageCtor: FakeImage });

    win.intersect(first.link, true);
    jest.advanceTimersByTime(TOUCH_DWELL_MS);
    instances[0].load();
    win.intersect(second.link, true);
    jest.advanceTimersByTime(TOUCH_DWELL_MS);
    instances[1].load();

    expect(first.img.getAttribute('src')).toBe('games/dames/thumb.png');
    expect(second.img.getAttribute('src')).toBe('b.anim.webp');
  });

  it('reste fixe sans IntersectionObserver', () => {
    const win = fakeWindow({ hover: false, observer: false });
    const { link, img } = card();
    const { FakeImage, instances } = fakeImageCtor();
    expect(() => attachThumbnailMotion(link, img, 'x.anim.webp', { win, ImageCtor: FakeImage })).not.toThrow();
    expect(instances).toHaveLength(0);
  });
});
