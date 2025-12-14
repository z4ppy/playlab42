#!/usr/bin/env node

/**
 * Script d'injection de la version dans les fichiers HTML
 * Remplace {{VERSION}} par la version depuis package.json
 *
 * Usage:
 *   node scripts/inject-version.js
 *
 * @see openspec/specs/platform/spec.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Lire la version depuis package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`📦 Version du projet: ${version}`);

// Fichiers à traiter
const filesToProcess = [
  path.join(rootDir, 'index.html'),
];

// Remplacer {{VERSION}} dans chaque fichier
let processedCount = 0;
for (const filePath of filesToProcess) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Fichier introuvable: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(/\{\{VERSION\}\}/g, version);

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    processedCount++;
    console.log(`✅ ${path.relative(rootDir, filePath)}`);
  } else {
    console.log(`ℹ️  ${path.relative(rootDir, filePath)} (déjà à jour)`);
  }
}

console.log(`\n✨ Injection terminée: ${processedCount} fichier(s) modifié(s)`);
