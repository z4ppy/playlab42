import { validateOGSnapshot, loadOGSnapshot } from './lib/bookmark-metadata.js';
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
  } finally {
    rmSync(root, { recursive: true, force: true });
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
