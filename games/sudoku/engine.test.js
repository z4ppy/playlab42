import { describe, expect, it } from '@jest/globals';
import { SudokuEngine, isSeed, isSudokuState } from './engine.js';
import { computeCandidates, digitBit, maskOf } from './engine/grid.js';
import { CLASSIC, classicSolution, deepFreeze, jsonCopy } from './engine/__tests__/fixtures.js';

const engine = new SudokuEngine();
const PLAYER = 'joueur';
const classicConfig = { seed: 3, playerIds: [PLAYER], puzzle: CLASSIC };
const start = () => engine.init(classicConfig);
const play = (state, ...actions) => actions.reduce((current, action) => engine.applyAction(current, action, PLAYER), state);
const SOLUTION = classicSolution();

// Cases de la grille classique utilisées dans les tests.
const EMPTY = 2; // L1C3, vide, solution 4, candidats {1, 2, 4}
const GIVEN = 0; // L1C1, donnée 5
const PEER = 3; // L1C4, vide, même ligne que EMPTY

describe('SudokuEngine : initialisation', () => {
  it('génère une grille reproductible à partir de la seed et du niveau', () => {
    const config = { seed: 42, playerIds: [PLAYER], difficulty: 'easy' };
    const state = engine.init(config);
    expect(engine.init(config)).toEqual(state);
    expect(engine.init({ ...config, seed: 43 }).givens).not.toEqual(state.givens);
    expect(state).toMatchObject({
      version: 1, playerId: PLAYER, seed: 42, requestedLevel: 'easy', level: 'easy', custom: false,
      checks: 0, moves: 0, errorCells: [], gameOver: false, winners: null, history: { undo: [], redo: [] },
    });
    expect(state.values).toEqual(state.givens);
    expect(state.notes).toEqual(new Array(81).fill(0));
    expect(typeof state.rngState).toBe('number');
    expect(state.rngState).not.toBe(42);
    expect(jsonCopy(state)).toEqual(state);
    expect(engine.getCurrentPlayer(state)).toBe(PLAYER);
  });

  it('prend « moyen » comme niveau par défaut', () => {
    expect(engine.init({ seed: 5, playerIds: [PLAYER] })).toMatchObject({ requestedLevel: 'medium', level: 'medium' });
  });

  it('accepte une grille imposée, vérifiée et classée', () => {
    const state = start();
    expect(state).toMatchObject({ custom: true, level: 'easy', solution: SOLUTION });
    expect(state.givens.filter(Boolean)).toHaveLength(30);
  });

  it.each([
    [undefined, 'manquante'],
    [{ ...classicConfig, seed: -1 }, 'seed'],
    [{ ...classicConfig, seed: 1.5 }, 'seed'],
    [{ ...classicConfig, seed: 2 ** 32 }, 'seed'],
    [{ ...classicConfig, playerIds: [] }, 'seul'],
    [{ ...classicConfig, playerIds: ['a', 'b'] }, 'seul'],
    [{ ...classicConfig, playerIds: [7] }, 'seul'],
    [{ ...classicConfig, difficulty: 'cauchemar' }, 'Niveau inconnu'],
    [{ ...classicConfig, puzzle: '1'.repeat(81) }, 'exactement une solution'],
    [{ ...classicConfig, puzzle: '.'.repeat(81) }, 'exactement une solution'],
    [{ ...classicConfig, puzzle: 'abc' }, '81 caractères'],
  ])('refuse une configuration invalide (%#)', (config, message) => {
    expect(() => engine.init(config)).toThrow(message);
  });

  it('valide les seeds sur 32 bits', () => {
    expect(isSeed(0)).toBe(true);
    expect(isSeed(4294967295)).toBe(true);
    expect(isSeed('1')).toBe(false);
  });
});

