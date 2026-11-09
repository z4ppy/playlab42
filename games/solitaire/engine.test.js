/**
 * Tests du moteur Solitaire : donne, règles de chaque coup, score, fin de
 * partie, immutabilité, replay, reprise JSON et absence de fuite dans la vue.
 */

import { SolitaireEngine, DEFAULT_PLAYER_ID } from './engine.js';
import { createDeck } from './engine/cards.js';
import { POINTS } from './engine/scoring.js';
import { HeuristicBot } from './bots/heuristic.js';
import { SeededRandom } from '../../lib/seeded-random.js';
import { solve } from './ai/solver.js';
import { freezeInput, jsonCopy } from '../../lib/__tests__/engine-contract-helpers.js';
import { PLAYER, board, column, foundation, move, stateWith } from './__tests__/positions.js';

const engine = new SolitaireEngine();
const config = (seed = 7, drawCount = 1, extra = {}) => ({ seed, playerIds: [PLAYER], options: { drawCount, ...extra } });

/** Applique une action en vérifiant au passage la cohérence isValidAction / applyAction. */
function play(state, action) {
  expect(engine.isValidAction(state, action, PLAYER)).toBe(true);
  return engine.applyAction(state, action, PLAYER);
}

function expectRejected(state, action) {
  expect(engine.isValidAction(state, action, PLAYER)).toBe(false);
  expect(() => engine.applyAction(state, action, PLAYER)).toThrow(/Action invalide/);
}

describe('Donne', () => {
  it('distribue 52 cartes distinctes : 28 au tableau en escalier, 24 au talon', () => {
    const { board: dealt } = engine.init(config());
    const cards = [
      ...dealt.tableau.flatMap(col => [...col.down, ...col.up]), ...dealt.stock, ...dealt.waste,
    ];
    expect(cards).toHaveLength(52);
    expect(new Set(cards)).toEqual(new Set(createDeck()));
    dealt.tableau.forEach((col, index) => {
      expect(col.down).toHaveLength(index);
      expect(col.up).toHaveLength(1);
    });
    expect(dealt.stock).toHaveLength(24);
    expect(dealt.foundations).toEqual([[], [], [], []]);
  });

  it('reproduit exactement la même donne pour une même seed, et une autre pour une autre seed', () => {
    expect(engine.init(config(123))).toEqual(engine.init(config(123)));
    expect(engine.init(config(123)).board).not.toEqual(engine.init(config(124)).board);
  });

  it('enregistre la donne, le mode de pioche et l\'état du générateur', () => {
    const state = engine.init(config(99, 3));
    expect(state).toMatchObject({ dealNumber: 99, requestedDeal: 99, winnable: null, playerId: PLAYER });
    expect(state.board.drawCount).toBe(3);
    expect(Number.isInteger(state.rngState)).toBe(true);
    expect(jsonCopy(state)).toEqual(state);
  });

  it('accepte une configuration minimale avec le joueur par défaut', () => {
    const state = engine.init({ seed: 0 });
    expect(engine.getCurrentPlayer(state)).toBe(DEFAULT_PLAYER_ID);
    expect(state.board.drawCount).toBe(1);
  });

  it.each([
    [{ seed: -1 }], [{ seed: 1.5 }], [{ seed: '3' }], [{ seed: 2 ** 32 }], [undefined],
    [{ seed: 1, playerIds: ['a', 'b'] }], [{ seed: 1, playerIds: [42] }], [{ seed: 1, playerIds: 'a' }],
    [{ seed: 1, options: { drawCount: 2 } }],
  ])('refuse la configuration invalide %j', (bad) => {
    expect(() => engine.init(bad)).toThrow(Error);
  });
});

describe('Donnes gagnables uniquement', () => {
  it('choisit une donne que le solveur prouve gagnable, de façon reproductible', () => {
    const state = engine.init(config(6, 1, { winnableOnly: true }));
    expect(state.winnable).toBe(true);
    expect(state.winnableOnly).toBe(true);
    expect(state.dealNumber).toBeGreaterThanOrEqual(6);
    expect(engine.init(config(6, 1, { winnableOnly: true }))).toEqual(state);
    expect(solve(state.board, { maxNodes: 4000, exhaustive: false }).status).toBe('winnable');
  });

  it('rejoue la donne trouvée telle quelle par son numéro', () => {
    const state = engine.init(config(6, 1, { winnableOnly: true }));
    expect(engine.init(config(state.dealNumber)).board).toEqual(state.board);
  });
});

