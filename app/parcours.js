/**
 * Gestion des parcours pédagogiques (epics)
 * @module app/parcours
 *
 * Chargement, filtrage et affichage des parcours.
 * Intégration avec le ParcoursViewer.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { getEpicProgress } from './storage.js';
import { cloneTemplate } from '../lib/dom.js';
import { ParcoursViewer } from '../lib/parcours-viewer.js';

// Dimensions intrinsèques des vignettes : standard de fait du dépôt 380x180
// (ratio 19/9, cf. --thumb-ratio dans style.css). Posées en attributs width/
// height sur les <img> pour réserver la place avant chargement (anti-CLS) ;
// le rendu final reste piloté par le CSS (width/height 100% + object-fit).
const THUMB_WIDTH = 380;
const THUMB_HEIGHT = 180;

/**
 * Charge le catalogue parcours depuis le serveur
 */
export async function loadParcoursCatalogue() {
  try {
    const response = await fetch('./data/parcours.json');
    if (!response.ok) { throw new Error('Catalogue parcours introuvable'); }
    setState({ parcoursCatalogue: await response.json() });
  } catch (e) {
    console.warn('Catalogue parcours non disponible:', e.message);
    setState({ parcoursCatalogue: null });
  }
}

/**
 * Crée un élément carte Epic
 * @param {Object} epic - Données de l'epic
 * @returns {DocumentFragment} Fragment DOM
 */
function createEpicCardElement(epic) {
  const fragment = cloneTemplate('epic-card-template');
  const card = fragment.querySelector('.epic-card');
  const thumb = fragment.querySelector('.epic-thumb');
  const title = fragment.querySelector('.epic-title');
  const desc = fragment.querySelector('.epic-description');
  const duration = fragment.querySelector('.epic-duration');
  const slides = fragment.querySelector('.epic-slides');
  const tagsContainer = fragment.querySelector('.epic-tags');
  const progressBar = fragment.querySelector('.epic-progress-bar');

  // Data attributes
  card.dataset.epicId = epic.id;
  card.dataset.path = epic.path;

  // Thumbnail
  const defaultIcon = epic.icon || '📚';
  if (epic.thumbnail) {
    const img = document.createElement('img');
    img.src = epic.thumbnail;
    img.alt = epic.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = THUMB_WIDTH;
    img.height = THUMB_HEIGHT;
    img.onerror = () => {
      // Repli : l'emoji remplace l'image cassée dans le conteneur
      thumb.textContent = defaultIcon;
    };
    thumb.appendChild(img);
  } else {
    thumb.textContent = defaultIcon;
  }

  // Info
  title.textContent = (epic.icon ? `${epic.icon} ` : '') + epic.title;
  desc.textContent = epic.description;

  // Meta
  if (epic.duration) {
    duration.textContent = `⏱ ${epic.duration}`;
  }
  slides.textContent = `📄 ${epic.slideCount} slides`;

  // Tags
  if (epic.tags?.length) {
    for (const tag of epic.tags.slice(0, 3)) {
      const tagEl = document.createElement('span');
      tagEl.className = 'epic-tag';
      tagEl.textContent = tag;
      tagsContainer.appendChild(tagEl);
    }
  }

  // Progress
  const progress = getEpicProgress(epic.id);
  const visitedCount = progress.visited?.length || 0;
  const progressPercent = epic.slideCount > 0 ? (visitedCount / epic.slideCount) * 100 : 0;
  progressBar.style.width = `${progressPercent}%`;

  if (progressPercent >= 100) {
    card.classList.add('completed');
  } else if (progressPercent > 0) {
    card.classList.add('in-progress');
  }

  return fragment;
}

/**
 * Filtre les epics selon la recherche et la catégorie active
 * @param {Object[]} epics - Liste des epics
 * @returns {Object[]} Epics filtrés
 */
