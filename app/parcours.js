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
import {
  appendThumbnailImage, matchesQuery, renderTagFilters, setDiscoveryCount, setDiscoveryMessage,
} from '../lib/catalogue-ui.js';

let returnFocus = null;
let returnFocusEpicId = null;
let cardSequence = 0;

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
 * Catégorie d'un epic : sa première entrée de hiérarchie, ou « autres ».
 * @param {Object} epic - Données de l'epic
 * @returns {string} Identifiant de catégorie
 */
function epicCategory(epic) {
  return epic.hierarchy?.[0] || 'autres';
}

/**
 * Nombre d'étapes distinctes déjà visitées d'un epic.
 * @param {string} epicId - ID de l'epic
 * @returns {number} Étapes visitées
 */
function visitedStepCount(epicId) {
  return new Set(getEpicProgress(epicId).visited || []).size;
}

/**
 * Place la vignette de l'epic : image si fournie, sinon emoji.
 * @param {HTMLElement} thumb - Conteneur de la vignette
 * @param {Object} epic - Données de l'epic
 */
function renderEpicThumbnail(thumb, epic) {
  const defaultIcon = epic.icon || '📚';
  if (epic.thumbnail) {
    appendThumbnailImage(thumb, { src: epic.thumbnail, alt: '', fallback: defaultIcon });
  } else {
    thumb.textContent = defaultIcon;
  }
}

/**
 * Résume le contenu d'un epic : chapitres éventuels et étapes.
 * @param {Object} epic - Données de l'epic
 * @returns {string} Libellé du nombre de chapitres et d'étapes
 */
function epicSlidesSummary(epic) {
  const chapterCount = epic.structure?.filter(item => item.type === 'section').length || 0;
  return chapterCount > 0
    ? `${chapterCount} chapitre${chapterCount > 1 ? 's' : ''} · ${epic.slideCount} étapes`
    : `${epic.slideCount} étape${epic.slideCount > 1 ? 's' : ''}`;
}

/**
 * Ajoute au plus trois étiquettes à la carte.
 * @param {HTMLElement} container - Conteneur des étiquettes
 * @param {string[]} [tags] - Étiquettes de l'epic
 */
function appendEpicTags(container, tags) {
  for (const tag of (tags || []).slice(0, 3)) {
    const tagEl = document.createElement('span');
    tagEl.className = 'epic-tag';
    tagEl.textContent = tag;
    container.appendChild(tagEl);
  }
}

/**
 * Libellé d'action selon la progression.
 * @param {number} percent - Pourcentage parcouru
 * @returns {string} Invitation à commencer, continuer ou relire
 */
function progressLabelText(percent) {
  if (percent >= 100) { return 'Terminé · Relire'; }
  return percent > 0 ? `Continuer · ${percent} % parcouru` : 'Commencer le parcours';
}

/**
 * Affiche la progression : barre, libellé et état de la carte.
 * @param {HTMLElement} card - Carte de l'epic
 * @param {Object} epic - Données de l'epic
 */
function renderEpicProgress(card, epic) {
  const progressBar = card.querySelector('.epic-progress-bar');
  const progressLabel = card.querySelector('.epic-progress-label');
  const percent = epic.slideCount > 0
    ? Math.min(100, Math.round((visitedStepCount(epic.id) / epic.slideCount) * 100)) : 0;
  progressBar.style.width = `${percent}%`;
  progressBar.parentElement.setAttribute('aria-hidden', 'true');
  progressLabel.textContent = progressLabelText(percent);
  if (percent >= 100) {
    card.classList.add('completed');
  } else if (percent > 0) {
    card.classList.add('in-progress');
  }
}

/**
 * Crée un élément carte Epic
 * @param {Object} epic - Données de l'epic
 * @returns {DocumentFragment} Fragment DOM
 */
export function createEpicCardElement(epic) {
  const fragment = cloneTemplate('epic-card-template');
  const card = fragment.querySelector('.epic-card');
  const title = fragment.querySelector('.epic-title');
  const progressLabel = fragment.querySelector('.epic-progress-label');

  card.dataset.epicId = epic.id;
  card.dataset.path = epic.path;
  card.href = `#/parcours/${epic.id}`;
  renderEpicThumbnail(fragment.querySelector('.epic-thumb'), epic);

  title.textContent = epic.title;
  const instance = ++cardSequence;
  title.id = `epic-title-${instance}`;
  progressLabel.id = `epic-progress-${instance}`;
  card.setAttribute('aria-labelledby', title.id);
  card.setAttribute('aria-describedby', progressLabel.id);
  fragment.querySelector('.epic-description').textContent = epic.description;

  if (epic.duration) {
    fragment.querySelector('.epic-duration').textContent = epic.duration;
  }
  fragment.querySelector('.epic-slides').textContent = epicSlidesSummary(epic);
  appendEpicTags(fragment.querySelector('.epic-tags'), epic.tags);
  renderEpicProgress(card, epic);

  return fragment;
}

