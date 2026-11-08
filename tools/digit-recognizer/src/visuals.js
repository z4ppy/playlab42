/**
 * Conversions pures valeurs → pixels pour visualiser images et activations.
 * Les couleurs viennent du thème (variables CSS) : clair et sombre sont
 * traités de la même façon en interpolant entre fond et couleur d'encre.
 */

/** @typedef {[number, number, number]} Rgb */

/**
 * Décode une couleur CSS calculée : #rgb, #rrggbb ou rgb()/rgba().
 * @param {string} value
 * @param {Rgb} [fallback]
 * @returns {Rgb}
 */
export function parseCssColor(value, fallback = [128, 128, 128]) {
  const text = value.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d).join('') : hex[1];
    return /** @type {Rgb} */ ([0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16)));
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : fallback;
}

/**
 * Interpolation linéaire entre deux couleurs.
 * @param {Rgb} from
 * @param {Rgb} to
 * @param {number} t - 0 = from, 1 = to (borné).
 * @returns {Rgb}
 */
export function mixColors(from, to, t) {
  const k = Math.min(1, Math.max(0, t));
  return /** @type {Rgb} */ ([0, 1, 2].map(i => Math.round(from[i] + (to[i] - from[i]) * k)));
}

/**
 * Plus grande valeur absolue d'une tranche (échelle de normalisation).
 * @param {ArrayLike<number>} values
 * @param {number} offset
 * @param {number} count
 * @returns {number}
 */
export function maxAbs(values, offset, count) {
  let max = 0;
  for (let i = offset; i < offset + count; i++) {
    max = Math.max(max, Math.abs(values[i]));
  }
  return max;
}

/**
 * @typedef {object} Palette
 * @property {Rgb} background - Couleur de la valeur 0.
 * @property {Rgb} positive - Couleur des valeurs maximales positives.
 * @property {Rgb} [negative] - Couleur des valeurs négatives (mode signé).
 */

/**
 * Transforme une carte de valeurs en pixels RGBA.
 * Chaque carte est normalisée par son propre maximum : on compare les zones
 * actives d'un même filtre, pas l'intensité absolue entre filtres.
 * @param {ArrayLike<number>} values
 * @param {object} options
 * @param {number} [options.offset]
 * @param {number} options.count - Nombre de pixels.
 * @param {Palette} options.palette
 * @param {number} [options.scale] - Échelle imposée (sinon max |valeur|).
 * @returns {Uint8ClampedArray} Données RGBA prêtes pour ImageData.
 */
export function valuesToRgba(values, { offset = 0, count, palette, scale }) {
  const range = scale ?? maxAbs(values, offset, count);
  const out = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const value = range > 0 ? values[offset + i] / range : 0;
    const target = value < 0 && palette.negative ? palette.negative : palette.positive;
    const [r, g, b] = mixColors(palette.background, target, Math.abs(value));
    out.set([r, g, b, 255], i * 4);
  }
  return out;
}

/**
 * Formate une probabilité en pourcentage arrondi, en français. L'espace fine
 * insécable avant « % » empêche le symbole de passer seul à la ligne.
 * @param {number} probability
 * @param {number} [digits]
 * @returns {string}
 */
export function formatPercent(probability, digits = 0) {
  return `${(probability * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u202F%`;
}

/**
 * Phrase courte qui qualifie la décision du réseau.
 * @param {ArrayLike<number>} probabilities
 * @param {number[]} ranking - Classes triées par probabilité.
 * @returns {string}
 */
export function describeConfidence(probabilities, ranking) {
  const [first, second] = ranking;
  const confidence = probabilities[first];
  if (confidence >= 0.9) {
    return 'Le réseau est sûr de lui.';
  }
  if (confidence >= 0.6) {
    return `Assez sûr ; ${second} arrive en second.`;
  }
  return `Hésitation entre ${first} et ${second}.`;
}
