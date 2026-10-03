#!/usr/bin/env node

/**
 * build-catalogue.js - Génère le fichier data/catalogue.json
 * Scanne les manifests dans tools/ et games/ pour construire le catalogue
 *
 * @see openspec/specs/catalogue/spec.md
 */

import { readdir } from 'fs/promises';
import { basename, join } from 'path';
import {
  colors,
  getRootDir,
  fileExistsAsync,
  readJSONAsync,
  writeJSONAtomicSync,
  getBuildTimestamp,
} from './lib/build-utils.js';
import { validateRequiredFields, validateTagsAndVersion } from './lib/manifest-validation.js';

// Obtenir le répertoire racine du projet
const ROOT_DIR = getRootDir(import.meta.url);

// Configuration
const TOOLS_DIR = join(ROOT_DIR, 'tools');
const GAMES_DIR = join(ROOT_DIR, 'games');
const OUTPUT_FILE = join(ROOT_DIR, 'data/catalogue.json');

/**
 * Valide un manifest de tool
 * @param {object} manifest
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateToolManifest(manifest) {
  return toValidation([
    ...validateRequiredFields(manifest, ['id', 'name', 'description', 'tags']),
    ...validateTagsAndVersion(manifest),
  ]);
}

function toValidation(errors) {
  return { valid: errors.length === 0, errors };
}

/**
 * Valide la structure de players
 * @param {object} manifest
 * @returns {string[]}
 */
function validatePlayers({ players }) {
  if (!players) {
    return [];
  }
  const errors = [];
  if (typeof players.min !== 'number') {
    errors.push("'players.min' must be a number");
  }
  if (typeof players.max !== 'number') {
    errors.push("'players.max' must be a number");
  }
  if (players.min > players.max) {
    errors.push("'players.min' cannot be greater than 'players.max'");
  }
  return errors;
}

/**
 * Valide un manifest de game
 * @param {object} manifest
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateGameManifest(manifest) {
  const errors = [
    ...validateRequiredFields(manifest, ['id', 'name', 'description', 'players', 'type', 'tags']),
    ...validatePlayers(manifest),
  ];
  if (manifest.type && !['turn-based', 'real-time'].includes(manifest.type)) {
    errors.push("'type' must be 'turn-based' or 'real-time'");
  }
  errors.push(...validateTagsAndVersion(manifest));
  return toValidation(errors);
}

/**
 * Lit et valide un manifest, puis vérifie la présence de la page associée.
 * Les erreurs sont accumulées dans `errors` avec le libellé du manifest.
 * @returns {Promise<object|null>} Le manifest valide, sinon null
 */
async function readCatalogueManifest({ manifestPath, label, validate, pagePath, errors }) {
  const manifest = await readJSONAsync(manifestPath, { errors });
  if (!manifest) {
    return null;
  }

  const validation = validate(manifest);
  if (!validation.valid) {
    errors.push(`${label}: ${validation.errors.join(', ')}`);
    return null;
  }

  if (!(await fileExistsAsync(pagePath))) {
    errors.push(`${label}: No ${basename(pagePath)} found`);
    return null;
  }
  return manifest;
}

/**
 * Champs communs d'une entrée de catalogue, version/author/icon seulement s'ils existent
 */
function optionalFields(manifest) {
  return {
    ...(manifest.version && { version: manifest.version }),
    ...(manifest.author && { author: manifest.author }),
    ...(manifest.icon && { icon: manifest.icon }),
  };
}

function toToolEntry(manifest, path) {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    path,
    tags: manifest.tags || [],
    ...optionalFields(manifest),
  };
}

/**
 * Scanne le dossier tools/ pour les manifests simples (fichiers plats)
 * Format : tools/[id].json + tools/[id].html
 * @returns {Promise<{tools: object[], errors: string[]}>}
 */
