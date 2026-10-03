import { afterEach, describe, expect, test } from '@jest/globals';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashUrl } from './og-fetcher.js';

let root;

afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
    root = undefined;
  }
});

function build(args, snapshot = {
  version: 1, entries: { 'https://example.invalid/docs': { ogDescription: 'Snapshot revu' } },
}, prepare = () => {}) {
  root = mkdtempSync(join(tmpdir(), 'bookmarks-offline-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bookmarks'));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'metadata'));
  writeFileSync(join(root, 'metadata/bookmarks-og.json'), JSON.stringify(snapshot));
  writeFileSync(join(root, 'data/bookmarks.json'), '{"previous":true}');
  for (const filename of ['build-bookmarks.js', 'og-fetcher.js']) {
    cpSync(fileURLToPath(new URL(filename, import.meta.url)), join(root, 'scripts', filename));
  }
  cpSync(fileURLToPath(new URL('lib', import.meta.url)), join(root, 'scripts', 'lib'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(join(root, 'bookmarks', 'index.json'), JSON.stringify({
    categories: [{ id: 'demo', label: 'Demo', order: 1 }],
  }));
  writeFileSync(join(root, 'bookmarks', 'demo.json'), JSON.stringify({
    category: 'demo',
    bookmarks: [{ title: 'Documentation', url: 'https://example.invalid/docs', tags: ['demo'] }],
  }));
  prepare(root);
  const script = `
    let requests = 0;
    globalThis.fetch = () => { requests++; throw new Error('Réseau interdit dans ce scénario'); };
    process.on('exit', () => { if (requests) process.exitCode = 89; });
    process.argv.push(...${JSON.stringify(args)});
    await import('./scripts/build-bookmarks.js');
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
}

describe('Catalogue bookmarks sans enrichissement réseau', () => {
  test('génère le vrai catalogue sans effectuer aucune requête', () => {
    const result = build(['--skip-og']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const catalogue = JSON.parse(readFileSync(join(root, 'data', 'bookmarks.json'), 'utf8'));
    expect(catalogue.categories[0].bookmarks).toEqual([expect.objectContaining({
      title: 'Documentation', url: 'https://example.invalid/docs', domain: 'example.invalid',
    })]);
    expect(catalogue.tags).toEqual([{ id: 'demo', count: 1 }]);
    expect(result.stdout).toContain('Enrichissement Open Graph ignoré');
  });

  test('utilise le snapshot par défaut sans effectuer une requête', () => {
    const result = build([]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const catalogue = JSON.parse(readFileSync(join(root, 'data/bookmarks.json'), 'utf8'));
    expect(catalogue.categories[0].bookmarks[0].displayDescription).toBe('Snapshot revu');
    expect(result.stdout).toContain('snapshot éditorial');
  });

  test('réserve les tentatives réseau au refresh éditorial explicite', () => {
    const result = build(['--refresh-og']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(89);
    expect(result.stdout).not.toContain('Enrichissement Open Graph ignoré');
    expect(JSON.parse(readFileSync(join(root, 'metadata/bookmarks-og.json'), 'utf8')).entries['https://example.invalid/docs'])
      .toEqual({ ogDescription: 'Snapshot revu' });
  });

  test('ne pas utiliser une image du cache pour une URL absente du snapshot', () => {
    const result = build([], { version: 1, entries: {} }, directory => {
      mkdirSync(join(directory, 'data/bookmarks-images'));
      writeFileSync(join(directory, `data/bookmarks-images/${hashUrl('https://example.invalid/docs')}.png`), 'technical cache');
    });
    expect(result.status).toBe(0);
    const catalogue = JSON.parse(readFileSync(join(root, 'data/bookmarks.json'), 'utf8'));
    expect(catalogue.categories[0].bookmarks[0].meta).toEqual({});
    expect(result.stdout).toContain('Métadonnées OG absentes du snapshot');
  });

  test('un refresh réutilisant le cache ne promeut pas son image locale', () => {
    const url = 'https://example.invalid/docs';
    const result = build(['--refresh-og'], { version: 1, entries: {} }, directory => {
      writeFileSync(join(directory, 'data/bookmarks-cache.json'), JSON.stringify({
        [url]: {
          fetchedAt: new Date().toISOString(), ogImage: 'data/bookmarks-images/cache.png',
          ogImageOriginal: '/preview.png?a=1&amp;b=2',
        },
      }));
    });
    expect(result.status).toBe(0);
    const snapshot = JSON.parse(readFileSync(join(root, 'metadata/bookmarks-og.json'), 'utf8'));
    expect(snapshot.entries[url].ogImage).toBe('https://example.invalid/preview.png?a=1&b=2');
    const catalogue = JSON.parse(readFileSync(join(root, 'data/bookmarks.json'), 'utf8'));
    expect(catalogue.categories[0].bookmarks[0].meta.ogImage).toBe(snapshot.entries[url].ogImage);
  });

  test.each([null, { version: 2, entries: {} }])('refuser un snapshot corrompu sans réseau ni remplacement du catalogue', snapshot => {
    const result = build([], snapshot);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Build Bookmarks impossible');
    expect(readFileSync(join(root, 'data/bookmarks.json'), 'utf8')).toBe('{"previous":true}');
  });

  test('refuser les options contradictoires sans annoncer un build réussi', () => {
    const result = build(['--skip-og', '--refresh-og']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('incompatibles');
  });
});
