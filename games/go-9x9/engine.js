/**
 * Go 9x9 - Moteur isomorphe
 * Règles : plateau 9x9, ko simple, suicide interdit, scoring chinois avec komi 6.5.
 * Validation et énumération partagent le même contrôle suicide/ko ; le score
 * distingue le comptage des pierres et l'exploration des régions vides.
 *
 * @typedef {{type: 'place', x: number, y: number} | {type: 'pass' | 'resign'}} GoAction
 * @typedef {{seed: number, playerIds: [string, string]}} GoConfig
 * @typedef {Object} GoState
 * @property {number} boardSize
 * @property {number[][]} board
 * @property {string | null} currentPlayerId
 * @property {[string, string]} playerIds
 * @property {boolean} gameOver
 * @property {string[] | null} winners
 * @property {number} turn
 * @property {number} rngState
 * @property {number} komi
 * @property {Record<string, number>} captures
 * @property {number} passesInARow
 * @property {number[][] | null} previousBoard
 * @property {GoAction | null} lastMove
 * @property {{black: number, white: number} | null} scores
 */

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 9;
const KOMI = 6.5;

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function boardsEqual(a, b) {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (a[y][x] !== b[y][x]) {return false;}
    }
  }
  return true;
}

function getOpposite(color) {
  return color === BLACK ? WHITE : BLACK;
}

function inBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function getNeighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => inBounds(nx, ny));
}

function countStones(board) {
  let black = 0;
  let white = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === BLACK) {black++;}
      if (board[y][x] === WHITE) {white++;}
    }
  }
  return { black, white };
}

function floodTerritory(board) {
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
  let black = 0;
  let white = 0;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY || visited[y][x]) {continue;}

      const { size, borders } = collectTerritory(board, visited, x, y);
      if (borders.size === 1) {
        if (borders.has(BLACK)) {
          black += size;
        } else {
          white += size;
        }
      }
    }
  }

  return { black, white };
}

/** Explore une région vide ; les frontières mixtes restent neutres. */
function collectTerritory(board, visited, x, y) {
  const queue = [[x, y]];
  visited[y][x] = true;
  let size = 0;
  const borders = new Set();
  while (queue.length) {
    const [cx, cy] = queue.pop();
    size++;
    for (const [nx, ny] of getNeighbors(cx, cy)) {
      const cell = board[ny][nx];
      if (cell === EMPTY && !visited[ny][nx]) {
        visited[ny][nx] = true;
        queue.push([nx, ny]);
      } else if (cell === BLACK || cell === WHITE) {
        borders.add(cell);
      }
    }
  }
  return { size, borders };
}

function availableIntersection(board, x, y) {
  return Number.isInteger(x) && Number.isInteger(y)
    && inBounds(x, y) && board[y][x] === EMPTY;
}

function cloneState(state) {
  return {
    ...state,
    board: cloneBoard(state.board),
    captures: { ...state.captures },
    previousBoard: state.previousBoard ? cloneBoard(state.previousBoard) : null,
  };
}

