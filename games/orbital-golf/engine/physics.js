/**
 * Physique du golf orbital : intégration de Verlet vitesse à pas fixe.
 *
 * Un coup est simulé d'un bloc, jusqu'à l'un des résultats suivants :
 * - `holed` : centre de la balle à 22 u ou moins du trou, vitesse < 150 u/s
 *   (le green amortit l'approche : une capture plus permissive ferait rentrer
 *   les balles qui le traversent) ;
 * - `rest` : balle immobilisée sur une planète ou sur le green ;
 * - `out` : centre de la balle hors des limites du trou ;
 * - `swallowed` : balle passée sous l'horizon (30 u) d'un trou noir ;
 * - `lost` : vol plus long que la durée maximale sans être retenue.
 * L'aperçu ajoute `contact` (premier choc) et `horizon` (durée d'aperçu atteinte).
 *
 * Ordre d'un pas : position de Verlet, accélération à t + dt (corps mobiles
 * compris), vitesse, sortie de pénétration et réflexion, frottements, bornage
 * de vitesse, puis tests trou noir > trou > limites > arrêt. Cet ordre fixe la
 * priorité de deux événements survenant dans le même pas.
 *
 * Aucune horloge ni aléa : la même entrée donne exactement le même vol sur un
 * même moteur JavaScript. La boucle chaude n'alloue aucun objet.
 */
import { BALL_RADIUS, HORIZON_RADIUS, placeBodies } from './level.js';

// Fonctions lues une seule fois : dans un contexte `vm` (Jest), chaque lecture
// de `Math` sur l'objet global passe par un intercepteur et rend la boucle
// chaude des dizaines de fois plus lente. Le navigateur n'y perd rien.
const { sqrt, cos, sin } = Math;

/** Pas de temps fixe, en secondes. */
export const DT = 1 / 240;
/** Durée maximale d'un vol, en secondes (2 400 pas). */
export const MAX_FLIGHT_SECONDS = 10;
/** Vitesse bornée : 6,25 u par pas, moins que la somme des rayons balle + plus petit corps. */
export const MAX_SPEED = 1500;
export const CAPTURE_RADIUS = 22;
export const CAPTURE_SPEED = 150;
export const REST_SPEED = 6;
export const REST_STEPS = 60;

const GRAVITY_SCALE = 1e6;
const BODY_SOFTENING = 10;
const HOLE_SOFTENING_BLACK = 12;
const HOLE_MU = 2e5;
const HOLE_SOFTENING = 30;
const RESTITUTION = 0.6;
const MOON_RESTITUTION = 0.8;
const TANGENT_KEEP = 0.9;
const CONTACT_SPEED = 30;
const ROLL_FRICTION = 150;
const GREEN_FRICTION = 150;
const GREEN_DAMPING = 2.5;

/**
 * Vitesse de lancement : relation non linéaire pour donner de la finesse aux putts.
 * @param {number} power - Puissance entière de 1 à 100.
 * @returns {number} Vitesse en u/s, de 40,6 à 600.
 */
export function launchSpeed(power) {
  return 40 + 560 * Math.pow(power / 100, 1.5);
}

/**
 * @param {number} angle - Angle en dixièmes de degré (0 = est, sens horaire, y vers le bas).
 * @returns {number} Angle en radians.
 */
export function angleToRadians(angle) {
  return angle * Math.PI / 1800;
}

/**
 * Prépare les constantes par corps une seule fois par vol.
 * @param {object} hole - Trou normalisé.
 * @param {{x:number,y:number}} from - Position de départ.
 * @param {number} t0 - Horloge du trou au lancement.
 * @param {number} maxSeconds - Durée maximale simulée.
 * @returns {object} Vol mutable privé.
 */
