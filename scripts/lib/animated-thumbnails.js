/**
 * Repère au build les vignettes qui ont une variante animée (`.anim.webp`), pour que
 * le portail ne demande jamais un fichier absent.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { animatedThumbnailPath, thumbnailPath } from '../../lib/catalogue-ui.js';

/**
 * Marque les jeux ou outils dont la vignette a une variante animée.
 * @param {Array<{path: string}>} items - Entrées du catalogue
 * @param {'game'|'tool'} type - Nature des entrées
 * @param {string} root - Racine du dépôt
 * @param {(path: string) => boolean} [exists] - Test d'existence (injectable pour les tests)
 * @returns {Array<object>} Entrées, avec `animatedThumbnail: true` quand la variante existe
 */
export function markAnimatedThumbnails(items, type, root, exists = existsSync) {
  return items.map(item => (exists(join(root, animatedThumbnailPath(thumbnailPath(type, item))))
    ? { ...item, animatedThumbnail: true }
    : item));
}

/**
 * Chemin public de la variante animée de la vignette d'un parcours, si elle existe.
 * @param {string} epicDir - Dossier de l'epic sur disque
 * @param {string|undefined} thumbnail - Vignette déclarée dans epic.json
 * @param {string} publicPrefix - Préfixe public de l'epic (ex. `./parcours/epics/<id>`)
 * @param {(path: string) => boolean} [exists] - Test d'existence (injectable pour les tests)
 * @returns {string|undefined} Chemin public, ou undefined sans variante
 */
export function epicAnimatedThumbnail(epicDir, thumbnail, publicPrefix, exists = existsSync) {
  if (!thumbnail) {return undefined;}
  const animated = animatedThumbnailPath(thumbnail);
  return exists(join(epicDir, animated)) ? `${publicPrefix}/${animated}` : undefined;
}
