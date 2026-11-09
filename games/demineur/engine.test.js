/**
 * Tests du moteur du Démineur : règles, contrat moteur, déterminisme et secret des mines.
 */
import { MinesweeperEngine, LEVELS, STATUS } from './engine.js';
import { neighborTable } from './engine/grid.js';
import { SeededRandom } from '../../lib/seeded-random.js';
import { freezeInput, jsonCopy } from '../../lib/__tests__/engine-contract-helpers.js';
import { playingState } from './__tests__/boards.js';

const engine = new MinesweeperEngine();
const P = 'p1';
const play = (state, type, index) => engine.applyAction(state, { type, index }, P);

// Mur de mines en colonne 4 (x = 4) + une mine en bas à droite : 10 mines en Débutant.
//   0 1 2 3 4 5 6 7 8
//   . . . . * . . . .
//   ...      (lignes 1 à 7 identiques)
//   . . . . * . . . *
const WALL = [4, 13, 22, 31, 40, 49, 58, 67, 76, 80];
const LEFT_SIDE = Array.from({ length: 81 }, (_, index) => index).filter(index => index % 9 < 4);

describe('init', () => {
  it('prépare une grille fermée sans mines avant le premier clic', () => {
    const state = engine.init({ seed: 42, playerIds: [P] });
    expect(state).toMatchObject({
      playerId: P, level: 'beginner', width: 9, height: 9, mineCount: 10,
      noGuess: true, status: STATUS.READY, mines: null, generation: null, moves: 0, rngState: 42,
    });
    expect(state.marks).toHaveLength(81);
    expect(new Set(state.marks)).toEqual(new Set(['hidden']));
    expect(engine.isGameOver(state)).toBe(false);
    expect(engine.getWinners(state)).toBeNull();
    expect(engine.getCurrentPlayer(state)).toBe(P);
  });

  it.each(Object.values(LEVELS))('respecte les dimensions du niveau $label', (level) => {
    const state = engine.init({ seed: 1, level: level.id });
    expect([state.width, state.height, state.mineCount]).toEqual([level.width, level.height, level.mines]);
    expect(state.marks).toHaveLength(level.width * level.height);
    expect(state.playerId).toBe('joueur');
  });

  it('est déterministe, normalise la seed et ne modifie pas la configuration', () => {
    const config = freezeInput({ seed: -1, playerIds: [P], level: 'expert', noGuess: false });
    expect(engine.init(config)).toEqual(engine.init(jsonCopy(config)));
    expect(engine.init(config).rngState).toBe(4294967295);
  });

  it.each([
    [undefined, /Configuration/],
    [{ seed: Number.NaN }, /seed/],
    [{ seed: 1, level: 'facile' }, /Niveau inconnu/],
    [{ seed: 1, level: 'toString' }, /Niveau inconnu/],
    [{ seed: 1, noGuess: 'oui' }, /noGuess/],
    [{ seed: 1, playerIds: ['a', 'b'] }, /seul/],
    [{ seed: 1, playerIds: [''] }, /seul/],
    [{ seed: 1, playerIds: 'p1' }, /seul/],
  ])('refuse une configuration invalide (%#)', (config, message) => {
    expect(() => engine.init(config)).toThrow(message);
  });
});

describe('premier clic', () => {
  const cases = [];
  for (let seed = 1; seed <= 12; seed++) {
    for (const index of [0, 8, 40, 72, 80]) { cases.push([seed, index]); }
  }

  it.each(cases)('seed %i, case %i : la case et ses voisines sont sans mine, une zone s\'ouvre', (seed, index) => {
    const state = play(engine.init({ seed, playerIds: [P], noGuess: seed % 2 === 0 }), 'reveal', index);
    const zone = [index, ...neighborTable(9, 9)[index]];
    expect(state.mines).toHaveLength(10);
    expect(new Set(state.mines).size).toBe(10);
    expect(zone.some(cell => state.mines.includes(cell))).toBe(false);
    expect(engine.getPlayerView(state, P).cells[index]).toBe(0);
    expect(state.marks.filter(mark => mark === 'open').length).toBeGreaterThan(zone.length - 1);
    expect(state.status).not.toBe(STATUS.LOST);
  });

  it('tire la grille de façon reproductible à partir de la seed et du clic', () => {
    const first = play(engine.init({ seed: 7, playerIds: [P] }), 'reveal', 40);
    const again = play(engine.init({ seed: 7, playerIds: [P] }), 'reveal', 40);
    const elsewhere = play(engine.init({ seed: 7, playerIds: [P] }), 'reveal', 0);
    expect(again).toEqual(first);
    expect(elsewhere.mines).not.toEqual(first.mines);
    expect(first.rngState).not.toBe(7);
    expect(first.mines).toEqual([...first.mines].sort((a, b) => a - b));
  });

  it('garantit une grille sans hasard par défaut et la signale', () => {
    for (const level of ['beginner', 'intermediate']) {
      const state = play(engine.init({ seed: 3, level, playerIds: [P] }), 'reveal', 0);
      expect(state.generation).toEqual({ attempts: expect.any(Number), guaranteed: true });
    }
    const classic = play(engine.init({ seed: 3, noGuess: false, playerIds: [P] }), 'reveal', 0);
    expect(classic.generation).toEqual({ attempts: 1, guaranteed: false });
  });
});

