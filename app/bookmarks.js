/**
 * Gestion des bookmarks (favoris)
 * @module app/bookmarks
 *
 * Chargement, filtrage et affichage des bookmarks.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { cloneTemplate } from '../lib/dom.js';

/**
 * Charge le catalogue bookmarks depuis le serveur
 */
export async function loadBookmarksCatalogue() {
  try {
    const response = await fetch('./data/bookmarks.json');
    if (!response.ok) { throw new Error('Catalogue bookmarks introuvable'); }
    setState({ bookmarksCatalogue: await response.json() });
  } catch (e) {
    console.warn('Catalogue bookmarks non disponible:', e.message);
    setState({ bookmarksCatalogue: null });
  }
}

/**
 * Récupère les tags uniques des bookmarks
 * @returns {Object[]} Liste des tags avec leur count
 */
function getBookmarkTags() {
  if (!state.bookmarksCatalogue?.tags) { return []; }
  return state.bookmarksCatalogue.tags;
}

/**
 * Rend les filtres de tags pour les bookmarks
 */
function renderBookmarkFilters() {
  const tags = getBookmarkTags();
  el.bookmarkFilters.textContent = '';

  // Bouton "Tous"
  const allBtn = document.createElement('button');
  allBtn.className = `filter${!state.bookmarkTagFilter ? ' active' : ''}`;
  allBtn.dataset.tag = '';
  allBtn.textContent = 'Tous';
  el.bookmarkFilters.appendChild(allBtn);

  // Boutons par tag (top 10)
  for (const tag of tags.slice(0, 10)) {
    const btn = document.createElement('button');
    btn.className = `filter${state.bookmarkTagFilter === tag.id ? ' active' : ''}`;
    btn.dataset.tag = tag.id;
    btn.textContent = `${tag.id} (${tag.count})`;
    el.bookmarkFilters.appendChild(btn);
  }
}

/**
 * Filtre les bookmarks d'une catégorie
 * @param {Object[]} bookmarks - Liste des bookmarks
 * @returns {Object[]} Bookmarks filtrés
 */
