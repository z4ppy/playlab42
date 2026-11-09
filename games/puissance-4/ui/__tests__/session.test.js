/**
 * Session client : tour de l'IA, noms affichés et annulation selon le mode.
 */

import { GameSession, PLAYER_IDS } from '../session.js';

const AI_RED_HUMAN = { mode: 'ai', humanColor: 'red', firstColor: 'red', level: 'expert', seed: 42 };

function sessionWith(settings) {
  const session = new GameSession();
  session.start(settings);
  return session;
}

describe('GameSession contre l\'IA', () => {
  it('attribue la couleur choisie à l\'humain et l\'autre à l\'IA', () => {
    const session = sessionWith(AI_RED_HUMAN);
    expect(session.aiPlayerId).toBe(PLAYER_IDS[1]);
    expect(session.names).toEqual({ rouge: 'Rouge (vous)', jaune: 'Jaune (l’IA)' });
    expect(session.isAiTurn()).toBe(false);
    expect(session.rngState).toBe(42);
  });

  it('laisse l\'IA commencer et interdit alors tout coup humain', () => {
    const session = sessionWith({ ...AI_RED_HUMAN, humanColor: 'yellow', firstColor: 'red' });
    expect(session.aiPlayerId).toBe('rouge');
    expect(session.isAiTurn()).toBe(true);
    expect(session.canHumanPlay(3)).toBe(false);
    expect(session.canUndo()).toBe(false);
  });

  it('enchaîne humain puis IA en conservant l\'état du RNG des bots', () => {
    const session = sessionWith(AI_RED_HUMAN);
    expect(session.play(3)).toEqual({ playerId: 'rouge', col: 3, row: 5 });
    expect(session.isAiTurn()).toBe(true);
    session.play(2, 777);
    expect(session.rngState).toBe(777);
    expect(session.state.moves).toHaveLength(2);
  });

  it('annule le coup de l\'IA et celui de l\'humain en une fois', () => {
    const session = sessionWith(AI_RED_HUMAN);
    session.play(3);
    session.play(2, 777);
    expect(session.undo()).toBe(true);
    expect(session.state.moves).toEqual([]);
    expect(session.rngState).toBe(42);
    expect(session.undo()).toBe(false);
  });

  it('annule le coup humain pendant que l\'IA réfléchit', () => {
    const session = sessionWith(AI_RED_HUMAN);
    session.play(3);
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(session.state.moves).toEqual([]);
    expect(session.isAiTurn()).toBe(false);
  });

  it('refuse un coup invalide via le moteur', () => {
    const session = sessionWith(AI_RED_HUMAN);
    expect(session.canHumanPlay(9)).toBe(false);
    expect(() => session.play(9)).toThrow(/invalide/);
  });
});

describe('GameSession à deux', () => {
  it('nomme les couleurs et annule un seul coup à la fois', () => {
    const session = sessionWith({ mode: 'duo', humanColor: 'red', firstColor: 'yellow', level: 'facile', seed: 1 });
    expect(session.names).toEqual({ rouge: 'Rouge', jaune: 'Jaune' });
    expect(session.state.currentPlayerId).toBe('jaune');
    session.play(0);
    session.play(1);
    expect(session.isAiTurn()).toBe(false);
    session.undo();
    expect(session.state.moves).toHaveLength(1);
  });
});
