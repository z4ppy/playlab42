/**
 * Textes de l'interface : annonces, statut, libellés de colonnes, évaluation.
 */

import { stateAfter } from '../../ai/__tests__/helpers.js';
import { columnLabel, describeMove, evaluationText, hintText, otherColor, statusText } from '../text.js';

const NAMES = { rouge: 'Rouge', jaune: 'Jaune' };

describe('annonces et statut', () => {
  it('annonce un coup en colonne numérotée de 1 à 7', () => {
    expect(describeMove(NAMES, { playerId: 'rouge', col: 3, row: 5 })).toBe('Rouge joue en colonne 4.');
  });

  it('décrit le tour, la réflexion, la pause, la victoire et le nul', () => {
    const state = stateAfter('4');
    expect(statusText(state, NAMES)).toBe('À Jaune de jouer.');
    expect(statusText(state, NAMES, { thinking: true })).toBe('L’IA réfléchit…');
    expect(statusText(state, NAMES, { paused: true, thinking: true })).toBe('Partie en pause.');
    expect(statusText(stateAfter('1212121'), NAMES)).toBe('Rouge gagne avec quatre jetons alignés !');
    expect(statusText(stateAfter('121212343434565656212121434343656565777777'), NAMES)).toBe('Match nul : la grille est pleine.');
  });
});

describe('libellés de colonnes', () => {
  it('décrit une colonne vide, remplie, pleine ou gagnante', () => {
    expect(columnLabel(stateAfter(''), 0)).toBe('Colonne 1, vide, 6 cases libres');
    expect(columnLabel(stateAfter('44'), 3)).toBe('Colonne 4, de bas en haut : rouge, jaune, 4 cases libres');
    expect(columnLabel(stateAfter('11111'), 0)).toMatch(/1 case libre$/);
    expect(columnLabel(stateAfter('111111'), 0)).toMatch(/pleine$/);
    expect(columnLabel(stateAfter('1212121'), 0)).toMatch(/alignement gagnant$/);
  });
});

describe('évaluation et indice', () => {
  const analysis = (overrides) => ({ forced: null, solved: false, advantage: 0, column: 2, reason: { text: 'Bloque.' }, ...overrides });

  it('annonce une victoire forcée pour la bonne couleur', () => {
    expect(evaluationText(analysis({ forced: { winner: 'self', inMoves: 3 } }), 'yellow')).toBe('Jaune gagne de force en 3 coups.');
    expect(evaluationText(analysis({ forced: { winner: 'opponent', inMoves: 1 } }), 'yellow')).toBe('Rouge gagne de force en 1 coup.');
  });

  it('gradue l\'avantage', () => {
    expect(evaluationText(analysis({ solved: true }), 'red')).toBe('Nul assuré avec un jeu parfait.');
    expect(evaluationText(analysis({ advantage: 0.1 }), 'red')).toBe('Position équilibrée.');
    expect(evaluationText(analysis({ advantage: 0.3 }), 'red')).toBe('Léger avantage Rouge.');
    expect(evaluationText(analysis({ advantage: -0.8 }), 'red')).toBe('Net avantage Jaune.');
  });

  it('formule l\'indice et l\'autre couleur', () => {
    expect(hintText(analysis())).toBe('Indice : colonne 3. Bloque.');
    expect(otherColor('red')).toBe('yellow');
    expect(otherColor('yellow')).toBe('red');
  });
});
