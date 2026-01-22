#!/usr/bin/env node

/**
 * build-typescript.js - Transpile les fichiers TypeScript vers JavaScript
 *
 * Utilise esbuild pour une transpilation rapide.
 * Les fichiers .ts sont transpilés en .js dans un dossier dist/ adjacent.
 *
 * Usage:
 *   node scripts/build-typescript.js           # Build une fois
 *   node scripts/build-typescript.js --watch   # Mode watch
 *
 * @see openspec/specs/platform/spec.md
 */

import * as esbuild from 'esbuild';
import { readdir, mkdir } from 'fs/promises';
import { join, dirname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

// Obtenir le répertoire racine du projet
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Configuration
const WATCH_MODE = process.argv.includes('--watch');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

/**
 * Trouve tous les fichiers TypeScript dans un dossier
 * @param {string} dir - Dossier à scanner
 * @param {string[]} [files=[]] - Accumulateur
 * @returns {Promise<string[]>}
 */
async function findTsFiles(dir, files = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Ignorer les dossiers spéciaux
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '__tests__' ||
          entry.name === '__mocks__' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }
        await findTsFiles(fullPath, files);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.test.ts')
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // Dossier inexistant, ignorer
  }

  return files;
}

/**
 * Détermine le dossier de sortie pour un fichier source
 * Les fichiers sont transpilés dans un dossier dist/ adjacent au fichier source
 *
 * @param {string} srcPath - Chemin du fichier source
 * @returns {string} - Chemin du fichier de sortie
 */
function getOutputPath(srcPath) {
  const dir = dirname(srcPath);
  const filename = `${basename(srcPath, '.ts')}.js`;

  // Si le fichier est dans un dossier src/, mettre le dist/ au même niveau
  if (dir.includes('/src')) {
    const parentDir = dir.replace(/\/src(\/.*)?$/, '');
    const subPath = dir.replace(/.*\/src\/?/, '');
    return join(parentDir, 'dist', subPath, filename);
  }

  // Sinon, mettre dist/ à côté du fichier
  return join(dir, 'dist', filename);
}

/**
 * Build un fichier TypeScript
 * @param {string} srcPath - Chemin du fichier source
 */
async function buildFile(srcPath) {
  const outPath = getOutputPath(srcPath);
  const outDir = dirname(outPath);

  // Créer le dossier de sortie si nécessaire
  await mkdir(outDir, { recursive: true });

  try {
    await esbuild.build({
      entryPoints: [srcPath],
      outfile: outPath,
      format: 'esm',
      target: 'es2022',
      sourcemap: true,
      // Garder les imports .js (le navigateur ne résout pas .ts)
      // esbuild convertit automatiquement les imports .ts vers .js
    });

    if (VERBOSE) {
      const relSrc = relative(ROOT_DIR, srcPath);
      const relOut = relative(ROOT_DIR, outPath);
      console.log(`${colors.green}  ✓${colors.reset} ${relSrc} → ${relOut}`);
    }
  } catch (error) {
    const relSrc = relative(ROOT_DIR, srcPath);
    console.error(`${colors.red}  ✗ ${relSrc}${colors.reset}`);
    if (error.errors) {
      // Erreurs esbuild
      for (const err of error.errors) {
        console.error(`    ${err.text}`);
      }
    } else {
      console.error(`    ${error.message}`);
    }
    throw error;
  }
}

/**
 * Build tous les fichiers TypeScript du projet
 */
async function buildAll() {
  console.log(`\n${colors.cyan}Building TypeScript files...${colors.reset}\n`);

  // Dossiers à scanner
  const scanDirs = [
    join(ROOT_DIR, 'lib'),
    join(ROOT_DIR, 'tools'),
    join(ROOT_DIR, 'games'),
    join(ROOT_DIR, 'parcours'),
  ];

  // Trouver tous les fichiers .ts
  const allFiles = [];
  for (const dir of scanDirs) {
    const files = await findTsFiles(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log(`${colors.yellow}  Aucun fichier TypeScript trouvé${colors.reset}`);
    return;
  }

  console.log(`  Fichiers trouvés: ${allFiles.length}`);

  // Build tous les fichiers
  let successCount = 0;
  let errorCount = 0;

  for (const file of allFiles) {
    try {
      await buildFile(file);
      successCount++;
    } catch {
      errorCount++;
      // L'erreur est déjà loggée dans buildFile
    }
  }

  // Résumé
  console.log('');
  if (errorCount > 0) {
    console.log(
      `${colors.red}✗ Build terminé avec ${errorCount} erreur(s)${colors.reset}`,
    );
    process.exit(1);
  } else {
    console.log(
      `${colors.green}✓ ${successCount} fichier(s) transpilé(s)${colors.reset}\n`,
    );
  }
}

/**
 * Mode watch : surveille les changements et rebuild automatiquement
 */
async function watch() {
  console.log(`\n${colors.cyan}Mode watch activé...${colors.reset}`);
  console.log(`${colors.dim}  Ctrl+C pour arrêter${colors.reset}\n`);

  // Build initial
  await buildAll();

  // Surveiller les changements avec esbuild context
  const scanDirs = [
    join(ROOT_DIR, 'lib'),
    join(ROOT_DIR, 'tools'),
    join(ROOT_DIR, 'games'),
    join(ROOT_DIR, 'parcours'),
  ];

  // Trouver tous les fichiers .ts initiaux
  const allFiles = [];
  for (const dir of scanDirs) {
    const files = await findTsFiles(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log(`${colors.yellow}  Aucun fichier à surveiller${colors.reset}`);
    return;
  }

  // Créer un context esbuild pour le watch
  const ctx = await esbuild.context({
    entryPoints: allFiles,
    outdir: ROOT_DIR,
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    outbase: ROOT_DIR,
    // Plugin pour transformer les chemins de sortie
    plugins: [
      {
        name: 'custom-output',
        setup(build) {
          build.onEnd(result => {
            if (result.errors.length > 0) {
              console.log(`${colors.red}  Erreurs de build${colors.reset}`);
            } else {
              const now = new Date().toLocaleTimeString();
              console.log(
                `${colors.dim}[${now}]${colors.reset} ${colors.green}Rebuild terminé${colors.reset}`,
              );
            }
          });
        },
      },
    ],
  });

  await ctx.watch();

  // Garder le processus actif
  process.on('SIGINT', async () => {
    console.log(`\n${colors.dim}Arrêt du watch...${colors.reset}`);
    await ctx.dispose();
    process.exit(0);
  });
}

// Point d'entrée
if (WATCH_MODE) {
  watch().catch(error => {
    console.error(`${colors.red}Erreur: ${error.message}${colors.reset}`);
    process.exit(1);
  });
} else {
  buildAll().catch(error => {
    console.error(`${colors.red}Erreur: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
