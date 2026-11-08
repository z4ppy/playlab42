import { OrbitalGolfEngine, dailySeed } from './engine.js';
import { freezeInput, jsonCopy } from '../../lib/__tests__/engine-contract-helpers.js';
import { simulateShot } from './engine/physics.js';

const engine = new OrbitalGolfEngine();
const config = { seed: 42, playerIds: ['p1'] };
const shoot = (angle, power) => ({ type: 'shoot', angle, power });

/** Tir de la référence du trou courant. */
const reference = state => {
  const { angle, power } = state.course[state.holeIndex].reference;
  return shoot(angle, power);
};

/** Cherche un putt qui rentre depuis la balle immobile, pour finir un trou dans les tests. */
function holingPutt(state) {
  const hole = state.course[state.holeIndex];
  const aim = Math.atan2(hole.hole.y - state.ball.y, hole.hole.x - state.ball.x) * 1800 / Math.PI;
  for (let power = 1; power <= 60; power++) {
    const angle = ((Math.round(aim) % 3600) + 3600) % 3600;
    if (simulateShot(hole, state.ball, angle, power, state.levelTime).outcome === 'holed') { return shoot(angle, power); }
  }
  throw new Error('aucun putt trouvé');
}

/** Joue le trou courant : référence, puis putts jusqu'à rentrer. */
function playHole(state) {
  let next = engine.applyAction(state, reference(state), 'p1');
  while (next.status === 'aiming') { next = engine.applyAction(next, holingPutt(next), 'p1'); }
  return next;
}

