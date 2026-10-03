/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MastermindEngine } from './engine.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/^\s*import .*;$/gm, '');

describe('Mastermind : contrôleur réel de nouvelle partie', () => {
  let apply;
  let confirm;

  beforeEach(() => {
    document.documentElement.innerHTML = html;
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    apply = jest.spyOn(MastermindEngine.prototype, 'applyAction');
    confirm = jest.fn(() => true);
    runInNewContext(script, { document, Date, confirm, MastermindEngine, initTheme: () => {} });
  });

  afterEach(() => jest.restoreAllMocks());

  it('fournit la seed au reset et conserve le parcours de nouvelle partie', () => {
    Date.now.mockReturnValue(1001);
    document.getElementById('reset-btn').click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 'human' }),
      { type: 'reset', seed: 1001 },
      'human',
    );
    expect(document.getElementById('attempt-count').textContent).toBe('0 / 10');
    expect(document.getElementById('current-attempt').style.display).toBe('flex');
    expect(document.getElementById('game-over').style.display).toBe('none');
    expect(document.getElementById('submit-btn').disabled).toBe(true);
  });

  it('préserve les tentatives si le joueur annule la confirmation', () => {
    const colors = document.querySelectorAll('[data-color]');
    for (let i = 0; i < 4; i++) { colors[0].click(); }
    document.getElementById('submit-btn').click();
    expect(document.getElementById('attempt-count').textContent).toBe('1 / 10');
    confirm.mockReturnValue(false);
    document.getElementById('reset-btn').click();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.getElementById('attempt-count').textContent).toBe('1 / 10');
  });
});
