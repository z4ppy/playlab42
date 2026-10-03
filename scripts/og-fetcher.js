/**
 * Module de fetch des métadonnées Open Graph
 * Récupère og:title, og:description, og:image et favicon
 * Télécharge les images OG en cache local
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { readJSONSync, writeJSONAtomicSync } from './lib/build-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_FILE = join(ROOT, 'data', 'bookmarks-cache.json');
const IMAGES_DIR = join(ROOT, 'data', 'bookmarks-images');

// Configuration
const CONFIG = {
  timeout: 8000,      // 8 secondes (augmenté)
  cacheDays: 7,       // Validité du cache
  // User-Agent réaliste pour éviter les blocages
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Re-télécharger les images OG déjà présentes dans data/bookmarks-images/.
  // Désactivé par défaut : des fichiers sont versionnés et peuvent avoir été
  // optimisés (redimensionnement/recompression). Un re-téléchargement écraserait
  // ce travail par l'original pleine taille à la première expiration du cache
  // de métadonnées (cacheDays), y compris quand data/bookmarks-cache.json est
  // absent — il est gitignoré, donc vide sur une machine fraîche.
  // Lors du refresh éditorial : OG_REFRESH_IMAGES=1 npm run refresh:bookmarks
  refreshImages: process.env.OG_REFRESH_IMAGES === '1',
};

/**
 * Charge le cache depuis le disque
 */
export function loadCache(path = CACHE_FILE) {
  try {
    return readJSONSync(path);
  } catch (err) {
    if (err.cause?.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

/**
 * Sauvegarde le cache sur le disque
 */
export function saveCache(cache, path = CACHE_FILE) {
  writeJSONAtomicSync(path, cache);
}

/**
 * Vérifie si une entrée de cache est encore valide
 */
function isCacheValid(entry) {
  if (typeof entry?.fetchedAt !== 'string') {return false;}
  const age = Date.now() - Date.parse(entry.fetchedAt);
  return age >= 0 && age < CONFIG.cacheDays * 24 * 60 * 60 * 1000;
}

/**
 * Extrait les balises meta OG d'un HTML
 */
function extractOGTags(html) {
  const meta = {};

  const tags = [...html.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(([tag]) => new Map(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, name, , value]) => [name.toLowerCase(), value]),
  ));
  for (const [property, field] of [
    ['og:title', 'ogTitle'], ['og:description', 'ogDescription'],
    ['og:image', 'ogImage'], ['og:site_name', 'ogSiteName'],
  ]) {
    const content = findMetaContent(tags, 'property', property);
    if (content) {
      meta[field] = field === 'ogImage' ? content : decodeHTMLEntities(content);
    }
  }

  // Fallback: title standard
  if (!meta.ogTitle) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) {meta.ogTitle = decodeHTMLEntities(titleTag[1]);}
  }

  // Fallback: meta description
  if (!meta.ogDescription) {
    const description = findMetaContent(tags, 'name', 'description');
    if (description) {meta.ogDescription = decodeHTMLEntities(description);}
  }

  return meta;
}

function findMetaContent(tags, attribute, value) {
  return tags.find(tag => tag.get(attribute)?.toLowerCase() === value && tag.get('content'))?.get('content');
}

function decodeCodePoint(value, radix) {
  const code = parseInt(value, radix);
  if (code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) {
    return '\uFFFD';
  }
  return String.fromCodePoint(code);
}

/**
 * Décode les entités HTML (nommées et numériques)
 * @param {string} str Texte ou attribut HTML
 * @returns {string} Valeur décodée
 */
