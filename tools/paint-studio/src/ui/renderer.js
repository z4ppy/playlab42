/**
 * Affichage : composition des calques puis dessin de la vue (zoom, damier de
 * transparence, grille de pixels, sélection, curseur du pinceau).
 *
 * Deux étapes séparées : la composition (coûteuse, taille du document) n'est
 * refaite que si les pixels ont changé ; un zoom ou un panoramique ne fait
 * que redessiner l'image composée avec une autre transformation. Pendant un
 * geste, seule la zone touchée depuis l'image précédente est recomposée
 * (invalidate) : le coût suit la taille du pinceau, pas celle du document.
 */

import { createCanvas, context2d, drawWith } from './canvas-surface.js';
import { PIXEL_GRID_ZOOM, docToScreen } from '../core/viewport.js';
import { EMPTY_RECT, clipToDocument, isEmptyRect, unionRect } from '../core/geometry.js';

/** Côté d'une case du damier de transparence, en pixels écran. */
const CHECKER = 12;

/** Lit une variable CSS du thème (couleurs du damier, du fond, de la sélection). */
function themeColor(element, name, fallback) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas d'affichage
   * @param {any} editor
   */
  constructor(canvas, editor) {
    this.canvas = canvas;
    this.ctx = context2d(canvas);
    this.editor = editor;
    this.composite = createCanvas(1, 1);
    // Relu par la pipette et le pot de peinture « tous les calques » ; sur le
    // processeur comme les calques, pour composer sans aller-retour graphique.
    this.compositeCtx = context2d(this.composite, { willReadFrequently: true });
    this.scratch = createCanvas(1, 1);
    this.scratchCtx = context2d(this.scratch);
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    /** Vrai : tout le document est à recomposer. */
    this.documentDirty = true;
    /** Zone à recomposer quand seul le calque en cours a changé. */
    this.region = { ...EMPTY_RECT };
    this.refreshTheme();
  }

  /**
   * Ajoute une zone à recomposer (coordonnées document).
   * @param {{x: number, y: number, width: number, height: number}} rect
   */
  invalidate(rect) {
    this.region = unionRect(this.region, rect);
  }

  /** Vrai si l'image composée n'est plus à jour. */
  get needsCompose() {
    return this.documentDirty || !isEmptyRect(this.region);
  }

  /** Relit les couleurs du thème (appelé au changement clair / sombre). */
  refreshTheme() {
    const el = this.canvas;
    this.colors = {
      stage: themeColor(el, '--ps-stage', '#202938'),
      checkerA: themeColor(el, '--ps-checker-a', '#ffffff'),
      checkerB: themeColor(el, '--ps-checker-b', '#d6dbe4'),
      grid: themeColor(el, '--ps-grid', 'rgba(0, 0, 0, 0.18)'),
    };
    const tile = createCanvas(CHECKER * 2, CHECKER * 2);
    const tileCtx = context2d(tile);
    tileCtx.fillStyle = this.colors.checkerA;
    tileCtx.fillRect(0, 0, CHECKER * 2, CHECKER * 2);
    tileCtx.fillStyle = this.colors.checkerB;
    tileCtx.fillRect(0, 0, CHECKER, CHECKER);
    tileCtx.fillRect(CHECKER, CHECKER, CHECKER, CHECKER);
    this.checker = this.ctx.createPattern(tile, 'repeat');
  }

  /**
   * Taille d'affichage en pixels CSS ; le canvas suit la densité de l'écran.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  /** Adapte les tampons de composition à la taille du document. */
  resizeDocument(width, height) {
    for (const canvas of [this.composite, this.scratch]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.documentDirty = true;
  }

  /**
   * Recompose les calques visibles : tout le document, ou seulement la zone invalidée.
   * @returns {{x: number, y: number, width: number, height: number}} Zone recomposée
   */
  composeDocument() {
    const { doc } = this.editor;
    const whole = { x: 0, y: 0, width: doc.width, height: doc.height };
    const area = this.documentDirty ? whole : clipToDocument(this.region, doc.width, doc.height);
    this.documentDirty = false;
    this.region = { ...EMPTY_RECT };
    if (!isEmptyRect(area)) {
      this.composeArea(area);
    }
    return area;
  }

  /**
   * Recompose une zone entière du document (les modes de fusion disponibles
   * n'agissent que là où l'on dessine : rien n'est touché hors de la zone).
   * @param {{x: number, y: number, width: number, height: number}} area
   */
  composeArea(area) {
    const { doc, pending } = this.editor;
    const ctx = this.compositeCtx;
    const { x, y, width, height } = area;
    const copy = (target, source) => target.drawImage(source, x, y, width, height, x, y, width, height);
    ctx.clearRect(x, y, width, height);
    for (const layer of doc.layers) {
      if (layer.visible) {
        const source = pending.layerId === layer.id ? this.withPending(layer, copy, area) : layer.surface.canvas;
        drawWith(ctx, { alpha: layer.opacity, mode: layer.blend }, () => copy(ctx, source));
      }
    }
  }

  /**
   * Calque cible + geste en cours, combinés avant le mode de fusion du calque.
   * @returns {HTMLCanvasElement}
   */
  withPending(layer, copy, area) {
    const { pending } = this.editor;
    const ctx = this.scratchCtx;
    ctx.clearRect(area.x, area.y, area.width, area.height);
    copy(ctx, layer.surface.canvas);
    drawWith(ctx, { alpha: pending.opacity, mode: pending.mode }, () => copy(ctx, pending.canvas));
    return this.scratch;
  }

  /** Dessine une image complète de la vue. */
  render() {
    if (this.needsCompose) {
      this.composeDocument();
    }
    const { ctx } = this;
    const { view, doc } = this.editor;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.colors.stage;
    ctx.fillRect(0, 0, this.width, this.height);
    const w = doc.width * view.scale;
    const h = doc.height * view.scale;
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.fillStyle = /** @type {CanvasPattern} */ (this.checker);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // Lissage à la réduction ; pixels nets dès 100 % (pixel art, retouche fine).
    ctx.imageSmoothingEnabled = view.scale < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.composite, view.x, view.y, w, h);
    this.drawPixelGrid();
    this.drawSelection();
    this.drawCursor();
  }

  /** Grille marquant chaque pixel, au fort zoom, limitée à la partie visible. */
  drawPixelGrid() {
    const { view, doc } = this.editor;
    if (view.scale < PIXEL_GRID_ZOOM || !this.editor.showGrid) {
      return;
    }
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(-view.x / view.scale));
    const y0 = Math.max(0, Math.floor(-view.y / view.scale));
    const x1 = Math.min(doc.width, Math.ceil((this.width - view.x) / view.scale));
    const y1 = Math.min(doc.height, Math.ceil((this.height - view.y) / view.scale));
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      const sx = Math.round(view.x + x * view.scale) + 0.5;
      ctx.moveTo(sx, view.y + y0 * view.scale);
      ctx.lineTo(sx, view.y + y1 * view.scale);
    }
    for (let y = y0; y <= y1; y++) {
      const sy = Math.round(view.y + y * view.scale) + 0.5;
      ctx.moveTo(view.x + x0 * view.scale, sy);
      ctx.lineTo(view.x + x1 * view.scale, sy);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.colors.grid;
    ctx.stroke();
  }

  /** Pointillés noir et blanc lisibles sur toute image (« fourmis »). */
  drawSelection() {
    const rect = this.editor.selection.rect;
    if (!rect) {
      return;
    }
    const { view } = this.editor;
    const corner = docToScreen(view, rect);
    const args = [Math.round(corner.x) + 0.5, Math.round(corner.y) + 0.5, Math.round(rect.width * view.scale), Math.round(rect.height * view.scale)];
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(...args);
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(...args);
    ctx.restore();
  }

  /** Contour du pinceau sous la souris ou le stylet en survol. */
  drawCursor() {
    const hover = this.editor.hover;
    const tool = this.editor.tool;
    if (!hover || tool.cursor !== 'brush') {
      return;
    }
    const { view } = this.editor;
    const size = this.editor.settingsFor(tool.id).size;
    const center = docToScreen(view, hover);
    const radius = Math.max(2, (size * view.scale) / 2);
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    for (const [color, offset] of [['rgba(0, 0, 0, 0.7)', 0.5], ['rgba(255, 255, 255, 0.9)', -0.5]]) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius + offset, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.restore();
  }
}
