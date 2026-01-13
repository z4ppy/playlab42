/**
 * Scale - Représentation d'une gamme musicale
 *
 * @module core/Scale
 */

import { Pitch } from './Pitch.js';

// ============================================================================
// Constantes
// ============================================================================

/**
 * Intervalles (en demi-tons) pour chaque type de gamme
 * @type {Object<string, number[]>}
 */
const SCALE_INTERVALS = {
  // Gammes majeures et mineures
  major: [0, 2, 4, 5, 7, 9, 11], // Majeure (ionien)
  minor: [0, 2, 3, 5, 7, 8, 10], // Mineure naturelle (éolien)
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11], // Mineure harmonique
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11], // Mineure mélodique (ascendante)

  // Modes
  ionian: [0, 2, 4, 5, 7, 9, 11], // Ionien (= majeur)
  dorian: [0, 2, 3, 5, 7, 9, 10], // Dorien
  phrygian: [0, 1, 3, 5, 7, 8, 10], // Phrygien
  lydian: [0, 2, 4, 6, 7, 9, 11], // Lydien
  mixolydian: [0, 2, 4, 5, 7, 9, 10], // Mixolydien
  aeolian: [0, 2, 3, 5, 7, 8, 10], // Éolien (= mineur naturel)
  locrian: [0, 1, 3, 5, 6, 8, 10], // Locrien

  // Gammes pentatoniques
  'pentatonic-major': [0, 2, 4, 7, 9], // Pentatonique majeure
  'pentatonic-minor': [0, 3, 5, 7, 10], // Pentatonique mineure
  blues: [0, 3, 5, 6, 7, 10], // Blues (pentatonique mineure + blue note)

  // Autres gammes
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Chromatique
  'whole-tone': [0, 2, 4, 6, 8, 10], // Par tons
  diminished: [0, 2, 3, 5, 6, 8, 9, 11], // Diminuée (ton-demi-ton)
  'diminished-half': [0, 1, 3, 4, 6, 7, 9, 10], // Diminuée (demi-ton-ton)
};

/**
 * Noms français des types de gammes
 * @type {Object<string, string>}
 */
const FRENCH_NAMES = {
  major: 'majeure',
  minor: 'mineure naturelle',
  'harmonic-minor': 'mineure harmonique',
  'melodic-minor': 'mineure mélodique',
  ionian: 'ionien',
  dorian: 'dorien',
  phrygian: 'phrygien',
  lydian: 'lydien',
  mixolydian: 'mixolydien',
  aeolian: 'éolien',
  locrian: 'locrien',
  'pentatonic-major': 'pentatonique majeure',
  'pentatonic-minor': 'pentatonique mineure',
  blues: 'blues',
  chromatic: 'chromatique',
  'whole-tone': 'par tons',
  diminished: 'diminuée',
  'diminished-half': 'diminuée (demi-ton)',
};

/**
 * Degrés avec leur nom en français
 * @type {Object<number, string>}
 */
const DEGREE_NAMES = {
  1: 'tonique',
  2: 'sutonique',
  3: 'médiante',
  4: 'sous-dominante',
  5: 'dominante',
  6: 'sus-dominante',
  7: 'sensible',
};

// ============================================================================
// Classe Scale
// ============================================================================

/**
 * Représente une gamme musicale
 *
 * @example
 * const doMajeur = new Scale(new Pitch(0, 4), 'major');
 * const laMineur = new Scale(new Pitch(5, 4), 'minor');
 */
export class Scale {
  /**
   * Crée une nouvelle gamme
   *
   * @param {Pitch} root - Tonique de la gamme
   * @param {string} type - Type de gamme
   */
  constructor(root, type) {
    if (!(type in SCALE_INTERVALS)) {
      throw new Error(`Type de gamme invalide: ${type}`);
    }

    /** @type {Pitch} Tonique */
    this.root = root;

    /** @type {string} Type de gamme */
    this.type = type;
  }