function createFlight(hole, from, t0, maxSeconds) {
  const count = hole.bodies.length;
  const flight = {
    hole, bodies: hole.bodies, count, buffer: new Float64Array(count * 4),
    mu: new Float64Array(count), soft2: new Float64Array(count), reach: new Float64Array(count),
    contactSpeed: new Float64Array(count), horizon2: new Float64Array(count),
    moving: hole.bodies.some(body => body.orbit),
    x: from.x, y: from.y, vx: 0, vy: 0, ax: 0, ay: 0, nax: 0, nay: 0, t: t0, t0,
    steps: 0, maxSteps: Math.round(maxSeconds / DT), contact: -1, collided: false,
    airborne: false, restSteps: 0, holeDistance: Infinity, closest: Infinity, inGreen: false,
  };
  hole.bodies.forEach((body, index) => describeBody(flight, body, index));
  placeBodies(flight.bodies, t0, flight.buffer);
  return flight;
}

/**
 * @param {object} flight - Vol en préparation.
 * @param {object} body - Corps normalisé.
 * @param {number} index - Indice du corps.
 */
function describeBody(flight, body, index) {
  const mu = body.mass * GRAVITY_SCALE;
  flight.mu[index] = mu;
  if (body.kind === 'blackhole') {
    flight.soft2[index] = HOLE_SOFTENING_BLACK ** 2;
    flight.horizon2[index] = HORIZON_RADIUS ** 2;
    return;
  }
  const reach = body.radius + BALL_RADIUS;
  flight.soft2[index] = BODY_SOFTENING ** 2;
  flight.reach[index] = reach;
  // Seuil de contact relatif : au-delà de 2·g·dt, la gravité de surface
  // relancerait la balle à chaque pas et la ferait vibrer sans fin.
  flight.contactSpeed[index] = body.orbit ? 0 : Math.max(CONTACT_SPEED, 2 * mu / (reach * reach) * DT);
}

/** @param {object} flight - Vol : écrit l'accélération à la position courante dans nax/nay. */
function accelerate(flight) {
  const { buffer, mu, soft2 } = flight;
  let ax = 0;
  let ay = 0;
  for (let index = 0; index < flight.count; index++) {
    const dx = buffer[index * 4] - flight.x;
    const dy = buffer[index * 4 + 1] - flight.y;
    const r2 = dx * dx + dy * dy + soft2[index];
    const k = mu[index] / (r2 * sqrt(r2));
    ax += k * dx;
    ay += k * dy;
  }
  // Effet d'entonnoir doux du trou, très adouci pour ne pas créer d'orbite.
  const hx = flight.hole.hole.x - flight.x;
  const hy = flight.hole.hole.y - flight.y;
  const h2 = hx * hx + hy * hy + HOLE_SOFTENING * HOLE_SOFTENING;
  const funnel = HOLE_MU / (h2 * sqrt(h2));
  flight.nax = ax + funnel * hx;
  flight.nay = ay + funnel * hy;
}

/**
 * Réflexion sur la vitesse relative au corps (les lunes bougent).
 * Une planète fixe retient la balle lente (contact) ; une lune la renvoie toujours.
 * @param {object} flight - Vol.
 * @param {number} index - Corps touché.
 * @param {number} nx - Normale sortante x.
 * @param {number} ny - Normale sortante y.
 */
function bounce(flight, index, nx, ny) {
  const offset = index * 4;
  const bodyVx = flight.buffer[offset + 2];
  const bodyVy = flight.buffer[offset + 3];
  const rvx = flight.vx - bodyVx;
  const rvy = flight.vy - bodyVy;
  const vn = rvx * nx + rvy * ny;
  const holding = flight.contactSpeed[index] > 0;
  if (holding && vn > -flight.contactSpeed[index]) {
    flight.contact = index;
    if (vn >= 0) { return; }
    flight.vx = rvx - vn * nx;
    flight.vy = rvy - vn * ny;
    return;
  }
  if (vn >= 0) { return; }
  const tx = rvx - vn * nx;
  const ty = rvy - vn * ny;
  const restitution = holding ? RESTITUTION : MOON_RESTITUTION;
  flight.vx = bodyVx + TANGENT_KEEP * tx - restitution * vn * nx;
  flight.vy = bodyVy + TANGENT_KEEP * ty - restitution * vn * ny;
  flight.collided = true;
}

