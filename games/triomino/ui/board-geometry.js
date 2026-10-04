/**
 * Géométrie SVG du plateau de Triomino : positions logiques du moteur vers
 * coordonnées de triangles équilatéraux.
 */

const SIDE = 60;
const HALF_SIDE = SIDE / 2;
const TRI_H = SIDE * Math.sqrt(3) / 2;

/**
 * Coins d'un triangle : [sommet, gauche, droite] dans son orientation visuelle.
 * @param {{col: number, row: number, orientation: string}} pos Position du moteur.
 * @returns {number[][]} Trois points [x, y].
 */
export function triangleCorners(pos) {
  const { col, row, orientation } = pos;
  const seqX = col * 2 + (orientation === 'DOWN' ? 1 : 0);
  const isVisualUp = ((seqX + row) % 2 + 2) % 2 === 0;

  const leftX = seqX * HALF_SIDE;
  const rightX = leftX + SIDE;
  const midX = leftX + HALF_SIDE;
  const topY = row * TRI_H;
  const botY = topY + TRI_H;

  if (isVisualUp) {
    return [[midX, topY], [leftX, botY], [rightX, botY]];
  }
  return [[midX, botY], [leftX, topY], [rightX, topY]];
}

/**
 * @param {object} pos Position du moteur.
 * @returns {string} Attribut `points` du polygone.
 */
export function trianglePoints(pos) {
  return triangleCorners(pos).map((corner) => corner.join(',')).join(' ');
}

/**
 * @param {object} pos Position du moteur.
 * @returns {number[]} Centre [x, y] du triangle.
 */
export function triangleCenter(pos) {
  const corners = triangleCorners(pos);
  return [
    (corners[0][0] + corners[1][0] + corners[2][0]) / 3,
    (corners[0][1] + corners[1][1] + corners[2][1]) / 3,
  ];
}

/**
 * Boîte englobante des triangles, avec une marge d'un côté.
 * @param {object[]} positions Positions à contenir.
 * @returns {string | null} Valeur de `viewBox`, ou null sans position.
 */
export function boardViewBox(positions) {
  if (positions.length === 0) {
    return null;
  }
  const points = positions.flatMap(triangleCorners);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return `${minX - SIDE} ${minY - SIDE} ${Math.max(...xs) - minX + 2 * SIDE} ${Math.max(...ys) - minY + 2 * SIDE}`;
}
