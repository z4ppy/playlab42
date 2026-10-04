#!/usr/bin/env node
/**
 * Génère les bibliothèques navigateur locales depuis les paquets verrouillés.
 * Aucun accès réseau ; esbuild conserve les commentaires légaux des bundles.
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'scripts/runtime-vendors.json');

/**
 * Refuse les chemins sortant du répertoire de génération ou du paquet.
 * @param {string} root - Répertoire de référence
 * @param {string} path - Chemin relatif
 * @returns {string} Chemin résolu
 */
export function containedPath(root, path) {
  const result = resolve(root, path);
  const local = relative(root, result);
  if (isAbsolute(path) || local === '..' || local.startsWith(`..${sep}`)) {
    throw new Error(`Chemin vendor hors périmètre : ${path}`);
  }
  return result;
}

/**
 * Vérifie la version avant de générer les assets.
 * @param {object} library - Déclaration vendor
 * @param {object} installed - Manifest npm installé
 */
export function assertVersion(library, installed) {
  if (installed.name !== library.package || installed.version !== library.version) {
    throw new Error(
      `${library.package} : attendu ${library.version}, installé ${installed.version}. Exécutez npm ci dans Docker.`,
    );
  }
}

/**
 * Liste les fichiers générés et leurs empreintes dans un ordre stable.
 * @param {string} directory - Répertoire à parcourir
 * @param {string} root - Racine vendor
 * @returns {Promise<object[]>} Inventaire
 */
