import { jest } from '@jest/globals';
import { MastermindEngine } from './engine.js';

describe('Contrat de reset Mastermind', () => {
  const engine = new MastermindEngine();
  const initial = engine.init({ seed: 42, playerId: 'human' });

  afterEach(() => jest.restoreAllMocks());

  it('rejoue la même commande indépendamment de l’horloge (1000 / 1001)', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const action = { type: 'reset', seed: 123 };
    const first = engine.applyAction(initial, action, 'human');
    clock.mockReturnValue(1001);
    const second = engine.applyAction(initial, action, 'human');
    expect(first.secretCode).toEqual(second.secretCode);
    expect(first).toEqual(engine.init({ seed: 123, playerId: 'human' }));
    expect(clock).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '123', NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'refuse explicitement une seed invalide : %s',
    (seed) => {
      const action = { type: 'reset', seed };
      expect(engine.isValidAction(initial, action, 'human')).toBe(false);
      expect(() => engine.applyAction(initial, action, 'human')).toThrow('Invalid action');
    },
  );

  it.each([0, -1, 1000, Number.MAX_SAFE_INTEGER])('accepte la seed entière %s', (seed) => {
    const action = { type: 'reset', seed };
    expect(engine.isValidAction(initial, action, 'human')).toBe(true);
    expect(engine.applyAction(initial, action, 'human')).toEqual(
      engine.init({ seed, playerId: 'human' }),
    );
  });

  it('reprend un ancien état JSON, rejoue reset puis submit sans mutation', () => {
    const legacy = JSON.parse(JSON.stringify(initial));
    const snapshot = JSON.stringify(legacy);
    const actions = [
      { type: 'reset', seed: 1001 },
      { type: 'submit', code: ['R', 'B', 'G', 'Y'] },
      { type: 'reset', seed: 1000 },
    ];
    const replay = (state) => actions.reduce(
      (current, action) => engine.applyAction(current, action, 'human'), state,
    );
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const first = replay(legacy);
    clock.mockReturnValue(1001);
    expect(replay(JSON.parse(snapshot))).toEqual(first);
    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect(clock).not.toHaveBeenCalled();
  });

  it('autorise la nouvelle partie après la fin, uniquement pour le propriétaire', () => {
    const ended = engine.applyAction(initial, { type: 'submit', code: initial.secretCode }, 'human');
    const action = { type: 'reset', seed: 1001 };
    expect(engine.isValidAction(ended, action, 'other')).toBe(false);
    expect(() => engine.applyAction(ended, action, 'other')).toThrow('Invalid action');
    expect(engine.applyAction(ended, action, 'human').gameOver).toBe(false);
  });
});
