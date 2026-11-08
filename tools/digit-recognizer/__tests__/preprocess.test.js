/**
 * Tests du prétraitement façon MNIST (fonctions pures, sans DOM).
 */
import {
  MIN_EXTENT, MNIST_BOX, MNIST_SIZE, alphaToInk, boundingBox, centerOfMass, coverage, fitInBox, isTooSmall, resampleArea, toMnist,
} from '../src/preprocess.js';
import { predict } from '../src/model.js';
import { readModel, readSamples } from './support/model-files.js';

/**
 * Dessin synthétique : rectangle plein d'encre 1 dans un canvas vide.
 * @returns {Float32Array}
 */
function rectangle(width, height, rect) {
  const ink = new Float32Array(width * height);
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    ink.fill(1, y * width + rect.x, y * width + rect.x + rect.width);
  }
  return ink;
}

/** Somme des valeurs d'une image. */
const total = (/** @type {ArrayLike<number>} */ values) => Array.from(values).reduce((s, v) => s + v, 0);

/**
 * Agrandit une image 28×28 d'un facteur entier (plus proche voisin), comme si
 * un chiffre MNIST avait été dessiné en grand dans un coin du canvas.
 */
function upscale(image, factor, canvasSize, at) {
  const ink = new Float32Array(canvasSize * canvasSize);
  for (let y = 0; y < 28 * factor; y++) {
    for (let x = 0; x < 28 * factor; x++) {
      ink[(at.y + y) * canvasSize + at.x + x] = image[Math.floor(y / factor) * 28 + Math.floor(x / factor)];
    }
  }
  return ink;
}

describe('alphaToInk', () => {
  test('lit le canal alpha (0..255) comme une encre 0..1', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 0, 255, 255, 255, 255, 0, 0, 0, 51]);
    expect(Array.from(alphaToInk(rgba))).toEqual([0, 1, expect.closeTo(0.2, 5)]);
  });
});

describe('boundingBox', () => {
  test('renvoie null pour un dessin vide ou sous le seuil', () => {
    expect(boundingBox(new Float32Array(100), 10, 10)).toBeNull();
    expect(boundingBox(new Float32Array(100).fill(0.01), 10, 10)).toBeNull();
  });

  test('encadre exactement les pixels d\'encre', () => {
    const ink = rectangle(50, 40, { x: 7, y: 3, width: 10, height: 20 });
    expect(boundingBox(ink, 50, 40)).toEqual({ x: 7, y: 3, width: 10, height: 20 });
  });
});

describe('coverage', () => {
  test('découpe un intervalle fractionnaire en pixels pondérés de somme égale à sa longueur', () => {
    const cells = coverage(1.5, 4.25);
    expect(cells.map(([index]) => index)).toEqual([1, 2, 3, 4]);
    expect(cells.map(([, weight]) => weight)).toEqual([0.5, 1, 1, 0.25]);
  });
});

describe('resampleArea', () => {
  test('moyenne l\'aire : un damier 2×2 réduit à 1 pixel donne 0,5', () => {
    const ink = new Float32Array([1, 0, 0, 1]);
    expect(Array.from(resampleArea(ink, 2, { x: 0, y: 0, width: 2, height: 2 }, 1, 1))).toEqual([0.5]);
  });

  test('agrandit sans créer d\'encre : un pixel plein donne un bloc plein', () => {
    const out = resampleArea(new Float32Array([1]), 1, { x: 0, y: 0, width: 1, height: 1 }, 4, 4);
    expect(Array.from(out).every(v => Math.abs(v - 1) < 1e-6)).toBe(true);
  });
});

describe('fitInBox', () => {
  test('le plus grand côté devient 20 et les proportions sont conservées', () => {
    expect(fitInBox({ x: 0, y: 0, width: 40, height: 100 })).toEqual({ width: 8, height: MNIST_BOX });
    expect(fitInBox({ x: 0, y: 0, width: 300, height: 150 })).toEqual({ width: MNIST_BOX, height: 10 });
    expect(fitInBox({ x: 0, y: 0, width: 1, height: 200 })).toEqual({ width: 1, height: MNIST_BOX });
  });
});

describe('centerOfMass', () => {
  test('barycentre pondéré par l\'encre, null si vide', () => {
    const pixels = new Float32Array(9);
    pixels[0] = 1; // (0, 0)
    pixels[8] = 3; // (2, 2)
    expect(centerOfMass(pixels, 3, 3)).toEqual({ x: 1.5, y: 1.5 });
    expect(centerOfMass(new Float32Array(9), 3, 3)).toBeNull();
  });
});

