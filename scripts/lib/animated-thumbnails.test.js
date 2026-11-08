/**
 * Tests du repérage des vignettes animées au build.
 */
import { epicAnimatedThumbnail, markAnimatedThumbnails } from './animated-thumbnails.js';

describe('markAnimatedThumbnails', () => {
  const existing = new Set(['/repo/games/dames/thumb.anim.webp', '/repo/tools/json-thumb.anim.webp']);
  const exists = path => existing.has(path);

  test('marque les jeux dont la variante animée existe, sans toucher aux autres', () => {
    const games = [{ id: 'dames', path: 'games/dames/index.html' }, { id: 'go', path: 'games/go/index.html' }];
    expect(markAnimatedThumbnails(games, 'game', '/repo', exists)).toEqual([
      { id: 'dames', path: 'games/dames/index.html', animatedThumbnail: true },
      { id: 'go', path: 'games/go/index.html' },
    ]);
  });

  test('suit la convention des vignettes d\'outils', () => {
    const tools = [{ id: 'json', path: 'tools/json.html' }];
    expect(markAnimatedThumbnails(tools, 'tool', '/repo', exists)[0].animatedThumbnail).toBe(true);
  });
});

describe('epicAnimatedThumbnail', () => {
  test('donne le chemin public de la variante animée d\'un parcours', () => {
    const exists = path => path === '/repo/parcours/epics/x/assets/banner.anim.webp';
    expect(epicAnimatedThumbnail('/repo/parcours/epics/x', 'assets/banner.png', './parcours/epics/x', exists))
      .toBe('./parcours/epics/x/assets/banner.anim.webp');
  });

  test('ne renvoie rien sans vignette ou sans variante', () => {
    expect(epicAnimatedThumbnail('/d', undefined, './p', () => true)).toBeUndefined();
    expect(epicAnimatedThumbnail('/d', 'thumbnail.jpg', './p', () => false)).toBeUndefined();
  });
});
