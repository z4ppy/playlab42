import { fits } from './board.js';

export const ACTIONS = ['left', 'right', 'rotateCW', 'rotateCCW', 'softDrop', 'hardDrop', 'hold', 'tick'];
const MAX_RESETS = 15;

// Coordonnées SRS publiées avec y vers le haut ; conversion lors de l'essai.
const JLSTZ_KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I_KICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

function validSoloPlayer(playerIds) {
  return Array.isArray(playerIds) && playerIds.length === 1
    && typeof playerIds[0] === 'string' && Boolean(playerIds[0].trim());
}

/** Valide la configuration sans modifier le format historique de l'état. */
export function validConfig(config) {
  if (!config || !Number.isInteger(config.seed) || !Number.isFinite(config.seed)) { return false; }
  return validSoloPlayer(config.playerIds)
    && ['marathon', 'sprint', 'ultra'].includes(config.mode === undefined ? 'marathon' : config.mode);
}

/** Une collision est un no-op valide, une entrée incorrecte ne l'est pas. */
export function validCommand(action, canHold) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) { return false; }
  if (!ACTIONS.includes(action.type)) { return false; }
  if (action.type === 'hold') { return canHold; }
  if (action.type !== 'tick') { return true; }
  return Number.isFinite(action.delta) && action.delta >= 0 && action.delta <= 1000;
}

/** Le budget de resets persiste même lorsque le kick soulève la pièce. */
function resetLock(state, grounded) {
  if (grounded && state.lockResets < MAX_RESETS) {
    state.lockElapsed = 0;
    state.lockResets++;
  }
}

/** Essaie les kicks SRS dans leur ordre, sans effet si tous échouent. */
export function rotate(state, direction, grounded) {
  const piece = state.active;
  if (piece.type === 'O') { return; }
  const rotation = (piece.rotation + direction) % 4;
  const table = piece.type === 'I' ? I_KICKS : JLSTZ_KICKS;
  const kicks = table[`${piece.rotation}>${rotation}`];
  for (let i = 0; i < kicks.length; i++) {
    const [dx, dy] = kicks[i];
    const candidate = { ...piece, rotation, x: piece.x + dx, y: piece.y - dy };
    if (fits(state, candidate)) {
      state.active = candidate;
      state.lastRotation = { kick: i };
      resetLock(state, grounded);
      break;
    }
  }
}

/** Une translation manuelle réussie annule la rotation éligible au spin. */
export function translate(state, type, grounded) {
  const piece = state.active;
  const candidate = {
    ...piece,
    x: piece.x + (type === 'left' ? -1 : type === 'right' ? 1 : 0),
    y: piece.y + (type === 'softDrop' ? 1 : 0),
  };
  if (!fits(state, candidate)) { return; }
  state.active = candidate;
  state.lastRotation = null;
  if (type === 'softDrop') { state.score++; }
  else { resetLock(state, grounded); }
}
