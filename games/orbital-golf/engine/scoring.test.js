import { MAX_STROKES, PICKUP_SCORE, cardTotals, completedHoles, formatToPar, holeLabel } from './scoring.js';

describe('Libellés de golf', () => {
  test.each([
    [1, 3, 'Trou en un'],
    [2, 5, 'Albatros'],
    [2, 4, 'Aigle'],
    [2, 3, 'Birdie'],
    [3, 3, 'Par'],
    [4, 3, 'Bogey'],
    [5, 3, 'Double bogey'],
    [7, 3, '+4'],
    [2, 6, '−4'],
    [PICKUP_SCORE, 3, 'Ramassé'],
  ])('%i coups pour un par %i : %s', (strokes, par, label) => {
    expect(holeLabel(strokes, par)).toBe(label);
  });

  test('l’écart au par utilise le vrai signe moins', () => {
    expect(formatToPar(0)).toBe('Par');
    expect(formatToPar(3)).toBe('+3');
    expect(formatToPar(-2)).toBe('−2');
  });

  test('un trou est ramassé au-delà de huit coups et compte neuf', () => {
    expect([MAX_STROKES, PICKUP_SCORE]).toEqual([8, 9]);
  });
});

describe('Carte de score', () => {
  const course = [{ par: 2 }, { par: 3 }, { par: 4 }];

  test('ne compte que les trous terminés', () => {
    const aiming = { course, strokes: [3, 2, 0], holeIndex: 1, status: 'aiming' };
    expect(completedHoles(aiming)).toBe(1);
    expect(cardTotals(aiming)).toEqual({ strokes: 3, par: 2, toPar: 1, played: 1 });
  });

  test('compte le trou courant dès qu’il est rentré, jusqu’à la fin', () => {
    expect(cardTotals({ course, strokes: [3, 2, 0], holeIndex: 1, status: 'holed' }))
      .toEqual({ strokes: 5, par: 5, toPar: 0, played: 2 });
    expect(cardTotals({ course, strokes: [1, 2, 3], holeIndex: 2, status: 'finished' }))
      .toEqual({ strokes: 6, par: 9, toPar: -3, played: 3 });
  });
});
