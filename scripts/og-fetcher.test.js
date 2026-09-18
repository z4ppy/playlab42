/**
 * Tests: scripts/og-fetcher.js - images OG versionnées
 *
 * Les fichiers de data/bookmarks-images/ sont versionnés. Ils remplissent deux
 * rôles, couverts ici :
 *   1. le build ne doit pas les réécrire avec l'original pleine taille ;
 *   2. ils doivent servir de repli quand la page n'est pas joignable.
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  findExistingImage,
  hashUrl,
  buildFallbackMeta,
  fetchOGMetadata,
} from './og-fetcher.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = join(ROOT, 'data', 'bookmarks-images');

const TEST_URL = 'https://exemple.test/og-fetcher-jest';
const TEST_FILE = join(IMAGES_DIR, `${hashUrl(TEST_URL)}.png`);
const ABSENT_URL = 'https://exemple.test/jamais-telecharge';

/** Crée l'image versionnée factice utilisée par les tests de repli. */
function creerImageVersionnee() {
  mkdirSync(IMAGES_DIR, { recursive: true });
  writeFileSync(TEST_FILE, 'image-optimisee');
}

afterEach(() => {
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
  }
  jest.restoreAllMocks();
});

describe('og-fetcher: findExistingImage', () => {
  it('retourne null quand aucune image locale ne correspond', () => {
    expect(findExistingImage(ABSENT_URL)).toBeNull();
  });

  it("retourne le chemin relatif de l'image déjà présente, extension comprise", () => {
    creerImageVersionnee();

    expect(findExistingImage(TEST_URL)).toBe(
      `data/bookmarks-images/${hashUrl(TEST_URL)}.png`,
    );
  });

  it('dérive le nom de fichier du hash de l’URL de la page', () => {
    expect(hashUrl(TEST_URL)).toMatch(/^[0-9a-f]{12}$/);
    expect(hashUrl(TEST_URL)).toBe(hashUrl(TEST_URL));
    expect(hashUrl(TEST_URL)).not.toBe(hashUrl(`${TEST_URL}/autre`));
  });
});

describe('og-fetcher: buildFallbackMeta', () => {
  it('retourne null quand aucune image versionnée ne correspond', () => {
    expect(buildFallbackMeta(ABSENT_URL)).toBeNull();
  });

  it("pointe sur l'image versionnée et se signale comme repli", () => {
    creerImageVersionnee();

    const meta = buildFallbackMeta(TEST_URL);

    expect(meta.ogImage).toBe(`data/bookmarks-images/${hashUrl(TEST_URL)}.png`);
    expect(meta.fromVersionedImage).toBe(true);
    expect(meta.favicon).toBe('https://exemple.test/favicon.ico');
  });

  it("ne porte pas de fetchedAt : le repli ne doit pas s'installer dans le cache", () => {
    creerImageVersionnee();

    // Un fetchedAt rendrait l'entrée « valide » pendant cacheDays et
    // empêcherait toute nouvelle tentative réseau pendant une semaine.
    expect(buildFallbackMeta(TEST_URL)).not.toHaveProperty('fetchedAt');
  });
});

describe('og-fetcher: repli de fetchOGMetadata sur échec réseau', () => {
  it("conserve l'image versionnée quand la page est injoignable", async () => {
    creerImageVersionnee();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));

    const { meta, failed, fromCache } = await fetchOGMetadata(TEST_URL, {});

    expect(failed).toBe(true);
    expect(fromCache).toBe(false);
    expect(meta.ogImage).toBe(`data/bookmarks-images/${hashUrl(TEST_URL)}.png`);
  });

  it("conserve l'image versionnée sur une réponse HTTP en erreur", async () => {
    creerImageVersionnee();
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 });

    const { meta, failed } = await fetchOGMetadata(TEST_URL, {});

    expect(failed).toBe(true);
    expect(meta.fromVersionedImage).toBe(true);
  });

  it('retourne meta null quand aucune image versionnée ne peut prendre le relais', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));

    const { meta, failed } = await fetchOGMetadata(ABSENT_URL, {});

    expect(failed).toBe(true);
    expect(meta).toBeNull();
  });

  it("n'écrit pas le repli dans le cache, pour laisser le prochain build réessayer", async () => {
    creerImageVersionnee();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));
    const cache = {};

    await fetchOGMetadata(TEST_URL, cache);

    expect(cache).toEqual({});
  });

  it('sert le cache valide sans repli ni appel réseau', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const cache = {
      [TEST_URL]: { ogTitle: 'Titre en cache', fetchedAt: new Date().toISOString() },
    };

    const { meta, fromCache } = await fetchOGMetadata(TEST_URL, cache);

    expect(fromCache).toBe(true);
    expect(meta.ogTitle).toBe('Titre en cache');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