export function decodeHTMLEntities(str) {
  // Entités nommées courantes (utilise codes Unicode pour éviter pb encodage)
  const namedEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013',  // –
    '&mdash;': '\u2014',  // —
    '&lsquo;': '\u2018',  // '
    '&rsquo;': '\u2019',  // '
    '&ldquo;': '\u201C',  // "
    '&rdquo;': '\u201D',  // "
    '&hellip;': '\u2026', // …
    '&copy;': '\u00A9',   // ©
    '&reg;': '\u00AE',    // ®
    '&trade;': '\u2122',   // ™
  };

  let result = str;

  // Remplacer les entités nommées
  for (const [entity, char] of Object.entries(namedEntities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Remplacer les entités numériques hexadécimales (&#xNNNN;)
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
    decodeCodePoint(hex, 16),
  );

  // Remplacer les entités numériques décimales (&#NNNN;)
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    decodeCodePoint(dec, 10),
  );

  return result;
}

/**
 * Construit l'URL du favicon
 */
function buildFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * Borne en-têtes et corps, puis libère aussi les réponses abandonnées.
 * Un corps HTTP non consommé peut retenir le processus pendant plusieurs minutes.
 *
 * @template T
 * @param {string} url - URL à appeler
 * @param {Record<string, string>} headers - En-têtes de la requête
 * @param {(response: Response) => Promise<T>} readResponse - Consommation de la réponse
 * @returns {Promise<T>}
 */
async function fetchWithTimeout(url, headers, readResponse) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
    return await readResponse(response);
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

/**
 * Génère un nom de fichier unique basé sur l'URL
 */
export function hashUrl(url) {
  return createHash('md5').update(url).digest('hex').substring(0, 12);
}

/**
 * Déduit l'extension depuis l'URL ou le content-type
 */
