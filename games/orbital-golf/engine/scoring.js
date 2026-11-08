/**
 * Carte de score : plafond de coups, libellés de golf et totaux par rapport au par.
 */

/** Au-delà de ce nombre de coups sans rentrer, le trou est ramassé. */
export const MAX_STROKES = 8;
/** Score d'un trou ramassé. */
export const PICKUP_SCORE = 9;

const NAMED = new Map([[-3, 'Albatros'], [-2, 'Aigle'], [-1, 'Birdie'], [0, 'Par'], [1, 'Bogey'], [2, 'Double bogey']]);

/**
 * Écart au par avec un vrai signe moins typographique.
 * @param {number} difference - Coups moins par.
 * @returns {string} « Par », « +2 » ou « −1 ».
 */
export function formatToPar(difference) {
  if (difference === 0) { return 'Par'; }
  return difference > 0 ? `+${difference}` : `−${-difference}`;
}

/**
 * @param {number} strokes - Coups joués sur le trou (9 si ramassé).
 * @param {number} par - Par du trou.
 * @returns {string} Libellé français du résultat.
 */
export function holeLabel(strokes, par) {
  if (strokes >= PICKUP_SCORE) { return 'Ramassé'; }
  if (strokes === 1) { return 'Trou en un'; }
  const difference = strokes - par;
  return NAMED.get(difference) ?? formatToPar(difference);
}

/**
 * Trous terminés : ceux déjà quittés et le trou courant s'il est rentré.
 * @param {{holeIndex:number, status:string}} state - État du moteur.
 * @returns {number} Nombre de trous comptés sur la carte.
 */
export function completedHoles(state) {
  return state.holeIndex + (state.status === 'aiming' ? 0 : 1);
}

/**
 * @param {{course:{par:number}[], strokes:number[], holeIndex:number, status:string}} state - État.
 * @returns {{strokes:number, par:number, toPar:number, played:number}} Totaux des trous terminés.
 */
export function cardTotals(state) {
  const played = completedHoles(state);
  let strokes = 0;
  let par = 0;
  for (let index = 0; index < played; index++) {
    strokes += state.strokes[index];
    par += state.course[index].par;
  }
  return { strokes, par, toPar: strokes - par, played };
}
