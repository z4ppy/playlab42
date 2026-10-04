/**
 * Gestion du catalogue (jeux et outils)
 * @module app/catalogue
 *
 * Chargement, filtrage et affichage du catalogue games/tools.
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { cloneTemplate } from '../lib/dom.js';
import {
  appendThumbnailImage, matchesQuery, renderTagFilters, setDiscoveryCount, setDiscoveryMessage,
} from '../lib/catalogue-ui.js';

let catalogueError = null;

/**
 * Charge le catalogue depuis le serveur
 */
export async function loadCatalogue() {
  try {
    const response = await fetch('./data/catalogue.json');
    if (!response.ok) { throw new Error('Catalogue introuvable'); }
    catalogueError = null;
    setState({ catalogue: await response.json() });
    renderCatalogue();
  } catch (e) {
    console.error('Erreur chargement catalogue:', e);
    catalogueError = 'Impossible de charger le catalogue. Rechargez la page pour réessayer.';
    setState({ catalogue: null });
    for (const container of [el.cardsGames, el.cardsTools]) {
      const errorEl = document.createElement('p');
      errorEl.className = 'error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = catalogueError;
      container.replaceChildren(errorEl);
    }
    el.emptyGames.classList.remove('visible');
    el.emptyTools.classList.remove('visible');
    renderCatalogue();
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
 * Rend les filtres de tags pour l'onglet actif
 */
export function renderFilters() {
  const tags = getTagsForCurrentTab();
  const items = state.activeTab === 'games' ? state.catalogue.games : state.catalogue.tools;
  renderTagFilters(el.filters, tags.map(tag => ({
    id: tag, label: tag, count: items.filter(item => item.tags?.includes(tag)).length,
  })), state.activeFilter);
}

/**
 * Crée un élément carte avec lien hash
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

  // Générer le lien hash basé sur le type
  const hashLink = type === 'game' ? `#/games/${item.id}` : `#/tools/${item.id}`;

  // Transformer la card en lien
  const link = document.createElement('a');
  link.href = hashLink;
  link.className = 'card-link';
  link.dataset.id = item.id;
  link.dataset.type = type;

  // Copier les attributs de la card
  card.dataset.id = item.id;
  card.dataset.type = type;
  card.dataset.path = item.path;

  // Thumbnail
  const defaultIcon = type === 'game' ? '🎮' : '🔧';
  const thumbSrc = type === 'game'
    ? item.path.replace('index.html', 'thumb.png')
    : item.path.replace('.html', '-thumb.png');

  appendThumbnailImage(thumb, { src: thumbSrc, alt: item.name, fallback: item.icon || defaultIcon });

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

  // Insérer la card dans le lien
  link.appendChild(card);
  fragment.textContent = '';
  fragment.appendChild(link);

  return fragment;
}

/**
 * Filtre les items selon la recherche et le tag actif
 * @param {Object[]} items - Liste des items
 * @returns {Object[]} Items filtrés
 */
export function filterItems(items) {
  const search = el.search.value;
  return items.filter(item => {
    // Filtre par tag
    if (state.activeFilter && !item.tags?.includes(state.activeFilter)) {
      return false;
    }
    // Filtre par recherche
    return matchesQuery(search, item.name, item.description, ...(item.tags || []));
  });
}

/**
 * Rend la liste des outils et son message vide.
 */
function renderToolsSection() {
  const filteredTools = filterItems(state.catalogue.tools);
  el.cardsTools.textContent = '';
  for (const tool of filteredTools) {
    el.cardsTools.appendChild(createCardElement(tool, 'tool'));
  }
  el.emptyTools.textContent = state.catalogue.tools.length
    ? 'Aucun outil ne correspond à cette sélection.' : 'Aucun outil disponible pour le moment.';
  el.emptyTools.classList.toggle('visible', filteredTools.length === 0);
  setDiscoveryCount(filteredTools.length, 'outils');
}

/**
 * Rend la liste des jeux et son message vide.
 */
function renderGamesSection() {
  const filteredGames = filterItems(state.catalogue.games);
  el.cardsGames.textContent = '';
  for (const game of filteredGames) {
    el.cardsGames.appendChild(createCardElement(game, 'game'));
  }
  el.emptyGames.textContent = state.catalogue.games.length
    ? 'Aucun jeu ne correspond à cette sélection.' : 'Aucun jeu disponible pour le moment.';
  el.emptyGames.classList.toggle('visible', filteredGames.length === 0);
  setDiscoveryCount(filteredGames.length, 'jeux');
}

/**
 * Rend le catalogue (onglet actif uniquement)
 */
export function renderCatalogue() {
  if (state.activeTab !== 'tools' && state.activeTab !== 'games') { return; }
  if (!state.catalogue) {
    setDiscoveryMessage(catalogueError || 'Chargement du catalogue…');
    return;
  }

  renderFilters();
  if (state.activeTab === 'tools') { renderToolsSection(); }
  if (state.activeTab === 'games') { renderGamesSection(); }
}
