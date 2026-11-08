/**
 * Réglages des outils : bornage des valeurs restaurées et pas de taille [ / ].
 */

import { OPTION_DEFS, sanitizeOption } from '../src/tools/index.js';
import { nextSize } from '../src/ui/commands.js';

describe('sanitizeOption', () => {
  it('borne et arrondit les curseurs', () => {
    expect(sanitizeOption('size', 9999, 4)).toBe(OPTION_DEFS.size.max);
    expect(sanitizeOption('size', -3, 4)).toBe(1);
    expect(sanitizeOption('opacity', '42.6', 100)).toBe(43);
    expect(sanitizeOption('opacity', 'abc', 100)).toBe(100);
  });

  it('valide les cases et les listes', () => {
    expect(sanitizeOption('pressure', false, true)).toBe(false);
    expect(sanitizeOption('pressure', 'oui', true)).toBe(true);
    expect(sanitizeOption('fillMode', 'both', 'stroke')).toBe('both');
    expect(sanitizeOption('fillMode', 'plasma', 'stroke')).toBe('stroke');
  });

  it('ignore les réglages inconnus ou sans valeur', () => {
    expect(sanitizeOption('inconnu', 3, 'x')).toBe('x');
    expect(sanitizeOption('selectionActions', 3, null)).toBeNull();
  });
});

describe('nextSize', () => {
  it('progresse d\'au moins un pixel dans chaque sens', () => {
    expect(nextSize(1, 1)).toBe(2);
    expect(nextSize(2, -1)).toBe(1);
    expect(nextSize(100, 1)).toBe(125);
    expect(nextSize(100, -1)).toBe(80);
  });
});
