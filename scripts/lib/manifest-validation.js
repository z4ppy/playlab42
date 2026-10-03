/**
 * Contrôles de manifest partagés par les builders de catalogue.
 * Les messages restent en anglais : ils font partie de la sortie historique du build.
 */

import { isValidId } from './build-utils.js';

// Pattern semver pour validation du champ version (optionnel)
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Vérifie les champs requis puis le format kebab-case de l'id.
 * @param {object} manifest
 * @param {string[]} required - Champs requis, dans l'ordre de rapport
 * @returns {string[]} Erreurs
 */
export function validateRequiredFields(manifest, required) {
  const errors = required
    .filter(field => !manifest[field])
    .map(field => `Missing required field '${field}'`);

  // Le format n'est contrôlé que si l'id existe, pour éviter une erreur doublée
  if (manifest.id && !isValidId(manifest.id)) {
    errors.push("'id' must be kebab-case (lowercase letters, numbers, hyphens)");
  }
  return errors;
}

/**
 * Vérifie le type de `tags` et le format semver optionnel de `version`.
 * @param {object} manifest
 * @returns {string[]} Erreurs
 */
export function validateTagsAndVersion(manifest) {
  const errors = [];
  if (manifest.tags && !Array.isArray(manifest.tags)) {
    errors.push("'tags' must be an array");
  }
  if (manifest.version && !SEMVER_PATTERN.test(manifest.version)) {
    errors.push("'version' must be semver format (e.g., '1.0.0')");
  }
  return errors;
}