/**
 * Nom d'auteur recherchable, que l'auteur soit un texte ou un objet.
 * @param {Object} epic - Données de l'epic
 * @returns {string|undefined} Nom de l'auteur
 */
function epicAuthorName(epic) {
  return typeof epic.author === 'object' ? epic.author?.name : epic.author;
}

/**
 * Indique si un epic respecte la catégorie, le tag et la recherche actifs.
 * @param {Object} epic - Données de l'epic
 * @param {string} search - Recherche normalisée par trim
 * @returns {boolean} Vrai si l'epic est visible
 */
function matchesParcoursSelection(epic, search) {
  if (state.parcoursCategory && epicCategory(epic) !== state.parcoursCategory) { return false; }
  if (state.activeFilter && !epic.tags?.includes(state.activeFilter)) { return false; }
  return matchesQuery(search, epic.title, epic.description, epic.tags?.join(' '), epicAuthorName(epic));
}

/**
 * Filtre les epics selon la recherche et la catégorie active
 * @param {Object[]} epics - Liste des epics
 * @returns {Object[]} Epics filtrés
 */
function filterEpics(epics) {
  const search = el.search.value.trim();
  return epics.filter(epic => matchesParcoursSelection(epic, search));
}

/**
 * Ordre d'affichage d'une catégorie : PlayLab42 d'abord, « autres » en dernier.
 * @param {string} catId - Identifiant de catégorie
 * @param {Object} [taxCat] - Entrée de taxonomie
 * @returns {number} Rang de tri
 */
function categoryRank(catId, taxCat) {
  if (catId === 'playlab42') { return 0; }
  return catId === 'autres' ? 99 : (taxCat?.order || 50);
}

/**
 * Compare deux catégories selon leur rang (playlab42 en premier, autres en dernier).
 * @param {{id: string, order: number}} a - Catégorie
 * @param {{id: string, order: number}} b - Catégorie
 * @returns {number} Résultat de tri
 */
function compareCategories(a, b) {
  if (a.id === 'playlab42') { return -1; }
  if (b.id === 'playlab42') { return 1; }
  if (a.id === 'autres') { return 1; }
  if (b.id === 'autres') { return -1; }
  return (a.order || 0) - (b.order || 0);
}

/**
 * Construit les catégories à partir des epics réels, avec libellé et icône de la taxonomie.
 * @param {Object[]} epics - Epics du catalogue
 * @param {Object} [taxonomy] - Taxonomie éventuelle
 * @returns {Object[]} Catégories triées avec leur effectif
 */
function buildParcoursCategories(epics, taxonomy) {
  const categories = {};
  for (const epic of epics) {
    const id = epicCategory(epic);
    if (!categories[id]) {
      const taxCat = taxonomy?.hierarchy?.find(h => h.id === id);
      categories[id] = {
        id, label: taxCat?.label || id, icon: taxCat?.icon || '📁', order: categoryRank(id, taxCat), count: 0,
      };
    }
    categories[id].count++;
  }
  return Object.values(categories).sort(compareCategories);
}

/**
 * Rend les filtres par catégorie pour les parcours
 */
function renderParcoursCategoryFilters() {
  if (!state.parcoursCatalogue) { return; }
  const { epics, taxonomy } = state.parcoursCatalogue;
  renderTagFilters(el.parcoursCategoryFilters, buildParcoursCategories(epics, taxonomy),
    state.parcoursCategory, { attribute: 'category', allLabel: 'Tous les parcours' });
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

  title.textContent = category.label;
  fragment.querySelector('.category-section')?.setAttribute('data-collection', category.id);

  for (const epic of epicsInCategory) {
    epicsContainer.appendChild(createEpicCardElement(epic));
  }

  return fragment;
}

/**
 * Affiche l'indisponibilité du catalogue et vide les listes.
 */
function renderParcoursUnavailable() {
  el.emptyParcours.textContent = 'Impossible de charger les parcours. Rechargez la page pour réessayer.';
  el.emptyParcours.setAttribute('role', 'alert');
  el.emptyParcours.classList.add('visible');
  el.parcoursCategoriesExpanded.textContent = '';
  el.cardsParcours.textContent = '';
  renderTagFilters(el.parcoursCategoryFilters, [], null, { attribute: 'category', allLabel: 'Tous les parcours' });
  setDiscoveryMessage('Parcours indisponibles');
}

/**
 * Met à jour le message vide selon que le catalogue est vide ou filtré.
 * @param {number} total - Epics du catalogue
 * @param {number} visible - Epics après filtrage
 */