describe('Tableau vers tableau', () => {
  const position = board({
    tableau: [column(['8S']), column(['7H']), column(['7S']), column(['9H', '8C', '7D']), column(['6C'])],
  });
  const state = stateWith(position);

  it('pose une carte sur le rang supérieur de couleur opposée', () => {
    const next = play(state, move('tableau-1', 'tableau-0'));
    expect(next.board.tableau[0].up).toEqual(['8S', '7H']);
    expect(next.board.tableau[1].up).toEqual([]);
  });

  it('refuse la même couleur, un mauvais rang et une colonne identique', () => {
    expectRejected(state, move('tableau-2', 'tableau-0'));
    expectRejected(state, move('tableau-4', 'tableau-0'));
    expectRejected(state, move('tableau-0', 'tableau-0'));
  });

  it('déplace une séquence entière ou partielle depuis la carte choisie', () => {
    const wide = stateWith(board({ tableau: [column(['TS']), column(['9H', '8C', '7D']), column(['9D'])] }));
    expect(play(wide, move('tableau-1', 'tableau-0', 3)).board.tableau[0].up).toEqual(['TS', '9H', '8C', '7D']);
    expect(play(wide, move('tableau-1', 'tableau-2', 2)).board.tableau[1].up).toEqual(['9H']);
    expectRejected(wide, move('tableau-1', 'tableau-0', 4));
    expectRejected(wide, move('tableau-1', 'tableau-0', 0));
  });

  it('n\'accepte qu\'un roi sur une colonne vide', () => {
    const empty = stateWith(board({ tableau: [column(['KD', 'QS']), column(['QH']), column([])] }));
    expect(play(empty, move('tableau-0', 'tableau-2', 2)).board.tableau[2].up).toEqual(['KD', 'QS']);
    expectRejected(empty, move('tableau-1', 'tableau-2'));
  });

  it('retourne automatiquement la carte cachée découverte et rapporte 5 points', () => {
    const hidden = stateWith(board({ tableau: [column(['8S']), column(['7H'], ['2C', 'KD'])] }));
    const next = play(hidden, move('tableau-1', 'tableau-0'));
    expect(next.board.tableau[1]).toEqual({ down: ['2C'], up: ['KD'] });
    expect(next.score).toBe(POINTS.reveal);
  });
});

describe('Défausse et fondations', () => {
  it('joue la défausse vers le tableau (+5) et vers la fondation (+10)', () => {
    const state = stateWith(board({ tableau: [column(['8S'])], waste: ['AD', '7H'], stock: ['2C'] }));
    const onTableau = play(state, move('waste', 'tableau-0'));
    expect(onTableau.board.waste).toEqual(['AD']);
    expect(onTableau.score).toBe(POINTS.wasteToTableau);
    const onFoundation = play(onTableau, move('waste', 'foundation-3'));
    expect(onFoundation.board.foundations[3]).toEqual(['AD']);
    expect(onFoundation.score).toBe(POINTS.wasteToTableau + POINTS.toFoundation);
  });

  it('monte chaque enseigne sur sa propre fondation, dans l\'ordre', () => {
    const state = stateWith(board({ tableau: [column(['2S']), column(['AS']), column(['3H'])], heights: [0, 1, 0, 0] }));
    expectRejected(state, move('tableau-0', 'foundation-0'));
    expectRejected(state, move('tableau-1', 'foundation-1'));
    const ace = play(state, move('tableau-1', 'foundation-0'));
    expect(play(ace, move('tableau-0', 'foundation-0')).board.foundations[0]).toEqual(['AS', '2S']);
    expectRejected(state, move('tableau-2', 'foundation-1'));
  });

  it('autorise le retour d\'une carte de fondation vers le tableau (−15)', () => {
    const state = stateWith(board({ tableau: [column(['8C'])], heights: [0, 7, 0, 0] }), { score: 40 });
    const next = play(state, move('foundation-1', 'tableau-0'));
    expect(next.board.foundations[1]).toHaveLength(6);
    expect(next.board.tableau[0].up).toEqual(['8C', '7H']);
    expect(next.score).toBe(40 + POINTS.foundationToTableau);
  });

  it('refuse les mouvements impossibles depuis la défausse ou les fondations', () => {
    const state = stateWith(board({ tableau: [column(['8C'])], waste: ['7H'], heights: [1, 1, 0, 0] }));
    expectRejected(state, move('waste', 'tableau-0', 2));
    expectRejected(state, move('foundation-0', 'foundation-1'));
    expectRejected(state, move('tableau-0', 'waste'));
    expectRejected(state, move('foundation-2', 'tableau-0'));
    expectRejected(stateWith(board()), move('waste', 'tableau-0'));
  });

  it('ne laisse jamais le score devenir négatif', () => {
    const state = stateWith(board({ tableau: [column(['8C'])], heights: [0, 7, 0, 0] }));
    expect(play(state, move('foundation-1', 'tableau-0')).score).toBe(0);
  });
});

