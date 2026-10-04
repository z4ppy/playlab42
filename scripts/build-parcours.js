#!/usr/bin/env node
/**
 * Script de build pour le catalogue Parcours
 * Génère data/parcours.json à partir des epics dans parcours/epics/
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getRootDir, readJSONSync, getBuildTimestamp } from './lib/build-utils.js';
import { publishCatalogue } from './lib/build-report.js';
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
// Seul ce marqueur autorise le remplacement d'un HTML existant par du Markdown.
const GENERATED_SLIDE_MARKER = '<!-- playlab42:generated-from-index.md -->';

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
    writeFileSync(htmlPath, `${GENERATED_SLIDE_MARKER}\n${fullHtml}`);
    stats.markdownConverted++;

    return true;
  } catch (err) {
    stats.errors.push(`Erreur conversion Markdown ${mdPath}: ${err.message}`);
    return false;
  }
}

/**
 * Inspecte les sources d'une slide (HTML, Markdown, marqueur de génération)
 * @param {string} slideDir - Chemin du dossier de la slide
 */
function inspectSlideSources(slideDir) {
  const htmlPath = join(slideDir, 'index.html');
  const hasHtml = existsSync(htmlPath);
  const htmlContent = hasHtml ? readFileSync(htmlPath, 'utf-8') : '';
  return {
    hasHtml,
    hasMd: existsSync(join(slideDir, 'index.md')),
    isGenerated: htmlContent.startsWith(`${GENERATED_SLIDE_MARKER}\n`)
      || htmlContent.startsWith(`${GENERATED_SLIDE_MARKER}\r\n`),
  };
}

/**
 * Convertit la source Markdown d'une slide
 * @returns {string|null} Erreur de conversion, sinon null
 */
function convertSlideSource(slideId, slideDir, template) {
  if (!template) {
    return `Template Markdown manquant (${SLIDE_TEMPLATE_FILE}) pour: ${slideId}`;
  }
  const slideData = readJSONSync(join(slideDir, 'slide.json'), stats);
  if (!slideData) {
    return `slide.json invalide pour: ${slideId}`;
  }
  return convertMarkdownSlide(slideDir, template, slideData)
    ? null
    : `Échec conversion Markdown pour: ${slideId}`;
}

/**
 * Vérifie une slide référencée et convertit sa source Markdown si besoin
 * @returns {string|null} Première erreur de la slide, sinon null
 */
function checkSlide(slideId, epicDir, template) {
  const slideDir = join(epicDir, 'slides', slideId);
  if (!existsSync(slideDir)) {
    return `Slide non trouvée: ${slideId}`;
  }
  if (!existsSync(join(slideDir, 'slide.json'))) {
    return `slide.json manquant pour: ${slideId}`;
  }

  const { hasHtml, hasMd, isGenerated } = inspectSlideSources(slideDir);
  if (hasMd && hasHtml && !isGenerated) {
    return `Sources ambiguës pour ${slideId}: index.md et index.html sans marqueur généré. `
      + 'Choisir une source : conserver index.html et retirer index.md, ou sauvegarder puis '
      + 'supprimer index.html pour le régénérer depuis index.md.';
  }
  if (hasMd) {
    return convertSlideSource(slideId, slideDir, template);
  }
  if (isGenerated) {
    return `Source index.md manquante pour le HTML généré: ${slideId}. `
      + 'Restaurer index.md ou retirer le marqueur pour adopter index.html comme source auteur.';
  }
  return hasHtml ? null : `Contenu manquant (index.html ou index.md) pour: ${slideId}`;
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

  const slideIds = epic.content ? extractSlideIds(epic.content) : [];
  for (const slideId of slideIds) {
    const error = checkSlide(slideId, epicDir, template);
    if (error) {
      errors.push(error);
    }
  }

  // Vérifier vignette si spécifiée
  if (epic.thumbnail && !existsSync(join(epicDir, epic.thumbnail))) {
    warnings.push(`Vignette non trouvée: ${epic.thumbnail}`);
  }

  return { errors, warnings };
}

/**
 * Charge, valide et consigne les avertissements du glossaire d'un epic
 * @returns {number} Nombre de termes du glossaire fusionné
 */
