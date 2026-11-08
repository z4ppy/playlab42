/**
 * Interprétation « tortue » d'une chaîne de L-système — logique pure.
 *
 * Convention (Prusinkiewicz & Lindenmayer, « The Algorithmic Beauty of Plants ») :
 *   F, G  avancer d'un pas en traçant      f, g  avancer sans tracer
 *   +     tourner à gauche de δ             -     tourner à droite de δ
 *   |     faire demi-tour                   [ ]   empiler / dépiler l'état
 *   !     amincir le trait (×0,7)
 * Forme paramétrée : F(l) avance de l, +(a) tourne de a degrés, !(w) fixe
 * l'épaisseur relative à w. Les autres symboles (X, Y, A…) sont ignorés.
 *
 * Le repère du monde a l'axe y vers le haut ; l'angle 0 pointe vers la droite.
 * Les segments sont stockés dans des tableaux typés (transférables à un
 * worker sans copie) : 4 flottants par segment, plus profondeur et épaisseur.
 */

const DEG = Math.PI / 180;

/** Facteur appliqué par « ! » sans paramètre. */
export const THIN_FACTOR = 0.7;

/** Symboles qui tracent un segment. */
export const DRAW_SYMBOLS = new Set(['F', 'G']);

/** Symboles qui déplacent la tortue sans tracer. */
export const MOVE_SYMBOLS = new Set(['f', 'g']);

/**
 * @typedef {object} TurtleOptions
 * @property {number} angle - Angle δ en degrés
 * @property {number} [step] - Longueur d'un pas sans paramètre
 * @property {number} [heading] - Orientation initiale en degrés (90 = vers le haut)
 */

/**
 * @typedef {object} Bounds
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/**
 * @typedef {object} Drawing
 * @property {Float32Array} segments - x1, y1, x2, y2 pour chaque segment
 * @property {Uint8Array} depths - Profondeur de pile (plafonnée à 255)
 * @property {Float32Array} widths - Épaisseur relative (1 au départ)
 * @property {number} count - Nombre de segments
 * @property {Bounds|null} bounds - Boîte englobante, null si rien n'est tracé
 * @property {number} maxDepth - Profondeur maximale atteinte par un segment
 * @property {number} unbalanced - Nombre de « ] » sans « [ » correspondant
 * @property {number} nonFinite - Symboles ignorés car non finis (∞, NaN ou hors Float32)
 * @property {string} nonFiniteSymbol - Premier symbole fautif (vide sinon)
 */

/**
 * Vrai si la coordonnée reste finie une fois stockée en Float32 : une valeur
 * finie en double (1e300) devient ∞ dans un Float32Array.
 * @param {number} value - Coordonnée
 * @returns {boolean}
 */
export function isStorable(value) {
  return Number.isFinite(Math.fround(value));
}

/**
 * Parcourt la chaîne en appelant `visit(symbole, paramètre)` ; masque la
 * différence entre chaîne simple et tableau de modules.
 * @param {string|{ s: string, p: number[] }[]} input - Chaîne
 * @param {(symbol: string, param: number|undefined) => void} visit - Visiteur
 */
function forEachSymbol(input, visit) {
  if (typeof input === 'string') {
    for (let i = 0; i < input.length; i++) {
      visit(input[i], undefined);
    }
    return;
  }
  for (const module of input) {
    visit(module.s, module.p[0]);
  }
}

/**
 * Compte les segments à tracer pour dimensionner exactement les tableaux.
 * @param {string|{ s: string, p: number[] }[]} input - Chaîne
 * @returns {number}
 */
export function countSegments(input) {
  let count = 0;
  forEachSymbol(input, (symbol) => {
    if (DRAW_SYMBOLS.has(symbol)) {
      count++;
    }
  });
  return count;
}

/**
 * État mutable de la tortue et enregistreur de segments.
 */
class Turtle {
  /**
   * @param {number} capacity - Nombre de segments prévus
   * @param {TurtleOptions} options - Options
   */
  constructor(capacity, options) {
    this.segments = new Float32Array(capacity * 4);
    this.depths = new Uint8Array(capacity);
    this.widths = new Float32Array(capacity);
    this.count = 0;
    this.delta = (options.angle ?? 90) * DEG;
    this.step = options.step ?? 10;
    this.x = 0;
    this.y = 0;
    this.direction = (options.heading ?? 0) * DEG;
    this.width = 1;
    this.stack = [];
    this.maxDepth = 0;
    this.unbalanced = 0;
    this.nonFinite = 0;
    this.nonFiniteSymbol = '';
    /** Symbole en cours d'interprétation (pour les messages). */
    this.symbol = '';
    this.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }

