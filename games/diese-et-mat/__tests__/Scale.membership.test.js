/**
 * Caractérisation de l'appartenance et du degré dans une gamme.
 *
 * Les deux requêtes partagent le même intervalle relatif à la tonique,
 * y compris pour les notes plus graves ou plus aiguës que celle-ci.
 */

import { Scale } from '../src/core/Scale.js';
import { Pitch } from '../src/core/Pitch.js';

describe('Scale : intervalle relatif à la tonique', () => {
  const minor = new Scale(new Pitch(5, 3), 'minor'); // La3
  const pitches = Array.from({ length: 24 }, (_, offset) => Pitch.fromMidi(45 + offset));

  test.each([
    [0, 1], [2, 2], [3, 3], [5, 4], [7, 5], [8, 6], [10, 7],
  ])('le demi-ton %i au-dessus de la tonique est le degré %i, quelle que soit l\'octave', (semitones, degree) => {
    expect(minor.getDegreeOf(Pitch.fromMidi(57 + semitones))).toBe(degree);
    expect(minor.getDegreeOf(Pitch.fromMidi(45 + semitones))).toBe(degree);
    expect(minor.getDegreeOf(Pitch.fromMidi(69 + semitones))).toBe(degree);
    expect(minor.contains(Pitch.fromMidi(45 + semitones))).toBe(true);
  });

  test.each([1, 4, 6, 9, 11])('le demi-ton %i est hors gamme (null / false)', (semitones) => {
    expect(minor.getDegreeOf(Pitch.fromMidi(45 + semitones))).toBeNull();
    expect(minor.contains(Pitch.fromMidi(45 + semitones))).toBe(false);
  });

  test('contains et getDegreeOf restent cohérents sur deux octaves', () => {
    for (const pitch of pitches) {
      expect(minor.contains(pitch)).toBe(minor.getDegreeOf(pitch) !== null);
    }
    expect(pitches.filter((pitch) => minor.contains(pitch))).toHaveLength(14);
  });

  test('une note plus grave que la tonique garde un intervalle positif', () => {
    const major = new Scale(new Pitch(4, 5), 'major'); // Sol5
    expect(major.getDegreeOf(new Pitch(3, 3))).toBeNull(); // Fa naturel hors gamme de Sol
    expect(major.contains(new Pitch(3, 3))).toBe(false);
    expect(major.contains(new Pitch(3, 3, 'sharp'))).toBe(true); // Fa# = sensible
    expect(major.getDegreeOf(new Pitch(3, 3, 'sharp'))).toBe(7);
  });
});
