/**
 * Lignes gagnantes du morpion, source de vérité partagée par le moteur et le bot Blocker.
 * Module pur, sans dépendance : le bot n'importe pas tout le moteur.
 */

const freezeLine = (line) => Object.freeze(line);

/** Lignes, colonnes puis diagonales, dans l'ordre qui départage deux lignes complètes. */
export const WINNING_LINES = Object.freeze([
  freezeLine([0, 1, 2]),
  freezeLine([3, 4, 5]),
  freezeLine([6, 7, 8]),
  freezeLine([0, 3, 6]),
  freezeLine([1, 4, 7]),
  freezeLine([2, 5, 8]),
  freezeLine([0, 4, 8]),
  freezeLine([2, 4, 6]),
]);
