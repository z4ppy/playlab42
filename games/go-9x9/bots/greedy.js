/**
 * Bot Greedy pour Go 9x9
 * Heuristique simple : privilégie les captures nettes, sinon un coup valide aléatoire.
 */

import { SeededRandom } from '/lib/seeded-random.js';
import { Go9x9Engine } from '../engine.js';

function cloneState(state) {
    return {
        ...state,
        board: state.board.map((row) => [...row]),
        captures: { ...state.captures },
        previousBoard: state.previousBoard ? state.previousBoard.map((row) => [...row]) : null,
    };
}

export class GreedyBot {
    constructor(engine = new Go9x9Engine()) {
        this.name = 'Greedy';
        this.description = 'Capture dès que possible, sinon coup plausible.';
        this.difficulty = 'medium';
        this.engine = engine;
        this.playerId = null;
    }

    onGameStart(playerId) {
        this.playerId = playerId;
    }

    chooseAction(view, validActions, rng = new SeededRandom(view.rngState || Date.now())) {
        if (!this.playerId) {
            this.playerId = view.currentPlayerId;
        }

        let bestScore = -Infinity;
        const bestActions = [];

        for (const action of validActions) {
            let score = 0;

            if (action.type === 'place') {
                const simState = cloneState(view);
                try {
                    const next = this.engine.applyAction(simState, action, this.playerId);
                    const capturedDelta = next.captures[this.playerId] - view.captures[this.playerId];
                    score = capturedDelta * 10;
                } catch (err) {
                    score = -Infinity;
                }
            } else if (action.type === 'pass') {
                score = -1; // on évite de passer sauf nécessité
            } else {
                score = -5; // résignation à éviter
            }

            if (score > bestScore) {
                bestScore = score;
                bestActions.length = 0;
                bestActions.push(action);
            } else if (score === bestScore) {
                bestActions.push(action);
            }
        }

        return rng.pick(bestActions);
    }
}

export default GreedyBot;
