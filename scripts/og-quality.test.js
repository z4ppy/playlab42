import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { loadCache, saveCache, fetchOGMetadata, hashUrl } from './og-fetcher.js';
import { getRootDir } from './lib/build-utils.js';
import { editorialMetadata } from './lib/bookmark-metadata.js';

const url = 'https://build-quality.test/page';
let directory;
let ownedImages;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'playlab-og-quality-'));
  ownedImages = new Set();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  for (const path of ownedImages) {rmSync(path, { force: true });}
  rmSync(directory, { recursive: true, force: true });
});

describe('Qualité des métadonnées et du cache OG', () => {
  test('distinguer cache absent, valide et corrompu sans toucher le cache réel', () => {
    const path = join(directory, 'cache.json');
    expect(loadCache(path)).toEqual({});
    const cache = { [url]: { ogTitle: 'Titre', fetchedAt: '2026-03-01T00:00:00.000Z' } };
    writeFileSync(path, JSON.stringify(cache));
    expect(loadCache(path)).toEqual(cache);
    writeFileSync(path, '{');
    expect(() => loadCache(path)).toThrow(/cache\.json/);
  });

  test('persister puis relire un cache sans modifier les données', () => {
    const path = join(directory, 'nested/cache.json');
    const cache = { [url]: { ogTitle: 'Titre' } };
    saveCache(cache, path);
    expect(loadCache(path)).toEqual(cache);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(cache);
  });

  test.each([
    ['futur', '2026-03-09T00:00:00.000Z', false],
    ['invalide', 'not-a-date', false],
    ['exactement sept jours', '2026-03-01T00:00:00.000Z', false],
    ['juste avant expiration', '2026-03-01T00:00:00.001Z', true],
  ])('respecter la borne de cache : %s', async (_label, fetchedAt, fromCache) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T00:00:00.000Z'));
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('<title>Actualisé</title>'),
    });
    const result = await fetchOGMetadata(url, { [url]: { ogTitle: 'Ancien', fetchedAt } });
    expect(result.fromCache).toBe(fromCache);
    expect(result.meta.ogTitle).toBe(fromCache ? 'Ancien' : 'Actualisé');
    expect(fetch).toHaveBeenCalledTimes(fromCache ? 0 : 1);
  });

  test('remplacer les entités numériques invalides sans perdre la page', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      text: () => Promise.resolve('<title>Title &#x110000; &#0; &#55296; &#99999999;</title>'),
    });
    const result = await fetchOGMetadata(url, {});
    expect(result.failed).toBeUndefined();
    expect(result.meta.ogTitle).toBe('Title \uFFFD \uFFFD \uFFFD \uFFFD');
  });

  test.each([
    ['<meta content="A > B &amp; C" property="og:title">', { ogTitle: 'A > B & C' }],
    ['<meta property="og:title" content="O\'Reilly"><title>Repli</title>', { ogTitle: 'O\'Reilly' }],
    ['<meta property="og:title" content=""><meta property="og:title" content="Titre">', { ogTitle: 'Titre' }],
    ['<meta CONTENT="Description" NAME="description">', { ogDescription: 'Description' }],
    ['<meta property="og:site_name" content="Site &#x1F600;">', { ogSiteName: 'Site \uD83D\uDE00' }],
    ['<meta property="og:description" content="Texte &#233;">', { ogDescription: 'Texte é' }],
    ['<meta property="og:title" content="Ligne\nsuivante">', { ogTitle: 'Ligne\nsuivante' }],
  ])('préserver les attributs et les replis valides : %s', async (html, expected) => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(html),
    });
    const result = await fetchOGMetadata(url, {});
    expect(result.failed).toBeUndefined();
    expect(result.meta).toMatchObject(expected);
  });

  test.each([
    ['image/jpeg', '/image.bin', '.jpg'],
    ['image/png', '/image.bin', '.png'],
    ['image/gif', '/image.bin', '.gif'],
    ['image/webp', '/image.bin', '.webp'],
    ['image/svg+xml', '/image.bin', '.svg'],
    ['application/octet-stream', '/image.jpeg', '.jpg'],
    [null, '/image.png', '.png'],
    [null, '/image.unknown', '.jpg'],
    ['image/png', '/image.png?a=1&amp;b=2', '.png', '/image.png?a=1&b=2'],
    ['image/png', '/image.png?a=1&amp;amp;b=2', '.png', '/image.png?a=1&amp;b=2'],
  ])('télécharger réellement les octets du type %s, chemin %s', async (contentType, image, extension, decodedImage = image) => {
    const pageUrl = `${url}/${basename(directory)}`;
    const relative = `data/bookmarks-images/${hashUrl(pageUrl)}${extension}`;
    const path = join(getRootDir(import.meta.url), relative);
    ownedImages.add(path);
    const page = { ok: true, status: 200, text: () => Promise.resolve(`<meta property="og:image" content="${image}">`) };
    const fetch = jest.spyOn(global, 'fetch')
      .mockResolvedValue(page)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce({ ok: true, headers: { get: () => contentType }, arrayBuffer: () => Promise.resolve(Buffer.from('image-bytes')) });
    const result = await fetchOGMetadata(pageUrl, {});
    expect(result.failed).toBeUndefined();
    expect(result.meta.ogImage).toBe(relative);
    expect(result.meta.ogImageOriginal).toBe(image);
    expect(readFileSync(path, 'utf8')).toBe('image-bytes');
    expect(fetch.mock.calls[1][0]).toBe(new URL(decodedImage, pageUrl).href);
    expect(editorialMetadata(result, pageUrl).ogImage).toBe(new URL(decodedImage, pageUrl).href);
    const again = await fetchOGMetadata(pageUrl, {});
    expect(again.meta.ogImage).toBe(relative);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('conserver une image locale si une page valide a perdu sa balise OG', async () => {
    const pageUrl = `${url}/${basename(directory)}`;
    const relative = `data/bookmarks-images/${hashUrl(pageUrl)}.png`;
    const path = join(getRootDir(import.meta.url), relative);
    ownedImages.add(path);
    writeFileSync(path, 'optimized');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('<title>Title</title>'),
    });
    const result = await fetchOGMetadata(pageUrl, {});
    expect(result.meta).toMatchObject({ ogImage: relative, fromVersionedImage: true, ogTitle: 'Title' });
    expect(readFileSync(path, 'utf8')).toBe('optimized');
  });
});
