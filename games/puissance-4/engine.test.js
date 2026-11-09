/**
 * Tests du moteur Puissance 4 : règles, contrat GameEngine, pureté et replay.
 * Les séquences de coups s'écrivent en colonnes 1 à 7, comme à l'écran.
 */

import { Puissance4Engine } from './engine.js';
import { COLUMNS, ROWS, createBoard, findWinningLine, landingRow } from './engine/board.js';
import { freezeInput, jsonCopy } from '../../lib/__tests__/engine-contract-helpers.js';

const RED = 'rouge';
const YELLOW = 'jaune';
const engine = new Puissance4Engine();

/** Nouvelle partie, Rouge commence sauf mention contraire. */
function start(firstPlayerId = RED) {
  return engine.init({ seed: 7, playerIds: [RED, YELLOW], firstPlayerId });
}

/** Joue une séquence de colonnes (« 4453 » = colonnes 4, 4, 5, 3) en alternant les joueurs. */
function play(sequence, state = start()) {
  return [...sequence].reduce(
    (current, digit) => engine.applyAction(current, { type: 'drop', column: Number(digit) - 1 }, current.currentPlayerId),
    state,
  );
}

const cellsOf = (line) => line.map(({ row, col }) => `${row},${col}`);

describe('Puissance4Engine — initialisation', () => {
  it('crée une grille vide de 6 lignes sur 7 colonnes, Rouge au trait', () => {
    const state = start();
    expect(state.board).toHaveLength(ROWS);
    expect(state.board.every((line) => line.length === COLUMNS && line.every((cell) => cell === null))).toBe(true);
    expect(state.colors).toEqual({ [RED]: 'red', [YELLOW]: 'yellow' });
    expect(state).toMatchObject({ currentPlayerId: RED, firstPlayerId: RED, turn: 1, moves: [], gameOver: false, winners: null, winningLine: null, rngState: 7 });
  });

  it('laisse Jaune commencer quand la configuration le demande', () => {
    const state = start(YELLOW);
    expect(state.currentPlayerId).toBe(YELLOW);
    expect(play('4', state).board[5][3]).toBe('yellow');
  });

  it.each([
    [{ seed: 1 }],
    [{ seed: 1, playerIds: ['seul'] }],
    [{ seed: 1, playerIds: ['a', 'a'] }],
    [{ seed: 1, playerIds: ['a', ''] }],
    [{ seed: 1, playerIds: ['a', 'b', 'c'] }],
    [{ seed: 1, playerIds: ['a', 'b'], firstPlayerId: 'c' }],
    [undefined],
  ])('refuse une configuration invalide %#', (config) => {
    expect(() => engine.init(config)).toThrow(/Puissance 4/);
  });

  it('ne modifie pas la configuration reçue', () => {
    const config = freezeInput({ seed: 3, playerIds: [RED, YELLOW] });
    expect(() => engine.init(config)).not.toThrow();
  });
});

