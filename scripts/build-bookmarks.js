#!/usr/bin/env node
/**
 * Script de build pour le catalogue Bookmarks
 * Génère data/bookmarks.json à partir des fichiers bookmarks/ et des manifests
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fetchOGMetadata, loadCache, saveCache } from './og-fetcher.js';
import {
  getRootDir,
  extractDomain,
} from './lib/build-utils.js';

const ROOT = getRootDir(import.meta.url);
const BOOKMARKS_DIR = join(ROOT, 'bookmarks');
const TOOLS_DIR = join(ROOT, 'tools');
const GAMES_DIR = join(ROOT, 'games');
const EPICS_DIR = join(ROOT, 'parcours', 'epics');
const OUTPUT_FILE = join(ROOT, 'data', 'bookmarks.json');
const CONFIG_FILE = join(BOOKMARKS_DIR, 'index.json');

// Statistiques
const stats = {
  standalone: 0,
  fromModules: 0,
  duplicates: 0,
  ogFetched: 0,
  ogCached: 0,
  ogFailed: 0,
  // Échecs réseau pour lesquels l'image versionnée a pris le relais
  ogImageRecovered: 0,
  errors: [],
  warnings: [],
};

/**
 * Lit et parse un fichier JSON
 */
function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    stats.errors.push(`Erreur lecture ${path}: ${err.message}`);
    return null;
  }
}

/**
 * Valide un bookmark
 */
function validateBookmark(bookmark, source) {
  if (!bookmark.url) {
    stats.errors.push(`Bookmark sans URL (${source})`);
    return false;
  }
  if (!bookmark.title) {
    stats.errors.push(`Bookmark sans titre: ${bookmark.url} (${source})`);
    return false;
  }
  try {
    new URL(bookmark.url);
  } catch {
    stats.errors.push(`URL invalide: ${bookmark.url} (${source})`);
    return false;
  }
  return true;
}

/**
 * Scanne les fichiers bookmarks standalone
 */
function scanStandaloneBookmarks(config) {
  const categories = new Map();

  // Initialiser les catégories depuis la config
  for (const cat of config.categories || []) {
    categories.set(cat.id, {
      ...cat,
      bookmarks: [],
    });
  }

  // Scanner les fichiers JSON (sauf index.json)
  if (!existsSync(BOOKMARKS_DIR)) {
    stats.warnings.push('Dossier bookmarks/ non trouvé');
    return categories;
  }

  const files = readdirSync(BOOKMARKS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json');

  for (const file of files) {
    const filePath = join(BOOKMARKS_DIR, file);
    const data = readJSON(filePath);
    if (!data) {continue;}

    const categoryId = data.category || file.replace('.json', '');

    // Créer la catégorie si elle n'existe pas
    if (!categories.has(categoryId)) {
      categories.set(categoryId, {
        id: categoryId,
        label: categoryId,
        order: 50,
        bookmarks: [],
      });
    }

    const category = categories.get(categoryId);

    for (const bookmark of data.bookmarks || []) {
      if (validateBookmark(bookmark, `standalone:${file}`)) {
        category.bookmarks.push({
          ...bookmark,
          source: 'standalone',
          domain: extractDomain(bookmark.url),
        });
        stats.standalone++;
      }
    }
  }

  return categories;
}

/**
 * Scanne les manifests tools pour extraire les bookmarks
 */
function scanToolsBookmarks() {
  const bookmarks = [];

  if (!existsSync(TOOLS_DIR)) {return bookmarks;}

  const files = readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(TOOLS_DIR, file);
    const manifest = readJSON(filePath);
    if (!manifest?.bookmarks) {continue;}

    for (const bookmark of manifest.bookmarks) {
      if (validateBookmark(bookmark, `tool:${manifest.id}`)) {
        bookmarks.push({
          ...bookmark,
          source: 'tool',
          sourceId: manifest.id,
          domain: extractDomain(bookmark.url),
        });
        stats.fromModules++;
      }
    }
  }

  return bookmarks;
}

