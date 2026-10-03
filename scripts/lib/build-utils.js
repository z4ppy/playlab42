/**
 * Utilitaires partagés pour les scripts de build
 * Centralise les fonctions communes à build-catalogue, build-parcours et build-bookmarks
 *
 * @module scripts/lib/build-utils
 */

import { readFile, access } from 'fs/promises';
import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, openSync, closeSync, fchmodSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

/**
 * Couleurs ANSI pour la console
 * @type {Object.<string, string>}
 */
export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Obtient le chemin racine du projet
 * @param {string} importMetaUrl - import.meta.url du script appelant
 * @returns {string} Chemin absolu vers la racine du projet
 */
export function getRootDir(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = dirname(__filename);
  if (basename(__dirname) === 'scripts') {
    return dirname(__dirname);
  }
  if (basename(__dirname) === 'lib' && basename(dirname(__dirname)) === 'scripts') {
    return join(__dirname, '../..');
  }
  throw new Error(`Script hors scripts/ ou scripts/lib/: ${__filename}`);
}

/**
 * Vérifie si un fichier existe (version async)
 * @param {string} path - Chemin du fichier
 * @returns {Promise<boolean>}
 */
export async function fileExistsAsync(path) {
  try {
    await access(path);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

/**
 * Vérifie si un fichier existe (version sync)
 * @param {string} path - Chemin du fichier
 * @returns {boolean}
 */
export function fileExistsSync(path) {
  return existsSync(path);
}

/**
 * Lit et parse un fichier JSON (version async)
 * @param {string} path - Chemin du fichier JSON
 * @param {object} [stats] - Collecteur d'erreurs ; sinon l'erreur est levée
 * @returns {Promise<object|null>} Objet parsé ou null si erreur collectée
 */
export async function readJSONAsync(path, stats = null) {
  try {
    const content = await readFile(path, 'utf-8');
    return parseJSONObject(content);
  } catch (err) {
    return reportJSONError(path, err, stats);
  }
}

/**
 * Lit et parse un fichier JSON (version sync)
 * @param {string} path - Chemin du fichier JSON
 * @param {object} [stats] - Objet stats pour collecter les erreurs (optionnel)
 * @returns {object|null} Objet parsé ou null si erreur collectée ; sinon lève
 */
export function readJSONSync(path, stats = null) {
  try {
    return parseJSONObject(readFileSync(path, 'utf-8'));
  } catch (err) {
    return reportJSONError(path, err, stats);
  }
}

function parseJSONObject(content) {
  const data = JSON.parse(content);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Un objet JSON est requis');
  }
  return data;
}

function reportJSONError(path, cause, stats) {
  const error = new Error(`Erreur lecture ${path}: ${cause.message}`, { cause });
  if (stats?.errors) {
    stats.errors.push(error.message);
    return null;
  }
  throw error;
}

/**
 * Remplace un JSON par renommage dans le même répertoire, sans tronquer l'ancien.
 * Préserve ses permissions ; pour un fichier nouveau, respecte l'umask courant.
 * @param {string} path - Fichier généré
 * @param {object} data - Données sérialisables
 */
export function writeJSONAtomicSync(path, data) {
  const content = JSON.stringify(data, null, 2);
  if (content === undefined) {
    throw new Error(`JSON non sérialisable: ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  const mode = existsSync(path) ? statSync(path).mode & 0o777 : null;
  const descriptor = openSync(temporary, 'wx', mode ?? 0o666);
  try {
    try {
      // openSync applique l'umask, même au mode hérité du fichier précédent.
      if (mode !== null) {fchmodSync(descriptor, mode);}
      writeFileSync(descriptor, content);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/**
 * Crée un objet stats standard pour les scripts de build
 * @param {Object} [extra] - Propriétés supplémentaires à ajouter
 * @returns {Object} Objet stats initialisé
 */
export function createStats(extra = {}) {
  return {
    errors: [],
    warnings: [],
    ...extra,
  };
}

/**
 * Date de fabrication stable si l'epoch des sources est fourni ; heure locale sinon.
 * @param {string|undefined} epoch - SOURCE_DATE_EPOCH en secondes Unix
 * @returns {string} Date ISO
 */
export function getBuildTimestamp(epoch = process.env.SOURCE_DATE_EPOCH) {
  if (epoch === undefined) {return new Date().toISOString();}
  const seconds = Number(epoch);
  if (!/^(0|[1-9]\d*)$/.test(epoch) || !Number.isSafeInteger(seconds) || seconds > 8.64e12) {
    throw new Error('SOURCE_DATE_EPOCH invalide : secondes Unix entières requises.');
  }
  return new Date(seconds * 1000).toISOString();
}

/**
 * Affiche le rapport final d'un build
 * @param {Object} stats - Objet stats du build
 * @param {Object} [options] - Options d'affichage
 * @param {Object.<string, number>} [options.counts] - Compteurs à afficher
 */
export function printReport(stats, options = {}) {
  console.log('\n--- Rapport ---');

  // Afficher les compteurs personnalisés
  if (options.counts) {
    for (const [label, count] of Object.entries(options.counts)) {
      console.log(`${label}: ${count}`);
    }
  }

  // Afficher les warnings
  if (stats.warnings.length > 0) {
    console.log(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach(w => console.log(`  ${colors.yellow}⚠️  ${w}${colors.reset}`));
  }

  // Afficher les erreurs
  if (stats.errors.length > 0) {
    console.log(`\nErreurs (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  ${colors.red}❌ ${e}${colors.reset}`));
    return false;
  }

  console.log(`\n${colors.green}✅ Build terminé avec succès${colors.reset}`);
  return true;
}

/**
 * Valide le format d'un ID (kebab-case)
 * @param {string} id - ID à valider
 * @returns {boolean} true si valide
 */
export function isValidId(id) {
  return /^[a-z0-9-]+$/.test(id);
}

/**
 * Extrait le domaine d'une URL
 * @param {string} url - URL à parser
 * @returns {string} Domaine sans www
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
