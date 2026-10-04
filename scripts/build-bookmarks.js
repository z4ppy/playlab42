#!/usr/bin/env node
/**
 * Script de build pour le catalogue Bookmarks
 * Génère data/bookmarks.json à partir des fichiers bookmarks/ et des manifests
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fetchOGMetadata, loadCache, saveCache } from './og-fetcher.js';
import { publishCatalogue } from './lib/build-report.js';
import { loadOGSnapshot, validateOGSnapshot, editorialMetadata } from './lib/bookmark-metadata.js';
import {
  getRootDir,
  extractDomain,
  readJSONSync,
  writeJSONAtomicSync,
  getBuildTimestamp,
  printReport,
} from './lib/build-utils.js';

const ROOT = getRootDir(import.meta.url);
const BOOKMARKS_DIR = join(ROOT, 'bookmarks');
const TOOLS_DIR = join(ROOT, 'tools');
const GAMES_DIR = join(ROOT, 'games');
const EPICS_DIR = join(ROOT, 'parcours', 'epics');
const OUTPUT_FILE = join(ROOT, 'data', 'bookmarks.json');
const CONFIG_FILE = join(BOOKMARKS_DIR, 'index.json');
const SNAPSHOT_FILE = join(ROOT, 'metadata', 'bookmarks-og.json');

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
 * Retourne la catégorie demandée, en la créant avec les valeurs par défaut si besoin
 */
function ensureCategory(categories, categoryId) {
  if (!categories.has(categoryId)) {
    categories.set(categoryId, {
      id: categoryId,
      label: categoryId,
      order: 50,
      bookmarks: [],
    });
  }
  return categories.get(categoryId);
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
    const data = readJSONSync(filePath, stats);
    if (!data) {continue;}

    const category = ensureCategory(categories, data.category || file.replace('.json', ''));

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
 * Extrait les bookmarks valides d'un manifest de module (tool, game ou parcours)
 * @param {object} manifest
 * @param {'tool'|'game'|'parcours'} source
 * @returns {object[]}
 */
function collectModuleBookmarks(manifest, source) {
  const bookmarks = [];
  for (const bookmark of manifest.bookmarks) {
    if (validateBookmark(bookmark, `${source}:${manifest.id}`)) {
      bookmarks.push({
        ...bookmark,
        source,
        sourceId: manifest.id,
        domain: extractDomain(bookmark.url),
      });
      stats.fromModules++;
    }
  }
  return bookmarks;
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
    const manifest = readJSONSync(filePath, stats);
    if (!manifest?.bookmarks) {continue;}

    bookmarks.push(...collectModuleBookmarks(manifest, 'tool'));
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

    const manifest = readJSONSync(manifestPath, stats);
    if (!manifest?.bookmarks) {continue;}

    bookmarks.push(...collectModuleBookmarks(manifest, 'game'));
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

    const manifest = readJSONSync(manifestPath, stats);
    if (!manifest?.bookmarks || manifest.draft) {continue;}

    bookmarks.push(...collectModuleBookmarks(manifest, 'parcours'));
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
  const previous = loadOGSnapshot(SNAPSHOT_FILE, true);
  const entries = {};
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
        // Les métadonnées précédentes restent utilisables, pas à jour pour autant.
        stats.ogFailed++;
      } else if (result.meta) {
        stats.ogFetched++;
      } else {
        stats.ogFailed++;
      }

      // Enrichir le bookmark (titre/description/image manuels prioritaires, OG en fallback)
      entries[bookmark.url] = editorialMetadata(result, bookmark.url, previous);
      bookmark.meta = { ...entries[bookmark.url] };
      if (result.failed && bookmark.meta.ogImage?.startsWith('data/bookmarks-images/')) {
        stats.ogImageRecovered++;
      }
      // Si une image est spécifiée manuellement dans le bookmark, l'utiliser
      if (bookmark.image) {
        bookmark.meta.ogImage = bookmark.image;
      }
      bookmark.displayTitle = bookmark.title || bookmark.meta.ogTitle;
      bookmark.displayDescription = bookmark.description || bookmark.meta.ogDescription;
    }));
  }

  // Sauvegarder le cache
  saveCache(cache);
  const snapshot = { version: 1, entries: Object.fromEntries(Object.keys(entries).sort().map(url => [url, entries[url]])) };
  validateOGSnapshot(snapshot);
  writeJSONAtomicSync(SNAPSHOT_FILE, snapshot);
  console.log(`Snapshot OG actualisé : ${SNAPSHOT_FILE} ; relire le diff avant commit.`);

  return categories;
}

