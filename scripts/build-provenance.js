import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRootDir, getBuildTimestamp, readJSONSync, writeJSONAtomicSync } from './lib/build-utils.js';
import { hashFile, inventorySite } from './lib/artifact-inventory.js';

/**
 * Normalise les champs non reproductibles sans supprimer le graphe de dépendances.
 * @param {object} bom - SBOM CycloneDX native npm
 * @param {string} name - Nom canonique du projet, pas celui du répertoire de checkout
 * @param {string} timestamp - Date de fabrication
 * @returns {object} SBOM
 */
export function normalizeBuildSBOM(bom, name, timestamp) {
  if (bom.bomFormat !== 'CycloneDX' || !Array.isArray(bom.components) || !Array.isArray(bom.dependencies)
    || !bom.metadata?.component || !Array.isArray(bom.metadata.tools)
    || !bom.metadata.tools.some(tool => tool.name === 'cli' && typeof tool.version === 'string')) {
    throw new Error('SBOM npm CycloneDX incomplète.');
  }
  delete bom.serialNumber;
  bom.metadata.timestamp = timestamp;
  bom.metadata.component.name = name;
  bom.components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'], 'en'));
  bom.dependencies.sort((a, b) => a.ref.localeCompare(b.ref, 'en'));
  for (const dependency of bom.dependencies) {dependency.dependsOn?.sort();}
  return bom;
}

/**
 * Ajoute SBOM de fabrication et provenance non signée au site déjà préparé.
 * @param {string} root - Racine des sources
 * @returns {object} Manifeste public
 */
export function buildProvenance(root = getRootDir(import.meta.url)) {
  const site = join(root, 'site');
  const identity = readJSONSync(join(site, 'build-info.json'));
  const timestamp = getBuildTimestamp();
  const bom = normalizeBuildSBOM(JSON.parse(execFileSync('npm', [
    'sbom', '--sbom-format=cyclonedx',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })), readJSONSync(join(root, 'package.json')).name, timestamp);
  writeJSONAtomicSync(join(site, 'build-sbom.cdx.json'), bom);
  const vendors = readJSONSync(join(site, 'assets/vendor/manifest.json'));
  const manifest = {
    formatVersion: 1,
    ...identity,
    generatedAt: timestamp,
    sourceDateEpoch: process.env.SOURCE_DATE_EPOCH ?? null,
    inputs: {
      packageLock: hashFile(join(root, 'package-lock.json')),
      ogSnapshot: hashFile(join(root, 'metadata/bookmarks-og.json')),
    },
    tools: {
      node: process.versions.node,
      npm: bom.metadata.tools.find(tool => tool.name === 'cli').version,
      platform: `${process.platform}-${process.arch}`,
    },
    runtime: {
      generatedVendors: vendors.libraries,
      boundary: 'Inventaire des fichiers livrés ; CDN/modèles chargés dynamiquement non inclus dans la SBOM npm de fabrication.',
    },
    files: inventorySite(site),
  };
  writeJSONAtomicSync(join(site, 'build-manifest.json'), manifest);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = buildProvenance();
    console.log(`Provenance non signée : ${manifest.files.length} fichiers publics et SBOM de fabrication.`);
  } catch (error) {
    console.error(`Provenance impossible : ${error.message}`);
    process.exitCode = 1;
  }
}