  // --------------------------------------------------------------------------
  // Propriétés
  // --------------------------------------------------------------------------

  /**
   * Nombre de notes dans la gamme
   * @returns {number}
   */
  get size() {
    return SCALE_INTERVALS[this.type].length;
  }

  /**
   * Intervalles de la gamme
   * @returns {number[]}
   */
  get intervals() {
    return [...SCALE_INTERVALS[this.type]];
  }

  // --------------------------------------------------------------------------
  // Notes de la gamme
  // --------------------------------------------------------------------------

  /**
   * Retourne toutes les notes de la gamme
   *
   * @param {number} octaves - Nombre d'octaves (défaut: 1)
   * @returns {Pitch[]} Notes de la gamme
   *
   * @example
   * const cMajor = new Scale(new Pitch(0, 4), 'major');
   * cMajor.getPitches() // [Do4, Ré4, Mi4, Fa4, Sol4, La4, Si4]
   */
  getPitches(octaves = 1) {
    const intervals = SCALE_INTERVALS[this.type];
    const rootMidi = this.root.toMidi();
    const pitches = [];

    for (let oct = 0; oct < octaves; oct++) {
      for (const interval of intervals) {
        pitches.push(Pitch.fromMidi(rootMidi + interval + oct * 12));
      }
    }

    return pitches;
  }

  /**
   * Retourne le degré n de la gamme (1-indexé)
   *
   * @param {number} degree - Numéro du degré (1-7 pour gamme heptatonique)
   * @param {number} octaveOffset - Décalage d'octave (0 = même octave que la tonique)
   * @returns {Pitch} Note du degré demandé
   *
   * @example
   * const cMajor = new Scale(new Pitch(0, 4), 'major');
   * cMajor.getDegree(3) // Mi4 (médiante)
   * cMajor.getDegree(5) // Sol4 (dominante)
   */
  getDegree(degree, octaveOffset = 0) {
    if (degree < 1 || degree > this.size) {
      throw new Error(
        `Degré invalide: ${degree} (doit être 1-${this.size})`,
      );
    }

    const interval = SCALE_INTERVALS[this.type][degree - 1];
    return Pitch.fromMidi(this.root.toMidi() + interval + octaveOffset * 12);
  }

  /**
   * Retourne le nom du degré
   *
   * @param {number} degree - Numéro du degré
   * @returns {string} Nom du degré en français
   */
  getDegreeName(degree) {
    return DEGREE_NAMES[degree] || `${degree}e degré`;
  }

  /**
   * Vérifie si une note appartient à la gamme
   *
   * @param {Pitch} pitch - Note à vérifier
   * @returns {boolean}
   */
  contains(pitch) {
    const intervals = SCALE_INTERVALS[this.type];
    const pitchSemitone = pitch.toMidi() % 12;
    const rootSemitone = this.root.toMidi() % 12;

    const relativeInterval = (pitchSemitone - rootSemitone + 12) % 12;
    return intervals.includes(relativeInterval);
  }

  /**
   * Retourne le degré d'une note dans la gamme
   *
   * @param {Pitch} pitch - Note à analyser
   * @returns {number|null} Numéro du degré (1-based) ou null si hors gamme
   */
  getDegreeOf(pitch) {
    const intervals = SCALE_INTERVALS[this.type];
    const pitchSemitone = pitch.toMidi() % 12;
    const rootSemitone = this.root.toMidi() % 12;

    const relativeInterval = (pitchSemitone - rootSemitone + 12) % 12;
    const index = intervals.indexOf(relativeInterval);

    return index !== -1 ? index + 1 : null;
  }

  // --------------------------------------------------------------------------
  // Conversions
  // --------------------------------------------------------------------------

