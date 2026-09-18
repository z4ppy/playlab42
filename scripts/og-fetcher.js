/**
 * Module de fetch des métadonnées Open Graph
 * Récupère og:title, og:description, og:image et favicon
 * Télécharge les images OG en cache local
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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
  // Désactivé par défaut : ces fichiers sont versionnés et peuvent avoir été
  // optimisés (redimensionnement/recompression). Un re-téléchargement écraserait
  // ce travail par l'original pleine taille à la première expiration du cache
  // de métadonnées (cacheDays), y compris quand data/bookmarks-cache.json est
  // absent — il est gitignoré, donc vide sur une machine fraîche.
  // Forcer avec : OG_REFRESH_IMAGES=1 npm run build:bookmarks
  refreshImages: process.env.OG_REFRESH_IMAGES === '1',
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
 * Effectue un fetch borné dans le temps, en garantissant la libération du
 * minuteur.
 *
 * Sans le `finally`, un rejet de `fetch` sautait le `clearTimeout` : le
 * minuteur de CONFIG.timeout restait armé. Sur un build de 120 URLs hors
 * ligne, autant de minuteurs survivaient huit secondes à la fin du travail et
 * retenaient le processus.
 *
 * @param {string} url - URL à appeler
 * @param {Record<string, string>} headers - En-têtes de la requête
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, headers) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
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
 * Construit des métadonnées de repli à partir des fichiers versionnés.
 *
 * Les images de data/bookmarks-images/ sont versionnées : elles restent
 * exploitables même quand la page n'est pas joignable (CI sans réseau sortant,
 * site hors ligne, domaine qui bloque le User-Agent du build). Sans ce repli,
 * un échec réseau vidait la preview de son image alors que le fichier était là.
 *
 * Le repli ne porte volontairement pas de `fetchedAt` : il ne doit pas entrer
 * dans le cache ni empêcher une vraie tentative réseau au build suivant.
 *
 * @param {string} url - URL de la page
 * @returns {object|null} Métadonnées minimales, ou null si aucune image versionnée
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

    const response = await fetchWithTimeout(absoluteUrl, {
      'User-Agent': CONFIG.userAgent,
      'Accept': 'image/*',
    });

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
 * @returns {Promise<{meta: object|null, fromCache: boolean, failed?: boolean}>}
 *   `failed` signale un échec réseau. `meta` peut malgré tout être renseigné,
 *   via le repli sur les images versionnées (cf. buildFallbackMeta).
 */
export async function fetchOGMetadata(url, cache) {
  // Vérifier le cache
  if (cache[url] && isCacheValid(cache[url])) {
    return { meta: cache[url], fromCache: true };
  }

  try {
    const response = await fetchWithTimeout(url, {
      'User-Agent': CONFIG.userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    });

    if (!response.ok) {
      const fallback = buildFallbackMeta(url);
      console.log(`  ⚠️  ${url}: HTTP ${response.status}${fallback ? ' (image versionnée conservée)' : ''}`);
      return { meta: fallback, fromCache: false, failed: true };
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

    // La page répond mais n'expose pas (ou plus) d'og:image : si une image a
    // été téléchargée par un build précédent, elle reste la meilleure source.
    if (!meta.ogImage) {
      const existing = findExistingImage(url);
      if (existing) {
        meta.ogImage = existing;
        meta.fromVersionedImage = true;
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
    const fallback = buildFallbackMeta(url);
    const kept = fallback ? ' (image versionnée conservée)' : '';
    if (err.name === 'AbortError') {
      console.log(`  ⏱️  ${url}: timeout${kept}`);
    } else {
      console.log(`  ❌ ${url}: ${err.message}${kept}`);
    }
    return { meta: fallback, fromCache: false, failed: true };
  }
}
