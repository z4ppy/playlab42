/**
 * Éditeur : relie le document, l'historique, les outils, la vue et l'interface.
 *
 * Les outils ne touchent jamais directement à l'historique : ils dessinent
 * sur le calque en cours puis appellent commitPending / commitPixels, qui
 * mesurent la zone modifiée et enregistrent un patch. Toutes les opérations
 * de calques passent par le modèle (src/core/document.js), qui renvoie
 * l'entrée d'historique correspondante.
 */

import { PaintDocument, solidBuffer } from '../core/document.js';
import { History, createPixelPatch } from '../core/history.js';
import { clipToDocument, isEmptyRect } from '../core/geometry.js';
import { pushRecentColor, rgbToHex } from '../core/color.js';
import { fitView, keepInView, screenToDoc, stepZoom, zoomAt, zoomTo } from '../core/viewport.js';
import { createTools, sanitizeOption } from '../tools/index.js';
import { createCanvasSurface } from './canvas-surface.js';
import { PendingLayer } from './pending-layer.js';
import { SelectionController } from './selection.js';

/** Taille du document par défaut (paysage 4:3, raisonnable sur téléphone). */
export const DEFAULT_SIZE = { width: 1200, height: 900 };

const BLACK = { r: 0, g: 0, b: 0, a: 255 };
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

