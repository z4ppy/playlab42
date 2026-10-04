import { readJSONSync } from './build-utils.js';
import { decodeHTMLEntities } from '../og-fetcher.js';

const TEXT_FIELDS = new Set([
  'ogTitle', 'ogDescription', 'ogImage', 'ogImageOriginal',
  'ogSiteName', 'favicon', 'fetchedAt',
]);

function validateSnapshotEntry(url, meta) {
  if (!['http:', 'https:'].includes(new URL(url).protocol) || !meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new Error(`Entrée du snapshot OG invalide : ${url}`);
  }
  for (const [key, value] of Object.entries(meta)) {
    if (TEXT_FIELDS.has(key) ? typeof value !== 'string' : key !== 'fromVersionedImage' || typeof value !== 'boolean') {
      throw new Error(`Champ du snapshot OG invalide : ${url}, ${key}`);
    }
  }
}

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
    validateSnapshotEntry(url, meta);
  }
  return snapshot.entries;
}

function replaceCachedImage(meta, url) {
  if (meta.ogImageOriginal) {
    const remote = new URL(decodeHTMLEntities(meta.ogImageOriginal), url);
    if (!['http:', 'https:'].includes(remote.protocol) || remote.username || remote.password) {
      throw new Error('Image éditoriale distante invalide : HTTP(S) sans identifiants requis.');
    }
    meta.ogImage = remote.href;
    delete meta.fromVersionedImage;
    return meta;
  }
  console.warn(`Image OG du cache technique non retenue dans le snapshot : ${url}`);
  delete meta.ogImage;
  delete meta.fromVersionedImage;
  return meta;
}

/**
 * @param {string} path Fichier éditorial
 * @param {boolean} optional Absence autorisée uniquement pour initialiser un refresh
 * @returns {object} Métadonnées validées
 */
export function loadOGSnapshot(path, optional = false) {
  try {
    return validateOGSnapshot(readJSONSync(path));
  } catch (error) {
    if (optional && error.cause?.code === 'ENOENT') {return {};}
    throw error;
  }
}

/**
 * Conserve une image éditoriale locale déjà revue, jamais un cache technique nouveau.
 * @param {object} result - Résultat OG avec son état d'échec
 * @param {string} url - Page source
 * @param {object} previous - Snapshot précédent
 * @returns {object} Métadonnées persistables
 */
export function editorialMetadata(result, url, previous = {}) {
  if (result.failed && previous[url]) {return { ...previous[url] };}
  const meta = { ...result.meta };
  const curated = previous[url]?.ogImage;
  if (curated?.startsWith('data/bookmarks-images/')) {
    meta.ogImage = curated;
    return meta;
  }
  if (!meta.ogImage?.startsWith('data/bookmarks-images/')) {return meta;}
  return replaceCachedImage(meta, url);
}