/**
 * Scanne les manifests games pour extraire les bookmarks
 */
function scanGamesBookmarks() {
  const bookmarks = [];

  if (!existsSync(GAMES_DIR)) {return bookmarks;}

  const dirs = readdirSync(GAMES_DIR)
    .filter(f => statSync(join(GAMES_DIR, f)).isDirectory());

  for (const dir of dirs) {
    const manifestPath = join(GAMES_DIR, dir, 'game.json');
    if (!existsSync(manifestPath)) {continue;}

    const manifest = readJSON(manifestPath);
    if (!manifest?.bookmarks) {continue;}

    for (const bookmark of manifest.bookmarks) {
      if (validateBookmark(bookmark, `game:${manifest.id}`)) {
        bookmarks.push({
          ...bookmark,
          source: 'game',
          sourceId: manifest.id,
          domain: extractDomain(bookmark.url),
        });
        stats.fromModules++;
      }
    }
  }

  return bookmarks;
}

/**
 * Scanne les manifests parcours pour extraire les bookmarks
 */
function scanParcoursBookmarks() {
  const bookmarks = [];

  if (!existsSync(EPICS_DIR)) {return bookmarks;}

  const dirs = readdirSync(EPICS_DIR)
    .filter(f => statSync(join(EPICS_DIR, f)).isDirectory());

  for (const dir of dirs) {
    const manifestPath = join(EPICS_DIR, dir, 'epic.json');
    if (!existsSync(manifestPath)) {continue;}

    const manifest = readJSON(manifestPath);
    if (!manifest?.bookmarks || manifest.draft) {continue;}

    for (const bookmark of manifest.bookmarks) {
      if (validateBookmark(bookmark, `parcours:${manifest.id}`)) {
        bookmarks.push({
          ...bookmark,
          source: 'parcours',
          sourceId: manifest.id,
          domain: extractDomain(bookmark.url),
        });
        stats.fromModules++;
      }
    }
  }

  return bookmarks;
}

/**
 * Déduplique les bookmarks par URL (priorité: standalone > modules)
 */
function deduplicateBookmarks(categories, moduleBookmarks) {
  const seenUrls = new Set();

  // D'abord les standalone (prioritaires)
  for (const category of categories.values()) {
    category.bookmarks = category.bookmarks.filter(b => {
      if (seenUrls.has(b.url)) {
        stats.duplicates++;
        return false;
      }
      seenUrls.add(b.url);
      return true;
    });
  }

  // Puis les modules (catégorie "modules" par défaut)
  const modulesCategory = categories.get('modules') || {
    id: 'modules',
    label: 'Depuis les modules',
    icon: '📦',
    order: 99,
    bookmarks: [],
  };

  for (const bookmark of moduleBookmarks) {
    if (seenUrls.has(bookmark.url)) {
      stats.duplicates++;
      continue;
    }
    seenUrls.add(bookmark.url);

    // Utiliser la catégorie spécifiée ou "modules" par défaut
    const targetCategoryId = bookmark.category || 'modules';
    const targetCategory = categories.get(targetCategoryId) || modulesCategory;
    targetCategory.bookmarks.push(bookmark);
  }

  if (!categories.has('modules') && modulesCategory.bookmarks.length > 0) {
    categories.set('modules', modulesCategory);
  }

  return categories;
}

/**
 * Enrichit les bookmarks avec les métadonnées OG
 */
