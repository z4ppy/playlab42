/**
 * Go 9x9 - Moteur isomorphe
 * Règles : plateau 9x9, ko simple, suicide interdit, scoring chinois avec komi 6.5.
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
            if (a[y][x] !== b[y][x]) return false;
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
            if (board[y][x] === BLACK) black++;
            if (board[y][x] === WHITE) white++;
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
            if (board[y][x] !== EMPTY || visited[y][x]) continue;

            const queue = [[x, y]];
            visited[y][x] = true;
            const empties = [];
            const borders = new Set();

            while (queue.length) {
                const [cx, cy] = queue.pop();
                empties.push([cx, cy]);

                for (const [nx, ny] of getNeighbors(cx, cy)) {
                    const cell = board[ny][nx];
                    if (cell === EMPTY && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        queue.push([nx, ny]);
                    } else if (cell === BLACK) {
                        borders.add(BLACK);
                    } else if (cell === WHITE) {
                        borders.add(WHITE);
                    }
                }
            }

            if (borders.size === 1) {
                const owner = borders.has(BLACK) ? BLACK : WHITE;
                if (owner === BLACK) {
                    black += empties.length;
                } else {
                    white += empties.length;
                }
            }
        }
    }

    return { black, white };
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

    isValidAction(state, action, playerId) {
        if (state.gameOver || state.currentPlayerId !== playerId) return false;
        if (action.type === 'pass' || action.type === 'resign') return true;

        if (action.type !== 'place') return false;
        const { x, y } = action;
        if (!inBounds(x, y)) return false;
        if (state.board[y][x] !== EMPTY) return false;

        const color = this.#colorForPlayer(state, playerId);
        const sim = this.#simulatePlacement(state, x, y, color);

        // Suicide interdit
        if (sim.suicide) return false;

        // Ko simple : ne pas recréer le plateau précédent
        if (state.previousBoard && boardsEqual(sim.board, state.previousBoard)) return false;

        return true;
    }

    getValidActions(state, playerId) {
        if (state.gameOver || state.currentPlayerId !== playerId) return [];

        const actions = [];
        const color = this.#colorForPlayer(state, playerId);

        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (state.board[y][x] !== EMPTY) continue;
                const sim = this.#simulatePlacement(state, x, y, color);
                if (sim.suicide) continue;
                if (state.previousBoard && boardsEqual(sim.board, state.previousBoard)) continue;
                actions.push({ type: 'place', x, y });
            }
        }

        actions.push({ type: 'pass' });
        actions.push({ type: 'resign' });
        return actions;
    }

    getPlayerView(state, _playerId) {
        return state;
    }

    isGameOver(state) {
        return state.gameOver;
    }

    getWinners(state) {
        return state.winners;
    }

    getCurrentPlayer(state) {
        return state.currentPlayerId;
    }

    getScores(state) {
        return state.scores;
    }

    #colorForPlayer(state, playerId) {
        return state.playerIds[0] === playerId ? BLACK : WHITE;
    }

    #nextPlayer(state) {
        return state.currentPlayerId === state.playerIds[0]
            ? state.playerIds[1]
            : state.playerIds[0];
    }

    #simulatePlacement(state, x, y, color) {
        const board = cloneBoard(state.board);
        board[y][x] = color;
        const opponent = getOpposite(color);
        let captured = 0;

        // Capturer les groupes adverses sans libertés
        for (const [nx, ny] of getNeighbors(x, y)) {
            if (board[ny][nx] !== opponent) continue;
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
            if (visited.has(key)) continue;
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
