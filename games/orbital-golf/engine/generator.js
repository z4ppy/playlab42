/**
 * Génération procédurale pure : graines dérivées, tirage de la scène et validation par le solveur.
 *
 * Chaque trou a sa propre graine `fnv1a32(graine + ':' + indice)` : il peut être
 * généré à la demande (au début de la partie puis à chaque trou suivant) sans
 * dépendre des tentatives rejetées des trous précédents. Toutes les positions
 * tirées sont entières, ce qui limite les écarts de calcul entre moteurs.
 */
import { SeededRandom } from '../../../lib/seeded-random.js';
import { DEFAULT_GREEN, HORIZON_RADIUS, normalizeHole } from './level.js';
import { INITIATION } from './levels.js';
import { solve } from './solver.js';

/** Tentatives de scène résolue avant le recours à un trou d'initiation. */
export const MAX_ATTEMPTS = 12;
const LAYOUT_TRIES = 40;
const PALETTES = ['ocre', 'glace', 'lave', 'jade', 'ambre'];
const GAP = 60;

/**
 * Hachage FNV-1a 32 bits, pur et identique sur tous les moteurs.
 * @param {string} text - Texte à hacher.
 * @returns {number} Entier non signé 32 bits.
 */
export function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Le moteur ne lit jamais l'horloge : le client fournit la date locale.
 * @param {string} date - Date « AAAA-MM-JJ ».
 * @returns {number} Graine du trou du jour.
 */
export function dailySeed(date) {
  return fnv1a32(`orbital-golf:${date}`);
}

/**
 * @param {number} seed - Graine du parcours.
 * @param {number} index - Indice du trou.
 * @returns {number} Graine propre au trou.
 */
export function holeSeed(seed, index) {
  return fnv1a32(`${seed >>> 0}:${index}`);
}

/**
 * Départ et trou sur deux bords opposés, à plus de 550 u l'un de l'autre.
 * @param {SeededRandom} rng - Générateur.
 * @returns {{tee:number[], hole:{x:number,y:number}}} Extrémités du trou.
 */
function drawEnds(rng) {
  const side = rng.int(0, 3);
  const tee = [rng.int(110, 170), rng.int(150, 850)];
  const hole = [rng.int(830, 890), rng.int(150, 850)];
  const swap = side >= 2;
  const mirror = side % 2 === 1;
  const place = ([u, v]) => {
    const along = mirror ? 1000 - u : u;
    return swap ? [v, along] : [along, v];
  };
  const [hx, hy] = place(hole);
  return { tee: place(tee), hole: { x: hx, y: hy } };
}

/**
 * Masse bornée pour que la gravité de surface (μ/R²) reste sous 3 000 u/s².
 * @param {SeededRandom} rng - Générateur.
 * @param {number} radius - Rayon de la planète.
 * @returns {number} Masse au dixième.
 */
function drawMass(rng, radius) {
  const ceiling = Math.min(8, 0.003 * radius * radius);
  return Math.max(1, Math.round(Math.min(ceiling, rng.int(10, 80) / 10) * 10) / 10);
}

/**
 * Première planète posée près du segment départ–trou, pour qu'il faille courber.
 * @param {SeededRandom} rng - Générateur.
 * @param {{tee:number[], hole:{x:number,y:number}}} ends - Extrémités.
 * @returns {object} Planète bloquante.
 */
function drawBlocker(rng, ends) {
  const share = rng.int(40, 60) / 100;
  const dx = ends.hole.x - ends.tee[0];
  const dy = ends.hole.y - ends.tee[1];
  const length = Math.hypot(dx, dy);
  const offset = rng.int(-60, 60);
  const radius = rng.int(50, 100);
  return {
    kind: 'planet', radius, mass: drawMass(rng, radius), palette: rng.pick(PALETTES),
    x: Math.round(ends.tee[0] + dx * share - dy / length * offset),
    y: Math.round(ends.tee[1] + dy * share + dx / length * offset),
  };
}

/**
 * @param {SeededRandom} rng - Générateur.
 * @returns {object} Planète libre dans le monde.
 */
function drawPlanet(rng) {
  const radius = rng.int(30, 90);
  return { kind: 'planet', x: rng.int(150, 850), y: rng.int(150, 850), radius, mass: drawMass(rng, radius), palette: rng.pick(PALETTES) };
}

/**
 * Lune en orbite autour de la planète bloquante.
 * @param {SeededRandom} rng - Générateur.
 * @param {object} host - Planète centrale.
 * @returns {object} Lune.
 */
function drawMoon(rng, host) {
  return {
    kind: 'moon', radius: rng.int(14, 24), mass: rng.int(3, 8) / 10, palette: rng.pick(PALETTES),
    orbit: { cx: host.x, cy: host.y, r: host.radius + rng.int(50, 90), period: rng.int(4, 8), phase: rng.int(0, 359) },
  };
}