describe('ouverture et cascade', () => {
  it('ouvre en cascade toute la zone sans mine jusqu\'aux chiffres', () => {
    const state = play(playingState(WALL), 'reveal', 0);
    const opened = state.marks.flatMap((mark, index) => (mark === 'open' ? [index] : []));
    expect(opened).toEqual(LEFT_SIDE);
    const view = engine.getPlayerView(state, P);
    expect(view.cells[3]).toBe(2);
    expect(view.cells[12]).toBe(3);
    expect(view.cells[0]).toBe(0);
    expect(view.openedCount).toBe(36);
    expect(state.status).toBe(STATUS.PLAYING);
    expect(state.moves).toBe(1);
  });

  it('n\'ouvre qu\'une case quand elle porte un chiffre', () => {
    const state = play(playingState(WALL), 'reveal', 3);
    expect(state.marks.filter(mark => mark === 'open')).toHaveLength(1);
  });

  it('respecte les drapeaux pendant la cascade', () => {
    const flagged = play(play(playingState(WALL), 'reveal', 3), 'toggleFlag', 9);
    const state = play(flagged, 'reveal', 0);
    expect(state.marks[9]).toBe('flag');
    expect(state.marks[18]).toBe('open');
  });

  it('peut gagner d\'un seul clic quand la cascade ouvre tout', () => {
    const state = play(playingState([72, 73, 74, 75, 76, 77, 78, 79, 80, 8]), 'reveal', 40);
    expect(state.status).toBe(STATUS.WON);
    expect(engine.getWinners(state)).toEqual([P]);
  });
});

describe('drapeaux', () => {
  it('pose puis retire un drapeau et tient le compte des mines restantes', () => {
    const start = play(playingState(WALL), 'reveal', 0);
    const flagged = play(start, 'toggleFlag', 4);
    expect(flagged.marks[4]).toBe('flag');
    expect(engine.getPlayerView(flagged, P)).toMatchObject({ flagsPlaced: 1, minesLeft: 9 });
    const removed = play(flagged, 'toggleFlag', 4);
    expect(removed.marks[4]).toBe('hidden');
    expect(removed.moves).toBe(3);
  });

  it('laisse le compteur devenir négatif avec trop de drapeaux', () => {
    let state = play(playingState(WALL), 'reveal', 0);
    for (let index = 45; index < 81; index++) {
      if (state.marks[index] === 'hidden') { state = play(state, 'toggleFlag', index); }
    }
    expect(engine.getPlayerView(state, P).minesLeft).toBeLessThan(0);
  });

  it('refuse un drapeau avant le premier clic, sur une case ouverte, et l\'ouverture d\'une case drapée', () => {
    const ready = engine.init({ seed: 1, playerIds: [P] });
    expect(() => play(ready, 'toggleFlag', 0)).toThrow('ouvrez d\'abord une case');
    const start = play(playingState(WALL), 'reveal', 0);
    expect(() => play(start, 'toggleFlag', 0)).toThrow('case ouverte');
    const flagged = play(start, 'toggleFlag', 4);
    expect(() => play(flagged, 'reveal', 4)).toThrow('sans drapeau');
    expect(engine.isValidAction(flagged, { type: 'reveal', index: 4 }, P)).toBe(false);
  });
});