function filterEpics(epics) {
  const search = el.search.value.toLowerCase().trim();
  return epics.filter(epic => {
    // Filtre par catégorie
    if (state.parcoursCategory && epic.hierarchy[0] !== state.parcoursCategory) {
      return false;
    }
    // Filtre par tag
    if (state.activeFilter && !epic.tags?.includes(state.activeFilter)) {
      return false;
    }
    // Filtre par recherche
    if (search) {
      const searchable = `${epic.title} ${epic.description} ${epic.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Rend les filtres par catégorie pour les parcours
 */
function renderParcoursCategoryFilters() {
  if (!state.parcoursCatalogue) { return; }

  el.parcoursCategoryFilters.textContent = '';

  const { epics, taxonomy } = state.parcoursCatalogue;

  // Construire les catégories à partir des epics réels
  const categoriesWithCount = {};
  for (const epic of epics) {
    const catId = epic.hierarchy[0] || 'autres';
    if (!categoriesWithCount[catId]) {
      const taxCat = taxonomy.hierarchy.find(h => h.id === catId);
      categoriesWithCount[catId] = {
        id: catId,
        label: taxCat?.label || catId,
        icon: taxCat?.icon || '📁',
        order: catId === 'playlab42' ? 0 : (catId === 'autres' ? 99 : (taxCat?.order || 50)),
        count: 0,
      };
    }
    categoriesWithCount[catId].count++;
  }

  // Bouton "Tous"
  const allBtn = document.createElement('button');
  allBtn.className = `filter${!state.parcoursCategory ? ' active' : ''}`;
  allBtn.dataset.category = '';
  allBtn.textContent = 'Tous';
  el.parcoursCategoryFilters.appendChild(allBtn);

  // Boutons par catégorie (ordre: playlab42 en premier, autres en dernier)
  const sortedCategories = Object.values(categoriesWithCount).sort((a, b) => {
    if (a.id === 'playlab42') { return -1; }
    if (b.id === 'playlab42') { return 1; }
    if (a.id === 'autres') { return 1; }
    if (b.id === 'autres') { return -1; }
    return (a.order || 0) - (b.order || 0);
  });

  for (const category of sortedCategories) {
    if (category.count === 0) { continue; } // Masquer catégories vides

    const btn = document.createElement('button');
    btn.className = `filter${state.parcoursCategory === category.id ? ' active' : ''}`;
    btn.dataset.category = category.id;
    btn.textContent = `${category.icon || ''} ${category.label} (${category.count})`;
    el.parcoursCategoryFilters.appendChild(btn);
  }
}

/**
 * Crée une section de catégorie dépliée
 * @param {Object} category - Données de la catégorie
 * @param {Object[]} epicsInCategory - Epics de la catégorie
 * @returns {DocumentFragment} Fragment DOM
 */
function createCategorySectionElement(category, epicsInCategory) {
  const fragment = cloneTemplate('category-section-template');
  const title = fragment.querySelector('.category-section-title');
  const epicsContainer = fragment.querySelector('.category-epics');

  title.textContent = `${category.icon || ''} ${category.label}`;

  for (const epic of epicsInCategory) {
    epicsContainer.appendChild(createEpicCardElement(epic));
  }

  return fragment;
}

/**
 * Rend la page d'accueil Parcours
 *
 * Ordre d'affichage :
 * 1. Catégorie PlayLab42 (tous les epics de playlab42)
 * 2. Récemment ajoutés (epics récents HORS playlab42)
 * 3. Autres catégories (epics pas encore affichés)
 */
export function renderParcours() {
  if (!state.parcoursCatalogue) {
    el.emptyParcours.classList.add('visible');
    return;
  }

  const { epics, taxonomy, featured } = state.parcoursCatalogue;

  // Reset
  el.parcoursCategoryFilters.textContent = '';
  el.parcoursCategoriesExpanded.textContent = '';
  el.cardsParcours.textContent = '';

  // Toujours afficher les filtres par catégorie
  renderParcoursCategoryFilters();

  // Mode recherche : afficher liste filtrée
  const hasSearch = el.search.value.trim().length > 0;

  if (hasSearch) {
    // Masquer accueil, afficher liste
    el.parcoursCategoriesExpanded.style.display = 'none';
    el.parcoursList.style.display = 'block';

    const filteredEpics = filterEpics(epics);
    for (const epic of filteredEpics) {
      el.cardsParcours.appendChild(createEpicCardElement(epic));
    }
    el.emptyParcours.classList.toggle('visible', filteredEpics.length === 0);
    return;
  }

  // Mode accueil
  el.parcoursList.style.display = 'none';
  el.emptyParcours.classList.remove('visible');
  el.parcoursCategoriesExpanded.style.display = 'block';

  // Set pour tracker les epics déjà affichés
  const displayedIds = new Set();

  // Construire la liste des catégories basée sur les epics réels
  const categoriesFromEpics = {};
  for (const epic of epics) {
    const catId = epic.hierarchy[0] || 'autres';
    if (!categoriesFromEpics[catId]) {
      const taxCat = taxonomy.hierarchy.find(h => h.id === catId);
      categoriesFromEpics[catId] = {
        id: catId,
        label: taxCat?.label || catId,
        icon: taxCat?.icon || '📁',
        order: taxCat?.order || (catId === 'autres' ? 99 : 50),
      };
    }
  }

  // Trier les catégories : playlab42 en premier, autres en dernier
  const sortedHierarchy = Object.values(categoriesFromEpics).sort((a, b) => {
    if (a.id === 'playlab42') { return -1; }
    if (b.id === 'playlab42') { return 1; }
    if (a.id === 'autres') { return 1; }
    if (b.id === 'autres') { return -1; }
    return (a.order || 0) - (b.order || 0);
  });

  // Trouver la catégorie playlab42
  const playlab42Category = sortedHierarchy.find(c => c.id === 'playlab42');

  // === 1. Afficher la catégorie PlayLab42 ===
  if (playlab42Category && (!state.parcoursCategory || state.parcoursCategory === 'playlab42')) {
    const playlab42Epics = epics.filter(e => e.hierarchy[0] === 'playlab42');

    if (playlab42Epics.length > 0) {
      el.parcoursCategoriesExpanded.appendChild(
        createCategorySectionElement(playlab42Category, playlab42Epics),
      );
      playlab42Epics.forEach(e => displayedIds.add(e.id));
    }
  }

  // === 2. Afficher les récents (HORS playlab42) ===
  const recentEpics = (featured.recent || []).filter(e => {
    // Exclure ceux déjà affichés (playlab42)
    if (displayedIds.has(e.id)) { return false; }
    // Si filtre par catégorie, respecter le filtre
    if (state.parcoursCategory && e.hierarchy[0] !== state.parcoursCategory) { return false; }
    return true;
  });

  if (recentEpics.length > 0) {
    // Créer une section "Récemment ajoutés"
    const recentCategory = {
      id: 'recent',
      label: 'Récemment ajoutés',
      icon: '🕐',
    };
    el.parcoursCategoriesExpanded.appendChild(
      createCategorySectionElement(recentCategory, recentEpics),
    );
    recentEpics.forEach(e => displayedIds.add(e.id));
  }

  // === 3. Afficher les autres catégories (epics pas encore affichés) ===
  for (const category of sortedHierarchy) {
    // Skip playlab42, déjà affiché en premier
    if (category.id === 'playlab42') { continue; }

    // Si filtre par catégorie et pas cette catégorie, skip
    if (state.parcoursCategory && state.parcoursCategory !== category.id) { continue; }

    // Epics de cette catégorie, excluant ceux déjà affichés
    const epicsInCategory = epics.filter(e =>
      e.hierarchy[0] === category.id && !displayedIds.has(e.id),
    );

    // Ne pas afficher catégorie vide
    if (epicsInCategory.length === 0) { continue; }

    el.parcoursCategoriesExpanded.appendChild(
      createCategorySectionElement(category, epicsInCategory),
    );
  }
}

/**
 * Ouvre un Epic dans le viewer
 * @param {string} epicId - ID de l'epic
 * @param {string} [slideId] - ID de la slide (optionnel)
 */
export function openEpic(epicId, slideId = null) {
  // Masquer les autres vues
  el.viewCatalogue.classList.remove('active');
  el.viewGame.classList.remove('active');
  el.viewSettings.classList.remove('active');
  el.viewParcours.classList.add('active');

  setState({ currentView: 'parcours' });

  // Créer le viewer s'il n'existe pas
  if (!state.parcoursViewer) {
    state.parcoursViewer = new ParcoursViewer(el.viewParcours, {
      onClose: () => {
        closeParcours();
      },
      onSlideChange: (slide, index) => {
        console.log(`[Portal] Slide ${index + 1}: ${slide.title}`);
      },
    });
  }

  // Charger l'epic
  state.parcoursViewer.load(epicId, slideId);
}

/**
 * Ferme le viewer de parcours et retourne au catalogue
 */
export function closeParcours() {
  el.viewParcours.classList.remove('active');
  el.viewCatalogue.classList.add('active');
  setState({ currentView: 'catalogue' });
}

/**
 * Sélectionne une catégorie pour filtrer les parcours
 * @param {string|null} categoryId - ID de la catégorie (null pour "Tous")
 */
export function selectParcoursCategory(categoryId) {
  setState({ parcoursCategory: categoryId });
  renderParcours();
}
