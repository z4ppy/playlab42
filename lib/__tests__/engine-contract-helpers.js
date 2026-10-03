import { describe, expect, it } from '@jest/globals';

/** Gèle les entrées pour détecter une mutation, sans copier les états du moteur. */
export function freezeInput(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeInput);
    Object.freeze(value);
  }
  return value;
}

export function jsonCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Les fixtures décrivent les règles de chaque jeu ; aucun algorithme n'est remplacé. */
export function exerciseEngineContract({ name, engine, config, finish, assertView, invalidActions }) {
  describe(`Contrat commun : ${name}`, () => {
    it('initialise de façon déterministe sans modifier la configuration', () => {
      const snapshot = jsonCopy(config);
      const state = engine.init(freezeInput(config));
      expect(state).toEqual(engine.init(config));
      expect(config).toEqual(snapshot);
      expect(engine.isGameOver(state)).toBe(false);
      expect(engine.getWinners(state)).toBeNull();
      expect(typeof engine.getCurrentPlayer(state)).toBe('string');
      assertView(engine, freezeInput(state));
    });

    it('propose uniquement des actions concrètes valides et pures', () => {
      const state = freezeInput(engine.init(config));
      const snapshot = jsonCopy(state);
      const player = engine.getCurrentPlayer(state);
      const actions = engine.getValidActions(state, player);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        const actionSnapshot = jsonCopy(action);
        expect(engine.isValidAction(state, action, player)).toBe(true);
        const next = engine.applyAction(state, freezeInput(action), player);
        expect(next).not.toBe(state);
        expect(engine.applyAction(state, action, player)).toEqual(next);
        expect(jsonCopy(state)).toEqual(snapshot);
        expect(action).toEqual(actionSnapshot);
      }
    });

    it('continue après restauration JSON et rejoue chaque étape', () => {
      let state = engine.init(config);
      let replay = engine.init(config);
      let restored = jsonCopy(state);
      const log = [];
      for (let turn = 0; turn < 12 && !engine.isGameOver(state); turn++) {
        const player = engine.getCurrentPlayer(state);
        const actions = engine.getValidActions(state, player);
        expect(actions.length).toBeGreaterThan(0);
        expect(engine.getValidActions(restored, player)).toEqual(actions);
        const action = freezeInput(actions[turn % actions.length]);
        log.push({ player, action });
        state = engine.applyAction(freezeInput(state), action, player);
        replay = engine.applyAction(freezeInput(replay), action, player);
        restored = jsonCopy(engine.applyAction(freezeInput(restored), jsonCopy(action), player));
        expect(replay).toEqual(state);
        expect(restored).toEqual(jsonCopy(state));
        expect(engine.getPlayerView(restored, player)).toEqual(jsonCopy(engine.getPlayerView(state, player)));
      }
      const savedLog = jsonCopy(log);
      const final = savedLog.reduce(
        (current, { action, player }) => engine.applyAction(current, action, player),
        engine.init(config),
      );
      expect(final).toEqual(state);
    });

    it('refuse un autre joueur sans mutation et sans actions proposées', () => {
      const state = freezeInput(engine.init(config));
      const snapshot = jsonCopy(state);
      const action = engine.getValidActions(state, engine.getCurrentPlayer(state))[0];
      const others = (config.playerIds ?? []).filter((id) => id !== engine.getCurrentPlayer(state));
      for (const player of ['intruder', ...others]) {
        expect(engine.getValidActions(state, player)).toEqual([]);
        expect(engine.isValidAction(state, action, player)).toBe(false);
        expect(() => engine.applyAction(state, action, player)).toThrow(Error);
      }
      expect(jsonCopy(state)).toEqual(snapshot);
    });

    it('refuse les entrées incompatibles explicitement sans mutation', () => {
      const state = freezeInput(engine.init(config));
      const snapshot = jsonCopy(state);
      const player = engine.getCurrentPlayer(state);
      for (const action of [undefined, null, [], {}, { type: 'UNKNOWN' }, ...invalidActions(state)]) {
        expect(engine.isValidAction(state, action, player)).toBe(false);
        expect(() => engine.applyAction(state, action, player)).toThrow(Error);
      }
      expect(jsonCopy(state)).toEqual(snapshot);
    });

    it('expose les gagnants et interdit le gameplay après une vraie fin de partie', () => {
      const initial = engine.init(config);
      const action = engine.getValidActions(initial, engine.getCurrentPlayer(initial))[0];
      const { state, winners, player } = finish(engine, initial);
      freezeInput(state);
      expect(engine.isGameOver(state)).toBe(true);
      expect(engine.getWinners(state)).toEqual(winners);
      expect(engine.getValidActions(state, player)).toEqual([]);
      expect(engine.isValidAction(state, action, player)).toBe(false);
      expect(() => engine.applyAction(state, action, player)).toThrow(Error);
      expect(engine.getWinners(jsonCopy(state))).toEqual(winners);
    });
  });
}
