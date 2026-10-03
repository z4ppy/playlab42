/**
 * Prépare uniquement les fichiers publics, sans dépendances ou tests de développement.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRootDir } from './lib/build-utils.js';

const DIRECTORIES = ['app', 'assets', 'lib', 'tools', 'games', 'parcours', 'data', 'docs', 'bookmarks', 'openspec'];
const FILES = ['index.html', 'app.js', 'style.css', 'README.md', 'AGENTS.md', 'LICENSE'];
const OPTIONAL_FILES = ['favicon.ico', 'favicon.svg', 'CNAME', 'CHANGELOG.md'];
const EXCLUDED = new Set(['node_modules', '__tests__', '__mocks__', 'coverage', 'test-results', 'playwright-report', 'bookmarks-cache.json']);

/** @param {string} path Chemin relatif au dépôt. @returns {boolean} Ressource publique. */
export function isPublicSitePath(path) {
  const parts = path.split(/[\\/]/);
  return !parts.some(part => part.startsWith('.') || EXCLUDED.has(part))
    && !/\.(?:test|spec)\.[jt]sx?$/.test(path)
    && (DIRECTORIES.includes(parts[0]) || (parts.length === 1 && [...FILES, ...OPTIONAL_FILES].includes(path)));
}

/**
 * Reconstruit le dossier généré site, avec le commit CI ou null en local.
 * @param {{root?: string, commit?: string|null}} options Racine des sources et SHA vérifiable.
 * @returns {string} Chemin du site préparé.
 */
export function buildSite({ root = getRootDir(import.meta.url), commit = process.env.GITHUB_SHA || null } = {}) {
  root = resolve(root);
  if (commit !== null && !/^[a-f\d]{40}$/i.test(commit)) {
    throw new Error('Le commit du build doit être un SHA Git complet.');
  }
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (typeof version !== 'string' || !version) {throw new Error('Version du projet absente.');}
  const images = referencedBookmarkImages(root);
  const output = join(root, 'site');
  if (existsSync(output)) {
    if (lstatSync(output).isSymbolicLink() || !existsSync(join(output, 'build-info.json'))) {
      throw new Error('Refus de remplacer site/ : ce dossier ne porte pas le marqueur de build.');
    }
    rmSync(output, { recursive: true });
  }
  mkdirSync(output);
  writeFileSync(join(output, 'build-info.json'), `${JSON.stringify({ version, commit }, null, 2)}\n`);
  const filter = source => {
    const path = relative(root, source).split(/[\\/]/).join('/');
    if (!isPublicSitePath(path)) {return false;}
    if (path.startsWith('data/bookmarks-images/') && !images.has(path)) {return false;}
    if (lstatSync(source).isSymbolicLink()) {
      throw new Error(`Lien symbolique non publiable : ${relative(root, source)}`);
    }
    return true;
  };
  for (const name of [...FILES, ...DIRECTORIES]) {
    cpSync(join(root, name), join(output, name), { recursive: true, filter });
  }
  for (const name of OPTIONAL_FILES) {
    if (existsSync(join(root, name))) {cpSync(join(root, name), join(output, name), { filter });}
  }
  for (const name of ['data/catalogue.json', 'data/parcours.json', 'data/bookmarks.json', 'docs/site/index.html']) {
    if (!existsSync(join(output, name))) {throw new Error(`Build préalable incomplet : ${name}`);}
  }
  return output;
}

/**
 * @param {string} root Racine des sources ou du site extrait
 * @returns {Set<string>} Images locales référencées, présentes et régulières
 */
export function referencedBookmarkImages(root) {
  const catalogue = JSON.parse(readFileSync(join(root, 'data/bookmarks.json'), 'utf8'));
  if (!Array.isArray(catalogue.categories)) {throw new Error('Catalogue bookmarks invalide : categories requises.');}
  const images = new Set();
  for (const category of catalogue.categories) {
    if (!Array.isArray(category.bookmarks)) {throw new Error('Catalogue bookmarks invalide : bookmarks requis.');}
    for (const bookmark of category.bookmarks) {
      const image = bookmark.meta?.ogImage || bookmark.image;
      if (!image?.startsWith('data/bookmarks-images/')) {continue;}
      if (!/^data\/bookmarks-images\/[a-z\d][a-z\d._-]*\.(?:png|jpe?g|webp|gif|svg)$/i.test(image)) {
        throw new Error(`Chemin image bookmark invalide : ${image}`);
      }
      let stat;
      try {
        stat = lstatSync(join(root, image));
      } catch (cause) {
        throw new Error(`Image bookmark locale indisponible : ${image} (${cause.message})`, { cause });
      }
      if (!stat.isFile()) {throw new Error(`Image bookmark locale non régulière : ${image}`);}
      images.add(image);
    }
  }
  return images;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Site public préparé : ${buildSite()}`);
  } catch (error) {
    console.error(`Préparation du site impossible : ${error.message}`);
    process.exitCode = 1;
  }
}
