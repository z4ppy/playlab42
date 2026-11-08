/**
 * Rendu Canvas 2D du golf orbital.
 *
 * Le canvas est carré ; sa taille CSS vient de la mise en page et sa
 * définition suit le devicePixelRatio (borné à 3) pour rester net. Le monde
 * affiché correspond aux limites du trou : une balle qui quitte l'écran est
 * hors limites. Les tailles visuelles de la balle et du trou ont un minimum
 * en px CSS (6 et 10) : la physique ne change pas, seule la lisibilité au
 * doigt en profite.
 */
import { bodyCenter } from './engine/level.js';
import { launchSpeed } from './engine/physics.js';
import { createStarfield, drawDots, drawStarfield, fieldGrid } from './renderer-effects.js';

const TAU = Math.PI * 2;
const MIN_BALL_PX = 6;
const MIN_HOLE_PX = 10;
const HOLE_RADIUS = 22;
const BALL_RADIUS = 8;
const HORIZON = 30;

/** Teintes des planètes : [centre éclairé, bord]. */
const PALETTES = new Map([
  ['ocre', ['#f3c27a', '#8a4a1c']],
  ['glace', ['#c9f0ff', '#3f7fa8']],
  ['lave', ['#ff9a6b', '#7a1f2b']],
  ['jade', ['#a8f0c6', '#22684a']],
  ['ambre', ['#ffd66b', '#9a5a12']],
]);
const DEFAULT_PALETTE = ['#d7dbe6', '#5b6378'];

/** Couleurs lues dans les variables CSS du thème, avec des valeurs de secours. */
const PALETTE_VARIABLES = {
  spaceTop: ['--golf-space-top', '#0b1226'],
  spaceBottom: ['--golf-space-bottom', '#050811'],
  grid: ['--golf-grid', 'rgba(140, 170, 255, 0.16)'],
  green: ['--golf-green', 'rgba(74, 222, 128, 0.22)'],
  aim: ['--golf-aim', '#ffd166'],
  ball: ['--golf-ball', '#ffffff'],
  hint: ['--golf-hint', '#7dd3fc'],
};

/**
 * @param {Window} host - Fenêtre.
 * @param {Element} element - Élément qui porte les variables.
 * @returns {Record<string, string>} Palette du thème courant.
 */
export function readPalette(host, element) {
  const style = host.getComputedStyle(element);
  const palette = {};
  for (const [name, [variable, fallback]] of Object.entries(PALETTE_VARIABLES)) {
    palette[name] = style.getPropertyValue(variable).trim() || fallback;
  }
  return palette;
}

