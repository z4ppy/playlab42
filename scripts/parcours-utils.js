/**
 * Utilitaires pour le système Parcours
 * Fonctions pures et testables extraites de build-parcours.js
 */

import { marked } from 'marked';

// Configuration de marked pour GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Extrait tous les IDs de slides du contenu (récursif pour les sections)
 * @param {Array} content - Structure de contenu (slides et sections)
 * @returns {string[]} - Liste des IDs de slides
 */
export function extractSlideIds(content) {
  const ids = [];
  for (const item of content) {
    if (item.content && Array.isArray(item.content)) {
      // C'est une section
      ids.push(...extractSlideIds(item.content));
    } else if (item.id) {
      // C'est une référence de slide
      ids.push(item.id);
    }
  }
  return ids;
}

/**
 * Compte les slides (total et optionnelles)
 * @param {Array} content - Structure de contenu
 * @returns {{total: number, optional: number}} - Compteurs
 */
export function countSlides(content) {
  let total = 0;
  let optional = 0;

  function count(items, parentOptional = false) {
    for (const item of items) {
      const isOptional = parentOptional || item.optional;
      if (item.content && Array.isArray(item.content)) {
        // Section
        count(item.content, isOptional);
      } else if (item.id) {
        // Slide
        total++;
        if (isOptional) {optional++;}
      }
    }
  }

  count(content);
  return { total, optional };
}

/**
 * Construit la structure hiérarchique pour le JSON de sortie
 * @param {Array} content - Structure de contenu source
 * @param {Function} getSlideData - Fonction pour récupérer les données d'une slide
 * @returns {Array} - Structure transformée
 */
export function buildStructure(content, getSlideData) {
  const structure = [];

  for (const item of content) {
    if (item.content && Array.isArray(item.content)) {
      // Section
      structure.push({
        type: 'section',
        id: item.id,
        title: item.title,
        icon: item.icon,
        optional: item.optional,
        children: buildStructure(item.content, getSlideData),
      });
    } else if (item.id) {
      // Slide
      const slideData = getSlideData(item.id) || { id: item.id, title: item.id };
      structure.push({
        type: 'slide',
        id: item.id,
        title: slideData.title || item.id,
        icon: slideData.icon,
        optional: item.optional,
      });
    }
  }

  return structure;
}

/**
 * Construit la hiérarchie des catégories avec threshold
 * @param {Array} epics - Liste des epics
 * @param {Object} config - Configuration (taxonomy.hierarchy, taxonomy.threshold)
 * @returns {Array} - Noeuds de hiérarchie visibles
 */
export function buildHierarchy(epics, config) {
  const threshold = config.taxonomy?.threshold || 3;
  const hierarchyConfig = config.taxonomy?.hierarchy || [];

  // Compter les epics par catégorie
  const counts = {};
  for (const epic of epics) {
    const cat = epic.hierarchy[0] || 'autres';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  // Construire les noeuds
  const nodes = [];
  for (const h of hierarchyConfig) {
    const count = counts[h.id] || 0;
    const visible = count >= threshold || h.id === 'autres';

    // Trouver la première vignette
    const firstEpic = epics.find(e => e.hierarchy[0] === h.id && e.thumbnail);

    nodes.push({
      id: h.id,
      label: h.label,
      icon: h.icon,
      count,
      thumbnail: firstEpic?.thumbnail || null,
      visible,
      children: [],
    });
  }

  // Absorber les catégories sous le threshold dans "autres"
  const autres = nodes.find(n => n.id === 'autres');
  if (autres) {
    for (const cat of Object.keys(counts)) {
      if (!hierarchyConfig.find(h => h.id === cat)) {
        autres.count += counts[cat];
      }
    }
    for (const node of nodes) {
      if (!node.visible && node.id !== 'autres') {
        autres.count += node.count;
      }
    }
  }

  return nodes.filter(n => n.visible);
}

/**
 * Agrège les tags avec compteurs
 * @param {Array} epics - Liste des epics
 * @param {Object} config - Configuration (taxonomy.tagLabels)
 * @returns {Array} - Tags triés par fréquence
 */
export function aggregateTags(epics, config) {
  const tagLabels = config.taxonomy?.tagLabels || {};
  const counts = {};

  for (const epic of epics) {
    for (const tag of epic.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([id, count]) => ({
      id,
      label: tagLabels[id] || id,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Construit les sections featured (récents)
 * @param {Array} epics - Liste des epics
 * @param {Object} config - Configuration (featured.showRecent, etc.)
 * @param {Date} [now] - Date de référence (pour les tests)
 * @returns {{recent: Array}} - Sections featured
 */
export function buildFeatured(epics, config, now = new Date()) {
  const featured = config.featured || {};

  // Récents : epics des X derniers mois, max N
  let recent = [];
  if (featured.showRecent) {
    const count = featured.recentCount || 5;
    const months = featured.recentMonths || 6;

    // Calculer la date limite
    const limitDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    const limitStr = limitDate.toISOString().slice(0, 10);

    recent = [...epics]
      .filter(epic => {
        const date = epic.updated || epic.created;
        return date >= limitStr;
      })
      .sort((a, b) => {
        const dateA = a.updated || a.created;
        const dateB = b.updated || b.created;
        return dateB.localeCompare(dateA);
      })
      .slice(0, count);
  }

  return { recent };
}

/**
 * Valide les champs requis d'un manifest d'epic
 * @param {Object} epic - Manifest de l'epic
 * @returns {{errors: string[], warnings: string[]}} - Résultat de validation
 */
export function validateEpicFields(epic) {
  const errors = [];
  const warnings = [];

  // Champs requis
  const required = ['id', 'title', 'description', 'hierarchy', 'tags', 'metadata', 'content'];
  for (const field of required) {
    if (!epic[field]) {
      errors.push(`Champ requis manquant: ${field}`);
    }
  }

  // Métadonnées requises
  if (epic.metadata) {
    if (!epic.metadata.author) {errors.push('metadata.author requis');}
    if (!epic.metadata.created) {errors.push('metadata.created requis');}
  }

  return { errors, warnings };
}

/**
 * Convertit du Markdown en HTML
 * @param {string} markdown - Contenu Markdown
 * @returns {string} - Contenu HTML
 */
export function convertMarkdown(markdown) {
  return marked.parse(markdown);
}

/**
 * Injecte du contenu HTML dans un template
 * @param {string} template - Template avec placeholders {{TITLE}} et {{CONTENT}}
 * @param {string} title - Titre de la slide
 * @param {string} content - Contenu HTML
 * @returns {string} - HTML complet
 */
export function injectInTemplate(template, title, content) {
  return template
    .replace('{{TITLE}}', title)
    .replace('{{CONTENT}}', content);
}
