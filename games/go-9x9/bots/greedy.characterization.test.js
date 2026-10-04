/** Contrat public de GreedyBot : valeurs classées, yeux, choix de la recherche à deux demi-coups. */
import { Go9x9Engine } from '../engine.js';
import { GreedyBot } from './greedy.js';
import { SeededRandom } from '../../../lib/seeded-random.js';

const engine = new Go9x9Engine();
const place = (x, y) => ({ type: 'place', x, y });
const PASS = { type: 'pass' };

function position(black = [], white = [], player = 'black') {
  const state = engine.init({ seed: 42, playerIds: ['black', 'white'] });
  for (const [x, y] of black) { state.board[y][x] = 1; }
  for (const [x, y] of white) { state.board[y][x] = 2; }
  state.currentPlayerId = player;
  return state;
}

function label(action) { return action.type === 'place' ? `${action.x},${action.y}` : action.type; }

/** Valeurs classées par `candidates`, au micro-point près. */
function values(state, actions) {
  return new GreedyBot(engine).candidates(state, actions).map(({ action, value }) => [label(action), Number(value.toFixed(6))]);
}

describe('GreedyBot : valeur des positions (candidates)', () => {
  it('expose son identité et mémorise la couleur contrôlée', () => {
    const bot = new GreedyBot(engine);
    bot.onGameStart('white');
    expect([bot.name, bot.difficulty, bot.playerId]).toEqual(['Greedy', 'medium', 'white']);
  });

  it('classe l\'ouverture : komi, influence centrale, symétrie des coins et coût d\'une passe', () => {
    expect(values(position(), [place(4, 4), place(0, 0), place(8, 8), PASS, { type: 'resign' }])).toEqual([
      ['4,4', -90], ['0,0', -106.75], ['8,8', -106.75], ['pass', -131],
    ]);
  });

  it('valorise une capture, pénalise l\'auto-atari et distingue une et deux libertés', () => {
    expect(values(position([[3, 4], [5, 4], [4, 5]], [[4, 4]]), [place(4, 3), place(0, 0)]))
      .toEqual([['4,3', -11.5], ['0,0', -24.25]]);
    expect(values(position([[4, 4]], [[3, 4], [5, 4], [4, 5]]), [place(4, 3), place(0, 0)]))
      .toEqual([['4,3', -167.5], ['0,0', -189.25]]);
    expect(values(position([[4, 4]], [[3, 4], [5, 4]]), [place(4, 3), place(4, 5), place(0, 0)]))
      .toEqual([['4,3', -140], ['4,5', -140], ['0,0', -151.75]]);
  });

  it('plafonne le bonus de libertés d\'une longue chaîne', () => {
    const chain = Array.from({ length: 7 }, (_, index) => [index + 1, 4]);
    expect(values(position(chain), [place(0, 0), place(8, 8)])).toEqual([['0,0', 80.25], ['8,8', 80.25]]);
  });

  it('évalue du point de vue de Blanc avec le signe inversé', () => {
    expect(values(position([[4, 4]], [], 'white'), [place(5, 5), PASS])).toEqual([['5,5', 130], ['pass', 89]]);
    expect(values(position([[4, 4]]), [place(0, 0)])).toEqual([['0,0', -66.75]]);
  });

  it('utilise le score exact en fin de partie, sans pénalité de passe', () => {
    const white = position([], [[4, 4]], 'white');
    white.passesInARow = 1;
    expect(values(white, [PASS])).toEqual([['pass', 1750]]);
    const black = position([[4, 4]]);
    black.passesInARow = 1;
    expect(values(black, [PASS])).toEqual([['pass', 1490]]);
  });

  it('récompense ses yeux et retire la valeur des yeux adverses', () => {
    const ring = [[1, 0], [0, 1], [1, 1], [2, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
    expect(values(position(ring, [[7, 7]]), [place(0, 0), place(8, 8)])).toEqual([['8,8', 49.5]]);
    expect(values(position([[7, 7]], ring), [place(0, 0), place(8, 8)])).toEqual([['8,8', -272]]);
  });

  it('ignore les coups invalides, la résignation et les yeux, sans muter la position', () => {
    const state = position([[4, 4]]);
    const snapshot = JSON.stringify(state);
    const bot = new GreedyBot(engine);
    expect(bot.candidates(state, [place(4, 4), { type: 'resign' }])).toEqual([]);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('GreedyBot : reconnaissance des yeux simples', () => {
  const POINTS = [[4, 4], [4, 0], [4, 8], [0, 4], [8, 4], [0, 0], [8, 0], [0, 8], [8, 8]];
  const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAGONALS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const onBoard = ([x, y]) => x >= 0 && x < 9 && y >= 0 && y < 9;
  const around = (x, y, offsets) => offsets.map(([dx, dy]) => [x + dx, y + dy]).filter(onBoard);

  /** Anneau autour du point ; `weak` diagonales sont vides ou adverses, selon la parité. */
  function ring(x, y, weak, color) {
    const own = [...around(x, y, NEIGHBORS)];
    const opponent = [];
    around(x, y, DIAGONALS).forEach((point, index) => {
      if (index >= weak) { own.push(point); } else if (index % 2 === 1) { opponent.push(point); }
    });
    return color === 'black' ? position(own, opponent, 'black') : position(opponent, own, 'white');
  }

  function isCandidate(state, x, y) {
    const action = place(x, y);
    expect(engine.isValidAction(state, action, state.currentPlayerId)).toBe(true);
    return new GreedyBot(engine).candidates(state, [action]).length === 1;
  }

  it.each(['black', 'white'])('%s : un œil tolère une diagonale faible au centre, aucune au bord et au coin', (color) => {
    for (const [x, y] of POINTS) {
      const tolerated = around(x, y, NEIGHBORS).length === 4 ? 1 : 0;
      for (let weak = 0; weak <= around(x, y, DIAGONALS).length; weak++) {
        const state = ring(x, y, weak, color);
        expect([x, y, weak, isCandidate(state, x, y)]).toEqual([x, y, weak, weak > tolerated]);
      }
    }
  });

  it('un voisin vide ou adverse empêche d\'y voir un œil', () => {
    for (const color of ['black', 'white']) {
      const full = ring(4, 4, 0, color);
      const own = color === 'black' ? 1 : 2;
      full.board[4][3] = 0;
      expect(isCandidate(full, 4, 4)).toBe(true);
      full.board[4][3] = 3 - own;
      expect(isCandidate(full, 4, 4)).toBe(true);
    }
  });
});

describe('GreedyBot : choix déterministes', () => {
  const PLAYOUTS = [
    { seed: 1, checks: [
      [7, '2,6', [['2,5', 134], ['2,6', 133], ['1,6', 132.75]]],
      [15, '7,1', [['7,1', 126.25], ['7,2', 125.5], ['2,7', 125.5]]],
      [23, '4,0', [['4,0', 136], ['5,7', 135.5], ['7,4', 135]]],
      [31, '2,7', [['2,7', 126.25], ['4,0', 124.25], ['5,7', 123.75]]],
      [39, '3,6', [['5,7', 134.25], ['3,6', 130.75], ['2,7', 128.25]]],
    ] },
    { seed: 7, checks: [
      [7, '7,7', [['7,7', 149.5], ['0,1', 145.5], ['1,0', 144.75]]],
      [15, '3,3', [['3,3', 150.5], ['1,7', 149], ['7,7', 149]]],
      [23, '2,1', [['4,2', 158.25], ['2,1', 157.25], ['2,3', 155.75]]],
      [31, '4,2', [['4,2', 143.25], ['2,3', 139.25], ['2,0', 137.75]]],
      [39, '4,2', [['4,2', 166.75], ['2,3', 162.75], ['1,0', 147.75]]],
    ] },
    { seed: 42, checks: [
      [7, '1,2', [['2,2', 129.5], ['1,2', 127.75], ['2,1', 127.5]]],
      [15, '1,2', [['1,2', 128], ['4,7', 126.25], ['3,6', 125.5]]],
      [23, '1,2', [['1,2', 131.5], ['1,0', 131], ['1,1', 128]]],
      [31, '1,0', [['1,0', 130.25], ['1,2', 129.75], ['1,6', 129.25]]],
      [39, '1,0', [['1,0', 123.25], ['1,2', 122.75], ['2,3', 122.75]]],
    ] },
  ];

  /** Joue une partie aléatoire reproductible et rend les positions aux plies observés. */
  function playout(seed, plies) {
    let state = engine.init({ seed, playerIds: ['black', 'white'] });
    const rng = new SeededRandom(seed);
    const positions = new Map();
    for (let ply = 0; ply <= Math.max(...plies) && !state.gameOver; ply++) {
      const actions = engine.getValidActions(state, state.currentPlayerId);
      if (plies.includes(ply)) { positions.set(ply, { state, actions }); }
      state = engine.applyAction(state, rng.pick(actions.filter(a => a.type === 'place')), state.currentPlayerId);
    }
    return positions;
  }

  it.each(PLAYOUTS)('rejoue les classements et choix historiques de la partie $seed', ({ seed, checks }) => {
    const positions = playout(seed, checks.map(([ply]) => ply));
    for (const [ply, choice, top] of checks) {
      const { state, actions } = positions.get(ply);
      const bot = new GreedyBot(engine);
      expect([ply, label(bot.chooseAction(state, actions, new SeededRandom(seed + ply)))]).toEqual([ply, choice]);
      const ranked = bot.candidates(state, actions).slice(0, 3).map(({ action, value }) => [label(action), value]);
      expect(ranked.map(([name]) => name)).toEqual(top.map(([name]) => name));
      ranked.forEach(([, value], index) => expect(value).toBeCloseTo(top[index][1], 6));
    }
  });

  it('retombe sur la passe ou le premier coup quand tous les coups sont écartés', () => {
    const state = position();
    const bot = new GreedyBot(engine);
    const resign = { type: 'resign' };
    expect(bot.chooseAction(state, [resign, PASS])).toEqual(PASS);
    expect(bot.chooseAction(state, [resign])).toBe(resign);
  });

  it('retourne null sans action et utilise rngState de la vue pour départager', () => {
    const state = position();
    const bot = new GreedyBot(engine);
    expect(bot.chooseAction(state, [])).toBeNull();
    const actions = [place(0, 0), place(8, 8)];
    const viaView = bot.chooseAction({ ...state, rngState: 5 }, actions);
    expect(viaView).toEqual(bot.chooseAction(state, actions, new SeededRandom(5)));
  });

  it('départage les valeurs égales avec le générateur fourni et ne choisit que parmi les meilleures', () => {
    const state = position();
    const actions = [place(0, 0), place(8, 8), place(4, 4)];
    const picks = new Set();
    for (let seed = 0; seed < 20; seed++) { picks.add(label(new GreedyBot(engine).chooseAction(state, actions, new SeededRandom(seed)))); }
    expect([...picks]).toEqual(['4,4']);
    const tied = [place(0, 0), place(8, 8)];
    const tiedPicks = new Set();
    for (let seed = 0; seed < 20; seed++) { tiedPicks.add(label(new GreedyBot(engine).chooseAction(state, tied, new SeededRandom(seed)))); }
    expect([...tiedPicks].sort()).toEqual(['0,0', '8,8']);
  });

  it('ne regarde pas la réponse adverse quand le coup termine la partie', () => {
    const state = position([], [[4, 4]], 'white');
    state.passesInARow = 1;
    const bot = new GreedyBot(engine);
    expect(bot.chooseAction(state, [PASS, place(0, 0)], new SeededRandom(1))).toEqual(PASS);
  });

  it('crée son propre moteur par défaut et amorce le générateur à zéro sans rngState', () => {
    const state = position();
    delete state.rngState;
    const actions = [place(0, 0), place(8, 8)];
    const bot = new GreedyBot();
    expect(bot.engine).toBeInstanceOf(Go9x9Engine);
    expect(label(bot.chooseAction(state, actions))).toBe(label(bot.chooseAction(state, actions, new SeededRandom(0))));
  });

  it('conserve la valeur immédiate d\'un coup quand l\'adversaire n\'a aucune réponse à analyser', () => {
    class SilentReplies extends Go9x9Engine {
      getValidActions(state, playerId) { return playerId === 'white' ? [] : super.getValidActions(state, playerId); }
    }
    const state = position();
    const bot = new GreedyBot(new SilentReplies());
    expect(label(bot.chooseAction(state, [place(0, 0), place(4, 4), place(8, 8)], new SeededRandom(3)))).toBe('4,4');
  });
});
