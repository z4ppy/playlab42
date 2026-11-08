/**
 * Dessin d'une carte : un bouton (face visible) ou un dos décoratif.
 *
 * Les enseignes sont des symboles SVG définis une fois dans `index.html`
 * (`#suit-S`, `#suit-H`, `#suit-C`, `#suit-D`) : rendu net à toute taille,
 * indépendant des polices et des emojis du système. Une carte face cachée
 * ne porte aucune identité dans le DOM : le rendu ne lit que la vue.
 *
 * @module games/solitaire/ui/card-view
 */

import { cardLabel, cardName } from '../engine/cards.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Icône d'enseigne réutilisant le symbole partagé.
 * @param {Document} doc
 * @param {string} suit - `S`, `H`, `C` ou `D`
 * @param {string} className
 * @returns {SVGSVGElement}
 */
export function suitIcon(doc, suit, className) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  const use = doc.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#suit-${suit}`);
  svg.append(use);
  return svg;
}

/** Centre de la carte : une grande enseigne, ou la lettre encadrée d'une figure. */
function cardCenter(doc, rank, suit) {
  if (!['V', 'D', 'R'].includes(rank)) {
    return suitIcon(doc, suit, 'card-pip');
  }
  const figure = doc.createElement('span');
  figure.className = 'card-figure';
  figure.append(doc.createTextNode(rank), suitIcon(doc, suit, 'card-figure-suit'));
  return figure;
}

/**
 * Carte face visible, interactive.
 * @param {Document} doc
 * @param {string} code - Code de la carte
 * @param {string} label - Nom accessible complet (position comprise)
 * @returns {HTMLButtonElement}
 */
export function createFaceCard(doc, code, label) {
  const { rank, suit, red } = cardLabel(code);
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = `card card-face ${red ? 'is-red' : 'is-black'}`;
  button.dataset.card = code;
  button.setAttribute('aria-label', label);
  const corner = doc.createElement('span');
  corner.className = 'card-corner';
  const rankText = doc.createElement('span');
  rankText.className = 'card-rank';
  rankText.textContent = rank;
  corner.append(rankText, suitIcon(doc, suit, 'card-suit'));
  button.append(corner, cardCenter(doc, rank, suit));
  return button;
}

/**
 * Carte décorative (défausse en éventail sous la carte jouable).
 * @param {Document} doc
 * @param {string} code
 * @returns {HTMLElement}
 */
export function createStaticCard(doc, code) {
  const card = createFaceCard(doc, code, cardName(code));
  const element = doc.createElement('div');
  element.className = card.className;
  element.dataset.card = code;
  element.setAttribute('aria-hidden', 'true');
  element.append(...card.childNodes);
  return element;
}

/**
 * Dos de carte, sans identité.
 * @param {Document} doc
 * @returns {HTMLElement}
 */
export function createCardBack(doc) {
  const back = doc.createElement('div');
  back.className = 'card card-back';
  back.setAttribute('aria-hidden', 'true');
  return back;
}