describe('toMnist', () => {
  test('un dessin vide reste vide', () => {
    const result = toMnist(new Float32Array(400), 20, 20);
    expect(result.empty).toBe(true);
    expect(result.image).toHaveLength(MNIST_SIZE * MNIST_SIZE);
    expect(total(result.image)).toBe(0);
  });

  test('produit une image 28×28 dont le centre de masse est au centre', () => {
    const ink = rectangle(320, 320, { x: 10, y: 200, width: 40, height: 100 });
    const result = toMnist(ink, 320, 320);
    expect(result.empty).toBe(false);
    expect(result.image).toHaveLength(784);
    expect(result.scaledSize).toEqual({ width: 8, height: 20 });
    // Décalage entier : le centre de masse est à moins d'un demi-pixel du centre (13,5).
    expect(Math.abs(result.centerOfMass.x - 13.5)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(result.centerOfMass.y - 13.5)).toBeLessThanOrEqual(0.5);
    expect(Math.max(...result.image)).toBeLessThanOrEqual(1);
  });

  test('la position et la taille du dessin n\'influencent pas l\'image produite', () => {
    const small = toMnist(rectangle(320, 320, { x: 10, y: 10, width: 30, height: 60 }), 320, 320);
    const large = toMnist(rectangle(320, 320, { x: 150, y: 100, width: 100, height: 200 }), 320, 320);
    small.image.forEach((value, i) => expect(value).toBeCloseTo(large.image[i], 5));
  });

  test('un chiffre étroit (« 1 ») garde sa finesse au lieu d\'être étiré', () => {
    const result = toMnist(rectangle(320, 320, { x: 150, y: 40, width: 20, height: 240 }), 320, 320);
    expect(result.scaledSize.height).toBe(20);
    expect(result.scaledSize.width).toBe(2);
  });

  test('un simple appui (petit disque) est « trop petit » et n\'est pas agrandi en 20×20', () => {
    // Non-régression : un toucher accidentel donnait un disque plein 20×20 lu avec assurance.
    const tap = rectangle(320, 320, { x: 150, y: 150, width: 27, height: 27 });
    const result = toMnist(tap, 320, 320);
    expect(result.empty).toBe(false);
    expect(result.tooSmall).toBe(true);
    expect(result.box).toEqual({ x: 150, y: 150, width: 27, height: 27 });
    expect(result.scaled).toBeNull();
    expect(total(result.image)).toBe(0);
  });

  test('isTooSmall compare le plus grand côté à une fraction du dessin', () => {
    expect(MIN_EXTENT).toBeGreaterThan(0.085); // plus grand que le diamètre d'un point du crayon
    expect(isTooSmall({ x: 0, y: 0, width: 47, height: 10 }, 320, 320)).toBe(true);
    expect(isTooSmall({ x: 0, y: 0, width: 4, height: 48 }, 320, 320)).toBe(false);
    expect(isTooSmall({ x: 0, y: 0, width: 20, height: 20 }, 100, 100, 0.1)).toBe(false);
  });

  test('un trait assez grand n\'est pas marqué trop petit', () => {
    const result = toMnist(rectangle(320, 320, { x: 150, y: 100, width: 10, height: 60 }), 320, 320);
    expect(result.tooSmall).toBe(false);
    expect(total(result.image)).toBeGreaterThan(0);
  });

  test('ne coupe jamais l\'encre, même très décentrée dans son cadre', () => {
    // Un « L » : une masse lourde en bas tire le centre de masse vers le bas.
    const ink = rectangle(100, 100, { x: 10, y: 0, width: 4, height: 100 });
    ink.fill(1, 96 * 100, 100 * 100);
    const result = toMnist(ink, 100, 100);
    expect(total(result.image)).toBeCloseTo(total(/** @type {Float32Array} */ (result.scaled)), 3);
  });
});

describe('toMnist sur de vrais chiffres MNIST redessinés', () => {
  const model = readModel();
  const samples = readSamples();

  test.each(samples.map(s => [s.label, s.index, s]))(
    'le %i (image de test n°%i) agrandi dans un coin est toujours reconnu',
    (label, _index, sample) => {
      const ink = upscale(sample.image, 6, 320, { x: 4, y: 140 });
      const result = toMnist(ink, 320, 320);
      expect(predict(model, result.image).digit).toBe(label);
    },
  );
});
