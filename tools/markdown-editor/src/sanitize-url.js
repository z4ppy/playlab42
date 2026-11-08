/**
 * Filtrage et normalisation des URL de liens et d'images.
 *
 * Politique par liste blanche : sont acceptés les liens relatifs, les ancres
 * et les schémas http, https, mailto et tel ; pour les images seulement, les
 * `data:` d'images matricielles (PNG, JPEG, GIF, WebP, AVIF, BMP). Tout autre
 * schéma (`javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`,
 * `file:`…) est refusé. Le schéma est détecté après suppression des blancs et
 * caractères de contrôle que les navigateurs ignorent (`java\tscript:`).
 *
 * @module sanitize-url
 */

const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const reScheme = /^([a-z][a-z0-9+.-]*):/i;
const reRasterData = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp)[;,]/i;
/** Blancs, contrôles C0/C1 et caractères de format invisibles (trait d'union conditionnel, espaces de largeur nulle, marques bidi). */
const reIgnored = /[\p{Cc}\p{Cf}\p{Z}\s]/gu;
/** Caractères conservés tels quels par la normalisation (comme mdurl). */
const reKeep = /[A-Za-z0-9;/?:@&=+$,\-_.!~*'()#]/;

/**
 * Schéma d'une URL tel qu'un navigateur le verrait.
 * @param {string} url
 * @returns {string|null} Schéma en minuscules, ou null pour une URL relative.
 */
export function urlScheme(url) {
  const match = reScheme.exec(url.replace(reIgnored, ''));
  return match ? match[1].toLowerCase() : null;
}

/**
 * Indique si une URL peut être rendue.
 * @param {string} url
 * @param {{ image?: boolean }} [options]
 * @returns {boolean}
 */
export function isSafeUrl(url, { image = false } = {}) {
  const scheme = urlScheme(url);
  if (scheme === null) {
    return true;
  }
  if (scheme === 'data') {
    return image && reRasterData.test(url.replace(reIgnored, ''));
  }
  return SAFE_SCHEMES.has(scheme);
}

/**
 * Encode en pourcentage les caractères non sûrs, sans ré-encoder les
 * séquences `%XX` déjà valides.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  let result = '';
  const chars = Array.from(url);
  for (let i = 0; i < chars.length; i++) {
    result += encodeChar(chars, i);
  }
  return result;
}

/**
 * @param {string[]} chars - Points de code.
 * @param {number} i
 * @returns {string}
 */
function encodeChar(chars, i) {
  const char = chars[i];
  if (char === '%') {
    const hex = `${chars[i + 1] ?? ''}${chars[i + 2] ?? ''}`;
    return /^[0-9a-f]{2}$/i.test(hex) ? '%' : '%25';
  }
  if (reKeep.test(char)) {
    return char;
  }
  try {
    return encodeURIComponent(char);
  } catch {
    // Substitut UTF-16 isolé : remplacé par U+FFFD.
    return '%EF%BF%BD';
  }
}

/**
 * Filtre puis normalise une URL.
 * @param {string} url
 * @param {{ image?: boolean }} [options]
 * @returns {string|null} URL sûre et encodée, ou null si elle est refusée.
 */
export function sanitizeUrl(url, options) {
  return isSafeUrl(url, options) ? normalizeUrl(url) : null;
}
