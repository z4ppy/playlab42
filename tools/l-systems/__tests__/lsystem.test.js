import {
  expand,
  estimateLengths,
  maxSafeIterations,
  normalizeSymbols,
  isParametric,
  parseModules,
  pickWeighted,
  LSystemLimitError,
  ExpressionError,
} from '../src/lsystem.js';
import { compileExpression } from '../src/expression.js';
import { SeededRandom } from '../../../lib/seeded-random.js';

const KOCH = { axiom: 'F', rules: [{ predecessor: 'F', successor: 'F+F--F+F' }] };

/** Longueur exacte de la courbe de Koch : 4ⁿ F + 4·(4ⁿ − 1)/3 rotations. */
function kochLength(n) {
  return 4 ** n + (4 * (4 ** n - 1)) / 3;
}

const count = (text, symbol) => [...text].filter((c) => c === symbol).length;

describe('réécriture déterministe', () => {
  test.each([0, 1, 2, 3, 5, 7])('Koch à %i itération(s) : longueur exacte', (n) => {
    const { result, length, lengths } = expand(KOCH, n);
    expect(length).toBe(kochLength(n));
    expect(result.length).toBe(kochLength(n));
    expect(count(result, 'F')).toBe(4 ** n);
    expect(lengths).toHaveLength(n + 1);
  });

  test('Koch n = 1 produit exactement la règle', () => {
    expect(expand(KOCH, 1).result).toBe('F+F--F+F');
  });

  test('Sierpiński : F se triple, G double et récupère deux G par F', () => {
    const sierpinski = {
      axiom: 'F-G-G',
      rules: [
        { predecessor: 'F', successor: 'F-G+F+G-F' },
        { predecessor: 'G', successor: 'GG' },
      ],
    };
    let f = 1;
    let g = 2;
    for (let n = 1; n <= 5; n++) {
      [f, g] = [3 * f, 2 * g + 2 * f];
      const { result } = expand(sierpinski, n);
      expect(count(result, 'F')).toBe(f);
      expect(count(result, 'G')).toBe(g);
    }
    expect(expand(sierpinski, 1).result).toBe('F-G+F+G-F-GG-GG');
  });

  test('les symboles sans règle sont recopiés et la pile est préservée', () => {
    const plant = { axiom: 'X', rules: [{ predecessor: 'X', successor: 'F[+X]F[-X]+X' }, { predecessor: 'F', successor: 'FF' }] };
    expect(expand(plant, 2).result).toBe('FF[+F[+X]F[-X]+X]FF[-F[+X]F[-X]+X]+F[+X]F[-X]+X');
  });

  test('les lignes de règle vides sont ignorées', () => {
    const system = { axiom: 'F', rules: [{ predecessor: '', successor: 'xxx' }, ...KOCH.rules] };
    expect(expand(system, 1).result).toBe('F+F--F+F');
  });

  test('normalise les signes typographiques et les espaces', () => {
    expect(normalizeSymbols(' F − G – H— ')).toBe('F-G-H-');
    expect(expand({ axiom: 'F', rules: [{ predecessor: 'F', successor: 'F − F' }] }, 1).result).toBe('F-F');
  });

  test('refuse un prédécesseur de plusieurs symboles', () => {
    expect(() => expand({ axiom: 'F', rules: [{ predecessor: 'FF', successor: 'F' }] }, 1)).toThrow(ExpressionError);
  });

  test('refuse une probabilité invalide', () => {
    expect(() => expand({ axiom: 'F', rules: [{ predecessor: 'F', successor: 'F', probability: '-1' }] }, 1)).toThrow(/probabilité/);
  });
});

describe('L-systèmes stochastiques', () => {
  const plant = {
    axiom: 'F',
    rules: [
      { predecessor: 'F', successor: 'F[+F]F[-F]F', probability: 0.33 },
      { predecessor: 'F', successor: 'F[+F]F', probability: 0.33 },
      { predecessor: 'F', successor: 'F[-F]F', probability: 0.34 },
    ],
  };

  test('même graine ⇒ même chaîne', () => {
    expect(expand(plant, 5, { seed: 42 }).result).toBe(expand(plant, 5, { seed: 42 }).result);
  });

  test('graines différentes ⇒ chaînes différentes', () => {
    const results = new Set([1, 2, 3, 4, 5].map((seed) => expand(plant, 4, { seed }).result));
    expect(results.size).toBeGreaterThan(1);
  });

  test('la virgule décimale est acceptée et un système déterministe ignore la graine', () => {
    const withComma = { axiom: 'F', rules: [{ predecessor: 'F', successor: 'FF', probability: '0,5' }] };
    expect(expand(withComma, 2, { seed: 1 }).result).toBe(expand(withComma, 2, { seed: 99 }).result);
  });

  test('les fréquences suivent les poids', () => {
    const rng = new SeededRandom(7);
    const alternatives = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
    let b = 0;
    for (let i = 0; i < 4000; i++) {
      b += pickWeighted(alternatives, rng).id === 'b' ? 1 : 0;
    }
    expect(b / 4000).toBeGreaterThan(0.7);
    expect(b / 4000).toBeLessThan(0.8);
  });

  test('des poids tous nuls laissent le symbole intact', () => {
    const system = { axiom: 'F', rules: [{ predecessor: 'F', successor: 'G', probability: 0 }, { predecessor: 'F', successor: 'H', probability: 0 }] };
    expect(expand(system, 1).result).toBe('F');
  });
});

