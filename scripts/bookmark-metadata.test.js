import { validateOGSnapshot, loadOGSnapshot, editorialMetadata } from './lib/bookmark-metadata.js';
import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

test('accepter les métadonnées éditoriales sans imposer la TTL du cache technique', () => {
  const entries = { 'https://example.test': { ogTitle: 'Titre', fetchedAt: '2020-01-01', fromVersionedImage: true } };
  expect(validateOGSnapshot({ version: 1, entries })).toBe(entries);
});

test('préserver toutes les valeurs éditoriales autorisées sans copie ni mutation', () => {
  const entries = Object.freeze({
    'http://example.test': Object.freeze({
      ogTitle: '', ogDescription: 'Description', ogImage: '/image.png',
      ogImageOriginal: '/original.png', ogSiteName: 'Site', favicon: '/icon.svg',
      fetchedAt: 'date éditoriale', fromVersionedImage: false,
    }),
  });
  expect(validateOGSnapshot(Object.freeze({ version: 1, entries }))).toBe(entries);
});

test.each(['ogTitle', 'ogDescription', 'ogImage', 'ogImageOriginal', 'ogSiteName', 'favicon', 'fetchedAt'])(
  'refuser exactement le champ texte %s avant extraction', key => {
    expect(() => validateOGSnapshot({ version: 1, entries: {
      'https://example.test': { [key]: false },
    } })).toThrow(`Champ du snapshot OG invalide : https://example.test, ${key}`);
  },
);

test('conserver la priorité de validation structure, URL, entrée puis champ', () => {
  expect(() => validateOGSnapshot({ version: 2, entries: { invalid: null } }))
    .toThrow('Snapshot OG invalide : version 1 et entries objet requis.');
  expect(() => validateOGSnapshot({ version: 1, entries: { 'file:///private': { unknown: true } } }))
    .toThrow('Entrée du snapshot OG invalide : file:///private');
  expect(() => validateOGSnapshot({ version: 1, entries: { invalid: null } }))
    .toThrow(expect.objectContaining({ name: 'TypeError', code: 'ERR_INVALID_URL' }));
  expect(() => validateOGSnapshot({ version: 1, entries: { 'https://example.test': 1 } }))
    .toThrow('Entrée du snapshot OG invalide : https://example.test');
});

test('lire le vrai fichier source et contextualiser sa corruption ou absence', () => {
  const root = mkdtempSync(join(process.cwd(), '.playlab-snapshot-'));
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

test.each([
  { ogImage: 'https://cdn.example.test/new.png', fromVersionedImage: false },
  {},
  { ogImage: 'data/bookmarks-images/cache.png', fromVersionedImage: true },
])('conserver l’image locale revue après une collecte réussie : %j', image => {
  const url = 'https://example.test/page';
  const priorMeta = Object.freeze({
    ogImage: 'data/bookmarks-images/reviewed.png',
    ogImageOriginal: '/old.png',
    fromVersionedImage: true,
    ogTitle: 'Ancien titre',
    ogDescription: 'Ancienne description',
    fetchedAt: '2020-01-01',
  });
  const prior = Object.freeze({ [url]: priorMeta });
  const meta = Object.freeze({
    ...image,
    ogImageOriginal: '/new.png?a=1&amp;amp;b=2',
    ogTitle: 'Nouveau titre',
    ogDescription: 'Nouvelle description',
    fetchedAt: '2026-10-03',
  });
  const result = Object.freeze({ failed: false, meta });
  const snapshot = JSON.stringify({ result, prior });
  const output = editorialMetadata(result, url, prior);
  expect(output).toEqual({ ...meta, ogImage: priorMeta.ogImage });
  expect(output).not.toBe(meta);
  expect(output).not.toBe(priorMeta);
  expect(JSON.stringify({ result, prior })).toBe(snapshot);
});

test.each([null, {}, { ogTitle: 'Partiel', ogImage: 'https://cdn.example.test/new.png' }])(
  'conserver intégralement une copie du snapshot précédent en cas d’échec : %j',
  meta => {
    const url = 'https://example.test/page';
    const priorMeta = Object.freeze({
      ogTitle: 'Titre revu', ogImage: 'data/bookmarks-images/reviewed.png',
      ogImageOriginal: '/reviewed.png', fromVersionedImage: true, fetchedAt: '2020-01-01',
    });
    const prior = Object.freeze({ [url]: priorMeta });
    const result = Object.freeze({ failed: true, meta: meta && Object.freeze(meta) });
    const output = editorialMetadata(result, url, prior);
    expect(output).toEqual(priorMeta);
    expect(output).not.toBe(priorMeta);
    output.ogTitle = 'Copie modifiée';
    expect(priorMeta.ogTitle).toBe('Titre revu');
  },
);

test.each([undefined, {}, { 'https://example.test/page': { ogImage: 'https://cdn.example.test/old.png' } }])(
  'sans image locale revue, conserver le repli distant et décoder une seule fois : %j',
  previous => {
    const url = 'https://example.test/page';
    const rawOriginal = '/preview.png?a=1&amp;amp;b=2';
    const meta = Object.freeze({
      ogImage: 'data/bookmarks-images/cache.png',
      ogImageOriginal: rawOriginal,
      fromVersionedImage: true,
      ogTitle: 'Titre',
    });
    for (const failed of [false, true]) {
      const result = Object.freeze({ failed, meta });
      const output = editorialMetadata(result, url, previous);
      if (failed && previous?.[url]) {
        expect(output).toEqual(previous[url]);
        expect(output).not.toBe(previous[url]);
      } else {
        expect(output).toEqual({
          ogImage: 'https://example.test/preview.png?a=1&amp;b=2',
          ogImageOriginal: rawOriginal,
          ogTitle: 'Titre',
        });
      }
    }
    expect(meta.ogImage).toBe('data/bookmarks-images/cache.png');
    expect(meta.ogImageOriginal).toBe(rawOriginal);
    expect(meta.fromVersionedImage).toBe(true);
  },
);

test.each([false, true])('sans snapshot précédent ni image locale, copier la collecte (échec : %s)', failed => {
  const url = 'https://example.test/page';
  for (const meta of [null, Object.freeze({ ogTitle: 'Titre' }), Object.freeze({
    ogTitle: 'Titre', ogImage: 'https://cdn.example.test/new.png?a=1&amp;b=2',
  })]) {
    const output = editorialMetadata(Object.freeze({ failed, meta }), url);
    expect(output).toEqual(meta ?? {});
    expect(output).not.toBe(meta);
  }
});

test.each([false, true])('écarter le cache technique sans URL originale (échec : %s)', failed => {
  const meta = Object.freeze({
    ogTitle: 'Titre', ogImage: 'data/bookmarks-images/cache.png', fromVersionedImage: true,
  });
  const result = Object.freeze({ failed, meta });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(editorialMetadata(result, 'https://example.test/page')).toEqual({ ogTitle: 'Titre' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non retenue'));
    expect(result.meta).toBe(meta);
    expect(meta.ogImage).toBe('data/bookmarks-images/cache.png');
    expect(meta.fromVersionedImage).toBe(true);
  } finally {
    warn.mockRestore();
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