async function enrichWithOGMetadata(categories) {
  const cache = loadCache();
  const allBookmarks = [];

  // Collecter tous les bookmarks
  for (const category of categories.values()) {
    allBookmarks.push(...category.bookmarks);
  }

  console.log(`\nFetch métadonnées OG pour ${allBookmarks.length} URLs...`);

  // Fetch en parallèle (max 5 concurrentes)
  const CONCURRENCY = 5;
  for (let i = 0; i < allBookmarks.length; i += CONCURRENCY) {
    const batch = allBookmarks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (bookmark) => {
      const result = await fetchOGMetadata(bookmark.url, cache);

      if (result.fromCache) {
        stats.ogCached++;
      } else if (result.failed) {
        // L'échec réseau reste un échec : le repli fournit l'image versionnée,
        // pas le titre ni la description à jour.
        stats.ogFailed++;
        if (result.meta?.fromVersionedImage) {
          stats.ogImageRecovered++;
        }
      } else if (result.meta) {
        stats.ogFetched++;
      } else {
        stats.ogFailed++;
      }

      // Enrichir le bookmark (titre/description/image manuels prioritaires, OG en fallback)
      bookmark.meta = result.meta || {};
      // Si une image est spécifiée manuellement dans le bookmark, l'utiliser
      if (bookmark.image) {
        bookmark.meta.ogImage = bookmark.image;
      }
      bookmark.displayTitle = bookmark.title || result.meta?.ogTitle;
      bookmark.displayDescription = bookmark.description || result.meta?.ogDescription;
    }));
  }

  // Sauvegarder le cache
  saveCache(cache);

  return categories;
}

/**
 * Agrège les tags de tous les bookmarks
 */
function aggregateTags(categories) {
  const tagCounts = new Map();

  for (const category of categories.values()) {
    for (const bookmark of category.bookmarks) {
      for (const tag of bookmark.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  return Array.from(tagCounts.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('Build Bookmarks');
  console.log('===============\n');

  // Charger la config
  const config = readJSON(CONFIG_FILE) || { categories: [] };
  console.log('Config chargée:', CONFIG_FILE);

  // Scanner les sources
  console.log('\nScan des bookmarks standalone...');
  let categories = scanStandaloneBookmarks(config);
  console.log(`  ${stats.standalone} bookmarks trouvés`);

  console.log('\nScan des manifests (tools, games, parcours)...');
  const moduleBookmarks = [
    ...scanToolsBookmarks(),
    ...scanGamesBookmarks(),
    ...scanParcoursBookmarks(),
  ];
  console.log(`  ${stats.fromModules} bookmarks trouvés`);

  // Dédupliquer
  console.log('\nDéduplication...');
  categories = deduplicateBookmarks(categories, moduleBookmarks);
  if (stats.duplicates > 0) {
    console.log(`  ${stats.duplicates} doublons supprimés`);
  }

  // Enrichir avec OG
  categories = await enrichWithOGMetadata(categories);

  // Construire le catalogue
  console.log('\nConstruction du catalogue...');
  const sortedCategories = Array.from(categories.values())
    .filter(c => c.bookmarks.length > 0)
    .sort((a, b) => (a.order || 99) - (b.order || 99));

  const totalBookmarks = sortedCategories.reduce((sum, c) => sum + c.bookmarks.length, 0);

  const catalogue = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    categories: sortedCategories,
    tags: aggregateTags(categories),
  };

  // Écrire le fichier
  writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2));
  console.log(`\nCatalogue généré: ${OUTPUT_FILE}`);

  // Rapport
  console.log('\n--- Rapport ---');
  console.log(`Catégories: ${sortedCategories.length}`);
  console.log(`Bookmarks total: ${totalBookmarks}`);
  console.log(`Tags uniques: ${catalogue.tags.length}`);
  const recovered = stats.ogImageRecovered
    ? ` (dont ${stats.ogImageRecovered} avec image versionnée conservée)`
    : '';
  console.log(`Métadonnées OG: ${stats.ogFetched} fetchées, ${stats.ogCached} en cache, ${stats.ogFailed} échouées${recovered}`);

  if (stats.warnings.length > 0) {
    console.log(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }

  if (stats.errors.length > 0) {
    console.log(`\nErreurs (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  ❌ ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Build terminé avec succès');
}

main();
