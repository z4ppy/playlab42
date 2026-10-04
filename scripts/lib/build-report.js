/**
 * Rapport final des builders Parcours et Bookmarks : avertissements puis erreurs,
 * sans couleur (format historique de ces deux builders).
 */
import { writeJSONAtomicSync } from './build-utils.js';

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

/**
 * Publie après les diagnostics ; une erreur d'écriture est propagée, sans faux succès.
 * @param {string} output - Destination du catalogue
 * @param {object} catalogue - Données validées
 * @param {{warnings: string[], errors: string[]}} stats - Diagnostics collectés
 * @returns {boolean} false si les diagnostics interdisent la publication
 */
export function publishCatalogue(output, catalogue, stats) {
  if (!printDiagnostics(stats)) {
    return false;
  }
  writeJSONAtomicSync(output, catalogue);
  console.log(`\nCatalogue généré: ${output}`);
  console.log('\n✅ Build terminé avec succès');
  return true;
}
