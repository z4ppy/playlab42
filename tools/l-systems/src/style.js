/**
 * Couleurs et épaisseurs des segments — logique pure.
 *
 * Chaque segment reçoit un « style » (couleur + épaisseur). Les styles sont
 * dédupliqués : le rendu trace alors un seul chemin par style au lieu d'un
 * appel `stroke()` par segment, ce qui rend fluides des centaines de milliers
 * de segments.
 */

/** Nombre de teintes du dégradé « progression ». */
export const GRADIENT_STEPS = 48;

/** Épaisseur maximale d'un trait (px). */
const MAX_WIDTH = 64;

/**
 * @typedef {object} StyleOptions
 * @property {'auto'|'depth'|'gradient'|'solid'} colorMode - Coloration
 * @property {number} lineWidth - Épaisseur de base (px)
 * @property {number} widthDecay - Facteur par niveau de pile
 * @property {'dark'|'light'} theme - Thème effectif
 * @property {string} [accent] - Couleur du mode « solid »
 */

/**
 * @typedef {object} StyleIndex
 * @property {Uint16Array} keys - Indice de style de chaque segment
 * @property {{ color: string, width: number }[]} styles - Styles distincts
 * @property {'depth'|'gradient'|'solid'} mode - Mode effectivement appliqué
 */

/**
 * Mode réel : « auto » colore par profondeur s'il y a des branches, sinon
 * par progression le long de la courbe.
 * @param {StyleOptions['colorMode']} mode - Mode demandé
 * @param {number} maxDepth - Profondeur maximale du dessin
 * @returns {'depth'|'gradient'|'solid'}
 */
export function resolveColorMode(mode, maxDepth) {
  if (mode === 'auto') {
    return maxDepth > 0 ? 'depth' : 'gradient';
  }
  return mode;
}

/**
 * Couleur « végétale » : du brun du tronc (t = 0) au vert des feuilles (t = 1).
 * @param {number} t - Position relative dans [0, 1]
 * @param {'dark'|'light'} theme - Thème
 * @returns {string}
 */
export function depthColor(t, theme) {
  const hue = Math.round(28 + 100 * t);
  const saturation = Math.round(45 + 30 * t);
  const lightness = theme === 'light' ? Math.round(30 + 8 * t) : Math.round(46 + 16 * t);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/**
 * Couleur d'un dégradé arc-en-ciel parcouru le long de la courbe.
 * @param {number} t - Position relative dans [0, 1]
 * @param {'dark'|'light'} theme - Thème
 * @returns {string}
 */
export function gradientColor(t, theme) {
  const hue = Math.round(195 + 230 * t) % 360;
  return theme === 'light' ? `hsl(${hue} 75% 38%)` : `hsl(${hue} 85% 64%)`;
}

/**
 * Indice de couleur d'un segment selon le mode.
 * @param {'depth'|'gradient'|'solid'} mode - Mode
 * @param {number} index - Indice du segment
 * @param {number} depth - Profondeur du segment
 * @param {number} count - Nombre total de segments
 * @returns {number}
 */
function colorSlot(mode, index, depth, count) {
  if (mode === 'depth') {
    return depth;
  }
  if (mode === 'gradient') {
    return Math.min(GRADIENT_STEPS - 1, Math.floor((index / count) * GRADIENT_STEPS));
  }
  return 0;
}

/**
 * Couleur correspondant à un indice de couleur.
 * @param {'depth'|'gradient'|'solid'} mode - Mode
 * @param {number} slot - Indice de couleur
 * @param {number} maxDepth - Profondeur maximale
 * @param {StyleOptions} options - Options
 * @returns {string}
 */
function slotColor(mode, slot, maxDepth, options) {
  if (mode === 'depth') {
    return depthColor(maxDepth > 0 ? slot / maxDepth : 1, options.theme);
  }
  if (mode === 'gradient') {
    return gradientColor(slot / (GRADIENT_STEPS - 1), options.theme);
  }
  return options.accent ?? (options.theme === 'light' ? '#b42349' : '#ff8fa3');
}

/**
 * Épaisseur d'un segment, arrondie au quart de pixel pour limiter le
 * nombre de styles distincts.
 * @param {number} relative - Épaisseur relative portée par la tortue
 * @param {number} depth - Profondeur
 * @param {StyleOptions} options - Options
 * @returns {number} Épaisseur en quarts de pixel (≥ 1)
 */
export function quantizedWidth(relative, depth, options) {
  const width = options.lineWidth * relative * options.widthDecay ** depth;
  return Math.max(1, Math.min(MAX_WIDTH * 4, Math.round(width * 4)));
}

/**
 * Calcule le style de chaque segment.
 * @param {import('./turtle.js').Drawing} drawing - Dessin
 * @param {StyleOptions} options - Options
 * @returns {StyleIndex}
 */
export function buildStyleIndex(drawing, options) {
  const mode = resolveColorMode(options.colorMode, drawing.maxDepth);
  const keys = new Uint16Array(drawing.count);
  const styles = [];
  const lookup = new Map();
  for (let i = 0; i < drawing.count; i++) {
    const depth = drawing.depths[i];
    const slot = colorSlot(mode, i, depth, drawing.count);
    const quarter = quantizedWidth(drawing.widths[i], depth, options);
    const key = slot * 1024 + quarter;
    let styleIndex = lookup.get(key);
    if (styleIndex === undefined) {
      styleIndex = styles.length;
      lookup.set(key, styleIndex);
      styles.push({ color: slotColor(mode, slot, drawing.maxDepth, options), width: quarter / 4 });
    }
    keys[i] = styleIndex;
  }
  return { keys, styles, mode };
}
