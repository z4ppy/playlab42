/**
 * Bot Random pour Go 9x9
 */

import { SeededRandom } from '/lib/seeded-random.js';

export class RandomBot {
    constructor() {
        this.name = 'Random';
        this.description = 'Joue un coup légal aléatoire, passe si rien.';
        this.difficulty = 'easy';
    }

    chooseAction(view, validActions, rng = new SeededRandom(view.rngState || Date.now())) {
        const placeActions = validActions.filter((a) => a.type === 'place');
        if (placeActions.length > 0) {
            return rng.pick(placeActions);
        }
        // Aucun coup légal, passer si possible
        const pass = validActions.find((a) => a.type === 'pass');
        return pass || validActions[0];
    }

    onGameStart(playerId) {
        this.playerId = playerId;
    }
}

export default RandomBot;
