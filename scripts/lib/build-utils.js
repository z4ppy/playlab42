/**
 * Utilitaires partagés pour les scripts de build
 * Centralise les fonctions communes à build-catalogue, build-parcours et build-bookmarks
 *
 * @module scripts/lib/build-utils
 */

import { readFile, access } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  // Les scripts sont dans scripts/ ou scripts/lib/, on remonte à la racine
  return __dirname.includes('lib')
    ? join(__dirname, '../..')
    : join(__dirname, '..');
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
  } catch {
    return false;
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
 * @returns {Promise<object|null>} Objet parsé ou null en cas d'erreur
 */
export async function readJSONAsync(path) {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Lit et parse un fichier JSON (version sync)
 * @param {string} path - Chemin du fichier JSON
 * @param {object} [stats] - Objet stats pour collecter les erreurs (optionnel)
 * @returns {object|null} Objet parsé ou null en cas d'erreur
 */
export function readJSONSync(path, stats = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    if (stats?.errors) {
      stats.errors.push(`Erreur lecture ${path}: ${err.message}`);
    }
    return null;
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
