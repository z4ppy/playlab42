/**
 * Schéma d'un trou de golf orbital et géométrie dépendante du temps.
 *
 * Un trou brut (données de `levels.js` ou du générateur) est validé puis
 * normalisé en objet JSON simple : départ `{x, y}`, trou `{x, y}` calculé
 * même lorsqu'il est posé sur une planète, limites et green explicites.
 * Les positions des lunes sont écrites dans un tampon réutilisé, pour que
 * la boucle physique n'alloue rien à chaque pas.
 */

/** Limites par défaut [xMin, yMin, xMax, yMax] : le monde 1000 × 1000 et une marge de 80 u. */
export const DEFAULT_BOUNDS = Object.freeze([-80, -80, 1080, 1080]);
/** Rayon du green, disque amorti autour du trou. */
export const DEFAULT_GREEN = 90;
/** Rayon physique de la balle. */
export const BALL_RADIUS = 8;
/** Horizon d'un trou noir : la balle est avalée en dessous. */
export const HORIZON_RADIUS = 30;
/** Durée d'aperçu de trajectoire par défaut, en secondes. */
export const DEFAULT_PREVIEW = 1.6;

const TAU = Math.PI * 2;
// Lecture unique de Math : voir la remarque sur les contextes `vm` dans physics.js.
const { cos, sin } = Math;
const MASS_RANGE = [0.3, 12];

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const inRange = (value, [min, max]) => isNumber(value) && value >= min && value <= max;
const isPoint = point => Array.isArray(point) && point.length === 2 && point.every(isNumber);
const isBounds = bounds => Array.isArray(bounds) && bounds.length === 4 && bounds.every(isNumber)
  && bounds[0] < bounds[2] && bounds[1] < bounds[3];

/**
 * @typedef {{cx:number, cy:number, r:number, period:number, phase:number}} Orbit
 * @typedef {{kind:'planet'|'moon'|'blackhole', x?:number, y?:number, radius?:number,
 *   mass:number, orbit?:Orbit, palette?:string}} Body
 * @typedef {{id:string, name:string, par:number, tee:{x:number,y:number},
 *   hole:{x:number,y:number}, green:number, bounds:number[], previewSeconds:number,
 *   bodies:Body[], reference:{angle:number,power:number}|null, lesson?:string}} Hole
 */

/** @param {Orbit} orbit - Orbite circulaire imposée. @returns {boolean} Orbite exploitable. */
function isOrbit(orbit) {
  return Boolean(orbit) && isNumber(orbit.cx) && isNumber(orbit.cy) && isNumber(orbit.phase)
    && isNumber(orbit.r) && orbit.r > 0 && isNumber(orbit.period) && orbit.period > 0;
}

const isPositive = value => isNumber(value) && value > 0;
const isPlaced = body => isNumber(body.x) && isNumber(body.y);

/** Contrôle propre à chaque type de corps (Map : aucune clé héritée d'Object). */
const BODY_CHECKS = new Map([
  ['planet', body => isPlaced(body) && isPositive(body.radius)],
  ['blackhole', isPlaced],
  ['moon', body => isOrbit(body.orbit) && isPositive(body.radius)],
]);

/** @param {Body} body - Corps brut. @returns {boolean} Corps conforme à son type. */
function isBody(body) {
  const check = BODY_CHECKS.get(body?.kind);
  return Boolean(check) && inRange(body.mass, MASS_RANGE) && check(body);
}

/**
 * @param {object} target - Trou brut `{x, y}` ou `{on: {body, deg}}`.
 * @param {Body[]} bodies - Corps du trou.
 * @returns {boolean} Cible désignée sans ambiguïté.
 */
function isTarget(target, bodies) {
  if (!target) { return false; }
  if (target.on) {
    const support = bodies[target.on.body];
    return Number.isInteger(target.on.body) && support?.kind === 'planet' && isNumber(target.on.deg);
  }
  return isNumber(target.x) && isNumber(target.y);
}

/** @param {unknown} reference - Tir de référence facultatif. @returns {boolean} Tir entier valide. */
function isReference(reference) {
  if (reference === undefined || reference === null) { return true; }
  return Number.isInteger(reference.angle) && reference.angle >= 0 && reference.angle < 3600
    && Number.isInteger(reference.power) && reference.power >= 1 && reference.power <= 100;
}

const optional = (value, check) => value === undefined || check(value);
const isText = value => typeof value === 'string' && value.length > 0;

