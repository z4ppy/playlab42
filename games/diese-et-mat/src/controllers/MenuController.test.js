/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { MenuController } from './MenuController.js';

const EXERCISES = [
  { id: 'n1', title: 'Notes 1', description: 'Lire des notes', difficulty: 1, category: 'notes', icon: '🎼', categoryName: 'Notes' },
  { id: 'i2', title: 'Intervalles 2', description: 'Intervalles', difficulty: 2, category: 'intervals', icon: '↕️', categoryName: 'Intervalles' },
  { id: 'c3', title: 'Accords 3', description: 'Accords', difficulty: 3, category: 'chords' },
  { id: 'r1', title: 'Rythme 1', description: 'Rythmes', difficulty: 1, category: 'rhythm', icon: '🥁', categoryName: 'Rythme' },
];

function build(overrides = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const controller = new MenuController({
    container,
    exercises: EXERCISES,
    isUnlocked: (id) => id !== 'i2' && id !== 'r1',
    getProgress: (id) => ({ n1: 0.456, c3: 0 }[id] ?? 0),
    ...overrides,
  });
  return { container, controller };
}

const ids = (container) => [...container.querySelectorAll('.exercise-card')].map((card) => card.dataset.exerciseId);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MenuController : rendu', () => {
  test('conserve exactement le balisage initial', () => {
    const { container, controller } = build();
    controller.render();
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('conserve le balisage filtré, sans résultat et avec filtres actifs', () => {
    const { container, controller } = build();
    controller.filters = { category: 'intervals', difficulty: 2, showLocked: false };
    controller.render();
    expect(container.innerHTML).toMatchSnapshot();
    controller.filters = { category: 'chords', difficulty: 1, showLocked: true };
    controller.render();
    expect(container.querySelector('.no-results').textContent).toBe('Aucun exercice ne correspond aux filtres sélectionnés.');
    expect(container.querySelector('.filter-results').textContent.trim()).toBe('0 exercice trouvé');
  });

  test('ne fait rien sans conteneur', () => {
    const controller = new MenuController({ exercises: EXERCISES });
    expect(() => controller.render()).not.toThrow();
    expect(() => controller.dispose()).not.toThrow();
  });

  test('expose ARIA des filtres : aria-pressed et libellé de difficulté', () => {
    const { container, controller } = build();
    controller.render();
    const buttons = [...container.querySelectorAll('.filter-btn')];
    expect(buttons.every((button) => button.hasAttribute('aria-pressed'))).toBe(true);
    expect(buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['Tous', 'Tous']);
    expect(container.querySelector('[data-filter="difficulty"] [data-value="2"]').getAttribute('aria-label')).toBe('Difficulté 2');
    expect(container.querySelector('[data-filter="difficulty"] [data-value="all"]').hasAttribute('aria-label')).toBe(false);
    expect(container.querySelector('[data-filter="category"] [data-value="notes"]').hasAttribute('aria-label')).toBe(false);
  });

  test('les cartes verrouillées sont désactivées et marquées, la progression est arrondie', () => {
    const { container, controller } = build();
    controller.render();
    const locked = container.querySelector('[data-exercise-id="i2"]');
    expect(locked.disabled).toBe(true);
    expect(locked.classList.contains('locked')).toBe(true);
    expect(locked.querySelector('.exercise-card-title').textContent).toContain('🔒');
    expect(container.querySelector('[data-exercise-id="n1"] .exercise-card-progress').textContent).toBe('46%');
    expect(container.querySelector('[data-exercise-id="c3"] .exercise-card-progress')).toBeNull();
    expect(container.querySelector('[data-exercise-id="c3"] .category-icon').textContent).toBe('');
    expect(container.querySelector('[data-exercise-id="c3"] .exercise-card-stars').getAttribute('aria-label')).toBe('Difficulté 3 sur 5');
  });

  test('accorde le compteur au pluriel', () => {
    const { container, controller } = build();
    controller.render();
    expect(container.querySelector('.filter-results').textContent.trim()).toBe('4 exercices trouvés');
    controller.setFilter('category', 'notes');
    expect(container.querySelector('.filter-results').textContent.trim()).toBe('1 exercice trouvé');
  });

  test('utilise les valeurs par défaut sans options facultatives', () => {
    const controller = new MenuController({ container: document.createElement('div') });
    expect(controller.exercises).toEqual([]);
    expect(controller.isUnlocked('x')).toBe(true);
    expect(controller.getProgress('x')).toBe(0);
  });
});

