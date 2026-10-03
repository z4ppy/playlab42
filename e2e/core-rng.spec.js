import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

const legacy = JSON.parse(readFileSync(
  new URL('../games/triomino/fixtures/rng-legacy.json', import.meta.url), 'utf8',
));

test('Mulberry32 partagé : vecteurs historiques dans Chromium sur le site fabriqué', async ({ page }) => {
  await page.goto('/games/triomino/index.html');
  const vectors = await page.evaluate(async seeds => {
    const { SeededRandom } = await import('/lib/seeded-random.js');
    return seeds.map(seed => {
      const rng = new SeededRandom(seed);
      const initialState = rng.getState();
      const sequence = Array.from({ length: 8 }, () => rng.random());
      const sequenceState = rng.getState();
      const int = rng.int(-3, 5);
      const singletonInt = rng.int(7, 7);
      const pick = rng.pick(['a', 'b', 'c']);
      const singletonPick = rng.pick(['seul']);
      const shuffled = rng.shuffle([0, 1, 2, 3, 4, 5]);
      return { seed, initialState, sequence, sequenceState, int, singletonInt, pick, singletonPick, shuffled, finalState: rng.getState() };
    });
  }, legacy.vectors.map(vector => vector.seed));
  expect(vectors).toEqual(legacy.vectors);
});

test('Triomino émis : 24 distributions et 384 actions avec vrai RNG partagé et reprise JSON', async ({ page, request }) => {
  const sharedRequests = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/lib/seeded-random.js') {
      sharedRequests.push(response.status());
    }
  });
  await page.goto('/games/triomino/index.html');
  const results = await page.evaluate(async corpus => {
    const { TriominoEngine } = await import('/games/triomino/dist/engine.js');
    const { SeededRandom } = await import('/lib/seeded-random.js');
    const digest = async state => {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(state)));
      return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const results = [];
    const original = SeededRandom.prototype.random;
    let calls = 0;
    SeededRandom.prototype.random = function () {
      calls++;
      return original.call(this);
    };
    try {
      for (const game of corpus) {
        calls = 0;
        const engine = new TriominoEngine();
        let state = engine.init(game.config);
        const totals = state.players.map(player => player.rack[0].values.reduce((a, b) => a + b, 0));
        const expectedCalls = 55 + Number(totals.filter(total => total === Math.max(...totals)).length > 1);
        if (calls !== expectedCalls) {
          throw new Error(`Consommation RNG inattendue : ${calls}`);
        }
        const hashes = [await digest(state)];
        const restoredEngine = new TriominoEngine();
        let restored = JSON.parse(JSON.stringify(state));
        for (const [index, step] of game.steps.entries()) {
          state = engine.applyAction(state, step.action, step.playerId);
          restored = restoredEngine.applyAction(restored, step.action, step.playerId);
          const hash = await digest(state);
          if (await digest(restored) !== hash) {
            throw new Error('Reprise JSON divergente');
          }
          hashes.push(hash);
          if (index === 7) {
            restored = JSON.parse(JSON.stringify(restored));
          }
        }
        if (calls !== expectedCalls) {
          throw new Error('Une action consomme encore le RNG');
        }
        results.push(hashes);
      }
    } finally {
      SeededRandom.prototype.random = original;
    }
    return results;
  }, legacy.corpus);
  expect(results).toEqual(legacy.corpus.map(game => [game.initial.hash, ...game.steps.map(step => step.hash)]));
  expect(sharedRequests).toEqual([200]);
  const emitted = await request.get('/games/triomino/dist/engine.js');
  expect(emitted.ok()).toBe(true);
  expect(await emitted.text()).toContain('../../../lib/seeded-random.js');
  expect(await emitted.text()).not.toContain('class SeededRandom');
});