export class Go9x9Engine {
  /** @param {GoConfig} config @returns {GoState} */
  init(config) {
    return {
      boardSize: BOARD_SIZE,
      board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY)),
      currentPlayerId: config.playerIds[0],
      playerIds: config.playerIds,
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
      komi: KOMI,
      captures: {
        [config.playerIds[0]]: 0,
        [config.playerIds[1]]: 0,
      },
      passesInARow: 0,
      previousBoard: null,
      lastMove: null,
      scores: null,
    };
  }

  /**
   * @param {GoState} state
   * @param {GoAction} action
   * @param {string} playerId
   * @returns {GoState}
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    const newState = cloneState(state);
    newState.previousBoard = cloneBoard(state.board);
    newState.turn = state.turn + 1;
    newState.lastMove = action;

    if (action.type === 'pass') {
      newState.passesInARow += 1;
      newState.currentPlayerId = this.#nextPlayer(state);
      if (newState.passesInARow >= 2) {
        this.#finalizeScore(newState);
      }
      return newState;
    }

    if (action.type === 'resign') {
      newState.gameOver = true;
      newState.winners = [this.#nextPlayer(state)];
      newState.currentPlayerId = null;
      newState.passesInARow = 0;
      return newState;
    }

    // Placement
    const color = this.#colorForPlayer(state, playerId);
    const { board, captured } = this.#simulatePlacement(state, action.x, action.y, color);

    newState.board = board;
    newState.passesInARow = 0;
    newState.currentPlayerId = this.#nextPlayer(state);
    newState.captures[playerId] += captured;

    return newState;
  }

  /**
   * @param {GoState} state
   * @param {GoAction} action
   * @param {string} playerId
   * @returns {boolean}
   */
  isValidAction(state, action, playerId) {
    if (state.gameOver || state.currentPlayerId !== playerId) {return false;}
    if (!action || typeof action !== 'object' || Array.isArray(action)) {return false;}
    if (action.type === 'pass' || action.type === 'resign') {return true;}

    if (action.type !== 'place') {return false;}
    const { x, y } = action;
    if (!availableIntersection(state.board, x, y)) {return false;}

    const color = this.#colorForPlayer(state, playerId);
    return this.#isLegalPlacement(state, x, y, color);
  }

  /** @param {GoState} state @param {string} playerId @returns {GoAction[]} */
  getValidActions(state, playerId) {
    if (state.gameOver || state.currentPlayerId !== playerId) {return [];}

    const actions = [];
    const color = this.#colorForPlayer(state, playerId);

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (state.board[y][x] !== EMPTY) {continue;}
        if (!this.#isLegalPlacement(state, x, y, color)) {continue;}
        actions.push({ type: 'place', x, y });
      }
    }

    actions.push({ type: 'pass' });
    actions.push({ type: 'resign' });
    return actions;
  }

  /** @param {GoState} state @param {string} _playerId @returns {GoState} */
  getPlayerView(state, _playerId) {
    return state;
  }

  /** @param {GoState} state @returns {boolean} */
  isGameOver(state) {
    return state.gameOver;
  }

  /** @param {GoState} state @returns {string[] | null} */
  getWinners(state) {
    return state.winners;
  }

  /** @param {GoState} state @returns {string | null} */
  getCurrentPlayer(state) {
    return state.currentPlayerId;
  }

  /** @param {GoState} state @returns {Record<string, number> | null} */
  getScores(state) {
    return state.scores ? {
      [state.playerIds[0]]: state.scores.black,
      [state.playerIds[1]]: state.scores.white,
    } : null;
  }

  #colorForPlayer(state, playerId) {
    return state.playerIds[0] === playerId ? BLACK : WHITE;
  }

  #nextPlayer(state) {
    return state.currentPlayerId === state.playerIds[0]
      ? state.playerIds[1]
      : state.playerIds[0];
  }

  /** Suicide et ko ont exactement les mêmes critères en validation et énumération. */
  #isLegalPlacement(state, x, y, color) {
    const sim = this.#simulatePlacement(state, x, y, color);
    return !sim.suicide && !(state.previousBoard && boardsEqual(sim.board, state.previousBoard));
  }

  #simulatePlacement(state, x, y, color) {
    const board = cloneBoard(state.board);
    board[y][x] = color;
    const opponent = getOpposite(color);
    let captured = 0;

    // Capturer les groupes adverses sans libertés
    for (const [nx, ny] of getNeighbors(x, y)) {
      if (board[ny][nx] !== opponent) {continue;}
      const groupInfo = this.#collectGroup(board, nx, ny);
      if (groupInfo.liberties === 0) {
        captured += groupInfo.positions.length;
        for (const [gx, gy] of groupInfo.positions) {
          board[gy][gx] = EMPTY;
        }
      }
    }

    // Vérifier suicide (libertés du groupe joué)
    const selfGroup = this.#collectGroup(board, x, y);
    const suicide = selfGroup.liberties === 0;

    return { board, captured, suicide };
  }

  #collectGroup(board, x, y) {
    const color = board[y][x];
    const stack = [[x, y]];
    const visited = new Set();
    const positions = [];
    let liberties = 0;

    while (stack.length) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;
      if (visited.has(key)) {continue;}
      visited.add(key);
      positions.push([cx, cy]);

      for (const [nx, ny] of getNeighbors(cx, cy)) {
        const cell = board[ny][nx];
        if (cell === EMPTY) {
          liberties += 1;
        } else if (cell === color) {
          stack.push([nx, ny]);
        }
      }
    }

    return { positions, liberties };
  }

  #finalizeScore(state) {
    const stones = countStones(state.board);
    const territory = floodTerritory(state.board);

    const blackScore = stones.black + territory.black;
    const whiteScore = stones.white + territory.white + state.komi;

    state.scores = { black: blackScore, white: whiteScore };
    state.gameOver = true;
    state.currentPlayerId = null;

    if (blackScore === whiteScore) {
      state.winners = null;
    } else if (blackScore > whiteScore) {
      state.winners = [state.playerIds[0]];
    } else {
      state.winners = [state.playerIds[1]];
    }
  }
}

export default Go9x9Engine;