/**
 * Sort la balle d'un corps qu'elle pénètre puis applique le rebond.
 * @param {object} flight - Vol.
 * @param {number} index - Corps testé.
 * @returns {boolean} Vrai si la position a été corrigée.
 */
function resolveContact(flight, index) {
  const offset = index * 4;
  const dx = flight.x - flight.buffer[offset];
  const dy = flight.y - flight.buffer[offset + 1];
  const reach = flight.reach[index];
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) { return false; }
  const distance = sqrt(d2);
  const nx = distance > 0 ? dx / distance : 1;
  const ny = distance > 0 ? dy / distance : 0;
  flight.x = flight.buffer[offset] + nx * reach;
  flight.y = flight.buffer[offset + 1] + ny * reach;
  bounce(flight, index, nx, ny);
  return true;
}

/** @param {object} flight - Vol. @returns {boolean} Vrai si au moins un corps a été touché. */
function collide(flight) {
  flight.contact = -1;
  flight.collided = false;
  let moved = false;
  for (let index = 0; index < flight.count; index++) {
    if (flight.reach[index] > 0 && resolveContact(flight, index)) { moved = true; }
  }
  return moved;
}

/**
 * Retire `amount` à la norme de la vitesse sans jamais l'inverser.
 * @param {object} flight - Vol.
 * @param {number} amount - Diminution en u/s.
 */
function slowDown(flight, amount) {
  const speed = sqrt(flight.vx * flight.vx + flight.vy * flight.vy);
  if (speed <= amount) {
    flight.vx = 0;
    flight.vy = 0;
    return;
  }
  const keep = (speed - amount) / speed;
  flight.vx *= keep;
  flight.vy *= keep;
}

/** @param {object} flight - Vol : distance au trou, green et meilleure approche. */
function measureHole(flight) {
  const dx = flight.x - flight.hole.hole.x;
  const dy = flight.y - flight.hole.hole.y;
  flight.holeDistance = sqrt(dx * dx + dy * dy);
  flight.inGreen = flight.holeDistance <= flight.hole.green;
  if (flight.holeDistance < flight.closest) { flight.closest = flight.holeDistance; }
}

/** @param {object} flight - Vol : roulement sur une planète, amorti du green, vitesse bornée. */
function applyFriction(flight) {
  if (flight.contact >= 0) { slowDown(flight, ROLL_FRICTION * DT); }
  if (flight.inGreen) {
    const keep = 1 - GREEN_DAMPING * DT;
    flight.vx *= keep;
    flight.vy *= keep;
    slowDown(flight, GREEN_FRICTION * DT);
  }
  const speed2 = flight.vx * flight.vx + flight.vy * flight.vy;
  if (speed2 > MAX_SPEED * MAX_SPEED) {
    const keep = MAX_SPEED / sqrt(speed2);
    flight.vx *= keep;
    flight.vy *= keep;
  }
}

/** @param {object} flight - Vol : avance d'un pas de Verlet vitesse. */
function step(flight) {
  flight.x += flight.vx * DT + 0.5 * flight.ax * DT * DT;
  flight.y += flight.vy * DT + 0.5 * flight.ay * DT * DT;
  flight.t = flight.t0 + (flight.steps + 1) * DT;
  flight.steps += 1;
  if (flight.moving) { placeBodies(flight.bodies, flight.t, flight.buffer); }
  accelerate(flight);
  flight.vx += 0.5 * (flight.ax + flight.nax) * DT;
  flight.vy += 0.5 * (flight.ay + flight.nay) * DT;
  if (collide(flight)) { accelerate(flight); }
  flight.ax = flight.nax;
  flight.ay = flight.nay;
  measureHole(flight);
  applyFriction(flight);
}