/** Dessin d'une scène : la scène est entièrement décrite par l'objet passé à draw(). */
export class GolfRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas carré.
   * @param {Window} host - Fenêtre (devicePixelRatio, getComputedStyle).
   */
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.context = canvas.getContext('2d');
    this.stars = createStarfield();
    this.grid = [];
    this.gridHole = null;
    this.side = 0;
    this.ratio = 1;
    this.palette = readPalette(host, canvas);
  }

  /** Relit les couleurs après un changement de thème. */
  refreshPalette() {
    this.palette = readPalette(this.host, this.canvas);
  }

  /**
   * Ajuste la définition à la taille CSS et à la densité de l'écran.
   * @returns {boolean} La taille a changé.
   */
  resize() {
    const side = Math.max(1, Math.round(this.canvas.clientWidth));
    const ratio = Math.min(3, Math.max(1, this.host.devicePixelRatio || 1));
    const pixels = Math.round(side * ratio);
    if (side === this.side && this.canvas.width === pixels) { return false; }
    this.side = side;
    this.ratio = ratio;
    this.canvas.width = pixels;
    this.canvas.height = pixels;
    return true;
  }

  /**
   * @param {object} hole - Trou affiché.
   * @returns {{scale:number, x:(x:number) => number, y:(y:number) => number}} Projection monde → px CSS.
   */
  view(hole) {
    const [xMin, yMin, xMax, yMax] = hole.bounds;
    const scale = this.side / Math.max(xMax - xMin, yMax - yMin);
    return { scale, x: x => (x - xMin) * scale, y: y => (y - yMin) * scale };
  }

  /**
   * Convertit un point écran (px CSS relatifs au canvas) en unités du monde.
   * @param {object} hole - Trou affiché.
   * @param {number} px - Abscisse écran.
   * @param {number} py - Ordonnée écran.
   * @returns {{x:number, y:number}} Point du monde.
   */
  toWorld(hole, px, py) {
    const { scale } = this.view(hole);
    return { x: hole.bounds[0] + px / scale, y: hole.bounds[1] + py / scale };
  }

  /**
   * Dessine une image complète.
   * @param {SceneFrame} frame - Scène.
   */
  draw(frame) {
    const { context } = this;
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const view = this.view(frame.hole);
    this.drawSpace(frame);
    this.drawGrid(frame.hole, view);
    this.drawTarget(frame.hole, view);
    frame.hole.bodies.forEach(body => this.drawBody(body, frame.time, view));
    this.drawGuides(frame, view);
    this.drawBall(frame, view);
    this.drawBurst(frame.burst, view);
  }

  /** @param {SceneFrame} frame - Fond spatial et étoiles (parallaxe désactivée si mouvement réduit). */
  drawSpace(frame) {
    const { context, side, palette } = this;
    const gradient = context.createLinearGradient(0, 0, 0, side);
    gradient.addColorStop(0, palette.spaceTop);
    gradient.addColorStop(1, palette.spaceBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, side, side);
    drawStarfield(context, this.stars, side, frame.drift ?? { x: 0, y: 0 });
  }

  /** @param {object} hole - Trou. @param {object} view - Projection. */
  drawGrid(hole, view) {
    if (this.gridHole !== hole) {
      this.grid = fieldGrid(hole);
      this.gridHole = hole;
    }
    const { context } = this;
    context.strokeStyle = this.palette.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (const line of this.grid) {
      line.forEach(([x, y], index) => {
        if (index === 0) { context.moveTo(view.x(x), view.y(y)); } else { context.lineTo(view.x(x), view.y(y)); }
      });
    }
    context.stroke();
  }

  /** @param {object} hole - Green, trou et départ. @param {object} view - Projection. */
  drawTarget(hole, view) {
    const { context } = this;
    const cx = view.x(hole.hole.x);
    const cy = view.y(hole.hole.y);
    context.fillStyle = this.palette.green;
    context.beginPath();
    context.arc(cx, cy, hole.green * view.scale, 0, TAU);
    context.fill();
    const radius = Math.max(MIN_HOLE_PX, HOLE_RADIUS * view.scale);
    context.fillStyle = '#02040a';
    context.strokeStyle = '#e8fff0';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.fill();
    context.stroke();
    this.drawFlag(cx, cy, radius);
    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.setLineDash([3, 3]);
    context.strokeRect(view.x(hole.tee.x) - 6, view.y(hole.tee.y) - 6, 12, 12);
    context.setLineDash([]);
  }

  /** @param {number} cx - Trou x. @param {number} cy - Trou y. @param {number} radius - Rayon affiché. */
  drawFlag(cx, cy, radius) {
    const { context } = this;
    const top = cy - radius - 22;
    context.strokeStyle = '#e8fff0';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx, top);
    context.stroke();
    context.fillStyle = '#ff6b8b';
    context.beginPath();
    context.moveTo(cx, top);
    context.lineTo(cx + 13, top + 5);
    context.lineTo(cx, top + 10);
    context.fill();
  }

  /**
   * @param {object} body - Planète, lune ou trou noir.
   * @param {number} time - Horloge du trou (position des lunes).
   * @param {object} view - Projection.
   */
  drawBody(body, time, view) {
    const center = bodyCenter(body, time);
    const x = view.x(center.x);
    const y = view.y(center.y);
    if (body.kind === 'blackhole') {
      this.drawBlackHole(x, y, view.scale);
      return;
    }
    if (body.orbit) { this.drawOrbit(body.orbit, view); }
    const radius = body.radius * view.scale;
    const [light, dark] = PALETTES.get(body.palette) ?? DEFAULT_PALETTE;
    const gradient = this.context.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, dark);
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, TAU);
    this.context.fill();
  }

  /** @param {object} orbit - Orbite d'une lune. @param {object} view - Projection. */
  drawOrbit(orbit, view) {
    const { context } = this;
    context.strokeStyle = 'rgba(200, 220, 255, 0.25)';
    context.setLineDash([2, 6]);
    context.beginPath();
    context.arc(view.x(orbit.cx), view.y(orbit.cy), orbit.r * view.scale, 0, TAU);
    context.stroke();
    context.setLineDash([]);
  }

  /** @param {number} x - Centre écran. @param {number} y - Centre écran. @param {number} scale - Échelle. */
  drawBlackHole(x, y, scale) {
    const { context } = this;
    const horizon = Math.max(5, HORIZON * scale);
    const glow = context.createRadialGradient(x, y, horizon, x, y, horizon * 3.2);
    glow.addColorStop(0, 'rgba(255, 140, 60, 0.75)');
    glow.addColorStop(0.4, 'rgba(160, 60, 200, 0.3)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, horizon * 3.2, 0, TAU);
    context.fill();
    context.fillStyle = '#000000';
    context.beginPath();
    context.arc(x, y, horizon, 0, TAU);
    context.fill();
  }

  /** @param {SceneFrame} frame - Aperçu, impact prévu, flèche de visée et indice. @param {object} view - Projection. */
  drawGuides(frame, view) {
    const points = (frame.preview ?? []).map(([x, y]) => [view.x(x), view.y(y)]);
    drawDots(this.context, points, this.palette.aim, 2.2);
    if (frame.impact) { this.drawImpact(view.x(frame.impact.x), view.y(frame.impact.y)); }
    if (frame.hint) { this.drawArrow(frame.ball, frame.hint, this.palette.hint, view); }
    if (frame.aim) { this.drawArrow(frame.ball, frame.aim, this.palette.aim, view); }
  }

  /** @param {number} x - Impact écran. @param {number} y - Impact écran. */
  drawImpact(x, y) {
    const { context } = this;
    context.strokeStyle = this.palette.aim;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x - 5, y - 5);
    context.lineTo(x + 5, y + 5);
    context.moveTo(x + 5, y - 5);
    context.lineTo(x - 5, y + 5);
    context.stroke();
  }

  /**
   * Flèche de visée : direction du tir et longueur proportionnelle à la vitesse.
   * @param {{x:number, y:number}} ball - Balle.
   * @param {{angle:number, power:number}} aim - Visée.
   * @param {string} color - Couleur.
   * @param {object} view - Projection.
   */
  drawArrow(ball, aim, color, view) {
    const { context } = this;
    const radians = aim.angle * Math.PI / 1800;
    const length = 18 + launchSpeed(aim.power) / 600 * Math.max(60, this.side * 0.22);
    const x = view.x(ball.x);
    const y = view.y(ball.y);
    const tipX = x + Math.cos(radians) * length;
    const tipY = y + Math.sin(radians) * length;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(tipX, tipY);
    context.stroke();
    context.beginPath();
    context.arc(tipX, tipY, 4, 0, TAU);
    context.fill();
  }

  /** @param {SceneFrame} frame - Traînée puis balle avec halo. @param {object} view - Projection. */
  drawBall(frame, view) {
    const { context } = this;
    const trail = frame.trail ?? [];
    trail.forEach(([x, y], index) => {
      context.fillStyle = `rgba(255, 255, 255, ${(0.5 * (index + 1)) / trail.length})`;
      context.fillRect(view.x(x) - 1.5, view.y(y) - 1.5, 3, 3);
    });
    if (!frame.ball) { return; }
    const x = view.x(frame.ball.x);
    const y = view.y(frame.ball.y);
    const radius = Math.max(MIN_BALL_PX, BALL_RADIUS * view.scale);
    context.fillStyle = 'rgba(255, 255, 255, 0.18)';
    context.beginPath();
    context.arc(x, y, radius * 2.2, 0, TAU);
    context.fill();
    context.fillStyle = this.palette.ball;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  /** @param {import('./renderer-effects.js').Burst|undefined} burst - Gerbe. @param {object} view - Projection. */
  drawBurst(burst, view) {
    if (!burst?.alive) { return; }
    for (const particle of burst.particles) {
      this.context.fillStyle = `rgba(255, 214, 102, ${particle.life})`;
      this.context.fillRect(view.x(particle.x) - 1.5, view.y(particle.y) - 1.5, 3, 3);
    }
  }
}

/**
 * @typedef {Object} SceneFrame
 * @property {object} hole - Trou normalisé.
 * @property {number} time - Horloge du trou.
 * @property {{x:number, y:number}|null} ball - Balle affichée.
 * @property {{angle:number, power:number}|null} [aim] - Visée affichée.
 * @property {{angle:number, power:number}|null} [hint] - Tir de référence montré en indice.
 * @property {number[][]} [preview] - Aperçu de trajectoire (unités du monde).
 * @property {{x:number, y:number}|null} [impact] - Premier contact prévu.
 * @property {number[][]} [trail] - Traînée (unités du monde).
 * @property {import('./renderer-effects.js').Burst} [burst] - Gerbe d'arrivée.
 * @property {{x:number, y:number}} [drift] - Parallaxe des étoiles.
 */