/**
 * Tire les corps selon la difficulté : 1 à 3 planètes, trou noir et lune possibles.
 * @param {SeededRandom} rng - Générateur.
 * @param {object} ends - Extrémités.
 * @param {number} difficulty - Difficulté dans [0, 1].
 * @returns {object[]} Corps bruts.
 */
function drawBodies(rng, ends, difficulty) {
  const bodies = [drawBlocker(rng, ends)];
  for (let count = Math.round(2 * difficulty); count > 0; count--) { bodies.push(drawPlanet(rng)); }
  if (difficulty > 0.5 && rng.chance(0.5)) {
    bodies.push({ kind: 'blackhole', x: rng.int(150, 850), y: rng.int(150, 850), mass: rng.int(80, 110) / 10 });
  }
  if (difficulty > 0.6 && rng.chance(0.4)) { bodies.push(drawMoon(rng, bodies[0])); }
  return bodies;
}

/** @param {object} body - Corps. @returns {number} Rayon d'encombrement (horizon pour un trou noir). */
const extent = body => body.kind === 'blackhole' ? HORIZON_RADIUS : body.radius;

/**
 * @param {object} body - Corps fixe.
 * @param {number} x - Point x.
 * @param {number} y - Point y.
 * @param {number} margin - Dégagement exigé autour de la surface.
 * @returns {boolean} Point dégagé.
 */
const clearOf = (body, x, y, margin) => Math.hypot(body.x - x, body.y - y) >= extent(body) + margin;

/**
 * L'anneau balayé par une lune doit éviter départ, green et autres corps.
 * @param {object} moon - Lune.
 * @param {object[]} fixed - Corps fixes.
 * @param {object} ends - Extrémités.
 * @returns {boolean} Couloir d'orbite dégagé.
 */
function orbitIsClear(moon, fixed, ends) {
  const { cx, cy, r } = moon.orbit;
  const ring = (x, y, margin) => Math.abs(Math.hypot(x - cx, y - cy) - r) >= moon.radius + margin;
  const others = fixed.filter(body => body.x !== cx || body.y !== cy);
  return ring(ends.tee[0], ends.tee[1], GAP) && ring(ends.hole.x, ends.hole.y, DEFAULT_GREEN + 20)
    && others.every(body => ring(body.x, body.y, extent(body) + 20));
}

/**
 * Écarts minimaux : 60 u entre surfaces, départ et green dégagés.
 * @param {object[]} bodies - Corps tirés.
 * @param {object} ends - Extrémités.
 * @returns {boolean} Scène acceptable.
 */
export function layoutIsClear(bodies, ends) {
  const fixed = bodies.filter(body => !body.orbit);
  const apart = fixed.every((body, index) => fixed.slice(index + 1)
    .every(other => clearOf(other, body.x, body.y, extent(body) + GAP)));
  const endsClear = fixed.every(body => clearOf(body, ends.tee[0], ends.tee[1], GAP)
    && clearOf(body, ends.hole.x, ends.hole.y, DEFAULT_GREEN + 10));
  const moons = bodies.filter(body => body.orbit).every(moon => orbitIsClear(moon, fixed, ends));
  return apart && endsClear && moons;
}

/**
 * @param {SeededRandom} rng - Générateur.
 * @param {number} difficulty - Difficulté.
 * @returns {{tee:number[], hole:object, bodies:object[]}|null} Scène dégagée ou null.
 */
function drawLayout(rng, difficulty) {
  for (let attempt = 0; attempt < LAYOUT_TRIES; attempt++) {
    const ends = drawEnds(rng);
    const bodies = drawBodies(rng, ends, difficulty);
    if (layoutIsClear(bodies, ends)) { return { ...ends, bodies }; }
  }
  return null;
}

/**
 * Génère un trou résolu ; après 12 échecs, reprend un trou d'initiation.
 * @param {number} seed - Graine propre au trou (voir holeSeed).
 * @param {{id:string, name:string, difficulty:number}} options - Identité et difficulté.
 * @returns {object} Trou normalisé avec par et tir de référence.
 */
export function generateHole(seed, { id, name, difficulty }) {
  const rng = new SeededRandom(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const layout = drawLayout(rng, difficulty);
    const hole = layout && normalizeHole({ id, name, par: 3, previewSeconds: 1.2, ...layout });
    const solution = hole && solve(hole, difficulty);
    if (solution) { return { ...hole, par: solution.par, reference: solution.reference }; }
  }
  const fallback = normalizeHole(rng.pick(INITIATION.slice(1)));
  return { ...fallback, id, name, fallback: true };
}
