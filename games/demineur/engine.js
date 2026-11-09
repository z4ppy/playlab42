/**
 * Moteur du Démineur : isomorphe, déterministe et entièrement sérialisable.
 *
 * Règles : ouvrir toutes les cases sans mine. Un chiffre indique le nombre de
 * mines parmi les huit voisines ; un « 0 » ouvre ses voisines en cascade.
 * - La grille n'existe pas avant le premier clic : elle est tirée ensuite,
 *   avec le premier clic et ses voisines garantis sans mine.
 * - En mode « sans hasard » (par défaut), la grille est en plus résoluble par
 *   pure logique depuis ce premier clic (voir `engine/generator.js`).
 * - L'accord (`chord`) sur un chiffre dont les drapeaux sont au complet ouvre
 *   ses autres voisines ; un drapeau faux fait alors exploser une mine.
 *
 * Le moteur ne lit ni horloge, ni DOM, ni stockage : le chronomètre est géré
 * par la page. L'aléa passe par `SeededRandom`, dont l'état est sauvegardé
 * dans `rngState` : même seed + mêmes actions = même partie.
 *
 * @see lib/types/game-engine.ts
 */
import { SeededRandom } from '../../lib/seeded-random.js';
import { LEVELS, adjacentMineCounts, neighborTable } from './engine/grid.js';
import { MARK, openCells } from './engine/board.js';
import { generateMines } from './engine/generator.js';

export { LEVELS };

/** Phases d'une partie. */
export const STATUS = Object.freeze({ READY: 'ready', PLAYING: 'playing', WON: 'won', LOST: 'lost' });

/**
 * @typedef {keyof typeof LEVELS} LevelId
 *
 * @typedef {Object} MinesweeperConfig
 * @property {number} seed - Seed de la partie (entier 32 bits).
 * @property {string[]} [playerIds] - Un seul joueur ; par défaut « joueur ».
 * @property {LevelId} [level] - Niveau (Débutant par défaut).
 * @property {boolean} [noGuess] - Grille résoluble sans pari (vrai par défaut).
 *
 * @typedef {'hidden'|'flag'|'open'} Mark
 *
 * @typedef {Object} MinesweeperState
 * @property {string} playerId - Joueur unique.
 * @property {LevelId} level - Niveau.
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mineCount - Nombre de mines.
 * @property {boolean} noGuess - Mode sans hasard demandé.
 * @property {'ready'|'playing'|'won'|'lost'} status - Phase de la partie.
 * @property {number[]|null} mines - Mines (secrètes), null avant le premier clic.
 * @property {Mark[]} marks - Marque de chaque case (`index = y * width + x`).
 * @property {{attempts: number, guaranteed: boolean}|null} generation - Bilan de génération.
 * @property {number} moves - Actions jouées.
 * @property {number} rngState - État du générateur pseudo-aléatoire.
 *
 * @typedef {{type: 'reveal'|'toggleFlag'|'chord', index: number}} MinesweeperAction
 *
 * @typedef {number|'hidden'|'flag'|'mine'|'exploded'|'wrong-flag'} CellView
 *
 * @typedef {Object} MinesweeperView
 * @property {string} playerId - Joueur.
 * @property {LevelId} level - Niveau.
 * @property {number} width - Nombre de colonnes.
 * @property {number} height - Nombre de lignes.
 * @property {number} mineCount - Nombre de mines.
 * @property {boolean} noGuess - Mode sans hasard demandé.
 * @property {'ready'|'playing'|'won'|'lost'} status - Phase.
 * @property {CellView[]} cells - Contenu visible : jamais une mine tant que la partie dure.
 * @property {number} flagsPlaced - Drapeaux posés.
 * @property {number} minesLeft - Mines moins drapeaux (peut devenir négatif).
 * @property {number} openedCount - Cases ouvertes.
 * @property {number} safeCount - Cases sans mine à ouvrir pour gagner.
 * @property {number} moves - Actions jouées.
 * @property {{attempts: number, guaranteed: boolean}|null} generation - Bilan de génération.
 */

