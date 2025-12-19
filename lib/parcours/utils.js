/**
 * Fonctions utilitaires pour le viewer de parcours
 * @module lib/parcours/utils
 */

/**
 * Aplatit la structure hiérarchique en liste de slides
 * @param {Array} structure - Structure hiérarchique
 * @param {Array} [parentPath] - Chemin parent pour le breadcrumb
 * @returns {Array} Liste plate des slides avec métadonnées
 */
export function flattenStructure(structure, parentPath = []) {
  const slides = [];

  for (const item of structure) {
    if (item.type === 'section') {
      const sectionPath = [...parentPath, { id: item.id, title: item.title, icon: item.icon }];
      slides.push(...flattenStructure(item.children, sectionPath));
    } else if (item.type === 'slide') {
      slides.push({
        id: item.id,
        title: item.title,
        icon: item.icon,
        optional: item.optional,
        path: parentPath,
      });
    }
  }

  return slides;
}
