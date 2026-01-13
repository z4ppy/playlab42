/**
 * Duration - Représentation d'une durée rythmique
 *
 * @module core/Duration
 */

// ============================================================================
// Constantes
// ============================================================================

/**
 * Types de durées de base avec leur valeur en ticks (ronde = 4096 ticks)
 * @type {Object<string, number>}
 */
const BASE_DURATIONS = {
  whole: 4096, // Ronde
  half: 2048, // Blanche
  quarter: 1024, // Noire
  eighth: 512, // Croche
  sixteenth: 256, // Double croche
  'thirty-second': 128, // Triple croche
  'sixty-fourth': 64, // Quadruple croche
};

/**
 * Noms français des durées
 * @type {Object<string, string>}
 */
const FRENCH_NAMES = {
  whole: 'Ronde',
  half: 'Blanche',
  quarter: 'Noire',
  eighth: 'Croche',
  sixteenth: 'Double croche',
  'thirty-second': 'Triple croche',
  'sixty-fourth': 'Quadruple croche',
};

/**
 * Notation VexFlow pour les durées
 * @type {Object<string, string>}
 */
const VEXFLOW_NOTATION = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
  'thirty-second': '32',
  'sixty-fourth': '64',
};

/**
 * Ticks par noire (valeur de référence)
 * @type {number}
 */
const TICKS_PER_QUARTER = 1024;

// ============================================================================
// Classe Duration
// ============================================================================

/**
 * Représente une durée rythmique
 *
 * @example
 * const noire = new Duration('quarter');
 * const noirePointee = new Duration('quarter', 1);
 * const triolet = new Duration('eighth', 0, { ratio: [3, 2] });
 */
export class Duration {
  /**
   * Crée une nouvelle durée
   *
   * @param {string} base - Type de base: 'whole', 'half', 'quarter', 'eighth', etc.
   * @param {number} dots - Nombre de points (0, 1 ou 2)
   * @param {Object|null} tuplet - Configuration du tuplet
   * @param {number[]} tuplet.ratio - Ratio du tuplet (ex: [3, 2] pour un triolet)
   */
  constructor(base, dots = 0, tuplet = null) {
    if (!(base in BASE_DURATIONS)) {
      throw new Error(`Durée de base invalide: ${base}`);
    }
    if (dots < 0 || dots > 2) {
      throw new Error(`Nombre de points invalide: ${dots} (doit être 0-2)`);
    }

    /** @type {string} Type de durée de base */
    this.base = base;

    /** @type {number} Nombre de points */
    this.dots = dots;

    /** @type {Object|null} Configuration du tuplet */
    this.tuplet = tuplet;
  }

  // --------------------------------------------------------------------------
  // Conversions
  // --------------------------------------------------------------------------

  /**
   * Convertit en ticks (unités absolues, 1024 ticks = 1 noire)
   *
   * @returns {number} Nombre de ticks
   *
   * @example
   * new Duration('quarter').toTicks() // 1024
   * new Duration('quarter', 1).toTicks() // 1536 (1024 * 1.5)
   */
  toTicks() {
    let ticks = BASE_DURATIONS[this.base];

    // Ajouter les points (chaque point ajoute la moitié de la valeur précédente)
    let dotValue = ticks / 2;
    for (let i = 0; i < this.dots; i++) {
      ticks += dotValue;
      dotValue /= 2;
    }

    // Appliquer le tuplet
    if (this.tuplet && this.tuplet.ratio) {
      const [num, denom] = this.tuplet.ratio;
      ticks = (ticks * denom) / num;
    }

    return Math.round(ticks);
  }

  /**
   * Convertit en nombre de temps (beats)
   *
   * @param {Object} timeSignature - Signature rythmique
   * @param {number} timeSignature.beatValue - Valeur du temps (4 = noire, 8 = croche)
   * @returns {number} Nombre de temps
   *
   * @example
   * new Duration('quarter').toBeats({ beatValue: 4 }) // 1
   * new Duration('half').toBeats({ beatValue: 4 }) // 2
   * new Duration('quarter').toBeats({ beatValue: 8 }) // 2
   */
  toBeats(timeSignature = { beatValue: 4 }) {
    const ticks = this.toTicks();
    const ticksPerBeat = TICKS_PER_QUARTER * (4 / timeSignature.beatValue);
    return ticks / ticksPerBeat;
  }

