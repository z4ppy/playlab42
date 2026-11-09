/** @jest-environment jsdom */
/**
 * Vues DOM : grille (boutons-colonnes, aperçu, chute, ligne gagnante),
 * jauge d'évaluation et historique.
 */

import { jest } from '@jest/globals';
import { stateAfter } from '../../ai/__tests__/helpers.js';
import { createBoardView, discClass } from '../board-view.js';
import { renderEvaluation, renderFinalEvaluation, renderHistory } from '../panels.js';

function mountBoard() {
  document.body.innerHTML = '<div id="board"></div>';
  const root = document.getElementById('board');
  const onPlay = jest.fn();
  return { root, onPlay, view: createBoardView(root, { onPlay }) };
}

const disc = (root, row, col) => root.querySelector(`[data-col="${col}"] [data-row="${row}"] .p4-disc`);

describe('grille', () => {
  it('crée 7 boutons de 6 cases et relaie le clic', () => {
    const { root, onPlay } = mountBoard();
    expect(root.querySelectorAll('button.p4-column')).toHaveLength(7);
    expect(root.querySelectorAll('.p4-cell')).toHaveLength(42);
    root.querySelector('[data-col="5"]').click();
    expect(onPlay).toHaveBeenCalledWith(5);
  });

  it('affiche jetons, dernier coup, case d\'arrivée, indice et disponibilité', () => {
    const { root, view } = mountBoard();
    view.render(stateAfter('44'), { interactive: true, turnColor: 'red', hintColumn: 2 });
    expect(disc(root, 5, 3).className).toBe('p4-disc p4-disc--red');
    expect(disc(root, 4, 3).className).toBe('p4-disc p4-disc--yellow is-last');
    expect(root.querySelector('[data-col="3"] [data-row="3"]').classList.contains('is-landing')).toBe(true);
    expect(root.querySelector('[data-col="2"]').classList.contains('is-hint')).toBe(true);
    expect(root.dataset.turn).toBe('red');
    expect(root.classList.contains('is-interactive')).toBe(true);
    expect(root.querySelector('[data-col="3"]').getAttribute('aria-label')).toMatch(/rouge, jaune/);
    expect(root.querySelector('[data-col="3"]').getAttribute('aria-disabled')).toBe('false');
  });

  it('garde l\'animation de chute du dernier jeton tant qu\'il reste le dernier', () => {
    const { root, view } = mountBoard();
    view.render(stateAfter('4'), { interactive: false, turnColor: 'yellow', animateLast: true });
    expect(disc(root, 5, 3).classList.contains('is-dropping')).toBe(true);
    expect(root.querySelector('[data-col="3"] [data-row="5"]').style.getPropertyValue('--drop-rows')).toBe('6');
    view.render(stateAfter('4'), { interactive: true, turnColor: 'yellow' });
    expect(disc(root, 5, 3).classList.contains('is-dropping')).toBe(true);
    view.render(stateAfter(''), { interactive: true, turnColor: 'red' });
    expect(disc(root, 5, 3).className).toBe('p4-disc');
  });

  it('souligne l\'alignement gagnant et bloque les colonnes en fin de partie', () => {
    const { root, view } = mountBoard();
    view.render(stateAfter('1212121'), { interactive: false, turnColor: 'red' });
    expect(root.querySelectorAll('.is-winning')).toHaveLength(4);
    expect(root.classList.contains('is-over')).toBe(true);
    expect(root.querySelector('[data-col="0"]').getAttribute('aria-disabled')).toBe('true');
  });

  it('déplace le focus avec les flèches et le restaure après un rendu', () => {
    const { root, view } = mountBoard();
    view.render(stateAfter(''), { interactive: true, turnColor: 'red' });
    view.focusColumn(3);
    root.querySelector('[data-col="3"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement.dataset.col).toBe('4');
    view.render(stateAfter('5'), { interactive: true, turnColor: 'yellow' });
    expect(document.activeElement.dataset.col).toBe('4');
    expect(root.querySelector('[data-col="4"]').tabIndex).toBe(0);
  });

  it('compose les classes d\'un jeton', () => {
    expect(discClass(null, { winning: true, last: true, dropping: true })).toBe('p4-disc');
    expect(discClass('red', { winning: true, last: false, dropping: false })).toBe('p4-disc p4-disc--red is-winning');
  });
});

describe('panneaux', () => {
  function meter() {
    document.body.innerHTML = '<div id="m"></div><p id="l"></p><ol id="h"></ol>';
    return { meter: document.getElementById('m'), label: document.getElementById('l') };
  }

  it('remplit la jauge d\'évaluation puis l\'atténue pendant le calcul', () => {
    const elements = meter();
    renderEvaluation(elements, { advantage: 0.5, forced: null, solved: false }, 'red');
    expect(elements.meter.getAttribute('aria-valuenow')).toBe('75');
    expect(elements.meter.style.getPropertyValue('--red-share')).toBe('75%');
    expect(elements.label.textContent).toBe('Net avantage Rouge.');
    renderEvaluation(elements, null, 'red');
    expect(elements.meter.classList.contains('is-pending')).toBe(true);
    expect(elements.label.textContent).toBe('Analyse en cours…');
  });

  it('fige la jauge en fin de partie', () => {
    const elements = meter();
    renderFinalEvaluation(elements, stateAfter('12121272'));
    expect(elements.meter.getAttribute('aria-valuenow')).toBe('0');
    expect(elements.label.textContent).toBe('Partie gagnée par Jaune.');
    renderFinalEvaluation(elements, stateAfter('1212121'));
    expect(elements.meter.getAttribute('aria-valuenow')).toBe('100');
    renderFinalEvaluation(elements, stateAfter('121212343434565656212121434343656565777777'));
    expect(elements.label.textContent).toBe('Partie nulle.');
  });

  it('liste les coups avec leur couleur', () => {
    meter();
    const list = document.getElementById('h');
    renderHistory(list, stateAfter('43'), { rouge: 'Rouge', jaune: 'Jaune' });
    expect([...list.children].map((item) => item.textContent)).toEqual(['Rouge joue en colonne 4.', 'Jaune joue en colonne 3.']);
    expect(list.lastElementChild.className).toBe('p4-history-item p4-history-item--yellow');
  });
});
