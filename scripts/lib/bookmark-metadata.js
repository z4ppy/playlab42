import { readJSONSync } from './build-utils.js';

const TEXT_FIELDS = new Set([
  'ogTitle', 'ogDescription', 'ogImage', 'ogImageOriginal',
  'ogSiteName', 'favicon', 'fetchedAt',
]);

/**
 * Valide le snapshot éditorial, distinct du cache technique temporaire.
 * @param {object} snapshot - Snapshot versionné
 * @returns {object} Entrées de métadonnées
 */
export function validateOGSnapshot(snapshot) {
  if (snapshot.version !== 1 || !snapshot.entries || typeof snapshot.entries !== 'object' || Array.isArray(snapshot.entries)) {
    throw new Error('Snapshot OG invalide : version 1 et entries objet requis.');
  }
  for (const [url, meta] of Object.entries(snapshot.entries)) {
    if (!['http:', 'https:'].includes(new URL(url).protocol) || !meta || typeof meta !== 'object' || Array.isArray(meta)) {
      throw new Error(`Entrée du snapshot OG invalide : ${url}`);
    }
    for (const [key, value] of Object.entries(meta)) {
      if (TEXT_FIELDS.has(key) ? typeof value !== 'string' : key !== 'fromVersionedImage' || typeof value !== 'boolean') {
        throw new Error(`Champ du snapshot OG invalide : ${url}, ${key}`);
      }
    }
  }
  return snapshot.entries;
}

/** @param {string} path Fichier éditorial. @returns {object} Métadonnées validées. */
export function loadOGSnapshot(path) {
  return validateOGSnapshot(readJSONSync(path));
}
