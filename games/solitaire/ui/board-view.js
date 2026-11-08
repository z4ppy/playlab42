/**
 * Rendu DOM de la table à partir de la vue du joueur uniquement.
 *
 * Chaque élément interactif porte `data-pile` (pile d'origine, ou `stock`) et
 * `data-count` (cartes prises si on l'active : 0 pour un emplacement vide ou
 * le talon). Glisser, cliquer et clavier lisent ces deux attributs : ils n'ont
 * pas besoin de connaître la structure du DOM.
 *
 * @module games/solitaire/ui/board-view
 */

import { cardName, suitName, SUITS } from '../engine/cards.js';
import { COLUMN_COUNT, FOUNDATION_COUNT, foundationId, tableauId } from '../engine/rules.js';
import { createCardBack, createFaceCard, createStaticCard, suitIcon } from './card-view.js';

/** Écart vertical entre cartes, en fraction de hauteur de carte. */
export const FAN = Object.freeze({ down: 0.1, up: 0.27, minUp: 0.16 });

/** Cartes de la défausse visibles en éventail en pioche 3. */
const WASTE_FAN = 3;

/**
 * Écart des cartes visibles d'une colonne pour qu'elle tienne dans l'écran.
 * @param {{downCount: number, up: string[]}} column
 * @param {number} cardHeight - Hauteur d'une carte en pixels
 * @param {number} available - Hauteur disponible en pixels
 * @returns {number} Fraction de hauteur de carte
 */
export function fanFor(column, cardHeight, available) {
  const gaps = column.up.length - 1;
  if (gaps <= 0 || cardHeight <= 0) {
    return FAN.up;
  }
  const room = available / cardHeight - 1 - FAN.down * column.downCount;
  return Math.max(FAN.minUp, Math.min(FAN.up, room / gaps));
}

/** Bouton d'emplacement vide (cible clavier et de dépôt). */
function createSlot(doc, pile, label, suit) {
  const slot = doc.createElement('button');
  slot.type = 'button';
  slot.className = 'slot';
  slot.dataset.pile = pile;
  slot.dataset.count = '0';
  slot.setAttribute('aria-label', label);
  if (suit) {
    slot.append(suitIcon(doc, suit, 'slot-suit'));
  }
  return slot;
}

/** Bouton de carte avec ses attributs de prise. */
function interactiveCard(doc, code, pile, count, label) {
  const card = createFaceCard(doc, code, label);
  card.dataset.pile = pile;
  card.dataset.count = String(count);
  return card;
}

/** Libellé d'une carte visible de colonne. */
function columnCardLabel(code, index, above) {
  const carried = above ? `, ${above === 1 ? 'une carte posée' : `${above} cartes posées`} dessus` : '';
  return `${cardName(code)}, colonne ${index + 1}${carried}`;
}

/** Crée les douze piles une fois ; le rendu ne fait ensuite que les remplir. */
function createPiles(doc, root) {
  const top = doc.createElement('div');
  top.className = 'table-top';
  const columns = doc.createElement('div');
  columns.className = 'table-columns';
  const make = (pile, className, parent, label) => {
    const element = doc.createElement('div');
    element.className = `pile ${className}`;
    element.dataset.pileZone = pile;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', label);
    parent.append(element);
    return element;
  };
  const piles = new Map([
    ['stock', make('stock', 'pile-stock', top, 'Talon')],
    ['waste', make('waste', 'pile-waste', top, 'Défausse')],
  ]);
  const gap = doc.createElement('div');
  gap.className = 'pile-gap';
  top.append(gap);
  for (let index = 0; index < FOUNDATION_COUNT; index++) {
    piles.set(foundationId(index), make(foundationId(index), 'pile-foundation', top, `Fondation ${suitName(index)}`));
  }
  for (let index = 0; index < COLUMN_COUNT; index++) {
    piles.set(tableauId(index), make(tableauId(index), 'pile-column', columns, `Colonne ${index + 1}`));
  }
  root.replaceChildren(top, columns);
  return { piles, columns };
}

/**
 * @typedef {Object} Decorations
 * @property {{from: string, to: string, count: number}|null} [hint] - Coup conseillé
 * @property {{pile: string, count: number}|null} [selection] - Prise en cours au clavier
 * @property {number} [availableHeight] - Hauteur disponible pour les colonnes
 */

export class BoardView {
  /**
   * @param {HTMLElement} root - Conteneur de la table
   */
  constructor(root) {
    this.root = root;
    this.doc = root.ownerDocument;
    const { piles, columns } = createPiles(this.doc, root);
    this.piles = piles;
    this.columns = columns;
  }

