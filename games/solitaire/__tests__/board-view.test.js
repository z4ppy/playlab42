/**
 * @jest-environment jsdom
 */

/**
 * Rendu DOM de la table : attributs de prise, noms accessibles, aucune
 * identité de carte cachée, décorations d'indice et de prise, clavier.
 */

import { SolitaireEngine } from '../engine.js';
import { BoardView } from '../ui/board-view.js';
import { BoardKeyboard } from '../ui/keyboard.js';
import { PLAYER, board, column, stateWith } from './positions.js';

const engine = new SolitaireEngine();

function mount(state) {
  document.body.innerHTML = '<section id="table"></section>';
  const view = new BoardView(document.getElementById('table'));
  view.render(engine.getPlayerView(state, PLAYER));
  return view;
}

describe('Rendu de la table', () => {
  it('ne met dans le DOM que les cartes visibles', () => {
    const state = engine.init({ seed: 8 });
    const view = mount(state);
    const shown = [...document.querySelectorAll('[data-card]')].map(element => element.dataset.card);
    expect(shown.sort()).toEqual(state.board.tableau.map(col => col.up[0]).sort());
    expect(document.querySelectorAll('.card-back')).toHaveLength(21 + 1);
    expect(document.querySelector('.stock-count').textContent).toBe('24');
    expect(view.pile('tableau-6').getAttribute('aria-label')).toBe('Colonne 7, 6 cartes cachées');
    expect(view.pile('tableau-1').getAttribute('aria-label')).toBe('Colonne 2, 1 carte cachée');
    expect(document.querySelector('.pile-stock .slot').getAttribute('aria-label')).toBe('Talon, 24 cartes : piocher');
  });

  it('décrit chaque carte et la taille de la prise qu\'elle emporte', () => {
    const state = stateWith(board({
      drawCount: 3,
      tableau: [column(['9H', '8C', '7D']), column([])],
      waste: ['2C', '3C', '4C', '5C'], heights: [0, 2, 0, 0],
    }));
    const view = mount(state);
    const nine = document.querySelector('[data-card="9H"]');
    expect(nine.dataset).toMatchObject({ pile: 'tableau-0', count: '3' });
    expect(nine.getAttribute('aria-label')).toBe('le 9 de cœur, colonne 1, 2 cartes posées dessus');
    expect(document.querySelector('[data-card="8C"]').getAttribute('aria-label')).toBe('le 8 de trèfle, colonne 1, une carte posée dessus');
    expect(document.querySelector('[data-card="5C"]').getAttribute('aria-label')).toBe('le 5 de trèfle, défausse');
    // Pioche 3 : trois cartes en éventail, seule celle du dessus est un bouton.
    expect(view.pile('waste').querySelectorAll('.card')).toHaveLength(3);
    expect(view.pile('waste').querySelectorAll('button')).toHaveLength(1);
    expect(document.querySelector('[data-card="2H"]').getAttribute('aria-label')).toBe('le 2 de cœur, fondation cœur');
    expect(view.pile('foundation-0').querySelector('.slot').getAttribute('aria-label')).toBe('Fondation pique vide');
    expect(view.pile('tableau-1').querySelector('.slot').getAttribute('aria-label')).toBe('Colonne 2 vide');
    expect(document.querySelector('.pile-stock .slot').getAttribute('aria-label')).toBe('Talon vide : recycler la défausse');
    expect(document.querySelector('[data-card="KH"]')).toBeNull();
    expect(view.targets().every(element => element.dataset.count !== undefined)).toBe(true);
  });

  it('marque le coup conseillé, sa destination et la prise clavier', () => {
    const state = stateWith(board({ tableau: [column(['9H', '8C', '7D']), column(['TS'])] }));
    const view = mount(state);
    const position = engine.getPlayerView(state, PLAYER);
    view.render(position, { hint: { from: 'tableau-0', to: 'tableau-1', count: 3 } });
    expect(document.querySelectorAll('.is-hinted')).toHaveLength(3);
    expect(view.pile('tableau-1').classList.contains('is-hint-target')).toBe(true);
    view.render(position, { selection: { pile: 'tableau-0', count: 2 } });
    expect(document.querySelectorAll('.is-hinted')).toHaveLength(0);
    expect(view.pile('tableau-1').classList.contains('is-hint-target')).toBe(false);
    expect([...document.querySelectorAll('.is-selected')].map(element => element.dataset.card)).toEqual(['8C', '7D']);
    view.render(position, { hint: { from: 'stock', to: null, count: 0 } });
    expect(document.querySelector('.pile-stock .slot').classList.contains('is-hinted')).toBe(true);
    expect(view.pile('tableau-0').style.getPropertyValue('--rows-up')).toBe('2');
  });

  it('dessine les figures avec leur lettre française', () => {
    mount(stateWith(board({ tableau: [column(['QS']), column(['TD'])] })));
    expect(document.querySelector('[data-card="QS"] .card-rank').textContent).toBe('D');
    expect(document.querySelector('[data-card="QS"] .card-figure').textContent).toBe('D');
    expect(document.querySelector('[data-card="TD"] .card-rank').textContent).toBe('10');
    expect(document.querySelector('[data-card="TD"]').classList.contains('is-red')).toBe(true);
    expect(document.querySelector('[data-card="TD"] use').getAttribute('href')).toBe('#suit-D');
  });
});

describe('Clavier de la table', () => {
  it('garde un seul arrêt Tab, suit le focus et transmet Espace et Échap', () => {
    const state = engine.init({ seed: 8 });
    const view = mount(state);
    const calls = [];
    const keyboard = new BoardKeyboard(view, { select: cursor => calls.push(['select', cursor]), cancel: () => calls.push(['cancel']) });
    keyboard.afterRender();
    expect(document.querySelectorAll('#table [tabindex="0"]')).toHaveLength(1);
    const first = view.pile('tableau-0').querySelector('[data-count="1"]');
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement.dataset.pile).toBe('tableau-1');
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, ctrlKey: true }));
    const keyup = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(keyup);
    expect(keyup.defaultPrevented).toBe(true);
    expect(calls).toEqual([['select', { pile: 'tableau-1', count: 1 }], ['cancel']]);
    // Après un rendu, le focus revient sur la pile visée, ramenée à une prise possible.
    keyboard.cursor = { pile: 'tableau-1', count: 5 };
    keyboard.beforeRender();
    view.render(engine.getPlayerView(state, PLAYER));
    keyboard.afterRender();
    expect(document.activeElement.dataset).toMatchObject({ pile: 'tableau-1', count: '1' });
  });
});
