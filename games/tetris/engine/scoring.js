/**
 * Barème : lignes 100/300/500/800, spins 400/800/1200/1600,
 * minis 100/200/400 ; B2B ×1,5 et combo 50 × index, au niveau avant clear.
 */
const LINE_POINTS = [0, 100, 300, 500, 800];
const SPIN_POINTS = { 'T-spin': [400, 800, 1200, 1600], 'T-spin mini': [100, 200, 400] };
const LINE_LABELS = ['None', 'Single', 'Double', 'Triple', 'Tetris'];

function clearLabel(spin, lines) {
  if (!spin) { return LINE_LABELS[lines]; }
  return lines ? `${spin} ${LINE_LABELS[lines]}` : spin;
}

/** Met à jour uniquement le bilan du verrouillage, sans toucher à la grille. */
export function recordClear(state, spin, lines) {
  const difficult = lines > 0 && (lines === 4 || spin !== null);
  let base = (SPIN_POINTS[spin] ?? LINE_POINTS)[lines];
  if (difficult && state.backToBack) { base *= 1.5; }
  state.combo = lines > 0 ? state.combo + 1 : -1;
  const points = (base + (lines > 0 ? 50 * state.combo : 0)) * state.level;
  state.score += points;
  state.lines += lines;
  state.level = 1 + Math.floor(state.lines / 10);
  state.piecesPlaced++;
  state.lastClear = { lines, label: clearLabel(spin, lines), points };
  if (lines > 0) { state.backToBack = difficult; }
}