  /**
   * Remplit toutes les piles.
   * @param {import('../engine.js').SolitaireView} view
   * @param {Decorations} [decorations]
   */
  render(view, decorations = {}) {
    this.#renderStock(view);
    this.#renderWaste(view);
    view.foundations.forEach((cards, index) => this.#renderFoundation(cards, index));
    const cardHeight = this.columns.firstElementChild.getBoundingClientRect().width * 1.4;
    view.tableau.forEach((column, index) => this.#renderColumn(column, index, fanFor(column, cardHeight, decorations.availableHeight ?? Infinity)));
    this.#decorate(decorations);
  }

  /** Élément de pile (`stock`, `waste`, `tableau-3`…). */
  pile(id) {
    return this.piles.get(id);
  }

  /** Éléments interactifs, dans l'ordre du DOM. */
  targets() {
    return [...this.root.querySelectorAll('[data-pile]')];
  }

  #renderStock(view) {
    const pile = this.piles.get('stock');
    const label = view.stockCount ? `Talon, ${view.stockCount} cartes : piocher`
      : view.waste.length ? 'Talon vide : recycler la défausse' : 'Talon vide';
    const button = createSlot(this.doc, 'stock', label);
    button.classList.toggle('slot-stock', view.stockCount > 0);
    button.classList.toggle('slot-recycle', !view.stockCount && view.waste.length > 0);
    if (view.stockCount) {
      button.append(createCardBack(this.doc));
      const count = this.doc.createElement('span');
      count.className = 'stock-count';
      count.textContent = String(view.stockCount);
      button.append(count);
    }
    pile.replaceChildren(button);
  }

  #renderWaste(view) {
    const pile = this.piles.get('waste');
    const fan = view.drawCount === 3 ? WASTE_FAN : 1;
    const shown = view.waste.slice(-fan);
    if (!shown.length) {
      pile.replaceChildren(createSlot(this.doc, 'waste', 'Défausse vide'));
      return;
    }
    const cards = shown.map((code, index) => {
      const top = index === shown.length - 1;
      const card = top ? interactiveCard(this.doc, code, 'waste', 1, `${cardName(code)}, défausse`) : createStaticCard(this.doc, code);
      card.style.setProperty('--x', String(index));
      return card;
    });
    pile.replaceChildren(...cards);
  }

  #renderFoundation(cards, index) {
    const id = foundationId(index);
    const pile = this.piles.get(id);
    const top = cards[cards.length - 1];
    pile.replaceChildren(top
      ? interactiveCard(this.doc, top, id, 1, `${cardName(top)}, fondation ${suitName(index)}`)
      : createSlot(this.doc, id, `Fondation ${suitName(index)} vide`, SUITS[index]));
  }

  #renderColumn(column, index, fan) {
    const id = tableauId(index);
    const pile = this.piles.get(id);
    pile.style.setProperty('--fan', fan.toFixed(3));
    pile.style.setProperty('--rows-down', String(column.downCount));
    pile.style.setProperty('--rows-up', String(Math.max(0, column.up.length - 1)));
    const hidden = column.downCount ? `, ${column.downCount} carte${column.downCount > 1 ? 's' : ''} cachée${column.downCount > 1 ? 's' : ''}` : '';
    pile.setAttribute('aria-label', `Colonne ${index + 1}${hidden}`);
    const backs = Array.from({ length: column.downCount }, (_, position) => {
      const back = createCardBack(this.doc);
      back.style.setProperty('--d', String(position));
      return back;
    });
    const faces = column.up.map((code, position) => {
      const count = column.up.length - position;
      const card = interactiveCard(this.doc, code, id, count, columnCardLabel(code, index, count - 1));
      card.style.setProperty('--d', String(column.downCount));
      card.style.setProperty('--u', String(position));
      return card;
    });
    const empty = !backs.length && !faces.length ? [createSlot(this.doc, id, `Colonne ${index + 1} vide`)] : [];
    pile.replaceChildren(...backs, ...faces, ...empty);
  }

  /** Marque le coup conseillé et la prise clavier en cours. */
  #decorate({ hint = null, selection = null }) {
    for (const pile of this.piles.values()) {
      pile.classList.remove('is-hint-target');
    }
    if (hint) {
      this.#mark(hint.from, hint.count, 'is-hinted');
      this.piles.get(hint.to)?.classList.add('is-hint-target');
    }
    if (selection) {
      this.#mark(selection.pile, selection.count, 'is-selected');
    }
  }

  /**
   * Marque les `count` cartes du dessus d'une pile (tout l'emplacement si 0,
   * pour le talon conseillé).
   */
  #mark(pileId, count, className) {
    for (const element of this.piles.get(pileId).querySelectorAll('[data-count]')) {
      const taken = Number(element.dataset.count);
      if (count === 0 || (taken > 0 && taken <= count)) {
        element.classList.add(className);
      }
    }
  }
}
