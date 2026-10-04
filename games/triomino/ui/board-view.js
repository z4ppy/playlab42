/**
 * Rendu SVG du plateau de Triomino : zones de dépôt légales puis tuiles posées.
 * Les placements légaux viennent du moteur via la page ; ce module dessine
 * et délègue le clic de dépôt sans valider de règle.
 */
import { boardViewBox, triangleCenter, triangleCorners, trianglePoints } from './board-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CORNER_INSET = 0.45;
const BOARD_DEFS = '<defs><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15"/></filter><filter id="last-tile-glow"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#f97316" flood-opacity="0.8"/></filter></defs>';

/**
 * @typedef {Object} BoardView
 * @property {Record<string, {position: object, placed: number[]}>} board Tuiles posées, par clé de position.
 * @property {Array<{pos: object, placed: number[]}>} legalPositions Placements légaux de la tuile active.
 * @property {{pos: object, placed: number[]} | null} selectedPlacement Placement choisi dans les commandes.
 * @property {string | null} lastPlacedKey Clé de la dernière tuile posée.
 */

function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

const positionKey = ({ col, row, orientation }) => `${col},${row},${orientation}`;

function isChosenPlacement(placement, chosen) {
  const same = chosen?.pos && positionKey(chosen.pos) === positionKey(placement.pos);
  return Boolean(same) && placement.placed.join(',') === chosen.placed.join(',');
}

// Une zone par position ; la rotation choisie remplace les autres rotations.
function distinctDropZones(legalPositions, selectedPlacement) {
  const zones = new Map();
  for (const placement of legalPositions) {
    const key = positionKey(placement.pos);
    if (!zones.has(key) || isChosenPlacement(placement, selectedPlacement)) {
      zones.set(key, placement);
    }
  }
  return [...zones.values()];
}

function createDropZone({ pos, placed }, onPlace) {
  const zone = svgElement('polygon', {
    points: trianglePoints(pos),
    fill: 'rgba(249,115,22,0.18)',
    stroke: '#f97316',
    'stroke-width': '2',
    'stroke-dasharray': '4 3',
    'aria-hidden': 'true',
  });
  zone.style.cursor = 'pointer';
  zone.addEventListener('click', () => onPlace(pos, placed));
  return zone;
}

function createCornerValue(value, corner, center) {
  const text = svgElement('text', {
    x: corner[0] + (center[0] - corner[0]) * CORNER_INSET,
    y: corner[1] + (center[1] - corner[1]) * CORNER_INSET,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': '13',
    'font-weight': '800',
    fill: '#7c1d0e',
  });
  text.textContent = value;
  return text;
}

function createTileOutline(position, isLast) {
  const outline = svgElement('polygon', {
    points: trianglePoints(position),
    fill: isLast ? '#fed7aa' : '#fffff0',
    stroke: isLast ? '#f97316' : '#000000',
    'stroke-width': isLast ? '3' : '2',
  });
  if (!isLast) {
    outline.setAttribute('filter', 'url(#shadow)');
  }
  return outline;
}

function createPlacedTile({ position, placed }, isLast) {
  const label = `Tuile ${placed.join(', ')}, colonne ${position.col}, ligne ${position.row}, ${position.orientation}${isLast ? ', dernière tuile posée' : ''}`;
  const tile = svgElement('g', { role: 'img', 'aria-label': label });
  if (isLast) {
    tile.setAttribute('filter', 'url(#last-tile-glow)');
  }
  tile.appendChild(createTileOutline(position, isLast));
  const corners = triangleCorners(position);
  const center = triangleCenter(position);
  placed.forEach((value, index) => tile.appendChild(createCornerValue(value, corners[index], center)));
  return tile;
}

/**
 * Redessine le plateau : défs, zones de dépôt, puis tuiles dans l'ordre des clés.
 * @param {SVGElement} svg Plateau SVG.
 * @param {BoardView} view État affiché.
 * @param {(pos: object, placed: number[]) => void} onPlace Dépôt demandé par clic sur une zone.
 */
export function renderTriominoBoard(svg, view, onPlace) {
  const { board, legalPositions, selectedPlacement, lastPlacedKey } = view;
  svg.innerHTML = BOARD_DEFS;
  const cells = Object.keys(board);
  const viewBox = boardViewBox([...cells.map((key) => board[key].position), ...legalPositions.map(({ pos }) => pos)]);
  if (viewBox) {
    svg.setAttribute('viewBox', viewBox);
  }
  for (const placement of distinctDropZones(legalPositions, selectedPlacement)) {
    svg.appendChild(createDropZone(placement, onPlace));
  }
  for (const key of cells) {
    svg.appendChild(createPlacedTile(board[key], key === lastPlacedKey));
  }
}
