/**
 * Effets visuels du golf orbital : ciel étoilé en trois couches, grille de
 * champ déformée par la gravité, traînée de la balle, gerbe d'arrivée et
 * aperçu en pointillés. Aucun effet ne touche à la physique.
 *
 * L'aléa des décors vient d'un SeededRandom à graine fixe : le ciel est le
 * même à chaque visite, et les tests de rendu restent reproductibles.
 */
import { SeededRandom } from '../../lib/seeded-random.js';

const TAU = Math.PI * 2;
/** Étoiles par couche, de la plus lointaine à la plus proche, et décalage de parallaxe. */
const STAR_LAYERS = [[70, 0.004], [40, 0.01], [18, 0.02]];
const GRID_LINES = 24;
const TRAIL_LENGTH = 40;
const BURST_PARTICLES = 48;

/**
 * @returns {{x:number, y:number, size:number, alpha:number, depth:number}[][]} Trois couches
 *   d'étoiles en coordonnées relatives [0, 1].
 */
export function createStarfield() {
  const rng = new SeededRandom(2026);
  return STAR_LAYERS.map(([count, depth], layer) => Array.from({ length: count }, () => ({
    x: rng.random(), y: rng.random(), size: 0.5 + layer * 0.45 + rng.random() * 0.4,
    alpha: 0.35 + rng.random() * 0.5, depth,
  })));
}

/**
 * @param {CanvasRenderingContext2D} context - Contexte en px CSS.
 * @param {ReturnType<typeof createStarfield>} layers - Étoiles.
 * @param {number} side - Côté du canvas en px CSS.
 * @param {{x:number, y:number}} drift - Décalage de parallaxe (0 en mouvement réduit).
 */
export function drawStarfield(context, layers, side, drift) {
  context.fillStyle = '#ffffff';
  for (const layer of layers) {
    for (const star of layer) {
      const x = ((star.x - drift.x * star.depth) % 1 + 1) % 1 * side;
      const y = ((star.y - drift.y * star.depth) % 1 + 1) % 1 * side;
      context.globalAlpha = star.alpha;
      context.fillRect(x, y, star.size, star.size);
    }
  }
  context.globalAlpha = 1;
}

/**
 * Déplacement d'un nœud de grille vers les masses, saturé pour rester lisible.
 * @param {{x:number, y:number, mass:number}[]} masses - Corps fixes au départ du trou.
 * @param {number} x - Nœud x, en unités du monde.
 * @param {number} y - Nœud y.
 * @returns {number[]} Nœud déplacé [x, y].
 */
function warp(masses, x, y) {
  let ax = 0;
  let ay = 0;
  for (const body of masses) {
    const dx = body.x - x;
    const dy = body.y - y;
    const r2 = dx * dx + dy * dy + 900;
    const k = body.mass * 1e6 / (r2 * Math.sqrt(r2));
    ax += k * dx;
    ay += k * dy;
  }
  const strength = Math.hypot(ax, ay);
  const shift = strength === 0 ? 0 : 22 * strength / (strength + 120) / strength;
  return [x + ax * shift, y + ay * shift];
}

/**
 * Grille 24 × 24 déformée par l'accélération des corps fixes, calculée une fois par trou.
 * @param {{bounds:number[], bodies:object[]}} hole - Trou normalisé.
 * @returns {number[][][]} Polylignes en unités du monde.
 */
export function fieldGrid(hole) {
  const [xMin, yMin, xMax, yMax] = hole.bounds;
  const masses = hole.bodies.filter(body => !body.orbit);
  const at = index => index / GRID_LINES;
  const lines = [];
  for (let line = 0; line <= GRID_LINES; line++) {
    const rows = [];
    const columns = [];
    for (let point = 0; point <= GRID_LINES; point++) {
      rows.push(warp(masses, xMin + (xMax - xMin) * at(point), yMin + (yMax - yMin) * at(line)));
      columns.push(warp(masses, xMin + (xMax - xMin) * at(line), yMin + (yMax - yMin) * at(point)));
    }
    lines.push(rows, columns);
  }
  return lines;
}

/** Traînée de la balle : les 40 dernières positions, en unités du monde. */
export class Trail {
  constructor() {
    this.points = [];
  }

  /** @param {number} x - Position x. @param {number} y - Position y. */
  push(x, y) {
    this.points.push([x, y]);
    if (this.points.length > TRAIL_LENGTH) { this.points.shift(); }
  }

  clear() {
    this.points = [];
  }
}

/** Gerbe de particules quand la balle rentre ; inactive en mouvement réduit. */
export class Burst {
  constructor() {
    this.rng = new SeededRandom(42);
    this.particles = [];
  }

  /** @param {number} x - Centre du trou. @param {number} y - Centre du trou. */
  start(x, y) {
    this.particles = Array.from({ length: BURST_PARTICLES }, () => {
      const angle = this.rng.random() * TAU;
      const speed = 60 + this.rng.random() * 220;
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1 };
    });
  }

  /** @param {number} seconds - Temps d'animation écoulé. */
  update(seconds) {
    for (const particle of this.particles) {
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.life -= seconds * 1.2;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
  }

  /** @returns {boolean} Des particules restent à dessiner. */
  get alive() {
    return this.particles.length > 0;
  }
}

/**
 * Aperçu en pointillés : un point toutes les 0,05 s, opacité décroissante de 1 à 0.
 * @param {CanvasRenderingContext2D} context - Contexte.
 * @param {number[][]} points - Positions écran [x, y].
 * @param {string} color - Couleur des points.
 * @param {number} radius - Rayon d'un point en px CSS.
 */
export function drawDots(context, points, color, radius) {
  context.fillStyle = color;
  points.forEach(([x, y], index) => {
    context.globalAlpha = 1 - index / points.length;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  });
  context.globalAlpha = 1;
}