describe('SudokuEngine : saisie, notes et effacement', () => {
  it('pose un chiffre dans une case vide et refuse une case donnée', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 4 });
    expect(state.values[EMPTY]).toBe(4);
    expect(state.moves).toBe(1);
    expect(engine.isValidAction(state, { type: 'place', cell: GIVEN, value: 1 }, PLAYER)).toBe(false);
    expect(() => play(state, { type: 'place', cell: GIVEN, value: 1 })).toThrow('invalide');
    expect(() => play(state, { type: 'erase', cell: GIVEN })).toThrow();
    expect(() => play(state, { type: 'note', cell: GIVEN, value: 1 })).toThrow();
    // Reposer le même chiffre n'est pas un coup.
    expect(engine.isValidAction(state, { type: 'place', cell: EMPTY, value: 4 }, PLAYER)).toBe(false);
  });

  it('accepte un chiffre en conflit : le joueur a le droit de se tromper', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 5 });
    expect(state.values[EMPTY]).toBe(5);
    expect(state.gameOver).toBe(false);
  });

  it('bascule les notes et les efface quand on pose un chiffre', () => {
    let state = play(start(),
      { type: 'note', cell: EMPTY, value: 1 },
      { type: 'note', cell: EMPTY, value: 4 },
      { type: 'note', cell: PEER, value: 4 },
      { type: 'note', cell: PEER, value: 2 },
      { type: 'note', cell: 40, value: 4 });
    expect(state.notes[EMPTY]).toBe(maskOf([1, 4]));
    state = play(state, { type: 'note', cell: EMPTY, value: 1 });
    expect(state.notes[EMPTY]).toBe(digitBit(4));
    state = play(state, { type: 'place', cell: EMPTY, value: 4 });
    // La case perd ses notes, ses pairs perdent le 4, une case sans lien garde le sien.
    expect(state.notes[EMPTY]).toBe(0);
    expect(state.notes[PEER]).toBe(digitBit(2));
    expect(state.notes[40]).toBe(digitBit(4));
    expect(engine.isValidAction(state, { type: 'note', cell: EMPTY, value: 3 }, PLAYER)).toBe(false);
  });

  it('efface un chiffre ou des notes, et refuse d’effacer une case vide', () => {
    const empty = start();
    expect(engine.isValidAction(empty, { type: 'erase', cell: EMPTY }, PLAYER)).toBe(false);
    const filled = play(empty, { type: 'place', cell: EMPTY, value: 4 }, { type: 'erase', cell: EMPTY });
    expect(filled.values[EMPTY]).toBe(0);
    const noted = play(empty, { type: 'note', cell: EMPTY, value: 2 }, { type: 'erase', cell: EMPTY });
    expect(noted.notes[EMPTY]).toBe(0);
  });

  it('remplit les notes automatiquement avec les candidats', () => {
    const state = play(start(), { type: 'fillNotes' });
    const candidates = computeCandidates(state.values);
    expect(state.notes).toEqual(candidates);
    expect(engine.isValidAction(state, { type: 'fillNotes' }, PLAYER)).toBe(false);
    const after = play(state, { type: 'place', cell: EMPTY, value: 4 });
    expect(engine.isValidAction(after, { type: 'fillNotes' }, PLAYER)).toBe(false);
  });

  it('recommence la grille sans toucher aux données', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 4 }, { type: 'note', cell: PEER, value: 2 }, { type: 'restart' });
    expect(state.values).toEqual(state.givens);
    expect(state.notes.every((mask) => mask === 0)).toBe(true);
    expect(engine.isValidAction(state, { type: 'restart' }, PLAYER)).toBe(false);
    expect(play(state, { type: 'undo' }).values[EMPTY]).toBe(4);
  });
});

