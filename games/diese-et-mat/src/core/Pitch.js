/**
 * Pitch - Représentation d'une hauteur de note musicale
 *
 * @module core/Pitch
 */

// ============================================================================
// Constantes
// ============================================================================

/**
 * Noms des notes en notation française
 * @type {string[]}
 */
const FRENCH_NAMES = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

/**
 * Noms des notes en notation anglaise
 * @type {string[]}
 */
const ENGLISH_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Demi-tons depuis C pour chaque note naturelle
 * @type {number[]}
 */
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/**
 * Symboles des altérations
 * @type {Object<string, string>}
 */
const ACCIDENTAL_SYMBOLS = {
  'sharp': '♯',
  'flat': '♭',
  'natural': '♮',
  'double-sharp': '𝄪',
  'double-flat': '𝄫',
};

/**
 * Modification en demi-tons par altération
 * @type {Object<string, number>}
 */
const ACCIDENTAL_SEMITONES = {
  'sharp': 1,
  'flat': -1,
  'natural': 0,
  'double-sharp': 2,
  'double-flat': -2,
};

/**
 * Notation VexFlow pour les altérations
 * @type {Object<string, string>}
 */
const ACCIDENTAL_VEXFLOW = {
  'sharp': '#',
  'flat': 'b',
  'natural': 'n',
  'double-sharp': '##',
  'double-flat': 'bb',
};

/**
 * Fréquence de référence (La4 = 440 Hz)
 * @type {number}
 */
const A4_FREQUENCY = 440;

/**
 * Numéro MIDI du La4
 * @type {number}
 */
const A4_MIDI = 69;

// ============================================================================
// Classe Pitch
// ============================================================================

/**
 * Représente une hauteur de note musicale (pitch class + octave + altération)
 *
 * @example
 * const do4 = new Pitch(0, 4);           // Do4
 * const solDiese5 = new Pitch(4, 5, 'sharp'); // Sol#5
 */
export class Pitch {
  /**
   * Crée une nouvelle hauteur de note
   *
   * @param {number} pitchClass - Classe de hauteur (0=Do, 1=Ré, ..., 6=Si)
   * @param {number} octave - Numéro d'octave (4 = octave du La 440Hz)
   * @param {string|null} accidental - Altération: 'sharp', 'flat', 'natural', 'double-sharp', 'double-flat'
   */
  constructor(pitchClass, octave, accidental = null) {
    if (pitchClass < 0 || pitchClass > 6) {
      throw new Error(`PitchClass invalide: ${pitchClass} (doit être 0-6)`);
    }
    if (octave < 0 || octave > 9) {
      throw new Error(`Octave invalide: ${octave} (doit être 0-9)`);
    }
    if (accidental !== null && !(accidental in ACCIDENTAL_SEMITONES)) {
      throw new Error(`Altération invalide: ${accidental}`);
    }

    /** @type {number} Classe de hauteur (0-6) */
    this.pitchClass = pitchClass;

    /** @type {number} Octave (0-9) */
    this.octave = octave;

    /** @type {string|null} Altération */
    this.accidental = accidental;
  }

  // --------------------------------------------------------------------------
  // Conversions
  // --------------------------------------------------------------------------

  /**
   * Convertit en numéro MIDI (0-127)
   *
   * @returns {number} Numéro MIDI
   *
   * @example
   * new Pitch(0, 4).toMidi() // 60 (Do4)
   * new Pitch(5, 4).toMidi() // 69 (La4)
   */
  toMidi() {
    const baseMidi = (this.octave + 1) * 12 + SEMITONES[this.pitchClass];
    const accidentalOffset = this.accidental
      ? ACCIDENTAL_SEMITONES[this.accidental]
      : 0;
    return baseMidi + accidentalOffset;
  }

