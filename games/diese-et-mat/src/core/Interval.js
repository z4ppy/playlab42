/**
 * Interval - Représentation d'un intervalle musical
 *
 * @module core/Interval
 */

// ============================================================================
// Constantes
// ============================================================================

/**
 * Noms français des intervalles par numéro
 * @type {Object<number, string>}
 */
const INTERVAL_NAMES = {
  1: 'unisson',
  2: 'seconde',
  3: 'tierce',
  4: 'quarte',
  5: 'quinte',
  6: 'sixte',
  7: 'septième',
  8: 'octave',
};

/**
 * Qualités possibles et leur abréviation
 * @type {Object<string, string>}
 */
const QUALITY_NAMES = {
  perfect: 'juste',
  major: 'majeure',
  minor: 'mineure',
  augmented: 'augmentée',
  diminished: 'diminuée',
};

/**
 * Abréviations des qualités (notation internationale)
 * @type {Object<string, string>}
 */
const QUALITY_ABBREV = {
  perfect: 'P',
  major: 'M',
  minor: 'm',
  augmented: 'A',
  diminished: 'd',
};

/**
 * Demi-tons pour les intervalles justes (unisson, quarte, quinte, octave)
 * @type {Object<number, number>}
 */
const PERFECT_SEMITONES = {
  1: 0, // Unisson
  4: 5, // Quarte
  5: 7, // Quinte
  8: 12, // Octave
};

/**
 * Demi-tons pour les intervalles majeurs
 * @type {Object<number, number>}
 */
const MAJOR_SEMITONES = {
  2: 2, // Seconde majeure
  3: 4, // Tierce majeure
  6: 9, // Sixte majeure
  7: 11, // Septième majeure
};

/**
 * Intervalles qui sont "parfaits" (peuvent être justes, augmentés, diminués)
 * @type {number[]}
 */
const PERFECT_INTERVALS = [1, 4, 5, 8];

// ============================================================================
// Classe Interval
// ============================================================================

/**
 * Représente un intervalle entre deux notes
 *
 * @example
 * const tierceMaj = new Interval('major', 3);
 * const quinte = new Interval('perfect', 5);
 */
export class Interval {
  /**
   * Crée un nouvel intervalle
   *
   * @param {string} quality - Qualité: 'perfect', 'major', 'minor', 'augmented', 'diminished'
   * @param {number} number - Numéro de l'intervalle (1-8 pour simple, >8 pour composé)
   */
  constructor(quality, number) {
    if (!(quality in QUALITY_NAMES)) {
      throw new Error(`Qualité d'intervalle invalide: ${quality}`);
    }
    if (number < 1) {
      throw new Error(`Numéro d'intervalle invalide: ${number}`);
    }

    // Vérifier la cohérence qualité/numéro
    const simpleNumber = ((number - 1) % 7) + 1;
    const isPerfectInterval = PERFECT_INTERVALS.includes(simpleNumber);

    if (isPerfectInterval && (quality === 'major' || quality === 'minor')) {
      throw new Error(
        `L'intervalle ${number} ne peut pas être ${quality} (doit être perfect, augmented, ou diminished)`,
      );
    }
    if (!isPerfectInterval && quality === 'perfect') {
      throw new Error(
        `L'intervalle ${number} ne peut pas être perfect (doit être major, minor, augmented, ou diminished)`,
      );
    }

    /** @type {string} Qualité de l'intervalle */
    this.quality = quality;

    /** @type {number} Numéro de l'intervalle */
    this.number = number;
  }

  // --------------------------------------------------------------------------
  // Propriétés calculées
  // --------------------------------------------------------------------------

  /**
   * Numéro simple (1-8) pour les intervalles composés
   * @returns {number}
   */
  get simpleNumber() {
    // Les intervalles simples (1-8) restent tels quels
    if (this.number <= 8) {return this.number;}
    // Les intervalles composés (9+) sont réduits à leur forme simple
    // 9 → 2 (neuvième = seconde), 10 → 3 (dixième = tierce), etc.
    return ((this.number - 2) % 7) + 2;
  }

  /**
   * Vérifie si c'est un intervalle composé (> octave)
   * @returns {boolean}
   */
  get isCompound() {
    return this.number > 8;
  }

