/**
 * Solveur à information complète : positions construites à la main
 * (gagnable, impossible, budget) et donne réelle rejouée dans le moteur.
 */

import { SolitaireEngine } from '../engine.js';
import { dealBoard } from '../engine/deal.js';
import { applyMove, isWon } from '../engine/rules.js';
import { findWinnableDeal } from '../engine/winnable.js';
import { candidateMoves, solve } from '../ai/solver.js';
import { talonSequences } from '../ai/talon.js';
import { evaluate, findSafeMove, isSafeToFound, orderMoves, rankMove, MOVE_PRIORITY } from '../ai/heuristics.js';
import { boardFromView, hashBoard, isFullyKnown } from '../ai/position.js';
import { board, column, foundation, move } from './positions.js';

/** Rejoue une solution sur un plateau et indique si elle gagne. */
function replays(start, moves) {
  return isWon(moves.reduce((current, action) => applyMove(current, action).board, start));
}

/** Pique monté jusqu'au 10 ; dame, valet et roi de pique restent en jeu. */
const spadesLeft = (tableau, extra = {}) => board({ tableau, heights: [10, 13, 13, 13], ...extra });

describe('Solveur : résultats honnêtes', () => {
  it('trouve une suite gagnante quand une carte cachée débloque tout', () => {
    // Le roi doit libérer le valet caché : il part dans la colonne vide.
    const start = spadesLeft([column(['KS'], ['JS']), column(['QS'])]);
    const result = solve(start);
    expect(result.status).toBe('winnable');
    expect(replays(start, result.moves)).toBe(true);
  });

  /**
   * La dame de pique recouvre le valet dont elle a besoin. Les rois rouges,
   * seuls supports possibles, sont cachés sous elle : roi de pique et roi de
   * trèfle (redescendu de sa fondation) ne peuvent que changer de colonne vide.
   */
  const deadlock = () => board({
    tableau: [column(['QS'], ['JS', 'KH', 'KD']), column(['KS'])], heights: [10, 12, 13, 12],
  });

  it('prouve l\'impossibilité après exploration complète', () => {
    expect(solve(deadlock())).toMatchObject({ status: 'impossible' });
  });

  it('ne conclut jamais « impossible » quand la recherche rapide échoue', () => {
    expect(solve(deadlock(), { exhaustive: false }).status).toBe('unknown');
  });

  it('rend « inconnu » quand le budget de nœuds ou de temps est épuisé', () => {
    const deal = dealBoard(6, 1).board;
    expect(solve(deal, { maxNodes: 5 })).toEqual({ status: 'unknown', nodes: 5 });
    let clock = 0;
    expect(solve(deal, { deadline: 3, now: () => clock++ }).status).toBe('unknown');
  });

  it('gagne immédiatement une position déjà gagnée', () => {
    expect(solve(board({ heights: [13, 13, 13, 13] }))).toEqual({ status: 'winnable', moves: [], nodes: 0 });
  });

  it('refuse un plateau qui contient des cartes inconnues', () => {
    expect(() => solve(board({ stock: [null] }))).toThrow('sans carte inconnue');
    expect(() => solve(board({ tableau: [column(['KS'], [null])] }))).toThrow(Error);
  });

  it('résout une vraie donne et sa solution est acceptée par le moteur', () => {
    const engine = new SolitaireEngine();
    let state = engine.init({ seed: 1, options: { drawCount: 1 } });
    const result = solve(state.board, { maxNodes: 2000 });
    expect(result.status).toBe('winnable');
    for (const action of result.moves) {
      state = engine.applyAction(state, action, 'joueur');
    }
    expect(engine.getWinners(state)).toEqual(['joueur']);
  });

  it('résout aussi en pioche 3 en utilisant les séquences du talon', () => {
    const start = dealBoard(3, 3).board;
    const result = solve(start, { maxNodes: 4000, exhaustive: false });
    expect(result.status).toBe('winnable');
    expect(result.moves.some(action => action.type === 'recycle' || action.type === 'draw')).toBe(true);
    expect(replays(start, result.moves)).toBe(true);
  });
});

describe('Donnes gagnables', () => {
  it('retient la première donne prouvée gagnable à partir du numéro demandé', () => {
    const found = findWinnableDeal(6, 1);
    expect(found).toBeGreaterThanOrEqual(6);
    expect(solve(dealBoard(found, 1).board, { maxNodes: 4000, exhaustive: false }).status).toBe('winnable');
  });

  it('rend `null` si aucune donne n\'est prouvée dans les limites', () => {
    expect(findWinnableDeal(6, 1, { maxAttempts: 2, maxNodesPerDeal: 1 })).toBeNull();
  });

  it('reboucle après le plus grand numéro de donne', () => {
    expect(findWinnableDeal(0xffffffff, 1, { maxAttempts: 40, maxNodesPerDeal: 3000 })).toBeLessThan(40);
  });
});

describe('Séquences du talon', () => {
  it('atteint chaque carte du talon en pioche 1, avec le bon nombre de pioches', () => {
    const start = board({ tableau: [column(['8S']), column(['8C'])], stock: ['7D', '5C', '7H'], waste: ['2C'] });
    const sequences = talonSequences(start);
    expect(sequences).toEqual([
      [{ type: 'draw' }, move('waste', 'tableau-0')],
      [{ type: 'draw' }, move('waste', 'tableau-1')],
      [{ type: 'draw' }, { type: 'draw' }, { type: 'draw' }, move('waste', 'tableau-0')],
      [{ type: 'draw' }, { type: 'draw' }, { type: 'draw' }, move('waste', 'tableau-1')],
    ]);
  });

  it('n\'atteint que les cartes alignées par trois en pioche 3, recyclage compris', () => {
    // Le dessus du talon est la dernière carte : la première pioche montre 9S, AC puis AD.
    const start = board({ drawCount: 3, stock: ['QS', 'AD', 'AC', '9S'] });
    // Seul l'as de carreau (3e carte) devient jouable ; l'as de trèfle reste dessous.
    expect(talonSequences(start)).toEqual([[{ type: 'draw' }, move('waste', 'foundation-3')]]);
  });

  it('ne propose rien sans talon ni défausse', () => {
    expect(talonSequences(board())).toEqual([]);
  });
});

