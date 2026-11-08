/**
 * Sélection rectangulaire, contenu flottant et presse-papiers interne.
 *
 * Déplacer une sélection « soulève » ses pixels : ils sont retirés du calque
 * et affichés sur le calque en cours, à la position courante. À la validation,
 * un seul patch couvre l'union de l'emplacement d'origine et d'arrivée ; son
 * état « avant » est reconstitué en réinsérant les pixels soulevés, si bien
 * qu'annuler remet l'image exactement comme avant le déplacement.
 */

import { clipToDocument, isEmptyRect, rectContains, unionRect } from '../core/geometry.js';
import { writeRect } from '../core/history.js';
import { solidBuffer } from '../core/document.js';
import { createCanvas, context2d } from './canvas-surface.js';

/** Tampon transparent d'un rectangle. */
const transparent = (rect) => solidBuffer(rect.width, rect.height, { r: 0, g: 0, b: 0, a: 0 });

/** Canvas contenant une copie d'un tampon de pixels. */
function canvasFromBuffer(buffer) {
  const canvas = createCanvas(buffer.width, buffer.height);
  context2d(canvas).putImageData(new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height), 0, 0);
  return canvas;
}

export class SelectionController {
  /**
   * @param {any} editor - Éditeur (document, calque en cours, historique)
   */
  constructor(editor) {
    this.editor = editor;
    /** @type {{x: number, y: number, width: number, height: number}|null} */
    this.rect = null;
    /** @type {null|{layerId: string, canvas: HTMLCanvasElement, origin: any, original: any, x: number, y: number}} */
    this.floating = null;
    /** @type {HTMLCanvasElement|null} */
    this.clipboard = null;
  }

  get doc() {
    return this.editor.doc;
  }

  /** Rectangle de tout le document. */
  whole() {
    return { x: 0, y: 0, width: this.doc.width, height: this.doc.height };
  }

  /**
   * Définit la sélection (bornée au document, vide = aucune sélection).
   * @param {{x: number, y: number, width: number, height: number}|null} rect
   */
  setRect(rect) {
    const clipped = rect ? clipToDocument(rect, this.doc.width, this.doc.height) : null;
    this.rect = isEmptyRect(clipped) ? null : clipped;
    this.editor.selectionChanged();
  }

  selectAll() {
    this.commit();
    this.setRect(this.whole());
  }

  /** Valide le contenu flottant puis retire la sélection. */
  deselect() {
    this.commit();
    this.setRect(null);
  }

  /** @param {{x: number, y: number}} point */
  contains(point) {
    return Boolean(this.rect && rectContains(this.rect, point));
  }

  /**
   * Soulève les pixels de la sélection (ou de tout le calque) du calque actif.
   * @returns {boolean} Faux si le calque n'est pas modifiable
   */
  lift() {
    if (this.floating) {
      return true;
    }
    const layer = this.editor.editableLayer();
    if (!layer) {
      return false;
    }
    const origin = this.rect ?? this.whole();
    const original = layer.surface.read(origin);
    layer.surface.write(transparent(origin), origin.x, origin.y);
    this.floating = { layerId: layer.id, canvas: canvasFromBuffer(original), origin, original, x: origin.x, y: origin.y };
    this.rect = { ...origin };
    this.editor.pending.begin(layer.id);
    this.draw();
    return true;
  }

  /**
   * Pose un contenu flottant (collage) sur le calque actif, centré sur `center`.
   * @param {HTMLCanvasElement} canvas
   * @param {{x: number, y: number}} center - Point document
   */
  float(canvas, center) {
    this.commit();
    const layer = this.editor.editableLayer();
    if (!layer) {
      return false;
    }
    const x = Math.round(center.x - canvas.width / 2);
    const y = Math.round(center.y - canvas.height / 2);
    this.floating = { layerId: layer.id, canvas, origin: null, original: null, x, y };
    this.rect = { x, y, width: canvas.width, height: canvas.height };
    this.editor.pending.begin(layer.id);
    this.draw();
    this.editor.selectionChanged();
    return true;
  }

  /** Place le contenu flottant à une position absolue (pixels entiers). */
  moveTo(x, y) {
    const f = this.floating;
    if (!f) {
      return;
    }
    f.x = Math.round(x);
    f.y = Math.round(y);
    this.rect = { x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height };
    this.draw();
  }

  /** Redessine le contenu flottant sur le calque en cours. */
  draw() {
    const f = this.floating;
    const pending = this.editor.pending;
    pending.clearContent();
    pending.ctx.drawImage(f.canvas, f.x, f.y);
    pending.mark({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height });
    this.editor.renderPending();
  }

  /** Applique le contenu flottant au calque (une étape d'historique). */
  commit(label) {
    const f = this.floating;
    if (!f) {
      return;
    }
    const entryLabel = label ?? (f.origin ? 'Déplacer la sélection' : 'Coller');
    this.floating = null;
    const layer = this.doc.getLayer(f.layerId);
    const placed = { x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height };
    const area = clipToDocument(unionRect(f.origin, placed), this.doc.width, this.doc.height);
    if (layer && !isEmptyRect(area)) {
      const before = layer.surface.read(area);
      if (f.origin) {
        writeRect(before, f.original, f.origin.x - area.x, f.origin.y - area.y);
      }
      this.editor.commitPending(entryLabel, { area, before });
    } else {
      this.editor.cancelPending();
    }
    this.setRect(isEmptyRect(placed) ? null : placed);
  }

  /** Abandonne le déplacement en cours : les pixels reviennent à leur place. */
  cancelFloating() {
    const f = this.floating;
    if (!f) {
      return;
    }
    this.floating = null;
    if (f.origin) {
      this.doc.getLayer(f.layerId)?.surface.write(f.original, f.origin.x, f.origin.y);
    }
    this.editor.cancelPending();
    this.setRect(f.origin);
  }

  /**
   * Copie la sélection (ou le contenu flottant) du calque actif dans le presse-papiers interne.
   * @returns {HTMLCanvasElement|null}
   */
  copy() {
    if (this.floating) {
      this.clipboard = this.floating.canvas;
      return this.clipboard;
    }
    const layer = this.editor.doc.activeLayer;
    if (!this.rect || !layer) {
      return null;
    }
    this.clipboard = canvasFromBuffer(layer.surface.read(this.rect));
    return this.clipboard;
  }

  /** Efface les pixels sélectionnés du calque actif. */
  erase(label = 'Effacer la sélection') {
    if (this.floating) {
      this.editor.pending.clearContent();
      this.floating.canvas = createCanvas(1, 1);
      this.commit(label);
      this.setRect(null);
      return;
    }
    const layer = this.editor.editableLayer();
    const rect = this.rect;
    if (layer && rect) {
      this.editor.commitPixels(layer, rect, label, () => layer.surface.write(transparent(rect), rect.x, rect.y));
    }
  }

  cut() {
    if (this.copy()) {
      this.erase('Couper');
    }
  }

  /** Oublie tout (nouveau document). Le presse-papiers interne est conservé. */
  reset() {
    this.floating = null;
    this.rect = null;
  }
}
