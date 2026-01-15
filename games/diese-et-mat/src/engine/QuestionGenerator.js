/**
 * QuestionGenerator - Génération de questions pour les exercices
 *
 * Génère des questions variées en évitant les répétitions et
 * en respectant les contraintes de difficulté.
 *
 * @module engine/QuestionGenerator
 */

import { Pitch } from '../core/Pitch.js';
import { Interval } from '../core/Interval.js';
import { Chord } from '../core/Chord.js';

// ============================================================================
// Constantes
// ============================================================================

/** Historique maximum pour éviter les répétitions */
const MAX_HISTORY = 5;

/** Plages de notes par clé */
const NOTE_RANGES = {
  treble: { low: 'C4', high: 'G5' },
  bass: { low: 'E2', high: 'C4' },
};

/** Plages par niveau de difficulté */
const DIFFICULTY_RANGES = {
  1: { treble: { low: 'C4', high: 'G4' }, bass: { low: 'C3', high: 'G3' } },
  2: { treble: { low: 'G3', high: 'C5' }, bass: { low: 'G2', high: 'C4' } },
  3: { treble: { low: 'C3', high: 'G5' }, bass: { low: 'E2', high: 'G4' } },
};

// ============================================================================
// Classe QuestionGenerator
// ============================================================================

/**
 * Générateur de questions pour les exercices
 */
export class QuestionGenerator {
  /**
   * Crée un nouveau générateur
   *
   * @param {Object} config - Configuration de l'exercice
   * @param {string} config.clef - Clé (treble/bass)
   * @param {Object} config.range - Plage de notes { low, high }
   * @param {boolean} config.accidentals - Inclure les altérations
   * @param {number} config.difficulty - Niveau de difficulté (1-3)
   * @param {Function} config.randomFn - Fonction random (optionnel)
   */
  constructor(config = {}) {
    /** @type {string} Clé musicale */
    this.clef = config.clef || 'treble';

    /** @type {number} Niveau de difficulté */
    this.difficulty = config.difficulty || 1;

    /** @type {Object} Plage de notes - utilise DIFFICULTY_RANGES si pas de range explicite */
    this.range = config.range ||
      DIFFICULTY_RANGES[this.difficulty]?.[this.clef] ||
      NOTE_RANGES[this.clef];

    /** @type {boolean} Inclure les altérations */
    this.accidentals = config.accidentals || false;

    /** @type {Function} Fonction random */
    this.randomFn = config.randomFn || Math.random;

    /** @type {Array} Historique des dernières questions */
    this._history = [];

    // Calculer les bornes MIDI
    this._lowPitch = Pitch.fromString(this.range.low);
    this._highPitch = Pitch.fromString(this.range.high);
  }

  // --------------------------------------------------------------------------
  // Génération de notes
  // --------------------------------------------------------------------------

  /**
   * Génère une note aléatoire
   *
   * @returns {{ type: string, pitch: Pitch }}
   */
  generateNote() {
    let pitch;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      pitch = Pitch.random(
        this._lowPitch,
        this._highPitch,
        !this.accidentals,
        this.randomFn,
      );
      attempts++;
    } while (this._isInHistory(pitch) && attempts < maxAttempts);

    this._addToHistory(pitch);

