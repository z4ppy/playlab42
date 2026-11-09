/**
 * Recherche négamax : exactitude prouvée contre un solveur naïf, gains forcés
 * connus, déterminisme du budget et table de transposition.
 */

import { CELLS, and, canPlay, hasAlignment, moveBit, or, playColumn, playableMask, positionFromView, winningCells, xor } from '../bitboard.js';
import { DEFAULT_BUDGET, Search, WIN_SCORE, evaluate, isDecisive, safeMoves, searchPosition, winScore } from '../search.js';
import { EXACT, LOWER, TranspositionTable, UPPER } from '../transposition-table.js';
import { positionAfter, randomState } from './helpers.js';

const UNLIMITED = { maxNodes: Infinity };

/**
 * Solveur naïf, sans élagage ni table : valeur exacte selon la même convention.
 * Réservé aux fins de partie (quelques cases libres).
 */
function naiveScore({ current, mask, moves }) {
  if (moves === CELLS) {
    return 0;
  }
  let best = -Infinity;
  for (let col = 0; col < 7; col++) {
    if (!canPlay(mask, col)) {
      continue;
    }
    if (hasAlignment(or(current, moveBit(mask, col)))) {
      return winScore(moves + 1);
    }
    best = Math.max(best, -naiveScore(playColumn({ current, mask, moves }, col)));
  }
  return best;
}

/** Le joueur au trait peut-il forcer la victoire en `plies` demi-coups au plus ? (naïf) */
function canForceWin(position, plies) {
  if (plies <= 0 || position.moves === CELLS) {
    return false;
  }
  const columns = [0, 1, 2, 3, 4, 5, 6].filter((col) => canPlay(position.mask, col));
  return columns.some((col) => hasAlignment(or(position.current, moveBit(position.mask, col)))
    || (plies >= 3 && opponentCannotEscape(playColumn(position, col), plies - 1)));
}

/** Toutes les réponses de l'adversaire laissent-elles un gain forcé ? */
function opponentCannotEscape(position, plies) {
  const columns = [0, 1, 2, 3, 4, 5, 6].filter((col) => canPlay(position.mask, col));
  return columns.length > 0 && columns.every((col) => !hasAlignment(or(position.current, moveBit(position.mask, col)))
    && canForceWin(playColumn(position, col), plies - 1));
}

describe('scores et coups sûrs', () => {
  it('une victoire plus rapide vaut plus, et reste décisive', () => {
    expect(winScore(7)).toBeGreaterThan(winScore(9));
    expect(isDecisive(winScore(42))).toBe(true);
    expect(isDecisive(-winScore(42))).toBe(true);
    expect(isDecisive(999)).toBe(false);
  });

  it('deux menaces adverses jouables ne laissent aucun coup sûr', () => {
    // Jaune au trait face à Rouge en 3, 4, 5 sur la ligne du bas, colonnes 2 et 6 libres.
    const { current, mask } = positionAfter('33445');
    expect(safeMoves(playableMask(mask), winningCells(xor(current, mask), mask))).toBe(0);
  });

  it('l\'évaluation récompense les cases gagnantes et le centre', () => {
    const neutral = evaluate(0, 0, 0, 0, 0);
    expect(neutral).toBe(0);
    expect(evaluate(0, 0, 0, 1, 0)).toBeGreaterThan(neutral);
    expect(evaluate(0, 0, 0, 0, 1)).toBeLessThan(neutral);
    const center = positionAfter('4');
    // Jaune au trait : le jeton central rouge compte contre lui.
    expect(evaluate(center.current, center.mask, center.moves, 0, 0)).toBeLessThan(0);
  });
});

