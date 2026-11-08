/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  animatedThumbnailPath, authorName, matchesQuery, renderAuthor, renderTagFilters, setDiscoveryCount, thumbnailPath,
} from './catalogue-ui.js';

describe('shared discovery controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="filters"></div><p id="catalogue-status" role="status"></p>';
  });

  it('matches accents, case and all words across fields', () => {
    expect(matchesQuery('  eCHEcs stratégie ', 'Échecs', 'Jeu de stratégie')).toBe(true);
    expect(matchesQuery('echecs musique', 'Échecs', 'Jeu de stratégie')).toBe(false);
    expect(matchesQuery('', 'Échecs')).toBe(true);
  });

  it('reads the author from a string or an object and ignores the Anonyme default', () => {
    expect(authorName({ author: ' Cyrille ' })).toBe('Cyrille');
    expect(authorName({ author: { name: 'Émilie' } })).toBe('Émilie');
    expect(authorName({ author: 'Anonyme' })).toBe('');
    expect(authorName({})).toBe('');
    expect(authorName(undefined)).toBe('');
  });

  it('shows « Par <auteur> » and hides the line when the author is unknown', () => {
    const target = document.createElement('p');
    renderAuthor(target, { author: 'Cyrille' });
    expect(target.textContent).toBe('Par Cyrille');
    expect(target.hidden).toBe(false);
    renderAuthor(target, { author: 'Anonyme' });
    expect(target.textContent).toBe('');
    expect(target.hidden).toBe(true);
  });

  it('preserves button identity and focus while updating counts and selection', () => {
    const container = document.getElementById('filters');
    renderTagFilters(container, [{ id: 'science', label: 'Science', count: 3 }], null);
    const button = container.children[1];
    button.focus();
    renderTagFilters(container, [{ id: 'science', label: 'Science', count: 2 }], 'science');
    expect(document.activeElement).toBe(button);
    expect(container.children[1]).toBe(button);
    expect(button.textContent).toBe('Science (2)');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.children[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('restores focus after reorder and removal using the category contract', () => {
    const container = document.getElementById('filters');
    const tags = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    renderTagFilters(container, tags, 'a', { attribute: 'category', allLabel: 'Tout explorer' });
    container.children[1].focus();
    renderTagFilters(container, tags.toReversed(), 'a', { attribute: 'category' });
    expect(document.activeElement.dataset.category).toBe('a');
    renderTagFilters(container, [tags[1]], null, { attribute: 'category' });
    expect(document.activeElement.dataset.category).toBe('');
  });

  it('renders filter labels as text and announces a natural count', () => {
    const container = document.getElementById('filters');
    renderTagFilters(container, [{ id: 'x', label: '<img src=x>' }], null);
    expect(container.querySelector('img')).toBeNull();
    setDiscoveryCount(1, 'outils');
    expect(document.getElementById('catalogue-status').textContent).toBe('1 outil');
    setDiscoveryCount(2, 'jeux');
    expect(document.getElementById('catalogue-status').textContent).toBe('2 jeux');
  });

  it('donne le chemin conventionnel de la vignette d’un jeu ou d’un outil', () => {
    expect(thumbnailPath('game', { path: 'games/dames/index.html' })).toBe('games/dames/thumb.png');
    expect(thumbnailPath('tool', { path: 'tools/json-formatter.html' })).toBe('tools/json-formatter-thumb.png');
    expect(thumbnailPath('tool', { path: 'tools/l-systems/index.html' })).toBe('tools/l-systems/index-thumb.png');
  });

  it('dérive le chemin de la variante animée d’une vignette', () => {
    expect(animatedThumbnailPath('games/dames/thumb.png')).toBe('games/dames/thumb.anim.webp');
    expect(animatedThumbnailPath('tools/json-formatter-thumb.png')).toBe('tools/json-formatter-thumb.anim.webp');
    expect(animatedThumbnailPath('assets/banner.png')).toBe('assets/banner.anim.webp');
  });
});
