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
 * @param {unknown} xp - Valeur à valider
 * @throws {TypeError|RangeError}
 */
function assertFiniteXP(xp) {
  if (typeof xp !== 'number') {
    throw new TypeError(`XP invalide : un nombre est attendu, reçu ${typeof xp}`);
  }
  if (!Number.isFinite(xp)) {
    throw new RangeError(`XP invalide : un nombre fini est attendu, reçu ${xp}`);
  }
}

/**
 * Calcule le niveau depuis l'XP total.
 * Contrat d'entrée : l'XP doit être un nombre fini. Une XP négative ou
 * fractionnaire reste valide (niveau 1 avec progression négative, ou arrondie).
 * NaN et ±Infinity sont rejetés explicitement : l'ancienne boucle ne terminait
 * jamais pour NaN et +Infinity, et -Infinity produisait un résultat non fini.
 *
 * @param {number} xp - XP total
 * @throws {TypeError} Si l'XP n'est pas de type nombre
 * @throws {RangeError} Si l'XP n'est pas finie (NaN, Infinity, -Infinity)
 * @returns {{ level: number, currentXP: number, requiredXP: number, progress: number }}
 */
export function calculateLevelProgress(xp) {
  assertFiniteXP(xp);
  let level = 1;
  let usedXP = 0;
  let requiredXP = xpRequiredForNextLevel(level);

  while (usedXP + requiredXP <= xp) {
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