describe('Initialisation', () => {
  test('le parcours d’initiation part du départ du premier trou', () => {
    const state = engine.init(config);
    expect(state).toMatchObject({
      mode: 'course', seed: 42, date: null, playerId: 'p1', holeCount: 9, holeIndex: 0,
      status: 'aiming', ball: { x: 150, y: 500, on: null }, levelTime: 0, restarts: 0, lastShot: null,
    });
    expect(state.course).toHaveLength(9);
    expect(state.strokes).toEqual(Array(9).fill(0));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  test('accepte un joueur unique nommé par playerId et une graine négative ramenée sur 32 bits', () => {
    expect(engine.init({ seed: -1, playerId: 'solo' })).toMatchObject({ playerId: 'solo', seed: 4294967295 });
  });

  test('le trou du jour reçoit sa date du client et ne compte qu’un trou', () => {
    const date = '2026-01-01';
    const state = engine.init({ seed: dailySeed(date), playerIds: ['p1'], mode: 'daily', date });
    expect(state).toMatchObject({ mode: 'daily', date, holeCount: 1, strokes: [0] });
    expect(state.course).toHaveLength(1);
    expect(state.course[0].name).toBe('Trou du jour 2026-01-01');
    expect(state.ball).toEqual({ ...state.course[0].tee, on: null });
  });

  test('le parcours libre ne génère que le premier trou, puis les suivants à la demande', () => {
    let state = engine.init({ ...config, mode: 'free' });
    expect(state.course).toHaveLength(1);
    expect(state.course[0].id).toBe('free-42-0');
    state = { ...state, status: 'holed' };
    const next = engine.applyAction(freezeInput(state), { type: 'nextHole' }, 'p1');
    expect(next.course).toHaveLength(2);
    expect(next.course[1].name).toBe('Libre 2');
    expect(state.course).toHaveLength(1);
  });

  test.each([
    ['sans configuration', undefined],
    ['graine non entière', { seed: 1.5, playerIds: ['p1'] }],
    ['sans joueur', { seed: 1 }],
    ['mode inconnu', { seed: 1, playerIds: ['p1'], mode: 'arcade' }],
    ['date mal formée', { seed: dailySeed('2026-1-1'), playerIds: ['p1'], mode: 'daily', date: '2026-1-1' }],
    ['date absente', { seed: 1, playerIds: ['p1'], mode: 'daily' }],
    ['graine du jour incohérente', { seed: 1, playerIds: ['p1'], mode: 'daily', date: '2026-01-01' }],
  ])('refuse une configuration invalide : %s', (_label, invalid) => {
    expect(() => engine.init(invalid)).toThrow('Configuration du golf orbital invalide');
  });
});

describe('Tirs', () => {
  test('la référence du premier trou rentre en un coup', () => {
    const state = freezeInput(engine.init(config));
    const next = engine.applyAction(state, reference(state), 'p1');
    expect(next).toMatchObject({ status: 'holed', strokes: [1, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(next.lastShot).toMatchObject({ angle: 0, power: 66, outcome: 'holed', from: { x: 150, y: 500, on: null }, t0: 0, pickedUp: false });
    expect(next.levelTime).toBeCloseTo(next.lastShot.duration, 12);
    expect(state.status).toBe('aiming');
  });

  test('une balle sortie compte le coup et revient au point de tir', () => {
    const state = engine.init(config);
    const next = engine.applyAction(state, shoot(1800, 100), 'p1');
    expect(next.lastShot.outcome).toBe('out');
    expect(next.ball).toEqual(state.ball);
    expect(next.strokes[0]).toBe(1);
    expect(next.status).toBe('aiming');
    expect(next.levelTime).toBeGreaterThan(0);
  });

  test('une balle arrêtée devient le nouveau point de tir et l’horloge continue', () => {
    const state = { ...engine.init(config), holeIndex: 1, ball: { x: 120, y: 520, on: null } };
    const next = engine.applyAction(state, reference(state), 'p1');
    expect(next.lastShot.outcome).toBe('rest');
    expect(next.ball).toEqual({ x: next.lastShot.end.x, y: next.lastShot.end.y, on: null });
    const putt = engine.applyAction(next, holingPutt(next), 'p1');
    expect(putt.lastShot.t0).toBeCloseTo(next.levelTime, 12);
    expect(putt.status).toBe('holed');
    expect(putt.strokes[1]).toBe(2);
  });

  test('au huitième coup manqué, le trou est ramassé et compte 9', () => {
    let state = engine.init(config);
    for (let count = 0; count < 7; count++) { state = engine.applyAction(state, shoot(1800, 100), 'p1'); }
    expect(state).toMatchObject({ status: 'aiming', strokes: [7, 0, 0, 0, 0, 0, 0, 0, 0] });
    state = engine.applyAction(state, shoot(1800, 100), 'p1');
    expect(state.status).toBe('holed');
    expect(state.strokes[0]).toBe(9);
    expect(state.lastShot.pickedUp).toBe(true);
  });

  test('depuis une planète, seuls les tirs qui quittent la surface sont valides', () => {
    const initial = engine.init(config);
    const state = freezeInput({ ...initial, holeIndex: 1, ball: { x: 500, y: 452, on: 0 } });
    expect(engine.isValidAction(state, shoot(2700, 30), 'p1')).toBe(true);
    expect(engine.isValidAction(state, shoot(900, 30), 'p1')).toBe(false);
    expect(engine.isValidAction(state, shoot(0, 30), 'p1')).toBe(false);
    const shots = engine.getValidActions(state, 'p1');
    expect(shots).toHaveLength(7 * 3);
    expect(shots.every(action => action.angle > 1800 && action.angle < 3600)).toBe(true);
  });
});

describe('Validation des actions', () => {
  const state = freezeInput(engine.init(config));

  test.each([
    shoot(3600, 10), shoot(-1, 10), shoot(0, 0), shoot(0, 101), shoot('10', 10), shoot(1.5, 10), shoot(0, 2.5),
    { type: 'nextHole' }, { type: 'restartHole' }, { type: 'tick' }, null, undefined,
  ])('refuse %j pendant la visée du premier coup', action => {
    expect(engine.isValidAction(state, action, 'p1')).toBe(false);
    expect(() => engine.applyAction(state, action, 'p1')).toThrow('Action invalide');
  });

  test('refuse un autre joueur et un état absent', () => {
    expect(engine.isValidAction(state, shoot(0, 10), 'p2')).toBe(false);
    expect(engine.getValidActions(state, 'p2')).toEqual([]);
    expect(engine.isValidAction(null, shoot(0, 10), 'p1')).toBe(false);
  });

  test('échantillon canonique : 16 directions × 3 puissances au premier coup', () => {
    const actions = engine.getValidActions(state, 'p1');
    expect(actions).toHaveLength(48);
    expect(actions[0]).toEqual(shoot(0, 25));
    expect(actions.some(action => action.type === 'restartHole')).toBe(false);
  });

  test('après un coup, recommencer devient possible ; trou rentré, seul le trou suivant l’est', () => {
    const played = engine.applyAction(state, shoot(1800, 100), 'p1');
    expect(engine.getValidActions(played, 'p1').at(-1)).toEqual({ type: 'restartHole' });
    const holed = engine.applyAction(state, reference(state), 'p1');
    expect(engine.getValidActions(holed, 'p1')).toEqual([{ type: 'nextHole' }]);
    expect(engine.isValidAction(holed, shoot(0, 10), 'p1')).toBe(false);
    expect(engine.isValidAction(holed, { type: 'restartHole' }, 'p1')).toBe(false);
  });
});

describe('Transitions de trou', () => {
  test('recommencer remet les coups à zéro, compte la reprise et replace la balle', () => {
    const initial = engine.init(config);
    const played = engine.applyAction(initial, shoot(1800, 100), 'p1');
    const restarted = engine.applyAction(freezeInput(played), { type: 'restartHole' }, 'p1');
    expect(restarted).toMatchObject({ restarts: 1, levelTime: 0, lastShot: null, status: 'aiming', ball: initial.ball });
    expect(restarted.strokes[0]).toBe(0);
  });

  test('le trou suivant place la balle au départ et remet l’horloge à zéro', () => {
    const holed = playHole(engine.init(config));
    const next = engine.applyAction(holed, { type: 'nextHole' }, 'p1');
    expect(next).toMatchObject({ holeIndex: 1, status: 'aiming', levelTime: 0, lastShot: null, ball: { x: 120, y: 520, on: null } });
  });

  test('le parcours complet se termine sur le dernier trou rentré', () => {
    let state = engine.init(config);
    for (let index = 0; index < 9; index++) {
      state = playHole(state);
      if (index < 8) { state = engine.applyAction(state, { type: 'nextHole' }, 'p1'); }
    }
    expect(state.status).toBe('finished');
    expect(engine.isGameOver(state)).toBe(true);
    expect(engine.getWinners(state)).toEqual(['p1']);
    expect(engine.getValidActions(state, 'p1')).toEqual([]);
    expect(state.strokes.every(strokes => strokes >= 1 && strokes <= 4)).toBe(true);
  }, 30000);

  test('le trou du jour se termine dès qu’il est rentré', () => {
    const date = '2026-01-01';
    const state = playHole(engine.init({ seed: dailySeed(date), playerIds: ['p1'], mode: 'daily', date }));
    expect(state.status).toBe('finished');
    expect(engine.getWinners(state)).toEqual(['p1']);
  });
});

describe('Pureté et reprise', () => {
  test('une partie reprise après JSON suit exactement la même suite', () => {
    let state = engine.init(config);
    state = engine.applyAction(state, shoot(1800, 100), 'p1');
    let restored = jsonCopy(state);
    for (const action of [shoot(0, 40), shoot(0, 10)]) {
      state = engine.applyAction(freezeInput(state), action, 'p1');
      restored = jsonCopy(engine.applyAction(restored, jsonCopy(action), 'p1'));
      expect(restored).toEqual(jsonCopy(state));
    }
  });

  test('la vue joueur est l’état complet et le joueur courant reste le joueur solo', () => {
    const state = engine.init(config);
    expect(engine.getPlayerView(state, 'p1')).toBe(state);
    expect(engine.getCurrentPlayer(state)).toBe('p1');
    expect(engine.getWinners(state)).toBeNull();
    expect(engine.isGameOver(state)).toBe(false);
  });
});