  // --------------------------------------------------------------------------
  // Conversions
  // --------------------------------------------------------------------------

  /**
   * Convertit en nombre de demi-tons
   *
   * @returns {number} Nombre de demi-tons
   *
   * @example
   * new Interval('major', 3).toSemitones() // 4
   * new Interval('perfect', 5).toSemitones() // 7
   */
  toSemitones() {
    const simpleNumber = this.simpleNumber;
    const isPerfectInterval = PERFECT_INTERVALS.includes(simpleNumber);

    // Calcul des demi-tons de base
    let semitones;
    if (isPerfectInterval) {
      semitones = PERFECT_SEMITONES[simpleNumber];
    } else {
      semitones = MAJOR_SEMITONES[simpleNumber];
    }

    // Ajuster selon la qualité
    if (isPerfectInterval) {
      if (this.quality === 'augmented') {semitones += 1;}
      if (this.quality === 'diminished') {semitones -= 1;}
    } else {
      if (this.quality === 'minor') {semitones -= 1;}
      if (this.quality === 'augmented') {semitones += 1;}
      if (this.quality === 'diminished') {semitones -= 2;}
    }

    // Ajouter les octaves pour les intervalles composés (9+)
    if (this.number > 8) {
      const octaves = Math.floor((this.number - 2) / 7);
      semitones += octaves * 12;
    }

    return semitones;
  }

  /**
   * Convertit en nom français
   *
   * @returns {string} Nom français (ex: "tierce majeure", "quinte juste")
   */
  toFrench() {
    const intervalName = INTERVAL_NAMES[this.simpleNumber];
    const qualityName = QUALITY_NAMES[this.quality];

    if (this.isCompound) {
      const octaves = Math.floor((this.number - 1) / 7);
      return `${intervalName} ${qualityName} (+${octaves} octave${octaves > 1 ? 's' : ''})`;
    }

    return `${intervalName} ${qualityName}`;
  }

  /**
   * Convertit en notation abrégée
   *
   * @returns {string} Notation abrégée (ex: "M3", "P5")
   */
  toAbbrev() {
    return `${QUALITY_ABBREV[this.quality]}${this.number}`;
  }

  // --------------------------------------------------------------------------
  // Opérations
  // --------------------------------------------------------------------------

  /**
   * Applique l'intervalle à une note (transposition)
   *
   * @param {Pitch} pitch - Note de départ
   * @param {string} direction - 'up' ou 'down'
   * @returns {Pitch} Note résultante
   *
   * @example
   * const c4 = new Pitch(0, 4);
   * new Interval('major', 3).apply(c4) // Mi4
   */
  apply(pitch, direction = 'up') {
    const semitones = this.toSemitones();
    const offset = direction === 'up' ? semitones : -semitones;
    return pitch.transpose(offset);
  }

  /**
   * Inverse l'intervalle (ex: tierce majeure → sixte mineure)
   *
   * @returns {Interval} Intervalle inversé
   */
  invert() {
    if (this.isCompound) {
      throw new Error("L'inversion n'est définie que pour les intervalles simples");
    }

    const newNumber = 9 - this.number;
    let newQuality;

    switch (this.quality) {
      case 'perfect':
        newQuality = 'perfect';
        break;
      case 'major':
        newQuality = 'minor';
        break;
      case 'minor':
        newQuality = 'major';
        break;
      case 'augmented':
        newQuality = 'diminished';
        break;
      case 'diminished':
        newQuality = 'augmented';
        break;
      default:
        newQuality = this.quality;
    }

    return new Interval(newQuality, newNumber);
  }

  // --------------------------------------------------------------------------
  // Comparaison
  // --------------------------------------------------------------------------

  /**
   * Vérifie l'égalité avec un autre intervalle
   *
   * @param {Interval} other - Autre intervalle
   * @returns {boolean}
   */
  equals(other) {
    return this.quality === other.quality && this.number === other.number;
  }

  /**
   * Compare deux intervalles par taille
   *
   * @param {Interval} other - Autre intervalle
   * @returns {number} -1 si this < other, 0 si égaux, 1 si this > other
   */
  compareTo(other) {
    return Math.sign(this.toSemitones() - other.toSemitones());
  }

