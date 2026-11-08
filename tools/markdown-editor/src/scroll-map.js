/**
 * Correspondance de défilement entre l'éditeur et l'aperçu.
 *
 * Chaque bloc rendu fournit un point d'ancrage : sa position verticale dans
 * l'éditeur (haut de sa ligne source) et dans l'aperçu. Entre deux ancres on
 * interpole linéairement, ce qui suit fidèlement les blocs de hauteurs très
 * différentes (une image, un long tableau) des deux côtés.
 *
 * @module scroll-map
 */

/**
 * @typedef {object} ScrollMap
 * @property {(editorY: number) => number} toPreview
 * @property {(previewY: number) => number} toEditor
 */

/**
 * Interpolation linéaire par morceaux (abscisses croissantes).
 * @param {number} value
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number}
 */
export function interpolate(value, xs, ys) {
  if (value <= xs[0]) {
    return ys[0];
  }
  let index = 1;
  while (index < xs.length - 1 && xs[index] < value) {
    index += 1;
  }
  const x0 = xs[index - 1];
  const x1 = xs[index];
  if (value >= x1) {
    return ys[index];
  }
  const ratio = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
  return ys[index - 1] + ratio * (ys[index] - ys[index - 1]);
}

/**
 * Construit la correspondance. Les ancres non strictement croissantes des
 * deux côtés sont ignorées pour garder une fonction monotone et inversible.
 * @param {Array<[number, number]>} anchors - Couples [y éditeur, y aperçu].
 * @param {number} editorMax - Défilement maximal de l'éditeur.
 * @param {number} previewMax - Défilement maximal de l'aperçu.
 * @returns {ScrollMap}
 */
export function buildScrollMap(anchors, editorMax, previewMax) {
  const xs = [0];
  const ys = [0];
  const sorted = [...anchors].sort((a, b) => a[0] - b[0]);
  for (const [x, y] of sorted) {
    if (x > xs[xs.length - 1] && y > ys[ys.length - 1] && x < editorMax && y < previewMax) {
      xs.push(x);
      ys.push(y);
    }
  }
  xs.push(Math.max(editorMax, xs[xs.length - 1] + 1));
  ys.push(Math.max(previewMax, ys[ys.length - 1] + 1));
  return {
    toPreview: (editorY) => interpolate(editorY, xs, ys),
    toEditor: (previewY) => interpolate(previewY, ys, xs),
  };
}
