import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

/** @param {string} path Fichier. @returns {string} Empreinte SHA-256. */
export function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Inventorie tous les octets, sauf le manifeste qui contient cet inventaire.
 * @param {string} root - Racine de l'artefact
 * @param {string} directory - Répertoire parcouru
 * @returns {object[]} Fichiers triés
 */
export function inventorySite(root, directory = root) {
  if (lstatSync(directory).isSymbolicLink()) {throw new Error('Racine symbolique interdite pour l’artefact.');}
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    const local = relative(root, path).split(sep).join('/');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {throw new Error(`Lien symbolique dans l'artefact : ${local}`);}
    if (local === 'build-manifest.json') {continue;}
    if (stat.isDirectory()) {
      files.push(...inventorySite(root, path));
    } else if (stat.isFile()) {
      files.push({ path: local, bytes: stat.size, sha256: hashFile(path) });
    } else {
      throw new Error(`Entrée non régulière dans l'artefact : ${local}`);
    }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