describe('accord', () => {
  // La case 3 (colonne 4, ligne 1) affiche 2 : ses mines sont 4 et 13.
  const opened3 = play(playingState(WALL), 'reveal', 3);

  it('ouvre les voisines d\'un chiffre dont les drapeaux sont au complet', () => {
    const ready = play(play(opened3, 'toggleFlag', 4), 'toggleFlag', 13);
    expect(engine.isValidAction(ready, { type: 'chord', index: 3 }, P)).toBe(true);
    const state = play(ready, 'chord', 3);
    // La voisine 2 est un « 0 » : la cascade ouvre toute la partie gauche.
    expect(LEFT_SIDE.every(index => state.marks[index] === 'open')).toBe(true);
    expect(state.status).toBe(STATUS.PLAYING);
  });

  it('fait exploser une mine quand un drapeau est faux', () => {
    const wrong = play(play(opened3, 'toggleFlag', 4), 'toggleFlag', 12);
    const state = play(wrong, 'chord', 3);
    expect(state.status).toBe(STATUS.LOST);
    const view = engine.getPlayerView(state, P);
    expect(view.cells[13]).toBe('exploded');
    expect(view.cells[12]).toBe('wrong-flag');
    expect(view.cells[4]).toBe('flag');
    expect(view.cells[80]).toBe('mine');
    expect(engine.getWinners(state)).toBeNull();
  });

  it.each([
    ['avec un seul drapeau', state => play(state, 'toggleFlag', 4), 3],
    ['sur une case fermée', state => state, 5],
    ['sans voisine fermée restante', state => play(play(play(state, 'reveal', 0), 'toggleFlag', 4), 'toggleFlag', 13), 3],
    ['sur un « 0 »', state => play(state, 'reveal', 0), 0],
  ])('est refusé %s', (_, prepare, index) => {
    const state = prepare(opened3);
    expect(engine.isValidAction(state, { type: 'chord', index }, P)).toBe(false);
    expect(() => play(state, 'chord', index)).toThrow('accord');
  });
});

describe('fin de partie', () => {
  it('perd en ouvrant une mine et révèle mines et drapeaux faux', () => {
    const flagged = play(play(play(playingState(WALL), 'reveal', 0), 'toggleFlag', 13), 'toggleFlag', 5);
    const state = play(flagged, 'reveal', 4);
    expect(engine.isGameOver(state)).toBe(true);
    const view = engine.getPlayerView(state, P);
    expect(view.status).toBe(STATUS.LOST);
    expect(view.cells[4]).toBe('exploded');
    expect(view.cells[13]).toBe('flag');
    expect(view.cells[5]).toBe('wrong-flag');
    expect(view.cells[22]).toBe('mine');
    expect(view.cells[6]).toBe('hidden');
  });

  it('gagne quand toutes les cases sans mine sont ouvertes, mines affichées en drapeaux', () => {
    let state = playingState(WALL);
    for (let index = 0; index < 81; index++) {
      if (!WALL.includes(index) && state.marks[index] === 'hidden') { state = play(state, 'reveal', index); }
    }
    expect(state.status).toBe(STATUS.WON);
    expect(engine.getWinners(state)).toEqual([P]);
    const view = engine.getPlayerView(state, P);
    expect(WALL.every(index => view.cells[index] === 'flag')).toBe(true);
    expect(view.openedCount).toBe(view.safeCount);
  });

  it('interdit toute action après la fin', () => {
    const lost = play(playingState(WALL), 'reveal', 4);
    expect(engine.getValidActions(lost, P)).toEqual([]);
    expect(() => play(lost, 'reveal', 0)).toThrow('terminée');
  });
});

describe('actions invalides', () => {
  const state = freezeInput(play(playingState(WALL), 'reveal', 0));
  const snapshot = jsonCopy(state);

  it.each([
    [null, 'objet'], [[], 'objet'], ['reveal', 'objet'],
    [{ type: 'dig', index: 5 }, 'inconnu'], [{ index: 5 }, 'inconnu'],
    [{ type: 'reveal' }, 'indice'], [{ type: 'reveal', index: -1 }, 'indice'],
    [{ type: 'reveal', index: 81 }, 'indice'], [{ type: 'reveal', index: 1.5 }, 'indice'],
    [{ type: 'reveal', index: '5' }, 'indice'], [{ type: 'reveal', index: 0 }, 'sans drapeau'],
  ])('refuse %j sans modifier l\'état', (action, message) => {
    expect(engine.isValidAction(state, action, P)).toBe(false);
    expect(() => engine.applyAction(state, action, P)).toThrow(message);
    expect(jsonCopy(state)).toEqual(snapshot);
  });

  it('refuse un autre joueur, sans lui proposer d\'action ni lui montrer la grille', () => {
    const action = { type: 'reveal', index: 5 };
    expect(engine.isValidAction(state, action, P)).toBe(true);
    expect(engine.isValidAction(state, action, 'intrus')).toBe(false);
    expect(() => engine.applyAction(state, action, 'intrus')).toThrow('joueur inconnu');
    expect(engine.getValidActions(state, 'intrus')).toEqual([]);
    expect(() => engine.getPlayerView(state, 'intrus')).toThrow('Joueur inconnu');
  });
});

