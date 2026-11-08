/**
 * Modes de fusion des calques.
 *
 * Le rendu navigateur délègue au Canvas 2D (globalCompositeOperation), qui
 * applique les formules de la spécification W3C « Compositing and Blending ».
 * Les mêmes formules sont écrites ici en JavaScript pur : elles documentent
 * le comportement et permettent de tester fusion vers le bas et aplatissement
 * sans navigateur. Canaux normalisés dans [0, 1], couleurs non prémultipliées.
 */

/** Fonction de mélange séparable B(Cb, Cs) : fond (backdrop) et source. */
const softLightD = (cb) => (cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb));

const multiply = (cb, cs) => cb * cs;
const screen = (cb, cs) => cb + cs - cb * cs;
const hardLight = (cb, cs) => (cs <= 0.5 ? multiply(cb, 2 * cs) : screen(cb, 2 * cs - 1));

/** Formules par mode (identifiant = valeur de globalCompositeOperation). */
const FORMULAS = {
  'source-over': (_cb, cs) => cs,
  multiply,
  screen,
  overlay: (cb, cs) => hardLight(cs, cb),
  darken: Math.min,
  lighten: Math.max,
  'color-dodge': (cb, cs) => {
    if (cb === 0) {
      return 0;
    }
    return cs >= 1 ? 1 : Math.min(1, cb / (1 - cs));
  },
  'color-burn': (cb, cs) => {
    if (cb >= 1) {
      return 1;
    }
    return cs <= 0 ? 0 : 1 - Math.min(1, (1 - cb) / cs);
  },
  'hard-light': hardLight,
  'soft-light': (cb, cs) => (cs <= 0.5
    ? cb - (1 - 2 * cs) * cb * (1 - cb)
    : cb + (2 * cs - 1) * (softLightD(cb) - cb)),
  difference: (cb, cs) => Math.abs(cb - cs),
  exclusion: (cb, cs) => cb + cs - 2 * cb * cs,
};

/** Modes proposés dans l'interface, dans l'ordre d'affichage. */
export const BLEND_MODES = Object.freeze([
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Produit' },
  { id: 'screen', label: 'Écran' },
  { id: 'overlay', label: 'Superposition' },
  { id: 'darken', label: 'Assombrir' },
  { id: 'lighten', label: 'Éclaircir' },
  { id: 'color-dodge', label: 'Densité couleur −' },
  { id: 'color-burn', label: 'Densité couleur +' },
  { id: 'hard-light', label: 'Lumière crue' },
  { id: 'soft-light', label: 'Lumière tamisée' },
  { id: 'difference', label: 'Différence' },
  { id: 'exclusion', label: 'Exclusion' },
]);

/** Mode par défaut d'un calque. */
export const DEFAULT_BLEND = 'source-over';

/**
 * Vrai si le mode est pris en charge.
 * @param {unknown} mode
 */
export function isBlendMode(mode) {
  return typeof mode === 'string' && Object.hasOwn(FORMULAS, mode);
}

/**
 * Mélange d'un canal selon le mode (valeurs dans [0, 1]).
 * @param {string} mode
 * @param {number} cb - Fond
 * @param {number} cs - Source
 */
export function blendChannel(mode, cb, cs) {
  const formula = isBlendMode(mode) ? FORMULAS[mode] : FORMULAS[DEFAULT_BLEND];
  return formula(cb, cs);
}

/**
 * Compose un pixel source sur un pixel de fond, en place.
 * Co = as·(1−ab)·Cs + as·ab·B(Cb, Cs) + (1−as)·ab·Cb, puis division par αo.
 * @param {Uint8ClampedArray} dst
 * @param {number} di
 * @param {Uint8ClampedArray} src
 * @param {number} si
 * @param {number} opacity - Opacité du calque source dans [0, 1]
 * @param {(cb: number, cs: number) => number} formula
 */
function compositePixel(dst, di, src, si, opacity, formula) {
  const as = (src[si + 3] / 255) * opacity;
  if (as <= 0) {
    return;
  }
  const ab = dst[di + 3] / 255;
  const ao = as + ab * (1 - as);
  for (let c = 0; c < 3; c++) {
    const cs = src[si + c] / 255;
    const cb = dst[di + c] / 255;
    const mixed = as * (1 - ab) * cs + as * ab * formula(cb, cs) + (1 - as) * ab * cb;
    dst[di + c] = (mixed / ao) * 255;
  }
  dst[di + 3] = ao * 255;
}

/**
 * Compose un tampon source sur un tampon destination (même forme qu'ImageData),
 * décalé de (dx, dy), sur la zone commune.
 * @param {{width: number, height: number, data: Uint8ClampedArray}} dst - Modifié en place
 * @param {{width: number, height: number, data: Uint8ClampedArray}} src
 * @param {{opacity?: number, mode?: string, dx?: number, dy?: number}} [options]
 */
export function compositeBuffers(dst, src, options = {}) {
  const { opacity = 1, mode = DEFAULT_BLEND, dx = 0, dy = 0 } = options;
  const formula = isBlendMode(mode) ? FORMULAS[mode] : FORMULAS[DEFAULT_BLEND];
  const startX = Math.max(0, dx);
  const startY = Math.max(0, dy);
  const endX = Math.min(dst.width, dx + src.width);
  const endY = Math.min(dst.height, dy + src.height);
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      compositePixel(dst.data, (y * dst.width + x) * 4, src.data, ((y - dy) * src.width + (x - dx)) * 4, opacity, formula);
    }
  }
}
