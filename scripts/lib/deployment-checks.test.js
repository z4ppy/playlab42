import { jest } from '@jest/globals';
import { createResourceReader, resolveResourceURL } from './deployment-resources.js';
import {
  checkPublishedManifest, findFirstSlideId, validateCatalogues, validateIdentity, validateTarget,
} from './deployment-validators.js';

const commit = 'a'.repeat(40);

describe('validateTarget', () => {
  test('normaliser le slash final et conserver le sous-chemin', () => {
    expect(validateTarget('https://example.test/playlab42', null).href).toBe('https://example.test/playlab42/');
    expect(validateTarget('http://localhost:8080/', commit).href).toBe('http://localhost:8080/');
  });

  test('refuser URL non sûre et SHA incomplet, un SHA vide étant invalide', () => {
    expect(() => validateTarget('file:///site', null)).toThrow('URL de publication invalide');
    expect(() => validateTarget('https://u:p@example.test/', null)).toThrow('URL de publication invalide');
    expect(() => validateTarget('https://example.test/', '')).toThrow('SHA Git complet');
    expect(() => validateTarget('https://example.test/', 'a'.repeat(39))).toThrow('SHA Git complet');
  });
});

describe('validateIdentity', () => {
  test('accepter version non vide et commit complet ou nul, sans exigence sans SHA attendu', () => {
    expect(() => validateIdentity({ version: '1', commit }, null)).not.toThrow();
    expect(() => validateIdentity({ version: '1', commit: null }, null)).not.toThrow();
    expect(() => validateIdentity({ version: '1', commit: commit.toUpperCase() }, commit)).not.toThrow();
  });

  test('refuser une identité invalide ou un autre commit', () => {
    for (const identity of [undefined, null, {}, { version: '', commit }, { version: '1', commit: 'x' }]) {
      expect(() => validateIdentity(identity, null)).toThrow('Identité du build absente ou invalide.');
    }
    expect(() => validateIdentity({ version: '1', commit }, 'b'.repeat(40)))
      .toThrow(`Commit publié différent : attendu ${'b'.repeat(40)}, reçu ${commit}.`);
  });
});

describe('checkPublishedManifest', () => {
  const identity = { version: '1', commit };
  const manifest = { formatVersion: 1, ...identity, files: [{}], inputs: { a: '1' } };

  test('exiger forme, identité et entrées attendues', () => {
    expect(() => checkPublishedManifest(manifest, identity, { a: '1' })).not.toThrow();
    expect(() => checkPublishedManifest(manifest, identity, { a: '2' })).toThrow('sources attendues : a.');
    expect(() => checkPublishedManifest({ ...manifest, inputs: undefined }, identity, { a: '1' })).toThrow('sources attendues');
    expect(() => checkPublishedManifest(undefined, identity, {})).toThrow('Manifeste de fabrication');
    expect(() => checkPublishedManifest({ ...manifest, files: [] }, identity, {})).toThrow('Manifeste de fabrication');
  });
});

describe('validateCatalogues et findFirstSlideId', () => {
  const full = [{ x: 1 }];

  test('nommer la première liste invalide, dans l’ordre des catalogues', () => {
    const ok = [{ tools: full, games: full }, { epics: full }, { categories: full }];
    expect(() => validateCatalogues(...ok)).not.toThrow();
    expect(() => validateCatalogues({ tools: full }, ok[1], ok[2])).toThrow('games');
    expect(() => validateCatalogues(ok[0], undefined, undefined)).toThrow('epics');
    expect(() => validateCatalogues(ok[0], ok[1], { categories: [] })).toThrow('categories');
  });

  test('trouver la première slide en profondeur et valider son identifiant', () => {
    const epic = { path: 'p', structure: [{ children: [{ children: [] }, { children: [{ type: 'slide', id: 'a-1' }] }] }] };
    expect(findFirstSlideId(epic)).toBe('a-1');
    expect(() => findFirstSlideId({ path: 'p', structure: [{ type: 'slide', id: 'A' }] })).toThrow('aucune slide valide');
    expect(() => findFirstSlideId({ path: 'p', structure: [null] })).toThrow('Entrée de parcours invalide');
    expect(() => findFirstSlideId({ structure: [] })).toThrow('Structure du premier parcours invalide');
  });
});

describe('lecture bornée au site publié', () => {
  const base = new URL('https://example.test/playlab42/');
  afterEach(() => jest.restoreAllMocks());

  test('résoudre uniquement sous l’origine et le sous-chemin', () => {
    expect(resolveResourceURL(base, 'a/b.json').href).toBe('https://example.test/playlab42/a/b.json');
    for (const path of ['/a', '../a', 'https://other.test/playlab42/a']) {
      expect(() => resolveResourceURL(base, path)).toThrow('hors du site publié');
    }
    for (const path of ['', undefined, 3]) {
      expect(() => resolveResourceURL(base, path)).toThrow('Chemin de ressource absent');
    }
  });

  test('ne compter que les réponses réussies avant lecture du corps', async () => {
    const answers = [new Response('{"a":1}'), new Response('x', { status: 500 }), new Response('{', { status: 200 })];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(answers.shift()));
    const reader = createResourceReader(base);
    await expect(reader.read('a.json', true)).resolves.toEqual({ a: 1 });
    await expect(reader.read('b.json', true)).rejects.toThrow('HTTP 500 : https://example.test/playlab42/b.json');
    await expect(reader.read('c.json', true)).rejects.toThrow('JSON invalide');
    expect(reader.count()).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
