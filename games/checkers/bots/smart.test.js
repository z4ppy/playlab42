import { jest } from '@jest/globals';
import { CheckersEngine } from '../engine.js';
import { SmartBot } from './smart.js';

const WIN = 10000;
const LOSS = -10000;
const PLAYERS = ['a', 'b'];

function emptyBoard() {
  return Array.from({ length: 10 }, () => Array(10).fill(null));
}

/** Position jouable construite à la main, avec Blanc (joueur 0) ou Noir au trait. */
function position(pieces, currentPlayer = 0) {
  const board = emptyBoard();
  for (const [row, col, player, type = 'pawn'] of pieces) { board[row][col] = { type, player }; }
  return { board, currentPlayer, status: 'playing', winner: null, moveHistory: [], playerIds: PLAYERS };
}

function terminal(value) {
  if (value === WIN) { return { ...position([]), status: 'won', winner: 0 }; }
  if (value === LOSS) { return { ...position([]), status: 'won', winner: 1 }; }
  return { ...position([]), status: 'draw' };
}

/** Nœud d'un arbre de jeu simulé : les enfants sont adressés par l'identifiant de l'action. */
function node(currentPlayer, children, board = emptyBoard()) {
  return {
    board, currentPlayer, status: 'playing', winner: null, moveHistory: [], playerIds: PLAYERS,
    actions: Object.keys(children).map(id => ({ type: 'move', id })), children,
  };
}