  // --------------------------------------------------------------------------
  // Factory methods
  // --------------------------------------------------------------------------

  /**
   * Calcule l'intervalle entre deux notes
   *
   * @param {Pitch} pitch1 - Première note
   * @param {Pitch} pitch2 - Deuxième note
   * @returns {Interval} Intervalle entre les deux notes
   *
   * @example
   * const c4 = new Pitch(0, 4);
   * const e4 = new Pitch(2, 4);
   * Interval.between(c4, e4) // tierce majeure
   */
  static between(pitch1, pitch2) {
    // Calculer le nombre de demi-tons
    const semitones = Math.abs(pitch2.toMidi() - pitch1.toMidi());

    // Calculer le numéro d'intervalle (distance diatonique)
    const p1Pos = pitch1.octave * 7 + pitch1.pitchClass;
    const p2Pos = pitch2.octave * 7 + pitch2.pitchClass;
    const diatonicSteps = Math.abs(p2Pos - p1Pos);
    const number = diatonicSteps + 1;

    // Déterminer la qualité
    const simpleNumber = ((number - 1) % 7) + 1;
    const simpleSemitones = semitones % 12;
    const isPerfectInterval = PERFECT_INTERVALS.includes(simpleNumber);

    let quality;
    if (isPerfectInterval) {
      const perfectSemitones = PERFECT_SEMITONES[simpleNumber];
      if (simpleSemitones === perfectSemitones) {
        quality = 'perfect';
      } else if (simpleSemitones === perfectSemitones + 1) {
        quality = 'augmented';
      } else if (simpleSemitones === perfectSemitones - 1) {
        quality = 'diminished';
      } else {
        quality = 'augmented'; // Fallback
      }
    } else {
      const majorSemitones = MAJOR_SEMITONES[simpleNumber];
      if (simpleSemitones === majorSemitones) {
        quality = 'major';
      } else if (simpleSemitones === majorSemitones - 1) {
        quality = 'minor';
      } else if (simpleSemitones === majorSemitones + 1) {
        quality = 'augmented';
      } else if (simpleSemitones === majorSemitones - 2) {
        quality = 'diminished';
      } else {
        quality = 'major'; // Fallback
      }
    }

    return new Interval(quality, number);
  }

  /**
   * Crée un unisson juste
   * @returns {Interval}
   */
  static unison() {
    return new Interval('perfect', 1);
  }

  /**
   * Crée une seconde majeure
   * @returns {Interval}
   */
  static majorSecond() {
    return new Interval('major', 2);
  }

  /**
   * Crée une seconde mineure
   * @returns {Interval}
   */
  static minorSecond() {
    return new Interval('minor', 2);
  }

  /**
   * Crée une tierce majeure
   * @returns {Interval}
   */
  static majorThird() {
    return new Interval('major', 3);
  }

  /**
   * Crée une tierce mineure
   * @returns {Interval}
   */
  static minorThird() {
    return new Interval('minor', 3);
  }

  /**
   * Crée une quarte juste
   * @returns {Interval}
   */
  static perfectFourth() {
    return new Interval('perfect', 4);
  }

  /**
   * Crée une quinte juste
   * @returns {Interval}
   */
  static perfectFifth() {
    return new Interval('perfect', 5);
  }

  /**
   * Crée une sixte majeure
   * @returns {Interval}
   */
  static majorSixth() {
    return new Interval('major', 6);
  }

  /**
   * Crée une sixte mineure
   * @returns {Interval}
   */
  static minorSixth() {
    return new Interval('minor', 6);
  }

  /**
   * Crée une septième majeure
   * @returns {Interval}
   */
  static majorSeventh() {
    return new Interval('major', 7);
  }

  /**
   * Crée une septième mineure
   * @returns {Interval}
   */
  static minorSeventh() {
    return new Interval('minor', 7);
  }

  /**
   * Crée une octave juste
   * @returns {Interval}
   */
  static octave() {
    return new Interval('perfect', 8);
  }

  /**
   * Crée un triton (quarte augmentée / quinte diminuée)
   * @returns {Interval}
   */
  static tritone() {
    return new Interval('augmented', 4);
  }
}

export default Interval;