  /**
   * Convertit en nom français
   *
   * @returns {string} Nom français (ex: "Do majeure", "La mineure harmonique")
   */
  toFrench() {
    const rootName = this.root.toFrench().slice(0, -1); // Enlever l'octave
    const typeName = FRENCH_NAMES[this.type];
    return `${rootName} ${typeName}`;
  }

  /**
   * Convertit en nom anglais
   *
   * @returns {string} Nom anglais (ex: "C major", "A harmonic minor")
   */
  toEnglish() {
    const rootName = this.root.toEnglish().slice(0, -1);
    const typeName = this.type.replace(/-/g, ' ');
    return `${rootName} ${typeName}`;
  }

  // --------------------------------------------------------------------------
  // Transformations
  // --------------------------------------------------------------------------

  /**
   * Transpose la gamme
   *
   * @param {number} semitones - Demi-tons de transposition
   * @returns {Scale} Nouvelle gamme transposée
   */
  transpose(semitones) {
    const newRoot = this.root.transpose(semitones);
    return new Scale(newRoot, this.type);
  }

  /**
   * Retourne la gamme relative (majeure ↔ mineure)
   *
   * @returns {Scale} Gamme relative
   */
  getRelative() {
    if (this.type === 'major') {
      // Relative mineure = 3 demi-tons plus bas
      const newRoot = this.root.transpose(-3);
      return new Scale(newRoot, 'minor');
    } else if (this.type === 'minor') {
      // Relative majeure = 3 demi-tons plus haut
      const newRoot = this.root.transpose(3);
      return new Scale(newRoot, 'major');
    }

    throw new Error(
      'La gamme relative n\'est définie que pour les gammes majeures et mineures',
    );
  }

  /**
   * Retourne la gamme parallèle (même tonique, mode différent)
   *
   * @returns {Scale} Gamme parallèle
   */
  getParallel() {
    if (this.type === 'major') {
      return new Scale(this.root, 'minor');
    } else if (this.type === 'minor') {
      return new Scale(this.root, 'major');
    }

    throw new Error(
      'La gamme parallèle n\'est définie que pour les gammes majeures et mineures',
    );
  }

  // --------------------------------------------------------------------------
  // Comparaison
  // --------------------------------------------------------------------------

  /**
   * Vérifie l'égalité avec une autre gamme
   *
   * @param {Scale} other - Autre gamme
   * @returns {boolean}
   */
  equals(other) {
    return this.root.equals(other.root) && this.type === other.type;
  }

  // --------------------------------------------------------------------------
  // Factory methods
  // --------------------------------------------------------------------------

  /**
   * Crée une gamme majeure
   *
   * @param {Pitch|string} root - Tonique
   * @returns {Scale}
   */
  static major(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Scale(pitch, 'major');
  }

  /**
   * Crée une gamme mineure naturelle
   *
   * @param {Pitch|string} root - Tonique
   * @returns {Scale}
   */
  static minor(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Scale(pitch, 'minor');
  }

  /**
   * Crée une gamme mineure harmonique
   *
   * @param {Pitch|string} root - Tonique
   * @returns {Scale}
   */
  static harmonicMinor(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Scale(pitch, 'harmonic-minor');
  }

  /**
   * Crée une gamme pentatonique majeure
   *
   * @param {Pitch|string} root - Tonique
   * @returns {Scale}
   */
  static pentatonicMajor(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Scale(pitch, 'pentatonic-major');
  }

  /**
   * Crée une gamme blues
   *
   * @param {Pitch|string} root - Tonique
   * @returns {Scale}
   */
  static blues(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Scale(pitch, 'blues');
  }

  /**
   * Retourne les types de gammes disponibles
   *
   * @returns {string[]}
   */
  static get types() {
    return Object.keys(SCALE_INTERVALS);
  }

  /**
   * Retourne les modes (gammes modales)
   *
   * @returns {string[]}
   */
  static get modes() {
    return [
      'ionian',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'aeolian',
      'locrian',
    ];
  }
}

export default Scale;
