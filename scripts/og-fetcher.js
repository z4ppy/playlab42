/**
 * Module de fetch des métadonnées Open Graph
 * Récupère og:title, og:description, og:image et favicon
 * Télécharge les images OG en cache local
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_FILE = join(ROOT, 'data', 'bookmarks-cache.json');
const IMAGES_DIR = join(ROOT, 'data', 'bookmarks-images');

// Configuration
const CONFIG = {
  timeout: 5000,      // 5 secondes
  cacheDays: 7,       // Validité du cache
  userAgent: 'PlayLab42-Bot/1.0 (+https://playlab42.example.com)',
};

/**
 * Charge le cache depuis le disque
 */
export function loadCache() {
  if (!existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Sauvegarde le cache sur le disque
 */
export function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Vérifie si une entrée de cache est encore valide
 */
function isCacheValid(entry) {
  if (!entry?.fetchedAt) {return false;}
  const fetchedAt = new Date(entry.fetchedAt);
  const now = new Date();
  const diffDays = (now - fetchedAt) / (1000 * 60 * 60 * 24);
  return diffDays < CONFIG.cacheDays;
}

/**
 * Extrait les balises meta OG d'un HTML
 */
function extractOGTags(html) {
  const meta = {};

  // og:title
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (titleMatch) {meta.ogTitle = decodeHTMLEntities(titleMatch[1]);}

  // og:description
  const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (descMatch) {meta.ogDescription = decodeHTMLEntities(descMatch[1]);}

  // og:image
  const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (imgMatch) {meta.ogImage = imgMatch[1];}

  // og:site_name
  const siteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (siteMatch) {meta.ogSiteName = decodeHTMLEntities(siteMatch[1]);}

  // Fallback: title standard
  if (!meta.ogTitle) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) {meta.ogTitle = decodeHTMLEntities(titleTag[1]);}
  }

  // Fallback: meta description
  if (!meta.ogDescription) {
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDesc) {meta.ogDescription = decodeHTMLEntities(metaDesc[1]);}
  }

  return meta;
}

/**
 * Décode les entités HTML (nommées et numériques)
 */
function decodeHTMLEntities(str) {
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
    String.fromCodePoint(parseInt(hex, 16)),
  );

  // Remplacer les entités numériques décimales (&#NNNN;)
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCodePoint(parseInt(dec, 10)),
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
 * Génère un nom de fichier unique basé sur l'URL
 */
function hashUrl(url) {
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
 * Télécharge une image OG et la stocke en cache local
 * @returns {Promise<string|null>} Chemin relatif de l'image ou null
 */
async function downloadImage(imageUrl, pageUrl) {
  try {
    // Créer le dossier si nécessaire
    if (!existsSync(IMAGES_DIR)) {
      mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // Résoudre l'URL relative si nécessaire
    const absoluteUrl = imageUrl.startsWith('http')
      ? imageUrl
      : new URL(imageUrl, pageUrl).href;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(absoluteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'image/*',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    const ext = getImageExtension(absoluteUrl, contentType);
    const filename = `${hashUrl(pageUrl)}${ext}`;
    const filepath = join(IMAGES_DIR, filename);

    // Sauvegarder l'image
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(filepath, buffer);

    // Retourner le chemin relatif pour le JSON
    return `data/bookmarks-images/${filename}`;

  } catch {
    return null;
  }
}

/**
 * Fetch les métadonnées OG d'une URL
 * @param {string} url - URL à analyser
 * @param {object} cache - Cache des métadonnées
 * @returns {Promise<{meta: object|null, fromCache: boolean}>}
 */
export async function fetchOGMetadata(url, cache) {
  // Vérifier le cache
  if (cache[url] && isCacheValid(cache[url])) {
    return { meta: cache[url], fromCache: true };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  ⚠️  ${url}: HTTP ${response.status}`);
      return { meta: null, fromCache: false };
    }

    const html = await response.text();
    const meta = extractOGTags(html);

    // Télécharger l'image OG en cache local
    if (meta.ogImage) {
      const localImage = await downloadImage(meta.ogImage, url);
      if (localImage) {
        meta.ogImageOriginal = meta.ogImage; // Garder l'URL originale
        meta.ogImage = localImage;           // Utiliser le chemin local
      }
    }

    // Ajouter favicon
    meta.favicon = buildFaviconUrl(url);

    // Ajouter timestamp
    meta.fetchedAt = new Date().toISOString();

    // Mettre en cache
    cache[url] = meta;

    const hasOG = meta.ogTitle || meta.ogDescription || meta.ogImage;
    const hasImg = meta.ogImage?.startsWith('data/') ? '🖼️' : '';
    console.log(`  ${hasOG ? '✓' : '○'} ${hasImg} ${new URL(url).hostname}`);

    return { meta, fromCache: false };

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`  ⏱️  ${url}: timeout`);
    } else {
      console.log(`  ❌ ${url}: ${err.message}`);
    }
    return { meta: null, fromCache: false };
  }
}
