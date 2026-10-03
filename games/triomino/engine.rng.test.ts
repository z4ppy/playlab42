import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { SeededRandom } from '../../lib/seeded-random.js';
import type LegacyReference from './fixtures/rng-legacy.json';
import { TriominoEngine, type GameMode, type TriominoState } from './engine';

const legacy: typeof LegacyReference = JSON.parse(readFileSync(
  new URL('./fixtures/rng-legacy.json', import.meta.url), 'utf8',
));
const modes: Record<string, GameMode> = {
  standard: 'standard', simplified: 'simplified', kids: 'kids',
};
const digest = (state: TriominoState): string =>
  createHash('sha256').update(JSON.stringify(state)).digest('hex');

describe('Corpus RNG historique avant mutualisation (205ece9)', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(legacy.corpus)('distribution et replay JSON : $config.mode, seed $config.seed', game => {
    const random = jest.spyOn(SeededRandom.prototype, 'random');
    const shuffle = jest.spyOn(SeededRandom.prototype, 'shuffle');
    const engine = new TriominoEngine();
    let state = engine.init({ ...game.config, mode: modes[game.config.mode] });
    expect(state.players.map(player => player.rack.map(tile => tile.id))).toEqual(game.initial.racks);
    expect(state.drawPile.map(tile => tile.id)).toEqual(game.initial.drawPile);
    expect(state.currentPlayerIndex).toBe(game.initial.currentPlayerIndex);
    // Ce champ contient historiquement la seed, pas l’état interne après mélange.
    expect(state.rngState).toBe(game.config.seed);
    expect(digest(state)).toBe(game.initial.hash);
    const totals = state.players.map(player => player.rack[0].values.reduce((a, b) => a + b, 0));
    const tied = totals.filter(total => total === Math.max(...totals)).length > 1;
    const draws = 55 + Number(tied);
    expect(shuffle).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledTimes(draws);

    const restoredEngine = new TriominoEngine();
    let restored: TriominoState = JSON.parse(JSON.stringify(state));
    for (const [index, step] of game.steps.entries()) {
      expect(engine.getCurrentPlayer(state)).toBe(step.playerId);
      const legal = engine.getLegalActions(state, step.playerId);
      expect(engine.getValidActions(state, step.playerId)).toEqual(legal);
      const action = legal.find(candidate => JSON.stringify(candidate) === JSON.stringify(step.action));
      if (!action) throw new Error(`Action historique absente : ${JSON.stringify(step.action)}`);
      const before = digest(state);
      state = engine.applyAction(state, action, step.playerId);
      expect(digest(restored)).toBe(before);
      restored = restoredEngine.applyAction(restored, action, step.playerId);
      expect(digest(state)).toBe(step.hash);
      expect(restored).toEqual(state);
      expect(state.rngState).toBe(game.initial.rngState);
      for (const player of state.players) {
        expect(restoredEngine.getPlayerView(restored, player.id)).toEqual(engine.getPlayerView(state, player.id));
      }
      if (index === 7) restored = JSON.parse(JSON.stringify(restored));
    }
    // Après distribution, les pioches utilisent la pile et ne consomment aucun RNG.
    expect(random).toHaveBeenCalledTimes(draws);
  });
});
