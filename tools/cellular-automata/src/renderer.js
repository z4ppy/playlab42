/**
 * Rendu canvas : les cellules sont peintes 1 pixel par cellule dans une image
 * hors écran (ImageData), puis agrandie sans lissage à l'échelle de la vue.
 * Une seule copie d'image par trame suffit, même pour 256×256 cellules.
 */

import { buildPalette, paintCells } from './palette.js';

/**
 * Lit une variable CSS du document.
 * @param {string} name
 * @returns {string}
 */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Description d'une image à dessiner.
 * @typedef {object} Frame
 * @property {Uint16Array} ages - Âges (0 = morte), largeur × hauteur
 * @property {Uint8Array|null} trail - Traînées, ou null
 * @property {number} width
 * @property {number} height
 * @property {import('./view.js').View} view
 * @property {Array<[number, number]>|null} [ghost] - Cellules d'aperçu (motif)
 * @property {{ x: number, y: number }|null} [cursor] - Cellule survolée
 */

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.buffer = document.createElement('canvas');
    this.bufferCtx = /** @type {CanvasRenderingContext2D} */ (this.buffer.getContext('2d'));
    /** @type {ImageData|null} */
    this.image = null;
    /** @type {Uint32Array|null} */
    this.pixels = null;
    this.cssWidth = 1;
    this.cssHeight = 1;
    this.dpr = 1;
    this.trace = true;
    this.colors = { grid: '', ghost: '', cursor: '' };
    this.palette = this.readPalette();
  }

  /**
   * Relit les couleurs du thème courant (au démarrage et à chaque changement).
   * @param {boolean} [trace]
   */
  refreshTheme(trace = this.trace) {
    this.trace = trace;
    this.palette = this.readPalette();
  }

  /**
   * @returns {import('./palette.js').Palette}
   */
  readPalette() {
    this.colors = { grid: cssVar('--ca-grid'), ghost: cssVar('--ca-ghost'), cursor: cssVar('--ca-cursor') };
    return buildPalette({
      background: cssVar('--ca-bg') || '#000000',
      young: cssVar('--ca-young') || '#ffffff',
      mid: cssVar('--ca-mid') || '#ff0000',
      old: cssVar('--ca-old') || '#0000ff',
      trail: cssVar('--ca-trail') || '#0000ff',
    }, this.trace);
  }

  /**
   * Adapte la résolution du canvas à sa taille affichée et à la densité de pixels.
   * @returns {{ width: number, height: number }} Taille en pixels CSS
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    return { width: this.cssWidth, height: this.cssHeight };
  }

  /**
   * Peint les cellules dans l'image hors écran.
   * @param {Frame} frame
   */
  paintBuffer(frame) {
    if (!this.image || this.image.width !== frame.width || this.image.height !== frame.height) {
      this.buffer.width = frame.width;
      this.buffer.height = frame.height;
      this.image = this.bufferCtx.createImageData(frame.width, frame.height);
      this.pixels = new Uint32Array(this.image.data.buffer);
    }
    paintCells(/** @type {Uint32Array} */ (this.pixels), frame.ages, this.trace ? frame.trail : null, this.palette);
    this.bufferCtx.putImageData(this.image, 0, 0);
  }

  /**
   * Dessine une image complète.
   * @param {Frame} frame
   */
  draw(frame) {
    const { ctx, dpr } = this;
    const { view } = frame;
    this.paintBuffer(frame);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, view.offsetX, view.offsetY, frame.width * view.scale, frame.height * view.scale);
    if (view.scale >= 8) {
      this.drawGridLines(frame);
    }
    if (frame.ghost) {
      this.drawCells(frame, frame.ghost, this.colors.ghost);
    }
    if (frame.cursor) {
      this.drawCursor(frame.view, frame.cursor);
    }
  }

  /**
   * Quadrillage discret quand les cellules sont assez grandes, limité à la zone visible.
   * @param {Frame} frame
   */
  drawGridLines(frame) {
    const { ctx } = this;
    const { view, width, height } = frame;
    const left = Math.max(0, Math.floor(-view.offsetX / view.scale));
    const right = Math.min(width, Math.ceil((this.cssWidth - view.offsetX) / view.scale));
    const top = Math.max(0, Math.floor(-view.offsetY / view.scale));
    const bottom = Math.min(height, Math.ceil((this.cssHeight - view.offsetY) / view.scale));
    ctx.beginPath();
    for (let x = left; x <= right; x++) {
      const px = Math.round(view.offsetX + x * view.scale) + 0.5;
      ctx.moveTo(px, view.offsetY + top * view.scale);
      ctx.lineTo(px, view.offsetY + bottom * view.scale);
    }
    for (let y = top; y <= bottom; y++) {
      const py = Math.round(view.offsetY + y * view.scale) + 0.5;
      ctx.moveTo(view.offsetX + left * view.scale, py);
      ctx.lineTo(view.offsetX + right * view.scale, py);
    }
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Cellules semi-transparentes (aperçu d'un motif), repliées sur le tore.
   * @param {Frame} frame
   * @param {Array<[number, number]>} cells
   * @param {string} color
   */
  drawCells(frame, cells, color) {
    const { ctx } = this;
    const { view, width, height } = frame;
    ctx.fillStyle = color;
    for (const [x, y] of cells) {
      const cx = ((x % width) + width) % width;
      const cy = ((y % height) + height) % height;
      ctx.fillRect(view.offsetX + cx * view.scale, view.offsetY + cy * view.scale, view.scale, view.scale);
    }
  }

  /**
   * Contour de la cellule visée par le pinceau (au moins 6 px pour rester visible).
   * @param {import('./view.js').View} view
   * @param {{ x: number, y: number }} cell
   */
  drawCursor(view, cell) {
    const size = Math.max(view.scale, 6);
    const pad = (size - view.scale) / 2;
    this.ctx.strokeStyle = this.colors.cursor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      view.offsetX + cell.x * view.scale - pad,
      view.offsetY + cell.y * view.scale - pad,
      size,
      size,
    );
  }

  /**
   * Image PNG des cellules, agrandie d'un facteur entier (environ 1024 px de côté).
   * @param {Frame} frame
   * @returns {Promise<Blob|null>}
   */
  exportPng(frame) {
    this.paintBuffer(frame);
    const factor = Math.max(1, Math.floor(1024 / Math.max(frame.width, frame.height)));
    const out = document.createElement('canvas');
    out.width = frame.width * factor;
    out.height = frame.height * factor;
    const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d'));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, out.width, out.height);
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  }
}