/** Champs vérifiés, dans l'ordre des messages d'erreur. */
const FIELD_CHECKS = [
  ['id', raw => isText(raw.id)],
  ['name', raw => isText(raw.name)],
  ['par', raw => Number.isInteger(raw.par) && raw.par >= 1 && raw.par <= 6],
  ['tee', raw => isPoint(raw.tee)],
  ['bodies', raw => Array.isArray(raw.bodies) && raw.bodies.every(isBody)],
  ['hole', raw => isTarget(raw.hole, Array.isArray(raw.bodies) ? raw.bodies : [])],
  ['bounds', raw => optional(raw.bounds, isBounds)],
  ['previewSeconds', raw => optional(raw.previewSeconds, value => inRange(value, [0, 5]))],
  ['green', raw => optional(raw.green, value => inRange(value, [30, 200]))],
  ['reference', raw => isReference(raw.reference)],
];

/**
 * Liste les écarts au schéma, pour un message de test lisible.
 * @param {object} raw - Trou brut.
 * @returns {string[]} Erreurs ; vide si le trou est valide.
 */
export function validateHole(raw) {
  if (!raw || typeof raw !== 'object') { return ['trou absent']; }
  return FIELD_CHECKS.filter(([, check]) => !check(raw)).map(([field]) => `champ invalide : ${field}`);
}

/**
 * Place le centre d'un trou posé à `R + rayon de balle` du centre de sa planète,
 * pour qu'une balle qui roule sur la surface puisse réellement l'atteindre.
 * @param {{x:number,y:number}|{on:{body:number,deg:number}}} target - Cible brute.
 * @param {Body[]} bodies - Corps du trou.
 * @returns {{x:number,y:number}} Centre du trou.
 */
export function resolveTarget(target, bodies) {
  if (!target.on) { return { x: target.x, y: target.y }; }
  const support = bodies[target.on.body];
  const angle = target.on.deg * Math.PI / 180;
  const distance = support.radius + BALL_RADIUS;
  return { x: support.x + distance * cos(angle), y: support.y + distance * sin(angle) };
}

/**
 * Valide puis normalise un trou brut, sans modifier l'entrée.
 * @param {object} raw - Trou brut.
 * @returns {Hole} Trou JSON prêt pour la physique.
 * @throws {Error} Si le schéma n'est pas respecté.
 */
export function normalizeHole(raw) {
  const errors = validateHole(raw);
  if (errors.length > 0) { throw new Error(`Trou invalide (${raw?.id ?? '?'}) : ${errors.join(', ')}`); }
  const bodies = raw.bodies.map(body => JSON.parse(JSON.stringify(body)));
  return {
    id: raw.id,
    name: raw.name,
    par: raw.par,
    tee: { x: raw.tee[0], y: raw.tee[1] },
    hole: resolveTarget(raw.hole, bodies),
    green: raw.green ?? DEFAULT_GREEN,
    bounds: [...(raw.bounds ?? DEFAULT_BOUNDS)],
    previewSeconds: raw.previewSeconds ?? DEFAULT_PREVIEW,
    bodies,
    reference: raw.reference ? { angle: raw.reference.angle, power: raw.reference.power } : null,
    ...(raw.lesson ? { lesson: raw.lesson } : {}),
  };
}

/**
 * Écrit position et vitesse d'une lune à l'instant t dans `out[offset..offset+3]`.
 * @param {Orbit} orbit - Orbite circulaire.
 * @param {number} time - Horloge du trou, en secondes.
 * @param {Float64Array} out - Tampon de sortie.
 * @param {number} offset - Premier indice écrit.
 */
function writeOrbit(orbit, time, out, offset) {
  const omega = TAU / orbit.period;
  const angle = orbit.phase * Math.PI / 180 + omega * time;
  const cosine = cos(angle);
  const sine = sin(angle);
  out[offset] = orbit.cx + orbit.r * cosine;
  out[offset + 1] = orbit.cy + orbit.r * sine;
  out[offset + 2] = -orbit.r * omega * sine;
  out[offset + 3] = orbit.r * omega * cosine;
}

/**
 * Remplit `out` avec (x, y, vx, vy) de chaque corps à l'instant t.
 * @param {Body[]} bodies - Corps du trou.
 * @param {number} time - Horloge du trou.
 * @param {Float64Array} out - Tampon de longueur 4 × nombre de corps.
 * @returns {Float64Array} Le même tampon.
 */
export function placeBodies(bodies, time, out) {
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index];
    const offset = index * 4;
    if (body.orbit) {
      writeOrbit(body.orbit, time, out, offset);
    } else {
      out[offset] = body.x;
      out[offset + 1] = body.y;
      out[offset + 2] = 0;
      out[offset + 3] = 0;
    }
  }
  return out;
}

/**
 * Position d'un corps pour l'affichage (alloue un petit objet, hors boucle chaude).
 * @param {Body} body - Corps.
 * @param {number} time - Horloge du trou.
 * @returns {{x:number, y:number}} Centre du corps.
 */
export function bodyCenter(body, time) {
  const buffer = placeBodies([body], time, new Float64Array(4));
  return { x: buffer[0], y: buffer[1] };
}
