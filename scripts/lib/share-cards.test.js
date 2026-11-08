/**
 * Tests des cartes de partage des pages de jeux et d'outils.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  addShareCards, DEFAULT_SITE_URL, FALLBACK_IMAGE, injectShareTags, resolveSiteUrl, shareTags,
} from './share-cards.js';

const PAGE = '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <title>Jeu</title>\n</head>\n<body></body>\n</html>\n';

describe('resolveSiteUrl', () => {
  test('utilise l\'adresse GitHub Pages par défaut', () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('')).toBe(DEFAULT_SITE_URL);
  });

  test('ajoute le « / » final et retire requête et fragment', () => {
    expect(resolveSiteUrl('https://exemple.test/lab?x=1#top')).toBe('https://exemple.test/lab/');
  });

  test('refuse une adresse non HTTPS, inutilisable par les plateformes', () => {
    expect(() => resolveSiteUrl('http://exemple.test/')).toThrow('non HTTPS');
  });
});

describe('shareTags', () => {
  const card = {
    title: 'Dames & "Go" <test>', description: 'Desc', url: 'https://x.test/g/', image: 'https://x.test/i.png',
    imageAlt: 'Vignette', largeImage: false,
  };

  test('échappe les valeurs placées dans les attributs', () => {
    expect(shareTags(card)).toContain('content="Dames &amp; &quot;Go&quot; &lt;test&gt;"');
  });

  test('choisit la petite carte pour une vignette, la grande pour l\'image du site', () => {
    expect(shareTags(card)).toContain('name="twitter:card" content="summary"');
    expect(shareTags({ ...card, largeImage: true })).toContain('content="summary_large_image"');
  });
});

describe('injectShareTags', () => {
  test('insère les balises juste avant </head>', () => {
    const html = injectShareTags(PAGE, '  <meta property="og:title" content="T">\n');
    expect(html).toContain('<title>Jeu</title>\n  <meta property="og:title" content="T">\n</head>');
  });

  test('laisse intacte une page qui déclare déjà sa propre carte', () => {
    const page = PAGE.replace('</head>', '<meta property="og:title" content="Perso">\n</head>');
    expect(injectShareTags(page, '<meta property="og:title" content="T">')).toBe(page);
  });

  test('signale une page sans en-tête plutôt que de l\'ignorer', () => {
    expect(() => injectShareTags('<html><body></body></html>', '<meta>')).toThrow('sans </head>');
  });
});

describe('addShareCards', () => {
  let output;
  const put = (path, content = '') => {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    writeFileSync(join(output, path), content);
  };
  const read = path => readFileSync(join(output, path), 'utf8');
  const site = 'https://exemple.test/lab/';

  beforeEach(() => {
    output = mkdtempSync(join(tmpdir(), 'playlab-share-'));
  });
  afterEach(() => rmSync(output, { recursive: true, force: true }));

  test('donne à un jeu sa vignette et à un outil sans vignette l\'image du site', () => {
    put('data/catalogue.json', JSON.stringify({
      games: [{ id: 'dames', name: 'Dames', description: 'Jeu de dames', path: 'games/dames/index.html' }],
      tools: [{ id: 'json', name: 'JSON', description: 'Formateur', path: 'tools/json.html' }],
    }));
    put('games/dames/index.html', PAGE);
    put('games/dames/thumb.png');
    put('tools/json.html', PAGE);

    expect(addShareCards(output, site)).toBe(2);

    const game = read('games/dames/index.html');
    expect(game).toContain('content="Dames — Playlab42"');
    expect(game).toContain('content="https://exemple.test/lab/games/dames/index.html"');
    expect(game).toContain('content="https://exemple.test/lab/games/dames/thumb.png"');
    expect(game).toContain('content="summary"');

    const tool = read('tools/json.html');
    expect(tool).toContain(`content="https://exemple.test/lab/${FALLBACK_IMAGE}"`);
    expect(tool).toContain('content="summary_large_image"');
  });

  test('ne réécrit pas une page qui a déjà sa carte', () => {
    const page = PAGE.replace('</head>', '<meta property="og:title" content="Perso">\n</head>');
    put('data/catalogue.json', JSON.stringify({ games: [{ name: 'X', description: 'X', path: 'games/x/index.html' }] }));
    put('games/x/index.html', page);
    expect(addShareCards(output, site)).toBe(0);
    expect(read('games/x/index.html')).toBe(page);
  });

  test('accepte un catalogue sans jeux ni outils', () => {
    put('data/catalogue.json', '{}');
    expect(addShareCards(output, site)).toBe(0);
  });

  test('échoue si une page du catalogue manque au site', () => {
    put('data/catalogue.json', JSON.stringify({ games: [{ name: 'X', description: 'X', path: 'games/x/index.html' }] }));
    expect(() => addShareCards(output, site)).toThrow('Page du catalogue absente du site : games/x/index.html');
  });

  test('refuse un chemin qui sortirait du site', () => {
    put('data/catalogue.json', JSON.stringify({ tools: [{ name: 'X', description: 'X', path: '../secret.html' }] }));
    expect(() => addShareCards(output, site)).toThrow('Chemin hors du site');
  });
});
