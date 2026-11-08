import { PRESETS, DEFAULT_PRESET_ID, findPreset } from '../src/presets.js';
import { stateFromPreset, stateToHash, hashToState, clampField, MAX_RULES, MAX_TEXT_LENGTH } from '../src/hash-state.js';
import { computeDrawing, describeError, previewOf } from '../src/compute.js';
import { maxSafeIterations, MAX_SYMBOLS } from '../src/lsystem.js';

describe('préréglages', () => {
  test('identifiants uniques et préréglage par défaut existant', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(findPreset(DEFAULT_PRESET_ID)).toBeDefined();
  });

  test('couvre les figures demandées', () => {
    const ids = PRESETS.map((p) => p.id);
    for (const id of ['koch-curve', 'koch-snowflake', 'sierpinski-triangle', 'dragon', 'hilbert', 'gosper', 'abop-1-24a', 'abop-1-24f', 'binary-tree', 'stochastic-plant', 'parametric-tree']) {
      expect(ids).toContain(id);
    }
  });

  test.each(PRESETS.map((p) => [p.id, p]))('%s se calcule aux itérations par défaut, sous la limite', (_id, preset) => {
    const state = stateFromPreset(preset.id);
    const drawing = computeDrawing(state);
    expect(drawing.count).toBeGreaterThan(10);
    expect(drawing.length).toBeLessThan(MAX_SYMBOLS);
    expect(drawing.unbalanced).toBe(0);
    expect(Number.isFinite(drawing.bounds.maxX)).toBe(true);
    expect(preset.iterations).toBeLessThanOrEqual(maxSafeIterations(state));
  });

  test('les plantes utilisent la pile, les courbes non', () => {
    expect(computeDrawing(stateFromPreset('abop-1-24a')).maxDepth).toBeGreaterThan(0);
    expect(computeDrawing(stateFromPreset('dragon')).maxDepth).toBe(0);
  });

  test('courbe de Hilbert : 4ⁿ − 1 segments', () => {
    expect(computeDrawing({ ...stateFromPreset('hilbert'), iterations: 4 }).count).toBe(255);
  });

  test('courbe du dragon : 2ⁿ segments', () => {
    expect(computeDrawing({ ...stateFromPreset('dragon'), iterations: 10 }).count).toBe(1024);
  });
});

describe('calcul et erreurs sérialisables', () => {
  test('refuse d’avance une demande trop grande avec l’itération sûre', () => {
    const state = { ...stateFromPreset('koch-curve'), iterations: 20 };
    let caught;
    try {
      computeDrawing(state);
    } catch (error) {
      caught = describeError(error);
    }
    expect(caught.code).toBe('limit');
    expect(caught.safeIterations).toBe(maxSafeIterations(state));
    expect(caught.limit).toBe(MAX_SYMBOLS);
  });

  test('la limite s’applique aussi en stochastique pendant la réécriture', () => {
    const state = { ...stateFromPreset('stochastic-plant'), iterations: 12, maxSymbols: 50_000 };
    let caught;
    try {
      computeDrawing(state);
    } catch (error) {
      caught = describeError(error);
    }
    expect(caught.code).toBe('limit');
    const ok = computeDrawing({ ...state, iterations: caught.safeIterations });
    expect(ok.length).toBeLessThanOrEqual(50_000);
  });

  test('une règle invalide donne une erreur de syntaxe lisible', () => {
    let caught;
    try {
      computeDrawing({ ...stateFromPreset('parametric-tree'), axiom: 'A(1' });
    } catch (error) {
      caught = describeError(error);
    }
    expect(caught).toEqual({ code: 'syntax', message: expect.stringContaining('Parenthèse'), field: { kind: 'axiom' } });
    expect(describeError('boum')).toEqual({ code: 'internal', message: 'boum' });
  });

  test('extrait de chaîne, simple ou paramétrée', () => {
    expect(previewOf('F'.repeat(1000))).toHaveLength(240);
    expect(previewOf([{ s: 'A', p: [1.234, 2] }, { s: '+', p: [] }])).toBe('A(1.23,2)+');
  });
});

describe('état dans le hash d’URL', () => {
  test('aller-retour complet, règles stochastiques comprises', () => {
    const state = { ...stateFromPreset('stochastic-plant'), seed: 1234, angle: 22.5, colorMode: 'gradient', lineWidth: 2.5 };
    const restored = hashToState(`#${stateToHash(state)}`);
    expect(restored).toEqual(state);
  });

  test('aller-retour d’une règle paramétrée avec caractères spéciaux', () => {
    const state = {
      ...stateFromPreset('parametric-tree'),
      preset: 'custom',
      axiom: 'A(100,1)',
      rules: [{ predecessor: 'A(l,w) : l > 3 && w != 0', successor: '!(w)F(l)[+A(l*0.7,w%2)]&#|', probability: '' }],
    };
    expect(hashToState(stateToHash(state))).toEqual(state);
  });

  test('hash vide ou étranger ⇒ null', () => {
    expect(hashToState('')).toBeNull();
    expect(hashToState('#section-2')).toBeNull();
  });

  test('un préréglage seul reprend ses valeurs', () => {
    expect(hashToState('#p=dragon')).toEqual(stateFromPreset('dragon'));
  });

  test('borne les valeurs d’un lien forgé', () => {
    const state = hashToState(`#ax=${'F'.repeat(5000)}&n=999&a=abc&lw=-4&c=evil&p=inconnu${'&rp=F&rs=F'.repeat(40)}`);
    expect(state.preset).toBe('custom');
    expect(state.axiom).toHaveLength(MAX_TEXT_LENGTH);
    expect(state.iterations).toBe(30);
    expect(state.angle).toBe(stateFromPreset(DEFAULT_PRESET_ID).angle);
    expect(state.lineWidth).toBe(0.25);
    expect(state.colorMode).toBe(stateFromPreset(DEFAULT_PRESET_ID).colorMode);
    expect(state.rules).toHaveLength(MAX_RULES);
  });

  test('clampField arrondit les entiers et accepte la virgule', () => {
    expect(clampField('3,7', 'iterations')).toBe(4);
    expect(clampField('22,5', 'angle')).toBe(22.5);
    expect(clampField('', 'step')).toBe(10);
    expect(clampField(null, 'seed')).toBe(1);
  });
});
