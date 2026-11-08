/**
 * Non-régression : paramètres non finis, champ fautif des erreurs de
 * syntaxe et limite de longueur partagée entre éditeur et lien.
 */
import { readFileSync } from 'node:fs';
import { interpret, isStorable } from '../src/turtle.js';
import { fitView } from '../src/view.js';
import { computeDrawing, describeError, NonFiniteError } from '../src/compute.js';
import { MAX_TEXT_LENGTH } from '../src/hash-state.js';

/** Paramètres d'un système paramétré minimal. */
function system(axiom, rules, iterations = 3) {
  return { axiom, rules, iterations, angle: 90, step: 10, heading: 0, seed: 1 };
}

/** Erreur décrite (comme envoyée par le worker) d'un calcul qui échoue. */
function failure(params) {
  try {
    computeDrawing(params);
  } catch (error) {
    return { error, described: describeError(error) };
  }
  throw new Error('le calcul aurait dû échouer');
}

describe('paramètres non finis', () => {
  test('isStorable tient compte du débordement Float32', () => {
    expect(isStorable(1)).toBe(true);
    expect(isStorable(1e300)).toBe(false);
    expect(isStorable(Infinity)).toBe(false);
    expect(isStorable(NaN)).toBe(false);
  });

  test('un segment infini est écarté et compté, les bornes restent finies', () => {
    const drawing = computeDrawing(system('F(1)', [{ predecessor: 'F(x)', successor: 'F(x*1e300)+F(x)', probability: '' }]));
    expect(drawing.nonFinite).toBeGreaterThan(0);
    expect(drawing.nonFiniteSymbol).toBe('F');
    expect(drawing.count).toBeGreaterThan(0);
    for (const value of Object.values(drawing.bounds)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    const view = fitView(drawing.bounds, 400, 400);
    expect(view.scale).toBeGreaterThan(0);
    expect(Number.isFinite(view.tx)).toBe(true);
    expect(Number.isFinite(view.ty)).toBe(true);
  });

  test('0/0 (NaN) est écarté au lieu de disparaître sans bruit', () => {
    const drawing = interpret([{ s: 'F', p: [1] }, { s: 'F', p: [NaN] }], { angle: 90 });
    expect(drawing.count).toBe(1);
    expect(drawing.nonFinite).toBe(1);
  });

  test('sans aucun segment fini, une erreur lisible est levée', () => {
    const { error, described } = failure(system('F(2^2000)', [], 0));
    expect(error).toBeInstanceOf(NonFiniteError);
    expect(described.code).toBe('nonfinite');
    expect(described.message).toMatch(/Paramètre non fini \(∞ ou NaN\) dans F\(…\)/);
  });

  test('fitView reste utilisable avec des bornes non finies', () => {
    const view = fitView({ minX: 0, minY: 0, maxX: Infinity, maxY: 0 }, 400, 300);
    expect(view).toEqual({ scale: 1, tx: 200, ty: 150 });
  });

  test('un dessin ordinaire ne signale rien', () => {
    const drawing = interpret('F+F', { angle: 90 });
    expect(drawing.nonFinite).toBe(0);
    expect(drawing.nonFiniteSymbol).toBe('');
  });
});

describe('champ fautif des erreurs de syntaxe', () => {
  test('axiome mal parenthésé ⇒ champ axiome', () => {
    expect(failure(system('F(', [], 1)).described).toMatchObject({ code: 'syntax', field: { kind: 'axiom' } });
    expect(failure(system('F(1+)', [], 1)).described).toMatchObject({ code: 'syntax', field: { kind: 'axiom' } });
  });

  test('successeur invalide ⇒ règle et partie concernées', () => {
    const rules = [
      { predecessor: 'F(x)', successor: 'F(x)', probability: '' },
      { predecessor: 'G(x)', successor: 'G(x+)', probability: '' },
    ];
    expect(failure(system('F(1)', rules)).described.field).toEqual({ kind: 'rule', index: 1, part: 'successor' });
  });

  test('prédécesseur et probabilité invalides sont distingués', () => {
    expect(failure(system('F', [{ predecessor: 'FF', successor: 'F', probability: '' }])).described.field)
      .toEqual({ kind: 'rule', index: 0, part: 'predecessor' });
    expect(failure(system('F', [{ predecessor: 'F', successor: 'FF', probability: 'abc' }])).described.field)
      .toEqual({ kind: 'rule', index: 0, part: 'probability' });
  });
});

describe('limite de longueur des saisies', () => {
  test('l’axiome de la page a la même limite que le lien partagé', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const axiom = html.match(/<input[^>]*id="axiom"[^>]*>/)?.[0] ?? '';
    expect(axiom).toContain(`maxlength="${MAX_TEXT_LENGTH}"`);
  });

  test('les champs de règle utilisent la constante partagée', () => {
    const form = readFileSync(new URL('../src/form.js', import.meta.url), 'utf8');
    expect(form.match(/maxLength: MAX_TEXT_LENGTH/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
