/**
 * Bot tactique léger : libertés, yeux, influence et réponse adverse.
 * Recherche bornée et déterministe, sans modèle à télécharger.
 */
import { SeededRandom } from '../../../lib/seeded-random.js';
import { Go9x9Engine } from '../engine.js';

const SIZE = 9;
const ROOT_WIDTH = 12;
const NEIGHBORS = Array.from({ length: 81 }, (_, point) => {
  const x = point % SIZE;
  const y = Math.floor(point / SIZE);
  return [x > 0 ? point - 1 : -1, x < 8 ? point + 1 : -1,
    y > 0 ? point - SIZE : -1, y < 8 ? point + SIZE : -1].filter((p) => p >= 0);
});

/**
 * Identifie les chaînes et leurs libertés uniques.
 * @param {number[]} board Plateau aplati.
 * @returns {Array<{color: number, stones: number[], liberties: Set<number>}>} Chaînes.
 */
function collectGroups(board) {
  const visited = new Set();
  const groups = [];
  for (let point = 0; point < board.length; point++) {
    if (!board[point] || visited.has(point)) { continue; }
    const group = { color: board[point], stones: [], liberties: new Set() };
    const stack = [point];
    visited.add(point);
    while (stack.length) {
      const current = stack.pop();
      group.stones.push(current);
      for (const neighbor of NEIGHBORS[current]) {
        if (!board[neighbor]) {
          group.liberties.add(neighbor);
        } else if (board[neighbor] === group.color && !visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Reconnaît un œil simple, diagonales comprises. Filtre conservateur,
 * sans prétendre résoudre complètement la vie et la mort.
 * @param {number[]} board Plateau aplati.
 * @param {number} point Intersection vide.
 * @param {number} color Couleur du joueur.
 * @returns {boolean} Vrai si jouer ici détruirait un œil.
 */
function isEye(board, point, color) {
  if (board[point] || !NEIGHBORS[point].every((p) => board[p] === color)) { return false; }
  return countHostileDiagonals(board, point, color) <= (NEIGHBORS[point].length === 4 ? 1 : 0);
}

/**
 * @param {number[]} board Plateau aplati.
 * @param {number} point Intersection centrale.
 * @param {number} color Couleur du joueur.
 * @returns {number} Diagonales sur le plateau qui ne sont pas de cette couleur.
 */
function countHostileDiagonals(board, point, color) {
  const x = point % SIZE;
  const y = Math.floor(point / SIZE);
  let hostileDiagonals = 0;
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      if (!onBoard(x + dx, y + dy)) { continue; }
      if (board[(y + dy) * SIZE + x + dx] !== color) { hostileDiagonals++; }
    }
  }
  return hostileDiagonals;
}

/**
 * @param {number} x Colonne.
 * @param {number} y Ligne.
 * @returns {boolean} Vrai si la coordonnée est sur le plateau.
 */
function onBoard(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

/**
 * Distance aux pierres d'une couleur, par les intersections vides.
 * Limite de trois intersections pour ne pas attribuer tout le plateau
 * au premier joueur qui pose une pierre.
 * @param {number[]} board Plateau aplati.
 * @param {number} color Couleur source.
 * @returns {number[]} Distances.
 */
function distances(board, color) {
  const distance = Array(81).fill(99);
  const queue = [];
  for (let p = 0; p < 81; p++) {
    if (board[p] === color) { distance[p] = 0; queue.push(p); }
  }
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    if (distance[point] >= 3) { continue; }
    for (const neighbor of NEIGHBORS[point]) {
      if (!board[neighbor] && distance[neighbor] > distance[point] + 1) {
        distance[neighbor] = distance[point] + 1;
        queue.push(neighbor);
      }
    }
  }
  return distance;
}

/**
 * Évalue l'avantage de Noir en unités de vingt points. Les pierres en
 * atari valent peu ; le score chinois exact est réservé à la fin.
 * @param {object} state État du moteur.
 * @returns {number} Avantage de Noir.
 */
function evaluate(state) {
  if (state.gameOver && state.scores) {
    return 20 * (state.scores.black - state.scores.white);
  }
  const board = state.board.flat();
  const score = addGroups(-20 * state.komi, board);
  return addTerritory(score, board);
}

/**
 * @param {number} liberties Nombre de libertés.
 * @returns {number} Pénalité d'un groupe en danger.
 */
function dangerPenalty(liberties) {
  if (liberties === 1) { return 15; }
  return liberties === 2 ? 5 : 0;
}

/**
 * @param {number} initial Score courant (l'ordre des additions est conservé).
 * @param {number[]} board Plateau aplati.
 * @returns {number} Score avec la valeur des groupes.
 */
function addGroups(initial, board) {
  let score = initial;
  for (const group of collectGroups(board)) {
    const sign = group.color === 1 ? 1 : -1;
    const liberties = group.liberties.size;
    const danger = dangerPenalty(liberties);
    score += sign * (group.stones.length * (20 - danger) + 0.5 * Math.min(liberties, 6));
  }
  return score;
}

/**
 * @param {number} initial Score courant (l'ordre des additions est conservé).
 * @param {number[]} board Plateau aplati.
 * @returns {number} Score avec territoire et yeux.
 */
function addTerritory(initial, board) {
  let score = initial;
  const black = distances(board, 1);
  const white = distances(board, 2);
  for (let p = 0; p < 81; p++) {
    if (board[p]) { continue; }
    if (black[p] < white[p]) { score += 1.5 / black[p]; }
    if (white[p] < black[p]) { score -= 1.5 / white[p]; }
    if (isEye(board, p, 1)) { score += 10; }
    if (isEye(board, p, 2)) { score -= 10; }
  }
  return score;
}

/** Bot compatible avec le registre historique « Greedy ». */
export class GreedyBot {
  /** @param {Go9x9Engine} engine Moteur utilisé pour toutes les simulations. */
  constructor(engine = new Go9x9Engine()) {
    this.name = 'Greedy';
    this.description = 'Protège ses groupes, construit du territoire et anticipe la réponse adverse.';
    this.difficulty = 'medium';
    this.engine = engine;
    this.playerId = null;
  }

  /** @param {string} playerId Identifiant du joueur contrôlé. */
  onGameStart(playerId) {
    this.playerId = playerId;
  }

  /**
   * Classe les coups sans remplir les yeux ni résigner.
   * @param {object} state Position à analyser.
   * @param {object[]} actions Coups autorisés par l'appelant.
   * @returns {Array<{action: object, next: object, value: number}>} Coups classés.
   */
  candidates(state, actions) {
    const player = state.currentPlayerId;
    const color = state.playerIds[0] === player ? 1 : 2;
    const sign = color === 1 ? 1 : -1;
    const board = state.board.flat();
    const result = [];
    for (const action of actions) {
      if (action.type === 'resign') { continue; }
      if (!this.engine.isValidAction(state, action, player)) { continue; }
      if (action.type === 'place' && isEye(board, action.y * SIZE + action.x, color)) { continue; }
      const next = this.engine.applyAction(state, action, player);
      let value = sign * evaluate(next);
      if (action.type === 'pass' && !next.gameOver) { value -= 1; }
      result.push({ action, next, value });
    }
    return result.sort((a, b) => b.value - a.value);
  }

  /**
   * Minimax à deux demi-coups : douze candidats, toutes les réponses légales.
   * Budget fixe pour préserver le déterminisme. Le moteur clone ses états.
   * @param {object} view Vue complète du plateau.
   * @param {object[]} validActions Coups proposés par le moteur.
   * @param {SeededRandom} rng Générateur pour départager les égalités.
   * @returns {object|null} Action autorisée, ou null si aucune.
   */
  chooseAction(view, validActions, rng = new SeededRandom(view.rngState ?? 0)) {
    if (!validActions.length) { return null; }
    const candidates = this.candidates(view, validActions);
    if (!candidates.length) {
      return validActions.find((a) => a.type === 'pass') ?? validActions[0];
    }
    let bestScore = -Infinity;
    const best = [];
    for (const candidate of candidates.slice(0, ROOT_WIDTH)) {
      const value = this.searchValue(candidate);
      if (value > bestScore + 1e-6) {
        bestScore = value;
        best.length = 0;
        best.push(candidate.action);
      } else if (Math.abs(value - bestScore) <= 1e-6) {
        best.push(candidate.action);
      }
    }
    return rng.pick(best);
  }

  /**
   * Meilleure réponse adverse = pire pour nous. La composante immédiate
   * départage les lignes de valeur tactique voisine.
   * @param {{action: object, next: object, value: number}} candidate Coup racine.
   * @returns {number} Valeur après la meilleure réponse.
   */
  searchValue(candidate) {
    if (candidate.next.gameOver) { return candidate.value; }
    const replies = this.candidates(candidate.next,
      this.engine.getValidActions(candidate.next, candidate.next.currentPlayerId));
    if (!replies.length) { return candidate.value; }
    return -0.85 * replies[0].value + 0.15 * candidate.value;
  }
}

export default GreedyBot;