describe('gains forcés connus', () => {
  it('joue le gain immédiat sans chercher plus loin', () => {
    const result = searchPosition(positionAfter('112237'));
    expect(result).toMatchObject({ bestMoves: [3], score: winScore(7), depth: 1, solved: true, nodes: 0 });
  });

  it('trouve la double menace : victoire forcée en 2 coups', () => {
    // Rouge (4, 3) en bas, Jaune par-dessus : jouer en 2 ou 5 ouvre deux cases gagnantes.
    const result = searchPosition(positionAfter('4433'));
    expect(result.solved).toBe(true);
    expect(result.score).toBe(winScore(7));
    expect([...result.bestMoves].sort()).toEqual([1, 4]);
  });

  it('bloque la seule menace adverse', () => {
    const result = searchPosition(positionAfter('11223'));
    expect(result.bestMoves).toEqual([3]);
  });

  it('reconnaît une défaite inévitable et la retarde', () => {
    const result = searchPosition(positionAfter('33445'));
    expect(result.score).toBe(-winScore(7));
    expect(result.solved).toBe(true);
  });

  it('chaque gain forcé annoncé est confirmé par un solveur naïf, à la bonne distance', () => {
    let checked = 0;
    for (let seed = 1; seed <= 120 && checked < 12; seed++) {
      const state = randomState(seed, 12 + (seed % 10));
      if (state.gameOver) {
        continue;
      }
      const position = positionFromView(state);
      const result = new Search().run(position, { maxNodes: 200_000 });
      const plies = WIN_SCORE - result.score - position.moves;
      if (result.score <= 0 || !isDecisive(result.score) || plies > 5) {
        continue;
      }
      checked++;
      expect(canForceWin(position, plies)).toBe(true);
      expect(canForceWin(position, plies - 2)).toBe(false);
      for (const col of result.bestMoves) {
        expect(opponentCannotEscape(playColumn(position, col), plies - 1)
          || hasAlignment(or(position.current, moveBit(position.mask, col)))).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});

describe('exactitude en fin de partie', () => {
  it('donne le même score exact que le solveur naïf (élagage et table sans erreur)', () => {
    let compared = 0;
    for (let seed = 1; seed <= 1500 && compared < 15; seed++) {
      const state = randomState(seed, 33);
      if (state.gameOver || state.moves.length !== 33) {
        continue;
      }
      const position = positionFromView(state);
      const result = new Search().run(position, UNLIMITED);
      expect(result.solved).toBe(true);
      expect(result.score).toBe(naiveScore(position));
      compared++;
    }
    expect(compared).toBeGreaterThanOrEqual(10);
  });
});

describe('budget et reproductibilité', () => {
  it('rend le même résultat à budget égal, quel que soit l\'historique des appels', () => {
    const position = positionAfter('4453');
    const budget = { maxNodes: 30_000 };
    const search = new Search();
    const first = search.run(position, budget);
    search.run(positionAfter('1'), budget);
    expect(search.run(position, budget)).toEqual(first);
    expect(new Search().run(position, budget)).toEqual(first);
  });

  it('termine toujours la première itération, même avec un budget minuscule', () => {
    const result = new Search().run(positionAfter(''), { maxNodes: 1 });
    expect(result.depth).toBe(1);
    expect(result.bestMoves.length).toBeGreaterThan(0);
    expect(result.solved).toBe(false);
  });

  it('respecte la profondeur maximum demandée', () => {
    const result = new Search().run(positionAfter('44'), { maxDepth: 3, maxNodes: Infinity });
    expect(result.depth).toBe(3);
    expect(new Search().run(positionAfter('44'), { maxDepth: 0 }).depth).toBe(1);
  });

  it('approfondit nettement au-delà de 10 demi-coups avec le budget par défaut', () => {
    const result = searchPosition(positionAfter('4453'), DEFAULT_BUDGET);
    expect(result.depth).toBeGreaterThanOrEqual(12);
    expect(result.nodes).toBeLessThanOrEqual(DEFAULT_BUDGET.maxNodes + 1);
  });

  it('donne des scores par colonne cohérents avec le meilleur coup', () => {
    const result = new Search().run(positionAfter('44'), { maxNodes: 20_000 });
    for (const col of result.bestMoves) {
      expect(result.scores[col]).toBe(result.score);
    }
    for (const score of Object.values(result.scores)) {
      expect(score).toBeLessThanOrEqual(result.score);
    }
  });

  it('résout une grille presque pleine jusqu\'au nul', () => {
    const position = positionAfter('121212343434565656212121434343656565777');
    const result = searchPosition(position, UNLIMITED);
    expect(result).toMatchObject({ score: 0, solved: true });
  });
});

describe('table de transposition', () => {
  it('mémorise, retrouve, remplace et vide les entrées', () => {
    const table = new TranspositionTable(7);
    expect(table.get(3)).toBeNull();
    table.set(3, { depth: 4, score: -12, flag: LOWER, move: 2 });
    expect(table.get(3)).toEqual({ depth: 4, score: -12, flag: LOWER, move: 2 });
    // 10 % 7 === 3 : collision, la nouvelle entrée remplace l'ancienne.
    table.set(10, { depth: 1, score: 5, flag: UPPER, move: -1 });
    expect(table.get(3)).toBeNull();
    expect(table.get(10)).toMatchObject({ flag: UPPER, score: 5 });
    table.set(0, { depth: 2, score: 0, flag: EXACT, move: 3 });
    expect(table.get(0)).toMatchObject({ flag: EXACT });
    table.clear();
    expect(table.get(10)).toBeNull();
    expect(table.get(0)).toBeNull();
  });
});

describe('cohérence tactique sur des positions aléatoires', () => {
  it('ne rate jamais un gain immédiat ni ne laisse un gain adverse évitable', () => {
    for (let seed = 300; seed < 360; seed++) {
      const state = randomState(seed, 6 + (seed % 25));
      if (state.gameOver) {
        continue;
      }
      const position = positionFromView(state);
      const { bestMoves } = new Search().run(position, { maxNodes: 5_000 });
      const playable = playableMask(position.mask);
      const wins = and(playable, winningCells(position.current, position.mask));
      const safe = safeMoves(playable, winningCells(xor(position.current, position.mask), position.mask));
      for (const col of bestMoves) {
        const bit = moveBit(position.mask, col);
        if (wins !== 0) {
          expect(and(wins, bit)).not.toBe(0);
        } else if (safe !== 0) {
          expect(and(safe, bit)).not.toBe(0);
        }
      }
    }
  });
});