const ACTION_TYPES = new Set(['reveal', 'toggleFlag', 'chord']);

/**
 * Grille et comptes de mines voisines d'un état.
 * @param {MinesweeperState} state - État.
 * @returns {import('./engine/board.js').OpeningBoard}
 */
function boardOf(state) {
  const mines = state.mines ?? [];
  return {
    width: state.width, height: state.height,
    mineSet: new Set(mines), counts: adjacentMineCounts(state.width, state.height, mines),
  };
}

/**
 * Un chiffre accepte l'accord quand ses drapeaux égalent sa valeur et qu'il
 * lui reste au moins une voisine fermée à ouvrir.
 * @param {MinesweeperState} state - État.
 * @param {import('./engine/board.js').OpeningBoard} board - Comptes de mines.
 * @param {number} index - Case du chiffre.
 * @returns {boolean}
 */
function canChord(state, board, index) {
  if (state.marks[index] !== MARK.OPEN || board.counts[index] === 0) { return false; }
  const around = neighborTable(state.width, state.height)[index].map(neighbor => state.marks[neighbor]);
  const flags = around.filter(mark => mark === MARK.FLAG).length;
  return flags === board.counts[index] && around.includes(MARK.HIDDEN);
}

/** Raison du refus de chaque type d'action sur une case donnée, ou null. */
const CELL_RULES = {
  reveal: (state, index) => (state.marks[index] === MARK.HIDDEN ? null
    : 'seule une case fermée sans drapeau peut être ouverte.'),
  toggleFlag: (state, index) => {
    if (state.status === STATUS.READY) { return 'ouvrez d\'abord une case : la grille n\'existe pas encore.'; }
    return state.marks[index] === MARK.OPEN ? 'une case ouverte ne reçoit pas de drapeau.' : null;
  },
  chord: (state, index) => (canChord(state, boardOf(state), index) ? null
    : 'l\'accord demande un chiffre ouvert entouré d\'autant de drapeaux, avec une voisine encore fermée.'),
};

/**
 * Vérifie la forme d'une action, indépendamment de l'état de la grille.
 * @param {unknown} action - Action reçue.
 * @param {number} cellCount - Nombre de cases.
 * @returns {string|null} Raison du refus.
 */
function shapeProblem(action, cellCount) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) { return 'une action est un objet.'; }
  if (!ACTION_TYPES.has(action.type)) { return `type d'action inconnu (${String(action.type)}).`; }
  const valid = Number.isInteger(action.index) && action.index >= 0 && action.index < cellCount;
  return valid ? null : 'indice de case invalide.';
}

/**
 * Explique pourquoi une action est refusée.
 * @param {MinesweeperState} state - État.
 * @param {unknown} action - Action reçue.
 * @param {string} playerId - Joueur.
 * @returns {string|null} Raison du refus, ou null si l'action est valide.
 */
function rejection(state, action, playerId) {
  if (playerId !== state.playerId) { return `joueur inconnu (${String(playerId)}).`; }
  if (state.status === STATUS.WON || state.status === STATUS.LOST) { return 'la partie est terminée.'; }
  return shapeProblem(action, state.marks.length) ?? CELL_RULES[action.type](state, action.index);
}

/**
 * Tire les mines au premier clic, en faisant avancer le générateur.
 * @param {MinesweeperState} state - État prêt.
 * @param {number} firstIndex - Premier clic.
 * @returns {MinesweeperState}
 */
function withMines(state, firstIndex) {
  const rng = SeededRandom.fromState(state.rngState);
  const spec = { width: state.width, height: state.height, mineCount: state.mineCount, firstIndex, noGuess: state.noGuess };
  const { mines, attempts, guaranteed } = generateMines(spec, rng);
  return { ...state, status: STATUS.PLAYING, mines, generation: { attempts, guaranteed }, rngState: rng.getState() };
}