async function scanSimpleTools() {
  const tools = [];
  const errors = [];

  if (!(await fileExistsAsync(TOOLS_DIR))) {
    console.log(`${colors.dim}  tools/ directory not found, skipping${colors.reset}`);
    return { tools, errors };
  }

  const files = await readdir(TOOLS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  for (const jsonFile of jsonFiles) {
    const htmlFile = jsonFile.replace('.json', '.html');
    const manifest = await readCatalogueManifest({
      manifestPath: join(TOOLS_DIR, jsonFile),
      label: jsonFile,
      validate: validateToolManifest,
      pagePath: join(TOOLS_DIR, htmlFile),
      errors,
    });
    if (manifest) {
      tools.push(toToolEntry(manifest, `tools/${htmlFile}`));
      console.log(`${colors.green}  ✓ ${manifest.name}${colors.reset}`);
    }
  }

  return { tools, errors };
}

/**
 * Scanne le dossier tools/ pour les manifests complexes (dossiers)
 * Format : tools/[id]/tool.json + tools/[id]/index.html
 * @returns {Promise<{tools: object[], errors: string[]}>}
 */
async function scanComplexTools() {
  const tools = [];
  const errors = [];

  if (!(await fileExistsAsync(TOOLS_DIR))) {
    return { tools, errors };
  }

  const entries = await readdir(TOOLS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());

  for (const dir of dirs) {
    const toolDir = join(TOOLS_DIR, dir.name);
    const manifestPath = join(toolDir, 'tool.json');

    // Ignorer les dossiers sans tool.json
    if (!(await fileExistsAsync(manifestPath))) {
      continue;
    }

    const manifest = await readCatalogueManifest({
      manifestPath,
      label: `${dir.name}/tool.json`,
      validate: validateToolManifest,
      pagePath: join(toolDir, 'index.html'),
      errors,
    });
    if (manifest) {
      tools.push(toToolEntry(manifest, `tools/${dir.name}/index.html`));
      console.log(`${colors.green}  ✓ ${manifest.name} (complex)${colors.reset}`);
    }
  }

  return { tools, errors };
}

/**
 * Scanne le dossier games/ pour les manifests
 * @returns {Promise<{games: object[], errors: string[]}>}
 */
async function scanGames() {
  const games = [];
  const errors = [];

  if (!(await fileExistsAsync(GAMES_DIR))) {
    console.log(`${colors.dim}  games/ directory not found, skipping${colors.reset}`);
    return { games, errors };
  }

  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());

  for (const dir of dirs) {
    const gameDir = join(GAMES_DIR, dir.name);
    const manifestPath = join(gameDir, 'game.json');

    if (!(await fileExistsAsync(manifestPath))) {
      console.log(`${colors.dim}  ${dir.name}/: No game.json found, skipping${colors.reset}`);
      continue;
    }

    const manifest = await readCatalogueManifest({
      manifestPath,
      label: `${dir.name}/game.json`,
      validate: validateGameManifest,
      pagePath: join(gameDir, 'index.html'),
      errors,
    });
    if (manifest) {
      games.push({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        path: `games/${dir.name}/index.html`,
        players: manifest.players,
        tags: manifest.tags || [],
        type: manifest.type,
        ...optionalFields(manifest),
      });
      console.log(`${colors.green}  ✓ ${manifest.name}${colors.reset}`);
    }
  }

  return { games, errors };
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log(`\n${colors.cyan}Building catalogue...${colors.reset}\n`);

  console.log('Scanning tools/ (simple)');
  const { tools: simpleTools, errors: simpleToolErrors } = await scanSimpleTools();

  console.log('\nScanning tools/ (complex)');
  const { tools: complexTools, errors: complexToolErrors } = await scanComplexTools();

  console.log('\nScanning games/');
  const { games, errors: gameErrors } = await scanGames();

  // Fusionner les tools
  const tools = [...simpleTools, ...complexTools];

  // Vérifier les doublons d'ID
  const toolIds = new Set();
  const duplicateErrors = [];
  for (const tool of tools) {
    if (toolIds.has(tool.id)) {
      duplicateErrors.push(`Duplicate tool id: '${tool.id}'`);
    }
    toolIds.add(tool.id);
  }

  const allErrors = [...simpleToolErrors, ...complexToolErrors, ...gameErrors, ...duplicateErrors];

  // Si des erreurs critiques, afficher et quitter
  if (allErrors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`);
    for (const error of allErrors) {
      console.log(`${colors.red}  ✗ ${error}${colors.reset}`);
    }
    console.log('');
    process.exit(1);
  }

  // Générer le catalogue
  const catalogue = {
    version: '1.0',
    generatedAt: getBuildTimestamp(),
    tools,
    games,
  };

  // Écrire le fichier
  writeJSONAtomicSync(OUTPUT_FILE, catalogue);

  // Résumé
  console.log(`\n${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Tools: ${tools.length}`);
  console.log(`  Games: ${games.length}`);
  console.log(`\n${colors.green}✓ Catalogue written to ${OUTPUT_FILE}${colors.reset}\n`);
}

// Exécuter
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