    return {
      type: 'note',
      pitch,
      clef: this.clef,
    };
  }

  /**
   * Génère plusieurs notes distinctes
   *
   * @param {number} count - Nombre de notes
   * @returns {Array<{ type: string, pitch: Pitch }>}
   */
  generateNotes(count) {
    const notes = [];
    const usedMidi = new Set();

    for (let i = 0; i < count; i++) {
      let pitch;
      let attempts = 0;

      do {
        pitch = Pitch.random(
          this._lowPitch,
          this._highPitch,
          !this.accidentals,
          this.randomFn,
        );
        attempts++;
      } while (usedMidi.has(pitch.toMidi()) && attempts < 50);

      usedMidi.add(pitch.toMidi());
      notes.push({ type: 'note', pitch, clef: this.clef });
    }

    return notes;
  }

  // --------------------------------------------------------------------------
  // Génération d'intervalles
  // --------------------------------------------------------------------------

  /**
   * Génère une question d'intervalle
   *
   * @param {Object} options - Options
   * @param {string[]} options.types - Types d'intervalles autorisés
   * @returns {{ type: string, pitch1: Pitch, pitch2: Pitch, interval: Interval }}
   */
  generateInterval(options = {}) {
    const allowedIntervals = options.types || [
      'minor-2',
      'major-2',
      'minor-3',
      'major-3',
      'perfect-4',
      'perfect-5',
    ];

    // Choisir un intervalle aléatoire
    const intervalType =
      allowedIntervals[Math.floor(this.randomFn() * allowedIntervals.length)];
    const interval = this._createInterval(intervalType);

    // Générer la première note
    const maxMidi = this._highPitch.toMidi() - interval.toSemitones();
    const adjustedHigh = Pitch.fromMidi(
      Math.max(maxMidi, this._lowPitch.toMidi()),
    );
    const pitch1 = Pitch.random(
      this._lowPitch,
      adjustedHigh,
      true,
      this.randomFn,
    );

    // Calculer la deuxième note
    const pitch2 = interval.apply(pitch1);

    return {
      type: 'interval',
      pitch1,
      pitch2,
      interval,
      clef: this.clef,
    };
  }

  /**
   * Crée un intervalle depuis son type
   * @private
   */
  _createInterval(type) {
    const [quality, number] = type.split('-');
    const qualityMap = {
      minor: 'minor',
      major: 'major',
      perfect: 'perfect',
      augmented: 'augmented',
      diminished: 'diminished',
    };
    return new Interval(qualityMap[quality], parseInt(number));
  }

  // --------------------------------------------------------------------------
  // Génération de rythmes
  // --------------------------------------------------------------------------

  /**
   * Génère une question de rythme
   *
   * @param {Object} options - Options
   * @param {string[]} options.durations - Durées autorisées ('whole', 'half', 'quarter', 'eighth')
   * @param {number} options.beatsPerMeasure - Nombre de temps par mesure
   * @returns {{ type: string, pattern: Object[], beatsPerMeasure: number, tempo: number }}
   */
  generateRhythm(options = {}) {
    const allowedDurations = options.durations || ['quarter', 'half'];
    const beatsPerMeasure = options.beatsPerMeasure || 4;
    const tempo = options.tempo || 60;

    // Valeurs en beats pour chaque durée
    const durationValues = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
    };

    // Générer un pattern rythmique qui remplit la mesure
    const pattern = [];
    let remainingBeats = beatsPerMeasure;

    while (remainingBeats > 0) {
      // Filtrer les durées qui rentrent dans l'espace restant
      const validDurations = allowedDurations.filter(
        (d) => durationValues[d] <= remainingBeats,
      );

      if (validDurations.length === 0) {break;}

      // Choisir une durée aléatoire
      const duration =
        validDurations[Math.floor(this.randomFn() * validDurations.length)];
      const beats = durationValues[duration];

      pattern.push({
        duration,
        beats,
        startBeat: beatsPerMeasure - remainingBeats,
      });

      remainingBeats -= beats;
    }

    return {
      type: 'rhythm',
      pattern,
      beatsPerMeasure,
      tempo,
    };
  }

  // --------------------------------------------------------------------------
  // Génération d'accords
  // --------------------------------------------------------------------------

  /**
   * Génère une question d'accord
   *
   * @param {Object} options - Options
   * @param {string[]} options.types - Types d'accords autorisés
   * @returns {{ type: string, chord: Chord, expectedType: string }}
   */
  generateChord(options = {}) {
    const allowedTypes = options.types || ['major', 'minor'];

    // Choisir un type aléatoire
    const chordType =
      allowedTypes[Math.floor(this.randomFn() * allowedTypes.length)];

    // Générer la fondamentale (dans une plage réduite)
    const lowMidi = this._lowPitch.toMidi();
    const highMidi = this._highPitch.toMidi() - 12; // Laisser de la place pour l'accord
    const rootMidi =
      lowMidi + Math.floor(this.randomFn() * (highMidi - lowMidi + 1));
    const root = Pitch.fromMidi(rootMidi);

    const chord = new Chord(root, chordType);

    return {
      type: 'chord',
      chord,
      expectedType: chordType,
      clef: this.clef,
    };
  }

  // --------------------------------------------------------------------------
  // Historique
  // --------------------------------------------------------------------------

  /**
   * Vérifie si une note est dans l'historique récent
   * @private
   */
  _isInHistory(pitch) {
    return this._history.some((p) => p.toMidi() === pitch.toMidi());
  }

  /**
   * Ajoute une note à l'historique
   * @private
   */
  _addToHistory(pitch) {
    this._history.push(pitch);
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }
  }

  /**
   * Réinitialise l'historique
   */
  resetHistory() {
    this._history = [];
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Met à jour la configuration
   *
   * @param {Object} config - Nouvelle configuration
   */
  setConfig(config) {
    if (config.clef) {
      this.clef = config.clef;
    }
    if (config.range) {
      this.range = config.range;
      this._lowPitch = Pitch.fromString(this.range.low);
      this._highPitch = Pitch.fromString(this.range.high);
    }
    if (typeof config.accidentals === 'boolean') {
      this.accidentals = config.accidentals;
    }
    if (config.difficulty) {
      this.difficulty = config.difficulty;
    }
  }

  /**
   * Applique une difficulté prédéfinie
   *
   * @param {number} level - Niveau (1-3)
   */
  setDifficulty(level) {
    this.difficulty = level;

    if (DIFFICULTY_RANGES[level]) {
      this.range = DIFFICULTY_RANGES[level][this.clef];
      this._lowPitch = Pitch.fromString(this.range.low);
      this._highPitch = Pitch.fromString(this.range.high);
    }
  }
}

export default QuestionGenerator;