function enrichFromSnapshot(categories) {
  const entries = loadOGSnapshot(SNAPSHOT_FILE);
  for (const category of categories.values()) {
    for (const bookmark of category.bookmarks) {
      const meta = entries[bookmark.url];
      if (!meta || !Object.keys(meta).length) {stats.warnings.push(`Métadonnées OG absentes du snapshot : ${bookmark.url}`);}
      bookmark.meta = { ...meta };
      if (bookmark.image) {bookmark.meta.ogImage = bookmark.image;}
      bookmark.displayTitle = bookmark.title || bookmark.meta.ogTitle;
      bookmark.displayDescription = bookmark.description || bookmark.meta.ogDescription;
    }
  }
  console.log('\nMétadonnées OG : snapshot éditorial, sans accès réseau.');
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
 * Choisit l'enrichissement selon les options : snapshot versionné par défaut,
 * --skip-og sans métadonnées, --refresh-og pour le réseau éditorial.
 */
function enrichCategories(categories) {
  const skipOG = process.argv.includes('--skip-og');
  const refreshOG = process.argv.includes('--refresh-og');
  if (skipOG && refreshOG) {
    throw new Error('--skip-og et --refresh-og sont incompatibles.');
  }
  if (skipOG) {
    console.log('\nEnrichissement Open Graph ignoré (--skip-og).');
    return categories;
  }
  return refreshOG ? enrichWithOGMetadata(categories) : enrichFromSnapshot(categories);
}

/**
 * Affiche les compteurs du rapport, avant avertissements et erreurs
 */
function printCounts(catalogue) {
  const totalBookmarks = catalogue.categories.reduce((sum, c) => sum + c.bookmarks.length, 0);
  console.log('\n--- Rapport ---');
  console.log(`Catégories: ${catalogue.categories.length}`);
  console.log(`Bookmarks total: ${totalBookmarks}`);
  console.log(`Tags uniques: ${catalogue.tags.length}`);
  const recovered = stats.ogImageRecovered
    ? ` (dont ${stats.ogImageRecovered} avec image versionnée conservée)`
    : '';
  console.log(`Métadonnées OG: ${stats.ogFetched} fetchées, ${stats.ogCached} en cache, ${stats.ogFailed} échouées${recovered}`);
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('Build Bookmarks');
  console.log('===============\n');

  // Charger la config
  const config = readJSONSync(CONFIG_FILE, stats) || { categories: [] };
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

  if (stats.errors.length) {
    printReport(stats);
    process.exit(1);
  }

  categories = await enrichCategories(categories);

  // Construire le catalogue
  console.log('\nConstruction du catalogue...');
  const sortedCategories = Array.from(categories.values())
    .filter(c => c.bookmarks.length > 0)
    .sort((a, b) => (a.order || 99) - (b.order || 99));

  const catalogue = {
    version: '1.0',
    generatedAt: getBuildTimestamp(),
    categories: sortedCategories,
    tags: aggregateTags(categories),
  };

  printCounts(catalogue);
  if (!publishCatalogue(OUTPUT_FILE, catalogue, stats)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Build Bookmarks impossible : ${error.message}`);
  process.exitCode = 1;
});
