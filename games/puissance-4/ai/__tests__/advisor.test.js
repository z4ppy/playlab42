/**
 * Conseiller : explications en français de chaque règle et évaluation
 * affichée du point de vue de Rouge.
 */

import { analyzeView, explainMove, forcedOutcome, formatColumns, redAdvantage } from '../advisor.js';
import { WIN_SCORE, winScore } from '../search.js';
import { positionAfter, stateAfter } from './helpers.js';

const QUICK = { maxNodes: 20_000 };

describe('issue forcée et avantage', () => {
  it('compte les coups du gagnant, pas les demi-coups', () => {
    // 4 jetons posés, gain au 7e : le joueur au trait joue les 5e et 7e jetons.
    expect(forcedOutcome(winScore(7), 4)).toEqual({ winner: 'self', inMoves: 2 });
    // Défaite au 8e jeton : l'adversaire joue les 6e et 8e jetons.
    expect(forcedOutcome(-winScore(8), 5)).toEqual({ winner: 'opponent', inMoves: 2 });
    expect(forcedOutcome(25, 5)).toBeNull();
  });

  it('exprime l\'avantage du point de vue de Rouge, borné à [-1, 1]', () => {
    expect(redAdvantage(true, WIN_SCORE - 9)).toBe(1);
    expect(redAdvantage(false, WIN_SCORE - 9)).toBe(-1);
    expect(redAdvantage(true, 0)).toBe(0);
    expect(redAdvantage(false, 40)).toBeCloseTo(-Math.tanh(0.5));
  });
});

describe('explications du coup conseillé', () => {
  const explain = (sequence, column, search = { forced: null, depth: 8 }) => explainMove(positionAfter(sequence), column, search);

  it.each([
    ['win', '112237', 3, /Gagne tout de suite.*colonne 4/],
    ['block', '11223', 3, /Bloque la menace adverse en colonne 4/],
    ['double-threat', '4433', 4, /double menace/],
    ['avoid-trap', '2113372', 0, /Évite la colonne 4/],
    ['threat', '1122', 2, /Prépare une menace/],
    ['center', '', 3, /centre/],
    ['positional', '', 0, /8 coups à l’avance/],
  ])('règle %s', (code, sequence, column, text) => {
    const reason = explain(sequence, column);
    expect(reason.code).toBe(code);
    expect(reason.text).toMatch(text);
  });

  it('annonce une victoire forcée ou une défense désespérée', () => {
    expect(explain('', 0, { forced: { winner: 'self', inMoves: 5 }, depth: 9 }).text).toBe('Mène à une victoire forcée en 5 coups.');
    expect(explain('', 0, { forced: { winner: 'opponent', inMoves: 3 }, depth: 9 }).code).toBe('delay');
  });

  it('formule une ou plusieurs colonnes', () => {
    expect(formatColumns([3])).toBe('la colonne 4');
    expect(formatColumns([0, 2, 6])).toBe('les colonnes 1, 3 et 7');
  });
});

describe('analyse complète d\'une vue', () => {
  it('conseille la double menace et annonce la victoire en 2 coups', () => {
    const analysis = analyzeView(stateAfter('4433'), QUICK);
    expect([1, 4]).toContain(analysis.column);
    expect(analysis).toMatchObject({ forced: { winner: 'self', inMoves: 2 }, solved: true, advantage: 1 });
    expect(analysis.reason.code).toBe('double-threat');
  });

  it('évalue du point de vue de Rouge quand Jaune est au trait', () => {
    const analysis = analyzeView(stateAfter('33445'), QUICK);
    expect(analysis.forced).toEqual({ winner: 'opponent', inMoves: 1 });
    expect(analysis.advantage).toBe(1);
    expect(analysis.reason.code).toBe('delay');
  });

  it('utilise le budget par défaut quand aucun n\'est donné', () => {
    expect(analyzeView(stateAfter('112237'))).toMatchObject({ column: 3, reason: { code: 'win' }, forced: { winner: 'self', inMoves: 1 } });
  });

  it('reste équilibrée en ouverture', () => {
    const analysis = analyzeView(stateAfter(''), QUICK);
    expect(analysis.column).toBe(3);
    expect(Math.abs(analysis.advantage)).toBeLessThan(0.5);
    expect(analysis.forced).toBeNull();
    expect(analysis.depth).toBeGreaterThan(4);
  });
});
