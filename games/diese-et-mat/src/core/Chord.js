/**
 * Chord - Représentation d'un accord musical
 *
 * @module core/Chord
 */

import { Pitch } from './Pitch.js';

// ============================================================================
// Constantes
// ============================================================================

/**
 * Intervalles (en demi-tons depuis la fondamentale) pour chaque type d'accord
 * @type {Object<string, number[]>}
 */
const CHORD_INTERVALS = {
  // Triades
  major: [0, 4, 7], // Majeur
  minor: [0, 3, 7], // Mineur
  diminished: [0, 3, 6], // Diminué
  augmented: [0, 4, 8], // Augmenté
  sus2: [0, 2, 7], // Suspendu 2
  sus4: [0, 5, 7], // Suspendu 4

  // Accords de septième
  maj7: [0, 4, 7, 11], // Majeur 7
  min7: [0, 3, 7, 10], // Mineur 7
  dom7: [0, 4, 7, 10], // Dominante 7
  dim7: [0, 3, 6, 9], // Diminué 7
  'min7b5': [0, 3, 6, 10], // Demi-diminué (m7♭5)
  'minMaj7': [0, 3, 7, 11], // Mineur majeur 7
  'augMaj7': [0, 4, 8, 11], // Augmenté majeur 7

  // Accords de sixte
  maj6: [0, 4, 7, 9], // Majeur 6
  min6: [0, 3, 7, 9], // Mineur 6

  // Accords de neuvième (simplifié)
  '9': [0, 4, 7, 10, 14], // Dominante 9
  'maj9': [0, 4, 7, 11, 14], // Majeur 9
  'min9': [0, 3, 7, 10, 14], // Mineur 9
};

/**
 * Noms français des types d'accords
 * @type {Object<string, string>}
 */
const FRENCH_NAMES = {
  major: 'majeur',
  minor: 'mineur',
  diminished: 'diminué',
  augmented: 'augmenté',
  sus2: 'sus2',
  sus4: 'sus4',
  maj7: '7M',
  min7: '7m',
  dom7: '7',
  dim7: '7dim',
  'min7b5': 'm7♭5',
  'minMaj7': 'm(maj7)',
  'augMaj7': 'aug(maj7)',
  maj6: '6',
  min6: 'm6',
  '9': '9',
  'maj9': 'maj9',
  'min9': 'm9',
};

/**
 * Symboles pour la notation anglaise
 * @type {Object<string, string>}
 */
const CHORD_SYMBOLS = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  dim7: 'dim7',
  'min7b5': 'm7b5',
  'minMaj7': 'm(maj7)',
  'augMaj7': 'aug(maj7)',
  maj6: '6',
  min6: 'm6',
  '9': '9',
  'maj9': 'maj9',
  'min9': 'm9',
};

// ============================================================================
// Classe Chord
// ============================================================================

/**
 * Représente un accord musical
 *
 * @example
 * const doMajeur = new Chord(new Pitch(0, 4), 'major');
 * const lam7 = new Chord(new Pitch(5, 3), 'min7');
 */
export class Chord {
  /**
   * Crée un nouvel accord
   *
   * @param {Pitch} root - Fondamentale de l'accord
   * @param {string} type - Type d'accord (major, minor, dom7, etc.)
   * @param {number} inversion - Renversement (0 = état fondamental)
   */
  constructor(root, type, inversion = 0) {
    if (!(type in CHORD_INTERVALS)) {
      throw new Error(`Type d'accord invalide: ${type}`);
    }

    const maxInversion = CHORD_INTERVALS[type].length - 1;
    if (inversion < 0 || inversion > maxInversion) {
      throw new Error(
        `Renversement invalide: ${inversion} (max: ${maxInversion})`,
      );
    }

    /** @type {Pitch} Fondamentale */
    this.root = root;

    /** @type {string} Type d'accord */
    this.type = type;

    /** @type {number} Renversement */
    this.inversion = inversion;
  }

  // --------------------------------------------------------------------------
  // Propriétés
  // --------------------------------------------------------------------------

  /**
   * Nombre de notes dans l'accord
   * @returns {number}
   */
  get size() {
    return CHORD_INTERVALS[this.type].length;
  }

  /**
   * Vérifie si c'est une triade (3 notes)
   * @returns {boolean}
   */
  get isTriad() {
    return this.size === 3;
  }

  /**
   * Vérifie si c'est un accord de septième (4 notes)
   * @returns {boolean}
   */
  get isSeventh() {
    return this.size === 4;
  }

  // --------------------------------------------------------------------------
  // Notes de l'accord
  // --------------------------------------------------------------------------

  /**
   * Retourne les notes de l'accord
   *
   * @returns {Pitch[]} Notes de l'accord (avec renversement appliqué)
   *
   * @example
   * const cMajor = new Chord(new Pitch(0, 4), 'major');
   * cMajor.getPitches() // [Do4, Mi4, Sol4]
   */
  getPitches() {
    const intervals = CHORD_INTERVALS[this.type];
    const rootMidi = this.root.toMidi();

    // Générer les notes en position fondamentale
    const pitches = intervals.map((interval) =>
      Pitch.fromMidi(rootMidi + interval),
    );

    // Appliquer le renversement
    if (this.inversion > 0) {
      for (let i = 0; i < this.inversion; i++) {
        const note = pitches.shift();
        // Monter la note d'une octave
        pitches.push(Pitch.fromMidi(note.toMidi() + 12));
      }
    }

    return pitches;
  }