describe('Heuristiques', () => {
  it('juge sûrs les as, les 2 et les cartes dont les supports possibles sont montés', () => {
    const foundations = board({ heights: [4, 3, 4, 2] }).foundations;
    expect(isSafeToFound('2H', foundations)).toBe(true);
    expect(isSafeToFound('4H', foundations)).toBe(true);
    expect(isSafeToFound('5S', foundations)).toBe(false);
    expect(isSafeToFound('5H', foundations)).toBe(true);
  });

  it('impose un coup sûr et sinon trie les candidats', () => {
    const safe = board({ tableau: [column(['AH']), column(['8S']), column(['7D'])] });
    expect(findSafeMove(safe)).toEqual(move('tableau-0', 'foundation-1'));
    expect(candidateMoves(safe)).toEqual([[move('tableau-0', 'foundation-1')]]);
    const unsafe = board({ tableau: [column(['7D'], ['2C']), column(['8S']), column(['5H'])], heights: [0, 4, 0, 0] });
    expect(findSafeMove(unsafe)).toBeNull();
    expect(candidateMoves(unsafe)[0]).toEqual([move('tableau-0', 'tableau-1')]);
  });

  it('classe les coups par intérêt', () => {
    const position = board({
      tableau: [column(['9H', '8C', '7D'], ['2S']), column(['TS']), column(['8S']), column(['KD']), column(['6S', '5H'])],
      waste: ['QC'], heights: [0, 0, 7, 0],
    });
    expect(rankMove(position, move('tableau-0', 'tableau-1', 3))).toBe(MOVE_PRIORITY.reveal + 10);
    expect(rankMove(position, move('tableau-0', 'tableau-2', 1))).toBe(MOVE_PRIORITY.exposeForFoundation);
    expect(rankMove(position, move('tableau-4', 'tableau-0', 2))).toBe(MOVE_PRIORITY.emptyColumn);
    expect(rankMove(position, move('tableau-3', 'tableau-5'))).toBe(MOVE_PRIORITY.pointlessKing);
    expect(rankMove(position, move('waste', 'tableau-3'))).toBe(MOVE_PRIORITY.wasteToTableau);
    expect(rankMove(position, move('foundation-2', 'tableau-0'))).toBe(MOVE_PRIORITY.fromFoundation);
    expect(rankMove(position, move('waste', 'foundation-2'))).toBe(MOVE_PRIORITY.toFoundation);
    expect(rankMove(position, { type: 'draw' })).toBe(MOVE_PRIORITY.draw);
    expect(rankMove(position, { type: 'recycle' })).toBe(MOVE_PRIORITY.recycle);
    const reveal = board({ tableau: [column(['AS'], ['2C'])] });
    expect(rankMove(reveal, move('tableau-0', 'foundation-0'))).toBe(MOVE_PRIORITY.revealToFoundation);
    const rearrange = board({ tableau: [column(['9H', '8C']), column(['9D'])] });
    expect(rankMove(rearrange, move('tableau-0', 'tableau-1'))).toBe(MOVE_PRIORITY.rearrange);
    expect(orderMoves(position, [{ type: 'draw' }, move('waste', 'tableau-3')])[0]).toEqual(move('waste', 'tableau-3'));
  });

  it('évalue sans lire l\'identité des cartes', () => {
    const plain = board({ tableau: [column(['KS'], ['AC'])], stock: ['2C'] });
    const unknown = board({ tableau: [column([null], [null])], stock: [null] });
    expect(evaluate(unknown)).toBe(evaluate(plain));
    expect(evaluate(board({ heights: [1, 0, 0, 0] }))).toBeGreaterThan(evaluate(board()));
  });
});

describe('Positions', () => {
  it('reconstruit un plateau depuis la vue, cartes cachées inconnues', () => {
    const engine = new SolitaireEngine();
    const state = engine.init({ seed: 4 });
    const rebuilt = boardFromView(engine.getPlayerView(state, 'joueur'));
    expect(isFullyKnown(rebuilt)).toBe(false);
    expect(rebuilt.stock).toEqual(Array(24).fill(null));
    expect(rebuilt.tableau[3].down).toEqual([null, null, null]);
    expect(rebuilt.tableau[3].up).toEqual(state.board.tableau[3].up);
    expect(isFullyKnown(state.board)).toBe(true);
  });

  it('donne la même clé à deux positions qui ne diffèrent que par l\'ordre des colonnes', () => {
    const left = board({ tableau: [column(['KS']), column([]), column(['QH'], ['2C'])] });
    const right = board({ tableau: [column(['QH'], ['2C']), column(['KS'])] });
    expect(hashBoard(left)).toBe(hashBoard(right));
    expect(hashBoard(left)).not.toBe(hashBoard({ ...left, waste: ['AD'] }));
    expect(hashBoard(board({ stock: [null] }))).toContain('??');
  });

  it('distingue les hauteurs de fondation', () => {
    expect(hashBoard(board({ heights: [1, 0, 0, 0] }))).not.toBe(hashBoard(board()));
    expect(foundation('S', 2)).toEqual(['AS', '2S']);
  });
});
