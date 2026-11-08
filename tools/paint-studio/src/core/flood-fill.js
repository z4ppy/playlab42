/**
 * Remplissage par diffusion (pot de peinture), pur et itératif.
 *
 * Algorithme par segments horizontaux (« scanline ») avec une pile explicite :
 * chaque ligne est étendue à gauche et à droite, puis les lignes voisines
 * sont empilées. Aucune récursion : un canevas de 4096 x 4096 ne peut pas
 * dépasser la pile d'appels. Chaque pixel est visité au plus une fois grâce
 * au masque, ce qui borne le travail à O(largeur x hauteur).
 */

/**
 * @typedef {{width: number, height: number, data: Uint8ClampedArray}} PixelBuffer
 *   Même forme qu'un ImageData, ce qui permet de tester sans DOM.
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 */

/**
 * Vrai si la couleur à l'offset `i` est à distance <= tolérance de la référence
 * (écart maximal par canal, alpha compris).
 * @param {Uint8ClampedArray} data
 * @param {number} i - Offset du canal rouge
 * @param {Uint8ClampedArray|number[]} seed - Couleur de référence RVBA
 * @param {number} tolerance - 0 = couleur identique, 255 = tout
 */
export function colorMatches(data, i, seed, tolerance) {
  return Math.abs(data[i] - seed[0]) <= tolerance
    && Math.abs(data[i + 1] - seed[1]) <= tolerance
    && Math.abs(data[i + 2] - seed[2]) <= tolerance
    && Math.abs(data[i + 3] - seed[3]) <= tolerance;
}

/**
 * Calcule la zone connexe (4-voisinage) de couleur proche du pixel de départ.
 * @param {PixelBuffer} source - Pixels lus (calque ou image fusionnée)
 * @param {number} startX
 * @param {number} startY
 * @param {{tolerance?: number}} [options]
 * @returns {{mask: Uint8Array, bounds: Rect, count: number}|null}
 *   null si le point est hors du canevas ; mask[y * width + x] = 1 dans la zone
 */
export function floodRegion(source, startX, startY, options = {}) {
  const { width, height, data } = source;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) {
    return null;
  }
  const tolerance = Math.max(0, Math.min(255, options.tolerance ?? 0));
  const seedOffset = (y0 * width + x0) * 4;
  const seed = data.slice(seedOffset, seedOffset + 4);
  const mask = new Uint8Array(width * height);
  const region = { mask, minX: x0, maxX: x0, minY: y0, maxY: y0, count: 0 };
  const inside = (index) => mask[index] === 0 && colorMatches(data, index * 4, seed, tolerance);
  const stack = [x0, y0];
  while (stack.length > 0) {
    const y = /** @type {number} */ (stack.pop());
    const x = /** @type {number} */ (stack.pop());
    if (inside(y * width + x)) {
      const span = fillSpan(region, inside, x, y, width);
      pushNeighbourSpans(stack, inside, span, y - 1, width, height);
      pushNeighbourSpans(stack, inside, span, y + 1, width, height);
    }
  }
  return {
    mask,
    count: region.count,
    bounds: { x: region.minX, y: region.minY, width: region.maxX - region.minX + 1, height: region.maxY - region.minY + 1 },
  };
}

/**
 * Étend la ligne autour de (x, y), marque ses pixels et met à jour l'emprise.
 * @returns {{left: number, right: number}} Bornes incluses du segment
 */
function fillSpan(region, inside, x, y, width) {
  const row = y * width;
  let left = x;
  let right = x;
  while (left > 0 && inside(row + left - 1)) {
    left--;
  }
  while (right < width - 1 && inside(row + right + 1)) {
    right++;
  }
  region.mask.fill(1, row + left, row + right + 1);
  region.count += right - left + 1;
  region.minX = Math.min(region.minX, left);
  region.maxX = Math.max(region.maxX, right);
  region.minY = Math.min(region.minY, y);
  region.maxY = Math.max(region.maxY, y);
  return { left, right };
}

/** Empile un germe par segment remplissable de la ligne voisine, sous [left, right]. */
function pushNeighbourSpans(stack, inside, span, y, width, height) {
  if (y < 0 || y >= height) {
    return;
  }
  const row = y * width;
  let previousInside = false;
  for (let x = span.left; x <= span.right; x++) {
    const current = inside(row + x);
    if (current && !previousInside) {
      stack.push(x, y);
    }
    previousInside = current;
  }
}

/**
 * Peint la couleur sur les pixels du masque, en composition « source-over »
 * (une couleur opaque remplace ; une couleur translucide se mélange).
 * Seule l'emprise `bounds` est parcourue.
 * @param {PixelBuffer} target - Pixels modifiés en place
 * @param {Uint8Array} mask
 * @param {Rect} bounds
 * @param {{r: number, g: number, b: number, a: number}} color
 */
export function paintMask(target, mask, bounds, color) {
  const { width, data } = target;
  const sa = color.a / 255;
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      const index = y * width + x;
      if (mask[index]) {
        sourceOverPixel(data, index * 4, color, sa);
      }
    }
  }
}

/**
 * Composition « source-over » d'une couleur unie sur un pixel non prémultiplié.
 * @param {Uint8ClampedArray} data
 * @param {number} i
 * @param {{r: number, g: number, b: number}} color
 * @param {number} sa - Alpha source dans [0, 1]
 */
export function sourceOverPixel(data, i, color, sa) {
  const da = data[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    return;
  }
  const keep = (da * (1 - sa)) / outA;
  const take = sa / outA;
  data[i] = color.r * take + data[i] * keep;
  data[i + 1] = color.g * take + data[i + 1] * keep;
  data[i + 2] = color.b * take + data[i + 2] * keep;
  data[i + 3] = outA * 255;
}
