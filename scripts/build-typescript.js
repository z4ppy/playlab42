#!/usr/bin/env node

/**
 * build-typescript.js - Transpile les fichiers TypeScript vers JavaScript
 *
 * Utilise esbuild pour une transpilation rapide.
 * Les fichiers .ts sont transpilés en .js dans dist/, avec imports recalés.
 *
 * Usage:
 *   node scripts/build-typescript.js           # Build une fois
 *   node scripts/build-typescript.js --watch   # Mode watch
 *
 * @see openspec/specs/platform/spec.md
 */

import * as esbuild from 'esbuild';
import { existsSync } from 'fs';
import { readdir, mkdir } from 'fs/promises';
import { join, dirname, relative, basename, resolve } from 'path';
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

// Racines scannées par le build ponctuel comme par le mode watch
const SCAN_DIRS = ['lib', 'tools', 'games', 'parcours'].map(name => join(ROOT_DIR, name));
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', '__tests__', '__mocks__']);

function isIgnoredDirectory(name) {
  return IGNORED_DIRECTORIES.has(name) || name.startsWith('.');
}

function isSourceFile(entry) {
  return entry.isFile()
    && entry.name.endsWith('.ts')
    && !entry.name.endsWith('.d.ts')
    && !entry.name.endsWith('.test.ts');
}

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

      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entry.name)) {
          await findTsFiles(fullPath, files);
        }
      } else if (isSourceFile(entry)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Dossier inexistant, ignorer
  }

  return files;
}

/**
 * Trouve les sources TypeScript de toutes les racines scannées
 * @returns {Promise<string[]>}
 */
async function findAllTsFiles() {
  const allFiles = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...await findTsFiles(dir));
  }
  return allFiles;
}

/**
 * Détermine le dossier de sortie pour un fichier source
 * src/ et les modules engine/ conservent leur arbre sous dist/.
 * Les autres fichiers gardent leur dossier dist/ adjacent historique.
 *
 * @param {string} srcPath - Chemin du fichier source
 * @returns {string} - Chemin du fichier de sortie
 */
function getOutputPath(srcPath) {
  const dir = dirname(srcPath);
  const filename = `${basename(srcPath, '.ts')}.js`;

  // Les responsabilités extraites d'un moteur partagent son arbre dist/engine/.
  // Les bots conservent leur convention historique bots/dist/.
  const engineModule = relative(ROOT_DIR, srcPath).match(/^(games\/[^/]+)\/engine\/(.+)\.ts$/);
  if (engineModule) {
    return join(ROOT_DIR, engineModule[1], 'dist', 'engine', `${engineModule[2]}.js`);
  }

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
 * Recale les imports depuis leur source vers le fichier réellement publié.
 * Les dépendances restent externes : ni copie du RNG, ni façade générée.
 * @param {string} srcPath
 * @returns {import('esbuild').BuildOptions}
 */
function getBuildOptions(srcPath) {
  const outPath = getOutputPath(srcPath);
  return {
    entryPoints: [srcPath],
    outfile: outPath,
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    bundle: true,
    packages: 'external',
    plugins: [{
      name: 'published-imports',
      setup(build) {
        build.onResolve({ filter: /^(\.|@lib\/)/ }, args => {
          if (args.kind === 'entry-point') {
            return;
          }
          const sourceTarget = args.path.startsWith('@lib/')
            ? join(ROOT_DIR, 'lib', args.path.slice('@lib/'.length))
            : resolve(args.resolveDir, args.path);
          const tsTarget = sourceTarget.replace(/\.js$/, '.ts');
          const target = tsTarget.endsWith('.ts') && existsSync(tsTarget)
            ? getOutputPath(tsTarget)
            : existsSync(sourceTarget) ? sourceTarget : null;
          // Certains imports historiques sont déjà exprimés depuis dist/.
          if (!target) {
            return { path: args.path, external: true };
          }
          const publishedPath = relative(dirname(outPath), target).replaceAll('\\', '/');
          return {
            path: publishedPath.startsWith('.') ? publishedPath : `./${publishedPath}`,
            external: true,
          };
        });
      },
    }],
  };
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
    await esbuild.build(getBuildOptions(srcPath));

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

  const allFiles = await findAllTsFiles();

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
  const allFiles = await findAllTsFiles();

  if (allFiles.length === 0) {
    console.log(`${colors.yellow}  Aucun fichier à surveiller${colors.reset}`);
    return;
  }

  // Même sortie et même résolution que le build ponctuel, sans écrire sur les sources.
  const contexts = [];
  for (const file of allFiles) {
    const ctx = await esbuild.context(getBuildOptions(file));
    contexts.push(ctx);
    await ctx.watch();
  }

  // Garder le processus actif
  process.on('SIGINT', async () => {
    console.log(`\n${colors.dim}Arrêt du watch...${colors.reset}`);
    await Promise.all(contexts.map(ctx => ctx.dispose()));
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
