import { getCells, getGhostPiece, PIECES } from './engine.js';

/** Couleurs originales, indépendantes des illustrations du jeu historique. */
export const COLORS = {
  I: '#67e8f9', O: '#d4fa72', T: '#bc9aff', S: '#56dfad',
  Z: '#ff758f', J: '#729cff', L: '#ffbb70',
};

/**
 * Formate une durée en minutes, secondes et centièmes.
 * @param {number} milliseconds - Durée simulée.
 * @returns {string} Chronomètre lisible.
 */
export function formatTime(milliseconds) {
  const centiseconds = Math.floor(Math.max(0, milliseconds) / 10);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

/**
 * Localise les événements du moteur sans modifier les états de replay.
 * @param {string} label - Événement canonique.
 * @returns {string} Libellé français.
 */
export function formatClearLabel(label) {
  const labels = { None: 'Aucune ligne', Single: 'Ligne simple', Double: 'Double', Triple: 'Triple', Tetris: 'Quatre lignes' };
  return labels[label] || label.replace('Single', 'simple').replace('Double', 'double').replace('Triple', 'triple');
}

/**
 * Dessine une cellule biseautée, ou sa projection en contour.
 * @param {CanvasRenderingContext2D} context - Contexte de dessin.
 * @param {number} x - Abscisse en pixels.
 * @param {number} y - Ordonnée en pixels.
 * @param {number} size - Taille d'une case.
 * @param {string} type - Type de tetromino.
 * @param {boolean} ghost - Projection de chute.
 */
function drawBlock(context, x, y, size, type, ghost = false) {
  const gap = Math.max(1.5, size * .07);
  const side = size - gap * 2;
  const color = COLORS[type];
  context.save();
  if (ghost) {
    context.globalAlpha = .6;
    context.strokeStyle = color;
    context.lineWidth = 1.4;
    context.strokeRect(x + gap, y + gap, side, side);
    context.globalAlpha = .1;
    context.fillStyle = color;
    context.fillRect(x + gap, y + gap, side, side);
  } else {
    context.fillStyle = color;
    context.fillRect(x + gap, y + gap, side, side);
    context.fillStyle = '#ffffff65';
    context.fillRect(x + gap, y + gap, side, Math.max(2, size * .09));
    context.fillStyle = '#00000035';
    context.fillRect(x + gap, y + gap + side - 3, side, 3);
    context.fillStyle = '#ffffff18';
    context.fillRect(x + gap + 4, y + gap + 5, side - 8, side - 11);
  }
  context.restore();
}

/**
 * Ajuste le bitmap à la densité réelle sans changer les dimensions CSS.
 * @param {HTMLCanvasElement} canvas - Surface de dessin.
 * @param {number} width - Largeur logique.
 * @param {number} height - Hauteur logique.
 * @returns {CanvasRenderingContext2D} Contexte haute résolution.
 */
function prepare(canvas, width, height) {
  const ratio = Math.min(canvas.ownerDocument.defaultView.devicePixelRatio || 1, 3);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D indisponible : ce navigateur ne peut pas afficher le jeu.');
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

/**
 * Dessine un aperçu centré à partir des seules cases occupées.
 * @param {CanvasRenderingContext2D} context - Contexte.
 * @param {string} type - Pièce à dessiner.
 * @param {number} top - Position verticale.
 * @param {number} height - Hauteur de la zone.
 */
function preview(context, type, top, height) {
  if (!type) { return; }
  const cells = [];
  PIECES[type].forEach((row, y) => row.forEach((value, x) => {
    if (value) { cells.push({ x, y }); }
  }));
  const minX = Math.min(...cells.map(cell => cell.x));
  const maxX = Math.max(...cells.map(cell => cell.x));
  const minY = Math.min(...cells.map(cell => cell.y));
  const maxY = Math.max(...cells.map(cell => cell.y));
  const size = 22;
  const left = (160 - (maxX - minX + 1) * size) / 2;
  const offsetY = top + (height - (maxY - minY + 1) * size) / 2;
  for (const cell of cells) {
    drawBlock(context, left + (cell.x - minX) * size, offsetY + (cell.y - minY) * size, size, type);
  }
}

/**
 * @param {CanvasRenderingContext2D} context - Contexte du terrain.
 * @param {object} state - État fourni par le moteur.
 */
function drawField(context, state) {
  context.fillStyle = '#0a1220';
  context.fillRect(0, 0, 300, 600);
  drawGrid(context);
  state.board.forEach((row, y) => row.forEach((type, x) => {
    if (type) { drawBlock(context, x * 30, y * 30, 30, type); }
  }));
  if (state.active && !state.gameOver) { drawActive(context, state); }
}

/** @param {CanvasRenderingContext2D} context - Contexte du terrain. */
function drawGrid(context) {
  context.strokeStyle = '#1c2a3c';
  context.lineWidth = .6;
  for (let x = 0; x <= 10; x++) {
    context.beginPath();
    context.moveTo(x * 30, 0);
    context.lineTo(x * 30, 600);
    context.stroke();
  }
  for (let y = 0; y <= 20; y++) {
    context.beginPath();
    context.moveTo(0, y * 30);
    context.lineTo(300, y * 30);
    context.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} context - Contexte du terrain.
 * @param {object} state - État avec pièce active.
 */
function drawActive(context, state) {
  for (const cell of getCells(getGhostPiece(state))) {
    if (cell.y >= 0) { drawBlock(context, cell.x * 30, cell.y * 30, 30, state.active.type, true); }
  }
  for (const cell of getCells(state.active)) {
    if (cell.y >= 0) { drawBlock(context, cell.x * 30, cell.y * 30, 30, state.active.type); }
  }
}

/** Rendu sans effets de bord sur l'état du moteur. */
export class TetrisRenderer {
  /**
   * @param {{board: HTMLCanvasElement, hold: HTMLCanvasElement, next: HTMLCanvasElement}} canvases - Surfaces UI.
   */
  constructor(canvases) {
    this.canvases = canvases;
  }

  /**
   * Dessine le terrain et les aperçus.
   * @param {object} state - État fourni par le moteur.
   */
  draw(state) {
    const { board, hold, next } = this.canvases;
    const context = prepare(board, 300, 600);
    drawField(context, state);
    const holdContext = prepare(hold, 160, 88);
    holdContext.globalAlpha = state.canHold ? 1 : .4;
    preview(holdContext, state.hold, 0, 88);
    holdContext.globalAlpha = 1;
    const nextContext = prepare(next, 160, 300);
    state.queue.slice(0, 5).forEach((type, index) => preview(nextContext, type, index * 60, 60));
    hold.setAttribute('aria-label', state.hold ? `Pièce en réserve : ${state.hold}` : 'Réserve vide');
    next.setAttribute('aria-label', `Prochaines pièces : ${state.queue.slice(0, 5).join(', ')}`);
  }
}