function filterBookmarks(bookmarks) {
  const search = el.search.value.toLowerCase().trim();

  return bookmarks.filter(bookmark => {
    // Filtre par tag
    if (state.bookmarkTagFilter && !bookmark.tags?.includes(state.bookmarkTagFilter)) {
      return false;
    }
    // Filtre par recherche
    if (search) {
      const searchable = `${bookmark.displayTitle || bookmark.title} ${bookmark.displayDescription || bookmark.description || ''} ${bookmark.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Crée un élément bookmark
 * @param {Object} bookmark - Données du bookmark
 * @returns {DocumentFragment} Fragment DOM
 */
function createBookmarkItemElement(bookmark) {
  const fragment = cloneTemplate('bookmark-item-template');
  const link = fragment.querySelector('a');
  const icon = fragment.querySelector('.bookmark-icon');
  const title = fragment.querySelector('.bookmark-title');
  const description = fragment.querySelector('.bookmark-description');
  const domain = fragment.querySelector('.bookmark-domain');

  link.href = bookmark.url;
  link.dataset.bookmarkUrl = bookmark.url;
  icon.textContent = bookmark.icon || '🔗';
  title.textContent = bookmark.displayTitle || bookmark.title;
  description.textContent = bookmark.displayDescription || bookmark.description || '';
  domain.textContent = bookmark.domain;

  // Stocker les données pour la preview
  link.dataset.bookmark = JSON.stringify(bookmark);

  return fragment;
}

/**
 * Crée un élément catégorie de bookmarks
 * @param {Object} category - Données de la catégorie
 * @returns {DocumentFragment} Fragment DOM
 */
function createBookmarkCategoryElement(category) {
  const fragment = cloneTemplate('bookmark-category-template');
  const container = fragment.querySelector('.bookmark-category');
  const icon = fragment.querySelector('.bookmark-category-icon');
  const label = fragment.querySelector('.bookmark-category-label');
  const count = fragment.querySelector('.bookmark-category-count');
  const list = fragment.querySelector('.bookmark-list');

  icon.textContent = category.icon || '📁';
  label.textContent = category.label;

  const filteredBookmarks = filterBookmarks(category.bookmarks);
  count.textContent = `(${filteredBookmarks.length})`;

  // Ajouter les bookmarks
  for (const bookmark of filteredBookmarks) {
    list.appendChild(createBookmarkItemElement(bookmark));
  }

  // Masquer si aucun bookmark après filtrage
  if (filteredBookmarks.length === 0) {
    container.style.display = 'none';
  }

  return fragment;
}

/**
 * Affiche la preview card d'un bookmark
 * @param {Object} bookmarkData - Données du bookmark
 * @param {HTMLElement} anchorElement - Élément ancre pour le positionnement
 */
export function showBookmarkPreview(bookmarkData, anchorElement) {
  const preview = el.bookmarkPreview;
  if (!preview) {
    return;
  }

  const imageEl = preview.querySelector('.bookmark-preview-image');
  const titleEl = preview.querySelector('.bookmark-preview-title');
  const descEl = preview.querySelector('.bookmark-preview-description');
  const domainEl = preview.querySelector('.bookmark-preview-domain');

  // Remplir le contenu
  titleEl.textContent = bookmarkData.displayTitle || bookmarkData.title;
  descEl.textContent = bookmarkData.displayDescription || bookmarkData.description || '';
  domainEl.textContent = bookmarkData.domain;

  // Image OG ou fallback
  const ogImage = bookmarkData.meta?.ogImage;
  if (ogImage) {
    imageEl.style.backgroundImage = `url(${ogImage})`;
    imageEl.classList.add('has-image');
  } else {
    imageEl.style.backgroundImage = '';
    imageEl.classList.remove('has-image');
  }

  // Positionner la preview
  const rect = anchorElement.getBoundingClientRect();
  const previewWidth = 320;
  const previewHeight = 200;
  const margin = 12;

  // Position par défaut : à droite de l'élément
  let left = rect.right + margin;
  let top = rect.top;

  // Si déborde à droite, afficher à gauche
  if (left + previewWidth > window.innerWidth) {
    left = rect.left - previewWidth - margin;
  }

  // Si déborde en bas, remonter
  if (top + previewHeight > window.innerHeight) {
    top = window.innerHeight - previewHeight - margin;
  }

  // Si déborde en haut, descendre
  if (top < margin) {
    top = margin;
  }

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.classList.add('visible');
  preview.setAttribute('aria-hidden', 'false');
}

/**
 * Cache la preview card
 */
export function hideBookmarkPreview() {
  const preview = el.bookmarkPreview;
  if (!preview) {
    return;
  }

  preview.classList.remove('visible');
  preview.setAttribute('aria-hidden', 'true');
}

/**
 * Rend les bookmarks
 */
export function renderBookmarks() {
  if (!state.bookmarksCatalogue) {
    el.emptyBookmarks.classList.add('visible');
    return;
  }

  const { categories } = state.bookmarksCatalogue;

  // Reset
  el.bookmarkTree.textContent = '';
  el.emptyBookmarks.classList.remove('visible');

  // Rendre les filtres
  renderBookmarkFilters();

  // Rendre les catégories
  let totalVisible = 0;
  for (const category of categories) {
    const filteredBookmarks = filterBookmarks(category.bookmarks);
    if (filteredBookmarks.length > 0) {
      el.bookmarkTree.appendChild(createBookmarkCategoryElement(category));
      totalVisible += filteredBookmarks.length;
    }
  }

  // Message vide si aucun résultat
  el.emptyBookmarks.classList.toggle('visible', totalVisible === 0);
}

/**
 * Sélectionne un tag pour filtrer les bookmarks
 * @param {string|null} tagId - ID du tag (null pour "Tous")
 */
export function selectBookmarkTag(tagId) {
  setState({ bookmarkTagFilter: tagId || null });
  renderBookmarks();
}
