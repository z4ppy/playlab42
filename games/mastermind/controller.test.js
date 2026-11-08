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
  const resetBtn = () => document.getElementById('reset-btn');
  const count = () => document.getElementById('attempt-count').textContent;
  const playOneAttempt = () => {
    const colors = document.querySelectorAll('[data-color]');
    for (let i = 0; i < 4; i++) { colors[0].click(); }
    document.getElementById('submit-btn').click();
  };

  beforeEach(() => {
    document.documentElement.innerHTML = html;
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    apply = jest.spyOn(MastermindEngine.prototype, 'applyAction');
    // Aucun confirm() natif dans le contexte : un appel lèverait une ReferenceError.
    runInNewContext(script, { document, Date, MastermindEngine, initTheme: () => {} });
  });

  afterEach(() => jest.restoreAllMocks());

  it('fournit la seed au reset et repart immédiatement quand rien n’est en jeu', () => {
    Date.now.mockReturnValue(1001);
    resetBtn().click();
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 'human' }),
      { type: 'reset', seed: 1001 },
      'human',
    );
    expect(count()).toBe('0 / 10');
    expect(document.getElementById('current-attempt').style.display).toBe('flex');
    expect(document.getElementById('game-over').style.display).toBe('none');
    expect(document.getElementById('submit-btn').disabled).toBe(true);
  });

  it('demande une confirmation dans la page avant d’abandonner une partie en cours', () => {
    playOneAttempt();
    expect(count()).toBe('1 / 10');
    resetBtn().click();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(count()).toBe('1 / 10');
    expect(resetBtn().textContent).toBe('Confirmer ?');
    expect(resetBtn().classList.contains('confirming')).toBe(true);
    resetBtn().click();
    expect(apply).toHaveBeenLastCalledWith(expect.anything(), { type: 'reset', seed: 1000 }, 'human');
    expect(count()).toBe('0 / 10');
    expect(resetBtn().textContent).toBe('Nouvelle partie');
  });

  it('préserve les tentatives si le joueur joue au lieu de confirmer', () => {
    playOneAttempt();
    resetBtn().click();
    document.querySelector('[data-color="B"]').click();
    expect(resetBtn().textContent).toBe('Nouvelle partie');
    resetBtn().click();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(count()).toBe('1 / 10');
  });

  it('efface la dernière couleur posée', () => {
    const erase = document.getElementById('erase-btn');
    expect(erase.disabled).toBe(true);
    document.querySelector('[data-color="R"]').click();
    document.querySelector('[data-color="B"]').click();
    erase.click();
    const labels = [...document.querySelectorAll('#current-pegs .peg')].map(peg => peg.textContent);
    expect(labels).toEqual(['R', '?', '?', '?']);
    erase.click();
    expect(erase.disabled).toBe(true);
  });
});
