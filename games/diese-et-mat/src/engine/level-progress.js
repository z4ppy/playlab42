/**
 * Niveaux d'XP partagés par le calcul de score et le suivi de progression.
 *
 * @module engine/level-progress
 */

/**
 * XP requis pour passer du niveau `level` au suivant : 100 × N^1,5, arrondi à l'inférieur.
 * @param {number} level - Niveau courant (à partir de 1)
 * @returns {number}
 */
function xpRequiredForNextLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calcule le niveau depuis l'XP total.
 * Une XP négative reste au niveau 1 avec une progression négative.
 * Les appelants doivent fournir une XP finie (NaN et Infinity ne terminent pas).
 *
 * @param {number} xp - XP total
 * @returns {{ level: number, currentXP: number, requiredXP: number, progress: number }}
 */
export function calculateLevelProgress(xp) {
  let level = 1;
  let usedXP = 0;
  let requiredXP = xpRequiredForNextLevel(level);

  // Forme négative conservée : NaN et Infinity ne terminent jamais, comme avant la mutualisation.
  while (!(usedXP + requiredXP > xp)) {
    usedXP += requiredXP;
    level++;
    requiredXP = xpRequiredForNextLevel(level);
  }

  const currentXP = xp - usedXP;
  return {
    level,
    currentXP,
    requiredXP,
    progress: Math.round((currentXP / requiredXP) * 100),
  };
}