/**
 * Ouvre des cases et détermine la nouvelle phase.
 * @param {MinesweeperState} state - État en cours.
 * @param {number[]} starts - Cases à ouvrir.
 * @returns {MinesweeperState}
 */
function open(state, starts) {
  const { marks, exploded } = openCells(boardOf(state), state.marks, starts);
  const openCount = marks.filter(mark => mark === MARK.OPEN).length;
  let status = STATUS.PLAYING;
  if (exploded.length > 0) {
    status = STATUS.LOST;
  } else if (openCount === marks.length - state.mineCount) {
    status = STATUS.WON;
  }
  return { ...state, marks, status, moves: state.moves + 1 };
}

/** Transition pure de chaque type d'action (déjà validée). */
const TRANSITIONS = {
  reveal: (state, index) => open(state.status === STATUS.READY ? withMines(state, index) : state, [index]),
  toggleFlag: (state, index) => {
    const marks = [...state.marks];
    marks[index] = marks[index] === MARK.FLAG ? MARK.HIDDEN : MARK.FLAG;
    return { ...state, marks, moves: state.moves + 1 };
  },
  chord: (state, index) => open(state, neighborTable(state.width, state.height)[index]
    .filter(neighbor => state.marks[neighbor] === MARK.HIDDEN)),
};

/**
 * Contenu visible d'une case. Les mines n'apparaissent qu'une fois la partie finie.
 * @param {MinesweeperState['status']} status - Phase.
 * @param {Mark} mark - Marque de la case.
 * @param {boolean} isMine - La case est minée.
 * @param {number} count - Mines voisines.
 * @returns {CellView}
 */
function cellView(status, mark, isMine, count) {
  if (mark === MARK.OPEN) { return isMine ? 'exploded' : count; }
  // Victoire : toutes les cases restantes sont des mines, affichées comme drapeaux.
  if (status === STATUS.WON) { return 'flag'; }
  if (status !== STATUS.LOST) { return mark; }
  if (mark === MARK.FLAG) { return isMine ? 'flag' : 'wrong-flag'; }
  return isMine ? 'mine' : 'hidden';
}

/**
 * Moteur de jeu du Démineur (contrat `GameEngine` de Playlab42).
 */
export class MinesweeperEngine {
  /**
   * Initialise une partie : la grille reste vide jusqu'au premier clic.
   * @param {MinesweeperConfig} config - Configuration.
   * @returns {MinesweeperState}
   * @throws {Error} Si la configuration est invalide.
   */
  init(config) {
    const { seed, level, noGuess, playerId } = readConfig(config);
    const { width, height, mines } = LEVELS[level];
    return {
      playerId, level, width, height, mineCount: mines, noGuess,
      status: STATUS.READY, mines: null, marks: new Array(width * height).fill(MARK.HIDDEN),
      generation: null, moves: 0, rngState: new SeededRandom(seed).getState(),
    };
  }

  /**
   * Applique une action valide et retourne un nouvel état (l'état reçu n'est pas modifié).
   * @param {MinesweeperState} state - État.
   * @param {MinesweeperAction} action - Action.
   * @param {string} playerId - Joueur.
   * @returns {MinesweeperState}
   * @throws {Error} Si l'action est refusée (la raison est dans le message).
   */
  applyAction(state, action, playerId) {
    const reason = rejection(state, action, playerId);
    if (reason) { throw new Error(`Action refusée : ${reason}`); }
    return TRANSITIONS[action.type](state, action.index);
  }

  /**
   * @param {MinesweeperState} state - État.
   * @param {unknown} action - Action.
   * @param {string} playerId - Joueur.
   * @returns {boolean} L'action serait acceptée.
   */
  isValidAction(state, action, playerId) {
    return rejection(state, action, playerId) === null;
  }

