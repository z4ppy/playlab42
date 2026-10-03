import { validateOGSnapshot, loadOGSnapshot, editorialMetadata } from './lib/bookmark-metadata.js';
import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('accepter les métadonnées éditoriales sans imposer la TTL du cache technique', () => {
  const entries = { 'https://example.test': { ogTitle: 'Titre', fetchedAt: '2020-01-01', fromVersionedImage: true } };
  expect(validateOGSnapshot({ version: 1, entries })).toBe(entries);
});

test('lire le vrai fichier source et contextualiser sa corruption ou absence', () => {
  const root = mkdtempSync(join(tmpdir(), 'playlab-snapshot-'));
  const path = join(root, 'snapshot.json');
  try {
    writeFileSync(path, '{"version":1,"entries":{}}');
    expect(loadOGSnapshot(path)).toEqual({});
    writeFileSync(path, '{');
    expect(() => loadOGSnapshot(path)).toThrow(/snapshot\.json/);
    rmSync(path);
    expect(() => loadOGSnapshot(path)).toThrow(/snapshot\.json/);
    expect(loadOGSnapshot(path, true)).toEqual({});
    writeFileSync(path, '{}');
    expect(() => loadOGSnapshot(path, true)).toThrow(/Snapshot/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ne jamais transformer une image du cache technique en dépendance locale du snapshot', () => {
  const url = 'https://example.test/page';
  const cached = { ogImage: 'data/bookmarks-images/cache.png', ogImageOriginal: '/preview.png?a=1&amp;b=2' };
  expect(editorialMetadata({ meta: cached }, url).ogImage).toBe('https://example.test/preview.png?a=1&b=2');
  expect(cached.ogImage).toBe('data/bookmarks-images/cache.png');
  const prior = { [url]: { ogImage: 'data/bookmarks-images/reviewed.png', ogTitle: 'Revu' } };
  expect(editorialMetadata({ meta: cached }, url, prior).ogImage).toBe(prior[url].ogImage);
  expect(editorialMetadata({ failed: true, meta: null }, url, prior)).toEqual(prior[url]);
  expect(editorialMetadata({ meta: { ogTitle: 'Titre' } }, url)).toEqual({ ogTitle: 'Titre' });
  expect(() => editorialMetadata({ meta: { ...cached, ogImageOriginal: 'file:///private' } }, url)).toThrow(/distante invalide/);
  expect(() => editorialMetadata({ meta: { ...cached, ogImageOriginal: 'https://user:password@example.test' } }, url)).toThrow(/distante invalide/);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(editorialMetadata({ failed: true, meta: { ogImage: cached.ogImage, fromVersionedImage: true } }, url)).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non retenue'));
  } finally {
    warn.mockRestore();
  }
});
test.each([
  {}, { version: 2, entries: {} }, { version: 1, entries: [] },
  { version: 1, entries: { 'https://example.test': null } },
  { version: 1, entries: { 'https://example.test': [] } },
  { version: 1, entries: { 'https://example.test': { ogTitle: 4 } } },
  { version: 1, entries: { 'https://example.test': { fromVersionedImage: 'true' } } },
  { version: 1, entries: { 'https://example.test': { unknown: 'field' } } },
  { version: 1, entries: { 'file:///private': {} } },
])('refuser un snapshot source invalide sans retour silencieux', snapshot => {
  expect(() => validateOGSnapshot(snapshot)).toThrow();
});
