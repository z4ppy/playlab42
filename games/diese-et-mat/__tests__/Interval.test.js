/**
 * Tests unitaires pour Interval
 *
 * @module __tests__/Interval.test
 */

import { Interval } from '../src/core/Interval.js';
import { Pitch } from '../src/core/Pitch.js';

describe('Interval', () => {
  describe('Constructeur', () => {
    test('crée un intervalle valide', () => {
      const interval = new Interval('major', 3);
      expect(interval.quality).toBe('major');
      expect(interval.number).toBe(3);
    });

    test('crée un intervalle parfait valide', () => {
      const interval = new Interval('perfect', 5);
      expect(interval.quality).toBe('perfect');
      expect(interval.number).toBe(5);
    });

    test('rejette une qualité invalide', () => {
      expect(() => new Interval('invalid', 3)).toThrow(
        "Qualité d'intervalle invalide",
      );
    });

    test('rejette un numéro invalide', () => {
      expect(() => new Interval('major', 0)).toThrow(
        "Numéro d'intervalle invalide",
      );
    });

    test('rejette perfect pour les intervalles non-parfaits', () => {
      expect(() => new Interval('perfect', 3)).toThrow(
        'ne peut pas être perfect',
      );
    });

    test('rejette major/minor pour les intervalles parfaits', () => {
      expect(() => new Interval('major', 5)).toThrow('ne peut pas être major');
      expect(() => new Interval('minor', 4)).toThrow('ne peut pas être minor');
    });
  });

  describe('Propriétés calculées', () => {
    test('simpleNumber retourne le numéro simple', () => {
      expect(new Interval('perfect', 8).simpleNumber).toBe(8);
      expect(new Interval('major', 9).simpleNumber).toBe(2);
      expect(new Interval('major', 10).simpleNumber).toBe(3);
    });

    test('isCompound détecte les intervalles composés', () => {
      expect(new Interval('major', 3).isCompound).toBe(false);
      expect(new Interval('major', 9).isCompound).toBe(true);
    });
  });

  describe('toSemitones()', () => {
    describe('intervalles simples', () => {
      test('unisson juste = 0 demi-tons', () => {
        expect(new Interval('perfect', 1).toSemitones()).toBe(0);
      });

      test('seconde mineure = 1 demi-ton', () => {
        expect(new Interval('minor', 2).toSemitones()).toBe(1);
      });

      test('seconde majeure = 2 demi-tons', () => {
        expect(new Interval('major', 2).toSemitones()).toBe(2);
      });

      test('tierce mineure = 3 demi-tons', () => {
        expect(new Interval('minor', 3).toSemitones()).toBe(3);
      });

      test('tierce majeure = 4 demi-tons', () => {
        expect(new Interval('major', 3).toSemitones()).toBe(4);
      });

      test('quarte juste = 5 demi-tons', () => {
        expect(new Interval('perfect', 4).toSemitones()).toBe(5);
      });

      test('quinte juste = 7 demi-tons', () => {
        expect(new Interval('perfect', 5).toSemitones()).toBe(7);
      });

      test('sixte mineure = 8 demi-tons', () => {
        expect(new Interval('minor', 6).toSemitones()).toBe(8);
      });

      test('sixte majeure = 9 demi-tons', () => {
        expect(new Interval('major', 6).toSemitones()).toBe(9);
      });

      test('septième mineure = 10 demi-tons', () => {
        expect(new Interval('minor', 7).toSemitones()).toBe(10);
      });

      test('septième majeure = 11 demi-tons', () => {
        expect(new Interval('major', 7).toSemitones()).toBe(11);
      });

      test('octave juste = 12 demi-tons', () => {
        expect(new Interval('perfect', 8).toSemitones()).toBe(12);
      });
    });

    describe('intervalles augmentés et diminués', () => {
      test('quarte augmentée (triton) = 6 demi-tons', () => {
        expect(new Interval('augmented', 4).toSemitones()).toBe(6);
      });

      test('quinte diminuée = 6 demi-tons', () => {
        expect(new Interval('diminished', 5).toSemitones()).toBe(6);
      });

      test('tierce diminuée = 2 demi-tons', () => {
        expect(new Interval('diminished', 3).toSemitones()).toBe(2);
      });

      test('tierce augmentée = 5 demi-tons', () => {
        expect(new Interval('augmented', 3).toSemitones()).toBe(5);
      });
    });

    describe('intervalles composés', () => {
      test('neuvième majeure = 14 demi-tons (12 + 2)', () => {
        expect(new Interval('major', 9).toSemitones()).toBe(14);
      });

      test('dixième majeure = 16 demi-tons (12 + 4)', () => {
        expect(new Interval('major', 10).toSemitones()).toBe(16);
      });
    });
  });

  describe('toFrench()', () => {
    test('tierce majeure', () => {
      expect(new Interval('major', 3).toFrench()).toBe('tierce majeure');
    });

    test('quinte juste', () => {
      expect(new Interval('perfect', 5).toFrench()).toBe('quinte juste');
    });

    test('seconde mineure', () => {
      expect(new Interval('minor', 2).toFrench()).toBe('seconde mineure');
    });

    test('quarte augmentée', () => {
      expect(new Interval('augmented', 4).toFrench()).toBe('quarte augmentée');
    });

    test('intervalle composé', () => {
      expect(new Interval('major', 9).toFrench()).toBe(
        'seconde majeure (+1 octave)',
      );
    });
  });

  describe('toAbbrev()', () => {
    test('tierce majeure = M3', () => {
      expect(new Interval('major', 3).toAbbrev()).toBe('M3');
    });

    test('quinte juste = P5', () => {
      expect(new Interval('perfect', 5).toAbbrev()).toBe('P5');
    });

    test('tierce mineure = m3', () => {
      expect(new Interval('minor', 3).toAbbrev()).toBe('m3');
    });

    test('quarte augmentée = A4', () => {
      expect(new Interval('augmented', 4).toAbbrev()).toBe('A4');
    });
  });

  describe('apply()', () => {
    test('tierce majeure vers le haut', () => {
      const c4 = new Pitch(0, 4);
      const result = new Interval('major', 3).apply(c4, 'up');
      expect(result.toMidi()).toBe(64); // Mi4
    });

    test('tierce majeure vers le bas', () => {
      const e4 = new Pitch(2, 4);
      const result = new Interval('major', 3).apply(e4, 'down');
      expect(result.toMidi()).toBe(60); // Do4
    });

    test('quinte juste vers le haut', () => {
      const c4 = new Pitch(0, 4);
      const result = new Interval('perfect', 5).apply(c4);
      expect(result.toMidi()).toBe(67); // Sol4
    });
  });

  describe('invert()', () => {
    test('tierce majeure → sixte mineure', () => {
      const inverted = new Interval('major', 3).invert();
      expect(inverted.quality).toBe('minor');
      expect(inverted.number).toBe(6);
    });

    test('quinte juste → quarte juste', () => {
      const inverted = new Interval('perfect', 5).invert();
      expect(inverted.quality).toBe('perfect');
      expect(inverted.number).toBe(4);
    });

    test('seconde mineure → septième majeure', () => {
      const inverted = new Interval('minor', 2).invert();
      expect(inverted.quality).toBe('major');
      expect(inverted.number).toBe(7);
    });

    test('quarte augmentée → quinte diminuée', () => {
      const inverted = new Interval('augmented', 4).invert();
      expect(inverted.quality).toBe('diminished');
      expect(inverted.number).toBe(5);
    });

    test("rejette l'inversion d'intervalles composés", () => {
      expect(() => new Interval('major', 9).invert()).toThrow(
        "L'inversion n'est définie que pour les intervalles simples",
      );
    });
  });

  describe('equals()', () => {
    test('deux intervalles identiques sont égaux', () => {
      const i1 = new Interval('major', 3);
      const i2 = new Interval('major', 3);
      expect(i1.equals(i2)).toBe(true);
    });

    test('intervalles différents ne sont pas égaux', () => {
      const i1 = new Interval('major', 3);
      const i2 = new Interval('minor', 3);
      expect(i1.equals(i2)).toBe(false);
    });
  });

  describe('compareTo()', () => {
    test('intervalle plus petit retourne -1', () => {
      const third = new Interval('major', 3);
      const fifth = new Interval('perfect', 5);
      expect(third.compareTo(fifth)).toBe(-1);
    });

    test('intervalle plus grand retourne 1', () => {
      const fifth = new Interval('perfect', 5);
      const third = new Interval('major', 3);
      expect(fifth.compareTo(third)).toBe(1);
    });
  });

  describe('Interval.between()', () => {
    test('Do4 → Mi4 = tierce majeure', () => {
      const c4 = new Pitch(0, 4);
      const e4 = new Pitch(2, 4);
      const interval = Interval.between(c4, e4);
      expect(interval.quality).toBe('major');
      expect(interval.number).toBe(3);
    });

    test('Do4 → Sol4 = quinte juste', () => {
      const c4 = new Pitch(0, 4);
      const g4 = new Pitch(4, 4);
      const interval = Interval.between(c4, g4);
      expect(interval.quality).toBe('perfect');
      expect(interval.number).toBe(5);
    });

    test('Do4 → Do4 = unisson juste', () => {
      const c4 = new Pitch(0, 4);
      const interval = Interval.between(c4, c4);
      expect(interval.quality).toBe('perfect');
      expect(interval.number).toBe(1);
    });

    test('Do4 → Mib4 = tierce mineure', () => {
      const c4 = new Pitch(0, 4);
      const eb4 = new Pitch(2, 4, 'flat');
      const interval = Interval.between(c4, eb4);
      expect(interval.quality).toBe('minor');
      expect(interval.number).toBe(3);
    });
  });

  describe('Factory methods', () => {
    test('unison() crée un unisson juste', () => {
      const interval = Interval.unison();
      expect(interval.quality).toBe('perfect');
      expect(interval.number).toBe(1);
    });

    test('majorThird() crée une tierce majeure', () => {
      const interval = Interval.majorThird();
      expect(interval.quality).toBe('major');
      expect(interval.number).toBe(3);
    });

    test('perfectFifth() crée une quinte juste', () => {
      const interval = Interval.perfectFifth();
      expect(interval.quality).toBe('perfect');
      expect(interval.number).toBe(5);
    });

    test('tritone() crée un triton (quarte augmentée)', () => {
      const interval = Interval.tritone();
      expect(interval.toSemitones()).toBe(6);
    });

    test('octave() crée une octave juste', () => {
      const interval = Interval.octave();
      expect(interval.toSemitones()).toBe(12);
    });
  });
});