  /**
   * Toutes les actions acceptées : ouvrir, poser/retirer un drapeau, accord.
   * @param {MinesweeperState} state - État.
   * @param {string} playerId - Joueur.
   * @returns {MinesweeperAction[]}
   */
  getValidActions(state, playerId) {
    if (playerId !== state.playerId || this.isGameOver(state)) { return []; }
    const board = boardOf(state);
    const flagsAllowed = state.status === STATUS.PLAYING;
    return state.marks.flatMap((mark, index) => [
      ...(mark === MARK.HIDDEN ? [{ type: 'reveal', index }] : []),
      ...(flagsAllowed && mark !== MARK.OPEN ? [{ type: 'toggleFlag', index }] : []),
      ...(canChord(state, board, index) ? [{ type: 'chord', index }] : []),
    ]);
  }

  /**
   * Vue du joueur : chiffres ouverts et drapeaux, sans aucune mine avant la fin.
   * @param {MinesweeperState} state - État complet.
   * @param {string} playerId - Joueur.
   * @returns {MinesweeperView}
   * @throws {Error} Pour un joueur inconnu (aucune information ne lui est donnée).
   */
  getPlayerView(state, playerId) {
    if (playerId !== state.playerId) { throw new Error(`Joueur inconnu : ${String(playerId)}.`); }
    const { mineSet, counts } = boardOf(state);
    const cells = state.marks.map((mark, index) => cellView(state.status, mark, mineSet.has(index), counts[index]));
    const flagsPlaced = state.marks.filter(mark => mark === MARK.FLAG).length;
    return {
      playerId, level: state.level, width: state.width, height: state.height,
      mineCount: state.mineCount, noGuess: state.noGuess, status: state.status, cells,
      flagsPlaced, minesLeft: state.mineCount - flagsPlaced,
      openedCount: state.marks.filter(mark => mark === MARK.OPEN).length,
      safeCount: state.marks.length - state.mineCount, moves: state.moves,
      generation: state.generation ? { ...state.generation } : null,
    };
  }

  /** @param {MinesweeperState} state - État. @returns {boolean} Victoire ou explosion. */
  isGameOver(state) {
    return state.status === STATUS.WON || state.status === STATUS.LOST;
  }

  /** @param {MinesweeperState} state - État. @returns {string[]|null} Le joueur s'il a gagné, sinon null. */
  getWinners(state) {
    return state.status === STATUS.WON ? [state.playerId] : null;
  }

  /** @param {MinesweeperState} state - État. @returns {string} Le joueur unique. */
  getCurrentPlayer(state) {
    return state.playerId;
  }
}

/**
 * Valide et complète la configuration.
 * @param {MinesweeperConfig} config - Configuration reçue.
 * @returns {{seed: number, level: LevelId, noGuess: boolean, playerId: string}}
 * @throws {Error} Si un champ est invalide.
 */
function readConfig(config) {
  if (!config || typeof config !== 'object') { throw new Error('Configuration attendue : { seed, level?, noGuess? }.'); }
  const { seed, level = 'beginner', noGuess = true } = config;
  if (!Number.isFinite(seed)) { throw new Error('La seed doit être un nombre fini.'); }
  if (!Object.hasOwn(LEVELS, level)) { throw new Error(`Niveau inconnu : ${String(level)}.`); }
  if (typeof noGuess !== 'boolean') { throw new Error('noGuess doit être un booléen.'); }
  return { seed, level, noGuess, playerId: readPlayer(config.playerIds) };
}

/**
 * @param {unknown} playerIds - Identifiants reçus (facultatifs).
 * @returns {string} L'unique joueur.
 * @throws {Error} Si la liste ne contient pas exactement un identifiant non vide.
 */
function readPlayer(playerIds = ['joueur']) {
  const valid = Array.isArray(playerIds) && playerIds.length === 1 && typeof playerIds[0] === 'string' && playerIds[0] !== '';
  if (!valid) { throw new Error('Le démineur se joue seul : playerIds contient un identifiant.'); }
  return playerIds[0];
}

export default MinesweeperEngine;
