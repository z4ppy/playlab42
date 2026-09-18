/**
 * Tests: scripts/og-fetcher.js - préservation des images OG déjà téléchargées
 *
 * Les fichiers de data/bookmarks-images/ sont versionnés et peuvent avoir été
 * optimisés : le build ne doit pas les réécrire avec l'original pleine taille.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { findExistingImage, hashUrl } from './og-fetcher.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = join(ROOT, 'data', 'bookmarks-images');

const TEST_URL = 'https://exemple.test/og-fetcher-jest';
const TEST_FILE = join(IMAGES_DIR, `${hashUrl(TEST_URL)}.png`);

afterEach(() => {
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
  }
});

describe('og-fetcher: findExistingImage', () => {
  it('retourne null quand aucune image locale ne correspond', () => {
    expect(findExistingImage('https://exemple.test/jamais-telecharge')).toBeNull();
  });

  it("retourne le chemin relatif de l'image déjà présente, extension comprise", () => {
    mkdirSync(IMAGES_DIR, { recursive: true });
    writeFileSync(TEST_FILE, 'image-optimisee');

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
