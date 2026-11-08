/**
 * Calque « en cours » : reçoit le tracé (pinceau, crayon, gomme, forme) ou la
 * sélection flottante avant validation.
 *
 * Le tracé est d'abord dessiné ici à pleine opacité puis appliqué d'un coup
 * au calque cible avec l'opacité de l'outil : les tampons qui se chevauchent
 * ne s'accumulent pas au-delà de cette opacité, et annuler un geste (second
 * doigt, Échap) revient à vider ce calque, sans toucher au document.
 */

import { createCanvas, context2d } from './canvas-surface.js';
import { EMPTY_RECT, unionRect } from '../core/geometry.js';

export class PendingLayer {
  constructor() {
    this.canvas = createCanvas(1, 1);
    this.ctx = context2d(this.canvas);
    /** @type {string|null} Calque cible, null si inactif. */
    this.layerId = null;
    /** Mode de composition sur le calque cible : peinture ou effacement. */
    this.mode = 'source-over';
    this.opacity = 1;
    /** Zone touchée depuis le début du geste (coordonnées document). */
    this.dirty = { ...EMPTY_RECT };
    /** Zone modifiée depuis la dernière image affichée (voir takeFrame). */
    this.frame = { ...EMPTY_RECT };
  }

  get active() {
    return this.layerId !== null;
  }

  /** Adapte la taille au document (vide le contenu). */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.reset();
  }

  /**
   * Commence un geste sur un calque.
   * @param {string} layerId
   * @param {{erase?: boolean, opacity?: number}} [options]
   */
  begin(layerId, options = {}) {
    this.reset();
    this.layerId = layerId;
    this.mode = options.erase ? 'destination-out' : 'source-over';
    this.opacity = options.opacity ?? 1;
  }

  /**
   * Étend la zone touchée.
   * @param {{x: number, y: number, width: number, height: number}} rect
   */
  mark(rect) {
    this.dirty = unionRect(this.dirty, rect);
    this.frame = unionRect(this.frame, rect);
  }

  /**
   * Zone modifiée depuis le dernier appel, puis remise à zéro : l'affichage
   * ne recompose que cette partie du document pendant le geste.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  takeFrame() {
    const frame = this.frame;
    this.frame = { ...EMPTY_RECT };
    return frame;
  }

  /**
   * Efface le contenu sans terminer le geste (aperçu de forme redessiné).
   * Seule la zone touchée est effacée : rapide même sur un grand document.
   */
  clearContent() {
    const { x, y, width, height } = this.dirty;
    if (width > 0 && height > 0) {
      this.ctx.clearRect(x - 1, y - 1, width + 2, height + 2);
      this.frame = unionRect(this.frame, { x: x - 1, y: y - 1, width: width + 2, height: height + 2 });
    }
  }

  /** Termine le geste : contenu vidé, plus de calque cible. */
  reset() {
    this.clearContent();
    this.layerId = null;
    this.dirty = { ...EMPTY_RECT };
  }
}
