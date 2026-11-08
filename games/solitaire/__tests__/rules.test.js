/**
 * Règles partagées : cartes, piles, énumération des coups et application.
 * L'énumération rapide est comparée à une énumération exhaustive naïve.
 */

import { SeededRandom } from '../../../lib/seeded-random.js';
import {
  canFound, canStack, cardInfo, cardLabel, cardName, createDeck, isCard, suitName,
} from '../engine/cards.js';
import { dealBoard } from '../engine/deal.js';
import {
  applyMove, foundationCount, foundationId, hiddenCount, isLegalMove, isWon, listMoves, parsePile, tableauId,
} from '../engine/rules.js';
import { board, column, move } from './positions.js';

describe('Cartes', () => {
  it('décrit rang, enseigne et couleur', () => {
    expect(cardInfo('QH')).toMatchObject({ rank: 12, suit: 'H', suitIndex: 1, red: true });
    expect(cardInfo('AS')).toMatchObject({ rank: 1, red: false, suitIndex: 0 });
    expect(createDeck()).toHaveLength(52);
    expect(isCard('TD')).toBe(true);
    expect(isCard('1D')).toBe(false);
    expect(isCard(null)).toBe(false);
    expect(() => cardInfo('ZZ')).toThrow('Carte inconnue');
  });

  it('nomme les cartes en français, avec les figures V, D, R', () => {
    expect(cardName('AS')).toBe('l’as de pique');
    expect(cardName('QH')).toBe('la dame de cœur');
    expect(cardName('TC')).toBe('le 10 de trèfle');
    expect(cardName('KD')).toBe('le roi de carreau');
    expect(cardLabel('JC')).toEqual({ rank: 'V', suit: 'C', red: false });
    expect(cardLabel('TD')).toEqual({ rank: '10', suit: 'D', red: true });
    expect(suitName(1)).toBe('cœur');
  });

  it('applique la règle d\'empilement et celle des fondations', () => {
    expect(canStack('7H', '8S')).toBe(true);
    expect(canStack('7H', '8D')).toBe(false);
    expect(canStack('6H', '8S')).toBe(false);
    expect(canStack('KH', undefined)).toBe(true);
    expect(canStack('QH', undefined)).toBe(false);
    expect(canFound('AH', 1, [])).toBe(true);
    expect(canFound('AH', 0, [])).toBe(false);
    expect(canFound('3H', 1, ['AH'])).toBe(false);
  });
});

describe('Piles', () => {
  it('décode les identifiants de piles et refuse le reste', () => {
    expect(parsePile('waste')).toEqual({ zone: 'waste', index: 0 });
    expect(parsePile(tableauId(6))).toEqual({ zone: 'tableau', index: 6 });
    expect(parsePile(foundationId(3))).toEqual({ zone: 'foundation', index: 3 });
    for (const bad of ['tableau-7', 'foundation-4', 'stock', 'tableau-', 'tableau-01', 3, null]) {
      expect(parsePile(bad)).toBeNull();
    }
  });

  it('compte cartes cachées et cartes montées', () => {
    const position = board({ tableau: [column(['KS'], ['AC', '2C'])], heights: [3, 0, 1, 0] });
    expect(hiddenCount(position)).toBe(2);
    expect(foundationCount(position)).toBe(4);
    expect(isWon(position)).toBe(false);
    expect(isWon(board({ heights: [13, 13, 13, 13] }))).toBe(true);
  });

  it('rejette un type d\'action inconnu', () => {
    expect(isLegalMove(board(), { type: 'flip' })).toBe(false);
    expect(isLegalMove(board(), move('waste', 'tableau-0', 0))).toBe(false);
  });
});

/** Énumération naïve : toutes les combinaisons source × destination × nombre. */
function bruteForceMoves(position) {
  const sources = ['waste', ...[0, 1, 2, 3].map(foundationId), ...[0, 1, 2, 3, 4, 5, 6].map(tableauId)];
  const targets = [...[0, 1, 2, 3].map(foundationId), ...[0, 1, 2, 3, 4, 5, 6].map(tableauId), 'waste'];
  const found = [];
  for (const from of sources) {
    for (const to of targets) {
      for (let count = 1; count <= 13; count++) {
        if (isLegalMove(position, move(from, to, count))) {
          found.push(JSON.stringify(move(from, to, count)));
        }
      }
    }
  }
  for (const type of ['draw', 'recycle']) {
    if (isLegalMove(position, { type })) {
      found.push(JSON.stringify({ type }));
    }
  }
  return found.sort();
}

describe('Énumération des coups', () => {
  it('liste exactement les coups légaux tout au long de parties aléatoires', () => {
    for (const seed of [1, 2, 3]) {
      const rng = new SeededRandom(seed);
      let position = dealBoard(seed, seed === 2 ? 3 : 1).board;
      for (let turn = 0; turn < 120 && !isWon(position); turn++) {
        const moves = listMoves(position);
        expect(moves.map(m => JSON.stringify(m)).sort()).toEqual(bruteForceMoves(position));
        position = applyMove(position, rng.pick(moves)).board;
      }
    }
  });

  it('place les coups vers les fondations en premier et le talon en dernier', () => {
    const position = board({ tableau: [column(['AS']), column(['KD'])], stock: ['2C'] });
    const moves = listMoves(position);
    expect(moves[0]).toEqual(move('tableau-0', 'foundation-0'));
    expect(moves[moves.length - 1]).toEqual({ type: 'draw' });
  });
});

describe('Application d\'un coup', () => {
  it('partage les piles non touchées et signale la carte retournée', () => {
    const position = board({ tableau: [column(['8S']), column(['7H'], ['3C']), column(['2D'])] });
    const outcome = applyMove(position, move('tableau-1', 'tableau-0'));
    expect(outcome.flipped).toBe('3C');
    expect(outcome.board.tableau[2]).toBe(position.tableau[2]);
    expect(position.tableau[1].up).toEqual(['7H']);
  });

  it('ne signale aucun retournement quand la colonne garde une carte visible ou se vide', () => {
    const position = board({ tableau: [column(['8S']), column(['9D', '7H'])] });
    expect('flipped' in applyMove(position, move('tableau-1', 'tableau-0'))).toBe(false);
    expect('flipped' in applyMove(board({ tableau: [column(['KS'])] }), move('tableau-0', 'tableau-1'))).toBe(false);
  });

  it('retourne `null` pour une carte cachée inconnue (plateau reconstruit depuis la vue)', () => {
    const position = board({ tableau: [column(['8S']), column(['7H'], [null])] });
    const outcome = applyMove(position, move('tableau-1', 'tableau-0'));
    expect(outcome).toHaveProperty('flipped', null);
  });

  it('renvoie les cartes piochées dans l\'ordre d\'arrivée sur la défausse', () => {
    const position = board({ drawCount: 3, stock: ['4C', '3C', '2C', 'AC'] });
    expect(applyMove(position, { type: 'draw' }).drawn).toEqual(['AC', '2C', '3C']);
  });
});
