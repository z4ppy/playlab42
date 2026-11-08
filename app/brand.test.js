/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  scrambleFrame,
  playDecode,
  triggerReaction,
  updateSpotlight,
  initBrand,
  FLASK_REACTIONS,
  SCRAMBLE_GLYPHS,
} from './brand.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** Fenêtre factice : images d'animation pilotées à la main, préférences de mouvement réglables. */
function fakeWindow({ reducedMotion = false, finePointer = true } = {}) {
  const frames = [];
  return {
    frames,
    requestAnimationFrame: callback => frames.push(callback),
    cancelAnimationFrame: jest.fn(),
    setTimeout: jest.fn(),
    matchMedia: query => ({
      matches: query.includes('reduce') ? reducedMotion : finePointer,
    }),
    /** Exécute l'image en attente au temps donné (ms). */
    tick(time) {
      frames.shift()?.(time);
    },
  };
}

describe('scrambleFrame : décodage du titre', () => {
  it('révèle les lettres de gauche à droite selon l’avancement', () => {
    const frame = scrambleFrame('abcd', 0.5, () => 0, 'X');
    // 0,5 ≥ 1/4 et 2/4 : les deux premières lettres sont figées.
    expect(frame).toBe('abXX');
  });

  it('affiche le texte final à 100 % et borne les valeurs hors intervalle', () => {
    expect(scrambleFrame('Playlab42', 1)).toBe('Playlab42');
    expect(scrambleFrame('Playlab42', 3)).toBe('Playlab42');
    expect(scrambleFrame('ab', -1, () => 0, 'Z')).toBe('ZZ');
  });

  it('conserve la longueur et les espaces', () => {
    const frame = scrambleFrame('a b c', 0, () => 0.99);
    expect([...frame]).toHaveLength(5);
    expect(frame[1]).toBe(' ');
    expect(frame[3]).toBe(' ');
  });

  it('ne choisit que des glyphes de la liste fournie', () => {
    const frame = scrambleFrame('abcdef', 0, () => 0.999999);
    for (const char of frame) {
      expect(SCRAMBLE_GLYPHS).toContain(char);
    }
  });
});

describe('playDecode : animation du titre', () => {
  it('termine sur le texte d’origine et retire l’état de décodage', () => {
    const element = document.createElement('span');
    element.dataset.brandText = 'Playlab42';
    element.textContent = 'Playlab42';
    const win = fakeWindow();

    playDecode(element, { win, random: () => 0, duration: 100 });
    win.tick(0);
    expect(element.classList.contains('is-decoding')).toBe(true);
    expect(element.textContent).not.toBe('Playlab42');

    win.tick(100);
    expect(element.textContent).toBe('Playlab42');
    expect(element.classList.contains('is-decoding')).toBe(false);
  });

  it('peut être interrompue et restitue immédiatement le texte', () => {
    const element = document.createElement('span');
    element.textContent = 'Lab';
    const win = fakeWindow();
    const stop = playDecode(element, { win, random: () => 0, duration: 100 });
    win.tick(0);
    stop();
    expect(element.textContent).toBe('Lab');
    expect(win.cancelAnimationFrame).toHaveBeenCalled();
  });
});

describe('triggerReaction : la fiole', () => {
  it('fait défiler les réactions puis revient à la première', () => {
    const flask = document.createElement('button');
    flask.dataset.reaction = '0';
    const win = fakeWindow();
    const seen = Array.from({ length: FLASK_REACTIONS }, () => triggerReaction(flask, win));
    expect(seen).toEqual([1, 2, 3, 0]);
    expect(flask.dataset.reaction).toBe('0');
  });

  it('secoue la fiole, sauf si l’utilisateur réduit les mouvements', () => {
    const flask = document.createElement('button');
    triggerReaction(flask, fakeWindow());
    expect(flask.classList.contains('is-shaken')).toBe(true);

    const calm = document.createElement('button');
    triggerReaction(calm, fakeWindow({ reducedMotion: true }));
    expect(calm.classList.contains('is-shaken')).toBe(false);
    // La teinte change quand même : la réaction reste visible sans mouvement.
    expect(calm.dataset.reaction).toBe('1');
  });
});

describe('updateSpotlight : halo des cartes', () => {
  it('place le halo en coordonnées locales de la carte survolée', () => {
    document.body.innerHTML = '<div class="card"><p>Contenu</p></div>';
    const card = document.querySelector('.card');
    card.getBoundingClientRect = () => ({ left: 100, top: 50 });
    updateSpotlight({ target: card.querySelector('p'), clientX: 130, clientY: 80 });
    expect(card.style.getPropertyValue('--spot-x')).toBe('30px');
    expect(card.style.getPropertyValue('--spot-y')).toBe('30px');
  });

  it('ignore les éléments hors carte', () => {
    document.body.innerHTML = '<p>Hors carte</p>';
    expect(() => updateSpotlight({ target: document.querySelector('p'), clientX: 0, clientY: 0 })).not.toThrow();
  });
});

describe('initBrand : intégration au portail', () => {
  beforeEach(() => {
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  });

  it('garde un titre accessible inchangé pendant le décodage', () => {
    const win = fakeWindow();
    initBrand(document, win);
    win.tick(0);
    const title = document.querySelector('header h1');
    expect(title.querySelector('.sr-only').textContent).toBe('Playlab42');
    expect(title.querySelector('.brand-letters').getAttribute('aria-hidden')).toBe('true');
  });

  it('ne lance aucune animation du titre en mouvement réduit', () => {
    const win = fakeWindow({ reducedMotion: true });
    initBrand(document, win);
    expect(win.frames).toHaveLength(0);
    expect(document.querySelector('.brand-letters').textContent).toBe('Playlab42');
  });

  it('expose la fiole comme un bouton nommé qui change de réaction au clic', () => {
    initBrand(document, fakeWindow());
    const flask = document.querySelector('.hero-flask');
    expect(flask.tagName).toBe('BUTTON');
    expect(flask.getAttribute('aria-label')).toBeTruthy();
    flask.click();
    expect(flask.dataset.reaction).toBe('1');
  });
});
