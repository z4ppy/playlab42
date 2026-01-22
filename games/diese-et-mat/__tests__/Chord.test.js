/**
 * Tests unitaires pour Chord
 *
 * @module __tests__/Chord.test
 */

import { Chord } from '../src/core/Chord.js';
import { Pitch } from '../src/core/Pitch.js';

describe('Chord', () => {
  describe('Constructeur', () => {
    test('crée un accord valide', () => {
      const root = new Pitch(0, 4);
      const chord = new Chord(root, 'major');
      expect(chord.root).toBe(root);
      expect(chord.type).toBe('major');
      expect(chord.inversion).toBe(0);
    });

    test('crée un accord avec renversement', () => {
      const root = new Pitch(0, 4);
      const chord = new Chord(root, 'major', 1);
      expect(chord.inversion).toBe(1);
    });

    test("rejette un type d'accord invalide", () => {
      const root = new Pitch(0, 4);
      expect(() => new Chord(root, 'invalid')).toThrow(
        "Type d'accord invalide",
      );
    });

    test('rejette un renversement invalide', () => {
      const root = new Pitch(0, 4);
      expect(() => new Chord(root, 'major', 3)).toThrow('Renversement invalide');
      expect(() => new Chord(root, 'major', -1)).toThrow(
        'Renversement invalide',
      );
    });
  });

  describe('Propriétés', () => {
    test('size retourne le nombre de notes', () => {
      const root = new Pitch(0, 4);
      expect(new Chord(root, 'major').size).toBe(3);
      expect(new Chord(root, 'dom7').size).toBe(4);
      expect(new Chord(root, '9').size).toBe(5);
    });

    test('isTriad détecte les triades', () => {
      const root = new Pitch(0, 4);
      expect(new Chord(root, 'major').isTriad).toBe(true);
      expect(new Chord(root, 'dom7').isTriad).toBe(false);
    });

    test('isSeventh détecte les accords de 7e', () => {
      const root = new Pitch(0, 4);
      expect(new Chord(root, 'dom7').isSeventh).toBe(true);
      expect(new Chord(root, 'major').isSeventh).toBe(false);
    });
  });

  describe('getPitches()', () => {
    test('Do majeur = Do Mi Sol', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      const pitches = chord.getPitches();

      expect(pitches.length).toBe(3);
      expect(pitches[0].toEnglish()).toBe('C4');
      expect(pitches[1].toEnglish()).toBe('E4');
      expect(pitches[2].toEnglish()).toBe('G4');
    });

    test('La mineur = La Do Mi', () => {
      const chord = new Chord(new Pitch(5, 4), 'minor');
      const pitches = chord.getPitches();

      expect(pitches[0].toMidi()).toBe(69); // La4
      expect(pitches[1].toMidi()).toBe(72); // Do5
      expect(pitches[2].toMidi()).toBe(76); // Mi5
    });

    test('Sol7 = Sol Si Ré Fa', () => {
      const chord = new Chord(new Pitch(4, 4), 'dom7');
      const pitches = chord.getPitches();

      expect(pitches.length).toBe(4);
      expect(pitches[0].toEnglish()).toBe('G4');
      expect(pitches[3].toMidi()).toBe(77); // Fa5
    });

    test('Do majeur 1er renversement = Mi Sol Do', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 1);
      const pitches = chord.getPitches();

      expect(pitches[0].toEnglish()).toBe('E4');
      expect(pitches[1].toEnglish()).toBe('G4');
      expect(pitches[2].toEnglish()).toBe('C5');
    });

    test('Do majeur 2e renversement = Sol Do Mi', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 2);
      const pitches = chord.getPitches();

      expect(pitches[0].toEnglish()).toBe('G4');
      expect(pitches[1].toEnglish()).toBe('C5');
      expect(pitches[2].toEnglish()).toBe('E5');
    });
  });

  describe('getBass()', () => {
    test('retourne la fondamentale en position fondamentale', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.getBass().toEnglish()).toBe('C4');
    });

    test('retourne la tierce au 1er renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 1);
      expect(chord.getBass().toEnglish()).toBe('E4');
    });
  });

  describe('getIntervals()', () => {
    test('majeur = [0, 4, 7]', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.getIntervals()).toEqual([0, 4, 7]);
    });

    test('mineur = [0, 3, 7]', () => {
      const chord = new Chord(new Pitch(0, 4), 'minor');
      expect(chord.getIntervals()).toEqual([0, 3, 7]);
    });

    test('dom7 = [0, 4, 7, 10]', () => {
      const chord = new Chord(new Pitch(0, 4), 'dom7');
      expect(chord.getIntervals()).toEqual([0, 4, 7, 10]);
    });
  });

  describe('toFrench()', () => {
    test('Do majeur', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.toFrench()).toBe('Do majeur');
    });

    test('La mineur', () => {
      const chord = new Chord(new Pitch(5, 4), 'minor');
      expect(chord.toFrench()).toBe('La mineur');
    });

    test('Sol7', () => {
      const chord = new Chord(new Pitch(4, 4), 'dom7');
      expect(chord.toFrench()).toBe('Sol 7');
    });

    test('Do majeur 1er renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 1);
      expect(chord.toFrench()).toBe('Do majeur (1er renversement)');
    });

    test('Do majeur 2e renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 2);
      expect(chord.toFrench()).toBe('Do majeur (2e renversement)');
    });
  });

  describe('toSymbol()', () => {
    test('C pour Do majeur', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.toSymbol()).toBe('C');
    });

    test('Am pour La mineur', () => {
      const chord = new Chord(new Pitch(5, 4), 'minor');
      expect(chord.toSymbol()).toBe('Am');
    });

    test('G7 pour Sol dominante 7', () => {
      const chord = new Chord(new Pitch(4, 4), 'dom7');
      expect(chord.toSymbol()).toBe('G7');
    });

    test('C/E pour Do majeur 1er renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 1);
      expect(chord.toSymbol()).toBe('C/E');
    });
  });

  describe('toVexFlow()', () => {
    test('retourne les notes en format VexFlow', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.toVexFlow()).toEqual(['c/4', 'e/4', 'g/4']);
    });
  });

  describe('toTone()', () => {
    test('retourne les notes en format Tone.js', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      expect(chord.toTone()).toEqual(['C4', 'E4', 'G4']);
    });
  });

  describe('nextInversion()', () => {
    test('passe du fondamental au 1er renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      const next = chord.nextInversion();
      expect(next.inversion).toBe(1);
    });

    test('revient au fondamental après le dernier renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 2);
      const next = chord.nextInversion();
      expect(next.inversion).toBe(0);
    });
  });

  describe('toRootPosition()', () => {
    test('retourne en position fondamentale', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 2);
      const root = chord.toRootPosition();
      expect(root.inversion).toBe(0);
    });
  });

  describe('transpose()', () => {
    test("transpose d'un demi-ton", () => {
      const chord = new Chord(new Pitch(0, 4), 'major');
      const transposed = chord.transpose(1);
      expect(transposed.root.toEnglish()).toBe('C#4');
      expect(transposed.type).toBe('major');
    });

    test('préserve le renversement', () => {
      const chord = new Chord(new Pitch(0, 4), 'major', 1);
      const transposed = chord.transpose(2);
      expect(transposed.inversion).toBe(1);
    });
  });

  describe('equals()', () => {
    test('deux accords identiques sont égaux', () => {
      const c1 = new Chord(new Pitch(0, 4), 'major');
      const c2 = new Chord(new Pitch(0, 4), 'major');
      expect(c1.equals(c2)).toBe(true);
    });

    test('accords différents ne sont pas égaux', () => {
      const c1 = new Chord(new Pitch(0, 4), 'major');
      const c2 = new Chord(new Pitch(0, 4), 'minor');
      expect(c1.equals(c2)).toBe(false);
    });

    test('même accord avec renversement différent ne sont pas égaux', () => {
      const c1 = new Chord(new Pitch(0, 4), 'major');
      const c2 = new Chord(new Pitch(0, 4), 'major', 1);
      expect(c1.equals(c2)).toBe(false);
    });
  });

  describe('Factory methods', () => {
    test('Chord.major() crée un accord majeur', () => {
      const chord = Chord.major(new Pitch(0, 4));
      expect(chord.type).toBe('major');
    });

    test('Chord.minor() crée un accord mineur', () => {
      const chord = Chord.minor('A4');
      expect(chord.type).toBe('minor');
      expect(chord.root.pitchClass).toBe(5);
    });

    test('Chord.dom7() crée un accord de dominante 7', () => {
      const chord = Chord.dom7('G4');
      expect(chord.type).toBe('dom7');
    });

    test('Chord.diminished() crée un accord diminué', () => {
      const chord = Chord.diminished('B4');
      expect(chord.type).toBe('diminished');
    });
  });

  describe('Propriétés statiques', () => {
    test('types retourne tous les types', () => {
      const types = Chord.types;
      expect(types).toContain('major');
      expect(types).toContain('minor');
      expect(types).toContain('dom7');
    });

    test('triadTypes retourne les triades', () => {
      const types = Chord.triadTypes;
      expect(types).toContain('major');
      expect(types).toContain('minor');
      expect(types).not.toContain('dom7');
    });

    test('seventhTypes retourne les accords de 7e', () => {
      const types = Chord.seventhTypes;
      expect(types).toContain('dom7');
      expect(types).toContain('maj7');
      expect(types).not.toContain('major');
    });
  });
});
