#!/usr/bin/env node
/**
 * Script de build pour le catalogue Parcours
 * Génère data/parcours.json à partir des epics dans parcours/epics/
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getRootDir } from './lib/build-utils.js';
import {
  extractSlideIds,
  countSlides,
  buildStructure,
  buildHierarchy,
  aggregateTags,
  buildFeatured,
  validateEpicFields,
  convertMarkdown,
  injectInTemplate,
} from './parcours-utils.js';

const ROOT = getRootDir(import.meta.url);
const PARCOURS_DIR = join(ROOT, 'parcours');
const EPICS_DIR = join(PARCOURS_DIR, 'epics');
const OUTPUT_FILE = join(ROOT, 'data', 'parcours.json');
const CONFIG_FILE = join(PARCOURS_DIR, 'index.json');
const SLIDE_TEMPLATE_FILE = join(PARCOURS_DIR, '_shared', 'slide-template.html');
const GLOBAL_GLOSSARY_FILE = join(PARCOURS_DIR, 'glossary.json');

// Statistiques
const stats = {
  found: 0,
  published: 0,
  drafts: 0,
  markdownConverted: 0,
  glossaryTermsTotal: 0,
  errors: [],
  warnings: [],
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
 * Charge et fusionne le glossaire pour un epic
 * @param {string} epicDir - Chemin du dossier de l'epic
 * @param {object|null} globalGlossary - Glossaire global
 * @returns {object} Glossaire fusionné { terms, termCount }
 */
function loadEpicGlossary(epicDir, globalGlossary) {
  // Charger le glossaire de l'epic (prioritaire)
  const epicGlossaryPath = join(epicDir, 'glossary.json');
  let epicGlossary = null;

  if (existsSync(epicGlossaryPath)) {
    try {
      const data = JSON.parse(readFileSync(epicGlossaryPath, 'utf-8'));
      // Support format { terms: {...} } ou directement {...}
      epicGlossary = data.terms || data;
    } catch (err) {
      stats.warnings.push(`Erreur lecture glossaire ${epicGlossaryPath}: ${err.message}`);
    }
  }

  // Fusionner : epic > global
  const terms = { ...(globalGlossary || {}), ...(epicGlossary || {}) };
  const termCount = Object.keys(terms).length;

  if (termCount > 0) {
    stats.glossaryTermsTotal += termCount;
  }

  return { terms, termCount };
}

/**
 * Valide les termes du glossaire
 * @param {object} terms - Termes du glossaire
 * @param {string} epicId - ID de l'epic
 */
function validateGlossary(terms, epicId) {
  const warnings = [];

  for (const [term, entry] of Object.entries(terms)) {
    // Vérifier que short est présent
    if (!entry.short) {
      stats.errors.push(`${epicId}: Glossaire - terme "${term}" sans définition courte (short)`);
    }

    // Warning si short trop long
    if (entry.short && entry.short.length > 200) {
      warnings.push(`Glossaire - terme "${term}" définition courte > 200 caractères`);
    }

    // Vérifier les termes liés
    if (entry.see && Array.isArray(entry.see)) {
      for (const relatedTerm of entry.see) {
        if (!(relatedTerm.toLowerCase() in Object.fromEntries(
          Object.keys(terms).map(t => [t.toLowerCase(), true]),
        ))) {
          warnings.push(`Glossaire - terme "${term}" référence "${relatedTerm}" non défini`);
        }
      }
    }
  }

  return warnings;
}

/**
 * Charge le template HTML pour les slides Markdown
 */
function loadSlideTemplate() {
  if (!existsSync(SLIDE_TEMPLATE_FILE)) {
    console.warn('  ⚠️  Template de slide non trouvé:', SLIDE_TEMPLATE_FILE);
    return null;
  }
  return readFileSync(SLIDE_TEMPLATE_FILE, 'utf-8');
}

/**
 * Convertit un fichier Markdown en HTML et l'écrit dans index.html
 * @param {string} slideDir - Chemin du dossier de la slide
 * @param {string} template - Template HTML
 * @param {object} slideData - Données du slide.json
 * @returns {boolean} - Succès de la conversion
 */
function convertMarkdownSlide(slideDir, template, slideData) {
  const mdPath = join(slideDir, 'index.md');
  const htmlPath = join(slideDir, 'index.html');

  try {
    // Lire le Markdown
    const markdown = readFileSync(mdPath, 'utf-8');

    // Convertir en HTML via l'utilitaire
    const htmlContent = convertMarkdown(markdown);

    // Injecter dans le template via l'utilitaire
    const title = slideData?.title || 'Slide';
    const fullHtml = injectInTemplate(template, title, htmlContent);

    // Écrire le fichier HTML généré
    writeFileSync(htmlPath, fullHtml);
    stats.markdownConverted++;

    return true;
  } catch (err) {
    stats.errors.push(`Erreur conversion Markdown ${mdPath}: ${err.message}`);
    return false;
  }
}

/**
 * Valide un manifest d'epic et convertit les slides Markdown
 * @param {object} epic - Manifest de l'epic
 * @param {string} epicDir - Chemin du dossier de l'epic
 * @param {string|null} template - Template HTML pour les slides Markdown
 */
