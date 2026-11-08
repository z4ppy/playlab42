/**
 * Conversions de couleurs pures : TSV (teinte, saturation, valeur) <-> RVB <-> hexadécimal.
 *
 * Conventions :
 * - RVB et alpha en entiers 0-255 ({ r, g, b, a }) ;
 * - TSV en flottants : h dans [0, 360[, s et v dans [0, 1].
 */

/** Nombre maximal de couleurs récentes mémorisées. */
export const MAX_RECENT_COLORS = 12;

/**
 * Borne une valeur dans [min, max] ; NaN retombe sur min.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  if (!(value >= min)) {
    return min;
  }
  return value > max ? max : value;
}

/** Canal entier 0-255. */
function channel(value) {
  return Math.round(clamp(value, 0, 255));
}

/**
 * Normalise une couleur RVBA (canaux entiers bornés, alpha 255 par défaut).
 * @param {{r: number, g: number, b: number, a?: number}} color
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function normalizeRgba({ r, g, b, a = 255 }) {
  return { r: channel(r), g: channel(g), b: channel(b), a: channel(a) };
}

/**
 * TSV -> RVB. La teinte est ramenée dans [0, 360[ (360 = 0).
 * @param {{h: number, s: number, v: number}} hsv
 * @returns {{r: number, g: number, b: number}}
 */
export function hsvToRgb({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  // Formule classique : f(n) = v - v·s·max(0, min(k, 4 - k, 1)), k = (n + h/60) mod 6.
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: channel(f(5) * 255), g: channel(f(3) * 255), b: channel(f(1) * 255) };
}

/** Teinte (degrés) d'une couleur dont le maximum et l'écart sont connus. */
function hueOf(r, g, b, max, delta) {
  if (delta === 0) {
    return 0;
  }
  let hue;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  return (hue * 60 + 360) % 360;
}

/**
 * RVB -> TSV. Pour un gris, la teinte vaut 0 et la saturation 0.
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{h: number, s: number, v: number}}
 */
export function rgbToHsv({ r, g, b }) {
  const rn = channel(r) / 255;
  const gn = channel(g) / 255;
  const bn = channel(b) / 255;
  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);
  return { h: hueOf(rn, gn, bn, max, delta), s: max === 0 ? 0 : delta / max, v: max };
}

/** Deux chiffres hexadécimaux. */
function hex2(value) {
  return channel(value).toString(16).padStart(2, '0');
}

/**
 * RVBA -> « #rrggbb », ou « #rrggbbaa » si l'alpha n'est pas opaque.
 * @param {{r: number, g: number, b: number, a?: number}} color
 */
export function rgbToHex(color) {
  const { r, g, b, a } = normalizeRgba(color);
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a === 255 ? base : `${base}${hex2(a)}`;
}

const HEX_PATTERN = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Lit « #rgb », « #rgba », « #rrggbb » ou « #rrggbbaa » (dièse facultatif).
 * @param {string} text
 * @returns {{r: number, g: number, b: number, a: number}|null} null si invalide
 */
export function hexToRgb(text) {
  const match = HEX_PATTERN.exec(String(text).trim());
  if (!match) {
    return null;
  }
  let digits = match[1];
  if (digits.length <= 4) {
    digits = [...digits].map((d) => d + d).join('');
  }
  const value = (index) => parseInt(digits.slice(index, index + 2), 16);
  return { r: value(0), g: value(2), b: value(4), a: digits.length === 8 ? value(6) : 255 };
}

/**
 * Chaîne CSS « rgba(...) » utilisable par le Canvas 2D.
 * @param {{r: number, g: number, b: number, a?: number}} color
 */
export function toCss(color) {
  const { r, g, b, a } = normalizeRgba(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}

/**
 * Ajoute une couleur en tête des récentes, sans doublon, en limitant la longueur.
 * @param {string[]} recent - Couleurs hexadécimales, la plus récente en premier
 * @param {string} hex
 * @param {number} [max]
 * @returns {string[]} Nouvelle liste (l'entrée n'est pas modifiée)
 */
export function pushRecentColor(recent, hex, max = MAX_RECENT_COLORS) {
  const color = hexToRgb(hex);
  if (!color) {
    return recent.slice(0, max);
  }
  const normalized = rgbToHex(color);
  return [normalized, ...recent.filter((item) => item !== normalized)].slice(0, max);
}

/**
 * Luminance relative WCAG d'une couleur (0 = noir, 1 = blanc), pour choisir
 * un contour lisible autour d'une pastille.
 * @param {{r: number, g: number, b: number}} color
 */
export function relativeLuminance({ r, g, b }) {
  const linear = (c) => {
    const n = channel(c) / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