describe('actions valides', () => {
  it('propose les 81 ouvertures au départ, sans drapeau', () => {
    const actions = engine.getValidActions(engine.init({ seed: 1, playerIds: [P] }), P);
    expect(actions).toHaveLength(81);
    expect(actions.every(action => action.type === 'reveal')).toBe(true);
  });

  it('est cohérent avec isValidAction et inclut drapeaux et accords en cours de partie', () => {
    const state = play(play(play(playingState(WALL), 'reveal', 3), 'toggleFlag', 4), 'toggleFlag', 13);
    const actions = engine.getValidActions(state, P);
    expect(actions).toContainEqual({ type: 'chord', index: 3 });
    expect(actions).toContainEqual({ type: 'toggleFlag', index: 4 });
    expect(actions).not.toContainEqual({ type: 'reveal', index: 4 });
    expect(actions.filter(action => action.type === 'reveal')).toHaveLength(78);
    expect(actions.every(action => engine.isValidAction(state, action, P))).toBe(true);
  });
});

describe('pureté et sérialisation', () => {
  it('ne modifie jamais l\'état reçu, y compris ses tableaux imbriqués', () => {
    let state = freezeInput(engine.init({ seed: 5, playerIds: [P] }));
    for (const [type, index] of [['reveal', 40], ['toggleFlag', 0], ['toggleFlag', 0]]) {
      const snapshot = jsonCopy(state);
      const next = play(state, type, index);
      expect(jsonCopy(state)).toEqual(snapshot);
      expect(next.marks).not.toBe(state.marks);
      state = freezeInput(next);
    }
  });

  /**
   * Partie seedée mêlant ouvertures, drapeaux et accords.
   * @param {number} seed - Seed du moteur et du choix des actions.
   * @returns {{states: object[], log: object[]}}
   */
  function scriptedGame(seed) {
    const rng = new SeededRandom(seed);
    let state = engine.init({ seed, level: 'intermediate', playerIds: [P] });
    const states = [state];
    const log = [];
    while (!engine.isGameOver(state) && log.length < 60) {
      const action = rng.pick(engine.getValidActions(state, P));
      log.push(action);
      state = engine.applyAction(freezeInput(state), action, P);
      states.push(state);
    }
    return { states, log };
  }

  it('rejoue une partie identique état par état à partir du journal', () => {
    const { states, log } = scriptedGame(11);
    expect(log.length).toBeGreaterThan(3);
    let replay = engine.init({ seed: 11, level: 'intermediate', playerIds: [P] });
    expect(replay).toEqual(states[0]);
    jsonCopy(log).forEach((action, step) => {
      replay = engine.applyAction(replay, action, P);
      expect(replay).toEqual(states[step + 1]);
    });
  });

  it('reprend après JSON.parse(JSON.stringify(state)) au milieu de la partie', () => {
    const { states, log } = scriptedGame(23);
    const middle = Math.floor(log.length / 2);
    let resumed = jsonCopy(states[middle]);
    log.slice(middle).forEach((action, offset) => {
      resumed = jsonCopy(engine.applyAction(resumed, action, P));
      expect(resumed).toEqual(states[middle + offset + 1]);
      expect(engine.getPlayerView(resumed, P)).toEqual(engine.getPlayerView(states[middle + offset + 1], P));
    });
  });
});

describe('vue joueur', () => {
  const allowedDuringPlay = value => value === 'hidden' || value === 'flag' || Number.isInteger(value);

  it('ne contient aucune mine, ni l\'état du générateur, tant que la partie dure', () => {
    let state = play(play(engine.init({ seed: 9, level: 'expert', playerIds: [P] }), 'reveal', 0), 'toggleFlag', 479);
    const view = engine.getPlayerView(state, P);
    expect(view).not.toHaveProperty('mines');
    expect(view).not.toHaveProperty('rngState');
    expect(view).not.toHaveProperty('marks');
    expect(view.cells.every(allowedDuringPlay)).toBe(true);
    // Les cases fermées minées et non minées ont exactement le même aspect.
    const hiddenMine = state.mines.find(index => state.marks[index] === 'hidden');
    const hiddenSafe = state.marks.findIndex((mark, index) => mark === 'hidden' && !state.mines.includes(index));
    expect(view.cells[hiddenMine]).toBe(view.cells[hiddenSafe]);
    state = { ...state, mines: [...state.mines].reverse() };
    expect(engine.getPlayerView(state, P).cells).toEqual(view.cells);
  });

  it('expose le bilan de génération sans partager la référence de l\'état', () => {
    const state = play(engine.init({ seed: 2, playerIds: [P] }), 'reveal', 10);
    const view = engine.getPlayerView(state, P);
    expect(view.generation).toEqual(state.generation);
    expect(view.generation).not.toBe(state.generation);
    expect(engine.getPlayerView(engine.init({ seed: 2, playerIds: [P] }), P).generation).toBeNull();
  });
});
