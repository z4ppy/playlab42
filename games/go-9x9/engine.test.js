/**
 * Tests unitaires pour Go9x9Engine
 */

import { Go9x9Engine } from './engine.js';

const black = 'black';
const white = 'white';

function makeConfig() {
    return { seed: 42, playerIds: [black, white] };
}

function play(engine, state, action, playerId) {
    return engine.applyAction(state, action, playerId);
}

describe('Go9x9Engine', () => {
    let engine;

    beforeEach(() => {
        engine = new Go9x9Engine();
    });

    it('initialise un plateau 9x9 vide avec komi 6.5', () => {
        const state = engine.init(makeConfig());
        expect(state.board.length).toBe(9);
        expect(state.board[0].length).toBe(9);
        expect(state.board.every((row) => row.every((c) => c === 0))).toBe(true);
        expect(state.currentPlayerId).toBe(black);
        expect(state.komi).toBe(6.5);
        expect(state.captures[black]).toBe(0);
        expect(state.captures[white]).toBe(0);
    });

    it('permet de placer un pion et change de joueur', () => {
        let state = engine.init(makeConfig());
        state = play(engine, state, { type: 'place', x: 4, y: 4 }, black);
        expect(state.board[4][4]).toBe(1);
        expect(state.currentPlayerId).toBe(white);
        expect(state.turn).toBe(2);
    });

    it('refuse un suicide', () => {
        let state = engine.init(makeConfig());
        // Noir encercle (0,0)
        state = play(engine, state, { type: 'place', x: 1, y: 0 }, black);
        state = play(engine, state, { type: 'place', x: 0, y: 2 }, white); // filler
        state = play(engine, state, { type: 'place', x: 0, y: 1 }, black);
        state = play(engine, state, { type: 'place', x: 2, y: 0 }, white); // filler
        state = play(engine, state, { type: 'place', x: 1, y: 1 }, black);

        expect(engine.isValidAction(state, { type: 'place', x: 0, y: 0 }, white)).toBe(false);
    });

    it('capture une pierre entourée', () => {
        let state = engine.init(makeConfig());
        // Noir joue un filler au centre
        state = play(engine, state, { type: 'place', x: 4, y: 4 }, black);
        // Blanc joue au coin
        state = play(engine, state, { type: 'place', x: 0, y: 0 }, white);
        // Noir entoure la pierre blanche
        state = play(engine, state, { type: 'place', x: 1, y: 0 }, black);
        state = play(engine, state, { type: 'place', x: 5, y: 5 }, white); // filler
        // Noir capture en fermant la dernière liberté
        state = play(engine, state, { type: 'place', x: 0, y: 1 }, black);

        expect(state.board[0][0]).toBe(0);
        expect(state.captures[black]).toBe(1);
    });

    it('empêche la répétition ko simple', () => {
        // Construction directe d'un ko simple
        const base = engine.init(makeConfig());
        const state = {
            ...base,
            board: [
                [0, 1, 0, 0, 0, 0, 0, 0, 0],
                [1, 2, 1, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
            ],
            previousBoard: [
                [0, 1, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 1, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
            ],
            currentPlayerId: white,
            passesInARow: 0,
            gameOver: false,
            captures: { [black]: 0, [white]: 0 },
        };

        // Blanc tenterait de reprendre immédiatement le pion noir au centre (1,1)
        const isKo = engine.isValidAction(state, { type: 'place', x: 1, y: 1 }, white);
        expect(isKo).toBe(false);
    });

    it('termine sur double passe et calcule le score avec komi', () => {
        let state = engine.init(makeConfig());
        state = play(engine, state, { type: 'pass' }, black);
        state = play(engine, state, { type: 'pass' }, white);

        expect(state.gameOver).toBe(true);
        expect(state.scores.white).toBeGreaterThan(state.scores.black);
        expect(state.winners).toEqual([white]);
    });

    it('résignation donne la victoire à l’adversaire', () => {
        let state = engine.init(makeConfig());
        state = play(engine, state, { type: 'resign' }, black);
        expect(state.gameOver).toBe(true);
        expect(state.winners).toEqual([white]);
    });

    it('reste sérialisable / JSON round-trip', () => {
        let state = engine.init(makeConfig());
        state = play(engine, state, { type: 'place', x: 4, y: 4 }, black);
        const copy = JSON.parse(JSON.stringify(state));
        expect(copy.board[4][4]).toBe(1);
    });
});