function validateEpic(epic, epicDir, template) {
  // Valider les champs requis via l'utilitaire
  const { errors, warnings } = validateEpicFields(epic);

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

      // Convertir Markdown en HTML si nécessaire
      if (hasMd && !hasHtml && template) {
        const slideData = readJSON(slideJson);
        const converted = convertMarkdownSlide(slideDir, template, slideData);
        if (!converted) {
          errors.push(`Échec conversion Markdown pour: ${slideId}`);
        }
      } else if (!hasHtml && !hasMd) {
        errors.push(`Contenu manquant (index.html ou index.md) pour: ${slideId}`);
      } else if (hasMd && !template) {
        warnings.push(`Slide Markdown sans template, non convertie: ${slideId}`);
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
 * Traite un epic et retourne son entrée pour le catalogue
 * @param {string} epicId - ID de l'epic
 * @param {string|null} template - Template HTML pour les slides Markdown
 * @param {object|null} globalGlossary - Glossaire global
 */
function processEpic(epicId, template, globalGlossary) {
  const epicDir = join(EPICS_DIR, epicId);
  const epicJson = join(epicDir, 'epic.json');

  if (!existsSync(epicJson)) {
    return null;
  }

  stats.found++;
  const epic = readJSON(epicJson);
  if (!epic) {return null;}

  // Ignorer les brouillons
  if (epic.draft) {
    stats.drafts++;
    console.log(`  [DRAFT] ${epicId}`);
    return null;
  }

  // Valider et convertir les slides Markdown
  const validation = validateEpic(epic, epicDir, template);
  if (validation.errors.length > 0) {
    stats.errors.push(`${epicId}: ${validation.errors.join(', ')}`);
    console.log(`  [ERREUR] ${epicId}: ${validation.errors.length} erreur(s)`);
    return null;
  }
  if (validation.warnings.length > 0) {
    stats.warnings.push(`${epicId}: ${validation.warnings.join(', ')}`);
  }

  // Charger et valider le glossaire
  const { terms: glossaryTerms, termCount: glossaryTermCount } = loadEpicGlossary(epicDir, globalGlossary);
  if (glossaryTermCount > 0) {
    const glossaryWarnings = validateGlossary(glossaryTerms, epicId);
    if (glossaryWarnings.length > 0) {
      stats.warnings.push(`${epicId}: ${glossaryWarnings.join(', ')}`);
    }
  }

  // Compter les slides via l'utilitaire
  const { total, optional } = countSlides(epic.content);

  // Fonction pour récupérer les données d'une slide (utilisée par buildStructure)
  const getSlideData = (slideId) => {
    const slideJson = join(epicDir, 'slides', slideId, 'slide.json');
    return readJSON(slideJson);
  };

  // Construire l'entrée
  const entry = {
    id: epic.id,
    title: epic.title,
    description: epic.description,
    path: `./parcours/epics/${epicId}`,
    hierarchy: epic.hierarchy || ['autres'],
    tags: epic.tags || [],
    author: epic.metadata?.author || 'Anonyme',
    created: epic.metadata?.created,
    updated: epic.metadata?.updated,
    duration: epic.metadata?.duration,
    difficulty: epic.metadata?.difficulty,
    icon: epic.icon,
    thumbnail: epic.thumbnail ? `./parcours/epics/${epicId}/${epic.thumbnail}` : null,
    slideCount: total,
    optionalSlideCount: optional,
    hasIndex: !!epic.index,
    structure: buildStructure(epic.content, getSlideData),
    // Glossaire
    glossaryTermCount: glossaryTermCount > 0 ? glossaryTermCount : undefined,
  };

  const glossaryInfo = glossaryTermCount > 0 ? `, ${glossaryTermCount} termes glossaire` : '';
  stats.published++;
  console.log(`  [OK] ${epicId} (${total} slides${glossaryInfo})`);
  return entry;
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

  // Charger le template pour les slides Markdown
  const slideTemplate = loadSlideTemplate();
  if (slideTemplate) {
    console.log('Template slides Markdown chargé');
  }

  // Charger le glossaire global (optionnel)
  let globalGlossary = null;
  if (existsSync(GLOBAL_GLOSSARY_FILE)) {
    try {
      const data = JSON.parse(readFileSync(GLOBAL_GLOSSARY_FILE, 'utf-8'));
      globalGlossary = data.terms || data;
      console.log(`Glossaire global chargé: ${Object.keys(globalGlossary).length} termes`);
    } catch (err) {
      stats.warnings.push(`Erreur lecture glossaire global: ${err.message}`);
    }
  }

  // Scanner les epics
  console.log('\nScan des epics...');
  const epicDirs = existsSync(EPICS_DIR)
    ? readdirSync(EPICS_DIR).filter(f => statSync(join(EPICS_DIR, f)).isDirectory())
    : [];

  const epics = epicDirs
    .map(epicId => processEpic(epicId, slideTemplate, globalGlossary))
    .filter(Boolean);

  // Construire le catalogue
  console.log('\nConstruction du catalogue...');
  const catalogue = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    epics,
    taxonomy: {
      hierarchy: buildHierarchy(epics, config),
      tags: aggregateTags(epics, config),
    },
    featured: buildFeatured(epics, config),
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
  if (stats.markdownConverted > 0) {
    console.log(`Slides Markdown converties: ${stats.markdownConverted}`);
  }
  if (stats.glossaryTermsTotal > 0) {
    console.log(`Termes de glossaire: ${stats.glossaryTermsTotal}`);
  }

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
