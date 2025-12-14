#!/usr/bin/env node

/**
 * Script de bump de version
 * Utilise SemVer et crée automatiquement un tag Git
 *
 * Usage:
 *   npm run version:patch  # Bug fix (0.1.0 -> 0.1.1)
 *   npm run version:minor  # Nouvelle feature (0.1.0 -> 0.2.0)
 *   npm run version:major  # Breaking change (0.1.0 -> 1.0.0)
 *
 * Ce script :
 * 1. Bumpe la version dans package.json
 * 2. Injecte la nouvelle version dans les fichiers HTML
 * 3. Crée un commit de version
 * 4. Crée un tag Git
 *
 * @see openspec/specs/platform/spec.md
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Récupérer le type de bump depuis les arguments
const bumpType = process.argv[2];
const validTypes = ['patch', 'minor', 'major'];

if (!bumpType || !validTypes.includes(bumpType)) {
  console.error('❌ Type de bump invalide');
  console.log('\nUsage:');
  console.log('  npm run version:patch   # Bug fix (0.1.0 -> 0.1.1)');
  console.log('  npm run version:minor   # Nouvelle feature (0.1.0 -> 0.2.0)');
  console.log('  npm run version:major   # Breaking change (0.1.0 -> 1.0.0)');
  process.exit(1);
}

console.log(`\n🚀 Bump de version: ${bumpType}\n`);

try {
  // 1. Vérifier que le working directory est propre
  try {
    execSync('git diff-index --quiet HEAD --', { cwd: rootDir, stdio: 'pipe' });
  } catch {
    console.error('❌ Le working directory n\'est pas propre');
    console.log('ℹ️  Commitez ou stashez vos changements avant de bumper la version');
    process.exit(1);
  }

  // 2. Lire l'ancienne version
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;

  console.log(`📦 Version actuelle: ${oldVersion}`);

  // 3. Bumper la version dans package.json (npm version sans git)
  console.log(`⬆️  Bump ${bumpType}...`);
  const newVersion = execSync(`npm version ${bumpType} --no-git-tag-version`, {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim().replace('v', '');

  console.log(`✅ Nouvelle version: ${newVersion}`);

  // 4. Injecter la version dans les fichiers HTML
  console.log('🔧 Injection de la version dans les fichiers HTML...');
  execSync('node scripts/inject-version.js', { cwd: rootDir, stdio: 'inherit' });

  // 5. Créer un commit de version
  console.log('📝 Création du commit de version...');
  execSync('git add package.json package-lock.json index.html', { cwd: rootDir });
  execSync(`git commit -m "chore: bump version ${oldVersion} → ${newVersion}"`, { cwd: rootDir });

  // 6. Créer un tag Git
  console.log(`🏷️  Création du tag v${newVersion}...`);
  execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`, { cwd: rootDir });

  console.log('\n✨ Bump de version terminé !');
  console.log('\n📋 Prochaines étapes:');
  console.log('   1. Vérifier les changements: git log --oneline -1');
  console.log('   2. Pusher le commit:         git push');
  console.log(`   3. Pusher le tag:            git push origin v${newVersion}`);
  console.log('   4. Créer une release GitHub avec les notes de version');

} catch (error) {
  console.error('\n❌ Erreur lors du bump de version:', error.message);
  process.exit(1);
}
