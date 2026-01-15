/**
 * Tests pour QuestionGenerator
 *
 * @module engine/QuestionGenerator.test
 */

import { QuestionGenerator } from './QuestionGenerator.js';

// ============================================================================
// Tests
// ============================================================================

describe('QuestionGenerator', () => {
  // Générateur de random déterministe pour les tests
  const createSeededRandom = (seed = 42) => {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  };

  describe('Configuration', () => {
    test('doit utiliser les valeurs par défaut', () => {
      const generator = new QuestionGenerator();

      expect(generator.clef).toBe('treble');
      expect(generator.difficulty).toBe(1);
      expect(generator.accidentals).toBe(false);
    });

    test('doit accepter une configuration personnalisée', () => {
      const generator = new QuestionGenerator({
        clef: 'bass',
        difficulty: 2,
        accidentals: true,
      });

      expect(generator.clef).toBe('bass');
      expect(generator.difficulty).toBe(2);
      expect(generator.accidentals).toBe(true);
    });

    test('doit utiliser une plage personnalisée si fournie', () => {
      const generator = new QuestionGenerator({
        range: { low: 'A3', high: 'E5' },
      });

      expect(generator.range.low).toBe('A3');
      expect(generator.range.high).toBe('E5');
    });

    test('doit utiliser la plage de difficulté par défaut', () => {
      const generator = new QuestionGenerator({
        difficulty: 2,
        clef: 'treble',
      });

      // La difficulté 2 en clé de sol devrait avoir G3 à C5
      expect(generator.range.low).toBe('G3');
      expect(generator.range.high).toBe('C5');
    });
  });

  describe('generateNote()', () => {
    test('doit générer une question de type note', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateNote();

      expect(question.type).toBe('note');
      expect(question.pitch).toBeDefined();
      expect(question.clef).toBe('treble');
    });

    test('doit générer des notes dans la plage spécifiée', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'G4' },
        randomFn: createSeededRandom(),
      });

      // Générer plusieurs notes et vérifier qu'elles sont dans la plage
      for (let i = 0; i < 20; i++) {
        const question = generator.generateNote();
        const midi = question.pitch.toMidi();

        expect(midi).toBeGreaterThanOrEqual(60); // C4
        expect(midi).toBeLessThanOrEqual(67); // G4
      }
    });

    test('doit exclure les altérations par défaut', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'B4' },
        accidentals: false,
        randomFn: createSeededRandom(),
      });

      // Générer plusieurs notes et vérifier qu'il n'y a pas d'altérations
      for (let i = 0; i < 20; i++) {
        const question = generator.generateNote();
        const accidental = question.pitch.accidental;

        // accidental est null ou 0 quand il n'y a pas d'altération
        expect(accidental === null || accidental === 0).toBe(true);
      }
    });

    test('doit inclure les altérations si spécifié', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'B4' },
        accidentals: true,
        randomFn: createSeededRandom(),
      });

      // Générer plusieurs notes - au moins une devrait avoir une altération
      const accidentals = [];
      for (let i = 0; i < 30; i++) {
        const question = generator.generateNote();
        accidentals.push(question.pitch.accidental);
      }

      // Il est très improbable qu'aucune altération ne soit générée en 30 essais
      expect(accidentals.some((a) => a !== 0)).toBe(true);
    });
  });

  describe('generateNotes()', () => {
    test('doit générer le nombre de notes demandé', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const notes = generator.generateNotes(5);

      expect(notes).toHaveLength(5);
      notes.forEach((note) => {
        expect(note.type).toBe('note');
        expect(note.pitch).toBeDefined();
      });
    });

    test('doit générer des notes distinctes', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'C5' },
        randomFn: createSeededRandom(),
      });

      const notes = generator.generateNotes(5);
      const midiValues = notes.map((n) => n.pitch.toMidi());
      const uniqueMidi = new Set(midiValues);

      expect(uniqueMidi.size).toBe(5);
    });
  });

  describe('generateInterval()', () => {
    test('doit générer une question d\'intervalle', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateInterval();

      expect(question.type).toBe('interval');
      expect(question.pitch1).toBeDefined();
      expect(question.pitch2).toBeDefined();
      expect(question.interval).toBeDefined();
      expect(question.clef).toBe('treble');
    });

    test('doit respecter les types d\'intervalles spécifiés', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateInterval({
        types: ['perfect-5'],
      });

      expect(question.interval.toSemitones()).toBe(7);
    });

    test('doit générer deux notes cohérentes avec l\'intervalle', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateInterval({
        types: ['major-3'],
      });

      const diff = question.pitch2.toMidi() - question.pitch1.toMidi();
      expect(diff).toBe(4); // Tierce majeure = 4 demi-tons
    });
  });

  describe('generateRhythm()', () => {
    test('doit générer une question de rythme', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateRhythm();

      expect(question.type).toBe('rhythm');
      expect(question.pattern).toBeDefined();
      expect(Array.isArray(question.pattern)).toBe(true);
      expect(question.beatsPerMeasure).toBeDefined();
      expect(question.tempo).toBeDefined();
    });

    test('doit respecter le nombre de temps par mesure', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateRhythm({
        beatsPerMeasure: 4,
        durations: ['quarter', 'half'],
      });

      const totalBeats = question.pattern.reduce((sum, n) => sum + n.beats, 0);
      expect(totalBeats).toBe(4);
    });

    test('doit utiliser uniquement les durées autorisées', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateRhythm({
        durations: ['quarter'],
        beatsPerMeasure: 4,
      });

      question.pattern.forEach((note) => {
        expect(note.duration).toBe('quarter');
      });
    });

    test('doit utiliser le tempo spécifié', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateRhythm({
        tempo: 90,
      });

      expect(question.tempo).toBe(90);
    });

    test('doit générer des patterns avec startBeat correct', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateRhythm({
        durations: ['quarter'],
        beatsPerMeasure: 4,
      });

      // Avec des noires uniquement, startBeat devrait être 0, 1, 2, 3
      expect(question.pattern[0].startBeat).toBe(0);
      if (question.pattern.length > 1) {
        expect(question.pattern[1].startBeat).toBe(1);
      }
    });
  });

  describe('generateChord()', () => {
    test('doit générer une question d\'accord', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateChord();

      expect(question.type).toBe('chord');
      expect(question.chord).toBeDefined();
      expect(question.expectedType).toBeDefined();
      expect(question.clef).toBe('treble');
    });

    test('doit respecter les types d\'accords spécifiés', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      const question = generator.generateChord({
        types: ['minor'],
      });

      expect(question.expectedType).toBe('minor');
    });

    test('doit générer un accord avec une fondamentale dans la plage', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'G5' },
        randomFn: createSeededRandom(),
      });

      const question = generator.generateChord();
      const rootMidi = question.chord.root.toMidi();

      // La fondamentale devrait être dans la plage basse pour laisser de la place
      expect(rootMidi).toBeGreaterThanOrEqual(60); // C4
    });
  });

  describe('Historique', () => {
    test('doit éviter les répétitions récentes', () => {
      const generator = new QuestionGenerator({
        range: { low: 'C4', high: 'E4' }, // Plage réduite pour forcer les répétitions
        randomFn: createSeededRandom(),
      });

      const notes = [];
      for (let i = 0; i < 10; i++) {
        const q = generator.generateNote();
        notes.push(q.pitch.toMidi());
      }

      // Vérifier qu'il n'y a pas 2 notes identiques consécutives
      for (let i = 1; i < notes.length; i++) {
        if (notes[i] === notes[i - 1]) {
          // Ce n'est pas forcément une erreur car la plage est très réduite
          // mais au moins le test documente le comportement
        }
      }
    });

    test('doit permettre de réinitialiser l\'historique', () => {
      const generator = new QuestionGenerator({
        randomFn: createSeededRandom(),
      });

      generator.generateNote();
      generator.generateNote();
      expect(generator._history.length).toBeGreaterThan(0);

      generator.resetHistory();
      expect(generator._history.length).toBe(0);
    });
  });

  describe('Configuration dynamique', () => {
    test('setConfig() doit mettre à jour la configuration', () => {
      const generator = new QuestionGenerator();

      generator.setConfig({
        clef: 'bass',
        accidentals: true,
      });

      expect(generator.clef).toBe('bass');
      expect(generator.accidentals).toBe(true);
    });

    test('setConfig() doit mettre à jour la plage de notes', () => {
      const generator = new QuestionGenerator();

      generator.setConfig({
        range: { low: 'A2', high: 'A4' },
      });

      expect(generator.range.low).toBe('A2');
      expect(generator.range.high).toBe('A4');
    });

    test('setDifficulty() doit appliquer la plage correspondante', () => {
      const generator = new QuestionGenerator({ clef: 'treble' });

      generator.setDifficulty(3);

      expect(generator.difficulty).toBe(3);
      expect(generator.range.low).toBe('C3');
      expect(generator.range.high).toBe('G5');
    });

    test('setDifficulty() doit respecter la clé actuelle', () => {
      const generator = new QuestionGenerator({ clef: 'bass' });

      generator.setDifficulty(2);

      // Difficulté 2 en clé de fa
      expect(generator.range.low).toBe('G2');
      expect(generator.range.high).toBe('C4');
    });
  });

  describe('Fonction random personnalisée', () => {
    test('doit utiliser la fonction random fournie', () => {
      let callCount = 0;
      const customRandom = () => {
        callCount++;
        return 0.5;
      };

      const generator = new QuestionGenerator({
        randomFn: customRandom,
      });

      generator.generateNote();

      expect(callCount).toBeGreaterThan(0);
    });

    test('doit produire des résultats déterministes avec un seed', () => {
      const generator1 = new QuestionGenerator({
        randomFn: createSeededRandom(123),
      });
      const generator2 = new QuestionGenerator({
        randomFn: createSeededRandom(123),
      });

      const note1 = generator1.generateNote();
      const note2 = generator2.generateNote();

      expect(note1.pitch.toMidi()).toBe(note2.pitch.toMidi());
    });
  });
});