describe('Puissance4Engine — gravité et tours', () => {
  it('fait tomber le jeton sur la case libre la plus basse et alterne les joueurs', () => {
    const state = play('444');
    expect(state.board[5][3]).toBe('red');
    expect(state.board[4][3]).toBe('yellow');
    expect(state.board[3][3]).toBe('red');
    expect(state.currentPlayerId).toBe(YELLOW);
    expect(state.turn).toBe(4);
    expect(state.moves).toEqual([
      { playerId: RED, col: 3, row: 5 },
      { playerId: YELLOW, col: 3, row: 4 },
      { playerId: RED, col: 3, row: 3 },
    ]);
  });

  it('ferme une colonne pleine aux coups et aux actions proposées', () => {
    const state = play('111111');
    expect(landingRow(state.board, 0)).toBe(-1);
    expect(engine.isValidAction(state, { type: 'drop', column: 0 }, RED)).toBe(false);
    expect(() => engine.applyAction(state, { type: 'drop', column: 0 }, RED)).toThrow(/invalide/);
    expect(engine.getValidActions(state, RED).map((action) => action.column)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('ne propose rien au joueur qui n\'a pas le trait', () => {
    const state = start();
    expect(engine.getValidActions(state, YELLOW)).toEqual([]);
    expect(engine.getValidActions(state, RED)).toHaveLength(7);
  });

  it.each([
    ['mauvais joueur', { type: 'drop', column: 3 }, YELLOW],
    ['joueur inconnu', { type: 'drop', column: 3 }, 'intrus'],
    ['colonne négative', { type: 'drop', column: -1 }, RED],
    ['colonne hors grille', { type: 'drop', column: 7 }, RED],
    ['colonne décimale', { type: 'drop', column: 2.5 }, RED],
    ['colonne en texte', { type: 'drop', column: '3' }, RED],
    ['type inconnu', { type: 'place', column: 3 }, RED],
    ['tableau', [3], RED],
    ['null', null, RED],
  ])('rejette une action invalide (%s) par une erreur, sans muter l\'état', (_label, action, playerId) => {
    const state = freezeInput(start());
    const snapshot = jsonCopy(state);
    expect(engine.isValidAction(state, action, playerId)).toBe(false);
    expect(() => engine.applyAction(state, action, playerId)).toThrow(Error);
    expect(state).toEqual(snapshot);
  });
});

describe('Puissance4Engine — victoires', () => {
  it('détecte un alignement horizontal et mémorise la ligne gagnante', () => {
    const state = play('1122334');
    expect(state.gameOver).toBe(true);
    expect(engine.getWinners(state)).toEqual([RED]);
    expect(cellsOf(state.winningLine)).toEqual(['5,0', '5,1', '5,2', '5,3']);
    expect(state.currentPlayerId).toBe(RED);
  });

  it('détecte un alignement vertical', () => {
    const state = play('1212121');
    expect(engine.getWinners(state)).toEqual([RED]);
    expect(cellsOf(state.winningLine)).toEqual(['2,0', '3,0', '4,0', '5,0']);
  });

  it('détecte une diagonale montante vers la droite', () => {
    // Rouge : (5,0) (4,1) (3,2) (2,3) ; Jaune remplit les dessous.
    const state = play('12237334444');
    expect(engine.getWinners(state)).toEqual([RED]);
    expect(cellsOf(state.winningLine)).toEqual(['5,0', '4,1', '3,2', '2,3']);
  });

  it('détecte une diagonale descendante vers la droite', () => {
    const state = play('76651554444');
    expect(engine.getWinners(state)).toEqual([RED]);
    expect(cellsOf(state.winningLine)).toEqual(['2,3', '3,4', '4,5', '5,6']);
  });

  it('reconnaît une victoire de Jaune au bord droit et en haut de la grille', () => {
    // Jaune empile la colonne 7 sur les lignes 0 à 3 (haut de la grille).
    const state = play('7177172727');
    expect(state.board[0][6]).toBe('yellow');
    expect(engine.getWinners(state)).toEqual([YELLOW]);
    expect(state.winningLine.every(({ col }) => col === 6)).toBe(true);
    expect(cellsOf(state.winningLine)).toEqual(['0,6', '1,6', '2,6', '3,6']);
  });

  it('renvoie toutes les cases d\'un alignement de cinq créé par un jeton central', () => {
    const state = play('11224455');
    expect(state.board[5].slice(0, 2)).toEqual(['red', 'red']);
    const final = play('3', state);
    expect(final.winners).toEqual([RED]);
    expect(cellsOf(final.winningLine)).toEqual(['5,0', '5,1', '5,2', '5,3', '5,4']);
  });

  it('interdit tout coup après la fin de partie', () => {
    const state = freezeInput(play('1212121'));
    expect(engine.isGameOver(state)).toBe(true);
    expect(engine.getValidActions(state, YELLOW)).toEqual([]);
    expect(() => engine.applyAction(state, { type: 'drop', column: 4 }, YELLOW)).toThrow(Error);
  });

  it('findWinningLine ignore un jeton isolé', () => {
    const board = createBoard();
    board[5][3] = 'red';
    expect(findWinningLine(board, { row: 5, col: 3 })).toBeNull();
  });
});

describe('Puissance4Engine — match nul', () => {
  // Grille pleine sans alignement : colonnes jouées par paires décalées.
  const DRAW = '121212343434565656212121434343656565777777';

  it('déclare le nul quand la grille est pleine sans alignement', () => {
    const state = play(DRAW);
    expect(state.moves).toHaveLength(42);
    expect(state.gameOver).toBe(true);
    expect(engine.getWinners(state)).toBeNull();
    expect(state.winningLine).toBeNull();
    expect(engine.getValidActions(state, state.currentPlayerId)).toEqual([]);
  });

  it('ne déclare pas la fin avant le dernier jeton', () => {
    expect(play(DRAW.slice(0, -1)).gameOver).toBe(false);
  });
});

describe('Puissance4Engine — pureté, replay et reprise', () => {
  it('ne modifie ni l\'état reçu ni ses objets imbriqués', () => {
    const before = freezeInput(play('4455'));
    const snapshot = jsonCopy(before);
    const after = engine.applyAction(before, { type: 'drop', column: 2 }, before.currentPlayerId);
    expect(before).toEqual(snapshot);
    expect(after.board).not.toBe(before.board);
    expect(after.moves).not.toBe(before.moves);
    // Seule la ligne modifiée est recopiée : les autres sont partagées sans risque.
    expect(after.board[0]).toBe(before.board[0]);
    expect(after.board[5]).not.toBe(before.board[5]);
  });

  it('rejoue une partie à l\'identique, état par état, avec reprise JSON au milieu', () => {
    const sequence = '4435526617';
    let original = start();
    let replay = start();
    const states = [];
    [...sequence].forEach((digit, index) => {
      const action = { type: 'drop', column: Number(digit) - 1 };
      original = engine.applyAction(freezeInput(original), action, original.currentPlayerId);
      // À mi-partie, on sérialise puis désérialise l'état comme une sauvegarde.
      if (index === 4) {
        replay = jsonCopy(replay);
      }
      replay = engine.applyAction(replay, action, replay.currentPlayerId);
      expect(replay).toEqual(original);
      states.push(jsonCopy(original));
    });
    const fromMoves = original.moves.reduce(
      (state, move) => engine.applyAction(state, { type: 'drop', column: move.col }, move.playerId),
      start(),
    );
    expect(fromMoves).toEqual(original);
    expect(states.at(-1)).toEqual(jsonCopy(original));
  });

  it('expose une vue complète (aucune information cachée)', () => {
    const state = play('44');
    expect(engine.getPlayerView(state, RED)).toEqual(state);
    expect(engine.getCurrentPlayer(state)).toBe(RED);
  });
});