  advance(length, draw) {
    const nx = this.x + length * Math.cos(this.direction);
    const ny = this.y + length * Math.sin(this.direction);
    // Une position qui déborde (F(x*1e300) dépasse Float32) donnerait des
    // bornes infinies et un dessin vide : on ignore le pas et on le compte,
    // la tortue reste en place pour que la suite du dessin reste visible.
    if (!(isStorable(nx) && isStorable(ny))) {
      this.flagNonFinite();
      return;
    }
    if (draw) {
      this.record(nx, ny);
    }
    this.x = nx;
    this.y = ny;
  }

  /** Compte un symbole ignoré car son paramètre n'est pas fini. */
  flagNonFinite() {
    this.nonFinite++;
    this.nonFiniteSymbol ||= this.symbol;
  }

  record(nx, ny) {
    const i = this.count;
    const depth = Math.min(this.stack.length, 255);
    this.segments[i * 4] = this.x;
    this.segments[i * 4 + 1] = this.y;
    this.segments[i * 4 + 2] = nx;
    this.segments[i * 4 + 3] = ny;
    this.depths[i] = depth;
    this.widths[i] = this.width;
    this.maxDepth = Math.max(this.maxDepth, depth);
    this.extend(this.x, this.y);
    this.extend(nx, ny);
    this.count++;
  }

  extend(x, y) {
    const b = this.bounds;
    if (x < b.minX) {b.minX = x;}
    if (x > b.maxX) {b.maxX = x;}
    if (y < b.minY) {b.minY = y;}
    if (y > b.maxY) {b.maxY = y;}
  }

  push() {
    this.stack.push([this.x, this.y, this.direction, this.width]);
  }

  pop() {
    const saved = this.stack.pop();
    if (!saved) {
      // Chaîne mal équilibrée : on l'ignore plutôt que d'échouer, et on le signale.
      this.unbalanced++;
      return;
    }
    [this.x, this.y, this.direction, this.width] = saved;
  }
}

/** Action de chaque symbole reconnu (table plutôt que long switch). */
const ACTIONS = {
  F: (t, p) => t.advance(p ?? t.step, true),
  G: (t, p) => t.advance(p ?? t.step, true),
  f: (t, p) => t.advance(p ?? t.step, false),
  g: (t, p) => t.advance(p ?? t.step, false),
  '+': (t, p) => { t.direction += p === undefined ? t.delta : p * DEG; },
  '-': (t, p) => { t.direction -= p === undefined ? t.delta : p * DEG; },
  '|': (t) => { t.direction += Math.PI; },
  '[': (t) => t.push(),
  ']': (t) => t.pop(),
  '!': (t, p) => { t.width = p === undefined ? t.width * THIN_FACTOR : p; },
};

/**
 * Interprète une chaîne et produit les segments à dessiner.
 * @param {string|{ s: string, p: number[] }[]} input - Chaîne développée
 * @param {TurtleOptions} options - Angle, pas, orientation
 * @returns {Drawing}
 */
export function interpret(input, options) {
  const turtle = new Turtle(countSegments(input), options);
  forEachSymbol(input, (symbol, param) => {
    const action = ACTIONS[symbol];
    if (!action) {
      return;
    }
    turtle.symbol = symbol;
    // ∞ ou NaN (2^2000, 0/0) : appliqué, il contaminerait position, cap ou
    // épaisseur pour toute la suite ; on ignore donc ce seul symbole.
    if (param !== undefined && !Number.isFinite(param)) {
      turtle.flagNonFinite();
      return;
    }
    action(turtle, param);
  });
  return {
    segments: turtle.segments,
    depths: turtle.depths,
    widths: turtle.widths,
    count: turtle.count,
    bounds: turtle.count > 0 ? turtle.bounds : null,
    maxDepth: turtle.maxDepth,
    unbalanced: turtle.unbalanced,
    nonFinite: turtle.nonFinite,
    nonFiniteSymbol: turtle.nonFiniteSymbol,
  };
}