/** @param {object} flight - Vol. @returns {boolean} Balle sous l'horizon d'un trou noir. */
function isSwallowed(flight) {
  for (let index = 0; index < flight.count; index++) {
    if (flight.horizon2[index] > 0) {
      const dx = flight.x - flight.buffer[index * 4];
      const dy = flight.y - flight.buffer[index * 4 + 1];
      if (dx * dx + dy * dy < flight.horizon2[index]) { return true; }
    }
  }
  return false;
}

/** @param {object} flight - Vol. @returns {boolean} Centre de la balle hors limites. */
function isOutside(flight) {
  const [xMin, yMin, xMax, yMax] = flight.hole.bounds;
  return flight.x < xMin || flight.x > xMax || flight.y < yMin || flight.y > yMax;
}

/**
 * Arrêt : retenue (contact ou green) et vitesse < 6 u/s pendant 60 pas.
 * À la coupure, une balle retenue est arrêtée, pas perdue.
 * @param {object} flight - Vol.
 * @returns {string|null} Résultat ou null si le vol continue.
 */
function classifyRest(flight) {
  const held = flight.contact >= 0 || flight.inGreen;
  const speed2 = flight.vx * flight.vx + flight.vy * flight.vy;
  flight.restSteps = held && speed2 < REST_SPEED * REST_SPEED ? flight.restSteps + 1 : 0;
  if (flight.restSteps >= REST_STEPS) { return 'rest'; }
  if (flight.steps >= flight.maxSteps) { return held ? 'rest' : 'lost'; }
  return null;
}

/**
 * Capture : bornes incluses pour la distance (≤ 22 u), exclues pour la vitesse (< 150 u/s).
 * @param {number} distance - Distance du centre de la balle au trou.
 * @param {number} speed - Vitesse de la balle.
 * @returns {boolean} La balle tombe dans le trou.
 */
export function isCaptured(distance, speed) {
  return distance <= CAPTURE_RADIUS && speed < CAPTURE_SPEED;
}

/** @param {object} flight - Vol. @returns {string|null} Résultat selon la priorité documentée. */
function classify(flight) {
  if (isSwallowed(flight)) { return 'swallowed'; }
  if (isCaptured(flight.holeDistance, sqrt(flight.vx * flight.vx + flight.vy * flight.vy))) { return 'holed'; }
  if (isOutside(flight)) { return 'out'; }
  return classifyRest(flight);
}

/**
 * Aperçu : s'arrête au premier choc (après avoir quitté la surface de départ)
 * ou à la fin de l'horizon, sans montrer le rebond.
 * @param {object} flight - Vol.
 * @param {number} horizonSteps - Pas d'aperçu.
 * @returns {string|null} Résultat d'aperçu.
 */
function classifyPreview(flight, horizonSteps) {
  if (flight.collided || (flight.airborne && flight.contact >= 0)) { return 'contact'; }
  if (flight.contact < 0) { flight.airborne = true; }
  const outcome = classify(flight);
  if (outcome) { return outcome; }
  return flight.steps >= horizonSteps ? 'horizon' : null;
}

/**
 * Simule un coup complet.
 * @param {object} hole - Trou normalisé.
 * @param {{x:number,y:number}} from - Position de la balle.
 * @param {number} angle - Dixièmes de degré, entier de 0 à 3599.
 * @param {number} power - Entier de 1 à 100.
 * @param {number} t0 - Horloge du trou au lancement (position des lunes).
 * @param {SimulationOptions} [options] - Options de simulation.
 * @returns {FlightResult} Fin du vol.
 */
export function simulateShot(hole, from, angle, power, t0, options = {}) {
  const radians = angleToRadians(angle);
  const speed = launchSpeed(power);
  return simulateVelocity(hole, from, speed * cos(radians), speed * sin(radians), t0, options);
}