  /**
   * Retourne la basse de l'accord (note la plus grave)
   *
   * @returns {Pitch}
   */
  getBass() {
    return this.getPitches()[0];
  }

  /**
   * Retourne les intervalles depuis la fondamentale
   *
   * @returns {number[]} Intervalles en demi-tons
   */
  getIntervals() {
    return [...CHORD_INTERVALS[this.type]];
  }

  // --------------------------------------------------------------------------
  // Conversions
  // --------------------------------------------------------------------------

  /**
   * Convertit en nom français
   *
   * @returns {string} Nom français (ex: "Do majeur", "La mineur 7")
   */
  toFrench() {
    const rootName = this.root.toFrench().slice(0, -1); // Enlever l'octave
    const typeName = FRENCH_NAMES[this.type];

    let name = `${rootName} ${typeName}`;

    if (this.inversion > 0) {
      name += ` (${this.inversion}${this.inversion === 1 ? 'er' : 'e'} renversement)`;
    }

    return name;
  }

  /**
   * Convertit en symbole d'accord (notation anglaise)
   *
   * @returns {string} Symbole (ex: "C", "Am7", "G7")
   */
  toSymbol() {
    const rootName = this.root.toEnglish().slice(0, -1); // Enlever l'octave
    const symbol = CHORD_SYMBOLS[this.type];

    let name = `${rootName}${symbol}`;

    if (this.inversion > 0) {
      name += `/${this.getBass().toEnglish().slice(0, -1)}`;
    }

    return name;
  }

  /**
   * Convertit les notes en notation VexFlow
   *
   * @returns {string[]} Notes en format VexFlow
   */
  toVexFlow() {
    return this.getPitches().map((p) => p.toVexFlow());
  }

  /**
   * Convertit les notes en notation Tone.js
   *
   * @returns {string[]} Notes en format Tone.js
   */
  toTone() {
    return this.getPitches().map((p) => p.toTone());
  }

  // --------------------------------------------------------------------------
  // Transformations
  // --------------------------------------------------------------------------

  /**
   * Retourne l'accord au renversement suivant
   *
   * @returns {Chord} Nouvel accord renversé
   */
  nextInversion() {
    const maxInversion = this.size - 1;
    const newInversion = (this.inversion + 1) % (maxInversion + 1);
    return new Chord(this.root, this.type, newInversion);
  }

  /**
   * Retourne l'accord en position fondamentale
   *
   * @returns {Chord}
   */
  toRootPosition() {
    return new Chord(this.root, this.type, 0);
  }

  /**
   * Transpose l'accord
   *
   * @param {number} semitones - Demi-tons de transposition
   * @returns {Chord} Nouvel accord transposé
   */
  transpose(semitones) {
    const newRoot = this.root.transpose(semitones);
    return new Chord(newRoot, this.type, this.inversion);
  }

  // --------------------------------------------------------------------------
  // Comparaison
  // --------------------------------------------------------------------------

  /**
   * Vérifie l'égalité avec un autre accord
   *
   * @param {Chord} other - Autre accord
   * @returns {boolean}
   */
  equals(other) {
    return (
      this.root.equals(other.root) &&
      this.type === other.type &&
      this.inversion === other.inversion
    );
  }

  // --------------------------------------------------------------------------
  // Factory methods
  // --------------------------------------------------------------------------

  /**
   * Crée un accord majeur
   *
   * @param {Pitch|string} root - Fondamentale (Pitch ou string)
   * @returns {Chord}
   */
  static major(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Chord(pitch, 'major');
  }

  /**
   * Crée un accord mineur
   *
   * @param {Pitch|string} root - Fondamentale
   * @returns {Chord}
   */
  static minor(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Chord(pitch, 'minor');
  }

  /**
   * Crée un accord de dominante 7
   *
   * @param {Pitch|string} root - Fondamentale
   * @returns {Chord}
   */
  static dom7(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Chord(pitch, 'dom7');
  }

  /**
   * Crée un accord diminué
   *
   * @param {Pitch|string} root - Fondamentale
   * @returns {Chord}
   */
  static diminished(root) {
    const pitch = typeof root === 'string' ? Pitch.fromString(root) : root;
    return new Chord(pitch, 'diminished');
  }

  /**
   * Retourne les types d'accords disponibles
   *
   * @returns {string[]}
   */
  static get types() {
    return Object.keys(CHORD_INTERVALS);
  }

  /**
   * Retourne les types de triades
   *
   * @returns {string[]}
   */
  static get triadTypes() {
    return Object.keys(CHORD_INTERVALS).filter(
      (type) => CHORD_INTERVALS[type].length === 3,
    );
  }

  /**
   * Retourne les types d'accords de septième
   *
   * @returns {string[]}
   */
  static get seventhTypes() {
    return Object.keys(CHORD_INTERVALS).filter(
      (type) => CHORD_INTERVALS[type].length === 4,
    );
  }
}

export default Chord;