describe('Talon', () => {
  it('pioche une carte en pioche 1 puis recycle la défausse dans le même ordre (−100)', () => {
    const state = stateWith(board({ tableau: [column(['KS'])], stock: ['3C', '2C', 'AC'] }), { score: 150 });
    let current = play(state, { type: 'draw' });
    expect(current.board.waste).toEqual(['AC']);
    current = play(play(current, { type: 'draw' }), { type: 'draw' });
    expect(current.board.waste).toEqual(['AC', '2C', '3C']);
    expectRejected(current, { type: 'draw' });
    const recycled = play(current, { type: 'recycle' });
    expect(recycled.board.stock).toEqual(['3C', '2C', 'AC']);
    expect(recycled.board.waste).toEqual([]);
    expect(recycled.score).toBe(150 + POINTS.recycle[1]);
  });

  it('pioche trois cartes en pioche 3, ou ce qui reste, puis recycle (−20)', () => {
    const state = stateWith(board({ drawCount: 3, tableau: [column(['KS'])], stock: ['5D', '4D', '3D', '2D', 'AD'] }), { score: 30 });
    const first = play(state, { type: 'draw' });
    expect(first.board.waste).toEqual(['AD', '2D', '3D']);
    const second = play(first, { type: 'draw' });
    expect(second.board.waste).toEqual(['AD', '2D', '3D', '4D', '5D']);
    const recycled = play(second, { type: 'recycle' });
    expect(recycled.board.stock).toEqual(['5D', '4D', '3D', '2D', 'AD']);
    expect(recycled.score).toBe(30 + POINTS.recycle[3]);
  });

  it('refuse de recycler tant que le talon n\'est pas vide, ou si la défausse est vide', () => {
    expectRejected(stateWith(board({ tableau: [column(['KS'])], stock: ['2C'], waste: ['AC'] })), { type: 'recycle' });
    expectRejected(stateWith(board({ tableau: [column(['KS'])] })), { type: 'recycle' });
  });

  it('compte les tours de talon sans aucun coup joué', () => {
    let state = stateWith(board({ tableau: [column(['KS']), column(['QD'])], stock: ['2C'] }));
    state = play(play(state, { type: 'draw' }), { type: 'recycle' });
    expect(state).toMatchObject({ passMoves: 0, stalePasses: 1 });
    state = play(state, move('tableau-1', 'tableau-0'));
    expect(state).toMatchObject({ passMoves: 1, stalePasses: 0 });
    state = play(play(state, { type: 'draw' }), { type: 'recycle' });
    expect(state).toMatchObject({ passMoves: 0, stalePasses: 0 });
  });
});

describe('Fin de partie', () => {
  it('déclare la victoire quand les quatre fondations sont complètes', () => {
    const won = play(stateWith(board({ waste: ['KS'], heights: [12, 13, 13, 13] })), move('waste', 'foundation-0'));
    expect(engine.isGameOver(won)).toBe(true);
    expect(engine.getWinners(won)).toEqual([PLAYER]);
    expect(engine.getValidActions(won, PLAYER)).toEqual([]);
    expectRejected(won, { type: 'draw' });
    expect(engine.getScores(won)).toEqual({ [PLAYER]: POINTS.toFoundation });
    expect(engine.getPlayerView(won, PLAYER)).toMatchObject({ gameOver: true, winners: [PLAYER] });
  });

  it('déclare une défaite sans gagnant quand plus aucune action n\'est possible', () => {
    // Sept colonnes occupées, aucun as, aucune carte ne se pose ailleurs : talon et défausse vides.
    const tableau = [['5S'], ['5C'], ['9S'], ['TC'], ['3S'], ['3C'], ['8C']].map(cards => column(cards));
    const stuck = play(stateWith(board({ tableau, waste: ['7H'] })), move('waste', 'tableau-6'));
    expect(engine.getValidActions(stuck, PLAYER)).toEqual([]);
    expect(engine.isGameOver(stuck)).toBe(true);
    expect(engine.getWinners(stuck)).toBeNull();
  });
});

describe('Actions invalides et joueur', () => {
  const state = freezeInput(engine.init(config()));

  it.each([
    [undefined], [null], [[]], [{}], [{ type: 'flip' }], [{ type: 'draw', extra: true }],
    [{ type: 'move', from: 'tableau-0', to: 'tableau-9', count: 1 }],
    [{ type: 'move', from: 'stock', to: 'tableau-0', count: 1 }],
    [{ type: 'move', from: 'tableau-0', to: 'tableau-1', count: '1' }],
    [{ type: 'move', from: 'tableau-0', to: 'tableau-1', count: 1.5 }],
    [{ type: 'move', from: 0, to: 'tableau-1', count: 1 }],
  ])('rejette %j par une erreur', (action) => {
    expectRejected(state, action);
  });

  it('refuse un autre joueur et ne lui propose aucune action', () => {
    expect(engine.getValidActions(state, 'intrus')).toEqual([]);
    expect(engine.isValidAction(state, { type: 'draw' }, 'intrus')).toBe(false);
    expect(() => engine.applyAction(state, { type: 'draw' }, 'intrus')).toThrow(Error);
  });

  it('propose uniquement des actions valides, chacune applicable', () => {
    const actions = engine.getValidActions(state, PLAYER);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(engine.applyAction(state, action, PLAYER)).not.toBe(state);
    }
  });
});

