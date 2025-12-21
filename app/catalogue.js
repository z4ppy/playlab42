/**
 * Gestion du catalogue (jeux et outils)
 * @module app/catalogue
 *
 * Chargement, filtrage et affichage du catalogue games/tools.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { cloneTemplate } from '../lib/dom.js';

/**
 * Charge le catalogue depuis le serveur
 */
export async function loadCatalogue() {
  try {
    const response = await fetch('./data/catalogue.json');
    if (!response.ok) { throw new Error('Catalogue introuvable'); }
    setState({ catalogue: await response.json() });
    renderCatalogue();
  } catch (e) {
    console.error('Erreur chargement catalogue:', e);
    el.cardsGames.textContent = '';
    el.cardsTools.textContent = '';
    const errorEl = document.createElement('p');
    errorEl.className = 'error';
    errorEl.textContent = 'Erreur de chargement du catalogue';
    el.cardsGames.appendChild(errorEl);
  }
}

/**
 * Extrait tous les tags uniques de l'onglet actif
 * @returns {string[]} Liste des tags triés
 */
export function getTagsForCurrentTab() {
  if (!state.catalogue) { return []; }
  const items = state.activeTab === 'games' ? state.catalogue.games : state.catalogue.tools;
  const tags = new Set();
  items.forEach(item => {
    item.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Crée un élément filtre
 * @param {string} tag - Tag du filtre (vide pour "Tous")
 * @param {boolean} isActive - Si le filtre est actif
 * @returns {DocumentFragment} Fragment DOM
 */
function createFilterElement(tag, isActive) {
  const fragment = cloneTemplate('filter-template');
  const btn = fragment.querySelector('.filter');
  btn.textContent = tag || 'Tous';
  btn.dataset.tag = tag;
  if (isActive) { btn.classList.add('active'); }
  return fragment;
}

/**
 * Rend les filtres de tags pour l'onglet actif
 */
export function renderFilters() {
  const tags = getTagsForCurrentTab();
  el.filters.textContent = '';

  // Filtre "Tous"
  el.filters.appendChild(createFilterElement('', state.activeFilter === ''));

  // Filtres par tag
  for (const tag of tags) {
    el.filters.appendChild(createFilterElement(tag, state.activeFilter === tag));
  }
}

/**
 * Crée un élément carte
 * @param {Object} item - Données du jeu/outil
 * @param {string} type - Type ('game' ou 'tool')
 * @returns {DocumentFragment} Fragment DOM
 */
export function createCardElement(item, type) {
  const fragment = cloneTemplate('card-template');
  const card = fragment.querySelector('.card');
  const thumb = fragment.querySelector('.card-thumb');
  const title = fragment.querySelector('h3');
  const desc = fragment.querySelector('p');
  const tagsContainer = fragment.querySelector('.card-tags');

  // Data attributes
  card.dataset.id = item.id;
  card.dataset.type = type;
  card.dataset.path = item.path;

  // Thumbnail
  if (type === 'game') {
    const thumbSrc = item.path.replace('index.html', 'thumb.png');
    const img = document.createElement('img');
    img.src = thumbSrc;
    img.alt = item.name;
    img.loading = 'lazy';
    img.onerror = () => {
      thumb.textContent = item.icon || '🎮';
    };
    thumb.appendChild(img);
  } else {
    thumb.textContent = item.icon || '🔧';
  }

  // Info
  title.textContent = (item.icon ? `${item.icon} ` : '') + item.name;
  desc.textContent = item.description;

  // Tags
  if (item.tags?.length) {
    for (const tag of item.tags.slice(0, 3)) {
      const tagFragment = cloneTemplate('tag-template');
      const tagEl = tagFragment.querySelector('.card-tag');
      tagEl.textContent = tag;
      tagsContainer.appendChild(tagFragment);
    }
  }

  return fragment;
}

/**
 * Filtre les items selon la recherche et le tag actif
 * @param {Object[]} items - Liste des items
 * @returns {Object[]} Items filtrés
 */
export function filterItems(items) {
  const search = el.search.value.toLowerCase().trim();
  return items.filter(item => {
    // Filtre par tag
    if (state.activeFilter && !item.tags?.includes(state.activeFilter)) {
      return false;
    }
    // Filtre par recherche
    if (search) {
      const searchable = `${item.name} ${item.description}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Rend le catalogue (onglet actif uniquement)
 */
export function renderCatalogue() {
  if (!state.catalogue) { return; }

  renderFilters();

  if (state.activeTab === 'tools') {
    const filteredTools = filterItems(state.catalogue.tools);
    el.cardsTools.textContent = '';
    for (const tool of filteredTools) {
      el.cardsTools.appendChild(createCardElement(tool, 'tool'));
    }
    el.emptyTools.classList.toggle('visible', filteredTools.length === 0 && state.catalogue.tools.length > 0);
  }

  if (state.activeTab === 'games') {
    const filteredGames = filterItems(state.catalogue.games);
    el.cardsGames.textContent = '';
    for (const game of filteredGames) {
      el.cardsGames.appendChild(createCardElement(game, 'game'));
    }
    el.emptyGames.classList.toggle('visible', filteredGames.length === 0 && state.catalogue.games.length > 0);
  }
}
