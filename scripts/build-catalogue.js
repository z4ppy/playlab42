#!/usr/bin/env node

/**
 * build-catalogue.js - Génère le fichier data/catalogue.json
 * Scanne les manifests dans tools/ et games/ pour construire le catalogue
 *
 * @see openspec/specs/catalogue/spec.md
 */

import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  colors,
  getRootDir,
  fileExistsAsync,
  readJSONAsync,
  isValidId,
} from './lib/build-utils.js';

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
  const errors = [];
  const required = ['id', 'name', 'description', 'tags'];

  // Vérifier que tous les champs requis existent
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field '${field}'`);
    }
  }

  // Valider le format de l'id (seulement si présent pour éviter erreur double)
  if (manifest.id && !isValidId(manifest.id)) {
    errors.push("'id' must be kebab-case (lowercase letters, numbers, hyphens)");
  }

  // Valider le type du champ tags
  if (manifest.tags && !Array.isArray(manifest.tags)) {
    errors.push("'tags' must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un manifest de game
 * @param {object} manifest
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateGameManifest(manifest) {
  const errors = [];
  const required = ['id', 'name', 'description', 'players', 'type', 'tags'];

  // Vérifier que tous les champs requis existent
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field '${field}'`);
    }
  }

  // Valider le format de l'id (seulement si présent pour éviter erreur double)
  if (manifest.id && !isValidId(manifest.id)) {
    errors.push("'id' must be kebab-case (lowercase letters, numbers, hyphens)");
  }

  // Valider la structure de players
  if (manifest.players) {
    if (typeof manifest.players.min !== 'number') {
      errors.push("'players.min' must be a number");
    }
    if (typeof manifest.players.max !== 'number') {
      errors.push("'players.max' must be a number");
    }
    if (manifest.players.min > manifest.players.max) {
      errors.push("'players.min' cannot be greater than 'players.max'");
    }
  }

  // Valider les valeurs de type
  if (manifest.type && !['turn-based', 'real-time'].includes(manifest.type)) {
    errors.push("'type' must be 'turn-based' or 'real-time'");
  }

  // Valider le type du champ tags
  if (manifest.tags && !Array.isArray(manifest.tags)) {
    errors.push("'tags' must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Scanne le dossier tools/ pour les manifests
 * @returns {Promise<{tools: object[], errors: string[]}>}
 */
async function scanTools() {
  const tools = [];
  const errors = [];

  if (!(await fileExistsAsync(TOOLS_DIR))) {
    console.log(`${colors.dim}  tools/ directory not found, skipping${colors.reset}`);
    return { tools, errors };
  }

  const files = await readdir(TOOLS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  for (const jsonFile of jsonFiles) {
    const manifestPath = join(TOOLS_DIR, jsonFile);
    const manifest = await readJSONAsync(manifestPath);

    if (!manifest) {
      errors.push(`${jsonFile}: Invalid JSON`);
      continue;
    }

    const validation = validateToolManifest(manifest);
    if (!validation.valid) {
      errors.push(`${jsonFile}: ${validation.errors.join(', ')}`);
      continue;
    }

    // Vérifier que le fichier HTML correspondant existe
    const htmlFile = jsonFile.replace('.json', '.html');
    const htmlPath = join(TOOLS_DIR, htmlFile);

    if (!(await fileExistsAsync(htmlPath))) {
      console.log(`${colors.yellow}  ⚠ ${jsonFile}: No ${htmlFile} found, skipping${colors.reset}`);
      continue;
    }

    // Ajouter au catalogue
    tools.push({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      path: `tools/${htmlFile}`,
      tags: manifest.tags || [],
      ...(manifest.author && { author: manifest.author }),
      ...(manifest.icon && { icon: manifest.icon }),
    });

    console.log(`${colors.green}  ✓ ${manifest.name}${colors.reset}`);
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

    const manifest = await readJSONAsync(manifestPath);

    if (!manifest) {
      errors.push(`${dir.name}/game.json: Invalid JSON`);
      continue;
    }

    const validation = validateGameManifest(manifest);
    if (!validation.valid) {
      errors.push(`${dir.name}/game.json: ${validation.errors.join(', ')}`);
      continue;
    }

    // Vérifier que index.html existe
    const indexPath = join(gameDir, 'index.html');
    if (!(await fileExistsAsync(indexPath))) {
      errors.push(`${dir.name}/game.json: No index.html found`);
      continue;
    }

    // Ajouter au catalogue
    games.push({
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      path: `games/${dir.name}/index.html`,
      players: manifest.players,
      tags: manifest.tags || [],
      type: manifest.type,
      ...(manifest.author && { author: manifest.author }),
      ...(manifest.icon && { icon: manifest.icon }),
    });

    console.log(`${colors.green}  ✓ ${manifest.name}${colors.reset}`);
  }

  return { games, errors };
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log(`\n${colors.cyan}Building catalogue...${colors.reset}\n`);

  console.log('Scanning tools/');
  const { tools, errors: toolErrors } = await scanTools();

  console.log('\nScanning games/');
  const { games, errors: gameErrors } = await scanGames();

  const allErrors = [...toolErrors, ...gameErrors];

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
    generatedAt: new Date().toISOString(),
    tools,
    games,
  };

  // Écrire le fichier
  await writeFile(OUTPUT_FILE, JSON.stringify(catalogue, null, 2), 'utf-8');

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
