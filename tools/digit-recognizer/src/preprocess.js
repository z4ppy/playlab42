/**
 * Prétraitement « façon MNIST » d'un dessin libre, en fonctions pures.
 *
 * Le jeu MNIST a été fabriqué ainsi (LeCun et al.) : chaque chiffre est
 * redimensionné pour tenir dans une boîte de 20×20 pixels en conservant ses
 * proportions (avec anticrénelage, d'où les niveaux de gris), puis placé dans
 * une image 28×28 de sorte que son centre de masse soit au centre.
 * Le réseau n'a vu que des images de ce type : reproduire exactement ces
 * étapes compte autant que le modèle lui-même pour reconnaître un dessin.
 *
 * Entrée : une carte d'« encre » (0 = fond, 1 = trait) de taille quelconque.
 */

/** Côté de l'image finale. */
export const MNIST_SIZE = 28;

/** Côté de la boîte dans laquelle le chiffre est redimensionné. */
export const MNIST_BOX = 20;

/**
 * Plus grand côté minimal d'un tracé, en fraction du côté du dessin. En
 * dessous (simple appui, trait minuscule), agrandir le tracé en 20×20 ne
 * produirait qu'une tache que le réseau classerait pourtant avec assurance.
 */
export const MIN_EXTENT = 0.15;

/**
 * @typedef {object} Box
 * @property {number} x - Colonne de gauche (incluse).
 * @property {number} y - Ligne du haut (incluse).
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} MnistResult
 * @property {boolean} empty - Aucun trait détecté.
 * @property {boolean} tooSmall - Tracé présent mais trop petit pour être lu (image laissée vide).
 * @property {Float32Array} image - 28×28 valeurs dans [0, 1].
 * @property {Box|null} box - Boîte englobante dans le dessin d'origine.
 * @property {Float32Array|null} scaled - Chiffre redimensionné (avant centrage).
 * @property {{width: number, height: number}} scaledSize
 * @property {Point} shift - Position du coin du chiffre dans l'image 28×28.
 * @property {Point|null} centerOfMass - Centre de masse final dans l'image 28×28.
 */

/**
 * Convertit les pixels RGBA d'un canvas en encre en lisant le canal alpha :
 * le trait est dessiné opaque sur fond transparent, indépendamment du thème.
 * @param {ArrayLike<number>} rgba - Données ImageData (4 octets par pixel).
 * @returns {Float32Array}
 */
export function alphaToInk(rgba) {
  const ink = new Float32Array(rgba.length >> 2);
  for (let i = 0; i < ink.length; i++) {
    ink[i] = rgba[i * 4 + 3] / 255;
  }
  return ink;
}

/**
 * Plus petite boîte contenant tous les pixels d'encre au-dessus du seuil.
 * @param {ArrayLike<number>} ink
 * @param {number} width
 * @param {number} height
 * @param {number} [threshold] - Encre minimale prise en compte.
 * @returns {Box|null} null si le dessin est vide.
 */
export function boundingBox(ink, width, height, threshold = 0.05) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x] > threshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Poids de recouvrement d'un intervalle source [start, end[ sur les pixels
 * entiers : c'est la base d'un rééchantillonnage « par aire » qui moyenne
 * proprement l'encre (anticrénelage) sans bibliothèque d'image.
 * @param {number} start
 * @param {number} end
 * @returns {Array<[number, number]>} Couples [index, fraction couverte].
 */
export function coverage(start, end) {
  const cells = [];
  for (let i = Math.floor(start); i < end; i++) {
    const overlap = Math.min(end, i + 1) - Math.max(start, i);
    if (overlap > 1e-9) {
      cells.push(/** @type {[number, number]} */ ([i, overlap]));
    }
  }
  return cells;
}

/**
 * Pondérations par pixel cible le long d'un axe.
 * @param {number} origin - Début de la zone source.
 * @param {number} sourceLength
 * @param {number} targetLength
 * @returns {Array<Array<[number, number]>>}
 */
function axisWeights(origin, sourceLength, targetLength) {
  const step = sourceLength / targetLength;
  return Array.from({ length: targetLength }, (_, t) => coverage(origin + t * step, origin + (t + 1) * step));
}

/**
 * Rééchantillonne une zone du dessin vers une grille plus petite (ou plus
 * grande) en moyennant l'aire couverte par chaque pixel cible.
 * @param {ArrayLike<number>} ink
 * @param {number} width - Largeur du dessin source.
 * @param {Box} box - Zone à rééchantillonner.
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {Float32Array}
 */
