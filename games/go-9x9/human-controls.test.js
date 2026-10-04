/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { Go9x9Engine } from './engine.js';
import { createHumanControls } from './human-controls.js';
import { createBoardNavigation } from '../board-navigation.js';

describe('Commandes humaines de Go', () => {
  let engine;
  let state;
  let hasBot;
  let controls;
  let onInvalid;
  beforeEach(() => {
    engine = new Go9x9Engine();
    state = engine.init({ seed: 42, playerIds: ['black', 'white'] });
    hasBot = false;
    onInvalid = jest.fn();
    controls = createHumanControls({
      engine,
      getState: () => state,
      setState: next => { state = next; },
      hasBot: () => hasBot,
      humanId: 'black',
      onUpdate: jest.fn(),
      onInvalid,
    });
  });

  test('les deux humains jouent via les boutons natifs et le déplacement clavier en hot-seat', () => {
    document.body.innerHTML = '<div id="board"><button>Noir</button><button>Blanc</button></div>';
    const board = document.getElementById('board');
    const buttons = board.querySelectorAll('button');
    buttons.forEach((button, x) => button.addEventListener('click', () => controls.play({ type: 'place', x, y: 0 })));
    const navigation = createBoardNavigation(board, 2);
    navigation.afterRender();
    buttons[0].focus();
    buttons[0].click();
    expect(state.board[0][0]).toBe(1);
    expect(controls.getPlayerId()).toBe('white');
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].click();
    expect(state.board[0][1]).toBe(2);
    expect(controls.getPlayerId()).toBe('black');
  });

  test('passer et résigner restent possibles pour le second humain', () => {
    controls.play({ type: 'place', x: 4, y: 4 });
    expect(controls.getPlayerId()).toBe('white');
    expect(controls.play({ type: 'pass' })).toBe(true);
    expect(controls.getPlayerId()).toBe('black');
    controls.play({ type: 'place', x: 5, y: 5 });
    expect(controls.play({ type: 'resign' })).toBe(true);
    expect(state.gameOver).toBe(true);
    expect(state.winners).toEqual(['black']);
    expect(controls.getPlayerId()).toBeNull();
  });

  test('aucune commande humaine ne joue à la place du bot', () => {
    hasBot = true;
    controls.play({ type: 'place', x: 0, y: 0 });
    const botTurnState = state;
    expect(controls.getPlayerId()).toBeNull();
    for (const action of [{ type: 'place', x: 1, y: 0 }, { type: 'pass' }, { type: 'resign' }]) {
      expect(controls.play(action)).toBe(false);
    }
    expect(state).toBe(botTurnState);
  });

  test('un placement refusé annonce une erreur sans changer le tour humain', () => {
    controls.play({ type: 'place', x: 0, y: 0 });
    const action = { type: 'place', x: 0, y: 0 };
    expect(controls.play(action)).toBe(false);
    expect(onInvalid).toHaveBeenCalledWith(action);
    expect(controls.getPlayerId()).toBe('white');
  });

  test('la revue reste contrôlée par l’humain même si le joueur suivant est le bot', () => {
    hasBot = true;
    state = engine.init({ seed: 42, playerIds: ['black', 'white'], manualScoring: true });
    state = engine.applyAction(state, { type: 'place', x: 4, y: 4 }, 'black');
    state = engine.applyAction(state, { type: 'pass' }, 'white');
    state = engine.applyAction(state, { type: 'pass' }, 'black');
    expect(controls.getPlayerId()).toBe('white');
    expect(controls.play({ type: 'pass' })).toBe(false);
    expect(onInvalid).toHaveBeenCalledWith({ type: 'pass' });
    expect(state.scoring).toBe(true);
  });
});