describe('SudokuEngine : annuler, refaire', () => {
  it('annule et refait chaque changement, notes comprises', () => {
    const initial = start();
    const placed = play(initial, { type: 'note', cell: PEER, value: 4 }, { type: 'place', cell: EMPTY, value: 4 });
    const undone = play(placed, { type: 'undo' });
    expect(undone.values).toEqual(initial.values);
    expect(undone.notes[PEER]).toBe(digitBit(4));
    expect(engine.getPlayerView(undone, PLAYER)).toMatchObject({ canUndo: true, canRedo: true });
    const redone = play(undone, { type: 'redo' });
    expect(redone.values).toEqual(placed.values);
    expect(redone.notes).toEqual(placed.notes);
    const twice = play(redone, { type: 'undo' }, { type: 'undo' });
    expect(twice.values).toEqual(initial.values);
    expect(twice.notes).toEqual(initial.notes);
  });

  it('un nouveau coup vide la pile « refaire »', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 4 }, { type: 'undo' }, { type: 'place', cell: EMPTY, value: 2 });
    expect(engine.isValidAction(state, { type: 'redo' }, PLAYER)).toBe(false);
    expect(engine.isValidAction(start(), { type: 'undo' }, PLAYER)).toBe(false);
  });
});

describe('SudokuEngine : vérification des erreurs', () => {
  it('signale les chiffres faux sans révéler la solution', () => {
    let state = play(start(), { type: 'place', cell: EMPTY, value: 1 }, { type: 'place', cell: PEER, value: SOLUTION[PEER] });
    state = play(state, { type: 'check' });
    expect(state.errorCells).toEqual([EMPTY]);
    expect(state.checks).toBe(1);
    const view = engine.getPlayerView(state, PLAYER);
    expect(view.errorCells).toEqual([EMPTY]);
    expect(view).not.toHaveProperty('solution');
    // Corriger la case retire son marquage.
    expect(play(state, { type: 'erase', cell: EMPTY }).errorCells).toEqual([]);
  });

  it('refuse la vérification tant qu’aucun chiffre n’est posé', () => {
    expect(engine.isValidAction(start(), { type: 'check' }, PLAYER)).toBe(false);
  });
});

describe('SudokuEngine : fin de partie', () => {
  const solveAll = (state) => state.values.reduce((current, value, cell) => (
    value === 0 ? play(current, { type: 'place', cell, value: SOLUTION[cell] }) : current
  ), state);

  it('déclare la victoire quand la grille correspond à la solution', () => {
    const won = solveAll(start());
    expect(engine.isGameOver(won)).toBe(true);
    expect(engine.getWinners(won)).toEqual([PLAYER]);
    expect(engine.getCurrentPlayer(won)).toBeNull();
    expect(engine.getValidActions(won, PLAYER)).toEqual([]);
    expect(engine.isValidAction(won, { type: 'undo' }, PLAYER)).toBe(false);
    expect(() => play(won, { type: 'undo' })).toThrow();
  });

  it('une grille pleine mais fausse ne gagne pas', () => {
    const full = solveAll(play(start(), { type: 'place', cell: EMPTY, value: 1 }));
    // EMPTY porte 1 : la boucle a ignoré cette case remplie.
    expect(full.values.includes(0)).toBe(false);
    expect(engine.isGameOver(full)).toBe(false);
    expect(engine.getWinners(full)).toBeNull();
    const actions = engine.getValidActions(full, PLAYER);
    expect(actions).toContainEqual({ type: 'erase', cell: EMPTY });
    expect(actions.every((action) => action.type === 'erase')).toBe(true);
    expect(actions).toHaveLength(51);
  });
});

describe('SudokuEngine : actions invalides et joueurs', () => {
  it.each([
    undefined, null, 'place', [], {}, { type: 'UNKNOWN' }, { type: 'toString' },
    { type: 'place', cell: EMPTY }, { type: 'place', cell: EMPTY, value: 0 }, { type: 'place', cell: EMPTY, value: 10 },
    { type: 'place', cell: EMPTY, value: '4' }, { type: 'place', cell: 81, value: 4 }, { type: 'place', cell: -1, value: 4 },
    { type: 'place', cell: 2.5, value: 4 }, { type: 'note', cell: EMPTY, value: 1.5 }, { type: 'erase' },
    { type: 'undo' }, { type: 'redo' }, { type: 'check' }, { type: 'restart' },
  ])('refuse %p sans modifier l’état', (action) => {
    const state = deepFreeze(start());
    const snapshot = jsonCopy(state);
    expect(engine.isValidAction(state, action, PLAYER)).toBe(false);
    expect(() => engine.applyAction(state, action, PLAYER)).toThrow(Error);
    expect(jsonCopy(state)).toEqual(snapshot);
  });

  it('refuse un autre joueur', () => {
    const state = start();
    const action = { type: 'place', cell: EMPTY, value: 4 };
    expect(engine.isValidAction(state, action, 'intrus')).toBe(false);
    expect(() => engine.applyAction(state, action, 'intrus')).toThrow();
    expect(engine.getValidActions(state, 'intrus')).toEqual([]);
  });
});

