/**
 * Surfaces de pixels sur canvas : implémentation navigateur du contrat
 * `Surface` du modèle (read / write / composite).
 *
 * Un canvas hors écran par calque : la composition à l'affichage et la fusion
 * de calques s'appuient sur drawImage + globalCompositeOperation, accélérés
 * par le navigateur, avec les mêmes formules que src/core/blend.js.
 */

/**
 * Crée un canvas hors document (OffscreenCanvas n'offre pas toDataURL, utile aux sauvegardes).
 * @param {number} width
 * @param {number} height
 */
export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Contexte 2D d'un canvas (lève une erreur explicite si indisponible).
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2DSettings} [settings]
 * @returns {CanvasRenderingContext2D}
 */
export function context2d(canvas, settings) {
  const ctx = canvas.getContext('2d', settings);
  if (!ctx) {
    throw new Error('Canvas 2D indisponible dans ce navigateur.');
  }
  return ctx;
}

/**
 * Surface de calque adossée à un canvas.
 * @param {number} width
 * @param {number} height
 */
export function createCanvasSurface(width, height) {
  const canvas = createCanvas(width, height);
  // Lectures fréquentes (pot de peinture, patches d'historique) : tampon côté CPU.
  const ctx = context2d(canvas, { willReadFrequently: true });
  return {
    width,
    height,
    canvas,
    ctx,
    /** @param {{x: number, y: number, width: number, height: number}} rect */
    read(rect) {
      const image = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
      return { width: image.width, height: image.height, data: image.data };
    },
    /** @param {{width: number, height: number, data: Uint8ClampedArray}} buffer */
    write(buffer, x, y) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), x, y);
    },
    /** @param {{canvas: HTMLCanvasElement}} source */
    composite(source, opacity, mode) {
      drawWith(ctx, { alpha: opacity, mode }, () => ctx.drawImage(source.canvas, 0, 0));
    },
  };
}

/**
 * Exécute un dessin avec une opacité et un mode de composition, puis restaure le contexte.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{alpha?: number, mode?: string}} state
 * @param {() => void} draw
 */
export function drawWith(ctx, state, draw) {
  ctx.save();
  ctx.globalAlpha = state.alpha ?? 1;
  ctx.globalCompositeOperation = /** @type {GlobalCompositeOperation} */ (state.mode ?? 'source-over');
  try {
    draw();
  } finally {
    ctx.restore();
  }
}

/**
 * Charge une image (fichier, blob ou data URL) en ImageBitmap ou HTMLImageElement.
 * @param {Blob|string} source
 * @returns {Promise<CanvasImageSource & {width: number, height: number}>}
 */
export async function loadImage(source) {
  if (typeof source !== 'string' && typeof createImageBitmap === 'function') {
    return createImageBitmap(source);
  }
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(url);
    }
  }
}
