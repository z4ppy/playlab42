/**
 * Rendu canvas 2D des segments (dépend du DOM).
 *
 * Trois modes de dessin :
 * - rendu complet : un Path2D par style, tracé dans le repère du monde
 *   (chemins construits une fois, réutilisés à chaque zoom ou déplacement) ;
 * - aperçu : pendant un geste sur un gros dessin, on déforme la dernière image
 *   (instantané) au lieu de tout retracer, puis on retrace à la fin du geste ;
 * - tranche : pour l'animation de croissance, on ajoute seulement les
 *   segments nouveaux sans effacer.
 */

import { snapshotTransform } from './view.js';

/**
 * Épaisseur à l'écran : définie pour le cadrage automatique puis légèrement
 * accentuée au zoom (racine carrée), pour que les branches restent lisibles
 * sans devenir énormes.
 * @param {number} width - Épaisseur du style (px CSS au cadrage)
 * @param {number} pixelRatio - Densité de pixels
 * @param {number} zoomRatio - Échelle courante / échelle de cadrage
 * @returns {number} Épaisseur en pixels physiques
 */
export function screenLineWidth(width, pixelRatio, zoomRatio) {
  return width * pixelRatio * Math.min(8, Math.max(0.5, Math.sqrt(zoomRatio)));
}

/**
 * Construit un Path2D par style ; les segments contigus forment des polylignes.
 * @param {import('./turtle.js').Drawing} drawing - Dessin
 * @param {import('./style.js').StyleIndex} styleIndex - Styles
 * @returns {Path2D[]}
 */
export function buildPaths(drawing, styleIndex) {
  const paths = styleIndex.styles.map(() => new Path2D());
  const lastX = new Float64Array(paths.length).fill(NaN);
  const lastY = new Float64Array(paths.length).fill(NaN);
  const s = drawing.segments;
  for (let i = 0; i < drawing.count; i++) {
    const k = styleIndex.keys[i];
    const o = i * 4;
    if (s[o] !== lastX[k] || s[o + 1] !== lastY[k]) {
      paths[k].moveTo(s[o], s[o + 1]);
    }
    paths[k].lineTo(s[o + 2], s[o + 3]);
    lastX[k] = s[o + 2];
    lastY[k] = s[o + 3];
  }
  return paths;
}

/**
 * Trace un dessin complet sur un contexte (écran ou export PNG).
 * @param {CanvasRenderingContext2D} ctx - Contexte
 * @param {Path2D[]} paths - Chemins par style
 * @param {import('./style.js').StyleIndex} styleIndex - Styles
 * @param {import('./view.js').View} view - Vue
 * @param {{ pixelRatio: number, zoomRatio: number }} scaleInfo - Échelles
 */
export function strokePaths(ctx, paths, styleIndex, view, scaleInfo) {
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, -view.scale, view.tx, view.ty);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paths.forEach((path, k) => {
    const style = styleIndex.styles[k];
    ctx.strokeStyle = style.color;
    ctx.lineWidth = screenLineWidth(style.width, scaleInfo.pixelRatio, scaleInfo.zoomRatio) / view.scale;
    ctx.stroke(path);
  });
  ctx.restore();
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas d'affichage
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.snapshot = document.createElement('canvas');
    this.snapshotView = null;
    this.drawing = null;
    this.styleIndex = null;
    this.paths = null;
    /** Durée du dernier rendu complet (ms) : décide du mode aperçu. */
    this.lastFullMs = 0;
  }

  /**
   * @param {import('./turtle.js').Drawing|null} drawing - Dessin
   * @param {import('./style.js').StyleIndex|null} styleIndex - Styles
   */
  setDrawing(drawing, styleIndex) {
    this.drawing = drawing;
    this.styleIndex = styleIndex;
    this.paths = null;
    this.snapshotView = null;
  }

  getPaths() {
    if (!this.paths && this.drawing && this.styleIndex) {
      this.paths = buildPaths(this.drawing, this.styleIndex);
    }
    return this.paths;
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Rendu complet, puis mémorisation d'un instantané pour les aperçus.
   * @param {import('./view.js').View} view - Vue
   * @param {{ pixelRatio: number, zoomRatio: number }} scaleInfo - Échelles
   */
  renderFull(view, scaleInfo) {
    const started = performance.now();
    this.clear();
    const paths = this.getPaths();
    if (!paths) {
      return;
    }
    strokePaths(this.ctx, paths, this.styleIndex, view, scaleInfo);
    this.lastFullMs = performance.now() - started;
    this.takeSnapshot(view);
  }

  takeSnapshot(view) {
    if (this.snapshot.width !== this.canvas.width || this.snapshot.height !== this.canvas.height) {
      this.snapshot.width = this.canvas.width;
      this.snapshot.height = this.canvas.height;
    }
    const snapCtx = this.snapshot.getContext('2d');
    snapCtx.clearRect(0, 0, this.snapshot.width, this.snapshot.height);
    snapCtx.drawImage(this.canvas, 0, 0);
    this.snapshotView = { ...view };
  }

  /**
   * Aperçu instantané : déforme la dernière image rendue.
   * @param {import('./view.js').View} view - Vue cible
   * @returns {boolean} false si aucun instantané n'est disponible
   */
  renderPreview(view) {
    if (!this.snapshotView) {
      return false;
    }
    this.clear();
    this.ctx.setTransform(...snapshotTransform(this.snapshotView, view));
    this.ctx.drawImage(this.snapshot, 0, 0);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return true;
  }

  /**
   * Ajoute les segments [from, to) sans effacer (animation de croissance).
   * @param {import('./view.js').View} view - Vue
   * @param {{ pixelRatio: number, zoomRatio: number }} scaleInfo - Échelles
   * @param {number} from - Premier segment
   * @param {number} to - Segment de fin (exclu)
   */
  renderRange(view, scaleInfo, from, to) {
    const { ctx, drawing, styleIndex } = this;
    if (!drawing || from < 0 || to <= from || to > drawing.count) {
      return;
    }
    ctx.save();
    ctx.setTransform(view.scale, 0, 0, -view.scale, view.tx, view.ty);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = drawing.segments;
    const strokeRun = (k) => {
      if (k < 0) {
        return;
      }
      const style = styleIndex.styles[k];
      ctx.strokeStyle = style.color;
      ctx.lineWidth = screenLineWidth(style.width, scaleInfo.pixelRatio, scaleInfo.zoomRatio) / view.scale;
      ctx.stroke();
    };
    let current = -1;
    for (let i = from; i < to; i++) {
      const k = styleIndex.keys[i];
      if (k !== current) {
        strokeRun(current);
        current = k;
        ctx.beginPath();
      }
      ctx.moveTo(s[i * 4], s[i * 4 + 1]);
      ctx.lineTo(s[i * 4 + 2], s[i * 4 + 3]);
    }
    strokeRun(current);
    ctx.restore();
  }
}
