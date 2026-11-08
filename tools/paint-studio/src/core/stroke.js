/**
 * Lissage des tracés et placement des tampons du pinceau, sans DOM.
 *
 * Chaîne de traitement d'un tracé :
 * 1. moyenne mobile exponentielle des points bruts (stabilisation de la main) ;
 * 2. courbe de Catmull-Rom passant par les points stabilisés (pas d'angles) ;
 * 3. tampons posés à intervalle régulier le long de la courbe (espacement
 *    proportionnel au diamètre), pression interpolée entre deux points.
 * Le pinceau pose ensuite un disque dégradé (dureté) à chaque tampon.
 */

/**
 * @typedef {{x: number, y: number, pressure: number}} StrokePoint
 */

/**
 * Point d'une courbe de Catmull-Rom uniforme entre p1 et p2 (t dans [0, 1]).
 * La courbe passe exactement par p1 (t = 0) et p2 (t = 1).
 * @param {StrokePoint} p0
 * @param {StrokePoint} p1
 * @param {StrokePoint} p2
 * @param {StrokePoint} p3
 * @param {number} t
 * @returns {StrokePoint}
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: axis(p0.x, p1.x, p2.x, p3.x),
    y: axis(p0.y, p1.y, p2.y, p3.y),
    pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
  };
}

/**
 * Moyenne pondérée entre le point stabilisé précédent et le nouveau point brut.
 * smoothing = 0 : aucun lissage ; proche de 1 : forte inertie (jamais figée).
 * @param {StrokePoint} previous
 * @param {StrokePoint} next
 * @param {number} smoothing - Dans [0, 1]
 * @returns {StrokePoint}
 */
export function smoothPoint(previous, next, smoothing) {
  const weight = 1 - Math.min(0.9, Math.max(0, smoothing) * 0.9);
  return {
    x: previous.x + (next.x - previous.x) * weight,
    y: previous.y + (next.y - previous.y) * weight,
    pressure: previous.pressure + (next.pressure - previous.pressure) * weight,
  };
}

/**
 * Diamètre effectif selon la pression : de minRatio·size (effleurement) à size (appui fort).
 * @param {number} size
 * @param {number} pressure - Dans [0, 1]
 * @param {number} [minRatio]
 */
export function pressureSize(size, pressure, minRatio = 0.15) {
  const p = Math.min(1, Math.max(0, pressure));
  return size * (minRatio + (1 - minRatio) * p);
}

/**
 * Paliers d'opacité du disque de tampon, du centre (0) au bord (1).
 * dureté 1 : bord net ; dureté 0 : dégradé depuis le centre (courbe douce).
 * @param {number} hardness - Dans [0, 1]
 * @returns {Array<[number, number]>} Couples [position, opacité]
 */
export function dabProfile(hardness) {
  const h = Math.min(1, Math.max(0, hardness));
  if (h >= 0.99) {
    return [[0, 1], [0.98, 1], [1, 0]];
  }
  const stops = [[0, 1], [h, 1]];
  for (let i = 1; i <= 4; i++) {
    const ratio = i / 4;
    // Décroissance en cosinus : plus douce qu'une rampe linéaire.
    stops.push([h + (1 - h) * ratio, 0.5 + 0.5 * Math.cos(Math.PI * ratio)]);
  }
  return /** @type {Array<[number, number]>} */ (stops);
}

/**
 * Transforme une suite de points de pointeur en tampons régulièrement espacés.
 */
export class StrokeStamper {
  /**
   * @param {{spacing: (pressure: number) => number, smoothing?: number}} options
   *   spacing : distance entre deux tampons (pixels) pour une pression donnée
   */
  constructor({ spacing, smoothing = 0.5 }) {
    this.spacing = (pressure) => Math.max(0.5, spacing(pressure));
    this.smoothing = smoothing;
    /** @type {StrokePoint[]} Derniers points stabilisés (au plus 4). */
    this.points = [];
    /** Distance parcourue depuis le dernier tampon. */
    this.travelled = 0;
    this.lastRaw = null;
  }

  /**
   * Premier point : un tampon immédiat (un simple tapotement laisse une marque).
   * @param {StrokePoint} point
   * @returns {StrokePoint[]}
   */
  begin(point) {
    this.points = [{ ...point }];
    this.lastRaw = { ...point };
    this.travelled = 0;
    return [{ ...point }];
  }

  /**
   * Point suivant : renvoie les tampons du segment désormais connu.
   * Le dernier segment est différé d'un point (il faut p3 pour la courbe).
   * @param {StrokePoint} point
   * @returns {StrokePoint[]}
   */
  add(point) {
    const previous = this.points[this.points.length - 1];
    if (!previous) {
      return this.begin(point);
    }
    this.lastRaw = { ...point };
    const smoothed = smoothPoint(previous, point, this.smoothing);
    if (Math.hypot(smoothed.x - previous.x, smoothed.y - previous.y) < 0.25) {
      return [];
    }
    return this.append(smoothed);
  }

  /**
   * Ajoute un point stabilisé (fenêtre de 4) et émet le segment devenu complet.
   * @param {StrokePoint} point
   * @returns {StrokePoint[]}
   */
  append(point) {
    this.points.push(point);
    if (this.points.length > 4) {
      this.points.shift();
    }
    return this.points.length >= 3 ? this.emitSegment(this.points.length - 3) : [];
  }

  /**
   * Fin du tracé : rejoint le dernier point réel (le lissage est en retard)
   * et émet les segments restants.
   * @returns {StrokePoint[]}
   */
  end() {
    const stamps = [];
    const last = this.points[this.points.length - 1];
    const raw = this.lastRaw;
    if (last && raw && Math.hypot(raw.x - last.x, raw.y - last.y) >= 0.25) {
      stamps.push(...this.append(raw));
    }
    if (this.points.length >= 2) {
      stamps.push(...this.emitSegment(this.points.length - 2));
    }
    this.points = [];
    this.lastRaw = null;
    return stamps;
  }

  /**
   * Échantillonne le segment points[i] -> points[i + 1] (extrémités dupliquées au besoin).
   * @param {number} i
   * @returns {StrokePoint[]}
   */
  emitSegment(i) {
    const pts = this.points;
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(1, Math.ceil(chord / 2));
    const stamps = [];
    let previous = p1;
    for (let s = 1; s <= steps; s++) {
      const current = catmullRom(p0, p1, p2, p3, s / steps);
      this.walk(previous, current, stamps);
      previous = current;
    }
    return stamps;
  }

  /**
   * Avance en ligne droite de a à b en posant un tampon à chaque espacement atteint.
   * @param {StrokePoint} a
   * @param {StrokePoint} b
   * @param {StrokePoint[]} out
   */
  walk(a, b, out) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let position = 0;
    let gap = this.spacing(a.pressure) - this.travelled;
    while (position + gap <= length) {
      position += gap;
      const t = length === 0 ? 0 : position / length;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, pressure: a.pressure + (b.pressure - a.pressure) * t });
      this.travelled = 0;
      gap = this.spacing(out[out.length - 1].pressure);
    }
    this.travelled += length - position;
  }
}
