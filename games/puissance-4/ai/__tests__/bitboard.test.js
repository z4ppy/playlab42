/**
 * Bitboards : opérations 64 bits sur des Number comparées à BigInt, détection
 * des cases gagnantes comparée à une recherche naïve sur la grille du moteur.
 */

import { SeededRandom } from '../../../../lib/seeded-random.js';
import { findWinningLine, landingRow, withDisc } from '../../engine/board.js';
import {
  BOARD_MASK,
  CENTER_ORDER,
  EVEN_ROWS_MASK,
  ODD_ROWS_MASK,
  and,
  andNot,
  canPlay,
  columnsOf,
  hasAlignment,
  moveBit,
  or,
  playColumn,
  playableMask,
  popCount,
  positionFromView,
  readTactics,
  shiftLeft,
  shiftRight,
  winningCells,
  xor,
} from '../bitboard.js';
import { engine, positionAfter, randomState, stateAfter } from './helpers.js';

/** Bit d'une case (ligne 0 = haut, comme dans le moteur). */
const bitOf = (row, col) => 2 ** (col * 7 + (5 - row));

/** Entier aléatoire de `bits` bits, exact dans un Number. */
function randomBits(rng, bits) {
  let value = 0;
  for (let bit = 0; bit < bits; bit++) {
    value = value * 2 + (rng.chance(0.5) ? 1 : 0);
  }
  return value;
}

describe('opérations binaires sur 49 bits', () => {
  const rng = new SeededRandom(2024);
  const samples = Array.from({ length: 200 }, () => [randomBits(rng, 49), randomBits(rng, 49)]);

  it.each([
    ['and', and, (a, b) => a & b],
    ['or', or, (a, b) => a | b],
    ['xor', xor, (a, b) => a ^ b],
    ['andNot', andNot, (a, b) => a & ~b & ((1n << 64n) - 1n)],
  ])('%s coïncide avec BigInt sur 200 paires aléatoires', (_name, operation, reference) => {
    for (const [a, b] of samples) {
      expect(BigInt(operation(a, b))).toBe(reference(BigInt(a), BigInt(b)));
    }
  });

  it('décale et compte les bits comme BigInt', () => {
    for (const [a] of samples) {
      for (const shift of [1, 6, 7, 8, 14, 24]) {
        expect(BigInt(shiftRight(a, shift))).toBe(BigInt(a) >> BigInt(shift));
        expect(BigInt(shiftLeft(a, shift))).toBe(BigInt(a) << BigInt(shift));
      }
      expect(popCount(a)).toBe(BigInt(a).toString(2).replaceAll('0', '').length);
    }
  });

  it('partitionne la grille en lignes impaires et paires', () => {
    expect(popCount(BOARD_MASK)).toBe(42);
    expect(popCount(ODD_ROWS_MASK)).toBe(21);
    expect(and(ODD_ROWS_MASK, EVEN_ROWS_MASK)).toBe(0);
    expect(or(ODD_ROWS_MASK, EVEN_ROWS_MASK)).toBe(BOARD_MASK);
  });

  it('explore du centre vers les bords', () => {
    expect(CENTER_ORDER).toEqual([3, 2, 4, 1, 5, 0, 6]);
  });
});

describe('conversion depuis la vue du moteur', () => {
  it('place les jetons du joueur au trait dans current', () => {
    // Rouge (5,3), Jaune (4,3), Rouge (5,4) : Jaune est au trait.
    const position = positionFromView(stateAfter('445'));
    expect(position.moves).toBe(3);
    expect(position.mask).toBe(bitOf(5, 3) + bitOf(4, 3) + bitOf(5, 4));
    expect(position.current).toBe(bitOf(4, 3));
  });

  it('joue comme le moteur : même case d\'arrivée, mêmes colonnes pleines', () => {
    // Première partie aléatoire encore en cours après 16 jetons.
    const state = Array.from({ length: 30 }, (_, seed) => randomState(seed, 16)).find((candidate) => !candidate.gameOver);
    const position = positionFromView(state);
    for (let col = 0; col < 7; col++) {
      const row = landingRow(state.board, col);
      expect(canPlay(position.mask, col)).toBe(row >= 0);
      if (row >= 0) {
        expect(moveBit(position.mask, col)).toBe(bitOf(row, col));
        const next = engine.applyAction(state, { type: 'drop', column: col }, state.currentPlayerId);
        if (!next.gameOver) {
          expect(playColumn(position, col)).toEqual(positionFromView(next));
        }
      }
    }
    expect(columnsOf(playableMask(position.mask))).toEqual(
      engine.getValidActions(state, state.currentPlayerId).map((action) => action.column),
    );
  });
});

describe('détection des alignements', () => {
  /**
   * Cases vides qui feraient gagner `color`, cherchées naïvement : on pose le
   * jeton dans chaque case vide (même « en l'air ») et on demande au moteur
   * s'il forme un alignement.
   */
  function naiveWinningCells(state, color) {
    let cells = 0;
    state.board.forEach((line, row) => line.forEach((cell, col) => {
      if (cell === null && findWinningLine(withDisc(state.board, { row, col }, color), { row, col })) {
        cells += bitOf(row, col);
      }
    }));
    return cells;
  }

  it('winningCells trouve exactement les cases gagnantes, jouables ou non', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = randomState(seed, 10 + (seed % 20));
      if (state.gameOver) {
        continue;
      }
      const { current, mask } = positionFromView(state);
      const own = state.colors[state.currentPlayerId];
      const other = own === 'red' ? 'yellow' : 'red';
      expect(winningCells(current, mask)).toBe(naiveWinningCells(state, own));
      expect(winningCells(xor(current, mask), mask)).toBe(naiveWinningCells(state, other));
    }
  });

  it('hasAlignment concorde avec la fin de partie du moteur', () => {
    for (let seed = 100; seed < 160; seed++) {
      const state = randomState(seed, 42);
      const winner = state.winners?.[0];
      for (const id of Object.keys(state.colors)) {
        const stones = state.board.flatMap((line, row) => line.map((cell, col) => (cell === state.colors[id] ? bitOf(row, col) : 0)))
          .reduce((sum, bit) => sum + bit, 0);
        expect(hasAlignment(stones)).toBe(id === winner);
      }
    }
  });
});

describe('lecture tactique', () => {
  it('repère le gain immédiat du joueur au trait et la menace à bloquer', () => {
    // Rouge a posé les colonnes 1, 2 et 3 en bas ; Jaune les a recouvertes en 1 et 2.
    const yellow = readTactics(positionAfter('11223'));
    expect(columnsOf(yellow.threats)).toEqual([3]);
    expect(yellow.wins).toBe(0);
    // Jaune joue ailleurs (colonne 7) : Rouge au trait gagne en colonne 4 (index 3).
    const red = readTactics(positionAfter('112237'));
    expect(columnsOf(red.wins)).toEqual([3]);
  });

  it('signale la case sous une victoire adverse comme dangereuse', () => {
    // Rouge aligne trois jetons sur la 2e ligne en partant du bas (colonnes 1 à 3) :
    // la case au-dessus du bas de la colonne 4 est gagnante pour Rouge.
    // Jaune au trait ne doit donc pas jouer en colonne 4.
    const tactics = readTactics(positionAfter('2113372'));
    expect(columnsOf(tactics.unsafe)).toEqual([3]);
    expect(tactics.threats).toBe(0);
  });
});
