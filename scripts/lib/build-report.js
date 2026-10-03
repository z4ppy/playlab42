/**
 * Rapport final des builders Parcours et Bookmarks : avertissements puis erreurs,
 * sans couleur (format historique de ces deux builders).
 */

/**
 * Affiche les avertissements et les erreurs collectés.
 * @param {{warnings: string[], errors: string[]}} stats
 * @returns {boolean} true si aucune erreur ne bloque l'écriture du catalogue
 */
export function printDiagnostics(stats) {
  if (stats.warnings.length > 0) {
    console.log(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }

  if (stats.errors.length > 0) {
    console.log(`\nErreurs (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  ❌ ${e}`));
    return false;
  }
  return true;
}
