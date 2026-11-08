/**
 * Palettes de rendu : couleur des cellules selon leur âge et traînée des
 * cellules mortes. Les tables sont précalculées (256 entrées) pour que le
 * rendu d'une image 256×256 ne fasse qu'une lecture de tableau par cellule.
 * Module pur, sans DOM.
 */

/**
 * Couleurs de base d'un thème.
 * @typedef {object} PaletteColors
 * @property {string} background - Fond de la grille
 * @property {string} young - Cellule qui vient de naître
 * @property {string} mid - Cellule d'âge moyen (~16 générations)
 * @property {string} old - Cellule ancienne (structures stables)
 * @property {string} trail - Teinte de la traînée des cellules mortes
 */

/**
 * Tables de couleurs au format pixel RGBA 32 bits (petit-boutiste, comme
 * ImageData vu à travers un Uint32Array sur les navigateurs actuels).
 * @typedef {object} Palette
 * @property {number} background
 * @property {Uint32Array} alive - Indexée par min(âge, 255)
 * @property {Uint32Array} trail - Indexée par l'intensité de traînée (0-255)
 */

/**
 * Convertit « #rgb », « #rrggbb » ou « rgb(r, g, b) » en composantes.
 * @param {string} color
 * @returns {[number, number, number]}
 * @throws {Error} Si le format n'est pas reconnu
 */
export function parseColor(color) {
  const text = String(color).trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);
  if (short) {
    return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)];
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
  if (long) {
    return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  throw new Error(`Couleur non reconnue : ${text}`);
}

/**
 * Empaquette une couleur opaque en pixel RGBA petit-boutiste.
 * @param {[number, number, number]} rgb
 * @returns {number}
 */
export function packColor([r, g, b]) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * Interpolation linéaire entre deux couleurs.
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @param {number} t - 0 donne a, 1 donne b
 * @returns {[number, number, number]}
 */
export function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Position d'un âge sur le dégradé, en échelle logarithmique : les premières
 * générations changent vite de teinte, les structures stables se figent.
 * âge 1 → 0, âge 16 → 0,5, âge ≥ 256 → 1.
 * @param {number} age - ≥ 1
 * @returns {number}
 */
export function ageRatio(age) {
  return Math.min(1, Math.log2(Math.max(1, age)) / 8);
}

/**
 * Construit les tables de couleurs.
 * @param {PaletteColors} colors
 * @param {boolean} [trace] - false : couleur unique et pas de traînée
 * @returns {Palette}
 */
export function buildPalette(colors, trace = true) {
  const background = parseColor(colors.background);
  const young = parseColor(colors.young);
  const mid = parseColor(colors.mid);
  const old = parseColor(colors.old);
  const trailColor = parseColor(colors.trail);
  const alive = new Uint32Array(256);
  const trail = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = ageRatio(i);
    const aliveColor = t < 0.5 ? mixColor(young, mid, t * 2) : mixColor(mid, old, (t - 0.5) * 2);
    alive[i] = packColor(trace ? aliveColor : young);
    // La traînée n'atteint jamais la pleine teinte pour rester distincte des vivantes.
    trail[i] = packColor(trace ? mixColor(background, trailColor, (i / 255) * 0.7) : background);
  }
  return { background: packColor(background), alive, trail };
}

/**
 * Remplit des pixels à partir des âges (0 = morte) et des traînées.
 * @param {Uint32Array} pixels - Destination, même taille que `ages`
 * @param {Uint16Array} ages
 * @param {Uint8Array|null} trail
 * @param {Palette} palette
 */
export function paintCells(pixels, ages, trail, palette) {
  const { alive, background } = palette;
  for (let i = 0; i < ages.length; i++) {
    const age = ages[i];
    if (age) {
      pixels[i] = alive[age > 255 ? 255 : age];
    } else {
      pixels[i] = trail && trail[i] ? palette.trail[trail[i]] : background;
    }
  }
}