function getImageExtension(url, contentType) {
  // Depuis content-type
  if (contentType) {
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    for (const [type, ext] of Object.entries(typeMap)) {
      if (contentType.includes(type)) {
        return ext;
      }
    }
  }

  // Depuis l'URL
  const urlExt = extname(new URL(url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(urlExt)) {
    return urlExt === '.jpeg' ? '.jpg' : urlExt;
  }

  return '.jpg'; // Fallback
}

/**
 * Cherche une image déjà téléchargée pour une page donnée
 * @param {string} pageUrl - URL de la page (base du nom de fichier)
 * @returns {string|null} Chemin relatif de l'image ou null
 */
export function findExistingImage(pageUrl) {
  if (!existsSync(IMAGES_DIR)) {
    return null;
  }
  const prefix = hashUrl(pageUrl);
  const match = readdirSync(IMAGES_DIR).find(
    (name) => name.startsWith(`${prefix}.`),
  );
  return match ? `data/bookmarks-images/${match}` : null;
}

/**
 * Construit des métadonnées de repli à partir des fichiers locaux disponibles.
 *
 * Ce dossier mêle quelques images versionnées et le cache technique ignoré.
 * Le repli de transport ne décide pas de leur publication : editorialMetadata
 * conserve une référence locale uniquement si le snapshot précédent la contient.
 * Le flag historique fromVersionedImage ne prouve pas le suivi Git.
 *
 * Le repli ne porte volontairement pas de `fetchedAt` : il ne doit pas entrer
 * dans le cache ni empêcher une vraie tentative réseau au build suivant.
 *
 * @param {string} url - URL de la page
 * @returns {object|null} Métadonnées minimales, ou null si aucune image locale
 */
export function buildFallbackMeta(url) {
  const existing = findExistingImage(url);
  if (!existing) {
    return null;
  }
  return {
    ogImage: existing,
    favicon: buildFaviconUrl(url),
    fromVersionedImage: true,
  };
}

/**
 * Télécharge une image OG et la stocke en cache local
 * @returns {Promise<string|null>} Chemin relatif de l'image ou null
 */
async function downloadImage(imageUrl, pageUrl) {
  try {
    // Créer le dossier si nécessaire
    if (!existsSync(IMAGES_DIR)) {
      mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // Image déjà présente : ne rien re-télécharger (cf. CONFIG.refreshImages).
    // Le nom de fichier est dérivé du hash de l'URL de la page, l'extension
    // dépend du content-type : on cherche donc par préfixe.
    if (!CONFIG.refreshImages) {
      const existing = findExistingImage(pageUrl);
      if (existing) {
        return existing;
      }
    }

    // Résoudre l'URL relative si nécessaire
    const absoluteUrl = imageUrl.startsWith('http')
      ? imageUrl
      : new URL(imageUrl, pageUrl).href;

    const image = await fetchWithTimeout(absoluteUrl, {
      'User-Agent': CONFIG.userAgent,
      'Accept': 'image/*',
    }, async response => {
      if (!response.ok) {
        console.warn(`  ⚠️  image OG ${absoluteUrl}: HTTP ${response.status}`);
        return null;
      }
      return {
        ext: getImageExtension(absoluteUrl, response.headers.get('content-type')),
        buffer: Buffer.from(await response.arrayBuffer()),
      };
    });

    if (!image) {
      return null;
    }

    const filename = `${hashUrl(pageUrl)}${image.ext}`;
    const filepath = join(IMAGES_DIR, filename);

    // Sauvegarder l'image
    writeFileSync(filepath, image.buffer);

    // Retourner le chemin relatif pour le JSON
    return `data/bookmarks-images/${filename}`;

  } catch (err) {
    console.warn(`  ⚠️  image OG ${imageUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch les métadonnées OG d'une URL
 * @param {string} url - URL à analyser
 * @param {object} cache - Cache des métadonnées
 * @returns {Promise<{meta: object|null, fromCache: boolean, failed?: boolean}>}
 *   `failed` signale un échec réseau. `meta` peut malgré tout être renseigné,
 *   via le repli sur les images locales (cf. buildFallbackMeta).
 */
export async function fetchOGMetadata(url, cache) {
  // Vérifier le cache
  if (cache[url] && isCacheValid(cache[url])) {
    return { meta: cache[url], fromCache: true };
  }

  try {
    const page = await fetchWithTimeout(url, {
      'User-Agent': CONFIG.userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }, async response => ({
      status: response.status,
      html: response.ok ? await response.text() : null,
    }));

    if (page.html === null) {
      return failedMetadata(url, `⚠️  ${url}: HTTP ${page.status}`);
    }

    const meta = extractOGTags(page.html);

    await enrichImage(meta, url);

    // Ajouter favicon
    meta.favicon = buildFaviconUrl(url);

    // Ajouter timestamp
    meta.fetchedAt = new Date().toISOString();

    // Mettre en cache
    cache[url] = meta;

    reportMetadata(url, meta);

    return { meta, fromCache: false };

  } catch (err) {
    return failedMetadata(url, err.name === 'AbortError'
      ? `⏱️  ${url}: timeout`
      : `❌ ${url}: ${err.message}`);
  }
}

function reportMetadata(url, meta) {
  const hasOG = meta.ogTitle || meta.ogDescription || meta.ogImage;
  const hasImg = meta.ogImage?.startsWith('data/') ? '🖼️' : '';
  console.log(`  ${hasOG ? '✓' : '○'} ${hasImg} ${new URL(url).hostname}`);
}

function failedMetadata(url, message) {
  const meta = buildFallbackMeta(url);
  console.log(`  ${message}${meta ? ' (image locale disponible)' : ''}`);
  return { meta, fromCache: false, failed: true };
}

async function enrichImage(meta, url) {
  if (meta.ogImage) {
    const imageURL = new URL(decodeHTMLEntities(meta.ogImage), url).href;
    const localImage = await downloadImage(imageURL, url);
    if (localImage) {
      meta.ogImageOriginal = meta.ogImage;
      meta.ogImage = localImage;
    } else {
      meta.ogImage = imageURL;
    }
    return;
  }
  const existing = findExistingImage(url);
  if (existing) {
    meta.ogImage = existing;
    meta.fromVersionedImage = true;
  }
}
