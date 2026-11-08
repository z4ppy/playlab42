import {
  CHINCHILLA_TOKENS_PER_PARAM,
  trainingCompute,
  chinchillaOptimum,
  classifyTraining,
  formatCount,
  formatFlops,
  shuffleForExercise,
  scoreOrder,
  moveItem,
} from './history-logic.js';

// Espace insécable fine utilisée par Intl en français : on la normalise pour lire les attentes.
const plain = text => text.replace(/[\u202f\u00a0]/g, ' ');

describe('trainingCompute()', () => {
  test('GPT-3 : 6 × 175 Md × 300 Md ≈ 3,15 × 10^23 FLOP (le papier annonce 3,14 × 10^23)', () => {
    expect(trainingCompute(175e9, 300e9)).toBeCloseTo(3.15e23, -21);
  });

  test('refuse les valeurs nulles, négatives ou non finies', () => {
    expect(() => trainingCompute(0, 1)).toThrow(RangeError);
    expect(() => trainingCompute(1, -5)).toThrow(RangeError);
    expect(() => trainingCompute(Number.NaN, 1)).toThrow(RangeError);
  });
});

describe('chinchillaOptimum()', () => {
  test('retrouve Chinchilla : le budget de 70 Md × 1,4 T tokens donne ~70 Md de paramètres', () => {
    const compute = trainingCompute(70e9, 1.4e12);
    const { params, tokens } = chinchillaOptimum(compute);
    expect(params).toBeCloseTo(70e9, -8);
    expect(tokens).toBeCloseTo(1.4e12, -10);
  });

  test('respecte toujours la règle D = 20 · N et C = 6 · N · D', () => {
    for (const compute of [1e18, 3.14e23, 3.8e25]) {
      const { params, tokens } = chinchillaOptimum(compute);
      expect(tokens / params).toBeCloseTo(CHINCHILLA_TOKENS_PER_PARAM, 10);
      expect(trainingCompute(params, tokens) / compute).toBeCloseTo(1, 10);
    }
  });

  test('avec le budget de GPT-3, l’optimum serait ~51 Md de paramètres et ~1 T tokens', () => {
    const { params, tokens } = chinchillaOptimum(trainingCompute(175e9, 300e9));
    expect(params / 1e9).toBeCloseTo(51.2, 0);
    expect(tokens / 1e12).toBeCloseTo(1.02, 1);
  });

  test('refuse un budget nul', () => {
    expect(() => chinchillaOptimum(0)).toThrow(RangeError);
  });
});

describe('classifyTraining()', () => {
  test('GPT-3 (≈ 1,7 token par paramètre) est sous-entraîné', () => {
    const result = classifyTraining(175e9, 300e9);
    expect(result.verdict).toBe('sous-entraîné');
    expect(result.ratio).toBeCloseTo(1.71, 2);
  });

  test('Chinchilla (20 tokens par paramètre) est proche de l’optimum', () => {
    expect(classifyTraining(70e9, 1.4e12).verdict).toBe('proche de l’optimum');
  });

  test('Llama 3 8B (15 T tokens) est volontairement sur-entraîné', () => {
    expect(classifyTraining(8e9, 15e12).verdict).toBe('sur-entraîné');
  });

  test('les bornes ×0,5 et ×2 restent « proches de l’optimum »', () => {
    expect(classifyTraining(1, 10).verdict).toBe('proche de l’optimum');
    expect(classifyTraining(1, 40).verdict).toBe('proche de l’optimum');
  });
});

describe('formatCount()', () => {
  test.each([
    [70e9, '70 Md'],
    [1.4e12, '1,4 T'],
    [117e6, '117 M'],
    [1500, '1,5 k'],
    [12, '12'],
    [0, '0'],
  ])('%p → %p', (value, expected) => {
    expect(plain(formatCount(value))).toBe(expected);
  });

  test('refuse une valeur négative', () => {
    expect(() => formatCount(-1)).toThrow(RangeError);
  });
});

describe('formatFlops()', () => {
  test('écrit la mantisse et l’exposant', () => {
    expect(plain(formatFlops(3.15e23))).toBe('3,15 × 10^23');
    expect(plain(formatFlops(1e18))).toBe('1 × 10^18');
  });
});

describe('shuffleForExercise()', () => {
  const events = ['a', 'b', 'c', 'd', 'e'];

  test('est déterministe pour une même graine et ne modifie pas l’entrée', () => {
    const first = shuffleForExercise(events, 42);
    expect(shuffleForExercise(events, 42)).toEqual(first);
    expect(events).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('conserve les éléments et ne rend jamais l’ordre déjà correct', () => {
    for (let seed = 0; seed < 50; seed++) {
      const shuffled = shuffleForExercise(events, seed);
      expect([...shuffled].sort()).toEqual(events);
      expect(shuffled).not.toEqual(events);
    }
  });

  test('laisse une liste trop courte inchangée', () => {
    expect(shuffleForExercise(['seul'], 1)).toEqual(['seul']);
  });
});

describe('scoreOrder()', () => {
  const expected = ['1948', '1997', '2017'];

  test('reconnaît un ordre correct', () => {
    expect(scoreOrder(['1948', '1997', '2017'], expected))
      .toEqual({ correct: 3, total: 3, solved: true, misplaced: [] });
  });

  test('liste les éléments mal placés', () => {
    expect(scoreOrder(['1997', '1948', '2017'], expected))
      .toEqual({ correct: 1, total: 3, solved: false, misplaced: ['1997', '1948'] });
  });

  test('refuse une proposition incomplète, dupliquée ou étrangère', () => {
    expect(() => scoreOrder(['1948', '1997'], expected)).toThrow();
    expect(() => scoreOrder(['1948', '1948', '2017'], expected)).toThrow();
    expect(() => scoreOrder(['1948', '1997', '2030'], expected)).toThrow();
  });
});

describe('moveItem()', () => {
  test('échange avec le voisin sans modifier la liste d’origine', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  test('ne sort jamais des bornes', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, 1)).toEqual(['a', 'b']);
  });
});