export function resampleArea(ink, width, box, targetWidth, targetHeight) {
  const xs = axisWeights(box.x, box.width, targetWidth);
  const ys = axisWeights(box.y, box.height, targetHeight);
  const area = (box.width / targetWidth) * (box.height / targetHeight);
  const out = new Float32Array(targetWidth * targetHeight);
  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      let sum = 0;
      for (const [sy, wy] of ys[ty]) {
        for (const [sx, wx] of xs[tx]) {
          sum += ink[sy * width + sx] * wy * wx;
        }
      }
      out[ty * targetWidth + tx] = Math.min(1, sum / area);
    }
  }
  return out;
}

/**
 * Centre de masse (barycentre de l'encre), en coordonnées de centres de pixels.
 * @param {ArrayLike<number>} pixels
 * @param {number} width
 * @param {number} height
 * @returns {Point|null} null si l'image est vide.
 */
export function centerOfMass(pixels, width, height) {
  let total = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = pixels[y * width + x];
      total += value;
      sumX += value * x;
      sumY += value * y;
    }
  }
  return total > 0 ? { x: sumX / total, y: sumY / total } : null;
}

/**
 * Taille du chiffre redimensionné : le plus grand côté devient 20 pixels, le
 * rapport largeur/hauteur est conservé (un « 1 » reste fin).
 * @param {Box} box
 * @param {number} [boxSize]
 * @returns {{width: number, height: number}}
 */
export function fitInBox(box, boxSize = MNIST_BOX) {
  const scale = boxSize / Math.max(box.width, box.height);
  return {
    width: Math.max(1, Math.round(box.width * scale)),
    height: Math.max(1, Math.round(box.height * scale)),
  };
}

/**
 * Décalage entier qui amène le centre de masse au centre de l'image, borné
 * pour ne jamais couper le chiffre.
 * @param {number} com - Centre de masse dans le repère du chiffre.
 * @param {number} length - Taille du chiffre sur cet axe.
 * @param {number} size - Taille de l'image finale.
 * @returns {number} Position du bord du chiffre dans l'image finale.
 */
function centeredOffset(com, length, size) {
  const ideal = Math.round((size - 1) / 2 - com);
  return Math.min(size - length, Math.max(0, ideal));
}

/**
 * Copie un bloc dans une image plus grande.
 * @param {Float32Array} target
 * @param {number} size - Côté de la cible.
 * @param {Float32Array} block
 * @param {{width: number, height: number}} blockSize
 * @param {Point} at - Coin haut-gauche.
 */
function paste(target, size, block, blockSize, at) {
  for (let y = 0; y < blockSize.height; y++) {
    target.set(block.subarray(y * blockSize.width, (y + 1) * blockSize.width), (at.y + y) * size + at.x);
  }
}

/**
 * Indique si une boîte englobante est trop petite pour représenter un chiffre.
 * @param {Box} box
 * @param {number} width - Largeur du dessin.
 * @param {number} height - Hauteur du dessin.
 * @param {number} [minExtent] - Fraction minimale du plus grand côté du dessin.
 * @returns {boolean}
 */
export function isTooSmall(box, width, height, minExtent = MIN_EXTENT) {
  return Math.max(box.width, box.height) < minExtent * Math.max(width, height);
}

/**
 * Chaîne complète : boîte englobante → 20×20 proportionnel → 28×28 centré
 * sur le centre de masse.
 * @param {ArrayLike<number>} ink - Encre du dessin (0..1).
 * @param {number} width
 * @param {number} height
 * @param {{minExtent?: number}} [options]
 * @returns {MnistResult}
 */
export function toMnist(ink, width, height, { minExtent = MIN_EXTENT } = {}) {
  const image = new Float32Array(MNIST_SIZE * MNIST_SIZE);
  const box = boundingBox(ink, width, height);
  const blank = { image, scaled: null, scaledSize: { width: 0, height: 0 }, shift: { x: 0, y: 0 }, centerOfMass: null };
  if (!box) {
    return { ...blank, empty: true, tooSmall: false, box: null };
  }
  if (isTooSmall(box, width, height, minExtent)) {
    // La boîte reste fournie pour être montrée ; l'image vide n'est pas envoyée au réseau.
    return { ...blank, empty: false, tooSmall: true, box };
  }
  const scaledSize = fitInBox(box);
  const scaled = resampleArea(ink, width, box, scaledSize.width, scaledSize.height);
  // Un trait très pâle peut disparaître au rééchantillonnage : on garde le centre géométrique.
  const com = centerOfMass(scaled, scaledSize.width, scaledSize.height) ??
    { x: (scaledSize.width - 1) / 2, y: (scaledSize.height - 1) / 2 };
  const shift = {
    x: centeredOffset(com.x, scaledSize.width, MNIST_SIZE),
    y: centeredOffset(com.y, scaledSize.height, MNIST_SIZE),
  };
  paste(image, MNIST_SIZE, scaled, scaledSize, shift);
  return { empty: false, tooSmall: false, image, box, scaled, scaledSize, shift, centerOfMass: centerOfMass(image, MNIST_SIZE, MNIST_SIZE) };
}