function checkEpicGlossary(epicId, epicDir, globalGlossary) {
  const { terms, termCount } = loadEpicGlossary(epicDir, globalGlossary);
  if (termCount > 0) {
    const glossaryWarnings = validateGlossary(terms, epicId);
    if (glossaryWarnings.length > 0) {
      stats.warnings.push(`${epicId}: ${glossaryWarnings.join(', ')}`);
    }
  }
  return termCount;
}

/**
 * Construit l'entrée de catalogue d'un epic valide
 */
function buildEpicEntry(epic, epicId, epicDir, glossaryTermCount) {
  const { total, optional } = countSlides(epic.content);
  const metadata = epic.metadata || {};

  // Fonction pour récupérer les données d'une slide (utilisée par buildStructure)
  const getSlideData = (slideId) => {
    const slideJson = join(epicDir, 'slides', slideId, 'slide.json');
    return readJSONSync(slideJson, stats);
  };

  return {
    id: epic.id,
    title: epic.title,
    description: epic.description,
    path: `./parcours/epics/${epicId}`,
    hierarchy: epic.hierarchy || ['autres'],
    order: epic.order,
    tags: epic.tags || [],
    author: metadata.author || 'Anonyme',
    created: metadata.created,
    updated: metadata.updated,
    duration: metadata.duration,
    difficulty: metadata.difficulty,
    icon: epic.icon,
    thumbnail: epic.thumbnail ? `./parcours/epics/${epicId}/${epic.thumbnail}` : null,
    slideCount: total,
    optionalSlideCount: optional,
    hasIndex: !!epic.index,
    structure: buildStructure(epic.content, getSlideData),
    glossaryTermCount: glossaryTermCount > 0 ? glossaryTermCount : undefined,
  };
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
  const epic = readJSONSync(epicJson, stats);
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

  const glossaryTermCount = checkEpicGlossary(epicId, epicDir, globalGlossary);
  const entry = buildEpicEntry(epic, epicId, epicDir, glossaryTermCount);

  const glossaryInfo = glossaryTermCount > 0 ? `, ${glossaryTermCount} termes glossaire` : '';
  stats.published++;
  console.log(`  [OK] ${epicId} (${entry.slideCount} slides${glossaryInfo})`);
  return entry;
}

/**
 * Charge le glossaire global (optionnel)
 * @returns {object|null}
 */
function loadGlobalGlossary() {
  if (!existsSync(GLOBAL_GLOSSARY_FILE)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(GLOBAL_GLOSSARY_FILE, 'utf-8'));
    const glossary = data.terms || data;
    console.log(`Glossaire global chargé: ${Object.keys(glossary).length} termes`);
    return glossary;
  } catch (err) {
    stats.warnings.push(`Erreur lecture glossaire global: ${err.message}`);
    return null;
  }
}

/**
 * Affiche les compteurs du rapport, avant avertissements et erreurs
 */
function printCounts(catalogue) {
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
}

/**
 * Point d'entrée principal
 */
function main() {
  console.log('Build Parcours');
  console.log('==============\n');

  // Charger la config
  const config = readJSONSync(CONFIG_FILE, stats) || {};
  console.log('Config chargée:', CONFIG_FILE);

  // Charger le template pour les slides Markdown
  const slideTemplate = loadSlideTemplate();
  if (slideTemplate) {
    console.log('Template slides Markdown chargé');
  }

  const globalGlossary = loadGlobalGlossary();

  // Scanner les epics
  console.log('\nScan des epics...');
  const epicDirs = existsSync(EPICS_DIR)
    ? readdirSync(EPICS_DIR).filter(f => statSync(join(EPICS_DIR, f)).isDirectory())
    : [];

  const epics = epicDirs
    .map(epicId => processEpic(epicId, slideTemplate, globalGlossary))
    .filter(Boolean)
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  // Construire le catalogue
  console.log('\nConstruction du catalogue...');
  const catalogue = {
    version: '1.0',
    generatedAt: getBuildTimestamp(),
    epics,
    taxonomy: {
      hierarchy: buildHierarchy(epics, config),
      tags: aggregateTags(epics, config),
    },
    featured: buildFeatured(epics, config),
  };

  printCounts(catalogue);
  if (!publishCatalogue(OUTPUT_FILE, catalogue, stats)) {
    process.exit(1);
  }
}

main();
