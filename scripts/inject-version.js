#!/usr/bin/env node

/**
 * Script d'injection de la version dans les fichiers HTML
 * Remplace {{VERSION}} par la version depuis package.json
 *
 * Formats supportés :
 * - Dev local : v0.1.0-dev+abc1234 (commit SHA)
 * - CI/Prod : v0.1.0 build #123 (GitHub run number)
 *
 * Variables d'environnement (optionnelles) :
 * - BUILD_NUMBER : Numéro de build (GitHub Actions run_number)
 * - COMMIT_SHA : Hash du commit (short)
 * - CI : true si exécuté en CI
 *
 * Usage:
 *   node scripts/inject-version.js
 *   BUILD_NUMBER=123 COMMIT_SHA=abc1234 node scripts/inject-version.js
 *
 * @see openspec/specs/platform/spec.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Lire la version depuis package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const baseVersion = packageJson.version;

// Récupérer les variables d'environnement
const buildNumber = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER;
const commitSha = process.env.COMMIT_SHA || process.env.GITHUB_SHA;
const isCI = process.env.CI === 'true';

// Obtenir le commit SHA court si pas fourni
let shortSha = null;
if (commitSha) {
  shortSha = commitSha.substring(0, 7);
} else if (!isCI) {
  try {
    shortSha = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    // Ignore si pas dans un repo git
  }
}

// Construire la version complète
let version = baseVersion;
let versionDisplay = `v${baseVersion}`;

if (isCI && buildNumber) {
  // En CI : afficher le build number
  versionDisplay = `v${baseVersion} build #${buildNumber}`;
  version = `${baseVersion}+build.${buildNumber}`;
} else if (shortSha) {
  // En dev local : afficher -dev + commit SHA
  versionDisplay = `v${baseVersion}-dev+${shortSha}`;
  version = `${baseVersion}-dev+${shortSha}`;
}

console.log(`📦 Version de base: ${baseVersion}`);
if (buildNumber) {
  console.log(`🔢 Build number: #${buildNumber}`);
}
if (shortSha) {
  console.log(`📝 Commit SHA: ${shortSha}`);
}
console.log(`✨ Version complète: ${versionDisplay}`);

// Fichiers à traiter
const filesToProcess = [
  path.join(rootDir, 'index.html'),
];

// Remplacer les placeholders dans chaque fichier
// {{VERSION}} : version affichée (avec build number)
// {{VERSION_LINK}} : version de base pour les liens GitHub
let processedCount = 0;
for (const filePath of filesToProcess) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Fichier introuvable: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Remplacer {{VERSION}} par la version affichée
  content = content.replace(/\{\{VERSION\}\}/g, versionDisplay);

  // Remplacer {{VERSION_LINK}} par la version de base (pour les URLs)
  content = content.replace(/\{\{VERSION_LINK\}\}/g, baseVersion);

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    processedCount++;
    console.log(`✅ ${path.relative(rootDir, filePath)}`);
  } else {
    console.log(`ℹ️  ${path.relative(rootDir, filePath)} (déjà à jour)`);
  }
}

console.log(`\n✨ Injection terminée: ${processedCount} fichier(s) modifié(s)`);