  /**
   * Convertit en fréquence (Hz)
   * Utilise le tempérament égal avec La4 = 440 Hz
   *
   * @returns {number} Fréquence en Hz
   *
   * @example
   * new Pitch(5, 4).toFrequency() // 440 (La4)
   * new Pitch(0, 4).toFrequency() // ~261.63 (Do4)
   */
  toFrequency() {
    const midi = this.toMidi();
    return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  /**
   * Convertit en notation française
   *
   * @returns {string} Nom en français (ex: "Do♯4", "Ré♭5")
   */
  toFrench() {
    const name = FRENCH_NAMES[this.pitchClass];
    const symbol = this.accidental ? ACCIDENTAL_SYMBOLS[this.accidental] : '';
    return `${name}${symbol}${this.octave}`;
  }

  /**
   * Convertit en notation anglaise
   *
   * @returns {string} Nom en anglais (ex: "C#4", "Db5")
   */
  toEnglish() {
    const name = ENGLISH_NAMES[this.pitchClass];
    const symbol = this.accidental ? ACCIDENTAL_VEXFLOW[this.accidental] : '';
    return `${name}${symbol}${this.octave}`;
  }

  /**
   * Convertit en notation VexFlow
   *
   * @returns {string} Format VexFlow (ex: "c#/4", "db/5")
   */
  toVexFlow() {
    const name = ENGLISH_NAMES[this.pitchClass].toLowerCase();
    const accidental = this.accidental
      ? ACCIDENTAL_VEXFLOW[this.accidental]
      : '';
    return `${name}${accidental}/${this.octave}`;
  }

  /**
   * Convertit en notation Tone.js
   *
   * @returns {string} Format Tone.js (ex: "C#4", "Db5")
   */
  toTone() {
    return this.toEnglish();
  }

  // --------------------------------------------------------------------------
  // Position sur la portée
  // --------------------------------------------------------------------------

  /**
   * Calcule la position sur la portée (en demi-interlignes depuis le Do central)
   *
   * @param {string} clef - Clé: 'treble' (sol) ou 'bass' (fa)
   * @returns {number} Position (0 = ligne du milieu de la portée)
   *
   * @example
   * // En clé de sol, le Si4 est sur la ligne du milieu
   * new Pitch(6, 4).getStaffPosition('treble') // 0
   */
  getStaffPosition(clef = 'treble') {
    // Position absolue depuis Do0
    const absolutePosition = this.octave * 7 + this.pitchClass;

    // Position de référence de la ligne du milieu
    // Clé de sol: Si4 (octave 4, pitchClass 6) = ligne du milieu
    // Clé de fa: Ré3 (octave 3, pitchClass 1) = ligne du milieu
    const referencePosition = clef === 'treble' ? 4 * 7 + 6 : 3 * 7 + 1;

    return absolutePosition - referencePosition;
  }

  // --------------------------------------------------------------------------
  // Comparaison
  // --------------------------------------------------------------------------

  /**
   * Vérifie l'égalité avec une autre hauteur
   *
   * @param {Pitch} other - Autre hauteur
   * @returns {boolean} true si identiques (même pitchClass, octave, altération)
   */
  equals(other) {
    return (
      this.pitchClass === other.pitchClass &&
      this.octave === other.octave &&
      this.accidental === other.accidental
    );
  }

  /**
   * Vérifie l'équivalence enharmonique
   *
   * @param {Pitch} other - Autre hauteur
   * @returns {boolean} true si même hauteur réelle (ex: Do# = Réb)
   */
  isEnharmonicWith(other) {
    return this.toMidi() === other.toMidi();
  }

  /**
   * Compare deux hauteurs
   *
   * @param {Pitch} other - Autre hauteur
   * @returns {number} -1 si this < other, 0 si égaux, 1 si this > other
   */
  compareTo(other) {
    const midiDiff = this.toMidi() - other.toMidi();
    if (midiDiff !== 0) {return Math.sign(midiDiff);}

    // Si même hauteur MIDI, comparer par notation (C# < Db)
    if (this.pitchClass !== other.pitchClass) {
      return this.pitchClass - other.pitchClass;
    }
    return 0;
  }

  // --------------------------------------------------------------------------
  // Transposition
  // --------------------------------------------------------------------------

  /**
   * Transpose la note d'un nombre de demi-tons
   *
   * @param {number} semitones - Nombre de demi-tons (positif = vers le haut)
   * @returns {Pitch} Nouvelle hauteur transposée
   */
  transpose(semitones) {
    return Pitch.fromMidi(this.toMidi() + semitones);
  }

  // --------------------------------------------------------------------------
  // Factory methods
  // --------------------------------------------------------------------------

  /**
   * Crée une hauteur depuis un numéro MIDI
   *
   * @param {number} midi - Numéro MIDI (0-127)
   * @returns {Pitch} Hauteur correspondante (note naturelle ou dièse)
   *
   * @example
   * Pitch.fromMidi(60) // Do4
   * Pitch.fromMidi(61) // Do#4
   */
  static fromMidi(midi) {
    if (midi < 0 || midi > 127) {
      throw new Error(`MIDI invalide: ${midi} (doit être 0-127)`);
    }

    const octave = Math.floor(midi / 12) - 1;
    const semitone = midi % 12;

    // Trouver la note naturelle ou utiliser un dièse
    const naturalIndex = SEMITONES.indexOf(semitone);
    if (naturalIndex !== -1) {
      return new Pitch(naturalIndex, octave, null);
    }

    // C'est une note altérée - utiliser le dièse de la note précédente
    const sharpIndex = SEMITONES.indexOf(semitone - 1);
    return new Pitch(sharpIndex, octave, 'sharp');
  }

  /**
   * Crée une hauteur depuis une chaîne
   *
   * @param {string} str - Notation (ex: "Do4", "C#5", "Réb3")
   * @returns {Pitch} Hauteur correspondante
   *
   * @example
   * Pitch.fromString('Do4')  // Do4
   * Pitch.fromString('C#5')  // Do#5
   * Pitch.fromString('Sib3') // Sib3
   */
  static fromString(str) {
    const normalized = str.trim();

    // Regex pour notation française (Do♯4, Ré4, Solb5, etc.)
    const frenchMatch = normalized.match(
      /^(Do|Ré|Re|Mi|Fa|Sol|La|Si)(♯|♭|#|b)?(\d)$/i,
    );
    if (frenchMatch) {
      const [, noteName, accidental, octave] = frenchMatch;
      const pitchClass = FRENCH_NAMES.findIndex(
        (n) => n.toLowerCase() === noteName.toLowerCase().replace('re', 'ré'),
      );

      // Handle "Re" without accent
      const finalPitchClass =
        pitchClass === -1 && noteName.toLowerCase() === 're' ? 1 : pitchClass;

      if (finalPitchClass === -1) {
        throw new Error(`Note invalide: ${noteName}`);
      }

      let acc = null;
      if (accidental === '♯' || accidental === '#') {acc = 'sharp';}
      if (accidental === '♭' || accidental === 'b') {acc = 'flat';}

      return new Pitch(finalPitchClass, parseInt(octave), acc);
    }

    // Regex pour notation anglaise (C#4, Db5, etc.)
    const englishMatch = normalized.match(/^([A-Ga-g])(##?|bb?|n)?(\d)$/);
    if (englishMatch) {
      const [, noteName, accidental, octave] = englishMatch;
      const pitchClass = ENGLISH_NAMES.indexOf(noteName.toUpperCase());

      if (pitchClass === -1) {
        throw new Error(`Note invalide: ${noteName}`);
      }

      let acc = null;
      if (accidental === '#') {acc = 'sharp';}
      if (accidental === '##') {acc = 'double-sharp';}
      if (accidental === 'b') {acc = 'flat';}
      if (accidental === 'bb') {acc = 'double-flat';}
      if (accidental === 'n') {acc = 'natural';}

      return new Pitch(pitchClass, parseInt(octave), acc);
    }

    throw new Error(`Format de note invalide: ${str}`);
  }

  /**
   * Crée une hauteur aléatoire dans une plage donnée
   *
   * @param {Pitch} low - Limite basse
   * @param {Pitch} high - Limite haute
   * @param {boolean} naturalOnly - Si true, uniquement notes naturelles
   * @param {function} randomFn - Fonction random (Math.random par défaut)
   * @returns {Pitch} Hauteur aléatoire
   */
  static random(low, high, naturalOnly = false, randomFn = Math.random) {
    const lowMidi = low.toMidi();
    const highMidi = high.toMidi();

    if (naturalOnly) {
      // Collecter toutes les notes naturelles dans la plage
      const naturals = [];
      for (let midi = lowMidi; midi <= highMidi; midi++) {
        const semitone = midi % 12;
        if (SEMITONES.includes(semitone)) {
          naturals.push(midi);
        }
      }
      if (naturals.length === 0) {
        throw new Error('Aucune note naturelle dans la plage');
      }
      const index = Math.floor(randomFn() * naturals.length);
      return Pitch.fromMidi(naturals[index]);
    }

    const midi = lowMidi + Math.floor(randomFn() * (highMidi - lowMidi + 1));
    return Pitch.fromMidi(midi);
  }

  // --------------------------------------------------------------------------
  // Utilitaires statiques
  // --------------------------------------------------------------------------

  /**
   * Retourne les noms français des notes
   * @returns {string[]}
   */
  static get frenchNames() {
    return [...FRENCH_NAMES];
  }

  /**
   * Retourne les noms anglais des notes
   * @returns {string[]}
   */
  static get englishNames() {
    return [...ENGLISH_NAMES];
  }

  /**
   * Vérifie si une note est naturelle (sans altération)
   * @returns {boolean}
   */
  isNatural() {
    return this.accidental === null || this.accidental === 'natural';
  }

  /**
   * Retourne la note sans altération
   * @returns {Pitch}
   */
  toNatural() {
    return new Pitch(this.pitchClass, this.octave, null);
  }
}

export default Pitch;