/**
 * @typedef {{maxSeconds?:number, preview?:number, sampleEvery?:number,
 *   onSample?:(x:number, y:number, t:number, bounced:boolean, vx:number, vy:number) => void}} SimulationOptions
 *   Durée maximale, horizon d'aperçu en secondes, échantillonnage pour l'animation.
 * @typedef {{outcome:string, x:number, y:number, on:number|null, duration:number,
 *   steps:number, closest:number}} FlightResult
 */

/**
 * Simule un vol à partir d'une vitesse initiale quelconque (tests physiques, outils).
 * @param {object} hole - Trou normalisé.
 * @param {{x:number,y:number}} from - Position initiale.
 * @param {number} vx - Vitesse initiale x, en u/s.
 * @param {number} vy - Vitesse initiale y, en u/s.
 * @param {number} t0 - Horloge du trou au départ.
 * @param {SimulationOptions} [options] - Options de simulation.
 * @returns {FlightResult} Fin du vol.
 */
export function simulateVelocity(hole, from, vx, vy, t0, options = {}) {
  const flight = createFlight(hole, from, t0, options.maxSeconds ?? MAX_FLIGHT_SECONDS);
  flight.vx = vx;
  flight.vy = vy;
  accelerate(flight);
  flight.ax = flight.nax;
  flight.ay = flight.nay;
  return finishFlight(flight, run(flight, options));
}

/**
 * Boucle de vol : un pas, un classement, un échantillon éventuel.
 * @param {object} flight - Vol lancé.
 * @param {object} options - Options de simulateShot.
 * @returns {string} Résultat.
 */
function run(flight, options) {
  const horizonSteps = options.preview === undefined ? 0 : Math.round(options.preview / DT);
  const every = options.sampleEvery ?? 1;
  const sample = options.onSample ?? null;
  sample?.(flight.x, flight.y, flight.t, false, flight.vx, flight.vy);
  let outcome = null;
  while (outcome === null) {
    step(flight);
    outcome = horizonSteps > 0 ? classifyPreview(flight, horizonSteps) : classify(flight);
    if (sample && (outcome !== null || flight.steps % every === 0)) {
      sample(flight.x, flight.y, flight.t, flight.collided, flight.vx, flight.vy);
    }
  }
  return outcome;
}

/**
 * @param {object} flight - Vol terminé.
 * @param {string} outcome - Résultat.
 * @returns {FlightResult} Résumé JSON.
 */
function finishFlight(flight, outcome) {
  const holed = outcome === 'holed';
  return {
    outcome,
    x: holed ? flight.hole.hole.x : flight.x,
    y: holed ? flight.hole.hole.y : flight.y,
    on: outcome === 'rest' && flight.contact >= 0 ? flight.contact : null,
    duration: flight.steps * DT,
    steps: flight.steps,
    closest: flight.closest,
  };
}

/**
 * Normale sortante de la planète qui porte la balle, ou null en vol libre.
 * @param {object} hole - Trou normalisé.
 * @param {{x:number,y:number,on:number|null}} ball - Balle au repos.
 * @returns {{x:number,y:number}|null} Normale unitaire.
 */
export function surfaceNormal(hole, ball) {
  if (ball.on === null || ball.on === undefined) { return null; }
  const body = hole.bodies[ball.on];
  const dx = ball.x - body.x;
  const dy = ball.y - body.y;
  const length = sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / length, y: dy / length };
}

/**
 * Un tir posé sur une planète doit quitter la surface (composante normale > 0).
 * @param {object} hole - Trou normalisé.
 * @param {{x:number,y:number,on:number|null}} ball - Balle.
 * @param {number} angle - Dixièmes de degré.
 * @returns {boolean} Direction jouable.
 */
export function leavesSurface(hole, ball, angle) {
  const normal = surfaceNormal(hole, ball);
  if (!normal) { return true; }
  const radians = angleToRadians(angle);
  return cos(radians) * normal.x + sin(radians) * normal.y > 0;
}