export class Editor {
  /**
   * @param {{onChange: (what: Set<string>) => void, toast: (message: string) => void}} hooks
   *   onChange : l'interface se met à jour ('layers', 'history', 'tool', 'colors', 'view', 'selection', 'document')
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.history = new History();
    this.pending = new PendingLayer();
    this.selection = new SelectionController(this);
    this.tools = createTools();
    this.tool = this.tools[0];
    /** @type {Record<string, Record<string, any>>} Réglages par outil. */
    this.settings = Object.fromEntries(this.tools.map((tool) => [tool.id, { ...tool.defaults }]));
    this.colors = { primary: { ...BLACK }, secondary: { ...WHITE } };
    /** @type {string[]} */
    this.recentColors = [];
    this.strokeColor = this.colors.primary;
    this.otherColor = this.colors.secondary;
    this.view = { scale: 1, x: 0, y: 0 };
    this.screen = { width: 1, height: 1 };
    this.hover = null;
    this.spaceHeld = false;
    this.showGrid = true;
    /** @type {any} Renseigné par main.js (dépend du canvas d'affichage). */
    this.renderer = null;
    this.frame = 0;
    /** @type {Set<string>} Changements à signaler à l'interface. */
    this.changes = new Set();
    this.doc = this.blankDocument(DEFAULT_SIZE.width, DEFAULT_SIZE.height, true);
  }

  // ------------------------------------------------------------ document

  /**
   * Document neuf d'un calque, fond blanc ou transparent.
   * @param {number} width
   * @param {number} height
   * @param {boolean} whiteBackground
   */
  blankDocument(width, height, whiteBackground) {
    const doc = new PaintDocument({ width, height, createSurface: createCanvasSurface });
    const layer = doc.createLayer({ name: 'Fond', buffer: whiteBackground ? solidBuffer(width, height) : null });
    doc.layers.push(layer);
    doc.activeId = layer.id;
    return doc;
  }

  /**
   * Remplace le document (nouveau, ouverture, restauration) : historique vidé.
   * @param {PaintDocument} doc
   */
  setDocument(doc) {
    this.selection.reset();
    this.doc = doc;
    this.history.clear();
    this.documentResized();
    this.notify('document', 'layers', 'history', 'selection');
  }

  /** Adapte tampons et vue après un changement de taille du document. */
  documentResized() {
    this.pending.resize(this.doc.width, this.doc.height);
    this.renderer?.resizeDocument(this.doc.width, this.doc.height);
    this.fit();
  }

  // ------------------------------------------------------------- calques

  /**
   * Calque actif s'il est modifiable ; sinon explique pourquoi.
   * @returns {any|null}
   */
  editableLayer() {
    const layer = this.doc.activeLayer;
    if (layer.locked) {
      this.hooks.toast(`Le calque « ${layer.name} » est verrouillé.`);
      return null;
    }
    if (!layer.visible) {
      this.hooks.toast(`Le calque « ${layer.name} » est masqué : affichez-le pour dessiner.`);
      return null;
    }
    return layer;
  }

  /**
   * Prépare le calque en cours pour un geste de dessin.
   * @param {{erase?: boolean, opacity?: number, secondary?: boolean}} options
   * @returns {boolean} Faux si le calque actif n'est pas modifiable
   */
  beginPending(options) {
    this.selection.commit();
    const layer = this.editableLayer();
    if (!layer) {
      return false;
    }
    this.strokeColor = options.secondary ? this.colors.secondary : this.colors.primary;
    this.otherColor = options.secondary ? this.colors.primary : this.colors.secondary;
    this.pending.begin(layer.id, options);
    return true;
  }

  /**
   * Applique le calque en cours au calque cible et enregistre le patch.
   * @param {string} label
   * @param {{area?: any, before?: any}} [override] - Zone et état « avant » imposés (déplacement)
   */
  commitPending(label, override = {}) {
    const pending = this.pending;
    const layer = this.doc.getLayer(pending.layerId);
    const area = override.area ?? clipToDocument(pending.dirty, this.doc.width, this.doc.height);
    if (layer && !isEmptyRect(area)) {
      this.commitPixels(layer, area, label, () => layer.surface.composite(pending, pending.opacity, pending.mode), override.before);
    }
    pending.reset();
    this.requestRender();
  }

  cancelPending() {
    this.pending.reset();
    this.requestRender();
  }

  /**
   * Modifie des pixels d'un calque et enregistre uniquement la zone changée.
   * @param {any} layer
   * @param {{x: number, y: number, width: number, height: number}} rect - Zone incluse dans le document
   * @param {string} label
   * @param {() => void} mutate
   * @param {any} [before] - État « avant » déjà connu
   */
  commitPixels(layer, rect, label, mutate, before = layer.surface.read(rect)) {
    mutate();
    this.record(createPixelPatch(layer.id, rect, before, layer.surface.read(rect), label));
    this.notify('thumbs');
  }

  /**
   * Enregistre une entrée d'historique produite par le modèle.
   * @param {any} entry - null : opération refusée ou sans effet
   */
  record(entry) {
    if (!entry) {
      return false;
    }
    this.history.push(entry);
    this.requestRender();
    this.notify('history', entry.kind === 'pixels' ? 'thumbs' : 'layers');
    return true;
  }

  /**
   * Annule (direction 'undo') ou rétablit ('redo') une étape.
   * @param {'undo'|'redo'} direction
   */
  step(direction) {
    this.toolCancel();
    this.selection.commit();
    const entry = direction === 'undo' ? this.history.undo() : this.history.redo();
    if (!entry) {
      return;
    }
    const size = `${this.doc.width}x${this.doc.height}`;
    this.doc.apply(entry, direction);
    if (size !== `${this.doc.width}x${this.doc.height}`) {
      this.selection.setRect(null);
      this.documentResized();
    }
    this.requestRender();
    this.notify('history', 'layers');
  }

  // ------------------------------------------------------------- outils

  /** @param {string} id */
  setTool(id) {
    const tool = this.tools.find((item) => item.id === id);
    if (!tool || tool === this.tool) {
      return;
    }
    this.toolCancel();
    if (!['select', 'move'].includes(id)) {
      this.selection.commit();
    }
    this.tool = tool;
    this.requestRender(false);
    this.notify('tool');
  }

  /** @param {string} id */
  settingsFor(id) {
    return this.settings[id];
  }

  /**
   * Modifie un réglage (borné) ; renvoie la valeur retenue.
   * @param {string} toolId
   * @param {string} name
   * @param {unknown} value
   * @param {boolean} [final] - Fin du réglage : sauvegarde des préférences
   */
  setSetting(toolId, name, value, final = true) {
    const settings = this.settings[toolId];
    settings[name] = sanitizeOption(name, value, settings[name]);
    this.requestRender(false);
    if (final) {
      this.notify('settings');
    }
    return settings[name];
  }

  toolDown(p) {
    this.tool.down(this, p);
  }

  toolMove(p) {
    this.hover = p;
    this.tool.move(this, p);
  }

  toolUp(p) {
    this.tool.up(this, p);
  }

  toolCancel() {
    this.tool.cancel(this);
  }

  // ------------------------------------------------------------- couleurs

  /**
   * @param {'primary'|'secondary'} which
   * @param {{r: number, g: number, b: number, a?: number}} color
   * @param {{recent?: boolean}} [options]
   */
  setColor(which, color, options = {}) {
    this.colors[which] = { a: 255, ...color };
    if (options.recent !== false) {
      this.rememberColor(which);
    }
    this.notify('colors');
  }

  /** Ajoute une couleur aux récentes. */
  rememberColor(which) {
    this.recentColors = pushRecentColor(this.recentColors, rgbToHex(this.colors[which]));
    this.notify('colors', 'settings');
  }

  swapColors() {
    this.colors = { primary: this.colors.secondary, secondary: this.colors.primary };
    this.notify('colors');
  }

  defaultColors() {
    this.colors = { primary: { ...BLACK }, secondary: { ...WHITE } };
    this.notify('colors');
  }

  /**
   * Couleur d'un pixel, de l'image fusionnée ou du calque actif.
   * @returns {{r: number, g: number, b: number, a: number}|null}
   */
  sampleColor(x, y, allLayers) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= this.doc.width || py >= this.doc.height) {
      return null;
    }
    const data = allLayers
      ? this.compositeContext().getImageData(px, py, 1, 1).data
      : this.doc.activeLayer.surface.read({ x: px, y: py, width: 1, height: 1 }).data;
    // Un pixel transparent ne change pas la couleur : on garde la teinte, opaque.
    return data[3] === 0 ? null : { r: data[0], g: data[1], b: data[2], a: 255 };
  }

  /** Contexte de l'image composée, à jour. */
  compositeContext() {
    if (this.renderer.needsCompose) {
      this.renderer.composeDocument();
    }
    return this.renderer.compositeCtx;
  }

  /** Image fusionnée complète (pot de peinture « tous les calques »). */
  compositeBuffer() {
    const image = this.compositeContext().getImageData(0, 0, this.doc.width, this.doc.height);
    return { width: image.width, height: image.height, data: image.data };
  }

  // ------------------------------------------------------------------ vue

  /** @param {{x: number, y: number}} screenPoint */
  toDoc(screenPoint) {
    return screenToDoc(this.view, screenPoint);
  }

  /** Centre de la partie visible du document (point de collage). */
  visibleCenter() {
    const center = this.toDoc({ x: this.screen.width / 2, y: this.screen.height / 2 });
    return {
      x: Math.min(this.doc.width, Math.max(0, center.x)),
      y: Math.min(this.doc.height, Math.max(0, center.y)),
    };
  }

  setView(view) {
    this.view = keepInView(view, this.doc, this.screen);
    this.requestRender(false);
    this.notify('view');
  }

  panBy(dx, dy) {
    this.setView({ ...this.view, x: this.view.x + dx, y: this.view.y + dy });
  }

  zoomAt(factor, center) {
    this.setView(zoomAt(this.view, factor, center));
  }

  /** Palier suivant (+1) ou précédent (−1), centré sur l'écran. */
  zoomStep(direction) {
    this.setView(zoomTo(this.view, stepZoom(this.view.scale, direction), this.screenCenter()));
  }

  zoomActual() {
    this.setView(zoomTo(this.view, 1, this.screenCenter()));
  }

  fit() {
    this.setView(fitView(this.doc.width, this.doc.height, this.screen.width, this.screen.height));
  }

  screenCenter() {
    return { x: this.screen.width / 2, y: this.screen.height / 2 };
  }

  /** Nouvelle taille de la zone d'affichage. */
  resizeScreen(width, height) {
    const first = this.screen.width <= 1;
    this.screen = { width, height };
    this.renderer.resize(width, height);
    if (first) {
      this.fit();
    } else {
      this.setView(this.view);
    }
  }

  /** @param {{x: number, y: number}|null} point */
  setHover(point) {
    this.hover = point;
    if (this.tool.cursor === 'brush') {
      this.requestRender(false);
    }
  }

  // ----------------------------------------------------------- affichage

  /**
   * Programme un rendu à la prochaine image.
   * @param {boolean} [documentChanged] - Faux pour un simple changement de vue
   */
  requestRender(documentChanged = true) {
    if (!this.renderer) {
      return;
    }
    if (documentChanged) {
      this.renderer.documentDirty = true;
    }
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.renderer.render();
      });
    }
  }

  /** Rendu après une modification du seul calque en cours : seule la zone touchée est recomposée. */
  renderPending() {
    this.renderer?.invalidate(this.pending.takeFrame());
    this.requestRender(false);
  }

  /** Signale des changements à l'interface (regroupés à la microtâche suivante). */
  notify(...what) {
    const first = this.changes.size === 0;
    for (const item of what) {
      this.changes.add(item);
    }
    if (first) {
      queueMicrotask(() => {
        const changes = this.changes;
        this.changes = new Set();
        this.hooks.onChange(changes);
      });
    }
  }

  selectionChanged() {
    this.requestRender(false);
    this.notify('selection');
  }
}
