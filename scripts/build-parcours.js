#!/usr/bin/env node
/**
 * Script de build pour le catalogue Parcours
 * Génère data/parcours.json à partir des epics dans parcours/epics/
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PARCOURS_DIR = join(ROOT, 'parcours');
const EPICS_DIR = join(PARCOURS_DIR, 'epics');
const OUTPUT_FILE = join(ROOT, 'data', 'parcours.json');
const CONFIG_FILE = join(PARCOURS_DIR, 'index.json');

// Statistiques
const stats = {
  found: 0,
  published: 0,
  drafts: 0,
  errors: [],
  warnings: []
};

/**
 * Lit et parse un fichier JSON
 */
function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    stats.errors.push(`Erreur lecture ${path}: ${err.message}`);
    return null;
  }
}

/**
 * Valide un manifest d'epic
 */
function validateEpic(epic, epicDir) {
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
    if (!epic.metadata.author) errors.push('metadata.author requis');
    if (!epic.metadata.created) errors.push('metadata.created requis');
  }

  // Vérifier que les slides existent
  if (epic.content) {
    const slideIds = extractSlideIds(epic.content);
    for (const slideId of slideIds) {
      const slideDir = join(epicDir, 'slides', slideId);
      if (!existsSync(slideDir)) {
        errors.push(`Slide non trouvée: ${slideId}`);
        continue;
      }

      const slideJson = join(slideDir, 'slide.json');
      if (!existsSync(slideJson)) {
        errors.push(`slide.json manquant pour: ${slideId}`);
      }

      const hasHtml = existsSync(join(slideDir, 'index.html'));
      const hasMd = existsSync(join(slideDir, 'index.md'));
      if (!hasHtml && !hasMd) {
        errors.push(`Contenu manquant (index.html ou index.md) pour: ${slideId}`);
      }
    }
  }

  // Vérifier vignette si spécifiée
  if (epic.thumbnail) {
    const thumbPath = join(epicDir, epic.thumbnail);
    if (!existsSync(thumbPath)) {
      warnings.push(`Vignette non trouvée: ${epic.thumbnail}`);
    }
  }

  return { errors, warnings };
}

/**
 * Extrait tous les IDs de slides du contenu (récursif pour les sections)
 */
function extractSlideIds(content) {
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
 */
function countSlides(content) {
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
        if (isOptional) optional++;
      }
    }
  }

  count(content);
  return { total, optional };
}

/**
 * Construit la structure pour le JSON de sortie
 */
function buildStructure(content, epicDir) {
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
        children: buildStructure(item.content, epicDir)
      });
    } else if (item.id) {
      // Slide
      const slideJson = join(epicDir, 'slides', item.id, 'slide.json');
      const slideData = readJSON(slideJson) || { id: item.id, title: item.id };
      structure.push({
        type: 'slide',
        id: item.id,
        title: slideData.title || item.id,
        icon: slideData.icon,
        optional: item.optional
      });
    }
  }

  return structure;
}

/**
 * Traite un epic et retourne son entrée pour le catalogue
 */
function processEpic(epicId) {
  const epicDir = join(EPICS_DIR, epicId);
  const epicJson = join(epicDir, 'epic.json');

  if (!existsSync(epicJson)) {
    return null;
  }

  stats.found++;
  const epic = readJSON(epicJson);
  if (!epic) return null;

  // Ignorer les brouillons
  if (epic.draft) {
    stats.drafts++;
    console.log(`  [DRAFT] ${epicId}`);
    return null;
  }

  // Valider
  const validation = validateEpic(epic, epicDir);
  if (validation.errors.length > 0) {
    stats.errors.push(`${epicId}: ${validation.errors.join(', ')}`);
    console.log(`  [ERREUR] ${epicId}: ${validation.errors.length} erreur(s)`);
    return null;
  }
  if (validation.warnings.length > 0) {
    stats.warnings.push(`${epicId}: ${validation.warnings.join(', ')}`);
  }

  // Compter les slides
  const { total, optional } = countSlides(epic.content);

  // Construire l'entrée
  const entry = {
    id: epic.id,
    title: epic.title,
    description: epic.description,
    path: `/parcours/epics/${epicId}`,
    hierarchy: epic.hierarchy || ['autres'],
    tags: epic.tags || [],
    author: epic.metadata?.author || 'Anonyme',
    created: epic.metadata?.created,
    updated: epic.metadata?.updated,
    duration: epic.metadata?.duration,
    difficulty: epic.metadata?.difficulty,
    icon: epic.icon,
    thumbnail: epic.thumbnail ? `/parcours/epics/${epicId}/${epic.thumbnail}` : null,
    slideCount: total,
    optionalSlideCount: optional,
    hasIndex: !!epic.index,
    structure: buildStructure(epic.content, epicDir)
  };

  stats.published++;
  console.log(`  [OK] ${epicId} (${total} slides)`);
  return entry;
}

/**
 * Construit la hiérarchie avec threshold
 */
function buildHierarchy(epics, config) {
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
      children: []
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
 */
function aggregateTags(epics, config) {
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
      count
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Construit les sections featured
 */
function buildFeatured(epics, config) {
  const featured = config.featured || {};

  // Récents : epics des X derniers mois, max N
  let recent = [];
  if (featured.showRecent) {
    const count = featured.recentCount || 5;
    const months = featured.recentMonths || 6;

    // Calculer la date limite
    const now = new Date();
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
 * Point d'entrée principal
 */
function main() {
  console.log('Build Parcours');
  console.log('==============\n');

  // Charger la config
  const config = readJSON(CONFIG_FILE) || {};
  console.log('Config chargée:', CONFIG_FILE);

  // Scanner les epics
  console.log('\nScan des epics...');
  const epicDirs = existsSync(EPICS_DIR)
    ? readdirSync(EPICS_DIR).filter(f => statSync(join(EPICS_DIR, f)).isDirectory())
    : [];

  const epics = epicDirs
    .map(processEpic)
    .filter(Boolean);

  // Construire le catalogue
  console.log('\nConstruction du catalogue...');
  const catalogue = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    epics,
    taxonomy: {
      hierarchy: buildHierarchy(epics, config),
      tags: aggregateTags(epics, config)
    },
    featured: buildFeatured(epics, config)
  };

  // Écrire le fichier
  writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2));
  console.log(`\nCatalogue généré: ${OUTPUT_FILE}`);

  // Rapport
  console.log('\n--- Rapport ---');
  console.log(`Epics trouvés: ${stats.found}`);
  console.log(`Epics publiés: ${stats.published}`);
  console.log(`Brouillons: ${stats.drafts}`);
  console.log(`Tags uniques: ${catalogue.taxonomy.tags.length}`);

  if (stats.warnings.length > 0) {
    console.log(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }

  if (stats.errors.length > 0) {
    console.log(`\nErreurs (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  ❌ ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Build terminé avec succès');
}

main();