function updateParcoursEmptyState(total, visible) {
  el.emptyParcours.removeAttribute('role');
  el.emptyParcours.textContent = total
    ? 'Aucun parcours ne correspond à cette sélection.' : 'Aucun parcours disponible pour le moment.';
  el.emptyParcours.classList.toggle('visible', visible === 0);
}

/**
 * Indique si une recherche, une catégorie ou un tag restreint l'affichage.
 * @returns {boolean} Vrai si l'accueil par collections est remplacé par la liste filtrée
 */
function hasParcoursSelection() {
  return Boolean(el.search.value.trim() || state.parcoursCategory || state.activeFilter);
}

/**
 * Indique si l'epic est commencé sans être terminé.
 * @param {Object} epic - Données de l'epic
 * @returns {boolean} Vrai si une lecture est en cours
 */
function isEpicInProgress(epic) {
  const visited = visitedStepCount(epic.id);
  return visited > 0 && visited < epic.slideCount;
}

/**
 * Affiche la liste à plat des résultats filtrés.
 * @param {Object[]} epics - Epics visibles
 */
function renderParcoursResults(epics) {
  el.parcoursCategoriesExpanded.style.display = 'none';
  el.parcoursList.style.display = 'block';
  for (const epic of epics) {
    el.cardsParcours.appendChild(createEpicCardElement(epic));
  }
}

/**
 * Affiche l'accueil : lectures en cours puis autres parcours, sans doublon.
 * @param {Object[]} epics - Epics visibles
 */
function renderParcoursCollections(epics) {
  el.parcoursList.style.display = 'none';
  el.parcoursCategoriesExpanded.style.display = 'block';
  const continuing = epics.filter(isEpicInProgress);
  const continuingIds = new Set(continuing.map(epic => epic.id));
  const available = epics.filter(epic => !continuingIds.has(epic.id));
  if (continuing.length) {
    el.parcoursCategoriesExpanded.appendChild(
      createCategorySectionElement({ id: 'continue', label: 'Continuer votre lecture' }, continuing),
    );
  }
  if (available.length) {
    el.parcoursCategoriesExpanded.appendChild(createCategorySectionElement({
      id: 'explore', label: continuing.length ? 'Découvrir les parcours' : 'Tous les parcours',
    }, available));
  }
}

/**
 * Rend le focus à la carte qui l'avait avant un rendu.
 * @param {string} epicId - ID de l'epic focalisé
 */
function restoreEpicCardFocus(epicId) {
  [...el.viewCatalogue.querySelectorAll('.epic-card')]
    .find(card => card.dataset.epicId === epicId)?.focus({ preventScroll: true });
}

/**
 * Rend la page d'accueil Parcours
 *
 * La collection de reprise précède le catalogue, sans dupliquer les cartes.
 */
export function renderParcours() {
  if (state.activeTab !== 'parcours') { return; }
  if (!state.parcoursCatalogue) {
    renderParcoursUnavailable();
    return;
  }

  const { epics } = state.parcoursCatalogue;
  const focusedEpicId = document.activeElement?.closest('.epic-card')?.dataset.epicId;

  el.parcoursCategoriesExpanded.textContent = '';
  el.cardsParcours.textContent = '';
  renderParcoursCategoryFilters();

  const filteredEpics = filterEpics(epics);
  setDiscoveryCount(filteredEpics.length, 'parcours');
  updateParcoursEmptyState(epics.length, filteredEpics.length);
  if (hasParcoursSelection()) {
    renderParcoursResults(filteredEpics);
  } else {
    renderParcoursCollections(filteredEpics);
  }
  if (focusedEpicId) { restoreEpicCardFocus(focusedEpicId); }
}

/**
 * Ouvre un Epic dans le viewer
 * @param {string} epicId - ID de l'epic
 * @param {string} [slideId] - ID de la slide (optionnel)
 */
export function openEpic(epicId, slideId = null) {
  if (state.currentView !== 'parcours') {
    returnFocus = document.activeElement === document.body ? null : document.activeElement;
    returnFocusEpicId = returnFocus?.closest('.epic-card')?.dataset.epicId || epicId;
  }
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
  if (state.parcoursCatalogue) { renderParcours(); }
  // Le rendu differe de la recherche peut remplacer la carte pendant la lecture.
  const target = returnFocus?.isConnected ? returnFocus
    : [...el.viewCatalogue.querySelectorAll('.epic-card')]
      .find(card => card.dataset.epicId === returnFocusEpicId);
  (target || el.search)?.focus();
}

/**
 * Sélectionne une catégorie pour filtrer les parcours
 * @param {string|null} categoryId - ID de la catégorie (null pour "Tous")
 */
export function selectParcoursCategory(categoryId) {
  setState({ parcoursCategory: categoryId });
  renderParcours();
}