describe('SmartBot : contrat public', () => {
  let applied;
  beforeEach(() => {
    applied = [];
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  function mockTree() {
    jest.spyOn(CheckersEngine.prototype, 'getValidActions').mockImplementation(state => state.actions ?? []);
    jest.spyOn(CheckersEngine.prototype, 'applyAction').mockImplementation((state, action, playerId) => {
      applied.push(`${action.id}:${playerId}`);
      const child = state.children[action.id];
      if (child instanceof Error) { throw child; }
      return child;
    });
  }

  function choose(root) {
    return new SmartBot().chooseAction(root, root.actions, null);
  }

  it('métadonnées et cas sans choix : aucune action, une seule action sans recherche', () => {
    const bot = new SmartBot();
    expect([bot.name, bot.difficulty]).toEqual(['Smart', 'medium']);
    expect(bot.chooseAction({}, [])).toBeNull();
    const only = { id: 'seule' };
    expect(bot.chooseAction({}, [only])).toBe(only);
  });

  it('retient la première action de score maximal (égalité stricte) et le meilleur score ensuite', () => {
    mockTree();
    const tie = node(0, { a: terminal(0), b: terminal(0), c: terminal(0) });
    expect(choose(tie).id).toBe('a');
    const better = node(0, { a: terminal(LOSS), b: terminal(0), c: terminal(WIN), d: terminal(WIN) });
    expect(choose(better).id).toBe('c');
  });

  it('applique chaque action racine avec le joueur courant', () => {
    mockTree();
    choose(node(1, { a: terminal(0), b: terminal(0) }));
    expect(applied).toEqual(['a:b', 'b:b']);
  });

  it('minimise puis maximise en alternance sur la profondeur de recherche', () => {
    mockTree();
    // a : l'adversaire choisit le pire (0) ; b : il ne peut qu'offrir la victoire.
    const root = node(0, {
      a: node(1, { x: node(0, { p: terminal(WIN), q: terminal(LOSS) }), y: terminal(0) }),
      b: node(1, { x: terminal(WIN) }),
    });
    expect(choose(root).id).toBe('b');
  });

  it('coupe alpha-bêta sans visiter les branches inutiles', () => {
    mockTree();
    const root = node(0, {
      a: node(1, {
        x: node(0, {
          p1: node(1, { w: terminal(WIN) }),
          p2: node(1, { d: terminal(0), l: terminal(LOSS) }),
        }),
      }),
    });
    expect(new SmartBot().chooseAction(root, [...root.actions, { id: 'a2' }], null).id).toBe('a');
    expect(applied).toContain('d:b');
    expect(applied).not.toContain('l:b');
  });

  it('coupe côté minimisation lorsque le maximum déjà garanti dépasse la borne', () => {
    mockTree();
    const sub = node(1, {
      x: node(0, { p: terminal(LOSS), q: terminal(WIN) }),
      y: node(0, { r: terminal(WIN), s: terminal(0) }),
      z: terminal(LOSS),
    });
    const root = node(0, { a: sub, b: terminal(LOSS) });
    expect(choose(root).id).toBe('a');
    expect(applied).toContain('r:a');
  });

  it('une action racine qui lève est journalisée puis ignorée', () => {
    mockTree();
    const root = node(0, { bad: new Error('coup invalide'), good: terminal(LOSS) });
    expect(choose(root).id).toBe('good');
    expect(console.error).toHaveBeenCalledWith('Erreur lors de l\'évaluation:', expect.any(Error));
  });

  it('retourne la première action si toutes lèvent', () => {
    mockTree();
    const root = node(0, { first: new Error('1'), second: new Error('2') });
    expect(choose(root).id).toBe('first');
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('ignore silencieusement les erreurs aux nœuds internes, des deux côtés', () => {
    mockTree();
    const root = node(0, {
      a: node(1, { boom: new Error('min'), x: node(0, { err: new Error('max'), v: terminal(WIN) }) }),
      b: terminal(0),
    });
    expect(choose(root).id).toBe('a');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('un nœud sans action légale est évalué sur son plateau', () => {
    mockTree();
    const root = node(0, { loses: node(1, {}, position([[5, 4, 1]]).board), wins: node(1, {}, position([[5, 4, 0]]).board) });
    expect(choose(root).id).toBe('wins');
  });

  describe('évaluation matérielle et positionnelle (joueur 0)', () => {
    function better(worse, best, currentPlayer = 0) {
      mockTree();
      const root = node(currentPlayer, {
        worse: node(1 - currentPlayer, {}, worse), best: node(1 - currentPlayer, {}, best),
      });
      const first = choose(root).id;
      applied = [];
      const swapped = node(currentPlayer, {
        best: node(1 - currentPlayer, {}, best), worse: node(1 - currentPlayer, {}, worse),
      });
      return [first, choose(swapped).id];
    }
    const board = (...pieces) => position(pieces).board;

    it('préfère les pions avancés', () => {
      expect(better(board([2, 3, 0]), board([6, 3, 0]))).toEqual(['best', 'best']);
    });
    it('préfère les pions centraux', () => {
      expect(better(board([4, 0, 0]), board([4, 4, 0]))).toEqual(['best', 'best']);
    });
    it('valorise une dame plus qu\'un pion et une dame centrale plus qu\'une dame de coin', () => {
      expect(better(board([5, 5, 0]), board([5, 5, 0, 'king']))).toEqual(['best', 'best']);
      expect(better(board([0, 0, 0, 'king']), board([4, 5, 0, 'king']))).toEqual(['best', 'best']);
    });
    it('retranche les pièces adverses', () => {
      expect(better(board([5, 5, 0], [6, 6, 1]), board([5, 5, 0]))).toEqual(['best', 'best']);
      expect(better(board([5, 5, 0], [6, 6, 1, 'king']), board([5, 5, 0], [6, 6, 1]))).toEqual(['best', 'best']);
    });
    it('joue le point de vue du joueur 1 avec un avancement inversé', () => {
      expect(better(board([7, 3, 1]), board([2, 3, 1]), 1)).toEqual(['best', 'best']);
      expect(better(board([5, 5, 1], [4, 4, 0]), board([5, 5, 1]), 1)).toEqual(['best', 'best']);
    });
  });

  describe('parties réelles', () => {
    const engine = new CheckersEngine();
    function play(state, plies) {
      const bot = new SmartBot();
      const moves = [];
      for (let i = 0; i < plies && state.status === 'playing'; i++) {
        const id = state.playerIds[state.currentPlayer];
        const action = bot.chooseAction(state, engine.getValidActions(state, id));
        moves.push(`${action.from.row}${action.from.col}-${action.to.row}${action.to.col}`);
        state = engine.applyAction(state, action, id);
      }
      return moves;
    }

    it('rejoue exactement la séquence de choix historique depuis la position initiale', () => {
      const state = engine.init({ seed: 1, playerIds: PLAYERS });
      expect(play(state, 14)).toEqual([
        '38-47', '65-56', '47-65', '74-56', '36-47', '56-38', '29-47',
        '67-56', '47-65', '76-54', '32-43', '54-32', '21-43', '61-52',
      ]);
    });

    it('capture quand la règle l\'impose et conserve le détail de la prise', () => {
      const state = { ...engine.init({ seed: 1, playerIds: PLAYERS }), ...position([[3, 2, 0], [4, 3, 1]]) };
      expect(new SmartBot().chooseAction(state, engine.getValidActions(state, 'a'))).toEqual({
        type: 'move', from: { row: 3, col: 2 }, to: { row: 5, col: 4 }, captured: [{ row: 4, col: 3 }],
      });
    });

    it('choisit les mêmes coups avec dames et côté Noir, sans modifier l\'état', () => {
      const white = { ...engine.init({ seed: 1, playerIds: PLAYERS }), ...position([[4, 5, 0, 'king'], [9, 0, 1]]) };
      const black = { ...engine.init({ seed: 1, playerIds: PLAYERS }), ...position([[0, 9, 0], [5, 4, 1, 'king']], 1) };
      const snapshot = JSON.stringify([white, black]);
      const bot = new SmartBot();
      expect(bot.chooseAction(white, engine.getValidActions(white, 'a')).to).toEqual({ row: 5, col: 4 });
      expect(bot.chooseAction(black, engine.getValidActions(black, 'b')).to).toEqual({ row: 6, col: 3 });
      expect(JSON.stringify([white, black])).toBe(snapshot);
    });
  });
});
