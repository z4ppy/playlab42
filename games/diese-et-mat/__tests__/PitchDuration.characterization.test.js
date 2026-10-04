/**
 * Caractérisation des contrats de parsing et d'égalité avant extraction.
 *
 * @module __tests__/PitchDuration.characterization.test
 */

import { Pitch } from '../src/core/Pitch.js';
import { Duration } from '../src/core/Duration.js';

const parsed = (text) => {
  const pitch = Pitch.fromString(text);
  return [pitch.pitchClass, pitch.octave, pitch.accidental];
};

describe('Pitch.fromString : notation française', () => {
  test.each([
    ['Do4', [0, 4, null]],
    ['Ré4', [1, 4, null]],
    ['Re4', [1, 4, null]],
    ['RÉ4', [1, 4, null]],
    ['mi2', [2, 2, null]],
    ['Fa♯3', [3, 3, 'sharp']],
    ['Fa#3', [3, 3, 'sharp']],
    ['Sol♭5', [4, 5, 'flat']],
    ['Solb5', [4, 5, 'flat']],
    ['La0', [5, 0, null]],
    ['Sib3', [6, 3, 'flat']],
    ['  Si9  ', [6, 9, null]],
  ])('%s', (text, expected) => {
    expect(parsed(text)).toEqual(expected);
  });
});

describe('Pitch.fromString : notation anglaise', () => {
  test.each([
    ['C4', [0, 4, null]],
    ['d5', [1, 5, null]],
    ['E#3', [2, 3, 'sharp']],
    ['F##2', [3, 2, 'double-sharp']],
    ['Gb4', [4, 4, 'flat']],
    ['Abb4', [5, 4, 'double-flat']],
    ['Bn6', [6, 6, 'natural']],
    ['b3', [6, 3, null]],
    ['Bb3', [6, 3, 'flat']],
  ])('%s', (text, expected) => {
    expect(parsed(text)).toEqual(expected);
  });
});

describe('Pitch.fromString : rejets', () => {
  test.each(['', 'H4', 'Do', 'C', 'C44', 'Do#', 'X#4', 'Dob', 'C###4', 'Cbbb4', 'Do♮4'])(
    '%j est refusé',
    (text) => {
      expect(() => Pitch.fromString(text)).toThrow('Format de note invalide');
    },
  );

  test('l’octave hors plage est refusée par le constructeur', () => {
    expect(() => Pitch.fromString('C10')).toThrow('Format de note invalide');
  });
});

describe('Duration.equals', () => {
  const triplet = { ratio: [3, 2] };

  test('compare base, points et tuplets', () => {
    expect(new Duration('quarter').equals(new Duration('quarter'))).toBe(true);
    expect(new Duration('quarter').equals(new Duration('eighth'))).toBe(false);
    expect(new Duration('quarter', 1).equals(new Duration('quarter'))).toBe(false);
    expect(new Duration('quarter', 1).equals(new Duration('quarter', 1))).toBe(true);
  });

  test('tuplets : absence, ratio identique ou différent', () => {
    const plain = new Duration('eighth');
    expect(plain.equals(new Duration('eighth', 0, triplet))).toBe(false);
    expect(new Duration('eighth', 0, triplet).equals(plain)).toBe(false);
    expect(new Duration('eighth', 0, triplet).equals(new Duration('eighth', 0, { ratio: [3, 2] }))).toBe(true);
    expect(new Duration('eighth', 0, triplet).equals(new Duration('eighth', 0, { ratio: [5, 4] }))).toBe(false);
    expect(new Duration('eighth', 0, triplet).equals(new Duration('eighth', 0, { ratio: [3, 4] }))).toBe(false);
  });

  test('deux tuplets sans ratio sont considérés égaux', () => {
    expect(new Duration('eighth', 0, {}).equals(new Duration('eighth', 0, {}))).toBe(true);
    expect(new Duration('eighth', 0, {}).equals(new Duration('eighth', 0, triplet))).toBe(false);
  });
});
