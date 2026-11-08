/**
 * Tests des règles élémentaires (Wolfram) et des règles B/S de type Life.
 */

import {
  describeLifeRule,
  elementaryOutputs,
  formatLifeRule,
  isValidElementaryRule,
  lifePresetName,
  lifeRuleTable,
  LIFE_PRESETS,
  parseLifeRule,
  stepElementary,
  toggleElementaryPattern,
} from '../src/rules.js';

/** Convertit « 0010100 » en ligne de cellules. */
const row = (text) => Uint8Array.from(text, Number);
/** Convertit une ligne en texte pour des comparaisons lisibles. */
const text = (cells) => Array.from(cells).join('');

/**
 * Fait évoluer une cellule centrale et renvoie les lignes successives.
 */
function evolve(rule, width, generations) {
  let current = new Uint8Array(width);
  current[Math.floor(width / 2)] = 1;
  const lines = [text(current)];
  for (let g = 0; g < generations; g++) {
    current = stepElementary(current, rule);
    lines.push(text(current));
  }
  return lines;
}

describe('règles élémentaires', () => {
  it('valide les numéros de 0 à 255 uniquement', () => {
    expect(isValidElementaryRule(0)).toBe(true);
    expect(isValidElementaryRule(255)).toBe(true);
    expect(isValidElementaryRule(256)).toBe(false);
    expect(isValidElementaryRule(-1)).toBe(false);
    expect(isValidElementaryRule(30.5)).toBe(false);
    expect(isValidElementaryRule('30')).toBe(false);
  });

  it('décompose la règle 30 = 00011110₂ en sorties par motif', () => {
    // Motifs 111 110 101 100 011 010 001 000 → 0 0 0 1 1 1 1 0
    expect(elementaryOutputs(30)).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('inverse la sortie d’un motif sans toucher aux autres', () => {
    // 30 XOR 2⁷ = 158 ; reproduire l’inversion revient à 30.
    expect(toggleElementaryPattern(30, 7)).toBe(158);
    expect(toggleElementaryPattern(158, 7)).toBe(30);
    expect(toggleElementaryPattern(0, 0)).toBe(1);
  });

  it('règle 30 : premières générations chaotiques connues', () => {
    expect(evolve(30, 11, 4)).toEqual([
      '00000100000',
      '00001110000',
      '00011001000',
      '00110111100',
      '01100100010',
    ]);
  });

  it('règle 90 : triangle de Sierpiński (XOR des deux voisins)', () => {
    expect(evolve(90, 9, 3)).toEqual([
      '000010000',
      '000101000',
      '001000100',
      '010101010',
    ]);
  });

  it('règle 110 : motif croissant vers la gauche', () => {
    expect(evolve(110, 9, 4)).toEqual([
      '000010000',
      '000110000',
      '001110000',
      '011010000',
      '111110000',
    ]);
  });

  it('règle 184 : les voitures avancent si la case de droite est libre', () => {
    expect(text(stepElementary(row('1101000'), 184))).toBe('1010100');
  });

  it('les bords sont reliés (anneau)', () => {
    // Avec la règle 90, la cellule de la case 0 allume ses deux voisines,
    // dont la dernière case de la ligne.
    expect(text(stepElementary(row('10000'), 90))).toBe('01001');
  });

  it('réutilise le tampon de sortie fourni', () => {
    const out = new Uint8Array(5);
    expect(stepElementary(row('00100'), 90, out)).toBe(out);
  });
});

describe('règles B/S', () => {
  it('analyse la notation B/S de Conway', () => {
    expect(parseLifeRule('B3/S23')).toEqual({ rule: { birth: [3], survive: [2, 3] }, error: null });
  });

  it('tolère casse, espaces, ordre et doublons', () => {
    expect(parseLifeRule(' b63 / s32 ').rule).toEqual({ birth: [3, 6], survive: [2, 3] });
    expect(parseLifeRule('B36S23').rule).toEqual({ birth: [3, 6], survive: [2, 3] });
    expect(parseLifeRule('S23/B3').rule).toEqual({ birth: [3], survive: [2, 3] });
    expect(parseLifeRule('B33/S2').rule).toEqual({ birth: [3], survive: [2] });
  });

  it('accepte la notation historique S/B « 23/3 »', () => {
    expect(parseLifeRule('23/3').rule).toEqual({ birth: [3], survive: [2, 3] });
  });

  it('accepte une survie vide (Seeds)', () => {
    expect(parseLifeRule('B2/S').rule).toEqual({ birth: [2], survive: [] });
  });

  it.each([
    ['', /vide/],
    ['B9/S23', /8 voisins/],
    ['Conway', /Notation attendue/],
    ['B3/S2/3', /Notation attendue/],
    ['B3/X23', /Notation attendue/],
  ])('refuse « %s » avec un message explicite', (input, message) => {
    const parsed = parseLifeRule(input);
    expect(parsed.rule).toBeNull();
    expect(parsed.error).toMatch(message);
  });

  it('formate en notation canonique', () => {
    expect(formatLifeRule({ birth: [3, 6], survive: [2, 3] })).toBe('B36/S23');
    expect(formatLifeRule({ birth: [2], survive: [] })).toBe('B2/S');
  });

  it('tous les préréglages sont valides et déjà canoniques', () => {
    for (const preset of LIFE_PRESETS) {
      const parsed = parseLifeRule(preset.notation);
      expect(parsed.rule).not.toBeNull();
      expect(formatLifeRule(/** @type {any} */ (parsed.rule))).toBe(preset.notation);
    }
    expect(lifePresetName('B36/S23')).toBe('HighLife');
    expect(lifePresetName('B1/S1')).toBeNull();
  });

  it('décrit une règle en français', () => {
    expect(describeLifeRule({ birth: [3], survive: [2, 3] })).toBe('Naissance avec 3 voisines, survie avec 2 ou 3.');
    expect(describeLifeRule({ birth: [1, 3, 5], survive: [] })).toBe('Naissance avec 1, 3 ou 5 voisines, aucune survie.');
    expect(describeLifeRule({ birth: [], survive: [0] })).toBe('Aucune naissance, survie avec 0.');
  });

  it('construit la table de transition : naissance puis survie', () => {
    const table = lifeRuleTable({ birth: [3], survive: [2, 3] });
    expect(Array.from(table.subarray(0, 9))).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(Array.from(table.subarray(9))).toEqual([0, 0, 1, 1, 0, 0, 0, 0, 0]);
  });
});