describe('Pureté, replay et reprise', () => {
  /** Partie jouée par le bot heuristique : une suite réaliste de coups variés. */
  function botGame(seed, drawCount, length) {
    const bot = new HeuristicBot({ maxNodes: 400 });
    const rng = new SeededRandom(seed);
    let state = engine.init(config(seed, drawCount));
    const log = [];
    while (log.length < length && !state.gameOver) {
      const action = bot.chooseAction(engine.getPlayerView(state, PLAYER), engine.getValidActions(state, PLAYER), rng);
      log.push(action);
      state = engine.applyAction(state, action, PLAYER);
    }
    return log;
  }

  it('ne mute ni l\'état reçu (objets imbriqués compris) ni l\'action', () => {
    let state = engine.init(config(3));
    for (const action of botGame(3, 1, 40)) {
      const frozen = freezeInput(jsonCopy(state));
      const snapshot = jsonCopy(frozen);
      const next = engine.applyAction(frozen, freezeInput(jsonCopy(action)), PLAYER);
      expect(frozen).toEqual(snapshot);
      expect(next.board).not.toBe(frozen.board);
      state = next;
    }
    expect(state.moves).toBe(40);
  });

  it('rejoue la même suite d\'actions état par état, y compris après JSON au milieu', () => {
    const log = botGame(11, 3, 60);
    let original = engine.init(config(11, 3));
    let replay = engine.init(config(11, 3));
    let restored = null;
    log.forEach((action, index) => {
      original = engine.applyAction(original, action, PLAYER);
      replay = engine.applyAction(replay, jsonCopy(action), PLAYER);
      expect(replay).toEqual(original);
      if (restored) {
        restored = engine.applyAction(restored, action, PLAYER);
        expect(restored).toEqual(original);
      } else if (index === 30) {
        restored = JSON.parse(JSON.stringify(original));
      }
    });
    expect(restored).toEqual(original);
  });

  it('garde des actions valides identiques après restauration JSON', () => {
    const state = engine.init(config(5));
    expect(engine.getValidActions(jsonCopy(state), PLAYER)).toEqual(engine.getValidActions(state, PLAYER));
  });
});

describe('Vue du joueur', () => {
  const state = engine.init(config(21));
  const view = engine.getPlayerView(state, PLAYER);
  const serialized = JSON.stringify(view);

  it('ne révèle aucune carte face cachée ni le contenu du talon', () => {
    const secret = [...state.board.tableau.flatMap(col => col.down), ...state.board.stock];
    expect(secret).toHaveLength(21 + 24);
    for (const card of secret) {
      expect(serialized).not.toContain(`"${card}"`);
    }
    expect(view).not.toHaveProperty('board');
    expect(view).not.toHaveProperty('rngState');
    expect(view).not.toHaveProperty('stock');
  });

  it('expose les nombres de cartes cachées, la taille du talon et les cartes visibles', () => {
    expect(view.tableau.map(col => col.downCount)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(view.tableau.map(col => col.up)).toEqual(state.board.tableau.map(col => col.up));
    expect(view).toMatchObject({ stockCount: 24, waste: [], drawCount: 1, dealNumber: 21, score: 0, moves: 0 });
  });

  it('expose la défausse retournée mais jamais l\'ordre du talon après un recyclage', () => {
    let current = state;
    for (let draw = 0; draw < 24; draw++) {
      current = play(current, { type: 'draw' });
    }
    expect(engine.getPlayerView(current, PLAYER).waste).toEqual(current.board.waste);
    const recycled = engine.getPlayerView(play(current, { type: 'recycle' }), PLAYER);
    expect(recycled.stockCount).toBe(24);
    expect(JSON.stringify(recycled)).not.toContain(`"${current.board.waste[0]}"`);
  });

  it('rend une copie : modifier la vue ne touche pas l\'état', () => {
    const copy = engine.getPlayerView(state, PLAYER);
    copy.tableau[0].up.push('XX');
    copy.foundations[0].push('XX');
    expect(state.board.tableau[0].up).toHaveLength(1);
    expect(state.board.foundations[0]).toEqual([]);
  });

  it('donne la même vue publique à un observateur', () => {
    expect(engine.getPlayerView(state, 'observateur')).toEqual(view);
  });
});