describe('MenuController : filtres et événements', () => {
  test('menu : catégorie, difficulté et verrouillage se combinent', () => {
    const { container, controller } = build();
    controller.render();
    expect(ids(container)).toEqual(['n1', 'i2', 'c3', 'r1']);
    controller.setFilter('showLocked', false);
    expect(ids(container)).toEqual(['n1', 'c3']);
    controller.setFilter('difficulty', 1);
    expect(ids(container)).toEqual(['n1']);
    controller.setFilter('category', 'rhythm');
    expect(ids(container)).toEqual([]);
  });

  test('un clic sur un filtre convertit la difficulté et émet filter-changed après le rendu', () => {
    const { container, controller } = build();
    controller.render();
    const events = [];
    controller.on('filter-changed', (payload) => events.push([payload, ids(container).length]));
    container.querySelector('[data-filter="difficulty"] [data-value="3"]').click();
    expect(controller.filters.difficulty).toBe(3);
    container.querySelector('[data-filter="difficulty"] [data-value="all"]').click();
    container.querySelector('[data-filter="category"] [data-value="notes"]').click();
    expect(events).toEqual([
      [{ filter: 'difficulty', value: 3 }, 1],
      [{ filter: 'difficulty', value: 'all' }, 4],
      [{ filter: 'category', value: 'notes' }, 1],
    ]);
  });

  test('setFilter ignore un filtre inconnu', () => {
    const { controller } = build();
    const listener = jest.fn();
    controller.on('filter-changed', listener);
    controller.setFilter('inconnu', 1);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.filters.inconnu).toBeUndefined();
  });

  test('la case afficher verrouillés modifie le filtre', () => {
    const { container, controller } = build();
    controller.render();
    const checkbox = container.querySelector('[data-filter="showLocked"]');
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(controller.filters.showLocked).toBe(false);
    expect(container.querySelector('[data-filter="showLocked"]').checked).toBe(false);
  });

  test('un clic sur une carte déverrouillée émet exercise-selected, pas sur une carte verrouillée', () => {
    const { container, controller } = build();
    controller.render();
    const selected = jest.fn();
    controller.on('exercise-selected', selected);
    container.querySelector('[data-exercise-id="i2"] .exercise-card-title').click();
    expect(selected).not.toHaveBeenCalled();
    container.querySelector('[data-exercise-id="c3"] .exercise-card-title').click();
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith({ exerciseId: 'c3' });
  });

  test('plusieurs rendus n’empilent pas les écouteurs de clic', () => {
    const { container, controller } = build();
    controller.render();
    controller.refresh();
    controller.setExercises(EXERCISES);
    const selected = jest.fn();
    controller.on('exercise-selected', selected);
    container.querySelector('[data-exercise-id="n1"]').click();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  test('restaure le focus sur le bouton de filtre après le rendu', () => {
    const { container, controller } = build();
    controller.render();
    container.querySelector('[data-filter="category"] [data-value="chords"]').focus();
    controller.setFilter('category', 'chords');
    expect(document.activeElement).toBe(container.querySelector('[data-filter="category"] [data-value="chords"]'));
    expect(document.activeElement.getAttribute('aria-pressed')).toBe('true');
    container.querySelector('[data-filter="showLocked"]').focus();
    controller.refresh();
    expect(document.activeElement).toBe(container.querySelector('[data-filter="showLocked"]'));
  });

  test('ne vole pas le focus lorsqu’il est hors du menu', () => {
    const { container, controller } = build();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    controller.render();
    expect(document.activeElement).toBe(outside);
    expect(container.contains(document.activeElement)).toBe(false);
  });

  test('dispose retire l’écouteur et vide le conteneur', () => {
    const { container, controller } = build();
    controller.render();
    const card = container.querySelector('[data-exercise-id="n1"]');
    const selected = jest.fn();
    controller.on('exercise-selected', selected);
    controller.dispose();
    expect(container.innerHTML).toBe('');
    container.appendChild(card);
    card.click();
    expect(selected).not.toHaveBeenCalled();
  });
});
