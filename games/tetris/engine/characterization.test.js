import { createHash } from 'node:crypto';
import TetrisEngine from '../engine.js';
import { freezeInput } from '../../../lib/__tests__/engine-contract-helpers.js';

test('conserve le dispatch et les replays JSON de chaque commande dans les trois modes', () => {
  const engine = new TetrisEngine();
  const hash = createHash('sha256');
  let applications = 0;
  for (const mode of ['marathon', 'sprint', 'ultra']) {
    for (let seed = 0; seed < 10; seed++) {
      let state = engine.init({ seed, playerIds: ['p1'], mode });
      for (let turn = 0; turn < 80 && !state.gameOver; turn++) {
        state = freezeInput(JSON.parse(JSON.stringify(state)));
        const snapshot = JSON.stringify(state);
        const actions = engine.getValidActions(state, 'p1');
        hash.update(JSON.stringify([state, actions]));
        for (const action of actions) {
          hash.update(JSON.stringify(engine.applyAction(state, freezeInput(action), 'p1')));
          applications++;
        }
        const action = actions[(seed + turn * 3) % actions.length];
        const next = engine.applyAction(state, action, 'p1');
        expect(JSON.stringify(state)).toBe(snapshot);
        state = next;
      }
    }
  }
  expect({ applications, digest: hash.digest('hex') }).toEqual({
    applications: 10656, digest: 'e02b4a5ccabc786f8e7e27a21131fc1bb1cee4f218ca0ab08edf779fe251edd1',
  });
});

test.each(['marathon', 'sprint', 'ultra'])('le verrouillage et le temps restent indépendants des frames en %s', mode => {
  const engine = new TetrisEngine();
  const initial = engine.init({ seed: 712, playerIds: ['p1'], mode });
  initial.active = { type: 'O', rotation: 0, x: 4, y: 18 };
  initial.elapsed = mode === 'ultra' ? 119400 : 0;
  initial.lockElapsed = 200;
  const tick = (state, delta) => engine.applyAction(state, { type: 'tick', delta }, 'p1');
  const whole = tick(freezeInput(initial), 1000);
  let divided = JSON.parse(JSON.stringify(initial));
  for (let frame = 0; frame < 100 && !divided.gameOver; frame++) {
    divided = tick(divided, 10);
  }
  expect(divided).toEqual(whole);
});