  /**
   * Convertit en durée en secondes
   *
   * @param {number} tempo - Tempo en BPM (noires par minute)
   * @returns {number} Durée en secondes
   *
   * @example
   * new Duration('quarter').toSeconds(60) // 1
   * new Duration('quarter').toSeconds(120) // 0.5
   */
  toSeconds(tempo) {
    const beats = this.toBeats({ beatValue: 4 });
    return (beats * 60) / tempo;
  }

  /**
   * Convertit en notation VexFlow
   *
   * @returns {string} Notation VexFlow (ex: "q", "8d", "16")
   */
  toVexFlow() {
    let notation = VEXFLOW_NOTATION[this.base];

    // Ajouter les points
    for (let i = 0; i < this.dots; i++) {
      notation += 'd';
    }

    return notation;
  }

  /**
   * Convertit en nom français
   *
   * @returns {string} Nom français de la durée
   *
   * @example
   * new Duration('quarter').toFrench() // "Noire"
   * new Duration('quarter', 1).toFrench() // "Noire pointée"
   */
  toFrench() {
    let name = FRENCH_NAMES[this.base];

    if (this.dots === 1) {
      name += ' pointée';
    } else if (this.dots === 2) {
      name += ' double-pointée';
    }

    if (this.tuplet && this.tuplet.ratio) {
      const [num] = this.tuplet.ratio;
      if (num === 3) {
        name += ' (triolet)';
      } else if (num === 5) {
        name += ' (quintolet)';
      } else {
        name += ` (${num}:${this.tuplet.ratio[1]})`;
      }
    }

    return name;
  }

  // --------------------------------------------------------------------------
  // Comparaison
  // --------------------------------------------------------------------------

  /**
   * Vérifie l'égalité avec une autre durée
   *
   * @param {Duration} other - Autre durée
   * @returns {boolean}
   */
  equals(other) {
    return (
      this.base === other.base &&
      this.dots === other.dots &&
      JSON.stringify(this.tuplet) === JSON.stringify(other.tuplet)
    );
  }

  /**
   * Compare deux durées
   *
   * @param {Duration} other - Autre durée
   * @returns {number} -1 si this < other, 0 si égaux, 1 si this > other
   */
  compareTo(other) {
    return Math.sign(this.toTicks() - other.toTicks());
  }

  // --------------------------------------------------------------------------
  // Factory methods
  // --------------------------------------------------------------------------

  /**
   * Crée une ronde
   * @param {number} dots - Nombre de points
   * @returns {Duration}
   */
  static whole(dots = 0) {
    return new Duration('whole', dots);
  }

  /**
   * Crée une blanche
   * @param {number} dots - Nombre de points
   * @returns {Duration}
   */
  static half(dots = 0) {
    return new Duration('half', dots);
  }

  /**
   * Crée une noire
   * @param {number} dots - Nombre de points
   * @returns {Duration}
   */
  static quarter(dots = 0) {
    return new Duration('quarter', dots);
  }

  /**
   * Crée une croche
   * @param {number} dots - Nombre de points
   * @returns {Duration}
   */
  static eighth(dots = 0) {
    return new Duration('eighth', dots);
  }

  /**
   * Crée une double croche
   * @param {number} dots - Nombre de points
   * @returns {Duration}
   */
  static sixteenth(dots = 0) {
    return new Duration('sixteenth', dots);
  }

  /**
   * Crée une durée de triolet
   *
   * @param {string} base - Type de base
   * @returns {Duration}
   *
   * @example
   * Duration.triplet('eighth') // Croche de triolet
   */
  static triplet(base) {
    return new Duration(base, 0, { ratio: [3, 2] });
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------

  /**
   * Retourne les types de durées disponibles
   * @returns {string[]}
   */
  static get types() {
    return Object.keys(BASE_DURATIONS);
  }

  /**
   * Vérifie si la durée est pointée
   * @returns {boolean}
   */
  isDotted() {
    return this.dots > 0;
  }

  /**
   * Vérifie si la durée fait partie d'un tuplet
   * @returns {boolean}
   */
  isTuplet() {
    return this.tuplet !== null;
  }
}

export default Duration;