async function inventory(directory, root = directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await inventory(path, root));
    } else if (entry.isFile()) {
      const bytes = await readFile(path);
      files.push({
        path: relative(root, path).split(sep).join('/'),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
  return files;
}

/**
 * Conserve licences, attributions et manifest de chaque paquet distribué.
 * @param {string} packageRoot - Racine du paquet npm
 * @param {string} output - Racine vendor
 * @param {string|null} fallbackRoot - Licence équivalente déclarée, si absente
 * @returns {Promise<object>} Informations de licence
 */
async function preserveLicense(packageRoot, output, fallbackRoot = null) {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const destination = containedPath(output, `licenses/${manifest.name.replaceAll('/', '__')}`);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(join(packageRoot, 'package.json'), join(destination, 'package-metadata.json'));
  const notices = (await readdir(packageRoot))
    .filter((name) => /^(licen[sc]e|notice|copying|copyright(?:notice)?|authors)([._-]|$)/i.test(name))
    .sort();
  for (const name of notices) {
    await cp(join(packageRoot, name), join(destination, name), { recursive: true });
  }
  if (!notices.some((name) => /^(licen[sc]e|copying)([._-]|$)/i.test(name))) {
    if (!fallbackRoot) {
      throw new Error(`Licence absente du paquet ${manifest.name}`);
    }
    const fallback = JSON.parse(await readFile(join(fallbackRoot, 'package.json'), 'utf8'));
    if (manifest.license !== fallback.license || manifest.license !== 'Apache-2.0') {
      throw new Error(`Licence de remplacement incompatible pour ${manifest.name}`);
    }
    await cp(join(fallbackRoot, 'LICENSE'), join(destination, 'LICENSE'));
    await writeFile(join(destination, 'NOTICE.txt'),
      `${manifest.name}@${manifest.version} déclare Apache-2.0 dans son package.json.\n` +
      `Le paquet ne fournit pas de fichier LICENSE ; le texte Apache-2.0 est conservé depuis ${fallback.name}@${fallback.version}.\n` +
      'Les fontes originales et leurs métadonnées sont distribuées sans modification.\n');
    notices.push('LICENSE', 'NOTICE.txt');
  }
  return { package: manifest.name, version: manifest.version, license: manifest.license, notices };
}

async function prepareLibraries(root, output, libraries) {
  const packages = new Map();
  const assetRoots = new Set();
  for (const library of libraries) {
    const packageRoot = containedPath(join(root, 'node_modules'), library.package);
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    assertVersion(library, manifest);
    const destination = containedPath(output, library.destination);
    const assetRoot = library.bundle ? dirname(destination) : destination;
    const localRoot = relative(output, assetRoot);
    if (!localRoot || localRoot.split(sep)[0] === 'licenses' || localRoot === 'manifest.json') {
      throw new Error(`Répertoire vendor réservé ou trop large : ${library.destination}`);
    }
    assetRoots.add(assetRoot);
    packages.set(packageRoot, library);
  }
  return { packages, assetRoots };
}

function collectBundledPackages(root, inputs, packages) {
  for (const input of Object.keys(inputs)) {
    const absolute = resolve(root, input);
    const marker = `${sep}node_modules${sep}`;
    const index = absolute.lastIndexOf(marker);
    if (index < 0) {continue;}
    const parts = absolute.slice(index + marker.length).split(sep);
    const name = parts[0].startsWith('@') ? parts.slice(0, 2).join(sep) : parts[0];
    const dependencyRoot = join(absolute.slice(0, index + marker.length), name);
    if (!packages.has(dependencyRoot)) {packages.set(dependencyRoot, {});}
  }
}

async function bundleLibrary(root, packageRoot, destination, library, packages) {
  await mkdir(dirname(destination), { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: [containedPath(packageRoot, library.bundle)],
    outfile: destination,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    legalComments: 'inline',
    metafile: true,
    logLevel: 'silent',
  });
  collectBundledPackages(root, result.metafile.inputs, packages);
}

async function copyLibrary(packageRoot, destination, library) {
  await mkdir(destination, { recursive: true });
  for (const source of library.copy) {
    await cp(containedPath(packageRoot, source), containedPath(destination, source), {
      recursive: true,
      filter: (path) => !relative(packageRoot, path).split(sep).includes('node_modules'),
    });
  }
}

async function generateLibrary(root, output, library, packages) {
  const packageRoot = containedPath(join(root, 'node_modules'), library.package);
  const destination = containedPath(output, library.destination);
  if (library.bundle) {
    await bundleLibrary(root, packageRoot, destination, library, packages);
  } else {
    await copyLibrary(packageRoot, destination, library);
  }
}

async function preserveDeclaredLicenses(root, output, packages) {
  const licenses = [];
  const licenseRoots = [];
  for (const [packageRoot, library] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    const license = await preserveLicense(packageRoot, output,
      library.licenseFrom ? containedPath(join(root, 'node_modules'), library.licenseFrom) : null);
    licenses.push(license);
    licenseRoots.push(containedPath(output, `licenses/${license.package.replaceAll('/', '__')}`));
  }
  return { licenses, licenseRoots };
}

/**
 * Génère les assets et un manifest déterministe.
 * @param {object} options - Options de build (tests/intégration)
 * @param {string} [options.root] - Racine du projet
 * @param {object} [options.config] - Configuration alternative
 * @returns {Promise<object>} Manifest produit
 */
export async function buildRuntimeVendors({ root = ROOT, config } = {}) {
  config ||= JSON.parse(await readFile(CONFIG, 'utf8'));
  const output = join(root, 'assets/vendor');
  // Tout valider avant de nettoyer les distributions existantes.
  const { packages, assetRoots } = await prepareLibraries(root, output, config.libraries);
  await mkdir(output, { recursive: true });
  for (const assetRoot of assetRoots) {
    await rm(assetRoot, { recursive: true, force: true });
  }
  for (const library of config.libraries) {
    await generateLibrary(root, output, library, packages);
  }
  const { licenses, licenseRoots } = await preserveDeclaredLicenses(root, output, packages);
  const files = [];
  for (const directory of [...assetRoots, ...licenseRoots]) {
    files.push(...await inventory(directory, output));
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schemaVersion: 1,
    libraries: config.libraries.map(({ package: name, version, destination }) => ({ package: name, version, destination })),
    licenses,
    files,
  };
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildRuntimeVendors().then((manifest) => {
    console.log(`Runtime vendors : ${manifest.libraries.length} bibliothèques, ${manifest.files.length} fichiers -> assets/vendor/`);
  }).catch((error) => {
    console.error(`Build runtime vendors impossible : ${error.message}`);
    process.exitCode = 1;
  });
}
