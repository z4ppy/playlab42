/**
 * Clavier de la table : un seul arrêt Tab (tabindex itinérant), flèches pour
 * se déplacer, Espace pour prendre puis poser, Entrée pour le déplacement
 * automatique (le `click` natif du bouton), chiffres 1 à 7 pour une colonne.
 *
 * La navigation est une fonction pure (`navigate`) testée sans DOM ; la
 * classe ne fait que la relier aux éléments rendus par `BoardView`.
 *
 * Grille logique : rangée du haut = talon (0), défausse (1), fondations
 * (3 à 6) ; rangée du bas = colonnes 0 à 6. Dans une colonne, Haut remonte
 * vers les cartes plus profondes (une prise plus grande), Bas redescend vers
 * la carte du dessus.
 *
 * @module games/solitaire/ui/keyboard
 */

import { COLUMN_COUNT, FOUNDATION_COUNT, foundationId, parsePile, tableauId } from '../engine/rules.js';

/**
 * @typedef {{pile: string, count: number}} Cursor - Pile visée et taille de la prise
 */

const TOP_ROW = ['stock', 'waste', ...Array.from({ length: FOUNDATION_COUNT }, (_, index) => foundationId(index))];
const TOP_COLUMNS = [0, 1, 3, 4, 5, 6];

/** Colonne logique (0 à 6) d'une pile de la rangée du haut. */
function topColumn(pile) {
  return TOP_COLUMNS[TOP_ROW.indexOf(pile)];
}

/** Pile du haut au-dessus d'une colonne du tableau (la colonne 3 n'a que la défausse à gauche). */
function pileAbove(column) {
  const index = TOP_COLUMNS.findLastIndex(value => value <= column);
  return TOP_ROW[index];
}

/** Curseur par défaut d'une pile : sa carte du dessus, ou son emplacement. */
function landOn(pile, deepest) {
  return { pile, count: Math.min(1, deepest(pile)) };
}

/** Déplacement horizontal dans une rangée. */
function sideways(cursor, step, deepest) {
  const tableau = parsePile(cursor.pile)?.zone === 'tableau';
  const row = tableau ? Array.from({ length: COLUMN_COUNT }, (_, index) => tableauId(index)) : TOP_ROW;
  const index = Math.min(row.length - 1, Math.max(0, row.indexOf(cursor.pile) + step));
  return landOn(row[index], deepest);
}

/** Déplacement vertical : dans la colonne d'abord, puis vers l'autre rangée. */
function vertical(cursor, step, deepest) {
  const pile = parsePile(cursor.pile);
  if (pile?.zone !== 'tableau') {
    return step > 0 ? landOn(tableauId(topColumn(cursor.pile)), deepest) : cursor;
  }
  const count = cursor.count - step;
  if (count >= 1 && count <= deepest(cursor.pile)) {
    return { pile: cursor.pile, count };
  }
  return step < 0 && count > deepest(cursor.pile) ? landOn(pileAbove(pile.index), deepest) : cursor;
}

/**
 * Curseur suivant pour une touche, ou `null` si la touche ne déplace rien.
 * @param {Cursor} cursor
 * @param {string} key - `event.key`
 * @param {(pile: string) => number} deepest - Plus grande prise possible d'une pile (0 si vide)
 * @returns {Cursor|null}
 */
export function navigate(cursor, key, deepest) {
  switch (key) {
    case 'ArrowLeft':
      return sideways(cursor, -1, deepest);
    case 'ArrowRight':
      return sideways(cursor, 1, deepest);
    case 'ArrowUp':
      return vertical(cursor, -1, deepest);
    case 'ArrowDown':
      return vertical(cursor, 1, deepest);
    default:
      return /^[1-7]$/.test(key) ? landOn(tableauId(Number(key) - 1), deepest) : null;
  }
}

/**
 * @typedef {Object} KeyboardHandlers
 * @property {(cursor: Cursor) => void} select - Espace : prendre ou poser
 * @property {() => void} cancel - Échap : abandonner la prise
 */

export class BoardKeyboard {
  /** @type {Cursor} */
  cursor = { pile: tableauId(0), count: 1 };
  #restoreFocus = false;

  /**
   * @param {import('./board-view.js').BoardView} view
   * @param {KeyboardHandlers} handlers
   */
  constructor(view, handlers) {
    this.view = view;
    this.handlers = handlers;
    this.root = view.root;
    this.root.addEventListener('keydown', event => this.#keydown(event));
    // Espace active un bouton au relâchement : on l'empêche, le choix est fait au keydown.
    this.root.addEventListener('keyup', event => {
      if (event.key === ' ') {
        event.preventDefault();
      }
    });
    this.root.addEventListener('focusin', event => this.#track(event.target));
  }

  /** Plus grande prise possible d'une pile dans le rendu courant. */
  deepest = pile => Math.max(0, ...[...this.view.pile(pile).querySelectorAll('[data-count]')]
    .map(element => Number(element.dataset.count)));

  /** À appeler juste avant un rendu. */
  beforeRender() {
    this.#restoreFocus = this.root.contains(this.root.ownerDocument.activeElement);
  }

  /** Après un rendu : un seul élément dans l'ordre Tab, focus rétabli si besoin. */
  afterRender() {
    const target = this.#resolve();
    for (const element of this.view.targets()) {
      element.tabIndex = element === target ? 0 : -1;
    }
    if (this.#restoreFocus) {
      target.focus({ preventScroll: false });
    }
    this.#restoreFocus = false;
  }

  /**
   * Place le curseur (et le focus si la table l'avait).
   * @param {Cursor} cursor
   * @param {boolean} [focus=true]
   */
  moveTo(cursor, focus = true) {
    this.cursor = cursor;
    this.#restoreFocus = focus;
    this.afterRender();
  }

  /** Élément correspondant au curseur, ramené à la prise disponible la plus proche. */
  #resolve() {
    const deepest = this.deepest(this.cursor.pile);
    this.cursor = { pile: this.cursor.pile, count: Math.min(this.cursor.count, deepest) || Math.min(1, deepest) };
    return this.view.pile(this.cursor.pile).querySelector(`[data-count="${this.cursor.count}"]`)
      ?? this.view.pile(this.cursor.pile).querySelector('[data-count]');
  }

  #track(element) {
    if (element?.dataset?.pile) {
      this.cursor = { pile: element.dataset.pile, count: Number(element.dataset.count) };
      for (const target of this.view.targets()) {
        target.tabIndex = target === element ? 0 : -1;
      }
    }
  }

  #keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      if (event.key === ' ') {
        this.handlers.select(this.cursor);
      } else {
        this.handlers.cancel();
      }
      return;
    }
    const next = navigate(this.cursor, event.key, this.deepest);
    if (next) {
      event.preventDefault();
      this.moveTo(next);
    }
  }
}
