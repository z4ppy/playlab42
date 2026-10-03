import { TicTacToeEngine } from '../../games/tictactoe/engine.js';
import { CheckersEngine } from '../../games/checkers/engine.js';
import { Go9x9Engine } from '../../games/go-9x9/engine.js';
import { MastermindEngine } from '../../games/mastermind/engine.js';
import { TetrisEngine } from '../../games/tetris/engine.js';
import { TriominoEngine } from '../../games/triomino/engine';
import type { GameEngine } from './game-engine';

// Vérifié par tsc avec allowJs : les signatures viennent des moteurs réels,
// pas d'un double ni d'un cast. Les états et configs restent spécifiques.
const tictactoe: GameEngine<
  ReturnType<TicTacToeEngine['init']>, Parameters<TicTacToeEngine['applyAction']>[1],
  ReturnType<TicTacToeEngine['getPlayerView']>, Parameters<TicTacToeEngine['init']>[0]
> = new TicTacToeEngine();
const checkers: GameEngine<
  ReturnType<CheckersEngine['init']>, Parameters<CheckersEngine['applyAction']>[1],
  ReturnType<CheckersEngine['getPlayerView']>, Parameters<CheckersEngine['init']>[0]
> = new CheckersEngine();
const go: GameEngine<
  ReturnType<Go9x9Engine['init']>, Parameters<Go9x9Engine['applyAction']>[1],
  ReturnType<Go9x9Engine['getPlayerView']>, Parameters<Go9x9Engine['init']>[0]
> = new Go9x9Engine();
const mastermind: GameEngine<
  ReturnType<MastermindEngine['init']>, Parameters<MastermindEngine['applyAction']>[1],
  ReturnType<MastermindEngine['getPlayerView']>, Parameters<MastermindEngine['init']>[0]
> = new MastermindEngine();
const tetris: GameEngine<
  ReturnType<TetrisEngine['init']>, Parameters<TetrisEngine['applyAction']>[1],
  ReturnType<TetrisEngine['getPlayerView']>, Parameters<TetrisEngine['init']>[0]
> = new TetrisEngine();
const triomino: GameEngine<
  ReturnType<TriominoEngine['init']>, Parameters<TriominoEngine['applyAction']>[1],
  ReturnType<TriominoEngine['getPlayerView']>, Parameters<TriominoEngine['init']>[0]
> = new TriominoEngine();

describe('Types du contrat moteur', () => {
  it('accepte les six signatures réelles sans migration des états', () => {
    for (const engine of [tictactoe, checkers, go, mastermind, tetris, triomino]) {
      expect(typeof engine.init).toBe('function');
    }
  });

  it('refuse les états scalaires, configs sans seed et commandes incomplètes au typage', () => {
    // @ts-expect-error Un état doit être un objet spécifique au jeu.
    const scalar: GameEngine<number, never, never, { seed: number }> = tictactoe;
    expect(scalar).toBe(tictactoe);
    // @ts-expect-error La seed reste obligatoire, même sans BaseGameConfig.
    const unseeded: GameEngine<object, never, never, { playerId: string }> = mastermind;
    expect(unseeded).toBe(mastermind);
    // @ts-expect-error Un reset valide doit transporter sa seed.
    const incomplete: Parameters<MastermindEngine['applyAction']>[1] = { type: 'reset' };
    expect(incomplete.type).toBe('reset');
  });
});