describe('garde-fou de taille', () => {
  test('lève LSystemLimitError au lieu de construire une chaîne démesurée', () => {
    expect(() => expand(KOCH, 12, { maxLength: 100_000 })).toThrow(LSystemLimitError);
    try {
      expand(KOCH, 12, { maxLength: 100_000 });
    } catch (error) {
      expect(error.limit).toBe(100_000);
      expect(error.iteration).toBe(8);
      expect(error.message).toMatch(/dépasse/);
    }
  });

  test('l’estimation est exacte pour un système déterministe', () => {
    const estimates = estimateLengths(KOCH, 6);
    expect(estimates).toEqual([0, 1, 2, 3, 4, 5, 6].map(kochLength));
  });

  test('l’estimation majore la longueur réelle en stochastique', () => {
    const plant = {
      axiom: 'F',
      rules: [{ predecessor: 'F', successor: 'F[+F]F[-F]F', probability: 1 }, { predecessor: 'F', successor: 'F', probability: 1 }],
    };
    const estimates = estimateLengths(plant, 4);
    for (const seed of [1, 2, 3]) {
      const { lengths } = expand(plant, 4, { seed });
      lengths.forEach((length, i) => expect(length).toBeLessThanOrEqual(estimates[i]));
    }
  });

  test('maxSafeIterations donne la dernière itération sous la limite', () => {
    expect(maxSafeIterations(KOCH, 100_000)).toBe(7);
    expect(kochLength(7)).toBeLessThanOrEqual(100_000);
    expect(kochLength(8)).toBeGreaterThan(100_000);
    // Sans croissance, on plafonne au maximum autorisé.
    expect(maxSafeIterations({ axiom: 'F', rules: [] }, 10, 30)).toBe(30);
  });
});

describe('L-systèmes paramétrés', () => {
  test('détecte la forme paramétrée', () => {
    expect(isParametric({ axiom: 'A(1)', rules: [] })).toBe(true);
    expect(isParametric(KOCH)).toBe(false);
  });

  test('lit un axiome avec expressions constantes', () => {
    expect(parseModules('A(1,2*3)F+')).toEqual([{ s: 'A', p: [1, 6] }, { s: 'F', p: [] }, { s: '+', p: [] }]);
  });

  test('applique les paramètres et la condition', () => {
    const system = {
      axiom: 'A(8)',
      rules: [{ predecessor: 'A(x) : x > 2', successor: 'F(x)[+A(x/2)]A(x/2)' }],
    };
    const { result } = expand(system, 3);
    const lengths = result.filter((m) => m.s === 'F').map((m) => m.p[0]);
    expect(lengths).toEqual([8, 4, 4]);
    // x = 2 ne satisfait plus la condition : A(2) reste inchangé.
    expect(result.filter((m) => m.s === 'A').every((m) => m.p[0] === 2)).toBe(true);
  });

  test('une arité différente n’applique pas la règle', () => {
    const { result } = expand({ axiom: 'A(1,2)', rules: [{ predecessor: 'A(x)', successor: 'B' }] }, 1);
    expect(result).toEqual([{ s: 'A', p: [1, 2] }]);
  });

  test('stochastique paramétré déterministe par graine', () => {
    const system = {
      axiom: 'A(1)',
      rules: [
        { predecessor: 'A(x)', successor: 'A(x+1)A(x)', probability: 1 },
        { predecessor: 'A(x)', successor: 'A(x*2)', probability: 1 },
      ],
    };
    expect(expand(system, 6, { seed: 3 }).result).toEqual(expand(system, 6, { seed: 3 }).result);
  });

  test('signale les erreurs de syntaxe', () => {
    expect(() => expand({ axiom: 'A(1', rules: [] }, 1)).toThrow(ExpressionError);
    expect(() => expand({ axiom: 'A(1)', rules: [{ predecessor: 'A(x)', successor: 'A(y)' }] }, 1)).toThrow(/inconnu/);
    expect(() => expand({ axiom: 'A(1)', rules: [{ predecessor: 'A(1)', successor: 'A' }] }, 1)).toThrow(/formels/);
  });
});

describe('expressions', () => {
  test.each([
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['2^3^2', 512],
    ['-2^2', -4],
    ['10%4', 2],
    ['1 < 2 && 3 >= 3', 1],
    ['!(1 == 1) || 0', 0],
    ['max(1, sqrt(16), abs(-3))', 4],
    ['round(sin(90)*10)', 10],
    ['.5e1', 5],
  ])('%s = %p', (source, expected) => {
    expect(compileExpression(source)({})).toBe(expected);
  });

  test('utilise les paramètres et refuse tout le reste', () => {
    expect(compileExpression('l*0.5', ['l'])({ l: 10 })).toBe(5);
    expect(() => compileExpression('constructor', [])).toThrow(/inconnu/);
    expect(() => compileExpression('alert(1)', [])).toThrow(/Fonction inconnue/);
    expect(() => compileExpression('1 +', [])).toThrow(/incomplète/);
    expect(() => compileExpression('1 2', [])).toThrow(/en trop/);
    expect(() => compileExpression('a; b', ['a'])).toThrow(/inattendu/);
    expect(() => compileExpression('  ', [])).toThrow(/vide/);
  });
});
