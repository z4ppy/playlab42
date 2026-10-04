import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRootDir, readJSONSync } from './lib/build-utils.js';
import { inventorySite } from './lib/artifact-inventory.js';
import { referencedBookmarkImages } from './build-site.js';

function hasValidManifestStructure(manifest) {
  return manifest.formatVersion === 1 && Array.isArray(manifest.files) && manifest.files.length > 0;
}

function hasValidArtifactCommit(commit) {
  return commit === null || (typeof commit === 'string' && /^[a-f\d]{40}$/i.test(commit));
}

function assertBuildIdentity(manifest, identity) {
  if (!hasValidManifestStructure(manifest)
    || typeof identity.version !== 'string' || !identity.version
    || manifest.version !== identity.version || manifest.commit !== identity.commit
    || !hasValidArtifactCommit(manifest.commit)) {
    throw new Error('Manifeste ou identité du build invalide.');
  }
}

function assertExpectedCommit(commit, expectedCommit) {
  if (expectedCommit !== null && (!/^[a-f\d]{40}$/i.test(expectedCommit) || commit?.toLowerCase() !== expectedCommit.toLowerCase())) {
    throw new Error(`Commit différent : attendu ${expectedCommit}, reçu ${commit}.`);
  }
}

/**
 * Vérifie tous les fichiers de l'artefact contre son manifeste et le commit attendu.
 * Le manifeste lui-même doit provenir d'une archive/run de confiance.
 * @param {string} site - Racine de l'archive extraite
 * @param {string|null} expectedCommit - SHA attendu, null en développement
 * @returns {object} Identité et nombre de fichiers vérifiés
 */
export function verifySite(site, expectedCommit = null) {
  const actual = inventorySite(site);
  const manifest = readJSONSync(join(site, 'build-manifest.json'));
  const identity = readJSONSync(join(site, 'build-info.json'));
  assertBuildIdentity(manifest, identity);
  assertExpectedCommit(manifest.commit, expectedCommit);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) {
    throw new Error('Intégrité du site invalide : fichiers modifiés, absents, supplémentaires ou inventaire non canonique.');
  }
  referencedBookmarkImages(site);
  return { version: manifest.version, commit: manifest.commit, checked: actual.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const site = process.argv[2] || join(getRootDir(import.meta.url), 'site');
    const result = verifySite(site, process.env.GITHUB_SHA || null);
    console.log(`Artefact vérifié : ${result.checked} fichiers, commit ${result.commit ?? 'local'}.`);
  } catch (error) {
    console.error(`Vérification du site échouée : ${error.message}`);
    process.exitCode = 1;
  }
}