describe('SudokuEngine : pureté, rejeu et reprise', () => {
  const SCRIPT = [
    { type: 'note', cell: PEER, value: 2 },
    { type: 'note', cell: PEER, value: 6 },
    { type: 'place', cell: EMPTY, value: 1 },
    { type: 'check' },
    { type: 'erase', cell: EMPTY },
    { type: 'place', cell: EMPTY, value: 4 },
    { type: 'fillNotes' },
    { type: 'undo' },
    { type: 'redo' },
    { type: 'place', cell: 1 + 9 * 8, value: SOLUTION[73] },
    { type: 'restart' },
    { type: 'undo' },
  ];

  it('ne modifie jamais l’état reçu, objets imbriqués compris', () => {
    let state = start();
    for (const action of SCRIPT) {
      const frozen = deepFreeze(jsonCopy(state));
      const snapshot = jsonCopy(frozen);
      state = engine.applyAction(frozen, deepFreeze({ ...action }), PLAYER);
      expect(frozen).toEqual(snapshot);
      expect(state).not.toBe(frozen);
    }
  });

  it('rejoue la même suite d’états, y compris après une reprise JSON au milieu', () => {
    const states = [];
    let state = start();
    for (const action of SCRIPT) {
      state = engine.applyAction(state, action, PLAYER);
      states.push(state);
    }
    let replay = start();
    SCRIPT.forEach((action, index) => {
      replay = engine.applyAction(index === 6 ? jsonCopy(replay) : replay, jsonCopy(action), PLAYER);
      expect(replay).toEqual(states[index]);
    });
  });

  it('reconnaît un état sauvegardé et refuse une donnée corrompue', () => {
    const state = jsonCopy(play(start(), { type: 'place', cell: EMPTY, value: 4 }));
    expect(isSudokuState(state)).toBe(true);
    expect(isSudokuState(null)).toBe(false);
    expect(isSudokuState({ ...state, version: 2 })).toBe(false);
    expect(isSudokuState({ ...state, values: state.values.slice(1) })).toBe(false);
    expect(isSudokuState({ ...state, notes: new Array(81).fill(1024) })).toBe(false);
    expect(isSudokuState({ ...state, history: {} })).toBe(false);
    expect(isSudokuState({ ...state, level: 'cauchemar' })).toBe(false);
  });
});

describe('SudokuEngine : vue du joueur et actions proposées', () => {
  it('cache la solution, l’historique et l’état du RNG', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 4 });
    const view = engine.getPlayerView(state, PLAYER);
    expect(view).not.toHaveProperty('solution');
    expect(view).not.toHaveProperty('history');
    expect(view).not.toHaveProperty('rngState');
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(SOLUTION));
    expect(view).toMatchObject({ values: state.values, givens: state.givens, canUndo: true, canRedo: false });
    view.values[EMPTY] = 9;
    expect(state.values[EMPTY]).toBe(4);
  });

  it('propose les candidats des cases vides et l’effacement des chiffres du joueur, tous valides', () => {
    const state = play(start(), { type: 'place', cell: EMPTY, value: 1 });
    const actions = engine.getValidActions(state, PLAYER);
    expect(actions).toContainEqual({ type: 'erase', cell: EMPTY });
    expect(actions.filter((action) => action.cell === PEER).map((action) => action.value)).toEqual([2, 6]);
    expect(actions.some((action) => state.givens[action.cell] !== 0)).toBe(false);
    for (const action of actions) {
      expect(engine.isValidAction(state, action, PLAYER)).toBe(true);
    }
    expect(actions.length).toBeLessThanOrEqual(81 * 9);
  });
});
